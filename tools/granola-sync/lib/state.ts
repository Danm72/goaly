import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export interface GranolaMeetingEntry {
  meeting_id: string;
  transcript_status: 'pending' | 'complete';
  transcript_checksum: string | null;
  file_path: string;
  synced_at: string;
}

export interface GranolaSyncState {
  version: 1;
  last_sync_at: string;
  meetings: Record<string, GranolaMeetingEntry>;
}

const STATE_FILENAME = '.sync-state.json';
const LOCK_DIRNAME = '.sync-lock';

export function createEmptyState(): GranolaSyncState {
  return { version: 1, last_sync_at: '', meetings: {} };
}

export function loadState(basePath: string): GranolaSyncState {
  const fp = join(basePath, STATE_FILENAME);
  if (!existsSync(fp)) return createEmptyState();
  const raw = readFileSync(fp, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || (parsed as Record<string, unknown>)['version'] !== 1) {
    return createEmptyState();
  }
  return parsed as GranolaSyncState;
}

export function saveState(basePath: string, state: GranolaSyncState): void {
  const fp = join(basePath, STATE_FILENAME);
  const tmp = fp + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  renameSync(tmp, fp);
}

export function needsUpdate(
  existing: GranolaMeetingEntry | undefined,
  newChecksum: string | null,
): boolean {
  if (!existing) return true;
  if (existing.transcript_status === 'pending') return true;
  if (newChecksum && existing.transcript_checksum !== newChecksum) return true;
  return false;
}

// Lock file mechanism (same pattern as email-sync)
export function acquireLock(basePath: string): boolean {
  const lockDir = join(basePath, LOCK_DIRNAME);
  try {
    mkdirSync(lockDir, { recursive: false });
    writeFileSync(join(lockDir, 'pid'), String(process.pid), 'utf-8');

    const cleanup = () => { try { releaseLock(basePath); } catch { /* ignore */ } };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);

    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      try {
        const pid = parseInt(readFileSync(join(lockDir, 'pid'), 'utf-8'), 10);
        try {
          process.kill(pid, 0);
          return false;
        } catch {
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
  } catch { /* ignore */ }
}
