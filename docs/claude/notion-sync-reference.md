# Notion Sync Reference (Local Markdown)

Agent-facing reference for working with `notion-mirror/` files instead of Notion MCP API calls.

## 1. Database to Directory Routing

| Database | Directory | Filename Pattern | Collection ID (MCP) |
|----------|-----------|-----------------|---------------------|
| Tasks Tracker | `notion-mirror/tasks/` | `{slug}-{shortId}.md` | `collection://YOUR-TASKS-DATABASE-ID` |
| Personal Tasks | `notion-mirror/personal-tasks/` | `{slug}-{shortId}.md` | `collection://YOUR-PERSONAL-TASKS-DATABASE-ID` |
| Goals Tracker | `notion-mirror/goals/` | `{slug}-{shortId}.md` | `collection://YOUR-GOALS-DATABASE-ID` |
| KPIs | `notion-mirror/kpis/` | `{slug}-{shortId}.md` | `collection://YOUR-KPIS-DATABASE-ID` |
| Projects | `notion-mirror/projects/` | `{slug}-{shortId}.md` | `collection://YOUR-PROJECTS-DATABASE-ID` |
| Brainstorm Session | `notion-mirror/brainstorms/` | `{slug}-{shortId}.md` | `collection://YOUR-BRAINSTORMS-DATABASE-ID` |
| Clients | `notion-mirror/clients/` | `{slug}-{shortId}.md` | `collection://YOUR-CLIENTS-DATABASE-ID` |
| Contacts | `notion-mirror/contacts/` | `{slug}-{shortId}.md` | `collection://YOUR-CONTACTS-DATABASE-ID` |
| Interactions | `notion-mirror/interactions/` | `{date}-{type}-{slug}-{shortId}.md` | `collection://YOUR-INTERACTIONS-DATABASE-ID` |

- `{slug}` = kebab-case title, max 60 chars, truncated at word boundary
- `{shortId}` = first 12 hex chars of notion_id (hyphens stripped)
- Interactions prefix with `{date}` (YYYY-MM-DD) and `{type}` (kebab-cased type value)

## 2. Frontmatter Schemas

Fields prefixed with `_raw_` are read-only unmapped Notion properties preserved during sync. Fields prefixed with `_` are read-only (formulas, sync metadata). All other fields are writable.

### Tasks Tracker (`notion-mirror/tasks/`)

```yaml
---
title: "Task name"                          # required, string
status: "Not started"                       # required, status — Not started | Planned this week | In progress | Done This Week | Done | Deprioritized
lifecycle: "Active"                         # optional, select
priority: "High"                            # optional, select — High | Medium | Low
area:                                       # optional, multi_select array
  - Engineering
  - Product
timeframe: "This Week"                      # optional, select — This Week | This Month | This Quarter | Someday
energy: "Deep Work"                         # optional, select — Deep Work | Quick Win | Admin | Waiting On | Research
effort_level: "Medium"                      # optional, select
impact: "Needle Mover"                      # optional, select — Needle Mover | Supporting | Maintenance
due_date: 2026-03-15                        # optional, date (YYYY-MM-DD string)
goal_id: 24892219-bbb7-8164-a76f-...       # optional, relation ID (one)
goal: "Build Portfolio of Internet..."      # optional, human-readable name (auto-resolved)
project_id: 30d92219-bbb7-8148-aed5-...    # optional, relation ID (one)
project: "Operations"                       # optional, human-readable name (auto-resolved)
parent_task_id: null                        # optional, relation ID (one)
parent_task: null                           # optional, human-readable name
notion_id: 2fc92219-bbb7-8011-...          # set by sync engine after creation
_last_synced: 2026-03-03T22:23:47.857Z     # read-only, sync metadata
_notion_edited: 2026-02-16T11:18:00.000Z   # read-only, sync metadata
---

Markdown body content here.
```

### Personal Tasks (`notion-mirror/personal-tasks/`)

```yaml
---
title: "Task name"                          # required, string
status: "Not started"                       # required, status — Not started | Planned This Week | In progress | Done | Done This Week
priority: "Medium"                          # optional, select — High | Medium | Low
area:                                       # optional, multi_select array
  - Health
  - Home
timeframe: "This Week"                      # optional, select
energy: "Quick Win"                         # optional, select
due_date: 2026-03-15                        # optional, date
notion_id: ...
_last_synced: ...
_notion_edited: ...
---
```

