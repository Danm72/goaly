# Shared Conventions for Goaly Skills

These conventions apply to all goaly skills. Read this file at the start of every skill invocation.

## Process

- **Sync verification** — Run `git pull --rebase 2>/dev/null || true` before reading `notion-mirror/` data. Warn if local branch is behind remote or has uncommitted changes in `notion-mirror/`.
- **Commit-and-verify** — After committing `notion-mirror/` changes, check `.sync-log/push.log` with `tail -5`. If errors appear, warn [Owner] and suggest checking `.sync-log/push-error.log`. Fix sync errors before proceeding.
- **qmd-first search** — Always search local mirrors first (`qmd_query`, then `Grep`/`Glob` on `notion-mirror/`). Only use live APIs (Gmail MCP, Notion MCP, Granola MCP) when local search returns nothing relevant or data may be stale.
- **Tables-not-prose** — [Owner] has ADHD. Use scannable tables and bullet points, never prose paragraphs. Present choices as structured options (2-4) using AskUserQuestion, not open-ended questions.
- **Never offer calls** — Email only. Let others suggest calls. [Owner] hates calls and will never agree to one.
- **Related Files paths** — Use relative-from-project-root paths in Related Files tables (e.g., `notion-mirror/tasks/` not `notion-mirror/tasks/`).
- **Semantic dedup** — Before creating a task in `notion-mirror/tasks/`, grep for similar titles to avoid duplicates. Before creating an interaction, check for existing entries with same client + date + type.
- **Parallel collection** — When loading multiple independent data sources (qmd, Grep, Glob, MCP calls), use parallel tool calls. Group them as labeled batches (Group A, B, C) for clarity.
- **Freshness check** — At skill start, show `date +%Y-%m-%d %A` and any uncommitted changes in `notion-mirror/`. This gives Claude and [Owner] context on what's current.
- **Three-phase execution** — Collect all data first (parallel), then analyze, then interact with [Owner]. Don't interleave I/O with analysis.

## Data Integrity Gotchas

- **Null relation IDs** — Always set both `_id` and human-readable name fields together. Either both have values or both are null/omitted. Never write `contacts_ids: null` — use `[]` or omit the field entirely.
- **Baseline calendar** — Events from the `baseline` calendar (Fitzwilliam, Liffey Founders Club, Dock Yard, Give a Go, etc.) are NOT [Owner]'s events. Never surface these in planning, triage, or prep.
- **Pipe escaping** — `|` characters in Notion page content must be escaped as `\|` when writing to `notion-mirror/` files. Unescaped pipes break markdown table parsing during sync.
- **KPI formula fields** — `_gap` and `_progress` in KPI files are read-only formula results. Never set them in frontmatter — they are computed by Notion and overwritten on next pull.

## Institutional Learnings

- **FD inheritance hang** — The git post-commit hook runs async background processes. If a skill's commit step inherits file descriptors, it can hang waiting for the hook to finish. Mitigate by redirecting: `git commit -m "msg" </dev/null 2>&1` or running in a subshell.
- **Tag case drift** — Notion multi_select values are case-sensitive. "Accounting" ≠ "accounting" ≠ "acct". Always match existing Notion option casing exactly when setting multi_select values.
- **Notion API data wrapper** — When calling Notion MCP `update-page`, properties must be wrapped in `{ data: { ... } }`. Missing the wrapper causes silent failures.
- **Status type limitation** — Cannot add new `status` type options via Notion API. Use the `select` Lifecycle property instead for new statuses. Only existing status values work.
