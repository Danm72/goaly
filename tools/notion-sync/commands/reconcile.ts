import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import {
  type DatabaseKey,
  DATABASE_REGISTRY,
  getDatabaseKeyByDirectory,
} from '../lib/schema.js';
import {
  type SyncState,
  createEmptyState,
  saveState,
  updatePageIndex,
  updatePageState,
} from '../lib/state.js';
import { computeChecksum } from '../lib/to-notion.js';
import { queryAllPages } from '../lib/notion-client.js';

// ---------------------------------------------------------------------------
// gray-matter with JSON_SCHEMA to prevent date coercion
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  return matter(content, {
    engines: {
      yaml: {
        parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>,
        stringify: (obj: object) => yaml.dump(obj),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Scan local files
// ---------------------------------------------------------------------------

interface LocalFileInfo {
  notionId: string;
  title: string;
  filePath: string;        // relative to basePath
  database: DatabaseKey;
  notionEdited: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

function scanLocalFiles(basePath: string): LocalFileInfo[] {
  const results: LocalFileInfo[] = [];

  for (const [key, config] of Object.entries(DATABASE_REGISTRY)) {
    const dbKey = key as DatabaseKey;
    const dirPath = join(basePath, config.directory);

    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch {
      // Directory doesn't exist yet — skip
      continue;
    }

    for (const filename of entries) {
      if (!filename.endsWith('.md')) continue;

      const fullPath = join(dirPath, filename);
      const stat = statSync(fullPath);
      if (!stat.isFile()) continue;

      const raw = readFileSync(fullPath, 'utf-8');
      const parsed = parseFrontmatter(raw);
      const fm = parsed.data;

      const notionId = fm['notion_id'];
      if (typeof notionId !== 'string' || notionId === '') {
        // Files without notion_id are new (not yet synced) — skip for reconcile
        continue;
      }

      const title = typeof fm['title'] === 'string' ? fm['title'] : '';
      const notionEdited = typeof fm['_notion_edited'] === 'string' ? fm['_notion_edited'] : '';
      const filePath = relative(basePath, fullPath);

      results.push({
        notionId,
        title,
        filePath,
        database: dbKey,
        notionEdited,
        frontmatter: fm,
        body: parsed.content,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Build state from local files
// ---------------------------------------------------------------------------

function buildStateFromFiles(files: LocalFileInfo[]): SyncState {
  const state = createEmptyState();
  const now = new Date().toISOString();
  state.last_full_sync = now;

  for (const file of files) {
    const checksum = computeChecksum(file.frontmatter, file.body);

    updatePageState(state, file.notionId, {
      file_path: file.filePath,
      notion_last_edited: file.notionEdited,
      last_synced_at: now,
      content_checksum: checksum,
    });

    updatePageIndex(state, file.notionId, file.title, file.filePath, file.database);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Verify against Notion API (optional --verify flag)
// ---------------------------------------------------------------------------

interface VerifyReport {
  inNotionNotLocal: Array<{ notionId: string; title: string; database: DatabaseKey }>;
  inLocalNotNotion: Array<{ notionId: string; filePath: string; database: DatabaseKey }>;
  totalNotion: number;
  totalLocal: number;
}

async function verifyAgainstNotion(
  localFiles: LocalFileInfo[],
): Promise<VerifyReport> {
  const localByDb = new Map<DatabaseKey, Set<string>>();
  for (const file of localFiles) {
    let set = localByDb.get(file.database);
    if (!set) {
      set = new Set();
      localByDb.set(file.database, set);
    }
    set.add(file.notionId);
  }

  const report: VerifyReport = {
    inNotionNotLocal: [],
    inLocalNotNotion: [],
    totalNotion: 0,
    totalLocal: localFiles.length,
  };

  const allNotionIds = new Set<string>();

  for (const [key, config] of Object.entries(DATABASE_REGISTRY)) {
    const dbKey = key as DatabaseKey;
    console.log(`  Querying ${dbKey} (${config.notionDatabaseId})...`);

    const pages = await queryAllPages(config.notionDatabaseId);
    console.log(`    ${pages.length} pages found`);
    report.totalNotion += pages.length;

    const localSet = localByDb.get(dbKey) ?? new Set<string>();

    for (const page of pages) {
      allNotionIds.add(page.id);
      if (!localSet.has(page.id)) {
        // Extract title from Notion page properties
        let title = '(untitled)';
        const props = page.properties;
        for (const prop of Object.values(props)) {
          if (prop.type === 'title' && prop.title.length > 0) {
            title = prop.title[0]?.plain_text ?? '(untitled)';
            break;
          }
        }
        report.inNotionNotLocal.push({ notionId: page.id, title, database: dbKey });
      }
    }
  }

  // Check for local files not in Notion
  for (const file of localFiles) {
    if (!allNotionIds.has(file.notionId)) {
      report.inLocalNotNotion.push({
        notionId: file.notionId,
        filePath: file.filePath,
        database: file.database,
      });
    }
  }

  return report;
}

function printVerifyReport(report: VerifyReport): void {
  console.log(`\nVerification results:`);
  console.log(`  Local files:  ${report.totalLocal}`);
  console.log(`  Notion pages: ${report.totalNotion}`);

  if (report.inNotionNotLocal.length > 0) {
    console.log(`\n  Pages in Notion but NOT local (${report.inNotionNotLocal.length}):`);
    for (const item of report.inNotionNotLocal) {
      console.log(`    [${item.database}] ${item.title} (${item.notionId})`);
    }
  }

  if (report.inLocalNotNotion.length > 0) {
    console.log(`\n  Files local but NOT in Notion (${report.inLocalNotNotion.length}):`);
    for (const item of report.inLocalNotNotion) {
      console.log(`    [${item.database}] ${item.filePath} (${item.notionId})`);
    }
  }

  if (report.inNotionNotLocal.length === 0 && report.inLocalNotNotion.length === 0) {
    console.log(`\n  All pages in sync.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface ReconcileOptions {
  basePath: string;
  verify: boolean;
}

export async function reconcile(options: ReconcileOptions): Promise<void> {
  const { basePath, verify } = options;

  console.log(`Scanning local files in ${basePath}...`);
  const files = scanLocalFiles(basePath);
  console.log(`  Found ${files.length} synced files across ${Object.keys(DATABASE_REGISTRY).length} databases.`);

  // Log per-database counts
  const countsByDb = new Map<string, number>();
  for (const file of files) {
    countsByDb.set(file.database, (countsByDb.get(file.database) ?? 0) + 1);
  }
  for (const [db, count] of countsByDb) {
    console.log(`    ${db}: ${count} files`);
  }

  const state = buildStateFromFiles(files);
  saveState(basePath, state);
  console.log(`\nWrote .sync-state.json (${Object.keys(state.pages).length} pages, ${Object.keys(state.page_index).length} index entries)`);

  if (verify) {
    console.log(`\nVerifying against Notion API...`);
    const report = await verifyAgainstNotion(files);
    printVerifyReport(report);
  }
}