### Goals Tracker (`notion-mirror/goals/`)

```yaml
---
title: "Goal name"                          # required, string
status: "In progress"                       # required, status — Not started | In progress | Done
lifecycle: "Active"                         # optional, select — Active | Archived
priority: "High"                            # optional, select
area:                                       # optional, multi_select array
  - Product
  - Finance
horizon: "Multi-Year"                       # optional, select — This Quarter | This Year | Multi-Year
notion_id: ...
_last_synced: ...
_notion_edited: ...
---

Vision, context, milestones in body.
```

### KPIs (`notion-mirror/kpis/`)

```yaml
---
title: "KPI name"                           # required, string
lifecycle: "Active"                         # required, select — Active | Archived
unit: "EUR"                                 # required, select — EUR | Count | Percent | Hours | Score
current_value: 6600                         # required, number
target_value: 12000                         # required, number
confidence: "Realistic"                     # optional, select — Conservative | Realistic | Stretch
tracking_frequency: "Monthly"               # optional, select — Weekly | Monthly | Quarterly
horizon: "This Quarter"                     # optional, select
area:                                       # optional, multi_select array
  - Finance
deadline: 2026-06-30                        # optional, date
goal_id: 31092219-bbb7-818e-...            # required, relation ID (one)
goal: "Secure Family Future"                # human-readable name
_gap: 3                                     # read-only formula (Target - Current)
_progress: 25                               # read-only formula (% complete)
notion_id: ...
_last_synced: ...
_notion_edited: ...
---
```

### Projects (`notion-mirror/projects/`)

```yaml
---
title: "Project name"                       # required, string
status: "In progress"                       # required, status — Not started | In progress | Done
lifecycle: "Active"                         # optional, select — Active | Archived
priority: "High"                            # optional, select
area:                                       # optional, multi_select array
  - Marketing
  - Engineering
horizon: "This Quarter"                     # optional, select
start_date: 2026-02-01                      # optional, date
goal_id: 24892219-bbb7-8164-...            # optional, relation ID (one)
goal: "Build Portfolio of Internet..."      # human-readable name
client_id: 31392219-bbb7-819e-...          # optional, relation ID (one)
client: "Client-A"                           # human-readable name
notion_id: ...
_last_synced: ...
_notion_edited: ...
---
```

### Brainstorm Session (`notion-mirror/brainstorms/`)

```yaml
---
title: "Idea name"                          # required, string
status: "New idea"                          # required, status — New idea | Old Idea | Exploring | Validated | Rejected
space:                                      # optional, multi_select array
  - SaaS
problem_category:                           # optional, multi_select array
  - Conversion
priority: "High"                            # optional, select
client_id: null                             # optional, relation ID (one)
client: null                                # human-readable name
project_id: 30d92219-bbb7-8140-...         # optional, relation ID (one)
project: "Experiments"                      # human-readable name
notion_id: ...
_last_synced: ...
_notion_edited: ...
---
```

### Clients (`notion-mirror/clients/`)

```yaml
---
title: "Company Name"                       # required, string
status: "Active"                            # required, select — Lead | Discovery | Active | Paused | Churned
risk_level: "Low"                           # optional, select — Low | Medium | High
engagement_type: "Retainer"                 # optional, select — Fractional CTO | Retainer | Project | Advisory | Pilot
engagement_posture: "Expansive"             # optional, select — Expansive | Cautious | Protective
rate: 150                                   # optional, number (EUR/hr)
area:                                       # optional, multi_select (Tech Stack tags)
  - Next.js
  - Slack
website: https://client-a.io                 # optional, url
time_tracking_url: https://docs.google...   # optional, url
notion_id: ...
_last_synced: ...
_notion_edited: ...
---

## Strategy Notes
Strategic thinking, concerns, boundaries in body.
```

### Contacts (`notion-mirror/contacts/`)

```yaml
---
title: "Full Name"                          # required, string
email: person@example.com                   # optional, email
role: "CEO, Uncharted"                      # optional, rich_text
phone: 415-867-6552                         # optional, phone_number
linkedin: https://linkedin.com/in/...       # optional, url
notes: "Background info..."                 # optional, rich_text
client_id: 31392219-bbb7-81a4-...          # optional, relation ID (one)
client: "Client-B"                        # human-readable name
notion_id: ...
_last_synced: ...
_notion_edited: ...
---
```

