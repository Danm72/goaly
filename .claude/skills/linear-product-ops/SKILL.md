---
name: linear-product-ops
description: Use when creating, enriching, or auditing Linear issues and projects from meeting transcripts, product discussions, brainstorm outputs, or FigJam boards. Also use when asked to "create tickets", "enrich Linear", "audit the board", or "update projects from [source]".
---

# Linear Product Ops

Apply product intelligence to a Linear board — create issues, enrich existing ones, update projects, and audit for gaps. Enforces structured templates with PostHog tracking, cross-references, and deduplication.

## Before You Start

1. Read `config.json` — if missing or empty, ask the user for workspace details using AskUserQuestion
2. Read `gotchas.md` — failure modes to avoid

## Modes

### INGEST — "Create/enrich from [source]"

Parse source material (transcript, notes, brainstorm), categorize findings, deduplicate against existing board, then create and enrich.

**Pipeline:**
1. **Load source** — transcript chunks, meeting notes, brainstorm doc, or user's verbal input
2. **Categorize findings** into: new features, enrichments to existing issues, product principles, project-level updates, revenue/strategy insights
3. **Deduplicate** — For each potential new issue, search existing issues (`mcp__linear__list_issues` with query). Only create if no match.
4. **Create new issues** — Use the template in `references/issue-template.md`. Every issue MUST have a PostHog tracking plan.
5. **Enrich existing issues** — Use the pattern in `references/enrichment-guide.md`. ALWAYS read before writing. Append, never replace.
6. **Update projects** — Use `references/project-template.md` for description updates.
7. **Log** — Append to `data/run-log.jsonl`

**Quality gates:**
- [ ] Every new issue has all 6 template sections (What This Is, Intended UX, Outcomes, AC, Dependencies, PostHog)
- [ ] Every enrichment preserves existing description
- [ ] No duplicate issues created (searched first)
- [ ] Cross-references use `[TEAM-XX](url)` format
- [ ] PostHog events use `snake_case`, include properties, have a success target

### AUDIT — "Audit the board"

Review the board for quality gaps.

**Checks:**
1. Empty or thin descriptions (< 100 chars)
2. Issues missing PostHog tracking plans
3. Issues with no project assignment
4. Projects with no description or stale description
5. Duplicate issues (similar titles across projects)
6. Priority inconsistencies (High project with all Low issues)
7. Missing cross-references between related issues

**Output:** Table of findings with severity (Critical/Warning/Info) and suggested fixes. Ask user before applying fixes.

### UPDATE — "Update projects from [source]"

Batch-update project descriptions, priorities, statuses, or leads.

**Rules:**
- Read current project description before editing
- Preserve existing content — add sections, don't replace
- Update summaries (max 255 chars)
- Log changes

### MEASURE — "Check if we're hitting targets"

Query PostHog to validate that defined events are firing and success targets are being met. Closes the loop between "we defined this metric" and "here's what actually happened."

**Requires:** PostHog MCP server configured (see `references/posthog-setup.md`)

**Pipeline:**
1. **Load registry** — Read `references/posthog-event-registry.json`
2. **Check instrumentation** — For each `defined` event, query PostHog to see if it exists (`event-definitions-list`). Update status to `instrumented` if found.
3. **Query volumes** — For `instrumented` events, query 7-day volume (`query-run` with TrendsQuery). Flag events with zero volume.
4. **Run funnels** — For each defined funnel, run FunnelsQuery. Compare conversion rates against success targets.
5. **Report** — Present results as a table:

| Event | Issue | Status | 7-day Volume | Success Target | Actual | Met? |
|-------|-------|--------|-------------|----------------|--------|------|
| `job_board_index_viewed` | Client-B-68 | ✅ Verified | 1,240 | — | — | — |
| `job_card_clicked` | Client-B-68 | ✅ Verified | 520 | ≥ 40% of views | 42% | ✅ |
| `easy_apply_cta_clicked` | Client-B-82 | ❌ Not found | 0 | — | — | — |

6. **Update registry** — Set verified events to `verified`, update `last_measured` date
7. **Flag gaps** — Events defined in registry but not in PostHog = instrumentation gap. Events in PostHog but not in registry = untracked event.

**PostHog MCP tools used:**
- `event-definitions-list` — discover what events exist
- `query-run` with `TrendsQuery` — event volumes over time
- `query-run` with `FunnelsQuery` — multi-step conversion rates
- `query-run` with `HogQLQuery` — custom queries for specific success targets

## Parallel Execution

When creating or enriching multiple issues, batch independent operations into parallel agent calls. Group by project (each project's issues are independent of other projects).

## Templates

Issue and project templates are in `references/`. Read them when creating or auditing — they define the quality bar.

| Template | When to Read |
|----------|-------------|
| `references/issue-template.md` | Creating new issues or auditing issue quality |
| `references/epic-template.md` | Creating epic-level parent issues |
| `references/project-template.md` | Creating or updating project descriptions |
| `references/enrichment-guide.md` | Enriching existing issues |
| `references/posthog-setup.md` | Setting up PostHog MCP connection |
| `references/posthog-event-registry.json` | Central event registry (auto-maintained) |

## Cross-Referencing

- Always link related issues: `[TEAM-XX](https://linear.app/workspace/issue/TEAM-XX)`
- Note dependencies: "Depends on [TEAM-XX]" or "Blocked by [TEAM-XX]"
- Link to parent epic when creating sub-issues
- Use `relatedTo` parameter on `save_issue` for formal Linear relations

## Run Logging

After each operation, append to `data/run-log.jsonl`:

```jsonl
{"date":"2026-03-20","mode":"INGEST","source":"granola transcript","created":9,"enriched":24,"projects_updated":5,"audit_findings":3}
```

## Event Registry

The skill maintains a central PostHog event registry at `references/posthog-event-registry.json`. This is the single source of truth for all defined tracking events across the Linear board.

**When creating issues:** Check the registry for naming conflicts before defining new events. Add new events to the registry after issue creation.

**When measuring:** The registry is the input. MEASURE mode reads it, queries PostHog, and updates statuses.

**Event lifecycle:**
```
defined → instrumented → verified
   ↑          ↑              ↑
   │          │              │
 Created   Found in      Confirmed
 in Linear  PostHog      firing with
 issue     event defs    volume > 0
```
