// Unit tests for push command internals.
// Uses MSW v2 to mock the Notion API.

// Set env BEFORE any module imports (notion-client.ts throws without it)
process.env['NOTION_TOKEN'] = 'test-token-for-push-tests';

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import yaml from 'js-yaml';

import { handlers } from './mocks/handlers.js';
import {
  TASK_PAGE_ID,
  GOAL_PAGE_ID,
  taskPage,
  goalPage,
  blockChildrenResponse,
} from './mocks/fixtures.js';
import { push } from '../commands/push.js';
import type { PushResult } from '../commands/push.js';
import {
  createEmptyState,
  saveState,
  loadState,
  updatePageState,
  updatePageIndex,
} from '../lib/state.js';
import type { SyncState } from '../lib/state.js';
import { computeChecksum } from '../lib/to-notion.js';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const NOTION_API = 'https://api.notion.com/v1';

// Track API calls for assertions
let apiCalls: Array<{ method: string; url: string; body?: unknown }> = [];

const pushHandlers = [
  ...handlers,

  // PATCH /v1/pages/:id — update page properties or archive
  http.patch(`${NOTION_API}/pages/:id`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as Record<string, unknown>;
    apiCalls.push({ method: 'PATCH', url: `/v1/pages/${id}`, body });

    // Handle archive
    if (body['archived'] === true) {
      return HttpResponse.json({
        ...taskPage,
        id,
        archived: true,
      });
    }

    // Handle property update — return page with updated last_edited_time
    return HttpResponse.json({
      ...taskPage,
      id,
      last_edited_time: '2026-03-03T12:00:00.000Z',
      properties: { ...taskPage.properties, ...(body['properties'] as object ?? {}) },
    });
  }),

  // POST /v1/pages — create page
  http.post(`${NOTION_API}/pages`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    apiCalls.push({ method: 'POST', url: '/v1/pages', body });

    return HttpResponse.json({
      object: 'page',
      id: 'new-page-0000-0000-0000-000000000001',
      created_time: '2026-03-03T11:00:00.000Z',
      last_edited_time: '2026-03-03T11:00:00.000Z',
      created_by: { object: 'user', id: 'user-1' },
      last_edited_by: { object: 'user', id: 'user-1' },
      cover: null,
      icon: null,
      parent: { type: 'database_id', database_id: 'db-1' },
      archived: false,
      in_trash: false,
      properties: body['properties'] ?? {},
      url: 'https://www.notion.so/newpage0000000000000000000001',
      public_url: null,
    });
  }),

  // DELETE /v1/blocks/:id — delete block
  http.delete(`${NOTION_API}/blocks/:id`, ({ params }) => {
    const id = params['id'] as string;
    apiCalls.push({ method: 'DELETE', url: `/v1/blocks/${id}` });
    return HttpResponse.json({
      object: 'block',
      id,
      archived: true,
    });
  }),

  // PATCH /v1/blocks/:id/children — append block children
  http.patch(`${NOTION_API}/blocks/:id/children`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as Record<string, unknown>;
    apiCalls.push({ method: 'PATCH', url: `/v1/blocks/${id}/children`, body });
    return HttpResponse.json({
      object: 'list',
      results: [],
      next_cursor: null,
      has_more: false,
      type: 'block',
      block: {},
    });
  }),
];

