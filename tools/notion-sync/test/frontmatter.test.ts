import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import yaml from 'js-yaml';

// Replicate the gray-matter configuration from reconcile.ts
function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  return matter(content, {
    engines: {
      yaml: {
        parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>,
        stringify: (obj: object) => yaml.dump(obj),
      },
    },
  });
}

describe('frontmatter parsing', () => {
  // ── Date coercion fix ──────────────────────────────────────────

  describe('gray-matter date coercion fix', () => {
    it('keeps date strings as strings, not Date objects', () => {
      const md = `---
notion_id: "abc-123"
_notion_edited: "2026-03-03T10:00:00Z"
_last_synced: "2026-03-03T10:00:00Z"
due_date: "2026-03-15"
title: "Test Task"
---

Body content.
`;
      const parsed = parseFrontmatter(md);
      expect(typeof parsed.data['due_date']).toBe('string');
      expect(parsed.data['due_date']).toBe('2026-03-15');
      expect(typeof parsed.data['_notion_edited']).toBe('string');
      expect(typeof parsed.data['_last_synced']).toBe('string');
    });

    it('bare date values without quotes stay as strings with JSON_SCHEMA', () => {
      const md = `---
due_date: 2026-03-15
start_date: 2026-01-01
---
`;
      const parsed = parseFrontmatter(md);
      // With JSON_SCHEMA, even unquoted dates become strings
      expect(typeof parsed.data['due_date']).toBe('string');
      expect(typeof parsed.data['start_date']).toBe('string');
    });
  });

  // ── Roundtrip preservation ─────────────────────────────────────

  describe('roundtrip', () => {
    it('preserves string values', () => {
      const md = `---
notion_id: "page-123"
title: "Build Portfolio"
status: "In progress"
---

Some body.
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['notion_id']).toBe('page-123');
      expect(parsed.data['title']).toBe('Build Portfolio');
      expect(parsed.data['status']).toBe('In progress');
    });

    it('preserves number values', () => {
      const md = `---
current_value: 6600
target_value: 12000
rate: 150
---
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['current_value']).toBe(6600);
      expect(parsed.data['target_value']).toBe(12000);
      expect(parsed.data['rate']).toBe(150);
    });

    it('preserves arrays (multi_select)', () => {
      const md = `---
area:
  - Finance
  - Marketing
space:
  - Product
---
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['area']).toEqual(['Finance', 'Marketing']);
      expect(parsed.data['space']).toEqual(['Product']);
    });

    it('preserves null values', () => {
      const md = `---
email: null
phone: null
---
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['email']).toBeNull();
      expect(parsed.data['phone']).toBeNull();
    });

    it('separates body from frontmatter correctly', () => {
      const md = `---
title: "Test"
---

First paragraph.

Second paragraph with **bold**.
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['title']).toBe('Test');
      expect(parsed.content).toContain('First paragraph.');
      expect(parsed.content).toContain('Second paragraph with **bold**.');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty frontmatter', () => {
      const md = `---
---

Just body.
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data).toEqual({});
      expect(parsed.content.trim()).toBe('Just body.');
    });

    it('handles file with no frontmatter', () => {
      const md = `Just body content with no frontmatter.`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data).toEqual({});
      expect(parsed.content).toContain('Just body content');
    });

    it('handles boolean values', () => {
      const md = `---
_sync_pending: true
archived: false
---
`;
      const parsed = parseFrontmatter(md);
      expect(parsed.data['_sync_pending']).toBe(true);
      expect(parsed.data['archived']).toBe(false);
    });
  });
});