### Interactions (`notion-mirror/interactions/`)

```yaml
---
title: "Interaction description"            # required, string
type: "Meeting"                             # required, select — Email | Meeting | WhatsApp | Prep | Call | Note
date: 2026-02-13                            # required, date
direction: "Inbound"                        # required, select — Inbound | Outbound
client_id: 31392219-bbb7-81a4-...          # optional, relation ID (one)
client: "Client-B"                        # human-readable name
contacts_ids:                               # optional, relation IDs (many)
  - 31392219-bbb7-81d0-...
contacts:                                   # human-readable names (many)
  - Contact-4
action_items: "Follow up by Monday..."      # optional, rich_text
notion_id: ...
_last_synced: ...
_notion_edited: ...
---

Meeting notes, email content, etc. in body.
```

## 3. Creating New Items

### Filename Convention

Use kebab-case slug from title, **without** a notion_id suffix (the sync engine adds it after creation):

```
notion-mirror/tasks/deploy-staging-environment.md
notion-mirror/interactions/2026-03-04-meeting-discovery-call-client-a.md
```

### Required Fields

- **All databases**: `title` is always required.
- **Tasks**: `title`, `status` (default: `Not started`)
- **Personal Tasks**: `title`, `status`
- **Goals**: `title`, `status`
- **KPIs**: `title`, `lifecycle`, `unit`, `current_value`, `target_value`, `goal_id` + `goal`
- **Projects**: `title`, `status`
- **Brainstorms**: `title`, `status`
- **Clients**: `title`, `status`
- **Contacts**: `title`
- **Interactions**: `title`, `type`, `date`, `direction`

Do NOT set `notion_id`, `_last_synced`, or `_notion_edited` on new files.

### How Sync Handles New Files

1. Detects files without a `notion_id` in frontmatter
2. Sets `_sync_pending: true` as a guard against interruption
3. Creates the page in Notion via REST API
4. Writes `notion_id` back into the file's frontmatter
5. Renames the file to include the `{shortId}` suffix
6. Removes `_sync_pending` flag

### Example: Creating a New Task

Write this file to `notion-mirror/tasks/deploy-staging-environment.md`:

```yaml
---
title: Deploy staging environment
status: Not started
area:
  - Engineering
timeframe: This Week
energy: Deep Work
impact: Needle Mover
project_id: YOUR-PROJECT-ID-1
project: "Client-B — Fractional CTO Discovery"
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
goal: "Build Portfolio of Internet Companies"
---

Set up staging environment for Client-B platform.
```

Then run `push` (or wait for post-commit hook). The file will be renamed to something like `deploy-staging-environment-abc123456789.md` with `notion_id` written back.

### Example: Creating a New Interaction

```yaml
---
title: "Discovery call — Client-A phase 2"
type: Meeting
date: 2026-03-04
direction: Outbound
client_id: YOUR-CLIENT-ID-A
client: Client-A
contacts_ids:
  - YOUR-CONTACT-ID-1
contacts:
  - Contact-1
---

## Attendees
[Your Name], Contact-1

## Key Decisions
...
```

## 4. Querying Data (Grep/Glob Patterns)

### MCP to Local Equivalents

| Operation | Notion MCP | Local Equivalent |
|-----------|-----------|-----------------|
| Search by status | `notion-search` | `grep -r "^status: Done" notion-mirror/tasks/` |
| Fetch a page by ID | `notion-fetch` | `grep -rl "notion_id: <id>" notion-mirror/` then `Read` the file |
| Fetch a page by name | `notion-search` | `grep -rl "^title: Deploy" notion-mirror/tasks/` |
| Create a page | `notion-create-pages` | Write a new `.md` file (no `notion_id`), then `push` |
| Update properties | `notion-update-page` | Edit frontmatter fields in the `.md` file, then `push` |
| Append body content | `notion-update-page` (append) | Edit/append to the markdown body below frontmatter |
| Find by relation | `notion-search` + filter | `grep -rl 'project: "Client-B' notion-mirror/tasks/` |
| Query all active goals | `notion-search` | `grep -l "^lifecycle: Active" notion-mirror/goals/` |
| Delete/archive | `notion-update-page` (archive) | Delete the file, `push` will archive in Notion |

