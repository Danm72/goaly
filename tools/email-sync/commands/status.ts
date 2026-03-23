import { loadState } from '../lib/state.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

export interface StatusReport {
  lastSyncAt: string | null;
  totalThreads: number;
  threadsByClient: Record<string, number>;
  oldestThread: string | null;
  newestThread: string | null;
}

export function status(options: { basePath: string }): StatusReport {
  const state = loadState(options.basePath);

  const entries = Object.values(state.threads);
  const dates = entries.map(e => e.last_message_date).sort();

  // Build threadsByClient from actual markdown files
  const threadsByClient: Record<string, number> = {};
  const threadsDir = join(options.basePath, 'threads');
  for (const entry of entries) {
    try {
      const content = readFileSync(join(threadsDir, entry.file_path), 'utf-8');
      const parsed = matter(content);
      const client = parsed.data['client'] as string | undefined;
      if (client) {
        threadsByClient[client] = (threadsByClient[client] ?? 0) + 1;
      }
    } catch {
      // File may not exist yet
    }
  }

  return {
    lastSyncAt: state.last_sync_at || null,
    totalThreads: entries.length,
    threadsByClient,
    oldestThread: dates[0] ?? null,
    newestThread: dates[dates.length - 1] ?? null,
  };
}

export function printStatus(report: StatusReport): void {
  console.log('--- Email Sync Status ---');
  console.log(`Last sync: ${report.lastSyncAt ?? 'Never'}`);
  console.log(`Threads cached: ${report.totalThreads}`);
  if (report.oldestThread) console.log(`Date range: ${report.oldestThread} → ${report.newestThread}`);
  const clients = Object.entries(report.threadsByClient);
  if (clients.length > 0) {
    console.log('By client:');
    for (const [client, count] of clients.sort((a, b) => b[1] - a[1])) {
      console.log(`  ${client}: ${count}`);
    }
  }
}
