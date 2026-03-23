// Markdown-to-Notion converter — parses frontmatter + body into Notion API objects.

import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { markdownToBlocks } from '@tryfabric/martian';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';
import {
  getDatabaseConfig,
  isReadOnlyProperty,
  isSyncManagedProperty,
  toNotionValue,
} from './schema.js';
import type { DatabaseKey, PropertyDef } from './schema.js';

// ─── Frontmatter Parsing ─────────────────────────────────────────────

/**
 * Parses markdown content into frontmatter and body.
 * Uses js-yaml JSON_SCHEMA to prevent automatic date coercion —
 * `2026-03-15` stays as the string "2026-03-15", not a Date object.
 */
export function parseMarkdownFile(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const parsed = matter(content, {
    engines: {
      yaml: {
        parse: (str: string) =>
          yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<
            string,
            unknown
          >,
        stringify: (obj: object) => yaml.dump(obj),
      },
    },
  });
  return { frontmatter: parsed.data, body: parsed.content };
}

// ─── Property Conversion ─────────────────────────────────────────────

/**
 * Converts YAML frontmatter into a Notion API properties object.
 *
 * - Skips underscore-prefixed keys (read-only: _gap, _progress, _last_synced)
 * - Skips sync-managed keys (_last_synced, _notion_edited, _sync_pending)
 * - Skips `notion_id` (not a Notion property)
 * - Skips human-readable relation names when a corresponding `_id` key exists
 * - Handles `_id` suffixed keys as relation properties
 * - Skips unknown keys not in the schema
 */
export function markdownToNotionProperties(
  frontmatter: Record<string, unknown>,
  databaseKey: DatabaseKey,
): Record<string, object> {
  const config = getDatabaseConfig(databaseKey);
  const result: Record<string, object> = {};

  // Collect all _id/_ids keys to know which human-readable names to skip
  const relationIdKeys = new Set<string>();
  for (const key of Object.keys(frontmatter)) {
    if (key.endsWith('_ids')) {
      relationIdKeys.add(key.slice(0, -4)); // contacts_ids → contacts
    } else if (key.endsWith('_id')) {
      relationIdKeys.add(key.slice(0, -3)); // goal_id → goal
    }
  }

  for (const [yamlKey, value] of Object.entries(frontmatter)) {
    // Skip underscore-prefixed fields (read-only, sync-managed, formulas, raw)
    if (isReadOnlyProperty(yamlKey) || isSyncManagedProperty(yamlKey)) {
      continue;
    }

    // Skip notion_id — internal tracking, not a Notion property
    if (yamlKey === 'notion_id') {
      continue;
    }

    // Skip human-readable relation names when a _id key exists
    if (relationIdKeys.has(yamlKey)) {
      continue;
    }

    // Handle _id suffixed keys as relations
    if (yamlKey.endsWith('_id') || yamlKey.endsWith('_ids')) {
      const baseKey = yamlKey.endsWith('_ids')
        ? yamlKey.slice(0, -4)
        : yamlKey.slice(0, -3);

      const propDef = config.properties[baseKey] as PropertyDef | undefined;
      if (propDef === undefined || propDef.type !== 'relation') {
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (propDef.cardinality === 'many') {
        const ids = Array.isArray(value) ? value : [value];
        result[propDef.notionName] = {
          relation: ids.map((id: unknown) => ({ id: String(id) })),
        };
      } else {
        result[propDef.notionName] = {
          relation: [{ id: String(value) }],
        };
      }
      continue;
    }

    // Look up property definition in schema
    const propDef = config.properties[yamlKey] as PropertyDef | undefined;
    if (propDef === undefined) {
      continue;
    }

    // Skip relations without _id (human-readable only)
    if (propDef.type === 'relation') {
      continue;
    }

    // Skip formulas — read-only
    if (propDef.type === 'formula') {
      continue;
    }

    const notionValue = toNotionValue(propDef, value);
    if (notionValue !== null) {
      result[propDef.notionName] = notionValue;
    }
  }

  return result;
}

// ─── Body Conversion ─────────────────────────────────────────────────

/**
 * Converts markdown body content into Notion block objects.
 */
export function markdownToNotionBlocks(body: string): BlockObjectRequest[] {
  if (!body.trim()) return [];
  return markdownToBlocks(body) as BlockObjectRequest[];
}

// ─── Checksum ────────────────────────────────────────────────────────

/**
 * SHA-256 of user-editable frontmatter (sorted, excluding _ keys) + body.
 * Used for dirty-checking: if checksum matches, no push needed.
 */
export function computeChecksum(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const hashable = Object.fromEntries(
    Object.entries(frontmatter)
      .filter(([key]) => !key.startsWith('_'))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const content = JSON.stringify(hashable) + '\n' + body;
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

// ─── Full File Processing ────────────────────────────────────────────

/**
 * Processes a complete markdown file: parses frontmatter, converts
 * properties + blocks, and computes a content checksum.
 */
export function processMarkdownFile(
  content: string,
  databaseKey: DatabaseKey,
): {
  properties: Record<string, object>;
  blocks: BlockObjectRequest[];
  checksum: string;
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const { frontmatter, body } = parseMarkdownFile(content);
  const properties = markdownToNotionProperties(frontmatter, databaseKey);
  const blocks = markdownToNotionBlocks(body);
  const checksum = computeChecksum(frontmatter, body);

  return { properties, blocks, checksum, frontmatter, body };
}
