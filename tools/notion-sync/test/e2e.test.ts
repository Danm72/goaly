// End-to-end tests — full pull → edit → push → pull roundtrips.
// Uses MSW to mock all Notion API interactions.
// These tests use explicit file lists to avoid pushing all pulled files.

process.env['NOTION_TOKEN'] = 'test-token-for-e2e';

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import yaml from 'js-yaml';

import { handlers } from './mocks/handlers.js';
import {
  TASK_PAGE_ID,
  GOAL_PAGE_ID,
  taskPage,
  databaseResponses,
  blockChildrenResponse,
} from './mocks/fixtures.js';
import { pull } from '../commands/pull.js';
import { push } from '../commands/push.js';
import { loadState } from '../lib/state.js';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const NOTION_API = 'https://api.notion.com/v1';

// Build full handler set: base fixtures + push handlers
// The push-related handlers (PATCH pages, POST pages, DELETE blocks, etc.)
// are placed BEFORE the base handlers so they take priority.
let updatedPagesStore: Record<string, Record<string, unknown>> = {};

const fullHandlers = [
  // GET /pages — check our store first, then fall back to fixtures
  http.get(`${NOTION_API}/pages/:id`, ({ params }) => {
    const id = params['id'] as string;
    if (updatedPagesStore[id]) {
      return HttpResponse.json(updatedPagesStore[id]);
    }
    for (const resp of Object.values(databaseResponses)) {
      const typed = resp as { results: Array<{ id: string }> };
      const found = typed.results.find((p) => p.id === id);
      if (found) return HttpResponse.json(found);
    }
    return HttpResponse.json(
      { object: 'error', status: 404, code: 'object_not_found', message: `Page ${id} not found` },
      { status: 404 },
    );
  }),

  // PATCH pages — update properties or archive
  http.patch(`${NOTION_API}/pages/:id`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as Record<string, unknown>;

    // Find base page
    let basePage: Record<string, unknown> | undefined = updatedPagesStore[id];
    if (!basePage) {
      for (const resp of Object.values(databaseResponses)) {
        const typed = resp as { results: Array<Record<string, unknown>> };
        const found = typed.results.find((p) => p['id'] === id);
        if (found) { basePage = { ...found }; break; }
      }
    }
    if (!basePage) basePage = { id };

    const updated: Record<string, unknown> = {
      ...basePage,
      last_edited_time: new Date().toISOString(),
    };
    if (body['properties']) {
      updated['properties'] = { ...(basePage['properties'] as object ?? {}), ...(body['properties'] as object) };
    }
    if (body['archived'] !== undefined) {
      updated['archived'] = body['archived'];
    }
    updatedPagesStore[id] = updated;
    return HttpResponse.json(updated);
  }),

  // POST /pages — create
  http.post(`${NOTION_API}/pages`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newId = `e2e-created-${Date.now()}`;
    const parent = body['parent'] as Record<string, string>;
    const newPage: Record<string, unknown> = {
      object: 'page',
      id: newId,
      created_time: new Date().toISOString(),
      last_edited_time: new Date().toISOString(),
      created_by: { object: 'user', id: 'user-1' },
      last_edited_by: { object: 'user', id: 'user-1' },
      cover: null,
      icon: null,
      parent: { type: 'database_id', database_id: parent['database_id'] ?? 'unknown' },
      archived: false,
      in_trash: false,
      properties: body['properties'] ?? {},
      url: `https://www.notion.so/${newId.replace(/-/g, '')}`,
      public_url: null,
    };
    updatedPagesStore[newId] = newPage;
    return HttpResponse.json(newPage);
  }),

  // DELETE blocks
  http.delete(`${NOTION_API}/blocks/:id`, ({ params }) => {
    return HttpResponse.json({ object: 'block', id: params['id'] as string, archived: true });
  }),

  // PATCH blocks/:id/children — append
  http.patch(`${NOTION_API}/blocks/:id/children`, () => {
    return HttpResponse.json({
      object: 'list', results: [], next_cursor: null, has_more: false,
      type: 'block', block: {},
    });
  }),

  // Base fixture handlers (database queries, block children, page lookups)
  ...handlers,
];

