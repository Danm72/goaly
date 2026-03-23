import type { DatabaseKey, PropertyDef } from './schema.js';
import type { PageIndexEntry, SyncState } from './state.js';
import { lookupById, lookupByTitle } from './state.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedRelation {
  name: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Key naming conventions
// ---------------------------------------------------------------------------

/**
 * Given a YAML key for a relation property, return the corresponding ID key.
 * - Cardinality 'one': append `_id` (e.g., `goal` → `goal_id`)
 * - Cardinality 'many': append `_ids` (e.g., `contacts` → `contact_ids`)
 */
export function idKeyForRelation(yamlKey: string, cardinality: 'one' | 'many'): string {
  return cardinality === 'many' ? `${yamlKey}_ids` : `${yamlKey}_id`;
}

// ---------------------------------------------------------------------------
// Inbound resolution (Notion → local frontmatter)
// ---------------------------------------------------------------------------

/**
 * Resolve a Notion relation property value to human-readable name(s) + ID(s).
 *
 * @param relationValue - Array of `{ id: string }` from Notion API
 * @param state - Current sync state (for page index lookups)
 * @param fetchTitleFallback - Optional async function to fetch title from Notion API
 *   when the page is not in the local index. Signature: (pageId) => title | undefined
 *
 * Returns resolved relations (name + id pairs). Unknown pages are included
 * with name "(unknown)" if no fallback is provided or fallback fails.
 */
export async function resolveInbound(
  relationValue: ReadonlyArray<{ id: string }>,
  state: SyncState,
  fetchTitleFallback?: (pageId: string) => Promise<string | undefined>,
): Promise<ResolvedRelation[]> {
  const results: ResolvedRelation[] = [];

  for (const rel of relationValue) {
    const indexEntry = lookupById(state, rel.id);
    if (indexEntry) {
      results.push({ name: indexEntry.title, id: rel.id });
      continue;
    }

    // Not in local index — try API fallback
    if (fetchTitleFallback) {
      const title = await fetchTitleFallback(rel.id);
      if (title) {
        results.push({ name: title, id: rel.id });
        continue;
      }
    }

    // Unresolvable — include with placeholder
    results.push({ name: '(unknown)', id: rel.id });
  }

  return results;
}

/**
 * Write resolved relations into frontmatter object.
 * Sets both human-readable key and ID key.
 */
export function writeInboundToFrontmatter(
  frontmatter: Record<string, unknown>,
  yamlKey: string,
  cardinality: 'one' | 'many',
  resolved: ResolvedRelation[],
): void {
  const idKey = idKeyForRelation(yamlKey, cardinality);

  if (resolved.length === 0) {
    frontmatter[yamlKey] = cardinality === 'many' ? [] : '';
    frontmatter[idKey] = cardinality === 'many' ? [] : '';
    return;
  }

  if (cardinality === 'one') {
    const first = resolved[0]!;
    frontmatter[yamlKey] = first.name;
    frontmatter[idKey] = first.id;
  } else {
    frontmatter[yamlKey] = resolved.map((r) => r.name);
    frontmatter[idKey] = resolved.map((r) => r.id);
  }
}

// ---------------------------------------------------------------------------
// Outbound resolution (local frontmatter → Notion API)
// ---------------------------------------------------------------------------

export interface OutboundResult {
  relationIds: string[];
  warnings: string[];
}

/**
 * Resolve a relation from local frontmatter to Notion API format.
 *
 * Priority:
 * 1. Use _id / _ids fields directly if present
 * 2. Fall back to name-based lookup via page index
 * 3. Log warning and skip if unresolvable
 */
export function resolveOutbound(
  frontmatter: Record<string, unknown>,
  yamlKey: string,
  def: Extract<PropertyDef, { type: 'relation' }>,
  state: SyncState,
): OutboundResult {
  const idKey = idKeyForRelation(yamlKey, def.cardinality);
  const warnings: string[] = [];
  const relationIds: string[] = [];

  // Try ID fields first
  const rawIds = frontmatter[idKey];
  if (rawIds !== undefined && rawIds !== null && rawIds !== '') {
    const ids = Array.isArray(rawIds) ? rawIds : [rawIds];
    for (const id of ids) {
      if (typeof id === 'string' && id !== '') {
        relationIds.push(id);
      }
    }
    if (relationIds.length > 0) {
      return { relationIds, warnings };
    }
  }

  // Fall back to name-based lookup
  const rawNames = frontmatter[yamlKey];
  if (rawNames === undefined || rawNames === null || rawNames === '') {
    return { relationIds: [], warnings: [] };
  }

  const names = Array.isArray(rawNames) ? rawNames : [rawNames];
  for (const name of names) {
    if (typeof name !== 'string' || name === '') continue;

    const notionId = lookupByTitle(state, def.targetDatabase, name);
    if (notionId) {
      relationIds.push(notionId);
    } else {
      warnings.push(
        `Could not resolve relation "${yamlKey}" = "${name}" in database "${def.targetDatabase}". Skipping.`,
      );
    }
  }

  return { relationIds, warnings };
}

/**
 * Convert resolved outbound relation IDs to Notion API property format.
 */
export function toNotionRelation(ids: string[]): { relation: Array<{ id: string }> } {
  return {
    relation: ids.map((id) => ({ id })),
  };
}