### Common Query Patterns

**Tasks by status:**
```bash
grep -rl "^status: Planned this week" notion-mirror/tasks/
grep -rl "^status: In progress" notion-mirror/tasks/
grep -rl "^status: Done This Week" notion-mirror/tasks/
```

**Tasks by timeframe:**
```bash
grep -rl "^timeframe: This Week" notion-mirror/tasks/
grep -rl "^timeframe: This Month" notion-mirror/tasks/
```

**Tasks by project:**
```bash
grep -rl 'project: "Client-B' notion-mirror/tasks/
grep -rl "project: Operations" notion-mirror/tasks/
```

**Tasks by energy type:**
```bash
grep -rl "^energy: Waiting On" notion-mirror/tasks/
grep -rl "^energy: Deep Work" notion-mirror/tasks/
```

**Tasks by impact:**
```bash
grep -rl "^impact: Needle Mover" notion-mirror/tasks/
```

**Active goals:**
```bash
grep -l "^lifecycle: Active" notion-mirror/goals/
```

**Active KPIs:**
```bash
grep -l "^lifecycle: Active" notion-mirror/kpis/
```

**KPIs for a specific goal:**
```bash
grep -l 'goal: "Secure Family Future"' notion-mirror/kpis/
```

**Interactions for a client:**
```bash
grep -rl 'client: "Client-B"' notion-mirror/interactions/
grep -rl "client: Client-A" notion-mirror/interactions/
```

**Interactions by type:**
```bash
grep -rl "^type: Meeting" notion-mirror/interactions/
grep -rl "^type: Email" notion-mirror/interactions/
```

**Contacts for a client:**
```bash
grep -l 'client: "Client-B"' notion-mirror/contacts/
```

**Active clients:**
```bash
grep -l "^status: Active" notion-mirror/clients/
```

**Find page by notion_id:**
```bash
grep -rl "notion_id: 30892219-bbb7-8185" notion-mirror/
```

**Cross-database search (any mention):**
```bash
grep -rl "Client-A" notion-mirror/
```

**Find tasks with no project:**
```bash
grep -l "^project: null" notion-mirror/tasks/
```

**Find tasks due this week:**
```bash
grep -l "^due_date: 2026-03-" notion-mirror/tasks/
```

### Using the Agent Tools

With Claude Code's built-in tools, prefer:

- **Grep tool** over shell `grep` (handles permissions, better output)
- **Glob tool** for listing files: `notion-mirror/tasks/*.md`
- **Read tool** to fetch full file content after finding the path

## 5. Relation Conventions

Relations are stored as paired fields: a human-readable name and a corresponding `_id` or `_ids` field.

### Cardinality: One (single relation)

```yaml
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
goal: "Build Portfolio of Internet Companies"

project_id: YOUR-PROJECT-ID-6
project: "Operations"

client_id: YOUR-CLIENT-ID-A
client: "Client-A"
```

### Cardinality: Many (multiple relations)

```yaml
contacts_ids:
  - YOUR-CONTACT-ID-4
  - YOUR-CONTACT-ID-5
contacts:
  - Contact-4
  - Contact-5
```

### When Creating New Files

**Always set both the `_id` and the human-readable name.** The sync engine uses `_id` fields for the Notion API call. If `_id` is missing, it falls back to name-based lookup in the page index (`.sync-state.json`), which may fail for newly created pages not yet indexed.

Setting `null` for both is valid when no relation exists:

```yaml
goal_id: null
goal: null
```

### Relation Target Databases

| YAML Key | Target Database | Used In |
|----------|----------------|---------|
| `goal` / `goal_id` | goals | tasks, kpis, projects |
| `project` / `project_id` | projects | tasks, brainstorms |
| `client` / `client_id` | clients | projects, brainstorms, contacts, interactions |
| `parent_task` / `parent_task_id` | tasks | tasks |
| `contacts` / `contacts_ids` | contacts | interactions (many) |

## 6. Sync CLI Reference

