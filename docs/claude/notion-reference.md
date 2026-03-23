# Notion Reference Data

## Databases

| Database | Data Source ID | Purpose |
|----------|---------------|---------|
| Tasks Tracker (Business) | `collection://YOUR-TASKS-DATABASE-ID` | Work tasks, business actions |
| Personal Tasks | `collection://YOUR-PERSONAL-TASKS-DATABASE-ID` | Personal tasks, chores, life admin |
| Goals Tracker | `collection://YOUR-GOALS-DATABASE-ID` | Long-term direction, outcomes to achieve |
| Projects | `collection://YOUR-PROJECTS-DATABASE-ID` | Bounded initiatives with start/end |
| KPIs | `collection://YOUR-KPIS-DATABASE-ID` | SMART-enforced measurable outcomes linked to Goals |
| Brainstorm Session | `collection://YOUR-BRAINSTORMS-DATABASE-ID` | Ideas, explorations, things to consider |
| Clients | `collection://YOUR-CLIENTS-DATABASE-ID` | CRM — organizations [Owner] works with |
| Contacts | `collection://YOUR-CONTACTS-DATABASE-ID` | CRM — individual people |
| Interactions | `collection://YOUR-INTERACTIONS-DATABASE-ID` | CRM — touchpoints (meetings, emails, WhatsApp, calls) |

## Active Project IDs

| Project | Page ID | Use For |
|---------|---------|---------|
| Client-B — Fractional CTO Discovery | `YOUR-PROJECT-ID-1` | All Client-B client tasks |
| Client-A — AI Marketing Integration | `YOUR-PROJECT-ID-2` | All Client-A client tasks |
| Client-C — Real Estate Services | `YOUR-PROJECT-ID-3` | All Client-C client tasks |
| Business Development | `YOUR-PROJECT-ID-4` | Networking, partnerships, lead screening, fCTO intros |
| Content & Brand | `YOUR-PROJECT-ID-5` | Blog, social media, lead flow, brand storytelling |
| Operations | `YOUR-PROJECT-ID-6` | Admin, non-client infrastructure tasks |
| Experiments | `YOUR-PROJECT-ID-7` | Hypedrive, PocketWorld, Home Assistant, WorksheetsForGrowth |
| Executive Development | `YOUR-PROJECT-ID-8` | Coaching with [Coach], positioning, personal development |
| Client-D — Mission Control Pilot | `YOUR-PROJECT-ID-9` | First Mission Control pilot, free engagement, executive coach |

## Key Notion Pages

- Coaching page: `YOUR-PAGE-ID-COACHING`
- Build Portfolio goal: `YOUR-PAGE-ID-PORTFOLIO-GOAL`
- Validate Real Estate goal: `YOUR-PAGE-ID-REALESTATE-GOAL`
- Build Content & Audience goal: `YOUR-PAGE-ID-CONTENT-GOAL`
- MRR KPI: `YOUR-PAGE-ID-MRR-KPI`
- SaaS Products KPI: `YOUR-PAGE-ID-SAAS-KPI`
- Email Subscribers KPI: `YOUR-PAGE-ID-SUBSCRIBERS-KPI`
- Real Estate Validation Interviews KPI: `YOUR-PAGE-ID-INTERVIEWS-KPI`

## Property Mapping

| Field | Format | Example |
|-------|--------|---------|
| Goal relation | JSON array of page URLs | `["https://www.notion.so/<page-id>"]` |
| Area | JSON array of strings | `["Sales", "Engineering"]` |
| Multi-select | JSON array of strings | `["Product", "Operations"]` |
| Date | Expanded property | `date:Due date:start` = `2026-02-16` |
| Status (tasks) | String | `Not started`, `Planned this week`, `In progress`, `Done This Week` |
| Status (projects) | String | `Not started`, `In progress`, `Done` |

## Active Client IDs

| Client | Client Page ID | Key Contacts |
|--------|---------------|--------------|
| Client-B | `YOUR-CLIENT-ID-B` | Contact-4 `YOUR-CONTACT-ID-4`, Contact-5 `YOUR-CONTACT-ID-5`, Contact-6 `YOUR-CONTACT-ID-6` |
| Client-A | `YOUR-CLIENT-ID-A` | Contact-1 `YOUR-CONTACT-ID-1`, Felix Jernström `YOUR-CONTACT-ID-2`, Contact-3 `YOUR-CONTACT-ID-3` |
| Client-C | `YOUR-CLIENT-ID-C` | Client-C `YOUR-CONTACT-ID-C` |
| Client-D | `YOUR-CLIENT-ID-D` | Client-D `YOUR-CONTACT-ID-D` |
| Client-G | `YOUR-CLIENT-ID-SHIFT` | Contact-10 `YOUR-CONTACT-ID-10` |

