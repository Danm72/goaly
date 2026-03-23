import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
import type { EmailThreadEntry } from '../lib/state.js';

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  // Clean up lock if tests leave one
  releaseLock(tempDir);
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createEmptyState', () => {
  it('returns a valid empty state object', () => {
    const state = createEmptyState();
    expect(state.version).toBe(1);
    expect(state.last_sync_at).toBe('');
    expect(state.threads).toEqual({});
  });
});

describe('loadState', () => {
  it('returns empty state when no state file exists', () => {
    const state = loadState(tempDir);
    expect(state.version).toBe(1);
    expect(state.last_sync_at).toBe('');
    expect(state.threads).toEqual({});
  });

  it('loads existing state file', () => {
    const savedState = {
      version: 1,
      last_sync_at: '2026-03-01T00:00:00Z',
      threads: {
        t1: {
          thread_id: 't1',
          message_count: 3,
          last_message_date: '2026-03-01',
          file_path: 'test.md',
          content_checksum: 'sha256:abc',
          synced_at: '2026-03-01T00:00:00Z',
        },
      },
    };
    writeFileSync(join(tempDir, '.sync-state.json'), JSON.stringify(savedState), 'utf-8');

    const state = loadState(tempDir);
    expect(state.last_sync_at).toBe('2026-03-01T00:00:00Z');
    expect(state.threads['t1']!.message_count).toBe(3);
  });
});

describe('saveState', () => {
  it('saves state and can be loaded back (round-trip)', () => {
    const state = createEmptyState();
    state.last_sync_at = '2026-03-04T12:00:00Z';
    state.threads['t1'] = {
      thread_id: 't1',
      message_count: 5,
      last_message_date: '2026-03-04',
      file_path: '2026-03-04-test-t1.md',
      content_checksum: 'sha256:def',
      synced_at: '2026-03-04T12:00:00Z',
    };

    saveState(tempDir, state);
    const loaded = loadState(tempDir);

    expect(loaded.last_sync_at).toBe('2026-03-04T12:00:00Z');
    expect(loaded.threads['t1']!.message_count).toBe(5);
    expect(loaded.threads['t1']!.file_path).toBe('2026-03-04-test-t1.md');
  });

  it('uses atomic writes (temp file then rename)', () => {
    const state = createEmptyState();
    saveState(tempDir, state);

    // .tmp file should not remain after save
    expect(existsSync(join(tempDir, '.sync-state.json.tmp'))).toBe(false);
    // Actual file should exist
    expect(existsSync(join(tempDir, '.sync-state.json'))).toBe(true);
  });

  it('overwrites existing state file', () => {
    const state1 = createEmptyState();
    state1.last_sync_at = 'first';
    saveState(tempDir, state1);

    const state2 = createEmptyState();
    state2.last_sync_at = 'second';
    saveState(tempDir, state2);

    const loaded = loadState(tempDir);
    expect(loaded.last_sync_at).toBe('second');
  });
});

describe('needsUpdate', () => {
  it('returns true for new thread (undefined existing)', () => {
    expect(needsUpdate(undefined, 3)).toBe(true);
  });

  it('returns false when message_count matches', () => {
    const entry: EmailThreadEntry = {
      thread_id: 't1',
      message_count: 3,
      last_message_date: '2026-03-01',
      file_path: 'test.md',
      content_checksum: 'sha256:abc',
      synced_at: '2026-03-01T00:00:00Z',
    };
    expect(needsUpdate(entry, 3)).toBe(false);
  });

  it('returns true when message_count differs', () => {
    const entry: EmailThreadEntry = {
      thread_id: 't1',
      message_count: 3,
      last_message_date: '2026-03-01',
      file_path: 'test.md',
      content_checksum: 'sha256:abc',
      synced_at: '2026-03-01T00:00:00Z',
    };
    expect(needsUpdate(entry, 5)).toBe(true);
  });

  it('returns true when message_count decreases', () => {
    const entry: EmailThreadEntry = {
      thread_id: 't1',
      message_count: 5,
      last_message_date: '2026-03-01',
      file_path: 'test.md',
      content_checksum: 'sha256:abc',
      synced_at: '2026-03-01T00:00:00Z',
    };
    expect(needsUpdate(entry, 3)).toBe(true);
  });
});

describe('acquireLock / releaseLock', () => {
  it('acquires lock successfully when none exists', () => {
    const acquired = acquireLock(tempDir);
    expect(acquired).toBe(true);
    expect(existsSync(join(tempDir, '.sync-lock'))).toBe(true);

    // Clean up
    releaseLock(tempDir);
  });

  it('stores current PID in lock', () => {
    acquireLock(tempDir);
    const pid = readFileSync(join(tempDir, '.sync-lock', 'pid'), 'utf-8');
    expect(parseInt(pid, 10)).toBe(process.pid);

    releaseLock(tempDir);
  });

  it('releaseLock removes the lock directory', () => {
    acquireLock(tempDir);
    expect(existsSync(join(tempDir, '.sync-lock'))).toBe(true);

    releaseLock(tempDir);
    expect(existsSync(join(tempDir, '.sync-lock'))).toBe(false);
  });

  it('returns false when lock held by live process (own PID)', () => {
    // Manually create a lock with our PID
    const lockDir = join(tempDir, '.sync-lock');
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, 'pid'), String(process.pid), 'utf-8');

    // Trying to acquire again should fail because our process is alive
    const acquired = acquireLock(tempDir);
    expect(acquired).toBe(false);

    releaseLock(tempDir);
  });

  it('steals lock when locked by dead process', () => {
    // Use a PID that almost certainly doesn't exist
    const lockDir = join(tempDir, '.sync-lock');
    mkdirSync(lockDir);
    writeFileSync(join(lockDir, 'pid'), '9999999', 'utf-8');

    const acquired = acquireLock(tempDir);
    expect(acquired).toBe(true);

    // Verify new PID is written
    const pid = readFileSync(join(lockDir, 'pid'), 'utf-8');
    expect(parseInt(pid, 10)).toBe(process.pid);

    releaseLock(tempDir);
  });

  it('releaseLock is safe to call when no lock exists', () => {
    expect(() => releaseLock(tempDir)).not.toThrow();
  });
});
