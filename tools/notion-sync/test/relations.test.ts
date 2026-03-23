import { describe, it, expect, vi } from 'vitest';
import {
  idKeyForRelation,
  resolveInbound,
  writeInboundToFrontmatter,
  resolveOutbound,
  toNotionRelation,
} from '../lib/relations.js';
import type { ResolvedRelation } from '../lib/relations.js';
import { createEmptyState, updatePageIndex } from '../lib/state.js';
import type { PropertyDef, DatabaseKey } from '../lib/schema.js';

// ─── Helpers ────────────────────────────────────────────────────────

function relationDef(
  targetDatabase: DatabaseKey,
  cardinality: 'one' | 'many' = 'one',
): Extract<PropertyDef, { type: 'relation' }> {
  return {
    type: 'relation',
    notionName: 'Test',
    cardinality,
    targetDatabase,
  };
}

function stateWithIndex() {
  const state = createEmptyState();
  updatePageIndex(state, 'goal-1', 'Build Portfolio', 'goals/build-portfolio.md', 'goals');
  updatePageIndex(state, 'goal-2', 'Secure Family', 'goals/secure-family.md', 'goals');
  updatePageIndex(state, 'project-1', 'Client-B', 'projects/client-b-sports.md', 'projects');
  updatePageIndex(state, 'client-1', 'Client-A', 'clients/client-a.md', 'clients');
  updatePageIndex(state, 'contact-1', 'Contact-1', 'contacts/contact-1.md', 'contacts');
  updatePageIndex(state, 'contact-2', 'Contact-2 Jernström', 'contacts/contact-2.md', 'contacts');
  return state;
}

// ─── idKeyForRelation ───────────────────────────────────────────────

describe('idKeyForRelation', () => {
  it('appends _id for cardinality one', () => {
    expect(idKeyForRelation('goal', 'one')).toBe('goal_id');
    expect(idKeyForRelation('project', 'one')).toBe('project_id');
    expect(idKeyForRelation('parent_task', 'one')).toBe('parent_task_id');
  });

  it('appends _ids for cardinality many', () => {
    expect(idKeyForRelation('contacts', 'many')).toBe('contacts_ids');
  });
});

// ─── resolveInbound ─────────────────────────────────────────────────

describe('resolveInbound', () => {
  it('resolves known pages via page index', async () => {
    const state = stateWithIndex();
    const result = await resolveInbound([{ id: 'goal-1' }], state);
    expect(result).toEqual([{ name: 'Build Portfolio', id: 'goal-1' }]);
  });

  it('resolves multiple relations', async () => {
    const state = stateWithIndex();
    const result = await resolveInbound(
      [{ id: 'contact-1' }, { id: 'contact-2' }],
      state,
    );
    expect(result).toEqual([
      { name: 'Contact-1', id: 'contact-1' },
      { name: 'Contact-2 Jernström', id: 'contact-2' },
    ]);
  });

  it('uses fallback for unknown pages', async () => {
    const state = stateWithIndex();
    const fallback = vi.fn().mockResolvedValue('Fetched Title');
    const result = await resolveInbound([{ id: 'unknown-1' }], state, fallback);

    expect(fallback).toHaveBeenCalledWith('unknown-1');
    expect(result).toEqual([{ name: 'Fetched Title', id: 'unknown-1' }]);
  });

  it('marks as (unknown) when no fallback provided', async () => {
    const state = stateWithIndex();
    const result = await resolveInbound([{ id: 'unknown-1' }], state);
    expect(result).toEqual([{ name: '(unknown)', id: 'unknown-1' }]);
  });

  it('marks as (unknown) when fallback returns undefined', async () => {
    const state = stateWithIndex();
    const fallback = vi.fn().mockResolvedValue(undefined);
    const result = await resolveInbound([{ id: 'unknown-1' }], state, fallback);
    expect(result).toEqual([{ name: '(unknown)', id: 'unknown-1' }]);
  });

  it('handles empty relation array', async () => {
    const state = stateWithIndex();
    const result = await resolveInbound([], state);
    expect(result).toEqual([]);
  });
});

// ─── writeInboundToFrontmatter ──────────────────────────────────────

