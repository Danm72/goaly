import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GogMessage } from '../lib/gog-client.js';

// Use vi.hoisted so the mock fn is available inside the hoisted vi.mock factory
const { mockExecFileCb } = vi.hoisted(() => ({
  mockExecFileCb: vi.fn(),
}));

// Mock child_process before importing the module
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execFile: mockExecFileCb,
}));

// Must import after mock setup
import { execFileSync } from 'node:child_process';
import {
  checkGogExists,
  searchThreads,
  getThread,
  getHeader,
  getMessageBody,
} from '../lib/gog-client.js';

const mockExecFileSync = vi.mocked(execFileSync);

/** Helper: make mockExecFileCb resolve with stdout on next call */
function mockExecFileResolve(stdout: string): void {
  mockExecFileCb.mockImplementationOnce(
    (...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void;
      cb(null, { stdout, stderr: '' });
    },
  );
}

/** Helper: make mockExecFileCb reject on next call */
function mockExecFileReject(error: Error): void {
  mockExecFileCb.mockImplementationOnce(
    (...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, result: { stdout: string; stderr: string }) => void;
      cb(error, { stdout: '', stderr: '' });
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkGogExists', () => {
  it('does not throw when gog binary exists', () => {
    mockExecFileSync.mockReturnValueOnce(Buffer.from('/opt/homebrew/bin/gog'));
    expect(() => checkGogExists()).not.toThrow();
    expect(mockExecFileSync).toHaveBeenCalledWith('which', ['/opt/homebrew/bin/gog'], { stdio: 'pipe' });
  });

  it('throws when gog binary is not found', () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(() => checkGogExists()).toThrow('gog binary not found');
  });
});

describe('searchThreads', () => {
  it('returns parsed search results with valid JSON', async () => {
    const validResult = {
      threads: [
        { id: 'thread1', date: '2026-01-01', from: 'a@b.com', subject: 'Hello', labels: ['INBOX'] },
      ],
    };
    mockExecFileResolve(JSON.stringify(validResult));

    const result = await searchThreads('newer_than:7d');
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0]!.id).toBe('thread1');
  });

  it('returns search results with nextPageToken', async () => {
    const validResult = {
      nextPageToken: 'abc123',
      threads: [{ id: 't1', date: '2026-01-01', from: 'a@b.com', subject: 'Test', labels: [] }],
    };
    mockExecFileResolve(JSON.stringify(validResult));

    const result = await searchThreads('newer_than:7d');
    expect(result.nextPageToken).toBe('abc123');
    expect(result.threads).toHaveLength(1);
  });

  it('throws on invalid JSON from gog', async () => {
    mockExecFileResolve('not json{{{');
    await expect(searchThreads('test')).rejects.toThrow();
  });

  it('throws on unexpected search result format', async () => {
    mockExecFileResolve(JSON.stringify({ results: [] }));
    await expect(searchThreads('test')).rejects.toThrow('Unexpected search result format');
  });

  it('throws when execFile fails (spawn failure)', async () => {
    mockExecFileReject(new Error('ENOENT'));
    await expect(searchThreads('test')).rejects.toThrow('ENOENT');
  });
});

describe('getThread', () => {
  it('returns parsed thread with valid JSON', async () => {
    const validThread = {
      thread: {
        id: 'thread1',
        historyId: '999',
        messages: [
          {
            id: 'msg1',
            threadId: 'thread1',
            internalDate: '1700000000000',
            labelIds: ['INBOX'],
            payload: {
              headers: [{ name: 'Subject', value: 'Hello' }],
              mimeType: 'text/plain',
              body: { data: 'SGVsbG8gV29ybGQ', size: 11 },
            },
          },
        ],
      },
    };
    mockExecFileResolve(JSON.stringify(validThread));

    const result = await getThread('thread1');
    expect(result.thread.id).toBe('thread1');
    expect(result.thread.messages).toHaveLength(1);
  });

  it('throws on unexpected thread format (missing id)', async () => {
    mockExecFileResolve(JSON.stringify({ thread: { messages: [] } }));
    await expect(getThread('t1')).rejects.toThrow('Unexpected thread format');
  });

  it('throws on unexpected thread format (missing messages)', async () => {
    mockExecFileResolve(JSON.stringify({ thread: { id: 't1' } }));
    await expect(getThread('t1')).rejects.toThrow('Unexpected thread format');
  });

  it('throws on unexpected thread format (no thread key)', async () => {
    mockExecFileResolve(JSON.stringify({ data: {} }));
    await expect(getThread('t1')).rejects.toThrow('Unexpected thread format');
  });

  it('throws on null input', async () => {
    mockExecFileResolve('null');
    await expect(getThread('t1')).rejects.toThrow('Unexpected thread format');
  });
});

