import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { searchThreads, getThread, createThreadQueue, getHeader, getMessageBody, checkGogExists } from '../lib/gog-client.js';
import { buildContactLookup } from '../lib/contacts.js';
import { threadToMarkdown } from '../lib/to-markdown.js';
import type { ParsedMessage, ParsedThread } from '../lib/to-markdown.js';
import { loadState, saveState, acquireLock, releaseLock, needsUpdate } from '../lib/state.js';

export interface PullOptions {
  basePath: string; // email-mirror directory
  contactsDir: string; // notion-mirror/contacts/
  dryRun?: boolean;
}

export interface PullResult {
  synced: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

export async function pull(options: PullOptions): Promise<PullResult> {
  const { basePath, contactsDir, dryRun = false } = options;
  const threadsDir = join(basePath, 'threads');

  // Pre-flight
  checkGogExists();

  // Lock
  if (!acquireLock(basePath)) {
    console.error('Another sync is already running. Exiting.');
    return { synced: 0, skipped: 0, deleted: 0, errors: ['Lock held by another process'] };
  }

  try {
    // Ensure output dir
    mkdirSync(threadsDir, { recursive: true });

    // Load state and contacts
    const state = loadState(basePath);
    const contactLookup = buildContactLookup(contactsDir);

    // Phase 1: Search for thread metadata
    const searchQuery = state.last_sync_at
      ? `after:${state.last_sync_at.split('T')[0]!.replace(/-/g, '/')}`
      : 'newer_than:365d';

    console.log(`Phase 1: Searching threads (${searchQuery})...`);
    const searchResult = await searchThreads(searchQuery);
    const threadMetas = searchResult.threads;
    console.log(`Found ${threadMetas.length} threads`);

    // Phase 2: Fetch full content for threads that need updating
    const queue = createThreadQueue();
    const result: PullResult = { synced: 0, skipped: 0, deleted: 0, errors: [] };

    // Fetch ALL returned threads — Gmail's after: filter already limits to threads
    // with new activity. We use needsUpdate() after fetching to decide whether to write.
    console.log(`Phase 2: Fetching ${threadMetas.length} threads...`);

    let fetchCount = 0;
    const fetchPromises = threadMetas.map(meta =>
      queue.add(async () => {
        fetchCount++;
        console.log(`[${fetchCount}/${threadMetas.length}] Fetching: ${meta.subject?.slice(0, 50) ?? meta.id}...`);

        try {
          const fullThread = await getThread(meta.id);
          const messages = fullThread.thread.messages;

          // Skip draft-only threads
          if (messages.every(m => m.labelIds.includes('DRAFT'))) {
            result.skipped++;
            return;
          }

          // Check if thread actually changed (new messages since last sync)
          const existing = state.threads[meta.id];
          if (!needsUpdate(existing, messages.length)) {
            result.skipped++;
            return;
          }

          // Parse messages
          const parsedMessages: ParsedMessage[] = messages.map(msg => {
            const { text, isHtml } = getMessageBody(msg);
            const cc = getHeader(msg, 'Cc');
            return {
              id: msg.id,
              date: new Date(parseInt(msg.internalDate, 10)).toISOString(),
              from: getHeader(msg, 'From') ?? '',
              to: getHeader(msg, 'To') ?? '',
              ...(cc !== undefined ? { cc } : {}),
              subject: getHeader(msg, 'Subject') ?? '',
              body: text,
              isHtml,
              labels: msg.labelIds,
            };
          });

          const parsedThread: ParsedThread = { id: meta.id, messages: parsedMessages };
          const converted = threadToMarkdown(parsedThread, contactLookup);

          if (!dryRun) {
            const filePath = join(threadsDir, converted.filename);
            writeFileSync(filePath, converted.content, 'utf-8');

            const checksum = createHash('sha256').update(converted.content).digest('hex');
            state.threads[meta.id] = {
              thread_id: meta.id,
              message_count: messages.length,
              last_message_date: converted.frontmatter['last_message_date'] as string,
              file_path: converted.filename,
              content_checksum: `sha256:${checksum}`,
              synced_at: new Date().toISOString(),
            };
          }

          result.synced++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`${meta.id}: ${msg}`);
        }
      }),
    );

    await Promise.all(fetchPromises);

    // Detect deleted threads (in state but not in search results)
    // Only mark deleted if we did a full (non-incremental) search
    if (!state.last_sync_at) {
      const searchIds = new Set(threadMetas.map(m => m.id));
      for (const [threadId, entry] of Object.entries(state.threads)) {
        if (!searchIds.has(threadId) && !entry.deleted && !dryRun) {
          const filePath = join(threadsDir, entry.file_path);
          if (existsSync(filePath)) {
            // Mark file as deleted via frontmatter
            try {
              const raw = readFileSync(filePath, 'utf-8');
              const parsed = matter(raw);
              parsed.data['_deleted'] = true;
              parsed.data['_deleted_at'] = new Date().toISOString();
              const updated = matter.stringify(parsed.content, parsed.data);
              writeFileSync(filePath, updated, 'utf-8');
            } catch {
              // If we can't parse/update the file, still count it
            }

            // Mark in state
            entry.deleted = true;
            result.deleted++;
          }
        }
      }
    }

    // Save state
    if (!dryRun) {
      state.last_sync_at = new Date().toISOString();
      saveState(basePath, state);
    }

    return result;
  } finally {
    releaseLock(basePath);
  }
}

export function printPullResult(result: PullResult): void {
  console.log('\n--- Email Sync Results ---');
  console.log(`Synced:  ${result.synced}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Deleted: ${result.deleted}`);
  if (result.errors.length > 0) {
    console.log(`Errors:  ${result.errors.length}`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
}
