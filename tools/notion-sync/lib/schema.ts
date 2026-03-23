// Property schema registry — maps YAML keys to Notion property names with type coercion.
// NOTE: notionDatabaseId values are Notion REST API database IDs (from page URLs),
// NOT collection:// data source IDs used by Notion's OAuth MCP.

// ─── Type Definitions ────────────────────────────────────────────────

export type PropertyType =
  | 'title'
  | 'select'
  | 'status'
  | 'multi_select'
  | 'number'
  | 'date'
  | 'email'
  | 'phone_number'
  | 'url'
  | 'rich_text'
  | 'relation'
  | 'formula';

export type PropertyDef =
  | { readonly type: 'title'; readonly notionName: string }
  | { readonly type: 'select'; readonly notionName: string }
  | { readonly type: 'status'; readonly notionName: string }
  | { readonly type: 'multi_select'; readonly notionName: string }
  | { readonly type: 'number'; readonly notionName: string }
  | { readonly type: 'date'; readonly notionName: string }
  | { readonly type: 'email'; readonly notionName: string }
  | { readonly type: 'phone_number'; readonly notionName: string }
  | { readonly type: 'url'; readonly notionName: string }
  | { readonly type: 'rich_text'; readonly notionName: string }
  | {
      readonly type: 'relation';
      readonly notionName: string;
      readonly cardinality: 'one' | 'many';
      readonly targetDatabase: DatabaseKey;
    }
  | { readonly type: 'formula'; readonly notionName: string };

export type DatabaseKey =
  | 'tasks'
  | 'personal_tasks'
  | 'goals'
  | 'kpis'
  | 'projects'
  | 'brainstorms'
  | 'clients'
  | 'contacts'
  | 'interactions';

export interface DatabaseConfig {
  readonly notionDatabaseId: string;
  readonly directory: string;
  readonly filenameTemplate: 'default' | 'interactions';
  readonly properties: Readonly<Record<string, PropertyDef>>;
}

// ─── Database Registry ───────────────────────────────────────────────

