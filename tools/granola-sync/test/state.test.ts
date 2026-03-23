import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createEmptyState,
  loadState,
  saveState,
  needsUpdate,
  acquireLock,
  releaseLock,
} from '../lib/state.js';
import type { GranolaMeetingEntry } from '../lib/state.js';

const TEST_DIR = join(tmpdir(), 'granola-sync-state-test');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('createEmptyState', () => {
  it('returns a valid empty state', () => {
    const state = createEmptyState();
    expect(state.version).toBe(1);
    expect(state.last_sync_at).toBe('');
    expect(state.meetings).toEqual({});
  });
});

describe('loadState / saveState', () => {
  it('returns empty state when no file exists', () => {
    const state = loadState(TEST_DIR);
    expect(state.version).toBe(1);
    expect(state.meetings).toEqual({});
  });

  it('round-trips state through save and load', () => {
    const state = createEmptyState();
    state.last_sync_at = '2026-03-01T00:00:00.000Z';
    state.meetings['abc-123'] = {
      meeting_id: 'abc-123',
      transcript_status: 'complete',
      transcript_checksum: 'sha256:deadbeef',
      file_path: '2026-03-01-meeting-abc12345.md',
      synced_at: '2026-03-01T12:00:00.000Z',
    };

    saveState(TEST_DIR, state);
    const loaded = loadState(TEST_DIR);

    expect(loaded.version).toBe(1);
    expect(loaded.last_sync_at).toBe('2026-03-01T00:00:00.000Z');
    expect(loaded.meetings['abc-123']?.transcript_status).toBe('complete');
    expect(loaded.meetings['abc-123']?.transcript_checksum).toBe('sha256:deadbeef');
  });

  it('writes atomically via tmp file', () => {
    const state = createEmptyState();
    state.last_sync_at = '2026-03-01T00:00:00.000Z';
    saveState(TEST_DIR, state);

    // tmp file should not exist after save
    expect(existsSync(join(TEST_DIR, '.sync-state.json.tmp'))).toBe(false);
    // State file should exist
    expect(existsSync(join(TEST_DIR, '.sync-state.json'))).toBe(true);
  });
});

describe('needsUpdate', () => {
  it('returns true when no existing entry', () => {
    expect(needsUpdate(undefined, null)).toBe(true);
  });

  it('returns true when existing entry has pending transcript', () => {
    const entry: GranolaMeetingEntry = {
      meeting_id: 'abc',
      transcript_status: 'pending',
      transcript_checksum: null,
      file_path: 'test.md',
      synced_at: '2026-03-01T00:00:00.000Z',
    };
    expect(needsUpdate(entry, null)).toBe(true);
  });

  it('returns true when checksum changed', () => {
    const entry: GranolaMeetingEntry = {
      meeting_id: 'abc',
      transcript_status: 'complete',
      transcript_checksum: 'sha256:old',
      file_path: 'test.md',
      synced_at: '2026-03-01T00:00:00.000Z',
    };
    expect(needsUpdate(entry, 'sha256:new')).toBe(true);
  });

  it('returns false when complete and checksum matches', () => {
    const entry: GranolaMeetingEntry = {
      meeting_id: 'abc',
      transcript_status: 'complete',
      transcript_checksum: 'sha256:same',
      file_path: 'test.md',
      synced_at: '2026-03-01T00:00:00.000Z',
    };
    expect(needsUpdate(entry, 'sha256:same')).toBe(false);
  });

  it('returns false when complete and new checksum is null', () => {
    const entry: GranolaMeetingEntry = {
      meeting_id: 'abc',
      transcript_status: 'complete',
      transcript_checksum: 'sha256:existing',
      file_path: 'test.md',
      synced_at: '2026-03-01T00:00:00.000Z',
    };
    expect(needsUpdate(entry, null)).toBe(false);
  });
});

describe('acquireLock / releaseLock', () => {
  it('acquires and releases lock', () => {
    expect(acquireLock(TEST_DIR)).toBe(true);
    expect(existsSync(join(TEST_DIR, '.sync-lock'))).toBe(true);

    releaseLock(TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.sync-lock'))).toBe(false);
  });

  it('fails to acquire when lock is held by current process', () => {
    expect(acquireLock(TEST_DIR)).toBe(true);
    // Second acquire should fail (same PID is alive)
    expect(acquireLock(TEST_DIR)).toBe(false);
    releaseLock(TEST_DIR);
  });

  it('reclaims stale lock from dead process', () => {
    // Create a lock with a PID that definitely does not exist
    const lockDir = join(TEST_DIR, '.sync-lock');
    mkdirSync(lockDir, { recursive: false });
    const { writeFileSync } = require('node:fs');
    writeFileSync(join(lockDir, 'pid'), '999999999', 'utf-8');

    // Should reclaim the stale lock
    expect(acquireLock(TEST_DIR)).toBe(true);
    releaseLock(TEST_DIR);
  });

  it('releaseLock is safe to call when no lock exists', () => {
    expect(() => releaseLock(TEST_DIR)).not.toThrow();
  });
});
