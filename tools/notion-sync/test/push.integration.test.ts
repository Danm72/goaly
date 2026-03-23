// Integration tests for push command — full roundtrips with Notion API via MSW.

process.env['NOTION_TOKEN'] = 'test-token-for-push-integration';

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
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
  databaseResponses,
} from './mocks/fixtures.js';
import { push } from '../commands/push.js';
import {
  createEmptyState,
  saveState,
  loadState,
  updatePageState,
  updatePageIndex,
} from '../lib/state.js';
import { computeChecksum } from '../lib/to-notion.js';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const NOTION_API = 'https://api.notion.com/v1';

let capturedProperties: Record<string, unknown> = {};
let createdPageProperties: Record<string, unknown> = {};
let archivedPageIds: string[] = [];
// Track updated pages so GET returns the fresh last_edited_time
let updatedPages: Record<string, Record<string, unknown>> = {};

const integrationHandlers = [
  // GET /v1/pages/:id — return updated page if tracked, else fall back to fixtures
  // MUST be before ...handlers so it takes priority for pages we've updated
  http.get(`${NOTION_API}/pages/:id`, ({ params }) => {
    const id = params['id'] as string;
    if (updatedPages[id]) {
      return HttpResponse.json(updatedPages[id]);
    }
    // Fall back to fixture lookup
    for (const resp of Object.values(databaseResponses)) {
      const typed = resp as { results: Array<{ id: string }> };
      const found = typed.results.find((p) => p.id === id);
      if (found) {
        return HttpResponse.json(found);
      }
    }
    return HttpResponse.json(
      { object: 'error', status: 404, code: 'object_not_found', message: `Page ${id} not found` },
      { status: 404 },
    );
  }),

  // PATCH /v1/pages/:id — capture properties sent
  http.patch(`${NOTION_API}/pages/:id`, async ({ params, request }) => {
    const id = params['id'] as string;
    const body = (await request.json()) as Record<string, unknown>;

    if (body['archived'] === true) {
      archivedPageIds.push(id);
      const archivedPage = {
        ...taskPage,
        id,
        archived: true,
        last_edited_time: '2026-03-03T12:00:00.000Z',
      };
      updatedPages[id] = archivedPage;
      return HttpResponse.json(archivedPage);
    }

    capturedProperties = (body['properties'] ?? {}) as Record<string, unknown>;
    const updated = {
      ...taskPage,
      id,
      last_edited_time: '2026-03-03T12:00:00.000Z',
    };
    updatedPages[id] = updated;
    return HttpResponse.json(updated);
  }),

  // POST /v1/pages — capture create
  http.post(`${NOTION_API}/pages`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    createdPageProperties = (body['properties'] ?? {}) as Record<string, unknown>;

    return HttpResponse.json({
      object: 'page',
      id: 'created-integration-page-001',
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
      url: 'https://www.notion.so/createdintegrationpage001',
      public_url: null,
    });
  }),

  // DELETE /v1/blocks/:id
  http.delete(`${NOTION_API}/blocks/:id`, ({ params }) => {
    return HttpResponse.json({ object: 'block', id: params['id'] as string, archived: true });
  }),

  // PATCH /v1/blocks/:id/children
  http.patch(`${NOTION_API}/blocks/:id/children`, () => {
    return HttpResponse.json({
      object: 'list', results: [], next_cursor: null, has_more: false,
      type: 'block', block: {},
    });
  }),

  // Fall-through handlers from fixtures (database queries, block children)
  ...handlers,
];

