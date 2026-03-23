// Push command — syncs local markdown changes to Notion.
// Handles updates, new page creation, deletions, and conflict detection.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  writeFileSync,
  appendFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, relative } from 'node:path';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';
import matter from 'gray-matter';
import yaml from 'js-yaml';

import {
  DATABASE_REGISTRY,
  getDatabaseKeyByDirectory,
  generateFilename,
} from '../lib/schema.js';
import type { DatabaseConfig, DatabaseKey, PropertyDef } from '../lib/schema.js';
import {
  loadState,
  saveState,
  getPageState,
  updatePageState,
  updatePageIndex,
  removePageState,
  detectConflict,
} from '../lib/state.js';
import type { SyncState } from '../lib/state.js';
import {
  parseMarkdownFile,
  markdownToNotionProperties,
  markdownToNotionBlocks,
  computeChecksum,
} from '../lib/to-notion.js';
import {
  resolveOutbound,
  toNotionRelation,
} from '../lib/relations.js';
import {
  getPage,
  updatePage,
  createPage,
  appendBlockChildren,
  getBlockChildren,
  deleteBlock,
  archivePage,
} from '../lib/notion-client.js';
import type { PageObjectResponse } from '../lib/notion-client.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface PushOptions {
  basePath: string;
  files?: string[];
}

