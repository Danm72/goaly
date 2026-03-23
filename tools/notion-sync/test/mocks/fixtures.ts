// Realistic Notion API response fixtures for each database type.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function richText(text: string) {
  return [
    {
      type: 'text' as const,
      text: { content: text, link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default' as const,
      },
      plain_text: text,
      href: null,
    },
  ];
}

function titleProp(text: string) {
  return { type: 'title' as const, title: richText(text), id: 'title' };
}

function selectProp(name: string) {
  return { type: 'select' as const, select: { id: 'sel-1', name, color: 'default' as const }, id: 'sel' };
}

function statusProp(name: string) {
  return { type: 'status' as const, status: { id: 'sts-1', name, color: 'default' as const }, id: 'sts' };
}

function multiSelectProp(names: string[]) {
  return {
    type: 'multi_select' as const,
    multi_select: names.map((name, i) => ({ id: `ms-${i}`, name, color: 'default' as const })),
    id: 'ms',
  };
}

function numberProp(value: number) {
  return { type: 'number' as const, number: value, id: 'num' };
}

function dateProp(start: string) {
  return { type: 'date' as const, date: { start, end: null, time_zone: null }, id: 'dt' };
}

function relationProp(ids: string[]) {
  return {
    type: 'relation' as const,
    relation: ids.map((id) => ({ id })),
    id: 'rel',
    has_more: false,
  };
}

function richTextProp(text: string) {
  return { type: 'rich_text' as const, rich_text: richText(text), id: 'rt' };
}

function formulaProp(type: 'number', value: number): object;
function formulaProp(type: 'string', value: string): object;
function formulaProp(type: string, value: unknown) {
  return { type: 'formula' as const, formula: { type, [type]: value }, id: 'frm' };
}

function emailProp(email: string) {
  return { type: 'email' as const, email, id: 'em' };
}

function urlProp(url: string) {
  return { type: 'url' as const, url, id: 'url' };
}

