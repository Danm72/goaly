import { loadState } from '../lib/state.js';

export interface StatusReport {
  lastSyncAt: string | null;
  totalMeetings: number;
  pendingTranscripts: number;
  completeMeetings: number;
  oldestMeeting: string | null;
  newestMeeting: string | null;
}

export function status(options: { basePath: string }): StatusReport {
  const state = loadState(options.basePath);
  const entries = Object.values(state.meetings);
  const pending = entries.filter(e => e.transcript_status === 'pending').length;

  // Extract dates from file paths (format: YYYY-MM-DD-slug-id.md)
  const dates = entries
    .map(e => e.file_path.slice(0, 10))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  return {
    lastSyncAt: state.last_sync_at || null,
    totalMeetings: entries.length,
    pendingTranscripts: pending,
    completeMeetings: entries.length - pending,
    oldestMeeting: dates[0] ?? null,
    newestMeeting: dates[dates.length - 1] ?? null,
  };
}

export function printStatus(report: StatusReport): void {
  console.log('--- Granola Sync Status ---');
  console.log(`Last sync: ${report.lastSyncAt ?? 'Never'}`);
  console.log(`Meetings cached: ${report.totalMeetings}`);
  console.log(`Complete: ${report.completeMeetings}`);
  if (report.pendingTranscripts > 0) {
    console.log(`Pending transcripts: ${report.pendingTranscripts}`);
  }
  if (report.oldestMeeting) {
    console.log(`Date range: ${report.oldestMeeting} → ${report.newestMeeting}`);
  }
}