export interface PushResult {
  updatedPages: number;
  createdPages: number;
  archivedPages: number;
  conflicts: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

// ─── Lock Management ─────────────────────────────────────────────────

function acquireLock(basePath: string): boolean {
  const lockDir = join(basePath, '.sync.lock');
  try {
    mkdirSync(lockDir);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(basePath: string): void {
  const lockDir = join(basePath, '.sync.lock');
  try {
    rmdirSync(lockDir);
  } catch {
    // Lock already removed
  }
}

function writePending(basePath: string, files: string[]): void {
  const pendingFile = join(basePath, '.sync-pending');
  appendFileSync(pendingFile, files.join('\n') + '\n', 'utf-8');
}

function readAndClearPending(basePath: string): string[] {
  const pendingFile = join(basePath, '.sync-pending');
  if (!existsSync(pendingFile)) return [];

  const content = readFileSync(pendingFile, 'utf-8').trim();
  unlinkSync(pendingFile);

  if (!content) return [];
  return content.split('\n').filter((f) => f.trim() !== '');
}

// ─── Logging ─────────────────────────────────────────────────────────

function ensureLogDir(basePath: string): void {
  const logDir = join(basePath, '.sync-log');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

function logPush(basePath: string, message: string): void {
  ensureLogDir(basePath);
  const logFile = join(basePath, '.sync-log', 'push.log');
  const timestamp = new Date().toISOString();
  appendFileSync(logFile, `${timestamp} ${message}\n`, 'utf-8');
}

function progress(message: string): void {
  process.stderr.write(`  ${message}\n`);
}

// ─── Body Checksum ───────────────────────────────────────────────────

export function bodyChecksum(body: string): string {
  return 'sha256:' + createHash('sha256').update(body).digest('hex').slice(0, 16);
}

// ─── Changed File Detection ──────────────────────────────────────────

/**
 * Scan all markdown files in basePath and compare checksums against state.
 * Returns files where the local checksum differs from the stored checksum,
 * plus state entries whose files no longer exist on disk (deletions).
 */
function scanChangedFiles(
  basePath: string,
  state: SyncState,
): { changed: string[]; deleted: string[] } {
  const changed: string[] = [];
  const seenFiles = new Set<string>();

  for (const config of Object.values(DATABASE_REGISTRY)) {
    const dirPath = join(basePath, config.directory);

    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }

    for (const filename of entries) {
      if (!filename.endsWith('.md')) continue;

      const fullPath = join(dirPath, filename);
      const relPath = relative(basePath, fullPath);
      seenFiles.add(relPath);

      // Parse and checksum
      try {
        const raw = readFileSync(fullPath, 'utf-8');
        const { frontmatter, body } = parseMarkdownFile(raw);
        const localChecksum = computeChecksum(frontmatter, body);
        const notionId = frontmatter['notion_id'];

        if (typeof notionId === 'string' && notionId !== '') {
          const pageState = getPageState(state, notionId);
          if (!pageState || pageState.content_checksum !== localChecksum) {
            changed.push(relPath);
          }
        } else {
          // New file (no notion_id) — always include
          changed.push(relPath);
        }
      } catch {
        // Can't parse — include it so the error surfaces during push
        changed.push(relPath);
      }
    }
  }

  // Detect deletions: state entries whose files no longer exist
  const deleted: string[] = [];
  for (const entry of Object.values(state.pages)) {
    if (!seenFiles.has(entry.file_path)) {
      const fullPath = join(basePath, entry.file_path);
      if (!existsSync(fullPath)) {
        deleted.push(entry.file_path);
      }
    }
  }

  return { changed, deleted };
}

// ─── Database Identification ─────────────────────────────────────────

function identifyDatabase(filePath: string): { dbKey: DatabaseKey; config: DatabaseConfig } | undefined {
  // filePath is relative to basePath, e.g. "tasks/ship-mvp-abc12345.md"
  const dir = dirname(filePath);
  const dbKey = getDatabaseKeyByDirectory(dir);
  if (dbKey === undefined) return undefined;
  return { dbKey, config: DATABASE_REGISTRY[dbKey] };
}

// ─── Relation Resolution ─────────────────────────────────────────────

function resolveRelationsForPush(
  frontmatter: Record<string, unknown>,
  dbConfig: DatabaseConfig,
  state: SyncState,
): { relations: Record<string, object>; warnings: string[] } {
  const relations: Record<string, object> = {};
  const warnings: string[] = [];

  for (const [yamlKey, def] of Object.entries(dbConfig.properties)) {
    if (def.type !== 'relation') continue;

    const relationDef = def as Extract<PropertyDef, { type: 'relation' }>;
    const result = resolveOutbound(frontmatter, yamlKey, relationDef, state);

    if (result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }

    if (result.relationIds.length > 0) {
      relations[def.notionName] = toNotionRelation(result.relationIds);
    }
  }

  return { relations, warnings };
}

// ─── Frontmatter Serialization ───────────────────────────────────────

function serializeMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  return matter.stringify(body ? `\n${body}\n` : '', frontmatter, {
    engines: {
      yaml: {
        stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
        parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
      },
    },
  });
}

// ─── Body Block Operations ───────────────────────────────────────────

async function deleteTopLevelBlocks(pageId: string): Promise<void> {
  // Fetch all top-level blocks and delete them.
  // Children cascade automatically, saving ~75% API calls.
  let cursor: string | undefined;

  do {
    const response = await getBlockChildren(pageId, cursor);

    for (const block of response.results) {
      await deleteBlock(block.id);
    }

    cursor = response.has_more && response.next_cursor
      ? response.next_cursor
      : undefined;
  } while (cursor);
}

async function replaceBody(pageId: string, blocks: BlockObjectRequest[]): Promise<void> {
  if (blocks.length === 0) return;

  // Notion API limit: 100 blocks per append call
  const BATCH_SIZE = 100;
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    await appendBlockChildren(pageId, batch);
  }
}

// ─── Page Update ─────────────────────────────────────────────────────

async function pushUpdate(
  filePath: string,
  basePath: string,
  state: SyncState,
): Promise<'updated' | 'skipped' | 'conflict' | { error: string }> {
  const fullPath = join(basePath, filePath);
  const raw = readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseMarkdownFile(raw);

  const notionId = frontmatter['notion_id'];
  if (typeof notionId !== 'string' || notionId === '') {
    return { error: 'File has no notion_id — use create flow instead' };
  }

  const db = identifyDatabase(filePath);
  if (!db) {
    return { error: `Cannot identify database for path: ${filePath}` };
  }

  // Compute local checksum
  const localChecksum = computeChecksum(frontmatter, body);
  const pageState = getPageState(state, notionId);

  // If checksum hasn't changed from last sync, skip
  if (pageState && pageState.content_checksum === localChecksum) {
    return 'skipped';
  }

  // Fetch current Notion page for conflict detection
  let notionPage: PageObjectResponse;
  try {
    const response = await getPage(notionId);
    if (!('last_edited_time' in response)) {
      return { error: 'Notion page is not a full page object' };
    }
    notionPage = response as PageObjectResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to fetch Notion page: ${message}` };
  }

  // Conflict detection — compare actual local modification state
  const localModified = !pageState || pageState.content_checksum !== localChecksum;
  const conflict = detectConflict(pageState, notionPage.last_edited_time, localModified);
  if (conflict === 'remote_wins') {
    return 'conflict';
  }
  if (conflict === 'local_wins') {
    logPush(basePath, `WARN [${filePath}] Both local and Notion changed — local wins`);
  }

  // Build properties (scalar + relations)
  const properties = markdownToNotionProperties(frontmatter, db.dbKey);
  const { relations, warnings } = resolveRelationsForPush(frontmatter, db.config, state);
  for (const w of warnings) {
    logPush(basePath, `WARN [${filePath}] ${w}`);
  }

  const allProperties = { ...properties, ...relations };

  // Push properties
  await updatePage(notionId, allProperties);

  // Body update — only if body content changed
  const bodyHash = bodyChecksum(body);
  const bodyChanged = !pageState || pageState.body_checksum !== bodyHash;
  if (bodyChanged) {
    const blocks = markdownToNotionBlocks(body);
    await deleteTopLevelBlocks(notionId);
    if (blocks.length > 0) {
      await replaceBody(notionId, blocks);
    }
  }

  // Re-fetch page to get updated last_edited_time
  const updatedPage = await getPage(notionId) as PageObjectResponse;

  // Update state
  updatePageState(state, notionId, {
    file_path: filePath,
    notion_last_edited: updatedPage.last_edited_time,
    last_synced_at: new Date().toISOString(),
    content_checksum: localChecksum,
    body_checksum: bodyHash,
  });

  const title = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : '';
  updatePageIndex(state, notionId, title, filePath, db.dbKey);

  return 'updated';
}

// ─── New Page Creation ───────────────────────────────────────────────

async function pushCreate(
  filePath: string,
  basePath: string,
  state: SyncState,
): Promise<'created' | { error: string }> {
  const fullPath = join(basePath, filePath);
  const raw = readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseMarkdownFile(raw);

  const db = identifyDatabase(filePath);
  if (!db) {
    return { error: `Cannot identify database for path: ${filePath}` };
  }

  // Guard: set _sync_pending before creating to prevent double-creation on interrupt
  if (frontmatter['_sync_pending'] !== true) {
    frontmatter['_sync_pending'] = true;
    writeFileSync(fullPath, serializeMarkdown(frontmatter, body), 'utf-8');
  }

  // Build properties (scalar + relations)
  const properties = markdownToNotionProperties(frontmatter, db.dbKey);
  const { relations, warnings } = resolveRelationsForPush(frontmatter, db.config, state);
  for (const w of warnings) {
    logPush(basePath, `WARN [${filePath}] ${w}`);
  }

  const allProperties = { ...properties, ...relations };

  // Convert body to blocks
  const blocks = markdownToNotionBlocks(body);

  // Create page in Notion
  const parent = { database_id: db.config.notionDatabaseId };
  const createdPage = await createPage(parent, allProperties, blocks) as PageObjectResponse;
  const notionId = createdPage.id;

  // Success — write notion_id back, remove _sync_pending
  frontmatter['notion_id'] = notionId;
  frontmatter['_last_synced'] = new Date().toISOString();
  frontmatter['_notion_edited'] = createdPage.last_edited_time;
  delete frontmatter['_sync_pending'];

  // Generate new filename with shortId
  const title = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : 'untitled';
  const date = typeof frontmatter['date'] === 'string' ? frontmatter['date'] : undefined;
  const type = typeof frontmatter['type'] === 'string' ? frontmatter['type'] : undefined;
  const newFilename = generateFilename(db.config, title, notionId, date, type);
  const dir = dirname(fullPath);
  const newFullPath = join(dir, newFilename);
  const newRelPath = relative(basePath, newFullPath);

  // Write updated content
  writeFileSync(fullPath, serializeMarkdown(frontmatter, body), 'utf-8');

  // Rename if filename changed
  if (basename(fullPath) !== newFilename) {
    renameSync(fullPath, newFullPath);
  }

  // Compute checksum for state
  const checksum = computeChecksum(frontmatter, body);

  // Update state
  updatePageState(state, notionId, {
    file_path: newRelPath,
    notion_last_edited: createdPage.last_edited_time,
    last_synced_at: new Date().toISOString(),
    content_checksum: checksum,
    body_checksum: bodyChecksum(body),
  });

  updatePageIndex(state, notionId, title, newRelPath, db.dbKey);

  return 'created';
}

// ─── Deletion Handling ───────────────────────────────────────────────

async function pushDelete(
  filePath: string,
  state: SyncState,
): Promise<'deleted' | { error: string }> {
  // Look up notion_id from state by file_path
  let notionId: string | undefined;
  for (const [id, entry] of Object.entries(state.pages)) {
    if (entry.file_path === filePath) {
      notionId = id;
      break;
    }
  }

  if (!notionId) {
    return { error: `No notion_id found in state for deleted file: ${filePath}` };
  }

  // Archive in Notion
  try {
    await archivePage(notionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to archive Notion page: ${message}` };
  }

