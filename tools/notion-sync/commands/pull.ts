import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

import { queryAllPages } from '../lib/notion-client.js';
import type { PageObjectResponse } from '../lib/notion-client.js';
import { DATABASE_REGISTRY } from '../lib/schema.js';
import type { DatabaseKey } from '../lib/schema.js';
import { notionPageToMarkdown } from '../lib/to-markdown.js';
import {
  loadState,
  saveState,
  updatePageState,
  updatePageIndex,
  getPageState,
} from '../lib/state.js';
import type { SyncState, PageIndexEntry } from '../lib/state.js';
import { computeChecksum } from '../lib/to-notion.js';

// ---------------------------------------------------------------------------
// Database dependency groups (query in order, parallel within groups)
// ---------------------------------------------------------------------------

const DEPENDENCY_GROUPS: DatabaseKey[][] = [
  ['goals', 'projects', 'clients'],
  ['kpis', 'contacts'],
  ['tasks', 'personal_tasks', 'brainstorms', 'interactions'],
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PullOptions {
  basePath: string;
  incremental?: boolean;
  dryRun?: boolean;
}

export interface PullResult {
  totalPages: number;
  newFiles: number;
  modifiedFiles: number;
  unchangedFiles: number;
  deletedInNotion: number;
  duration: number; // ms
  errors: Array<{ pageId: string; error: string }>;
}

interface DatabaseResult {
  dbKey: DatabaseKey;
  pages: PageObjectResponse[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTitle(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map((r) => r.plain_text).join('');
    }
  }
  return 'untitled';
}

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Extract the body portion from a rendered markdown string (after the second ---).
 */
function extractBody(content: string): string {
  const parts = content.split('---\n');
  // parts[0] is empty (before first ---), parts[1] is frontmatter, parts[2+] is body
  return parts.slice(2).join('---\n').trim();
}

function bodyChecksum(body: string): string {
  return 'sha256:' + createHash('sha256').update(body).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Query databases (parallel within group)
// ---------------------------------------------------------------------------

async function queryDatabaseGroup(
  group: DatabaseKey[],
  incrementalSince?: string,
): Promise<DatabaseResult[]> {
  return Promise.all(
    group.map(async (dbKey) => {
      const config = DATABASE_REGISTRY[dbKey];
      const start = Date.now();

      let filter: object | undefined;
      if (incrementalSince) {
        filter = {
          timestamp: 'last_edited_time',
          last_edited_time: { after: incrementalSince },
        } as object;
      }

      const pages = await queryAllPages(config.notionDatabaseId, filter);
      const durationMs = Date.now() - start;

      console.error(
        `  Syncing ${dbKey}... ${pages.length} pages (${(durationMs / 1000).toFixed(1)}s)`,
      );

      return { dbKey, pages, durationMs };
    }),
  );
}

// ---------------------------------------------------------------------------
// Build page index from fetched pages (for relation resolution)
// ---------------------------------------------------------------------------

function buildPageIndex(
  allResults: DatabaseResult[],
  existingIndex: Record<string, PageIndexEntry>,
): Record<string, PageIndexEntry> {
  // Start with existing index so incremental pulls still resolve relations
  const index: Record<string, PageIndexEntry> = { ...existingIndex };

  for (const result of allResults) {
    for (const page of result.pages) {
      const title = extractTitle(page);
      index[page.id] = {
        title,
        file_path: '', // Updated when files are written
        database: result.dbKey,
      };
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Detect deletions (pages in state but not in Notion — full pull only)
// ---------------------------------------------------------------------------

function detectDeletions(
  state: SyncState,
  allNotionIds: Set<string>,
): string[] {
  const deletedIds: string[] = [];
  for (const notionId of Object.keys(state.pages)) {
    if (!allNotionIds.has(notionId)) {
      deletedIds.push(notionId);
    }
  }
  return deletedIds;
}

// ---------------------------------------------------------------------------
// Main pull logic
// ---------------------------------------------------------------------------

export async function pull(options: PullOptions): Promise<PullResult> {
  const { basePath, incremental = false, dryRun = false } = options;
  const totalStart = Date.now();

  const state = loadState(basePath);

  const result: PullResult = {
    totalPages: 0,
    newFiles: 0,
    modifiedFiles: 0,
    unchangedFiles: 0,
    deletedInNotion: 0,
    duration: 0,
    errors: [],
  };

  // Determine incremental filter
  let incrementalSince: string | undefined;
  if (incremental) {
    if (state.last_full_sync) {
      incrementalSince = state.last_full_sync;
      console.error(`Incremental pull (changes since ${incrementalSince})`);
    } else {
      console.error('Warning: No previous sync state found, falling back to full pull.');
    }
  } else {
    console.error('Full pull starting...');
  }

  // Query all databases in dependency order (sequential between groups, parallel within)
  const allResults: DatabaseResult[] = [];
  for (const group of DEPENDENCY_GROUPS) {
    const groupResults = await queryDatabaseGroup(group, incrementalSince);
    allResults.push(...groupResults);
  }

  // Build page index for relation resolution (group 1 pages available before group 3)
  const pageIndex = buildPageIndex(allResults, state.page_index);

  // Collect all Notion IDs from this pull
  const allNotionIds = new Set<string>();
  for (const dbResult of allResults) {
    for (const page of dbResult.pages) {
      allNotionIds.add(page.id);
    }
  }

  // Process each database's pages
  for (const dbResult of allResults) {
    const config = DATABASE_REGISTRY[dbResult.dbKey];

    for (const page of dbResult.pages) {
      result.totalPages++;

      try {
        // Convert page to markdown (Pass 2: notion-to-md fetches blocks internally)
        const converted = await notionPageToMarkdown(page, dbResult.dbKey, pageIndex);
        const filePath = join(config.directory, converted.filename);
        const fullPath = join(basePath, filePath);

        // Check for title rename (existing file has different name)
        const existingState = getPageState(state, page.id);
        const isRename = existingState !== undefined &&
          existingState.file_path !== filePath &&
          existingState.file_path !== '';

        // Compute checksum for change detection
        const body = extractBody(converted.content);
        const newChecksum = computeChecksum(converted.frontmatter, body);
        const contentChanged = !existingState ||
          existingState.content_checksum !== newChecksum;

        if (!contentChanged && !isRename) {
          result.unchangedFiles++;
          continue;
        }

        const isNew = existingState === undefined;

        if (!dryRun) {
          // Handle rename: fs.renameSync (git detects renames automatically)
          if (isRename) {
            const oldFullPath = join(basePath, existingState.file_path);
            if (existsSync(oldFullPath)) {
              ensureDir(dirname(fullPath));
              renameSync(oldFullPath, fullPath);
            }
          }

          // Write the file (new, modified, or renamed+modified)
          ensureDir(dirname(fullPath));
          writeFileSync(fullPath, converted.content, 'utf-8');

          // Update state
          const title = typeof converted.frontmatter['title'] === 'string'
            ? converted.frontmatter['title']
            : 'untitled';

          updatePageState(state, page.id, {
            file_path: filePath,
            notion_last_edited: page.last_edited_time,
            last_synced_at: new Date().toISOString(),
            content_checksum: newChecksum,
            body_checksum: bodyChecksum(body),
          });

          updatePageIndex(state, page.id, title, filePath, dbResult.dbKey);
        }

        if (isNew) {
          result.newFiles++;
        } else {
          result.modifiedFiles++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ pageId: page.id, error: message });
      }
    }
  }

  // Detect deletions (full pull only — don't auto-delete, just report)
  if (!incremental) {
    const deletedIds = detectDeletions(state, allNotionIds);
    result.deletedInNotion = deletedIds.length;

    if (deletedIds.length > 0) {
      console.error(`\n  Deleted in Notion (${deletedIds.length}):`);
      for (const notionId of deletedIds) {
        const pageState = getPageState(state, notionId);
        if (pageState) {
          console.error(`    - ${pageState.file_path}`);
        }
      }
    }
  }

  // Save state and update sync timestamp
  if (!dryRun) {
    state.last_full_sync = new Date().toISOString();
    saveState(basePath, state);
  }

  result.duration = Date.now() - totalStart;
  return result;
}

// ---------------------------------------------------------------------------
// Print result summary
// ---------------------------------------------------------------------------

export function printPullResult(result: PullResult): void {
  const secs = (result.duration / 1000).toFixed(1);

  console.error(
    `\nPull complete: ${result.totalPages} pages across 9 databases (${secs}s)`,
  );
  console.error(`  New:       ${result.newFiles}`);
  console.error(`  Modified:  ${result.modifiedFiles}`);
  console.error(`  Unchanged: ${result.unchangedFiles}`);

  if (result.deletedInNotion > 0) {
    console.error(`  Deleted in Notion: ${result.deletedInNotion} (files preserved locally)`);
  }

  if (result.errors.length > 0) {
    console.error(`\n  Errors (${result.errors.length}):`);
    for (const e of result.errors) {
      console.error(`    ${e.pageId}: ${e.error}`);
    }
  }
}