describe('writeInboundToFrontmatter', () => {
  it('writes single relation (cardinality one)', () => {
    const fm: Record<string, unknown> = {};
    const resolved: ResolvedRelation[] = [{ name: 'Build Portfolio', id: 'goal-1' }];
    writeInboundToFrontmatter(fm, 'goal', 'one', resolved);

    expect(fm['goal']).toBe('Build Portfolio');
    expect(fm['goal_id']).toBe('goal-1');
  });

  it('writes multi relation (cardinality many)', () => {
    const fm: Record<string, unknown> = {};
    const resolved: ResolvedRelation[] = [
      { name: 'Contact-1', id: 'c-1' },
      { name: 'Contact-2', id: 'c-2' },
    ];
    writeInboundToFrontmatter(fm, 'contacts', 'many', resolved);

    expect(fm['contacts']).toEqual(['Contact-1', 'Contact-2']);
    expect(fm['contacts_ids']).toEqual(['c-1', 'c-2']);
  });

  it('writes empty values for cardinality one with no resolved', () => {
    const fm: Record<string, unknown> = {};
    writeInboundToFrontmatter(fm, 'goal', 'one', []);

    expect(fm['goal']).toBe('');
    expect(fm['goal_id']).toBe('');
  });

  it('writes empty arrays for cardinality many with no resolved', () => {
    const fm: Record<string, unknown> = {};
    writeInboundToFrontmatter(fm, 'contacts', 'many', []);

    expect(fm['contacts']).toEqual([]);
    expect(fm['contacts_ids']).toEqual([]);
  });
});

// ─── resolveOutbound ────────────────────────────────────────────────

describe('resolveOutbound', () => {
  it('uses _id field directly when present', () => {
    const state = stateWithIndex();
    const fm = { goal: 'Build Portfolio', goal_id: 'goal-1' };
    const result = resolveOutbound(fm, 'goal', relationDef('goals'), state);

    expect(result.relationIds).toEqual(['goal-1']);
    expect(result.warnings).toHaveLength(0);
  });

  it('uses _ids field for multi-value relations', () => {
    const state = stateWithIndex();
    const fm = {
      contacts: ['Contact-1', 'Contact-2'],
      contacts_ids: ['contact-1', 'contact-2'],
    };
    const result = resolveOutbound(fm, 'contacts', relationDef('contacts', 'many'), state);

    expect(result.relationIds).toEqual(['contact-1', 'contact-2']);
    expect(result.warnings).toHaveLength(0);
  });

  it('falls back to name-based lookup when no _id field', () => {
    const state = stateWithIndex();
    const fm = { goal: 'Build Portfolio' };
    const result = resolveOutbound(fm, 'goal', relationDef('goals'), state);

    expect(result.relationIds).toEqual(['goal-1']);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when name cannot be resolved', () => {
    const state = stateWithIndex();
    const fm = { goal: 'Nonexistent Goal' };
    const result = resolveOutbound(fm, 'goal', relationDef('goals'), state);

    expect(result.relationIds).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Nonexistent Goal');
    expect(result.warnings[0]).toContain('goals');
  });

  it('returns empty for missing/empty relation field', () => {
    const state = stateWithIndex();
    const fm = {};
    const result = resolveOutbound(fm, 'goal', relationDef('goals'), state);

    expect(result.relationIds).toEqual([]);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles empty string _id', () => {
    const state = stateWithIndex();
    const fm = { goal: 'Build Portfolio', goal_id: '' };
    // Empty _id should fall through to name-based lookup
    const result = resolveOutbound(fm, 'goal', relationDef('goals'), state);

    expect(result.relationIds).toEqual(['goal-1']);
    expect(result.warnings).toHaveLength(0);
  });

  it('resolves multi-value names via page index', () => {
    const state = stateWithIndex();
    const fm = { contacts: ['Contact-1', 'Contact-2 Jernström'] };
    const result = resolveOutbound(fm, 'contacts', relationDef('contacts', 'many'), state);

    expect(result.relationIds).toEqual(['contact-1', 'contact-2']);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns for each unresolvable name in multi-value', () => {
    const state = stateWithIndex();
    const fm = { contacts: ['Contact-1', 'Unknown Person'] };
    const result = resolveOutbound(fm, 'contacts', relationDef('contacts', 'many'), state);

    expect(result.relationIds).toEqual(['contact-1']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Unknown Person');
  });
});

// ─── toNotionRelation ───────────────────────────────────────────────

describe('toNotionRelation', () => {
  it('converts single ID to Notion format', () => {
    expect(toNotionRelation(['goal-1'])).toEqual({
      relation: [{ id: 'goal-1' }],
    });
  });

  it('converts multiple IDs to Notion format', () => {
    expect(toNotionRelation(['c-1', 'c-2'])).toEqual({
      relation: [{ id: 'c-1' }, { id: 'c-2' }],
    });
  });

  it('returns empty relation array for no IDs', () => {
    expect(toNotionRelation([])).toEqual({ relation: [] });
  });
});