const server = setupServer(...integrationHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  capturedProperties = {};
  createdPageProperties = {};
  archivedPageIds = [];
  updatedPages = {};
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(tmpdir(), `notion-push-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('push integration — frontmatter edit → verify Notion API', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('sends correct Notion property format after frontmatter change', async () => {
    const originalFrontmatter = {
      title: 'Deploy staging environment',
      status: 'Not started',
      priority: 'High',
      area: ['Engineering'],
      energy: 'Deep Work',
      timeframe: 'This Week',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Body content for staging deploy.';
    const oldChecksum = computeChecksum(originalFrontmatter, body);

    // Set up state
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    updatePageState(state, TASK_PAGE_ID, {
      file_path: 'tasks/deploy-staging-environment-ffff00000000.md',
      notion_last_edited: '2026-03-03T10:00:00.000Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: oldChecksum,
    });
    updatePageIndex(state, TASK_PAGE_ID, 'Deploy staging environment', 'tasks/deploy-staging-environment-ffff00000000.md', 'tasks');
    saveState(basePath, state);

    // Write file with changed status and priority
    const updatedFrontmatter = {
      ...originalFrontmatter,
      status: 'In progress',
      priority: 'Critical',
    };
    const filename = 'deploy-staging-environment-ffff00000000.md';
    writeFileSync(
      join(basePath, 'tasks', filename),
      serializeMarkdown(updatedFrontmatter, body),
      'utf-8',
    );

    const result = await push({ basePath });

    expect(result.updatedPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify Notion API received correct property format
    expect(capturedProperties['Status']).toEqual({ status: { name: 'In progress' } });
    expect(capturedProperties['Priority']).toEqual({ select: { name: 'Critical' } });
    expect(capturedProperties['Area']).toEqual({ multi_select: [{ name: 'Engineering' }] });
    expect(capturedProperties['Task name']).toEqual({ title: [{ text: { content: 'Deploy staging environment' } }] });

    // State should be updated with new checksum
    const updatedState = loadState(basePath);
    const pageEntry = updatedState.pages[TASK_PAGE_ID];
    expect(pageEntry).toBeDefined();
    expect(pageEntry!.notion_last_edited).toBe('2026-03-03T12:00:00.000Z');
  });
});

describe('push integration — new file → page creation + ID writeback', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('creates page, writes notion_id back, and renames file', async () => {
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    const frontmatter = {
      title: 'Integration test task',
      status: 'Not started',
      priority: 'Low',
      area: ['Operations'],
      goal_id: GOAL_PAGE_ID,
    };
    const body = 'This task was created locally for integration testing.';
    writeFileSync(
      join(basePath, 'tasks', 'integration-test-task.md'),
      serializeMarkdown(frontmatter, body),
      'utf-8',
    );

    const result = await push({ basePath });

    expect(result.createdPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify Notion API received correct page creation request
    expect(createdPageProperties['Task name']).toEqual({
      title: [{ text: { content: 'Integration test task' } }],
    });
    expect(createdPageProperties['Status']).toEqual({ status: { name: 'Not started' } });
    expect(createdPageProperties['Goal']).toEqual({
      relation: [{ id: GOAL_PAGE_ID }],
    });

    // Verify file was renamed with shortId
    const tasksDir = join(basePath, 'tasks');
    const files = readdirSync(tasksDir).filter((f: string) => f.endsWith('.md'));
    expect(files).toHaveLength(1);

    const renamedFile = files[0]!;
    expect(renamedFile).toContain('integration-test-task');
    // Should contain the first 8 chars of the created page ID
    expect(renamedFile).toContain('createdi');

    // Verify notion_id was written back
    const content = readFileSync(join(tasksDir, renamedFile), 'utf-8');
    const parsed = parseFrontmatter(content);
    expect(parsed.data['notion_id']).toBe('created-integration-page-001');
    expect(parsed.data['_sync_pending']).toBeUndefined();
    expect(typeof parsed.data['_last_synced']).toBe('string');

    // State should track the new page
    const updatedState = loadState(basePath);
    const pageEntry = updatedState.pages['created-integration-page-001'];
    expect(pageEntry).toBeDefined();
    expect(pageEntry!.file_path).toContain('integration-test-task');
  });
});

describe('push integration — delete file → Notion archive', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('archives the Notion page and removes from state', async () => {
    // Set up state referencing a file that doesn't exist on disk
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    updatePageState(state, TASK_PAGE_ID, {
      file_path: 'tasks/deleted-task-ffff00000000.md',
      notion_last_edited: '2026-03-03T10:00:00.000Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: 'sha256:deletedchecksum',
    });
    updatePageIndex(state, TASK_PAGE_ID, 'Deleted task', 'tasks/deleted-task-ffff00000000.md', 'tasks');
    saveState(basePath, state);

    // Don't create the file — it's "deleted"

    const result = await push({ basePath });

    expect(result.archivedPages).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify the archive API was called
    expect(archivedPageIds).toContain(TASK_PAGE_ID);

    // Verify state was cleaned up
    const updatedState = loadState(basePath);
    expect(updatedState.pages[TASK_PAGE_ID]).toBeUndefined();
    expect(updatedState.page_index[TASK_PAGE_ID]).toBeUndefined();
  });
});
