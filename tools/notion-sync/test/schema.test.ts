import { describe, it, expect } from 'vitest';
import {
  DATABASE_REGISTRY,
  getDatabaseConfig,
  getDatabaseKeyByDirectory,
  getDatabaseKeyById,
  isReadOnlyProperty,
  isSyncManagedProperty,
  toNotionValue,
  fromNotionValue,
  slugify,
  generateFilename,
} from '../lib/schema.js';
import type { PropertyDef, DatabaseKey } from '../lib/schema.js';

// ─── Database Registry ──────────────────────────────────────────────

describe('DATABASE_REGISTRY', () => {
  it('contains all 9 databases', () => {
    const keys = Object.keys(DATABASE_REGISTRY);
    expect(keys).toHaveLength(9);
    expect(keys).toContain('tasks');
    expect(keys).toContain('personal_tasks');
    expect(keys).toContain('goals');
    expect(keys).toContain('kpis');
    expect(keys).toContain('projects');
    expect(keys).toContain('brainstorms');
    expect(keys).toContain('clients');
    expect(keys).toContain('contacts');
    expect(keys).toContain('interactions');
  });

  it('each database has a unique notionDatabaseId', () => {
    const ids = Object.values(DATABASE_REGISTRY).map((c) => c.notionDatabaseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each database has a directory ending with /', () => {
    for (const config of Object.values(DATABASE_REGISTRY)) {
      expect(config.directory).toMatch(/\/$/);
    }
  });
});

// ─── Lookup Helpers ─────────────────────────────────────────────────

describe('getDatabaseConfig', () => {
  it('returns config for a valid key', () => {
    const config = getDatabaseConfig('tasks');
    expect(config.notionDatabaseId).toBe('fff00000-test-0000-0000-tasks0000001');
    expect(config.directory).toBe('tasks/');
  });
});

describe('getDatabaseKeyByDirectory', () => {
  it('finds key with trailing slash', () => {
    expect(getDatabaseKeyByDirectory('tasks/')).toBe('tasks');
  });

  it('finds key without trailing slash', () => {
    expect(getDatabaseKeyByDirectory('personal-tasks')).toBe('personal_tasks');
  });

  it('returns undefined for unknown directory', () => {
    expect(getDatabaseKeyByDirectory('unknown/')).toBeUndefined();
  });
});

describe('getDatabaseKeyById', () => {
  it('finds key by Notion database ID', () => {
    expect(getDatabaseKeyById('fff00000-test-0000-0000-tasks0000001')).toBe('tasks');
  });

  it('returns undefined for unknown ID', () => {
    expect(getDatabaseKeyById('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });
});

describe('isReadOnlyProperty', () => {
  it('returns true for underscore-prefixed keys', () => {
    expect(isReadOnlyProperty('_gap')).toBe(true);
    expect(isReadOnlyProperty('_progress')).toBe(true);
    expect(isReadOnlyProperty('_raw_something')).toBe(true);
  });

  it('returns false for normal keys', () => {
    expect(isReadOnlyProperty('title')).toBe(false);
    expect(isReadOnlyProperty('status')).toBe(false);
  });
});

describe('isSyncManagedProperty', () => {
  it('returns true for sync-managed keys', () => {
    expect(isSyncManagedProperty('_last_synced')).toBe(true);
    expect(isSyncManagedProperty('_notion_edited')).toBe(true);
    expect(isSyncManagedProperty('_sync_pending')).toBe(true);
  });

  it('returns false for other underscore keys', () => {
    expect(isSyncManagedProperty('_gap')).toBe(false);
    expect(isSyncManagedProperty('_progress')).toBe(false);
  });

  it('returns false for normal keys', () => {
    expect(isSyncManagedProperty('title')).toBe(false);
  });
});

// ─── toNotionValue ──────────────────────────────────────────────────

describe('toNotionValue', () => {
  const def = (type: string, notionName = 'Test'): PropertyDef => {
    if (type === 'relation') {
      return { type: 'relation', notionName, cardinality: 'one', targetDatabase: 'goals' as DatabaseKey };
    }
    return { type, notionName } as PropertyDef;
  };

  it('converts title', () => {
    expect(toNotionValue(def('title'), 'Hello')).toEqual({
      title: [{ text: { content: 'Hello' } }],
    });
  });

  it('converts select', () => {
    expect(toNotionValue(def('select'), 'Active')).toEqual({
      select: { name: 'Active' },
    });
  });

  it('converts status', () => {
    expect(toNotionValue(def('status'), 'In progress')).toEqual({
      status: { name: 'In progress' },
    });
  });

  it('converts multi_select from array', () => {
    expect(toNotionValue(def('multi_select'), ['Product', 'Marketing'])).toEqual({
      multi_select: [{ name: 'Product' }, { name: 'Marketing' }],
    });
  });

  it('converts multi_select from single value', () => {
    expect(toNotionValue(def('multi_select'), 'Product')).toEqual({
      multi_select: [{ name: 'Product' }],
    });
  });

  it('converts number', () => {
    expect(toNotionValue(def('number'), 42)).toEqual({ number: 42 });
  });

  it('converts number from string', () => {
    expect(toNotionValue(def('number'), '150')).toEqual({ number: 150 });
  });

  it('returns null for NaN number', () => {
    expect(toNotionValue(def('number'), 'not-a-number')).toBeNull();
  });

  it('converts date', () => {
    expect(toNotionValue(def('date'), '2026-03-03')).toEqual({
      date: { start: '2026-03-03' },
    });
  });

  it('converts email', () => {
    expect(toNotionValue(def('email'), 'test@example.com')).toEqual({
      email: 'test@example.com',
    });
  });

  it('converts phone_number', () => {
    expect(toNotionValue(def('phone_number'), '+353 1 234 5678')).toEqual({
      phone_number: '+353 1 234 5678',
    });
  });

  it('converts url', () => {
    expect(toNotionValue(def('url'), 'https://example.com')).toEqual({
      url: 'https://example.com',
    });
  });

  it('converts rich_text', () => {
    expect(toNotionValue(def('rich_text'), 'Some text')).toEqual({
      rich_text: [{ text: { content: 'Some text' } }],
    });
  });

  it('returns null for relation (handled separately)', () => {
    expect(toNotionValue(def('relation'), 'some-id')).toBeNull();
  });

  it('returns null for formula (read-only)', () => {
    expect(toNotionValue({ type: 'formula', notionName: 'Gap' }, 100)).toBeNull();
  });

  it('returns null for empty values', () => {
    expect(toNotionValue(def('title'), '')).toBeNull();
    expect(toNotionValue(def('title'), null)).toBeNull();
    expect(toNotionValue(def('title'), undefined)).toBeNull();
  });
});

// ─── fromNotionValue ────────────────────────────────────────────────

describe('fromNotionValue', () => {
  const def = (type: string, notionName = 'Test'): PropertyDef => {
    if (type === 'relation') {
      return { type: 'relation', notionName, cardinality: 'one', targetDatabase: 'goals' as DatabaseKey };
    }
    return { type, notionName } as PropertyDef;
  };

  it('extracts title', () => {
    expect(fromNotionValue(def('title'), { title: [{ plain_text: 'Hello' }] })).toBe('Hello');
  });

  it('returns undefined for empty title', () => {
    expect(fromNotionValue(def('title'), { title: [] })).toBeUndefined();
  });

  it('extracts select', () => {
    expect(fromNotionValue(def('select'), { select: { name: 'Active' } })).toBe('Active');
  });

  it('returns undefined for null select', () => {
    expect(fromNotionValue(def('select'), { select: null })).toBeUndefined();
  });

  it('extracts status', () => {
    expect(fromNotionValue(def('status'), { status: { name: 'Done' } })).toBe('Done');
  });

  it('extracts multi_select', () => {
    const result = fromNotionValue(def('multi_select'), {
      multi_select: [{ name: 'Product' }, { name: 'Marketing' }],
    });
    expect(result).toEqual(['Product', 'Marketing']);
  });

  it('returns undefined for empty multi_select', () => {
    expect(fromNotionValue(def('multi_select'), { multi_select: [] })).toBeUndefined();
  });

  it('extracts number', () => {
    expect(fromNotionValue(def('number'), { number: 42 })).toBe(42);
  });

  it('returns undefined for null number', () => {
    expect(fromNotionValue(def('number'), { number: null })).toBeUndefined();
  });

  it('extracts date', () => {
    expect(fromNotionValue(def('date'), { date: { start: '2026-03-03' } })).toBe('2026-03-03');
  });

  it('returns undefined for null date', () => {
    expect(fromNotionValue(def('date'), { date: null })).toBeUndefined();
  });

  it('extracts email', () => {
    expect(fromNotionValue(def('email'), { email: 'a@b.com' })).toBe('a@b.com');
  });

  it('extracts phone_number', () => {
    expect(fromNotionValue(def('phone_number'), { phone_number: '+1234' })).toBe('+1234');
  });

  it('extracts url', () => {
    expect(fromNotionValue(def('url'), { url: 'https://x.com' })).toBe('https://x.com');
  });

  it('extracts rich_text (single segment)', () => {
    expect(fromNotionValue(def('rich_text'), { rich_text: [{ plain_text: 'Hello' }] })).toBe('Hello');
  });

  it('extracts rich_text (multiple segments concatenated)', () => {
    const result = fromNotionValue(def('rich_text'), {
      rich_text: [{ plain_text: 'Hello ' }, { plain_text: 'World' }],
    });
    expect(result).toBe('Hello World');
  });

  it('returns undefined for empty rich_text', () => {
    expect(fromNotionValue(def('rich_text'), { rich_text: [] })).toBeUndefined();
  });

  it('returns undefined for relation (handled separately)', () => {
    expect(fromNotionValue(def('relation'), {})).toBeUndefined();
  });

  it('extracts formula number', () => {
    expect(fromNotionValue({ type: 'formula', notionName: 'Gap' }, {
      formula: { type: 'number', number: 5400 },
    })).toBe(5400);
  });

  it('extracts formula string', () => {
    expect(fromNotionValue({ type: 'formula', notionName: 'Label' }, {
      formula: { type: 'string', string: '55%' },
    })).toBe('55%');
  });

  it('extracts formula boolean', () => {
    expect(fromNotionValue({ type: 'formula', notionName: 'Flag' }, {
      formula: { type: 'boolean', boolean: true },
    })).toBe(true);
  });

  it('extracts formula date', () => {
    expect(fromNotionValue({ type: 'formula', notionName: 'Next' }, {
      formula: { type: 'date', date: { start: '2026-04-01' } },
    })).toBe('2026-04-01');
  });

  it('returns undefined for null formula', () => {
    expect(fromNotionValue({ type: 'formula', notionName: 'Gap' }, { formula: null })).toBeUndefined();
  });

  it('returns undefined for null/undefined input', () => {
    expect(fromNotionValue(def('title'), null)).toBeUndefined();
    expect(fromNotionValue(def('title'), undefined)).toBeUndefined();
  });
});

// ─── slugify ────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts basic text to slug', () => {
    expect(slugify('Build Portfolio of Internet Companies')).toBe('build-portfolio-of-internet-companies');
  });

  it('handles special characters', () => {
    expect(slugify('Task #1 — Deploy & Test!')).toBe('task-1-deploy-test');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('too   many   spaces')).toBe('too-many-spaces');
  });

  it('removes leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('truncates long titles at word boundary', () => {
    const long = 'this-is-a-very-long-title-that-should-be-truncated-at-the-word-boundary-somewhere';
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).not.toMatch(/-$/);
  });

  it('rejects path traversal attempts', () => {
    expect(slugify('../../../etc/passwd')).toBe('etc-passwd');
  });

  it('rejects absolute paths', () => {
    expect(slugify('/etc/passwd')).toBe('etc-passwd');
  });

  it('strips null bytes', () => {
    expect(slugify('hello\0world')).toBe('helloworld');
  });

  it('handles unicode characters', () => {
    // Unicode is stripped since only a-z0-9 kept
    expect(slugify('Ärger über €100')).toBe('rger-ber-100');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

// ─── generateFilename ───────────────────────────────────────────────

describe('generateFilename', () => {
  it('generates default filename (slug-shortId.md)', () => {
    const config = getDatabaseConfig('tasks');
    const result = generateFilename(config, 'Deploy New Feature', 'abc12345-6789-0000-0000-000000000000');
    expect(result).toBe('deploy-new-feature-abc123456789.md');
  });

  it('generates interactions filename with date and type', () => {
    const config = getDatabaseConfig('interactions');
    const result = generateFilename(
      config,
      'Discovery call — Client-A',
      'def12345-6789-0000-0000-000000000000',
      '2026-02-23',
      'Meeting',
    );
    expect(result).toBe('2026-02-23-meeting-discovery-call-client-a-def123456789.md');
  });

  it('generates interactions filename with defaults when date/type missing', () => {
    const config = getDatabaseConfig('interactions');
    const result = generateFilename(config, 'Quick Note', 'aaa11111-2222-3333-4444-555555555555');
    expect(result).toBe('undated-note-quick-note-aaa111112222.md');
  });
});