const server = setupServer(...fullHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  updatedPagesStore = {};
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(tmpdir(), `notion-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTmpDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function parseFrontmatter(content: string) {
  return matter(content, {
    engines: {
      yaml: {
        parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>,
        stringify: (obj: object) => yaml.dump(obj),
      },
    },
  });
}

function serializeMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  return matter.stringify(body ? `\n${body}\n` : '', frontmatter, {
    engines: {
      yaml: {
        stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
        parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
      },
    },
  });
}

function findFile(basePath: string, directory: string, pattern: string): string | undefined {
  const dirPath = join(basePath, directory);
  if (!existsSync(dirPath)) return undefined;
  const files = readdirSync(dirPath);
  return files.find((f: string) => f.includes(pattern));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('e2e — pull → edit frontmatter → push → pull → verify consistency', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it.skip('roundtrips a frontmatter edit through pull/push/pull', { timeout: 60_000 }, async () => {
    // Step 1: Initial pull — gets all 9 pages from fixtures
    const pullResult1 = await pull({ basePath });
    expect(pullResult1.newFiles).toBe(9);
    expect(pullResult1.errors).toHaveLength(0);

    // Step 2: Find the task file and modify its status
    const taskFilename = findFile(basePath, 'tasks', 'deploy-staging');
    expect(taskFilename).toBeDefined();

    const taskFilePath = join(basePath, 'tasks', taskFilename!);
    const originalContent = readFileSync(taskFilePath, 'utf-8');
    const parsed = parseFrontmatter(originalContent);
    expect(parsed.data['status']).toBe('Planned this week');

    // Edit the status
    parsed.data['status'] = 'In progress';
    writeFileSync(taskFilePath, serializeMarkdown(parsed.data as Record<string, unknown>, parsed.content), 'utf-8');

    // Step 3: Push ONLY the modified file (use explicit files list)
    const relPath = relative(basePath, taskFilePath);
    const pushResult = await push({ basePath, files: [relPath] });

    expect(pushResult.updatedPages).toBe(1);
    expect(pushResult.errors).toHaveLength(0);

    // Verify the state was updated
    const stateAfterPush = loadState(basePath);
    const taskEntry = stateAfterPush.pages[TASK_PAGE_ID];
    expect(taskEntry).toBeDefined();

    // Step 4: Pull again — override the tasks database to return the page
    // with updated Status as it would appear in the real Notion API.
    const taskPageAfterPush = {
      ...taskPage,
      last_edited_time: stateAfterPush.pages[TASK_PAGE_ID]!.notion_last_edited,
      properties: {
        ...taskPage.properties,
        Status: {
          type: 'status' as const,
          status: { id: 'sts-1', name: 'In progress', color: 'default' as const },
          id: 'sts',
        },
      },
    };
    server.use(
      http.post(`${NOTION_API}/databases/:id/query`, ({ params }) => {
        const id = params['id'] as string;
        if (id === 'fff00000-test-0000-0000-tasks0000001') {
          return HttpResponse.json({
            object: 'list',
            results: [taskPageAfterPush],
            next_cursor: null,
            has_more: false,
            type: 'page_or_database',
            page_or_database: {},
          });
        }
        const response = databaseResponses[id];
        if (response) return HttpResponse.json(response);
        return HttpResponse.json({
          object: 'list', results: [], next_cursor: null, has_more: false,
          type: 'page_or_database', page_or_database: {},
        });
      }),
    );

    const pullResult2 = await pull({ basePath });
    expect(pullResult2.errors).toHaveLength(0);

    // Step 5: Verify the file still exists with the correct notion_id
    const taskFilenameAfter = findFile(basePath, 'tasks', 'deploy-staging');
    expect(taskFilenameAfter).toBeDefined();
    const finalContent = readFileSync(join(basePath, 'tasks', taskFilenameAfter!), 'utf-8');
    const finalParsed = parseFrontmatter(finalContent);

    expect(finalParsed.data['notion_id']).toBe(TASK_PAGE_ID);
    // The status should reflect what was pushed (our update stored in updatedPagesStore
    // which the PATCH handler merged)
    expect(finalParsed.data['status']).toBe('In progress');
  });
});

describe('e2e — create file → push → pull → verify file has notion_id', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it.skip('roundtrips a new file through push and pull', { timeout: 60_000 }, async () => {
    // Step 1: Initial pull to set up the workspace
    const pullResult1 = await pull({ basePath });
    expect(pullResult1.newFiles).toBe(9);

    // Step 2: Create a new markdown file
    const newFrontmatter: Record<string, unknown> = {
      title: 'E2E roundtrip test task',
      status: 'Not started',
      priority: 'Medium',
      area: ['Engineering'],
      goal_id: GOAL_PAGE_ID,
    };
    const newBody = 'This task was created as part of an end-to-end test.';
    const newFilename = 'e2e-roundtrip-test-task.md';
    writeFileSync(
      join(basePath, 'tasks', newFilename),
      serializeMarkdown(newFrontmatter, newBody),
      'utf-8',
    );

    // Step 3: Push ONLY the new file
    const pushResult = await push({ basePath, files: [`tasks/${newFilename}`] });
    expect(pushResult.createdPages).toBe(1);
    expect(pushResult.errors).toHaveLength(0);

    // Step 4: Verify the file was updated with notion_id
    const renamedFile = findFile(basePath, 'tasks', 'e2e-roundtrip');
    expect(renamedFile).toBeDefined();

    const pushedContent = readFileSync(join(basePath, 'tasks', renamedFile!), 'utf-8');
    const pushedParsed = parseFrontmatter(pushedContent);

    const createdNotionId = pushedParsed.data['notion_id'] as string;
    expect(createdNotionId).toBeDefined();
    expect(createdNotionId).toBeTruthy();
    expect(pushedParsed.data['_sync_pending']).toBeUndefined();

    // Step 5: Verify state tracks the new page
    const stateAfterPush = loadState(basePath);
    const newPageEntry = stateAfterPush.pages[createdNotionId];
    expect(newPageEntry).toBeDefined();
    expect(newPageEntry!.file_path).toContain('e2e-roundtrip');
    expect(newPageEntry!.content_checksum).toMatch(/^sha256:/);

    const newIndexEntry = stateAfterPush.page_index[createdNotionId];
    expect(newIndexEntry).toBeDefined();
    expect(newIndexEntry!.title).toBe('E2E roundtrip test task');
    expect(newIndexEntry!.database).toBe('tasks');

    // Step 6: Pull again — the created page now exists server-side
    // Construct a proper Notion API response for the created page
    const richTextValue = (text: string) => [{
      type: 'text' as const,
      text: { content: text, link: null },
      annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' as const },
      plain_text: text,
      href: null,
    }];
    const createdPageForPull = {
      object: 'page' as const,
      id: createdNotionId,
      created_time: '2026-03-04T10:00:00.000Z',
      last_edited_time: newPageEntry!.notion_last_edited,
      created_by: { object: 'user' as const, id: 'user-1' },
      last_edited_by: { object: 'user' as const, id: 'user-1' },
      cover: null,
      icon: null,
      parent: { type: 'database_id' as const, database_id: 'fff00000-test-0000-0000-tasks0000001' },
      archived: false,
      in_trash: false,
      properties: {
        'Task name': { type: 'title' as const, title: richTextValue('E2E roundtrip test task'), id: 'title' },
        Status: { type: 'status' as const, status: { id: 'sts-1', name: 'Not started', color: 'default' as const }, id: 'sts' },
        Priority: { type: 'select' as const, select: { id: 'sel-1', name: 'Medium', color: 'default' as const }, id: 'sel' },
        Area: { type: 'multi_select' as const, multi_select: [{ id: 'ms-0', name: 'Engineering', color: 'default' as const }], id: 'ms' },
        Goal: { type: 'relation' as const, relation: [{ id: GOAL_PAGE_ID }], id: 'rel', has_more: false },
      },
      url: `https://www.notion.so/${createdNotionId.replace(/-/g, '')}`,
      public_url: null,
    };

    server.use(
      http.post(`${NOTION_API}/databases/:id/query`, ({ params }) => {
        const id = params['id'] as string;
        if (id === 'fff00000-test-0000-0000-tasks0000001') {
          return HttpResponse.json({
            object: 'list',
            results: [taskPage, createdPageForPull],
            next_cursor: null,
            has_more: false,
            type: 'page_or_database',
            page_or_database: {},
          });
        }
        const response = databaseResponses[id];
        if (response) return HttpResponse.json(response);
        return HttpResponse.json({
          object: 'list', results: [], next_cursor: null, has_more: false,
          type: 'page_or_database', page_or_database: {},
        });
      }),
      // Block children for the new page
      http.get(`${NOTION_API}/blocks/${createdNotionId}/children`, () => {
        return HttpResponse.json({
          object: 'list',
          results: [{
            object: 'block',
            id: `block-e2e-1`,
            parent: { type: 'page_id', page_id: createdNotionId },
            created_time: '2026-03-04T10:00:00.000Z',
            last_edited_time: '2026-03-04T10:00:00.000Z',
            created_by: { object: 'user', id: 'user-1' },
            last_edited_by: { object: 'user', id: 'user-1' },
            has_children: false,
            archived: false,
            in_trash: false,
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: 'This task was created as part of an end-to-end test.', link: null },
                annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
                plain_text: 'This task was created as part of an end-to-end test.',
                href: null,
              }],
              color: 'default',
            },
          }],
          next_cursor: null,
          has_more: false,
          type: 'block',
          block: {},
        });
      }),
    );

    const pullResult2 = await pull({ basePath });
    expect(pullResult2.errors).toHaveLength(0);

    // The file should still exist with its notion_id
    const afterPullFile = findFile(basePath, 'tasks', 'e2e-roundtrip');
    expect(afterPullFile).toBeDefined();
    const finalContent = readFileSync(join(basePath, 'tasks', afterPullFile!), 'utf-8');
    const finalParsed = parseFrontmatter(finalContent);
    expect(finalParsed.data['notion_id']).toBe(createdNotionId);
  });
});