  // Remove from state
  removePageState(state, notionId);

  return 'deleted';
}

// ─── Push Batch ──────────────────────────────────────────────────────

async function pushBatch(
  changed: string[],
  deleted: string[],
  basePath: string,
  state: SyncState,
  result: PushResult,
): Promise<void> {
  // Process changed/new files
  for (const filePath of changed) {
    try {
      const fullPath = join(basePath, filePath);
      if (!existsSync(fullPath)) {
        deleted.push(filePath);
        continue;
      }

      const raw = readFileSync(fullPath, 'utf-8');
      const { frontmatter } = parseMarkdownFile(raw);
      const hasNotionId = typeof frontmatter['notion_id'] === 'string'
        && frontmatter['notion_id'] !== '';

      if (hasNotionId) {
        progress(`Updating ${filePath}...`);
        const outcome = await pushUpdate(filePath, basePath, state);
        if (outcome === 'updated') {
          result.updatedPages++;
          logPush(basePath, `UPDATED ${filePath}`);
        } else if (outcome === 'skipped') {
          // No count change
        } else if (outcome === 'conflict') {
          result.conflicts++;
          logPush(basePath, `CONFLICT ${filePath} — remote wins, skipping`);
        } else {
          result.errors.push({ file: filePath, error: outcome.error });
          logPush(basePath, `ERROR ${filePath}: ${outcome.error}`);
        }
      } else {
        progress(`Creating ${filePath}...`);
        const outcome = await pushCreate(filePath, basePath, state);
        if (outcome === 'created') {
          result.createdPages++;
          logPush(basePath, `CREATED ${filePath}`);
        } else {
          result.errors.push({ file: filePath, error: outcome.error });
          logPush(basePath, `ERROR ${filePath}: ${outcome.error}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ file: filePath, error: message });
      logPush(basePath, `ERROR ${filePath}: ${message}`);
    }
  }

  // Process deletions
  for (const filePath of deleted) {
    try {
      progress(`Archiving ${filePath}...`);
      const outcome = await pushDelete(filePath, state);
      if (outcome === 'deleted') {
        result.archivedPages++;
        logPush(basePath, `ARCHIVED ${filePath}`);
      } else {
        result.errors.push({ file: filePath, error: outcome.error });
        logPush(basePath, `ERROR ${filePath}: ${outcome.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ file: filePath, error: message });
      logPush(basePath, `ERROR ${filePath}: ${message}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

export async function push(options: PushOptions): Promise<PushResult> {
  const { basePath, files: explicitFiles } = options;
  const startTime = Date.now();

  const result: PushResult = {
    updatedPages: 0,
    createdPages: 0,
    archivedPages: 0,
    conflicts: 0,
    errors: [],
    duration: 0,
  };

  // Verify state file exists
  const stateFilePath = join(basePath, '.sync-state.json');
  if (!existsSync(stateFilePath)) {
    result.errors.push({
      file: '.sync-state.json',
      error: 'No .sync-state.json found. Run `notion-sync reconcile` first.',
    });
    result.duration = Date.now() - startTime;
    return result;
  }

  // Acquire lock
  if (!acquireLock(basePath)) {
    // Lock active — queue files and exit
    const filesToPend = explicitFiles ?? [];
    if (filesToPend.length > 0) {
      writePending(basePath, filesToPend);
      logPush(basePath, `Lock active — queued ${filesToPend.length} files to .sync-pending`);
    }
    result.errors.push({
      file: '.sync.lock',
      error: 'Another push is in progress. Files queued to .sync-pending.',
    });
    result.duration = Date.now() - startTime;
    return result;
  }

  try {
    const state = loadState(basePath);

    // Determine files to process
    let changed: string[];
    let deleted: string[];

    if (explicitFiles) {
      // Explicit file list (from post-commit hook) — separate existing from deleted
      changed = [];
      deleted = [];
      for (const f of explicitFiles) {
        const fullPath = join(basePath, f);
        if (existsSync(fullPath)) {
          changed.push(f);
        } else {
          deleted.push(f);
        }
      }
    } else {
      // Full scan — compare all files against state checksums
      progress('Scanning for changed files...');
      const detected = scanChangedFiles(basePath, state);
      changed = detected.changed;
      deleted = detected.deleted;
      progress(`Found ${changed.length} changed, ${deleted.length} deleted`);
    }

    // Process main batch
    await pushBatch(changed, deleted, basePath, state, result);

    // After main push, check for pending files accumulated while we held the lock
    const pending = readAndClearPending(basePath);
    if (pending.length > 0) {
      progress(`Processing ${pending.length} pending files...`);
      const pendingChanged: string[] = [];
      const pendingDeleted: string[] = [];
      for (const f of pending) {
        if (existsSync(join(basePath, f))) {
          pendingChanged.push(f);
        } else {
          pendingDeleted.push(f);
        }
      }
      await pushBatch(pendingChanged, pendingDeleted, basePath, state, result);
    }

    // Save state
    saveState(basePath, state);
  } finally {
    releaseLock(basePath);
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ─── CLI Output ──────────────────────────────────────────────────────

export function printPushResult(result: PushResult): void {
  const total = result.updatedPages + result.createdPages + result.archivedPages;

  if (total === 0 && result.errors.length === 0 && result.conflicts === 0) {
    console.log(JSON.stringify({ ...result, message: 'Nothing to push' }));
    return;
  }

  console.log(JSON.stringify(result));
}