describe('getHeader', () => {
  const makeMsg = (headers: Array<{ name: string; value: string }>): GogMessage => ({
    id: 'msg1',
    threadId: 't1',
    internalDate: '1700000000000',
    labelIds: [],
    payload: { headers, mimeType: 'text/plain' },
  });

  it('returns header value by name (case insensitive)', () => {
    const msg = makeMsg([{ name: 'Subject', value: 'Hello World' }]);
    expect(getHeader(msg, 'subject')).toBe('Hello World');
    expect(getHeader(msg, 'Subject')).toBe('Hello World');
    expect(getHeader(msg, 'SUBJECT')).toBe('Hello World');
  });

  it('returns undefined for missing header', () => {
    const msg = makeMsg([{ name: 'From', value: 'test@example.com' }]);
    expect(getHeader(msg, 'Subject')).toBeUndefined();
  });

  it('returns first matching header', () => {
    const msg = makeMsg([
      { name: 'Subject', value: 'First' },
      { name: 'Subject', value: 'Second' },
    ]);
    expect(getHeader(msg, 'Subject')).toBe('First');
  });
});

describe('getMessageBody', () => {
  const makeMsg = (overrides: Partial<GogMessage['payload']>): GogMessage => ({
    id: 'msg1',
    threadId: 't1',
    internalDate: '1700000000000',
    labelIds: [],
    payload: {
      headers: [],
      mimeType: 'text/plain',
      ...overrides,
    },
  });

  // Helper to base64url encode
  const encode = (text: string): string =>
    Buffer.from(text, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  it('returns body from payload.body.data for simple messages', () => {
    const msg = makeMsg({
      mimeType: 'text/plain',
      body: { data: encode('Hello World'), size: 11 },
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('Hello World');
    expect(result.isHtml).toBe(false);
  });

  it('detects HTML when mimeType is text/html on payload body', () => {
    const msg = makeMsg({
      mimeType: 'text/html',
      body: { data: encode('<p>Hello</p>'), size: 12 },
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('<p>Hello</p>');
    expect(result.isHtml).toBe(true);
  });

  it('prefers text/plain in multipart messages', () => {
    const msg = makeMsg({
      mimeType: 'multipart/alternative',
      body: undefined,
      parts: [
        { mimeType: 'text/plain', body: { data: encode('Plain text'), size: 10 } },
        { mimeType: 'text/html', body: { data: encode('<b>HTML</b>'), size: 11 } },
      ],
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('Plain text');
    expect(result.isHtml).toBe(false);
  });

  it('falls back to text/html when no text/plain exists', () => {
    const msg = makeMsg({
      mimeType: 'multipart/alternative',
      body: undefined,
      parts: [
        { mimeType: 'text/html', body: { data: encode('<b>HTML only</b>'), size: 16 } },
      ],
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('<b>HTML only</b>');
    expect(result.isHtml).toBe(true);
  });

  it('finds text/plain in nested parts', () => {
    const msg = makeMsg({
      mimeType: 'multipart/mixed',
      body: undefined,
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: encode('Nested plain'), size: 12 } },
            { mimeType: 'text/html', body: { data: encode('<b>Nested HTML</b>'), size: 18 } },
          ],
        },
      ],
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('Nested plain');
    expect(result.isHtml).toBe(false);
  });

  it('returns empty string when no body found', () => {
    const msg = makeMsg({
      mimeType: 'multipart/mixed',
      body: undefined,
      parts: [
        { mimeType: 'image/png', body: { data: 'abc', size: 3 } },
      ],
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('');
    expect(result.isHtml).toBe(false);
  });

  it('returns empty when parts array is empty', () => {
    const msg = makeMsg({
      mimeType: 'multipart/mixed',
      body: undefined,
      parts: [],
    });
    const result = getMessageBody(msg);
    expect(result.text).toBe('');
    expect(result.isHtml).toBe(false);
  });
});
