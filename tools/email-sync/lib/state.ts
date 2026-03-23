import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export interface EmailThreadEntry {
  thread_id: string;
  message_count: number;
  last_message_date: string;
  file_path: string;
  content_checksum: string;
  synced_at: string;
  deleted?: boolean;
}

export interface EmailSyncState {
  version: 1;
  last_sync_at: string;
  threads: Record<string, EmailThreadEntry>;
}

const STATE_FILENAME = '.sync-state.json';
const LOCK_DIRNAME = '.sync-lock';

export function createEmptyState(): EmailSyncState {
  return { version: 1, last_sync_at: '', threads: {} };
}

export function loadState(basePath: string): EmailSyncState {
  const fp = join(basePath, STATE_FILENAME);
  if (!existsSync(fp)) return createEmptyState();
  const raw = readFileSync(fp, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || (parsed as Record<string, unknown>)['version'] !== 1) {
    return createEmptyState();
  }
  return parsed as EmailSyncState;
}

export function saveState(basePath: string, state: EmailSyncState): void {
  const fp = join(basePath, STATE_FILENAME);
  const tmp = fp + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmp, fp);
}

export function needsUpdate(existing: EmailThreadEntry | undefined, newMessageCount: number): boolean {
  if (!existing) return true;
  return existing.message_count !== newMessageCount;
}

// Lock file mechanism
export function acquireLock(basePath: string): boolean {
  const lockDir = join(basePath, LOCK_DIRNAME);
  try {
    mkdirSync(lockDir, { recursive: false });
    writeFileSync(join(lockDir, 'pid'), String(process.pid), 'utf-8');

    // Clean up on exit
    const cleanup = () => {
      try {
        releaseLock(basePath);
      } catch {
        /* ignore */
      }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);

    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      // Check if PID is still alive
      try {
        const pid = parseInt(readFileSync(join(lockDir, 'pid'), 'utf-8'), 10);
        try {
          process.kill(pid, 0); // Check if process exists
          return false; // Process is alive, lock is held
        } catch {
          // Process is dead, steal the lock
          rmSync(lockDir, { recursive: true, force: true });
          return acquireLock(basePath);
        }
      } catch {
        return false;
      }
    }
    throw err;
  }
}

export function releaseLock(basePath: string): void {
  const lockDir = join(basePath, LOCK_DIRNAME);
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