## Key Email Contacts

| Client | Contact | Email | Thread ID |
|--------|---------|-------|-----------|
| Client-B | Contact-4 (Uncharted) | contact4@example.com | — |
| Client-A | Contact-1 | contact1@example.com | YOUR-THREAD-ID |

## Exact Property Names Per Database

These are the EXACT property names from each database schema. Use these verbatim — Notion is case-sensitive and exact-match only.

### Tasks Tracker

| Property | Type | Notes |
|----------|------|-------|
| Task name | title | NOT "Name" or "Task" |
| Status | status | Not started, Planned, Planned this week, In progress, Done This Week, Done, Deprioritized |
| Priority | select | High, Medium, Low |
| Area | multi_select | Finance, Marketing, Product, Operations, Legal, Sales, Engineering |
| Timeframe | select | This Week, This Month, This Quarter, Someday |
| Energy | select | Deep Work, Quick Win, Admin, Waiting On, Research |
| Impact | select | Needle Mover, Supporting, Maintenance |
| Effort level | select | Small, Medium, Large |
| Goal | relation | Singular "Goal" — NOT "Goals". Links to Goals Tracker. |
| Projects | relation | Links to Projects database |
| Parent task | relation | Links to another task in Tasks Tracker |
| Description | text | |
| Due date | date | Use expanded: `date:Due date:start` |
| Context | select | Work, Personal, Chore |
| Lifecycle | select | Active, Deprioritized, Archived |
| Epic | multi_select | |
| Task type | multi_select | 🐞 Bug, 💬 Feature request, 💅 Polish |

### Interactions

| Property | Type | Notes |
|----------|------|-------|
| Title | title | NOT "Name". This is the title property. |
| Type | select | Meeting, Email, WhatsApp, Call, LinkedIn Message, Prep |
| Date | date | Use expanded: `date:Date:start` |
| Direction | select | Inbound, Outbound |
| Client | relation | Links to Clients database |
| Contacts | relation | Links to Contacts database |
| Action Items | text | |

### Brainstorm Session

| Property | Type | Notes |
|----------|------|-------|
| Idea | title | This is the title property |
| Status | select | New idea, Under discussion (check for others) |
| Priority | select | High, Medium, Low |
| Space | multi_select | B2B, B2C, WhatsApp, Growth, Sales, Marketing, Automation, Productivity, AI, SaaS, Communication, Analytics, Integration, API, Mobile, Web, Data, Security, Cloud, DevOps |
| Problem Category | multi_select | Lead generation & sales pipeline, Operational inefficiency, Data fragmentation & silos, Manual repetitive tasks, Customer acquisition cost, Content creation bottleneck, Decision-making without data, Technical implementation gaps, Administrative overhead, Knowledge management, Team collaboration friction, Scaling limitations, Compliance & documentation, Customer retention, Market visibility, Resource allocation, Time to market, Technical debt |
| Client | relation | Links to Clients database |
| Project | relation | Links to Projects database |

### Projects

| Property | Type | Notes |
|----------|------|-------|
| Project name | title | |
| Status | status | Not started, In progress, Done |
| Goals | relation | Plural "Goals" — this database uses "Goals" (unlike Tasks which uses "Goal") |
| Client | relation | Links to Clients database |
| Area | multi_select | |
| Horizon | select | |
| Lifecycle | select | Active |
| Priority | select | High, Medium, Low |

## Notion MCP Gotchas

1. **Property names are exact-match** — `Goal` ≠ `Goals`. `Title` ≠ `Name`. Always verify against the schema above.
2. **Multi_select values must pre-exist** — The Notion MCP rejects values not in the schema. Use only values listed above, or update the data source first with `notion-update-data-source`.
3. **Always fetch schema when unsure** — `notion-fetch collection://<id>` returns the live schema with exact property names and valid options.
4. **Tasks use "Goal" (singular), Projects use "Goals" (plural)** — This is the most common mistake. Double-check which database you're writing to.
5. **Validate before batching** — When creating multiple pages, create one first to catch schema errors before batching the rest.
