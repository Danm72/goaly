# /mission Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/mission/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/mission/promptfooconfig.yaml`

## Mode Detection

- [ ] Run `/mission` on a **Monday** — verify MONDAY mode activates (full planning: scorecard, retro, energy budget, task ranking)
- [ ] Run `/mission` on a **weekday** — verify PULSE mode (scorecard + flags + today only, no task triage)
- [ ] Run `/mission` with **"coaching prep"** — verify COACHING mode (coaching agenda, standing items, no energy budget)
- [ ] Run `/mission` with **"prep for [Coach]"** — verify COACHING mode triggers

## Strategic Scorecard

- [ ] KPI traffic lights match actual `_progress` values in `notion-mirror/kpis/` files
- [ ] Stale KPIs are flagged with correct threshold (Weekly >10d, Monthly >35d, Quarterly >100d)
- [ ] Archived KPIs (`lifecycle: Archived`) do NOT appear in scorecard
- [ ] MRR is computed from MEMORY.md Active Leads, NOT from `rate` fields

## Pattern Detection

- [ ] Portfolio concentration shows all Active clients with revenue share percentages
- [ ] Concentration flag fires if any client > 50% of MRR
- [ ] Initiation avoidance flags tasks with `_notion_edited` > 14 days ago
- [ ] Killed mammoth flags Active clients with no interaction in 14+ days
- [ ] Frog tasks flags `Planned this week` / `Not started` tasks stuck > 14 days

## Auto-Cleanup (MONDAY only)

- [ ] `Done This Week` tasks automatically changed to `Done` in both `tasks/` and `personal-tasks/`
- [ ] Cleanup is committed **separately** from planning changes
- [ ] Count of archived tasks is reported

## Energy Budget (MONDAY only)

- [ ] Available slots computed from remaining weekdays minus meeting days
- [ ] Baseline calendar events are ignored
- [ ] Only `energy: Deep Work` tasks with `Planned this week` / `In progress` count as committed
- [ ] Recommendation shown (room for more / overcommitted)

## Last Week Retro (MONDAY only)

- [ ] Shipped tasks listed from Done This Week files
- [ ] Git shipping data scanned across repos
- [ ] Wasted tasks identified (planned but untouched)
- [ ] Meta-KPIs computed (Execution Score, High-Leverage Ratio, Deep Work Ratio)
- [ ] Spear sharpening check runs if shipped >= 3 but no KPI movement

## Coaching Layer (COACHING only)

- [ ] Standing items read from MEMORY.md at runtime (not hardcoded)
- [ ] Last coaching session found and action items extracted
- [ ] KPI velocity shown (movement since last session)
- [ ] MRR always prompted as standing question

## Commit & Sync

- [ ] Changes committed with context-aware message
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced if present

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/mission/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/mission/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
