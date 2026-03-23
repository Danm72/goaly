// Tests for hook-related behaviors: commit filtering, path filtering, lock mechanism.
// These test the behaviors that a post-commit hook would rely on.

process.env['NOTION_TOKEN'] = 'test-token-for-hook-tests';

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
import { TASK_PAGE_ID, taskPage } from './mocks/fixtures.js';
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
let apiCallCount = 0;

const hookHandlers = [
  ...handlers,

  http.patch(`${NOTION_API}/pages/:id`, async ({ params, request }) => {
    apiCallCount++;
    const id = params['id'] as string;
    const body = (await request.json()) as Record<string, unknown>;

    if (body['archived'] === true) {
      return HttpResponse.json({ ...taskPage, id, archived: true });
    }

    return HttpResponse.json({
      ...taskPage,
      id,
      last_edited_time: '2026-03-03T12:00:00.000Z',
    });
  }),

  http.post(`${NOTION_API}/pages`, async ({ request }) => {
    apiCallCount++;
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      object: 'page',
      id: 'hook-created-page-001',
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
      url: 'https://www.notion.so/hookcreated',
      public_url: null,
    });
  }),

  http.delete(`${NOTION_API}/blocks/:id`, () => {
    apiCallCount++;
    return HttpResponse.json({ object: 'block', id: 'block-1', archived: true });
  }),

  http.patch(`${NOTION_API}/blocks/:id/children`, () => {
    apiCallCount++;
    return HttpResponse.json({
      object: 'list', results: [], next_cursor: null, has_more: false,
      type: 'block', block: {},
    });
  }),
];

const server = setupServer(...hookHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
  apiCallCount = 0;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(tmpdir(), `notion-hook-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

function setupBasePath(basePath: string): void {
  mkdirSync(join(basePath, 'tasks'), { recursive: true });
  mkdirSync(join(basePath, 'goals'), { recursive: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hook behavior — non-notion-mirror changes ignored', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('does nothing when explicit files list has no notion-mirror files', async () => {
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    // Push with explicit files that don't exist in any database directory
    // The push command should handle this gracefully — files that don't match
    // any database directory are skipped/errored.
    const result = await push({
      basePath,
      files: ['README.md', 'src/app.ts', 'docs/guide.md'],
    });

    // These files don't match any database directory, so they shouldn't
    // trigger any Notion API calls. They'll either be treated as non-existent
    // (deleted) or unrecognized.
    expect(result.updatedPages).toBe(0);
    expect(result.createdPages).toBe(0);
    // No Notion API calls for page updates/creates
    expect(apiCallCount).toBe(0);
  });

  it('processes only notion-mirror files from explicit list', async () => {
    // Set up state with a real task
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'In progress',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Updated body content.';
    const oldChecksum = computeChecksum({ ...frontmatter, status: 'Not started' }, 'Old body.');

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

    const filename = 'deploy-staging-environment-ffff00000000.md';
    writeFileSync(
      join(basePath, 'tasks', filename),
      serializeMarkdown(frontmatter, body),
      'utf-8',
    );

    // Push with mixed files — the task file should be processed.
    // Non-notion files that don't exist on disk get treated as deletions,
    // but they won't have state entries so pushDelete returns errors.
    const result = await push({
      basePath,
      files: [
        'README.md',
        `tasks/${filename}`,
        'src/unrelated.ts',
      ],
    });

    expect(result.updatedPages).toBe(1);
    // Non-notion files produce errors (no state entry for deleted files),
    // but the valid task file is still processed successfully.
    const taskErrors = result.errors.filter((e) => e.file.startsWith('tasks/'));
    expect(taskErrors).toHaveLength(0);
  });
});

describe('hook behavior — lock mechanism', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
    setupBasePath(basePath);
  });

  afterEach(() => {
    const lockDir = join(basePath, '.sync.lock');
    if (existsSync(lockDir)) {
      rmSync(lockDir, { recursive: true, force: true });
    }
    cleanupTmpDir(basePath);
  });

  it('acquires and releases lock around push', async () => {
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    const lockDir = join(basePath, '.sync.lock');

    // Before push: no lock
    expect(existsSync(lockDir)).toBe(false);

    await push({ basePath });

    // After push: lock should be released
    expect(existsSync(lockDir)).toBe(false);
  });

  it('releases lock even when push encounters errors', async () => {
    const state = createEmptyState();
    state.last_full_sync = '2026-03-03T10:00:00Z';
    saveState(basePath, state);

    // Write a task file with a bad notion_id that will cause API error
    const frontmatter = {
      title: 'Bad task',
      status: 'Not started',
      notion_id: 'nonexistent-page-id',
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    writeFileSync(
      join(basePath, 'tasks', 'bad-task-00000001.md'),
      serializeMarkdown(frontmatter, 'Body.'),
      'utf-8',
    );

    // Override GET /pages to return 404 for this page
    server.use(
      http.get(`${NOTION_API}/pages/nonexistent-page-id`, () => {
        return HttpResponse.json(
          { object: 'error', status: 404, code: 'object_not_found', message: 'Page not found' },
          { status: 404 },
        );
      }),
    );

    // Add to state so scanChangedFiles finds the different checksum
    updatePageState(state, 'nonexistent-page-id', {
      file_path: 'tasks/bad-task-00000001.md',
      notion_last_edited: '2026-03-03T10:00:00.000Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: 'sha256:oldchecksum',
    });
    saveState(basePath, state);

    const result = await push({ basePath });

    // There should be errors
    expect(result.errors.length).toBeGreaterThanOrEqual(1);

    // Lock should still be released
    const lockDir = join(basePath, '.sync.lock');
    expect(existsSync(lockDir)).toBe(false);
  });

  it('concurrent push attempt queues to pending and first push picks up pending', async () => {
    // Set up task file
    const frontmatter = {
      title: 'Deploy staging environment',
      status: 'In progress',
      notion_id: TASK_PAGE_ID,
      _last_synced: '2026-03-03T10:00:00Z',
      _notion_edited: '2026-03-03T10:00:00.000Z',
    };
    const body = 'Body.';
    const oldChecksum = computeChecksum({ ...frontmatter, status: 'Not started' }, 'Old.');

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

    const filename = 'deploy-staging-environment-ffff00000000.md';
    writeFileSync(
      join(basePath, 'tasks', filename),
      serializeMarkdown(frontmatter, body),
      'utf-8',
    );

    // Simulate: Lock is held, second push attempt queues files
    const lockDir = join(basePath, '.sync.lock');
    mkdirSync(lockDir);

    // Second push: should queue and return error
    const pendingResult = await push({
      basePath,
      files: [`tasks/${filename}`],
    });
    expect(pendingResult.errors[0]!.error).toContain('Another push is in progress');
    expect(existsSync(join(basePath, '.sync-pending'))).toBe(true);

    // Release lock (simulating first push completing)
    rmSync(lockDir, { recursive: true, force: true });

    // Now do a real push — it should pick up the pending file
    const result = await push({ basePath });

    // The pending file should have been processed
    expect(existsSync(join(basePath, '.sync-pending'))).toBe(false);
  });
});
