// Notion page → Markdown file converter.
// Extracts properties to YAML frontmatter, converts body via notion-to-md.

import { NotionToMarkdown } from "notion-to-md";
import matter from "gray-matter";
import yaml from "js-yaml";

import { getRawClient } from "./notion-client.js";
import type { PageObjectResponse } from "./notion-client.js";
import {
  DATABASE_REGISTRY,
  fromNotionValue,
  generateFilename,
} from "./schema.js";
import type { DatabaseKey, DatabaseConfig, PropertyDef } from "./schema.js";
import type { PageIndexEntry } from "./state.js";

// ─── Types ──────────────────────────────────────────────────────────

export interface ConvertedPage {
  readonly filename: string;
  readonly content: string;
  readonly frontmatter: Record<string, unknown>;
}

// ─── notion-to-md instance (lazy) ───────────────────────────────────

let _n2m: NotionToMarkdown | undefined;

function getN2M(): NotionToMarkdown {
  if (!_n2m) {
    _n2m = new NotionToMarkdown({ notionClient: getRawClient() });
  }
  return _n2m;
}

// ─── Property Extraction ────────────────────────────────────────────

interface RelationProperty {
  readonly type: "relation";
  readonly relation: ReadonlyArray<{ readonly id: string }>;
}

function isRelationProperty(prop: unknown): prop is RelationProperty {
  return (
    typeof prop === "object" &&
    prop !== null &&
    (prop as Record<string, unknown>)["type"] === "relation"
  );
}

/**
 * Resolve a relation page ID to its human-readable title via the page index.
 * Returns empty string if not found.
 */
function resolveRelationName(
  pageIndex: Record<string, PageIndexEntry>,
  notionId: string,
): string {
  return pageIndex[notionId]?.title ?? "";
}

/**
 * Extract frontmatter from a Notion page's properties using the schema registry.
 * Known properties are mapped via schema; unknown properties are preserved as _raw_*.
 */
function extractFrontmatter(
  page: PageObjectResponse,
  dbConfig: DatabaseConfig,
  pageIndex: Record<string, PageIndexEntry>,
): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  const notionProps = page.properties;

  // Build reverse map: Notion property name → [yamlKey, def]
  const reverseMap = new Map<string, { yamlKey: string; def: PropertyDef }>();
  for (const [yamlKey, def] of Object.entries(dbConfig.properties)) {
    reverseMap.set(def.notionName, { yamlKey, def });
  }

  for (const [notionName, notionProp] of Object.entries(notionProps)) {
    const mapping = reverseMap.get(notionName);

    if (mapping) {
      const { yamlKey, def } = mapping;

      if (def.type === "relation") {
        // Relations: write both human name and _id with page IDs
        if (isRelationProperty(notionProp)) {
          const ids = notionProp.relation.map((r) => r.id);
          if (def.cardinality === "one") {
            const id = ids[0] ?? null;
            fm[`${yamlKey}_id`] = id;
            fm[yamlKey] = id ? resolveRelationName(pageIndex, id) : null;
          } else {
            fm[`${yamlKey}_ids`] = ids.length > 0 ? ids : null;
            fm[yamlKey] = ids.length > 0
              ? ids.map((id) => resolveRelationName(pageIndex, id))
              : null;
          }
        }
      } else if (def.type === "formula") {
        // Formula fields: prefix with underscore, read-only
        const key = yamlKey.startsWith("_") ? yamlKey : `_${yamlKey}`;
        fm[key] = fromNotionValue(def, notionProp);
      } else {
        fm[yamlKey] = fromNotionValue(def, notionProp);
      }
    } else {
      // Unknown property — preserve as _raw_<name>
      const rawKey = `_raw_${notionName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const typedProp = notionProp as Record<string, unknown>;
      const propType = typedProp["type"] as string | undefined;
      if (propType) {
        fm[rawKey] = typedProp[propType] ?? null;
      }
    }
  }

  return fm;
}

// ─── Body Conversion ────────────────────────────────────────────────

async function convertBody(pageId: string): Promise<string> {
  const n2m = getN2M();
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const mdString = n2m.toMarkdownString(mdBlocks);
  return (mdString["parent"] ?? "").trim();
}

// ─── Frontmatter Serialization ──────────────────────────────────────

function serializeToMarkdown(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  return matter.stringify(body ? `\n${body}\n` : "", frontmatter, {
    engines: {
      yaml: {
        // Prevent gray-matter from coercing date strings into Date objects
        stringify: (obj: object) =>
          yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
        parse: (str: string) =>
          yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
      },
    },
  });
}

// ─── Main Export ────────────────────────────────────────────────────

export async function notionPageToMarkdown(
  page: PageObjectResponse,
  databaseKey: DatabaseKey,
  pageIndex: Record<string, PageIndexEntry>,
): Promise<ConvertedPage> {
  const dbConfig = DATABASE_REGISTRY[databaseKey];

  // Extract frontmatter from properties
  const fm = extractFrontmatter(page, dbConfig, pageIndex);

  // Add sync metadata
  fm["notion_id"] = page.id;
  fm["_last_synced"] = new Date().toISOString();
  fm["_notion_edited"] = page.last_edited_time;

  // Extract title and date for filename generation
  const title = typeof fm["title"] === "string" ? fm["title"] : "untitled";
  const date = typeof fm["date"] === "string" ? fm["date"] : undefined;
  const type = typeof fm["type"] === "string" ? fm["type"] : undefined;

  const filename = generateFilename(dbConfig, title, page.id, date, type);

  // Convert page body
  const body = await convertBody(page.id);

  // Serialize to markdown with frontmatter
  const content = serializeToMarkdown(fm, body);

  return { filename, content, frontmatter: fm };
}
