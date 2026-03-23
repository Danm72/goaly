# /coaching-prep Smoke Test Checklist

Manual verification when the skill changes significantly.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/coaching-prep/test-computations.sh`
- [ ] Layer 2 eval baseline exists: `promptfoo eval -c tests/coaching-prep/promptfooconfig.yaml`

## KPI Collection

- [ ] All Active KPIs presented with Current / Target / Progress / Gap
- [ ] Archived KPIs (`lifecycle: Archived`) do NOT appear
- [ ] MRR is prompted as standing question every session
- [ ] `AskUserQuestion` used for KPI value collection (structured choices)
- [ ] Updated KPI values committed separately: `chore: update KPI values for coaching prep`

## Standing Items

- [ ] Standing items read from MEMORY.md at runtime (not hardcoded)
- [ ] "Coaching Prep — Standing Items" section found and extracted
- [ ] Each standing item presented as a checklist item

## Pattern Detection

- [ ] Unmeasured goals flagged (active goals with no KPIs linking to them)
- [ ] Stalled tasks flagged (In progress / Planned this week with `_notion_edited` > 14 days ago)
- [ ] Deprioritized items listed (confirm still parked)
- [ ] Initiation avoidance pattern identified across stalled items

## Search Order

- [ ] qmd query runs first for broad discovery
- [ ] Grep runs second for targeted frontmatter matching
- [ ] Granola MCP only used as fallback when local data insufficient

## Agenda Structure

- [ ] Progress Since Last Session (completed tasks, KPI movement)
- [ ] Current Focus & Blockers (in-progress, planned, stalled)
- [ ] Metrics Snapshot (table format)
- [ ] Standing Items (checklist from MEMORY.md)
- [ ] Patterns & Flags (unmeasured goals, initiation avoidance)
- [ ] Questions for [Coach]

## Handoff

- [ ] Closing message suggests `/review-meeting coaching` after the call
- [ ] Tables used for KPIs, tasks, flags (not prose paragraphs)

## Commit & Sync

- [ ] KPI updates committed separately from agenda changes
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced if present

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/coaching-prep/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/coaching-prep/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: no regression
