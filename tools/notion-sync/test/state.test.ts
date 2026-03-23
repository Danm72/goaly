import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyState,
  loadState,
  saveState,
  getPageState,
  updatePageState,
  removePageState,
  updatePageIndex,
  lookupByTitle,
  lookupById,
  detectConflict,
} from '../lib/state.js';
import { computeChecksum } from '../lib/to-notion.js';
import type { PageEntry, SyncState } from '../lib/state.js';

describe('state', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'notion-sync-test-'));
  });

  // ── createEmptyState ─────────────────────────────────────────────

  describe('createEmptyState', () => {
    it('returns a valid empty state with version 1', () => {
      const state = createEmptyState();
      expect(state.version).toBe(1);
      expect(state.last_full_sync).toBe('');
      expect(state.pages).toEqual({});
      expect(state.page_index).toEqual({});
    });
  });

  // ── loadState ────────────────────────────────────────────────────

  describe('loadState', () => {
    it('returns empty state when file does not exist', () => {
      const state = loadState(tempDir);
      expect(state.version).toBe(1);
      expect(state.last_full_sync).toBe('');
      expect(Object.keys(state.pages)).toHaveLength(0);
      expect(Object.keys(state.page_index)).toHaveLength(0);
    });

    it('loads existing state from disk', () => {
      const existing: SyncState = {
        version: 1,
        last_full_sync: '2026-03-03T10:00:00Z',
        page_index: {
          'abc-123': { title: 'Test Page', file_path: 'tasks/test.md', database: 'tasks' },
        },
        pages: {
          'abc-123': {
            file_path: 'tasks/test.md',
            notion_last_edited: '2026-03-03T09:00:00Z',
            last_synced_at: '2026-03-03T10:00:00Z',
            content_checksum: 'sha256:abcdef',
          },
        },
      };
      writeFileSync(join(tempDir, '.sync-state.json'), JSON.stringify(existing), 'utf-8');

      const state = loadState(tempDir);
      expect(state.version).toBe(1);
      expect(state.last_full_sync).toBe('2026-03-03T10:00:00Z');
      expect(Object.keys(state.pages)).toHaveLength(1);
      expect(state.pages['abc-123']?.file_path).toBe('tasks/test.md');
    });
  });

  // ── saveState ────────────────────────────────────────────────────

  describe('saveState', () => {
    it('writes state to disk atomically', () => {
      const state = createEmptyState();
      state.last_full_sync = '2026-03-03T12:00:00Z';
      updatePageState(state, 'page-1', {
        file_path: 'goals/test.md',
        notion_last_edited: '2026-03-03T11:00:00Z',
        last_synced_at: '2026-03-03T12:00:00Z',
        content_checksum: 'sha256:123456',
      });

      saveState(tempDir, state);

      // .tmp file should NOT exist (renamed)
      expect(existsSync(join(tempDir, '.sync-state.json.tmp'))).toBe(false);
      // Actual file should exist
      expect(existsSync(join(tempDir, '.sync-state.json'))).toBe(true);

      const raw = readFileSync(join(tempDir, '.sync-state.json'), 'utf-8');
      const parsed = JSON.parse(raw) as SyncState;
      expect(parsed.last_full_sync).toBe('2026-03-03T12:00:00Z');
      expect(parsed.pages['page-1']?.file_path).toBe('goals/test.md');
    });

    it('roundtrips with loadState', () => {
      const state = createEmptyState();
      state.last_full_sync = '2026-01-01T00:00:00Z';
      updatePageState(state, 'id-1', {
        file_path: 'tasks/a.md',
        notion_last_edited: '2026-01-01T00:00:00Z',
        last_synced_at: '2026-01-01T00:00:00Z',
        content_checksum: 'sha256:aaa',
      });
      updatePageIndex(state, 'id-1', 'Title A', 'tasks/a.md', 'tasks');

      saveState(tempDir, state);
      const loaded = loadState(tempDir);

      expect(loaded.version).toBe(1);
      expect(loaded.last_full_sync).toBe('2026-01-01T00:00:00Z');
      expect(loaded.pages['id-1']?.content_checksum).toBe('sha256:aaa');
      expect(loaded.page_index['id-1']?.title).toBe('Title A');
    });
  });

  // ── getPageState / updatePageState ───────────────────────────────

  describe('getPageState / updatePageState', () => {
    it('returns undefined for unknown page', () => {
      const state = createEmptyState();
      expect(getPageState(state, 'nonexistent')).toBeUndefined();
    });

    it('stores and retrieves page entry', () => {
      const state = createEmptyState();
      const entry: PageEntry = {
        file_path: 'kpis/mrr.md',
        notion_last_edited: '2026-03-03T10:00:00Z',
        last_synced_at: '2026-03-03T10:00:00Z',
        content_checksum: 'sha256:deadbeef',
      };
      updatePageState(state, 'kpi-1', entry);

      const result = getPageState(state, 'kpi-1');
      expect(result).toEqual(entry);
    });

    it('overwrites existing entry', () => {
      const state = createEmptyState();
      updatePageState(state, 'p1', {
        file_path: 'tasks/old.md',
        notion_last_edited: '2026-01-01T00:00:00Z',
        last_synced_at: '2026-01-01T00:00:00Z',
        content_checksum: 'sha256:old',
      });
      updatePageState(state, 'p1', {
        file_path: 'tasks/new.md',
        notion_last_edited: '2026-02-01T00:00:00Z',
        last_synced_at: '2026-02-01T00:00:00Z',
        content_checksum: 'sha256:new',
      });

      const result = getPageState(state, 'p1');
      expect(result?.file_path).toBe('tasks/new.md');
      expect(result?.content_checksum).toBe('sha256:new');
    });
  });

  // ── removePageState ──────────────────────────────────────────────

  describe('removePageState', () => {
    it('removes page entry and index entry', () => {
      const state = createEmptyState();
      updatePageState(state, 'p1', {
        file_path: 'tasks/x.md',
        notion_last_edited: '2026-01-01T00:00:00Z',
        last_synced_at: '2026-01-01T00:00:00Z',
        content_checksum: 'sha256:x',
      });
      updatePageIndex(state, 'p1', 'Task X', 'tasks/x.md', 'tasks');

      removePageState(state, 'p1');

      expect(getPageState(state, 'p1')).toBeUndefined();
      expect(lookupById(state, 'p1')).toBeUndefined();
    });

    it('is a no-op for nonexistent page', () => {
      const state = createEmptyState();
      removePageState(state, 'nonexistent');
      expect(Object.keys(state.pages)).toHaveLength(0);
    });
  });

  // ── Page index operations ────────────────────────────────────────

  describe('page index', () => {
    it('updatePageIndex and lookupById', () => {
      const state = createEmptyState();
      updatePageIndex(state, 'g1', 'Build Portfolio', 'goals/build-portfolio.md', 'goals');

      const entry = lookupById(state, 'g1');
      expect(entry).toEqual({
        title: 'Build Portfolio',
        file_path: 'goals/build-portfolio.md',
        database: 'goals',
      });
    });

    it('lookupByTitle finds entry within database', () => {
      const state = createEmptyState();
      updatePageIndex(state, 'g1', 'Build Portfolio', 'goals/build-portfolio.md', 'goals');
      updatePageIndex(state, 'g2', 'Secure Family', 'goals/secure-family.md', 'goals');
      updatePageIndex(state, 'p1', 'Build Portfolio', 'projects/build-portfolio.md', 'projects');

      // Finds the goal, not the project with the same title
      expect(lookupByTitle(state, 'goals', 'Build Portfolio')).toBe('g1');
      expect(lookupByTitle(state, 'projects', 'Build Portfolio')).toBe('p1');
    });

    it('lookupByTitle returns undefined for non-matching title', () => {
      const state = createEmptyState();
      updatePageIndex(state, 'g1', 'Build Portfolio', 'goals/build-portfolio.md', 'goals');

      expect(lookupByTitle(state, 'goals', 'Nonexistent Goal')).toBeUndefined();
    });

    it('lookupByTitle returns undefined for wrong database', () => {
      const state = createEmptyState();
      updatePageIndex(state, 'g1', 'Build Portfolio', 'goals/build-portfolio.md', 'goals');

      expect(lookupByTitle(state, 'tasks', 'Build Portfolio')).toBeUndefined();
    });

    it('lookupById returns undefined for unknown id', () => {
      const state = createEmptyState();
      expect(lookupById(state, 'unknown')).toBeUndefined();
    });
  });

  // ── computeChecksum ──────────────────────────────────────────────

  describe('computeChecksum', () => {
    it('produces sha256-prefixed hex string', () => {
      const checksum = computeChecksum({ title: 'Test' }, 'Body content');
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('excludes underscore-prefixed fields', () => {
      const a = computeChecksum(
        { title: 'Test', _last_synced: '2026-01-01', _notion_edited: '2026-01-01' },
        'Body',
      );
      const b = computeChecksum(
        { title: 'Test', _last_synced: '2026-02-01', _notion_edited: '2026-02-01' },
        'Body',
      );
      expect(a).toBe(b);
    });

    it('includes non-underscore fields', () => {
      const a = computeChecksum({ title: 'Test', status: 'Active' }, 'Body');
      const b = computeChecksum({ title: 'Test', status: 'Done' }, 'Body');
      expect(a).not.toBe(b);
    });

    it('is deterministic regardless of key order', () => {
      const a = computeChecksum({ title: 'X', status: 'A', area: ['B'] }, 'Body');
      const b = computeChecksum({ area: ['B'], status: 'A', title: 'X' }, 'Body');
      expect(a).toBe(b);
    });

    it('differs when body changes', () => {
      const a = computeChecksum({ title: 'Same' }, 'Body 1');
      const b = computeChecksum({ title: 'Same' }, 'Body 2');
      expect(a).not.toBe(b);
    });

    it('handles empty frontmatter and body', () => {
      const checksum = computeChecksum({}, '');
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  // ── detectConflict ───────────────────────────────────────────────

  describe('detectConflict', () => {
    const baseEntry: PageEntry = {
      file_path: 'tasks/test.md',
      notion_last_edited: '2026-03-03T10:00:00Z',
      last_synced_at: '2026-03-03T10:00:00Z',
      content_checksum: 'sha256:abc',
    };

    it('returns no_conflict for new page (no pageState)', () => {
      expect(detectConflict(undefined, '2026-03-03T12:00:00Z', false)).toBe('no_conflict');
    });

    it('returns no_conflict when neither side changed', () => {
      expect(detectConflict(baseEntry, '2026-03-03T10:00:00Z', false)).toBe('no_conflict');
    });

    it('returns no_conflict when only local changed (safe to push)', () => {
      expect(detectConflict(baseEntry, '2026-03-03T10:00:00Z', true)).toBe('no_conflict');
    });

    it('returns remote_wins when only Notion changed', () => {
      expect(detectConflict(baseEntry, '2026-03-03T12:00:00Z', false)).toBe('remote_wins');
    });

    it('returns local_wins when both changed (git always wins)', () => {
      expect(detectConflict(baseEntry, '2026-03-03T12:00:00Z', true)).toBe('local_wins');
    });

    it('treats equal timestamps as no Notion change', () => {
      expect(detectConflict(baseEntry, '2026-03-03T10:00:00Z', true)).toBe('no_conflict');
    });
  });
});
