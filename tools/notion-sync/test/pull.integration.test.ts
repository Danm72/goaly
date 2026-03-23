// Integration tests for the pull command.
// Uses MSW v2 to mock the Notion API.

// Set env BEFORE any module imports (notion-client.ts throws without it)
process.env['NOTION_TOKEN'] = 'test-token-for-integration-tests';

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import yaml from 'js-yaml';

import { handlers } from './mocks/handlers.js';
import {
  GOAL_PAGE_ID,
  PROJECT_PAGE_ID,
  CLIENT_PAGE_ID,
  KPI_PAGE_ID,
  CONTACT_PAGE_ID,
  TASK_PAGE_ID,
  PERSONAL_TASK_PAGE_ID,
  BRAINSTORM_PAGE_ID,
  INTERACTION_PAGE_ID,
  PAGINATED_TASK_PAGE_2_ID,
  databaseResponses,
  blockChildrenResponse,
  paginatedPage1Response,
  paginatedPage2Response,
  renamedTaskPage,
  taskPage,
} from './mocks/fixtures.js';
import { pull } from '../commands/pull.js';
import { loadState, saveState, createEmptyState, updatePageState, updatePageIndex } from '../lib/state.js';
import { DATABASE_REGISTRY } from '../lib/schema.js';

// ---------------------------------------------------------------------------
// MSW server setup
// ---------------------------------------------------------------------------

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