export const DATABASE_REGISTRY = {
  tasks: {
    notionDatabaseId: 'fff00000-test-0000-0000-tasks0000001',
    directory: 'tasks/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Task name' },
      status: { type: 'status', notionName: 'Status' },
      lifecycle: { type: 'select', notionName: 'Lifecycle' },
      priority: { type: 'select', notionName: 'Priority' },
      area: { type: 'multi_select', notionName: 'Area' },
      timeframe: { type: 'select', notionName: 'Timeframe' },
      energy: { type: 'select', notionName: 'Energy' },
      effort_level: { type: 'select', notionName: 'Effort level' },
      impact: { type: 'select', notionName: 'Impact' },
      due_date: { type: 'date', notionName: 'Due date' },
      goal: {
        type: 'relation',
        notionName: 'Goal',
        cardinality: 'one',
        targetDatabase: 'goals',
      },
      project: {
        type: 'relation',
        notionName: 'Projects',
        cardinality: 'one',
        targetDatabase: 'projects',
      },
      parent_task: {
        type: 'relation',
        notionName: 'Parent task',
        cardinality: 'one',
        targetDatabase: 'tasks',
      },
    },
  },

  personal_tasks: {
    notionDatabaseId: '11100000-test-0000-0000-personal0001',
    directory: 'personal-tasks/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Task name' },
      status: { type: 'status', notionName: 'Status' },
      priority: { type: 'select', notionName: 'Priority' },
      area: { type: 'multi_select', notionName: 'Area' },
      timeframe: { type: 'select', notionName: 'Timeframe' },
      energy: { type: 'select', notionName: 'Energy' },
      due_date: { type: 'date', notionName: 'Due date' },
    },
  },

  goals: {
    notionDatabaseId: 'aaa00000-test-0000-0000-goals0000001',
    directory: 'goals/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Goal name' },
      status: { type: 'status', notionName: 'Status' },
      lifecycle: { type: 'select', notionName: 'Lifecycle' },
      priority: { type: 'select', notionName: 'Priority' },
      area: { type: 'multi_select', notionName: 'Area' },
      horizon: { type: 'select', notionName: 'Horizon' },
    },
  },

  kpis: {
    notionDatabaseId: 'ddd00000-test-0000-0000-kpis00000001',
    directory: 'kpis/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Name' },
      lifecycle: { type: 'select', notionName: 'Lifecycle' },
      unit: { type: 'select', notionName: 'Unit' },
      current_value: { type: 'number', notionName: 'Current Value' },
      target_value: { type: 'number', notionName: 'Target Value' },
      confidence: { type: 'select', notionName: 'Confidence' },
      tracking_frequency: { type: 'select', notionName: 'Tracking Frequency' },
      horizon: { type: 'select', notionName: 'Horizon' },
      area: { type: 'multi_select', notionName: 'Area' },
      deadline: { type: 'date', notionName: 'Deadline' },
      goal: {
        type: 'relation',
        notionName: 'Goal',
        cardinality: 'one',
        targetDatabase: 'goals',
      },
      _gap: { type: 'formula', notionName: 'Gap' },
      _progress: { type: 'formula', notionName: 'Progress' },
    },
  },

  projects: {
    notionDatabaseId: 'bbb00000-test-0000-0000-projects0001',
    directory: 'projects/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Project name' },
      status: { type: 'status', notionName: 'Status' },
      lifecycle: { type: 'select', notionName: 'Lifecycle' },
      priority: { type: 'select', notionName: 'Priority' },
      area: { type: 'multi_select', notionName: 'Area' },
      horizon: { type: 'select', notionName: 'Horizon' },
      start_date: { type: 'date', notionName: 'Start date' },
      end_date: { type: 'date', notionName: 'End date' },
      goal: {
        type: 'relation',
        notionName: 'Goals',
        cardinality: 'one',
        targetDatabase: 'goals',
      },
      client: {
        type: 'relation',
        notionName: 'Client',
        cardinality: 'one',
        targetDatabase: 'clients',
      },
    },
  },

  brainstorms: {
    notionDatabaseId: '22200000-test-0000-0000-brainstorms1',
    directory: 'brainstorms/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Idea' },
      status: { type: 'status', notionName: 'Status' },
      space: { type: 'multi_select', notionName: 'Space' },
      problem_category: { type: 'multi_select', notionName: 'Problem Category' },
      priority: { type: 'select', notionName: 'Priority' },
      client: {
        type: 'relation',
        notionName: 'Client',
        cardinality: 'one',
        targetDatabase: 'clients',
      },
      project: {
        type: 'relation',
        notionName: 'Project',
        cardinality: 'one',
        targetDatabase: 'projects',
      },
    },
  },

  clients: {
    notionDatabaseId: 'ccc00000-test-0000-0000-clients00001',
    directory: 'clients/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Company Name' },
      status: { type: 'select', notionName: 'Status' },
      risk_level: { type: 'select', notionName: 'Risk Level' },
      engagement_type: { type: 'select', notionName: 'Engagement Model' },
      engagement_posture: { type: 'select', notionName: 'Engagement Posture' },
      rate: { type: 'number', notionName: 'Rate' },
      area: { type: 'multi_select', notionName: 'Tech Stack' },
      time_tracking_url: { type: 'url', notionName: 'Time Tracking Sheet' },
      website: { type: 'url', notionName: 'Website' },
    },
  },

  contacts: {
    notionDatabaseId: 'eee00000-test-0000-0000-contacts0001',
    directory: 'contacts/',
    filenameTemplate: 'default',
    properties: {
      title: { type: 'title', notionName: 'Name' },
      email: { type: 'email', notionName: 'Email' },
      role: { type: 'rich_text', notionName: 'Role / Title' },
      client: {
        type: 'relation',
        notionName: 'Client',
        cardinality: 'one',
        targetDatabase: 'clients',
      },
      phone: { type: 'phone_number', notionName: 'Phone' },
      linkedin: { type: 'url', notionName: 'LinkedIn' },
      notes: { type: 'rich_text', notionName: 'Notes' },
    },
  },

  interactions: {
    notionDatabaseId: '33300000-test-0000-0000-interactions',
    directory: 'interactions/',
    filenameTemplate: 'interactions',
    properties: {
      title: { type: 'title', notionName: 'Title' },
      type: { type: 'select', notionName: 'Type' },
      date: { type: 'date', notionName: 'Date' },
      direction: { type: 'select', notionName: 'Direction' },
      client: {
        type: 'relation',
        notionName: 'Client',
        cardinality: 'one',
        targetDatabase: 'clients',
      },
      contacts: {
        type: 'relation',
        notionName: 'Contacts',
        cardinality: 'many',
        targetDatabase: 'contacts',
      },
      action_items: { type: 'rich_text', notionName: 'Action Items' },
    },
  },
} as const satisfies Record<DatabaseKey, DatabaseConfig>;

// ─── Lookup Helpers ──────────────────────────────────────────────────

export function getDatabaseConfig(key: DatabaseKey): DatabaseConfig {
  return DATABASE_REGISTRY[key];
}

export function getDatabaseKeyByDirectory(dir: string): DatabaseKey | undefined {
  const normalized = dir.endsWith('/') ? dir : `${dir}/`;
  for (const [key, config] of Object.entries(DATABASE_REGISTRY)) {
    if (config.directory === normalized) {
      return key as DatabaseKey;
    }
  }
  return undefined;
}

export function getDatabaseKeyById(notionDatabaseId: string): DatabaseKey | undefined {
  for (const [key, config] of Object.entries(DATABASE_REGISTRY)) {
    if (config.notionDatabaseId === notionDatabaseId) {
      return key as DatabaseKey;
    }
  }
  return undefined;
}

export function isReadOnlyProperty(yamlKey: string): boolean {
  return yamlKey.startsWith('_');
}

const SYNC_MANAGED_KEYS = new Set([
  '_last_synced',
  '_notion_edited',
  '_sync_pending',
]);

export function isSyncManagedProperty(yamlKey: string): boolean {
  return SYNC_MANAGED_KEYS.has(yamlKey);
}