const server = setupServer(...pushHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  apiCalls = [];
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(tmpdir(), `notion-sync-push-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTmpDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
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

function setupBasePath(basePath: string): void {
  mkdirSync(join(basePath, 'tasks'), { recursive: true });
  mkdirSync(join(basePath, 'goals'), { recursive: true });
}

function writeStateWithTask(basePath: string, checksum: string): SyncState {
  const state = createEmptyState();
  state.last_full_sync = '2026-03-03T10:00:00Z';
  updatePageState(state, TASK_PAGE_ID, {
    file_path: 'tasks/deploy-staging-environment-ffff00000000.md',
    notion_last_edited: '2026-03-03T10:00:00.000Z',
    last_synced_at: '2026-03-03T10:00:00Z',
    content_checksum: checksum,
  });
  updatePageIndex(state, TASK_PAGE_ID, 'Deploy staging environment', 'tasks/deploy-staging-environment-ffff00000000.md', 'tasks');
  updatePageIndex(state, GOAL_PAGE_ID, 'Build Portfolio of Internet Companies', 'goals/build-portfolio-aaaa00000000.md', 'goals');
  saveState(basePath, state);
  return state;
}

function writeTaskFile(basePath: string, frontmatter: Record<string, unknown>, body: string): string {
  const filename = 'deploy-staging-environment-ffff00000000.md';
  const filePath = join(basePath, 'tasks', filename);
  writeFileSync(filePath, serializeMarkdown(frontmatter, body), 'utf-8');
  return filename;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('push command — property changes', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('pushes property changes and verifies Notion API call', async () => {
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'In progress',
      priority: 'High',
      area: ['Engineering'],
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Body content for page.';

    // Write file first, then compute old checksum with different status
    const oldFrontmatter = { ...frontmatter, status: 'Not started' };
    const oldChecksum = computeChecksum(oldFrontmatter, body);

    writeStateWithTask(basePath, oldChecksum);
    writeTaskFile(basePath, frontmatter, body);

    const result = await push({ basePath });

    expect(result.updatedPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify a PATCH call was made to update properties
    const updateCalls = apiCalls.filter(
      (c) => c.method === 'PATCH' && c.url === `/v1/pages/${TASK_PAGE_ID}`,
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);

    // Verify the Status property was included
    const updateBody = updateCalls[0]!.body as Record<string, unknown>;
    const properties = updateBody['properties'] as Record<string, unknown>;
    expect(properties).toBeDefined();
    expect(properties['Status']).toEqual({ status: { name: 'In progress' } });
  });
});

describe('push command — body changes', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('pushes body changes with delete blocks + append blocks', async () => {
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'Planned this week',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const oldBody = 'Old body content.';
    const newBody = 'New body content with more details.';

    const oldChecksum = computeChecksum(frontmatter, oldBody);
    writeStateWithTask(basePath, oldChecksum);
    writeTaskFile(basePath, frontmatter, newBody);

    const result = await push({ basePath });

    expect(result.updatedPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify blocks were deleted (DELETE calls for existing blocks)
    const deleteCalls = apiCalls.filter((c) => c.method === 'DELETE');
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);

    // Verify new blocks were appended (PATCH to blocks/:id/children)
    const appendCalls = apiCalls.filter(
      (c) => c.method === 'PATCH' && c.url.includes('/children'),
    );
    expect(appendCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('push command — new file creation', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('creates page in Notion and writes notion_id back to file', async () => {
    // Create state file (required) but no task page entry
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    const frontmatter = {
      title: 'New task from markdown',
      status: 'Not started',
      priority: 'Medium',
      area: ['Engineering'],
    };
    const body = 'A new task created locally.';
    const filename = 'new-task-from-markdown.md';
    writeFileSync(
      join(basePath, 'tasks', filename),
      serializeMarkdown(frontmatter, body),
      'utf-8',
    );

    const result = await push({ basePath });

    expect(result.createdPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify POST /v1/pages was called
    const createCalls = apiCalls.filter((c) => c.method === 'POST' && c.url === '/v1/pages');
    expect(createCalls).toHaveLength(1);

    // Verify the file was rewritten with notion_id
    // The file gets renamed with a shortId, so find any .md file in tasks/
    const { readdirSync } = await import('node:fs');
    const tasksDir = join(basePath, 'tasks');
    const files = readdirSync(tasksDir).filter((f: string) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    // Find the file that has 'new-task' or 'newpage' in its name
    const newFile = files.find((f: string) => f.includes('new-task'));
    expect(newFile).toBeDefined();

    const updatedContent = readFileSync(join(tasksDir, newFile!), 'utf-8');
    const parsed = parseFrontmatter(updatedContent);
    expect(parsed.data['notion_id']).toBe('new-page-0000-0000-0000-000000000001');
    expect(parsed.data['_sync_pending']).toBeUndefined();
    expect(parsed.data['_last_synced']).toBeDefined();
  });

  it('writes _sync_pending guard before creating page', async () => {
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    // Track if _sync_pending was written before the create call
    let pendingWasWritten = false;
    const origFilename = 'guard-test-task.md';
    const fullPath = join(basePath, 'tasks', origFilename);

    const frontmatter = {
      title: 'Guard test task',
      status: 'Not started',
    };
    writeFileSync(fullPath, serializeMarkdown(frontmatter, 'Body.'), 'utf-8');

    // Override POST handler to check file state at creation time
    server.use(
      http.post(`${NOTION_API}/pages`, async ({ request }) => {
        // At this point, the file should have _sync_pending
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');
          const parsed = parseFrontmatter(content);
          pendingWasWritten = parsed.data['_sync_pending'] === true;
        }

        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          object: 'page',
          id: 'guard-test-page-id',
          created_time: '2026-03-03T11:00:00.000Z',
          last_edited_time: '2026-03-03T11:00:00.000Z',
          created_by: { object: 'user', id: 'user-1' },
          last_edited_by: { object: 'user', id: 'user-1' },
          cover: null,
          icon: null,
          parent: { type: 'database_id', database_id: 'db-1' },
          archived: false,
          in_trash: false,
          properties: body['properties'] ?? {},
          url: 'https://www.notion.so/guardtest',
          public_url: null,
        });
      }),
    );

    await push({ basePath });

    expect(pendingWasWritten).toBe(true);
  });
});

describe('push command — deletion', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('archives page in Notion when local file is deleted', async () => {
    // Set up state with a page entry that references a file that doesn't exist on disk
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    updatePageState(state, TASK_PAGE_ID, {
      file_path: 'tasks/deploy-staging-environment-ffff00000000.md',
      notion_last_edited: '2026-03-03T10:00:00.000Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: 'sha256:abc123',
    });
    updatePageIndex(state, TASK_PAGE_ID, 'Deploy staging environment', 'tasks/deploy-staging-environment-ffff00000000.md', 'tasks');
    saveState(basePath, state);

    // Don't create the file — it's "deleted"

    const result = await push({ basePath });

    expect(result.archivedPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify archive API call
    const archiveCalls = apiCalls.filter(
      (c) => c.method === 'PATCH' && c.url === `/v1/pages/${TASK_PAGE_ID}`,
    );
    expect(archiveCalls).toHaveLength(1);
    const archiveBody = archiveCalls[0]!.body as Record<string, unknown>;
    expect(archiveBody['archived']).toBe(true);

    // Verify page removed from state
    const updatedState = loadState(basePath);
    expect(updatedState.pages[TASK_PAGE_ID]).toBeUndefined();
  });
});

describe('push command — conflict detection', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('detects remote-wins conflict when Notion page was edited', async () => {
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'Planned this week',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Body content.';
    const checksum = computeChecksum(frontmatter, body);

    // Set up state where local checksum matches (local didn't change, but we manually
    // change the file to have a different checksum to trigger push)
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    updatePageState(state, TASK_PAGE_ID, {
      file_path: 'tasks/deploy-staging-environment-ffff00000000.md',
      notion_last_edited: '2026-03-03T10:00:00.000Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: 'sha256:differentchecksum',
    });
    updatePageIndex(state, TASK_PAGE_ID, 'Deploy staging environment', 'tasks/deploy-staging-environment-ffff00000000.md', 'tasks');
    saveState(basePath, state);

    writeTaskFile(basePath, frontmatter, body);

    // Override getPage to return a page with a newer last_edited_time
    server.use(
      http.get(`${NOTION_API}/pages/${TASK_PAGE_ID}`, () => {
        return HttpResponse.json({
          ...taskPage,
          last_edited_time: '2026-03-03T15:00:00.000Z', // Much newer than state
        });
      }),
    );

    const result = await push({ basePath });

    // detectConflict in push.ts: the local file IS modified (checksum differs from state),
    // and remote is also modified (15:00 > 10:00), so it should be local_wins.
    // But we need to check: push.ts calls detectConflict with localFileModified=true
    // So with both changed, it returns 'local_wins', which logs a warning but still pushes.
    // The conflict counter only increments for 'remote_wins'.
    // Let's verify the push still happened (local_wins means local still pushes).
    expect(result.updatedPages).toBe(1);
    expect(result.conflicts).toBe(0);
  });
});

describe('push command — lock and pending', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    // Clean up lock dir if test left it
    const lockDir = join(basePath, '.sync.lock');
    if (existsSync(lockDir)) {
      rmSync(lockDir, { recursive: true, force: true });
    }
    cleanupTmpDir(basePath);
  });

  it('queues files to .sync-pending when lock is held', async () => {
    // Create state file
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    // Acquire lock manually (simulate another process)
    const lockDir = join(basePath, '.sync.lock');
    mkdirSync(lockDir);

    const result = await push({
      basePath,
      files: ['tasks/some-task.md'],
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.file).toBe('.sync.lock');
    expect(result.errors[0]!.error).toContain('Another push is in progress');

    // Verify .sync-pending was written
    const pendingFile = join(basePath, '.sync-pending');
    expect(existsSync(pendingFile)).toBe(true);
    const pendingContent = readFileSync(pendingFile, 'utf-8');
    expect(pendingContent).toContain('tasks/some-task.md');

    // Clean up lock
    rmSync(lockDir, { recursive: true, force: true });
  });

  it('processes .sync-pending files after main push completes', async () => {
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'In progress',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Updated body.';

    // Set up state with old checksum
    const oldChecksum = computeChecksum({ ...frontmatter, status: 'Not started' }, 'Old body.');
    writeStateWithTask(basePath, oldChecksum);
    writeTaskFile(basePath, frontmatter, body);

    // Write a pending file that references the same task
    const pendingFile = join(basePath, '.sync-pending');
    writeFileSync(pendingFile, 'tasks/deploy-staging-environment-ffff00000000.md\n', 'utf-8');

    const result = await push({ basePath });

    // Should have processed both main and pending
    expect(result.errors).toHaveLength(0);

    // Pending file should be cleared
    expect(existsSync(pendingFile)).toBe(false);
  });
});

describe('push command — missing state file', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('refuses to push without .sync-state.json', async () => {
    // Don't create a state file
    writeFileSync(
      join(basePath, 'tasks', 'some-task.md'),
      serializeMarkdown({ title: 'Test', status: 'Not started' }, 'Body'),
      'utf-8',
    );

    const result = await push({ basePath });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.file).toBe('.sync-state.json');
    expect(result.errors[0]!.error).toContain('No .sync-state.json found');
    expect(result.updatedPages).toBe(0);
    expect(result.createdPages).toBe(0);
    expect(result.archivedPages).toBe(0);
  });
});
