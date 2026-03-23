import { execFileSync, execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import PQueue from 'p-queue';

const execFile = promisify(execFileCb);

// Type definitions
export interface GogThreadMeta {
  id: string;
  date: string;
  from: string;
  subject: string;
  labels: string[];
}

export interface GogSearchResult {
  nextPageToken?: string;
  threads: GogThreadMeta[];
}

export interface GogMessageHeader {
  name: string;
  value: string;
}

export interface GogMessagePayload {
  headers: GogMessageHeader[];
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GogMessagePart[];
}

export interface GogMessagePart {
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GogMessagePart[];
}

export interface GogMessage {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds: string[];
  payload: GogMessagePayload;
}

export interface GogThreadFull {
  thread: {
    id: string;
    historyId: string;
    messages: GogMessage[];
  };
}

// Runtime type guards
function isGogSearchResult(value: unknown): value is GogSearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj['threads']);
}

function isGogThreadFull(value: unknown): value is GogThreadFull {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const thread = obj['thread'];
  if (typeof thread !== 'object' || thread === null) return false;
  const t = thread as Record<string, unknown>;
  return typeof t['id'] === 'string' && Array.isArray(t['messages']);
}

const GOG_PATH = '/opt/homebrew/bin/gog';
const ACCOUNT = 'you@example.com';

/** Verify gog binary exists */
export function checkGogExists(): void {
  try {
    execFileSync('which', [GOG_PATH], { stdio: 'pipe' });
  } catch {
    throw new Error(`gog binary not found at ${GOG_PATH}. Install gog first.`);
  }
}

/** Search for email threads matching a query */
export async function searchThreads(query: string): Promise<GogSearchResult> {
  const { stdout } = await execFile(
    GOG_PATH,
    ['gmail', 'search', query, '--json', '--max', '500', '--account', ACCOUNT],
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 60_000 },
  );

  const parsed: unknown = JSON.parse(stdout);
  if (!isGogSearchResult(parsed)) {
    throw new Error('Unexpected search result format from gog');
  }
  return parsed;
}

/** Fetch full thread content by ID */
export async function getThread(threadId: string): Promise<GogThreadFull> {
  const { stdout } = await execFile(
    GOG_PATH,
    ['gmail', 'thread', 'get', threadId, '--json', '--account', ACCOUNT],
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 30_000 },
  );

  const parsed: unknown = JSON.parse(stdout);
  if (!isGogThreadFull(parsed)) {
    throw new Error(`Unexpected thread format from gog for thread ${threadId}`);
  }
  return parsed;
}

/** Extract a header value from a message */
export function getHeader(message: GogMessage, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  const header = message.payload.headers.find(
    h => h.name.toLowerCase() === lowerName,
  );
  return header?.value;
}

/** Decode base64url-encoded body data */
function decodeBody(data: string): string {
  // Gmail uses base64url encoding
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/** Recursively find a MIME part matching the given type */
function findPart(
  parts: GogMessagePart[] | undefined,
  mimeType: string,
): GogMessagePart | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) return part;
    const nested = findPart(part.parts, mimeType);
    if (nested) return nested;
  }
  return undefined;
}

/** Extract the body text from a message, preferring text/plain over text/html */
export function getMessageBody(message: GogMessage): { text: string; isHtml: boolean } {
  const payload = message.payload;

  // Simple message with body directly on payload
  if (payload.body?.data) {
    return {
      text: decodeBody(payload.body.data),
      isHtml: payload.mimeType === 'text/html',
    };
  }

  // Multipart: prefer text/plain
  const textPart = findPart(payload.parts, 'text/plain');
  if (textPart?.body?.data) {
    return { text: decodeBody(textPart.body.data), isHtml: false };
  }

  // Fallback to text/html
  const htmlPart = findPart(payload.parts, 'text/html');
  if (htmlPart?.body?.data) {
    return { text: decodeBody(htmlPart.body.data), isHtml: true };
  }

  return { text: '', isHtml: false };
}

/** Create a PQueue for batched thread fetches */
export function createThreadQueue(): PQueue {
  return new PQueue({ concurrency: 5 });
}