// ─── Type Coercion ───────────────────────────────────────────────────

interface NotionRichTextSegment {
  readonly plain_text?: string;
  readonly text?: { readonly content?: string };
}

interface NotionFormulaResult {
  readonly type?: string;
  readonly number?: number | null;
  readonly string?: string | null;
  readonly boolean?: boolean | null;
  readonly date?: { readonly start?: string | null } | null;
}

interface NotionSelectValue {
  readonly name?: string;
}

interface NotionMultiSelectValue {
  readonly name?: string;
}

interface NotionPropertyValue {
  readonly title?: readonly NotionRichTextSegment[];
  readonly select?: NotionSelectValue | null;
  readonly status?: NotionSelectValue | null;
  readonly multi_select?: readonly NotionMultiSelectValue[];
  readonly number?: number | null;
  readonly date?: { readonly start?: string | null } | null;
  readonly email?: string | null;
  readonly phone_number?: string | null;
  readonly url?: string | null;
  readonly rich_text?: readonly NotionRichTextSegment[];
  readonly formula?: NotionFormulaResult | null;
}

export function toNotionValue(
  def: PropertyDef,
  value: unknown,
): Record<string, unknown> | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  switch (def.type) {
    case 'title':
      return { title: [{ text: { content: String(value) } }] };

    case 'select':
      return { select: { name: String(value) } };

    case 'status':
      return { status: { name: String(value) } };

    case 'multi_select': {
      const values = Array.isArray(value) ? value : [value];
      return {
        multi_select: values.map((v: unknown) => ({ name: String(v) })),
      };
    }

    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return null;
      return { number: num };
    }

    case 'date':
      return { date: { start: String(value) } };

    case 'email':
      return { email: String(value) };

    case 'phone_number':
      return { phone_number: String(value) };

    case 'url':
      return { url: String(value) };

    case 'rich_text':
      return { rich_text: [{ text: { content: String(value) } }] };

    case 'relation':
      // Relations are handled by a separate relations module
      return null;

    case 'formula':
      // Formulas are read-only — cannot write to Notion
      return null;
  }
}

export function fromNotionValue(
  def: PropertyDef,
  notionProp: unknown,
): unknown {
  if (notionProp === undefined || notionProp === null) {
    return undefined;
  }

  const prop = notionProp as NotionPropertyValue;

  switch (def.type) {
    case 'title': {
      const segments = prop.title;
      if (!segments || segments.length === 0) return undefined;
      return segments[0]?.plain_text;
    }

    case 'select':
      return prop.select?.name ?? undefined;

    case 'status':
      return prop.status?.name ?? undefined;

    case 'multi_select': {
      const items = prop.multi_select;
      if (!items || items.length === 0) return undefined;
      return items.map((s) => s.name).filter(Boolean);
    }

    case 'number':
      return prop.number ?? undefined;

    case 'date':
      return prop.date?.start ?? undefined;

    case 'email':
      return prop.email ?? undefined;

    case 'phone_number':
      return prop.phone_number ?? undefined;

    case 'url':
      return prop.url ?? undefined;

    case 'rich_text': {
      const segments = prop.rich_text;
      if (!segments || segments.length === 0) return undefined;
      return segments.map((r) => r.plain_text ?? '').join('');
    }

    case 'relation':
      // Relations are handled by a separate relations module
      return undefined;

    case 'formula': {
      const formula = prop.formula;
      if (!formula) return undefined;
      switch (formula.type) {
        case 'number':
          return formula.number ?? undefined;
        case 'string':
          return formula.string ?? undefined;
        case 'boolean':
          return formula.boolean ?? undefined;
        case 'date':
          return formula.date?.start ?? undefined;
        default:
          return undefined;
      }
    }
  }
}

// ─── Slugify ─────────────────────────────────────────────────────────

const MAX_SLUG_LENGTH = 60;

export function slugify(text: string): string {
  // Security: reject path traversal, absolute paths, null bytes, backslashes
  let sanitized = text.replace(/\0/g, '');
  sanitized = sanitized.replace(/\\/g, '');
  sanitized = sanitized.replace(/^\//g, '');

  // Remove path traversal attempts (loop until stable)
  let prev = '';
  while (prev !== sanitized) {
    prev = sanitized;
    sanitized = sanitized.replace(/\.\./g, '');
  }

  let slug = sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    // Truncate at last word boundary (hyphen)
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 0) {
      slug = slug.slice(0, lastHyphen);
    }
  }

  return slug;
}

// ─── Filename Generation ─────────────────────────────────────────────

export function generateFilename(
  config: DatabaseConfig,
  title: string,
  notionId: string,
  date?: string,
  type?: string,
): string {
  const slug = slugify(title);
  const shortId = notionId.replace(/-/g, '').slice(0, 12);

  if (config.filenameTemplate === 'interactions') {
    const dateStr = date ?? 'undated';
    const typeStr = type ? slugify(type) : 'note';
    return `${dateStr}-${typeStr}-${slug}-${shortId}.md`;
  }

  return `${slug}-${shortId}.md`;
}