```bash
cd tools/notion-sync

# Pull all databases from Notion to local markdown
NOTION_TOKEN="..." npx tsx sync.ts pull

# Incremental pull (only pages changed since last sync)
NOTION_TOKEN="..." npx tsx sync.ts pull --incremental

# Dry run pull (show what would change without writing)
NOTION_TOKEN="..." npx tsx sync.ts pull --dry-run

# Push local changes to Notion
NOTION_TOKEN="..." npx tsx sync.ts push

# Push specific files only
NOTION_TOKEN="..." npx tsx sync.ts push --files tasks/my-task.md interactions/2026-03-04-meeting-foo.md

# Dry run push
NOTION_TOKEN="..." npx tsx sync.ts push --dry-run

# Rebuild .sync-state.json from local files
npx tsx sync.ts reconcile

# Rebuild and verify against Notion API
NOTION_TOKEN="..." npx tsx sync.ts reconcile --verify

# Show sync status and health
npx tsx sync.ts status
```

### Token Extraction

The Notion token is stored in `.mcp.json` (not as a plain env var). Extract it:

```bash
NOTION_TOKEN=$(python3 -c "import json; h=json.loads(json.load(open('.mcp.json'))['mcpServers']['notion']['env']['OPENAPI_MCP_HEADERS']); print(h['Authorization'].replace('Bearer ', ''))")
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error |
| 2 | Conflicts detected |

## 7. Sync Automation

### Post-Commit Hook

Located at `.git/hooks/post-commit`. Runs async (non-blocking) after every commit:

**Notion push** — pushes changed `notion-mirror/` files to Notion:
- Extracts token from `.mcp.json` (`_disabled_notion` key)
- Passes only changed files via `--files` for targeted push
- Skips commits starting with `[sync]` to prevent loops

**qmd re-embed** — re-indexes when `.md` files change in `clients/` or `notion-mirror/`:
- Runs `qmd update && qmd embed`
- Keeps semantic search current with latest docs and CRM data

Logs: `.sync-log/push.log`, `.sync-log/push-error.log`, `.sync-log/qmd.log`

### Launchd Polling

Pulls from Notion every 15 minutes, auto-commits and pushes changes.

```bash
# Install
cp tools/notion-sync/com.goaly.notion-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.goaly.notion-sync.plist
```

### Session Start

Run `git pull` at the start of each session to get the latest notion-mirror changes from remote.

### qmd Semantic Search

`notion-mirror/` is indexed by qmd for semantic search across all synced content. Use `qmd_query` for best results (hybrid search with re-ranking).

## 8. Troubleshooting

### Lock File Stuck

If a push was interrupted, the lock directory may remain:

```bash
rmdir notion-mirror/.sync.lock
```

The lock is a directory (created with `mkdirSync`), not a file.

### Sync State Missing or Corrupted

Rebuild from local files:

```bash
cd tools/notion-sync
npx tsx sync.ts reconcile
```

Add `--verify` to cross-check against Notion API (requires token).

### Sync Pending Flag

If a file has `_sync_pending: true` in frontmatter, the previous push was interrupted mid-creation. The page may or may not exist in Notion. Check Notion manually, then either:
- Remove `_sync_pending` and add the correct `notion_id` if the page was created
- Remove `_sync_pending` and leave no `notion_id` to retry creation on next push

### Conflict Resolution

When both local and Notion have changed since last sync:
- `local_wins` — local changes override Notion (logged as warning)
- `remote_wins` — Notion changes are preserved, local push is skipped (returns conflict exit code 2)

On `remote_wins`, run `pull` first to get the latest Notion state, resolve manually, then `push`.

### Token Expired

Notion integration tokens do not expire, but if the integration is disconnected from the workspace, all API calls will fail. Re-authorize at https://www.notion.so/my-integrations.

### Queued Files (.sync-pending)

If a push is already running when another triggers (e.g., rapid commits), files are queued to `.sync-pending`. The active push processes these after its main batch. If the active push crashes, manually re-run:

```bash
cd tools/notion-sync
NOTION_TOKEN="..." npx tsx sync.ts push
```

### Read-Only Fields

Fields prefixed with `_` are never pushed to Notion:
- `_raw_*` — unmapped Notion properties preserved during pull
- `_gap`, `_progress` — formula results (KPIs)
- `_last_synced`, `_notion_edited` — sync timestamps
- `_sync_pending` — creation guard flag

Editing these fields locally has no effect on Notion.