function createTmpDir(): string {
  const dir = join(tmpdir(), `notion-sync-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTmpDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function findFile(basePath: string, directory: string, pattern: string): string | undefined {
  const dirPath = join(basePath, directory);
  if (!existsSync(dirPath)) return undefined;
  const { readdirSync } = require('node:fs');
  const files = readdirSync(dirPath) as string[];
  return files.find((f: string) => f.includes(pattern));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pull command — full pull', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('creates files for all 9 databases', async () => {
    const result = await pull({ basePath });

    expect(result.totalPages).toBe(9);
    expect(result.newFiles).toBe(9);
    expect(result.errors).toHaveLength(0);

    // Verify each database directory has a file
    const dirs = [
      'goals', 'projects', 'clients', 'kpis', 'contacts',
      'tasks', 'personal-tasks', 'brainstorms', 'interactions',
    ];
    for (const dir of dirs) {
      const dirPath = join(basePath, dir);
      expect(existsSync(dirPath)).toBe(true);
    }
  });

  it('writes correct frontmatter for a goal page', async () => {
    await pull({ basePath });

    const filename = findFile(basePath, 'goals', 'build-portfolio');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'goals', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    expect(parsed.data['title']).toBe('Build Portfolio of Internet Companies');
    expect(parsed.data['status']).toBe('Active');
    expect(parsed.data['lifecycle']).toBe('Active');
    expect(parsed.data['priority']).toBe('High');
    expect(parsed.data['area']).toEqual(['Product', 'Growth']);
    expect(parsed.data['horizon']).toBe('Multi-Year');
    expect(parsed.data['notion_id']).toBe(GOAL_PAGE_ID);
    expect(typeof parsed.data['_last_synced']).toBe('string');
    expect(typeof parsed.data['_notion_edited']).toBe('string');
  });

  it('writes correct frontmatter for a KPI page with formula fields', async () => {
    await pull({ basePath });

    const filename = findFile(basePath, 'kpis', 'monthly-recurring');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'kpis', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    expect(parsed.data['current_value']).toBe(6600);
    expect(parsed.data['target_value']).toBe(12000);
    expect(parsed.data['_gap']).toBe(5400);
    expect(parsed.data['_progress']).toBe(55);
    expect(parsed.data['goal_id']).toBe(GOAL_PAGE_ID);
  });

  it('renders body markdown from block children', async () => {
    await pull({ basePath });

    const filename = findFile(basePath, 'goals', 'build-portfolio');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'goals', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    expect(parsed.content).toContain('Body content for page');
  });

  it('generates correct interactions filename with date and type', async () => {
    await pull({ basePath });

    const filename = findFile(basePath, 'interactions', '2026-02-23');
    expect(filename).toBeDefined();
    expect(filename).toContain('meeting');
    expect(filename).toContain('discovery-call');
  });

  it('updates .sync-state.json', async () => {
    await pull({ basePath });

    const state = loadState(basePath);
    expect(state.last_full_sync).toBeTruthy();
    expect(Object.keys(state.pages)).toHaveLength(9);
    expect(Object.keys(state.page_index)).toHaveLength(9);

    // Verify a specific page entry
    const goalEntry = state.pages[GOAL_PAGE_ID];
    expect(goalEntry).toBeDefined();
    expect(goalEntry!.file_path).toContain('goals/');
    expect(goalEntry!.notion_last_edited).toBe('2026-03-03T10:00:00.000Z');
    expect(goalEntry!.content_checksum).toMatch(/^sha256:/);

    // Verify page index
    const goalIndex = state.page_index[GOAL_PAGE_ID];
    expect(goalIndex).toBeDefined();
    expect(goalIndex!.title).toBe('Build Portfolio of Internet Companies');
    expect(goalIndex!.database).toBe('goals');
  });

  it('preserves date strings (no coercion to Date objects)', async () => {
    await pull({ basePath });

    const filename = findFile(basePath, 'tasks', 'deploy-staging');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'tasks', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    expect(typeof parsed.data['due_date']).toBe('string');
    expect(parsed.data['due_date']).toBe('2026-03-07');
  });
});

describe('pull command — relation resolution', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('writes both human name and _id for relations', async () => {
    await pull({ basePath });

    // Task has Goal and Project relations
    const filename = findFile(basePath, 'tasks', 'deploy-staging');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'tasks', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    // Goal relation (cardinality: one)
    expect(parsed.data['goal_id']).toBe(GOAL_PAGE_ID);
    expect(parsed.data['goal']).toBe('Build Portfolio of Internet Companies');

    // Project relation (cardinality: one)
    expect(parsed.data['project_id']).toBe(PROJECT_PAGE_ID);
    expect(parsed.data['project']).toContain('Client-B');
  });

  it('writes multiple relation IDs for cardinality many', async () => {
    await pull({ basePath });

    // Interaction has Contacts relation (cardinality: many)
    const filename = findFile(basePath, 'interactions', 'discovery-call');
    expect(filename).toBeDefined();

    const content = readFileSync(join(basePath, 'interactions', filename!), 'utf-8');
    const parsed = parseFrontmatter(content);

    expect(parsed.data['contacts_ids']).toEqual([CONTACT_PAGE_ID]);
    expect(parsed.data['contacts']).toEqual(['Contact-4']);
  });
});

describe('pull command — incremental', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('falls back to full pull when no state exists', async () => {
    const result = await pull({ basePath, incremental: true });

    // Should behave like full pull
    expect(result.totalPages).toBe(9);
    expect(result.newFiles).toBe(9);
  });

  it('only processes pages changed since last sync', async () => {
    // First: do a full pull
    await pull({ basePath });

    // Record query count for incremental
    let queryCount = 0;
    server.use(
      http.post('https://api.notion.com/v1/databases/:id/query', ({ params, request }) => {
        queryCount++;
        const id = params['id'] as string;
        // Return empty results for all databases (nothing changed)
        return HttpResponse.json({
          object: 'list',
          results: [],
          next_cursor: null,
          has_more: false,
          type: 'page_or_database',
          page_or_database: {},
        });
      }),
    );

    const result = await pull({ basePath, incremental: true });

    // All databases queried but no pages returned
    expect(queryCount).toBe(9);
    expect(result.totalPages).toBe(0);
    expect(result.newFiles).toBe(0);
    expect(result.unchangedFiles).toBe(0);
  });
});

describe('pull command — dry run', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('reports what would change without writing files', async () => {
    const result = await pull({ basePath, dryRun: true });

    expect(result.totalPages).toBe(9);
    expect(result.newFiles).toBe(9);

    // No files should be created
    const goalsDir = join(basePath, 'goals');
    expect(existsSync(goalsDir)).toBe(false);

    // No state file should be created
    expect(existsSync(join(basePath, '.sync-state.json'))).toBe(false);
  });
});

describe('pull command — pagination', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('fetches all pages across multiple requests', async () => {
    // Override tasks database to return paginated results
    let requestNum = 0;
    server.use(
      http.post('https://api.notion.com/v1/databases/:id/query', ({ params, request }) => {
        const id = params['id'] as string;

        // Only paginate the tasks database
        if (id === 'fff00000-test-0000-0000-tasks0000001') {
          requestNum++;
          if (requestNum === 1) {
            return HttpResponse.json(paginatedPage1Response());
          }
          return HttpResponse.json(paginatedPage2Response());
        }

        // Other databases return normal responses
        const response = databaseResponses[id];
        if (response) {
          return HttpResponse.json(response);
        }
        return HttpResponse.json({
          object: 'list', results: [], next_cursor: null, has_more: false,
          type: 'page_or_database', page_or_database: {},
        });
      }),
    );

    const result = await pull({ basePath });

    // Should have 10 total pages (2 tasks + 8 others)
    expect(result.totalPages).toBe(10);
    expect(result.newFiles).toBe(10);

    // Verify both task files exist
    const tasksDir = join(basePath, 'tasks');
    expect(existsSync(tasksDir)).toBe(true);

    const file1 = findFile(basePath, 'tasks', 'deploy-staging');
    const file2 = findFile(basePath, 'tasks', 'set-up-ci');
    expect(file1).toBeDefined();
    expect(file2).toBeDefined();
  });
});

describe('pull command — title rename', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('renames file when title changes and updates state', async () => {
    // First pull — creates original file
    await pull({ basePath });

    const originalFilename = findFile(basePath, 'tasks', 'deploy-staging');
    expect(originalFilename).toBeDefined();

    // Override the tasks database to return the renamed page
    server.use(
      http.post('https://api.notion.com/v1/databases/:id/query', ({ params }) => {
        const id = params['id'] as string;

        if (id === 'fff00000-test-0000-0000-tasks0000001') {
          // Return the renamed task page
          return HttpResponse.json({
            object: 'list',
            results: [renamedTaskPage],
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

    // Second pull — should rename the file
    const result = await pull({ basePath });

    // Original file should be gone
    expect(existsSync(join(basePath, 'tasks', originalFilename!))).toBe(false);

    // New file should exist
    const newFilename = findFile(basePath, 'tasks', 'deploy-production');
    expect(newFilename).toBeDefined();

    // State should point to new file path
    const state = loadState(basePath);
    const entry = state.pages[TASK_PAGE_ID];
    expect(entry).toBeDefined();
    expect(entry!.file_path).toContain('deploy-production');

    // Page index should have new title
    const indexEntry = state.page_index[TASK_PAGE_ID];
    expect(indexEntry).toBeDefined();
    expect(indexEntry!.title).toBe('Deploy production environment');
  });
});

describe('pull command — deletion detection', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('reports pages deleted in Notion without removing local files', async () => {
    // First pull
    await pull({ basePath });

    // Verify task file exists
    const taskFile = findFile(basePath, 'tasks', 'deploy-staging');
    expect(taskFile).toBeDefined();

    // Override tasks database to return empty (simulating deletion in Notion)
    server.use(
      http.post('https://api.notion.com/v1/databases/:id/query', ({ params }) => {
        const id = params['id'] as string;

        if (id === 'fff00000-test-0000-0000-tasks0000001') {
          return HttpResponse.json({
            object: 'list', results: [], next_cursor: null, has_more: false,
            type: 'page_or_database', page_or_database: {},
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

    // Second pull — should detect deletion
    const result = await pull({ basePath });

    expect(result.deletedInNotion).toBe(1);

    // Local file should still exist (we don't auto-delete)
    expect(existsSync(join(basePath, 'tasks', taskFile!))).toBe(true);
  });
});

describe('pull command — error handling', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('continues processing other pages when one fails', async () => {
    // Override to make goals database return a page with bad data that will fail conversion
    server.use(
      http.post('https://api.notion.com/v1/databases/:id/query', ({ params }) => {
        const id = params['id'] as string;

        if (id === 'aaa00000-test-0000-0000-goals0000001') {
          // Return a valid page that will work, plus trigger a block children error
          return HttpResponse.json(databaseResponses[id]);
        }

        const response = databaseResponses[id];
        if (response) return HttpResponse.json(response);
        return HttpResponse.json({
          object: 'list', results: [], next_cursor: null, has_more: false,
          type: 'page_or_database', page_or_database: {},
        });
      }),
      // Make block children fail for the goal page specifically
      http.get(`https://api.notion.com/v1/blocks/${GOAL_PAGE_ID}/children`, () => {
        return HttpResponse.json(
          { object: 'error', status: 500, code: 'internal_server_error', message: 'Simulated error' },
          { status: 500 },
        );
      }),
    );

    const result = await pull({ basePath });

    // The goal page should have errored (notion-to-md will throw on 500)
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]!.pageId).toBe(GOAL_PAGE_ID);

    // Other pages should still be processed
    expect(result.totalPages).toBe(9);
    // At least some pages should succeed
    expect(result.newFiles + result.unchangedFiles).toBeGreaterThan(0);
  });
});

describe('pull command — unchanged files skip', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(basePath);
  });

  it('skips writing when content has not changed', async () => {
    // First pull — creates all files
    const first = await pull({ basePath });
    expect(first.newFiles).toBe(9);

    // Second pull — same data, should skip all
    const second = await pull({ basePath });
    expect(second.unchangedFiles).toBe(9);
    expect(second.newFiles).toBe(0);
    expect(second.modifiedFiles).toBe(0);
  });
});
