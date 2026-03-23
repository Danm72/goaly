import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock gog-client
vi.mock('../lib/gog-client.js', () => ({
  checkGogExists: vi.fn(),
  searchThreads: vi.fn(),
  getThread: vi.fn(),
  getHeader: vi.fn((msg: any, name: string) => {
    const h = msg.payload.headers.find((hdr: any) => hdr.name.toLowerCase() === name.toLowerCase());
    return h?.value;
  }),
  getMessageBody: vi.fn(() => ({ text: 'Test body', isHtml: false })),
  createThreadQueue: vi.fn(() => {
    // Simple synchronous queue for testing
    return {
      add: (fn: () => Promise<void>) => fn(),
    };
  }),
}));

import { checkGogExists, searchThreads, getThread } from '../lib/gog-client.js';
import { pull } from '../commands/pull.js';
import { releaseLock } from '../lib/state.js';

const mockCheckGogExists = vi.mocked(checkGogExists);
const mockSearchThreads = vi.mocked(searchThreads);
const mockGetThread = vi.mocked(getThread);

let tempDir: string;
let contactsDir: string;

function makeGogThread(id: string, subject: string, labels: string[] = ['INBOX']) {
  return {
    thread: {
      id,
      historyId: '1000',
      messages: [
        {
          id: `${id}_msg1`,
          threadId: id,
          internalDate: '1709200000000',
          labelIds: labels,
          payload: {
            headers: [
              { name: 'Subject', value: subject },
              { name: 'From', value: 'alice@example.com' },
              { name: 'To', value: 'you@example.com' },
            ],
            mimeType: 'text/plain',
            body: { data: 'VGVzdCBib2R5', size: 9 },
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tempDir = join(tmpdir(), `pull-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  contactsDir = join(tempDir, 'contacts');
  mkdirSync(contactsDir, { recursive: true });
  // Suppress console.log/error during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  releaseLock(tempDir);
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('pull', () => {
  it('performs full pull flow: search → filter → fetch → write → save state', async () => {
    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-01', from: 'alice@example.com', subject: 'Hello', labels: ['INBOX'] },
      ],
    });
    mockGetThread.mockResolvedValue(makeGogThread('t1', 'Hello'));

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.synced).toBe(1);
    expect(result.errors).toHaveLength(0);
    // Thread file should be written
    const threadsDir = join(tempDir, 'threads');
    expect(existsSync(threadsDir)).toBe(true);
    const files = readdirSync(threadsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.md$/);
    // State should be saved
    expect(existsSync(join(tempDir, '.sync-state.json'))).toBe(true);
  });

  it('uses incremental query when last_sync_at exists in state', async () => {
    // Pre-seed state with a last_sync_at
    const stateDir = tempDir;
    writeFileSync(
      join(stateDir, '.sync-state.json'),
      JSON.stringify({
        version: 1,
        last_sync_at: '2026-02-20T00:00:00Z',
        threads: {},
      }),
      'utf-8',
    );

    mockSearchThreads.mockResolvedValue({ threads: [] });

    await pull({ basePath: tempDir, contactsDir });

    expect(mockSearchThreads).toHaveBeenCalledWith('after:2026/02/20');
  });

  it('uses default query (newer_than:365d) when no prior state', async () => {
    mockSearchThreads.mockResolvedValue({ threads: [] });

    await pull({ basePath: tempDir, contactsDir });

    expect(mockSearchThreads).toHaveBeenCalledWith('newer_than:365d');
  });

  it('skips draft-only threads', async () => {
    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 'draft1', date: '2026-03-01', from: 'you@example.com', subject: 'Draft', labels: ['DRAFT'] },
      ],
    });
    mockGetThread.mockResolvedValue({
      thread: {
        id: 'draft1',
        historyId: '1000',
        messages: [
          {
            id: 'draft1_msg1',
            threadId: 'draft1',
            internalDate: '1709200000000',
            labelIds: ['DRAFT'],
            payload: {
              headers: [
                { name: 'Subject', value: 'Draft' },
                { name: 'From', value: 'you@example.com' },
                { name: 'To', value: 'alice@example.com' },
              ],
              mimeType: 'text/plain',
              body: { data: 'RHJhZnQ', size: 5 },
            },
          },
        ],
      },
    });

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.synced).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('does not write files in dry-run mode', async () => {
    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-01', from: 'alice@example.com', subject: 'Hello', labels: ['INBOX'] },
      ],
    });
    mockGetThread.mockResolvedValue(makeGogThread('t1', 'Hello'));

    const result = await pull({ basePath: tempDir, contactsDir, dryRun: true });

    expect(result.synced).toBe(1);
    // No thread files written
    const threadsDir = join(tempDir, 'threads');
    if (existsSync(threadsDir)) {
      const files = readdirSync(threadsDir);
      expect(files).toHaveLength(0);
    }
    // No state file saved
    expect(existsSync(join(tempDir, '.sync-state.json'))).toBe(false);
  });

  it('reports progress via console.log', async () => {
    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-01', from: 'a@b.com', subject: 'Hello', labels: [] },
      ],
    });
    mockGetThread.mockResolvedValue(makeGogThread('t1', 'Hello'));

    await pull({ basePath: tempDir, contactsDir });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Phase 1'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Phase 2'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fetching'));
  });

  it('returns lock error when another process holds the lock', async () => {
    // Create a lock with our own PID (simulates a live process)
    const lockDir = join(tempDir, '.sync-lock');
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'pid'), String(process.pid), 'utf-8');

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Lock held by another process');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Another sync'));
  });

  it('continues processing when a single thread fetch fails', async () => {
    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-01', from: 'a@b.com', subject: 'Good', labels: [] },
        { id: 't2', date: '2026-03-02', from: 'c@d.com', subject: 'Bad', labels: [] },
      ],
    });
    mockGetThread
      .mockResolvedValueOnce(makeGogThread('t1', 'Good'))
      .mockRejectedValueOnce(new Error('Network timeout'));

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.synced).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('t2');
    expect(result.errors[0]).toContain('Network timeout');
  });

  it('skips threads with unchanged message count via needsUpdate', async () => {
    // Pre-seed state with thread t1 (1 message)
    writeFileSync(
      join(tempDir, '.sync-state.json'),
      JSON.stringify({
        version: 1,
        last_sync_at: '2026-03-01T00:00:00Z',
        threads: {
          t1: {
            thread_id: 't1',
            message_count: 1,
            last_message_date: '2026-03-01',
            file_path: 'existing.md',
            content_checksum: 'sha256:abc',
            synced_at: '2026-03-01T00:00:00Z',
          },
        },
      }),
      'utf-8',
    );

    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-01', from: 'a@b.com', subject: 'Old', labels: [] },
        { id: 't2', date: '2026-03-02', from: 'c@d.com', subject: 'New', labels: [] },
      ],
    });
    // t1 still has 1 message (unchanged), t2 is new
    mockGetThread
      .mockResolvedValueOnce(makeGogThread('t1', 'Old'))
      .mockResolvedValueOnce(makeGogThread('t2', 'New'));

    const result = await pull({ basePath: tempDir, contactsDir });

    // t1 fetched but skipped (same message count), t2 synced
    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(1);
    // Both threads are fetched (needsUpdate check happens after fetch)
    expect(mockGetThread).toHaveBeenCalledTimes(2);
    expect(mockGetThread).toHaveBeenCalledWith('t1');
    expect(mockGetThread).toHaveBeenCalledWith('t2');
  });

  it('re-fetches and re-writes threads with updated message counts', async () => {
    // Pre-seed state with thread t1 (1 message)
    mkdirSync(join(tempDir, 'threads'), { recursive: true });
    writeFileSync(join(tempDir, 'threads', 'old-file.md'), '---\ntitle: Old\n---\nold content', 'utf-8');
    writeFileSync(
      join(tempDir, '.sync-state.json'),
      JSON.stringify({
        version: 1,
        last_sync_at: '2026-03-01T00:00:00Z',
        threads: {
          t1: {
            thread_id: 't1',
            message_count: 1,
            last_message_date: '2026-03-01',
            file_path: 'old-file.md',
            content_checksum: 'sha256:abc',
            synced_at: '2026-03-01T00:00:00Z',
          },
        },
      }),
      'utf-8',
    );

    mockSearchThreads.mockResolvedValue({
      threads: [
        { id: 't1', date: '2026-03-02', from: 'a@b.com', subject: 'Updated thread', labels: [] },
      ],
    });

    // Thread now has 2 messages
    const threadWith2Messages = {
      thread: {
        id: 't1',
        historyId: '2000',
        messages: [
          {
            id: 't1_msg1',
            threadId: 't1',
            internalDate: '1709200000000',
            labelIds: ['INBOX'],
            payload: {
              headers: [
                { name: 'Subject', value: 'Updated thread' },
                { name: 'From', value: 'alice@example.com' },
                { name: 'To', value: 'you@example.com' },
              ],
              mimeType: 'text/plain',
              body: { data: 'VGVzdCBib2R5', size: 9 },
            },
          },
          {
            id: 't1_msg2',
            threadId: 't1',
            internalDate: '1709300000000',
            labelIds: ['INBOX'],
            payload: {
              headers: [
                { name: 'Subject', value: 'Re: Updated thread' },
                { name: 'From', value: 'you@example.com' },
                { name: 'To', value: 'alice@example.com' },
              ],
              mimeType: 'text/plain',
              body: { data: 'UmVwbHk=', size: 5 },
            },
          },
        ],
      },
    };
    mockGetThread.mockResolvedValue(threadWith2Messages);

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.synced).toBe(1);
    expect(result.skipped).toBe(0);

    // State should reflect 2 messages now
    const stateRaw = readFileSync(join(tempDir, '.sync-state.json'), 'utf-8');
    const savedState = JSON.parse(stateRaw);
    expect(savedState.threads.t1.message_count).toBe(2);
  });

  it('checks gog exists before proceeding', async () => {
    mockCheckGogExists.mockImplementation(() => {
      throw new Error('gog binary not found');
    });

    await expect(pull({ basePath: tempDir, contactsDir })).rejects.toThrow('gog binary not found');
  });

  it('marks deleted threads with _deleted: true in frontmatter', async () => {
    // Pre-seed state with thread t1 (NO last_sync_at — initial/full sync)
    const threadsDir = join(tempDir, 'threads');
    mkdirSync(threadsDir, { recursive: true });
    writeFileSync(
      join(threadsDir, 'old-thread.md'),
      '---\ntitle: Old thread\nthread_id: t1\n---\nSome content\n',
      'utf-8',
    );
    writeFileSync(
      join(tempDir, '.sync-state.json'),
      JSON.stringify({
        version: 1,
        last_sync_at: '',
        threads: {
          t1: {
            thread_id: 't1',
            message_count: 1,
            last_message_date: '2026-02-01',
            file_path: 'old-thread.md',
            content_checksum: 'sha256:abc',
            synced_at: '2026-02-01T00:00:00Z',
          },
        },
      }),
      'utf-8',
    );

    // Search returns NO threads — t1 is gone from Gmail
    mockSearchThreads.mockResolvedValue({ threads: [] });

    const result = await pull({ basePath: tempDir, contactsDir });

    expect(result.deleted).toBe(1);

    // Check the file has _deleted frontmatter
    const fileContent = readFileSync(join(threadsDir, 'old-thread.md'), 'utf-8');
    expect(fileContent).toContain('_deleted: true');
    expect(fileContent).toContain('_deleted_at');

    // Check state entry is marked deleted
    const stateRaw = readFileSync(join(tempDir, '.sync-state.json'), 'utf-8');
    const savedState = JSON.parse(stateRaw);
    expect(savedState.threads.t1.deleted).toBe(true);
  });
});