function phoneProp(phone: string) {
  return { type: 'phone_number' as const, phone_number: phone, id: 'ph' };
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

function makePage(
  id: string,
  properties: Record<string, object>,
  lastEditedTime = '2026-03-03T10:00:00.000Z',
) {
  return {
    object: 'page' as const,
    id,
    created_time: '2026-02-01T08:00:00.000Z',
    last_edited_time: lastEditedTime,
    created_by: { object: 'user' as const, id: 'user-1' },
    last_edited_by: { object: 'user' as const, id: 'user-1' },
    cover: null,
    icon: null,
    parent: { type: 'database_id' as const, database_id: 'db-1' },
    archived: false,
    in_trash: false,
    properties,
    url: `https://www.notion.so/${id.replace(/-/g, '')}`,
    public_url: null,
  };
}

// ---------------------------------------------------------------------------
// Database-specific pages
// ---------------------------------------------------------------------------

export const GOAL_PAGE_ID = 'aaaa0000-0000-0000-0000-000000000001';
export const PROJECT_PAGE_ID = 'bbbb0000-0000-0000-0000-000000000001';
export const CLIENT_PAGE_ID = 'cccc0000-0000-0000-0000-000000000001';
export const KPI_PAGE_ID = 'dddd0000-0000-0000-0000-000000000001';
export const CONTACT_PAGE_ID = 'eeee0000-0000-0000-0000-000000000001';
export const TASK_PAGE_ID = 'ffff0000-0000-0000-0000-000000000001';
export const PERSONAL_TASK_PAGE_ID = '11110000-0000-0000-0000-000000000001';
export const BRAINSTORM_PAGE_ID = '22220000-0000-0000-0000-000000000001';
export const INTERACTION_PAGE_ID = '33330000-0000-0000-0000-000000000001';

export const goalPage = makePage(GOAL_PAGE_ID, {
  'Goal name': titleProp('Build Portfolio of Internet Companies'),
  Status: statusProp('Active'),
  Lifecycle: selectProp('Active'),
  Priority: selectProp('High'),
  Area: multiSelectProp(['Product', 'Growth']),
  Horizon: selectProp('Multi-Year'),
});

export const projectPage = makePage(PROJECT_PAGE_ID, {
  'Project name': titleProp('Client-B — Fractional CTO Discovery'),
  Status: statusProp('In progress'),
  Lifecycle: selectProp('Active'),
  Priority: selectProp('High'),
  Area: multiSelectProp(['Engineering']),
  Horizon: selectProp('This Quarter'),
  'Start date': dateProp('2026-01-15'),
  'End date': dateProp('2026-06-15'),
  Goals: relationProp([GOAL_PAGE_ID]),
  Client: relationProp([CLIENT_PAGE_ID]),
});

export const clientPage = makePage(CLIENT_PAGE_ID, {
  'Company Name': titleProp('Client-B'),
  Status: selectProp('Active'),
  'Risk Level': selectProp('Low'),
  'Engagement Model': selectProp('Fractional CTO'),
  'Engagement Posture': selectProp('Active'),
  Rate: numberProp(150),
  'Tech Stack': multiSelectProp(['Sports Tech']),
  'Time Tracking Sheet': urlProp('https://docs.google.com/spreadsheets/d/test'),
  Website: urlProp('https://client-bsports.com'),
});

export const kpiPage = makePage(KPI_PAGE_ID, {
  Name: titleProp('Monthly Recurring Revenue'),
  Lifecycle: selectProp('Active'),
  Unit: selectProp('EUR'),
  'Current Value': numberProp(6600),
  'Target Value': numberProp(12000),
  Confidence: selectProp('Realistic'),
  'Tracking Frequency': selectProp('Monthly'),
  Horizon: selectProp('This Year'),
  Area: multiSelectProp(['Finance']),
  Deadline: dateProp('2026-12-31'),
  Goal: relationProp([GOAL_PAGE_ID]),
  Gap: formulaProp('number', 5400),
  Progress: formulaProp('number', 55),
});

export const contactPage = makePage(CONTACT_PAGE_ID, {
  Name: titleProp('Contact-4'),
  Email: emailProp('contact4@example.com'),
  'Role / Title': richTextProp('CEO, Uncharted Startups'),
  Client: relationProp([CLIENT_PAGE_ID]),
  Phone: phoneProp('+1-555-0100'),
  LinkedIn: urlProp('https://linkedin.com/in/arthur'),
  Notes: richTextProp('Key contact for Client-B'),
});

export const taskPage = makePage(TASK_PAGE_ID, {
  'Task name': titleProp('Deploy staging environment'),
  Status: statusProp('Planned this week'),
  Lifecycle: selectProp('Active'),
  Priority: selectProp('High'),
  Area: multiSelectProp(['Engineering']),
  Timeframe: selectProp('This Week'),
  Energy: selectProp('Deep Work'),
  'Effort level': selectProp('Medium'),
  Impact: selectProp('Needle Mover'),
  'Due date': dateProp('2026-03-07'),
  Goal: relationProp([GOAL_PAGE_ID]),
  Projects: relationProp([PROJECT_PAGE_ID]),
  'Parent task': relationProp([]),
});

export const personalTaskPage = makePage(PERSONAL_TASK_PAGE_ID, {
  'Task name': titleProp('Renew passport'),
  Status: statusProp('Not started'),
  Priority: selectProp('Medium'),
  Area: multiSelectProp(['Travel']),
  Timeframe: selectProp('This Month'),
  Energy: selectProp('Errand'),
  'Due date': dateProp('2026-04-01'),
});

export const brainstormPage = makePage(BRAINSTORM_PAGE_ID, {
  Idea: titleProp('AI-powered lead qualification'),
  Status: statusProp('New idea'),
  Space: multiSelectProp(['Product']),
  'Problem Category': multiSelectProp(['Lead Flow']),
  Priority: selectProp('Medium'),
  Client: relationProp([]),
  Project: relationProp([PROJECT_PAGE_ID]),
});

export const interactionPage = makePage(INTERACTION_PAGE_ID, {
  Title: titleProp('Discovery call — Client-B'),
  Type: selectProp('Meeting'),
  Date: dateProp('2026-02-23'),
  Direction: selectProp('Outbound'),
  Client: relationProp([CLIENT_PAGE_ID]),
  Contacts: relationProp([CONTACT_PAGE_ID]),
  'Action Items': richTextProp('Send SOW by end of week'),
});

// ---------------------------------------------------------------------------
// Database query responses (single page per DB for tests)
// ---------------------------------------------------------------------------

function queryResponse(pages: object[]) {
  return {
    object: 'list',
    results: pages,
    next_cursor: null,
    has_more: false,
    type: 'page_or_database',
    page_or_database: {},
  };
}

export const databaseResponses: Record<string, object> = {
  // Goals
  'aaa00000-test-0000-0000-goals0000001': queryResponse([goalPage]),
  // Projects
  'bbb00000-test-0000-0000-projects0001': queryResponse([projectPage]),
  // Clients
  'ccc00000-test-0000-0000-clients00001': queryResponse([clientPage]),
  // KPIs
  'ddd00000-test-0000-0000-kpis00000001': queryResponse([kpiPage]),
  // Contacts
  'eee00000-test-0000-0000-contacts0001': queryResponse([contactPage]),
  // Tasks
  'fff00000-test-0000-0000-tasks0000001': queryResponse([taskPage]),
  // Personal Tasks
  '11100000-test-0000-0000-personal0001': queryResponse([personalTaskPage]),
  // Brainstorms
  '22200000-test-0000-0000-brainstorms1': queryResponse([brainstormPage]),
  // Interactions
  '33300000-test-0000-0000-interactions': queryResponse([interactionPage]),
};

// ---------------------------------------------------------------------------
// Block children response (for page body conversion)
// ---------------------------------------------------------------------------

export function blockChildrenResponse(pageId: string) {
  return {
    object: 'list',
    results: [
      {
        object: 'block',
        id: `block-${pageId}-1`,
        parent: { type: 'page_id', page_id: pageId },
        created_time: '2026-02-01T08:00:00.000Z',
        last_edited_time: '2026-03-03T10:00:00.000Z',
        created_by: { object: 'user', id: 'user-1' },
        last_edited_by: { object: 'user', id: 'user-1' },
        has_children: false,
        archived: false,
        in_trash: false,
        type: 'paragraph',
        paragraph: {
          rich_text: richText(`Body content for page ${pageId}.`),
          color: 'default',
        },
      },
    ],
    next_cursor: null,
    has_more: false,
    type: 'block',
    block: {},
  };
}

// ---------------------------------------------------------------------------
// Paginated response (for pagination test)
// ---------------------------------------------------------------------------

export const PAGINATED_TASK_PAGE_2_ID = 'ffff0000-0000-0000-0000-000000000002';

export const taskPage2 = makePage(PAGINATED_TASK_PAGE_2_ID, {
  'Task name': titleProp('Set up CI pipeline'),
  Status: statusProp('Not started'),
  Lifecycle: selectProp('Active'),
  Priority: selectProp('Medium'),
  Area: multiSelectProp(['Engineering']),
  Timeframe: selectProp('This Month'),
  Energy: selectProp('Deep Work'),
  'Effort level': selectProp('Large'),
  Impact: selectProp('Supporting'),
  'Due date': dateProp('2026-03-15'),
  Goal: relationProp([GOAL_PAGE_ID]),
  Projects: relationProp([PROJECT_PAGE_ID]),
  'Parent task': relationProp([]),
});

export function paginatedPage1Response() {
  return {
    object: 'list',
    results: [taskPage],
    next_cursor: 'cursor-page-2',
    has_more: true,
    type: 'page_or_database',
    page_or_database: {},
  };
}

export function paginatedPage2Response() {
  return {
    object: 'list',
    results: [taskPage2],
    next_cursor: null,
    has_more: false,
    type: 'page_or_database',
    page_or_database: {},
  };
}

// ---------------------------------------------------------------------------
// Renamed task (for title rename test)
// ---------------------------------------------------------------------------

export const RENAMED_TASK_PAGE_ID = TASK_PAGE_ID; // Same page, different title

export const renamedTaskPage = makePage(RENAMED_TASK_PAGE_ID, {
  ...taskPage.properties,
  'Task name': titleProp('Deploy production environment'), // changed from "staging"
}, '2026-03-04T10:00:00.000Z');
