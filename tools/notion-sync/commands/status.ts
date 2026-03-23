import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadState } from '../lib/state.js';

// ---------------------------------------------------------------------------
// Status report
// ---------------------------------------------------------------------------

export interface StatusReport {
  lastFullSync: string;
  pagesTracked: number;
  indexEntries: number;
  databaseCounts: Record<string, number>;
  lockActive: boolean;
  pendingPushCount: number;
  recentErrors: string[];
}

function countByDatabase(
  pageIndex: Record<string, { database: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of Object.values(pageIndex)) {
    counts[entry.database] = (counts[entry.database] ?? 0) + 1;
  }
  return counts;
}

function readRecentErrors(basePath: string, maxLines: number): string[] {
  const logPath = join(basePath, '.sync-log', 'push.log');
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  // Return last N lines (most recent entries)
  return lines.slice(-maxLines);
}

function checkLockActive(basePath: string): boolean {
  return existsSync(join(basePath, '.sync.lock'));
}

function countPendingPushes(basePath: string): number {
  const pendingFile = join(basePath, '.sync-pending');
  if (!existsSync(pendingFile)) return 0;
  try {
    const content = readFileSync(pendingFile, 'utf-8').trim();
    if (!content) return 0;
    return content.split('\n').filter(line => line.trim() !== '').length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface StatusOptions {
  basePath: string;
}

export function status(options: StatusOptions): StatusReport {
  const { basePath } = options;
  const state = loadState(basePath);

  const report: StatusReport = {
    lastFullSync: state.last_full_sync || '(never)',
    pagesTracked: Object.keys(state.pages).length,
    indexEntries: Object.keys(state.page_index).length,
    databaseCounts: countByDatabase(state.page_index),
    lockActive: checkLockActive(basePath),
    pendingPushCount: countPendingPushes(basePath),
    recentErrors: readRecentErrors(basePath, 5),
  };

  return report;
}

export function printStatus(report: StatusReport): void {
  console.log('notion-sync status');
  console.log('==================');
  console.log(`Last full sync:  ${report.lastFullSync}`);
  console.log(`Pages tracked:   ${report.pagesTracked}`);
  console.log(`Index entries:   ${report.indexEntries}`);

  const dbKeys = Object.keys(report.databaseCounts).sort();
  if (dbKeys.length > 0) {
    console.log('\nBy database:');
    for (const db of dbKeys) {
      console.log(`  ${db}: ${report.databaseCounts[db]}`);
    }
  }

  console.log(`\nLock:            ${report.lockActive ? 'ACTIVE (push in progress)' : 'clear'}`);
  console.log(`Pending pushes:  ${report.pendingPushCount}`);

  if (report.recentErrors.length > 0) {
    console.log('\nRecent errors:');
    for (const line of report.recentErrors) {
      console.log(`  ${line}`);
    }
  } else {
    console.log('\nNo recent errors.');
  }
}
