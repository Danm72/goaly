import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageEntry {
  file_path: string;
  notion_last_edited: string;  // ISO timestamp from Notion
  last_synced_at: string;      // ISO timestamp of last sync
  content_checksum: string;    // "sha256:<hex>"
  body_checksum?: string;      // "sha256:<hex>" — body-only hash for conditional body push
}

export interface PageIndexEntry {
  title: string;
  file_path: string;
  database: string;
}

export interface SyncState {
  version: 1;
  last_full_sync: string;  // ISO timestamp
  page_index: Record<string, PageIndexEntry>;  // notion_id → entry
  pages: Record<string, PageEntry>;             // notion_id → entry
}

// ---------------------------------------------------------------------------
// State file path
// ---------------------------------------------------------------------------

const STATE_FILENAME = '.sync-state.json';

function statePath(basePath: string): string {
  return join(basePath, STATE_FILENAME);
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export function createEmptyState(): SyncState {
  return {
    version: 1,
    last_full_sync: '',
    page_index: {},
    pages: {},
  };
}

export function loadState(basePath: string): SyncState {
  const fp = statePath(basePath);
  if (!existsSync(fp)) {
    return createEmptyState();
  }
  const raw = readFileSync(fp, 'utf-8');
  return JSON.parse(raw) as SyncState;
}

export function saveState(basePath: string, state: SyncState): void {
  const fp = statePath(basePath);
  const tmp = fp + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmp, fp);
}

export function getPageState(state: SyncState, notionId: string): PageEntry | undefined {
  return state.pages[notionId];
}

export function updatePageState(state: SyncState, notionId: string, entry: PageEntry): void {
  state.pages[notionId] = entry;
}

export function removePageState(state: SyncState, notionId: string): void {
  delete state.pages[notionId];
  delete state.page_index[notionId];
}

// ---------------------------------------------------------------------------
// Page index operations
// ---------------------------------------------------------------------------

export function updatePageIndex(
  state: SyncState,
  notionId: string,
  title: string,
  filePath: string,
  database: string,
): void {
  state.page_index[notionId] = { title, file_path: filePath, database };
}

export function lookupByTitle(
  state: SyncState,
  database: string,
  title: string,
): string | undefined {
  for (const [notionId, entry] of Object.entries(state.page_index)) {
    if (entry.database === database && entry.title === title) {
      return notionId;
    }
  }
  return undefined;
}

export function lookupById(
  state: SyncState,
  notionId: string,
): PageIndexEntry | undefined {
  return state.page_index[notionId];
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export type ConflictResult = 'no_conflict' | 'local_wins' | 'remote_wins';

export function detectConflict(
  pageState: PageEntry | undefined,
  notionLastEdited: string,
  localFileModified: boolean,
): ConflictResult {
  if (pageState === undefined) {
    return 'no_conflict';
  }

  const notionChanged = notionLastEdited > pageState.notion_last_edited;

  if (localFileModified && notionChanged) {
    return 'local_wins';
  }
  if (notionChanged) {
    return 'remote_wins';
  }
  return 'no_conflict';
}
