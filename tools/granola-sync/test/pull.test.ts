import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveState, loadState, createEmptyState } from '../lib/state.js';

// Shared mock functions
const mockListMeetings = vi.fn().mockResolvedValue([]);
const mockGetMeetingDetail = vi.fn().mockResolvedValue(null);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

// Mock GranolaClient before importing pull
vi.mock('../lib/granola-client.js', () => ({
  GranolaClient: vi.fn().mockImplementation(() => ({
    listMeetings: mockListMeetings,
    getMeetingDetail: mockGetMeetingDetail,
    disconnect: mockDisconnect,
  })),
}));

const { pull } = await import('../commands/pull.js');

const TEST_DIR = join(tmpdir(), `granola-sync-pull-test-${process.pid}`);
const MEETINGS_DIR = join(TEST_DIR, 'meetings');

beforeEach(() => {
  vi.clearAllMocks();
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  // Reset defaults
  mockListMeetings.mockResolvedValue([]);
  mockGetMeetingDetail.mockResolvedValue(null);
  mockDisconnect.mockResolvedValue(undefined);
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('pull command', () => {
  it('creates meetings directory if not exists', async () => {
    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    expect(existsSync(MEETINGS_DIR)).toBe(true);
    expect(result.synced).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('syncs new meetings to markdown files', async () => {
    mockListMeetings.mockResolvedValue([
      { id: 'meeting-1', title: 'Standup', date: '2026-03-01T09:00:00Z', attendees: ['[Owner]'], has_transcript: true },
    ]);
    mockGetMeetingDetail.mockResolvedValue({
      id: 'meeting-1',
      title: 'Standup',
      date: '2026-03-01T09:00:00Z',
      attendees: ['[Owner]'],
      summary: 'Quick sync.',
      transcript: '[Owner]: All good.',
      action_items: ['Ship it'],
    });

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });

    expect(result.synced).toBe(1);
    expect(result.errors).toEqual([]);

    // Verify file was written
    const state = loadState(TEST_DIR);
    expect(state.meetings['meeting-1']).toBeDefined();
    expect(state.meetings['meeting-1']!.transcript_status).toBe('complete');
  });

  it('skips meetings that have not changed', async () => {
    // First sync: create the meeting
    mockListMeetings.mockResolvedValue([
      { id: 'meeting-1', title: 'Standup', date: '2026-03-01T09:00:00Z', attendees: ['[Owner]'], has_transcript: true },
    ]);
    mockGetMeetingDetail.mockResolvedValue({
      id: 'meeting-1',
      title: 'Standup',
      date: '2026-03-01T09:00:00Z',
      attendees: ['[Owner]'],
      transcript: '[Owner]: All good.',
    });

    await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });

    // Second sync: same content should be skipped
    const result2 = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    expect(result2.skipped).toBe(1);
    expect(result2.synced).toBe(0);
  });

  it('re-checks pending transcripts from previous syncs', async () => {
    // Pre-populate with a pending meeting
    const state = createEmptyState();
    state.last_sync_at = '2026-03-01T00:00:00Z';
    state.meetings['pending-meeting'] = {
      meeting_id: 'pending-meeting',
      transcript_status: 'pending',
      transcript_checksum: null,
      file_path: '2026-03-01-pending-meeting.md',
      synced_at: '2026-03-01T12:00:00Z',
    };
    saveState(TEST_DIR, state);

    // listMeetings returns no new meetings
    mockListMeetings.mockResolvedValue([]);
    // But pending meeting now has transcript
    mockGetMeetingDetail.mockResolvedValue({
      id: 'pending-meeting',
      title: 'Previously Pending',
      date: '2026-03-01T09:00:00Z',
      attendees: ['[Owner]'],
      transcript: 'Now available!',
    });

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });

    expect(mockGetMeetingDetail).toHaveBeenCalledWith('pending-meeting');
    expect(result.synced).toBe(1);

    // Verify transcript_status updated to complete
    const updatedState = loadState(TEST_DIR);
    expect(updatedState.meetings['pending-meeting']!.transcript_status).toBe('complete');
  });

  it('handles dry-run mode without writing files', async () => {
    mockListMeetings.mockResolvedValue([
      { id: 'dry-run-1', title: 'Test', date: '2026-03-01T09:00:00Z', attendees: ['[Owner]'], has_transcript: true },
    ]);
    mockGetMeetingDetail.mockResolvedValue({
      id: 'dry-run-1',
      title: 'Test',
      date: '2026-03-01T09:00:00Z',
      attendees: ['[Owner]'],
      transcript: 'Hello',
    });

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp', dryRun: true });

    expect(result.synced).toBe(1);

    // State should not be updated in dry-run
    const state = loadState(TEST_DIR);
    expect(state.last_sync_at).toBe('');
    expect(Object.keys(state.meetings)).toHaveLength(0);
  });

  it('handles errors from getMeetingDetail gracefully', async () => {
    mockListMeetings.mockResolvedValue([
      { id: 'error-meeting', title: 'Bad', date: '2026-03-01T09:00:00Z', attendees: [], has_transcript: false },
    ]);
    mockGetMeetingDetail.mockRejectedValue(new Error('API timeout'));

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('error-meeting');
    expect(result.errors[0]).toContain('API timeout');
  });

  it('handles null from getMeetingDetail', async () => {
    mockListMeetings.mockResolvedValue([
      { id: 'null-meeting', title: 'Null', date: '2026-03-01T09:00:00Z', attendees: [], has_transcript: false },
    ]);
    mockGetMeetingDetail.mockResolvedValue(null);

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('No detail returned');
  });

  it('updates last_sync_at after successful pull', async () => {
    mockListMeetings.mockResolvedValue([]);

    await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });

    const state = loadState(TEST_DIR);
    expect(state.last_sync_at).not.toBe('');
  });

  it('always disconnects client and releases lock', async () => {
    mockListMeetings.mockRejectedValue(new Error('Connection failed'));

    try {
      await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    } catch {
      // Expected to throw
    }

    // Lock should be released
    expect(existsSync(join(TEST_DIR, '.sync-lock'))).toBe(false);
    // Client disconnect should have been called
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('tracks pending transcripts count', async () => {
    mockListMeetings.mockResolvedValue([
      { id: 'no-transcript', title: 'New', date: '2026-03-01T09:00:00Z', attendees: ['[Owner]'], has_transcript: false },
    ]);
    mockGetMeetingDetail.mockResolvedValue({
      id: 'no-transcript',
      title: 'New',
      date: '2026-03-01T09:00:00Z',
      attendees: ['[Owner]'],
      // No transcript
    });

    const result = await pull({ basePath: TEST_DIR, projectRoot: '/tmp' });
    expect(result.pendingTranscripts).toBe(1);
  });
});
