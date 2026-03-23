import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { GranolaClient } from '../lib/granola-client.js';
import { meetingToMarkdown } from '../lib/to-markdown.js';
import { loadState, saveState, needsUpdate, acquireLock, releaseLock } from '../lib/state.js';

export interface PullOptions {
  basePath: string;
  projectRoot: string;
  dryRun?: boolean;
}

export interface PullResult {
  synced: number;
  skipped: number;
  pendingTranscripts: number;
  errors: string[];
}

export async function pull(options: PullOptions): Promise<PullResult> {
  const { basePath, projectRoot, dryRun = false } = options;
  const meetingsDir = join(basePath, 'meetings');

  if (!acquireLock(basePath)) {
    console.error('Another sync is already running. Exiting.');
    return { synced: 0, skipped: 0, pendingTranscripts: 0, errors: ['Lock held'] };
  }

  const client = new GranolaClient(projectRoot);

  try {
    mkdirSync(meetingsDir, { recursive: true });

    const state = loadState(basePath);
    const since = state.last_sync_at ? new Date(state.last_sync_at) : undefined;

    console.log(`Fetching meetings${since ? ` since ${since.toISOString().split('T')[0]}` : ''}...`);
    let meetings: Awaited<ReturnType<typeof client.listMeetings>>;
    try {
      meetings = await client.listMeetings(since);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { synced: 0, skipped: 0, pendingTranscripts: 0, errors: [msg] };
    }
    console.log(`Found ${meetings.length} meetings`);

    // Also re-check any pending transcripts from previous syncs
    const pendingIds = Object.entries(state.meetings)
      .filter(([_, entry]) => entry.transcript_status === 'pending')
      .map(([id]) => id);

    if (pendingIds.length > 0) {
      console.log(`Re-checking ${pendingIds.length} pending transcripts...`);
    }

    const allMeetingIds = [
      ...new Set([
        ...meetings.map(m => m.id),
        ...pendingIds,
      ])
    ];

    const result: PullResult = { synced: 0, skipped: 0, pendingTranscripts: 0, errors: [] };

    for (let i = 0; i < allMeetingIds.length; i++) {
      const meetingId = allMeetingIds[i]!;
      console.log(`[${i + 1}/${allMeetingIds.length}] Processing: ${meetingId}...`);

      try {
        const detail = await client.getMeetingDetail(meetingId);
        if (!detail) {
          result.errors.push(`${meetingId}: No detail returned`);
          continue;
        }

        const transcriptChecksum = detail.transcript
          ? `sha256:${createHash('sha256').update(detail.transcript).digest('hex')}`
          : null;

        const existing = state.meetings[meetingId];
        if (!needsUpdate(existing, transcriptChecksum)) {
          result.skipped++;
          continue;
        }

        const converted = meetingToMarkdown(detail);

        if (!dryRun) {
          const filePath = join(meetingsDir, converted.filename);
          writeFileSync(filePath, converted.content, 'utf-8');

          const status = detail.transcript ? 'complete' as const : 'pending' as const;
          state.meetings[meetingId] = {
            meeting_id: meetingId,
            transcript_status: status,
            transcript_checksum: transcriptChecksum,
            file_path: converted.filename,
            synced_at: new Date().toISOString(),
          };

          if (status === 'pending') result.pendingTranscripts++;
        }

        result.synced++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${meetingId}: ${msg}`);
      }
    }

    if (!dryRun) {
      state.last_sync_at = new Date().toISOString();
      saveState(basePath, state);
    }

    return result;
  } finally {
    await client.disconnect();
    releaseLock(basePath);
  }
}

export function printPullResult(result: PullResult): void {
  console.log('\n--- Granola Sync Results ---');
  console.log(`Synced:  ${result.synced}`);
  console.log(`Skipped: ${result.skipped}`);
  if (result.pendingTranscripts > 0) {
    console.log(`Pending: ${result.pendingTranscripts} (transcripts not yet available)`);
  }
  if (result.errors.length > 0) {
    console.log(`Errors:  ${result.errors.length}`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
}
