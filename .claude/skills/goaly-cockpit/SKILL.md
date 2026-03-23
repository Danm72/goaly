---
name: goaly-cockpit
description: "Use when doing weekly planning (Mondays) or daily pulse checks. Two modes: MONDAY (full planning with retro + energy budget + task ranking), PULSE (weekday scorecard + flags). Triggers: '/cockpit', 'plan my week', 'weekly planning', 'quick check'."
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash (includes qmd CLI for semantic search)
  - AskUserQuestion
---

# /goaly-cockpit — Strategic Cockpit

## Before You Start
1. Read `.claude/skills/_shared/conventions.md` — shared process rules and data integrity gotchas
2. Read `gotchas.md` in this directory — cockpit-specific failure modes

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

### Context
- Today: !`date +%Y-%m-%d' ('%A')'`
- Uncommitted changes: !`git status --short notion-mirror/`

### Recent Runs
!`tail -5 "${CLAUDE_SKILL_DIR}/data/run-log.txt" 2>/dev/null || echo "No previous runs."`

Top-down strategic dashboard. KPIs first, patterns second, tasks last. Detects mode from day of week. Three-phase: collect data in parallel, analyze without I/O, interact with [Owner].

> **Coaching prep:** Use `/goaly-coaching-prep` for [Coach] sessions (not cockpit).

## STEP 0: Freshness Check

See `_shared/conventions.md` for sync verification and freshness check process.

## STEP 1: Context Detection

`day_of_week=$(date +%u)` — 1=Monday, 7=Sunday

| Mode | Condition | Steps |
|------|-----------|-------|
| **PULSE** | Weekday (default) | 0-5, Today |
| **MONDAY** | day_of_week == 1, or explicit planning trigger | All (0-10) |

Announce: `## Cockpit — [Mode] ([Day, Date])`

## STEP 2: Parallel Data Collection

**All I/O happens here.** Fire all three groups simultaneously. No analysis — just gather.

### Group A — qmd Semantic Discovery
- **A1:** `qmd query "KPI progress targets current value tracking"` (Step 4)
- **A2:** `qmd query "stalled tasks blocked waiting initiation avoidance"` (Step 5)
- **A3:** `qmd query "client follow-up dormant inactive no recent contact"` (Step 5)
- **A4 (MONDAY):** `qmd query "completed shipped done accomplished this week"` (Step 8)

### Group B — Grep + Read
Fire in parallel, then Read each matching file:
- **B1:** `Grep "^lifecycle: Active" notion-mirror/kpis/` (Step 4)
- **B2:** `Grep "^status: Active" notion-mirror/clients/` (Steps 5/6)
- **B3:** `Grep "^status: Done This Week" notion-mirror/tasks/` (Steps 3/8)
- **B4:** `Grep "^status: Done This Week" notion-mirror/personal-tasks/` (Step 3)
- **B5:** `Grep "^status: Planned this week" notion-mirror/tasks/` (Steps 5/8/9)
- **B6:** `Grep "^status: In progress" notion-mirror/tasks/` (Steps 5/9)
- **B7 (MONDAY):** `Grep "^status: Not started" notion-mirror/tasks/` (Step 9)
- **B8:** `Grep "^energy: Deep Work" notion-mirror/tasks/` (Step 7)
- **B9:** Per active client from B2: Grep interactions, extract latest date. ALSO run `gog gmail search 'from:CLIENT_EMAIL OR to:CLIENT_EMAIL newer_than:30d'` per client to catch unlogged email contact. Use the most recent date from either source. (Step 5)
- **B10:** `Grep "## Coaching Accountability" notion-mirror/tasks/` — finds all frog tasks with coaching tracking sections (Step 5/9)

### Group C — External Systems
- **C1:** `gog calendar events --all --account you@example.com --plain` (Steps 7/8)
- **C2:** `gog gmail search 'newer_than:7d' --max 30 --account you@example.com --plain` (MONDAY) or `'newer_than:2d' --max 20` (PULSE) — apply triage rules from MEMORY.md
- **C3 (MONDAY):** Git log scans across `Goals & Tasks`, `dev/client/`, `dev/frontend/` (7 days)

Also Read MEMORY.md for MRR computation and Active Leads.

## STEP 3: Auto-Cleanup (MONDAY only)

Using B3 + B4: edit each "Done This Week" task to `status: "Done"`. Commit: `chore: archive Done This Week tasks`. Report count.

## STEP 4: Strategic Scorecard (all modes)

**Uses:** A1, B1, B2, C1, MEMORY.md. No new I/O.

| KPI | Source | Method |
|-----|--------|--------|
| MRR | MEMORY.md Active Leads | Sum monthly estimates (NOT rate x hours). Ask [Owner] to confirm. |
| Revenue Sources | B2 clients | Count clients with `rate > 0` |
| Weekly Conversations | C1 calendar | Count distinct external meetings past 7 days. Exclude baseline calendar. |

**Traffic Light Table:** Light | KPI | Current | Target | Progress | Gap | Last Updated. Thresholds: Green >= 75%, Yellow 25-74%, Red < 25%. Staleness: Weekly >10d, Monthly >35d, Quarterly >100d.

**MONDAY:** AskUserQuestion for non-auto KPIs. Always ask for MRR confirmation.
**PULSE:** No prompts unless critically stale (2x overdue).

## STEP 5: Pattern Detection (all modes)

**Uses:** A2, A3, B1, B2, B5, B6, B7, B9, MEMORY.md. No new I/O.

| Check | Flag | Detection |
|-------|------|-----------|
| **Portfolio Concentration** | Any client > 50% MRR, or < 3 revenue sources | B2 + MEMORY.md |
| **KPI Staleness** | `_notion_edited` overdue vs tracking_frequency | B1 |
| **Initiation Avoidance** | `_notion_edited` > 14 days on active tasks | A2 + B5/B6 |
| **Killed Mammoth** | No interaction 14+ days, or accepted lead no follow-up | A3 + B9 + MEMORY.md |
| **Frog Tasks** | Planned/Not started, `_notion_edited` > 14 days | B5/B7, weeks = (today - edited) / 7 |
| **Frog Streak** | Coaching-tagged tasks still "Not started" with sessions-committed > 1 | B10 — count tasks with "Coaching Accountability" section + status "Not started". Show "X frog tasks stalled across Y coaching sessions" |

Present all flags together. If none: "No flags. Portfolio, KPIs, and pipeline all healthy."

**Today (PULSE only):** Show In progress tasks (B6) as table: Task | Project | Energy. Then actionable emails from C2.

## STEP 5b: Daily Frog (all modes)

**Uses:** B10. No new I/O.

Surface ONE frog task for today. Selection priority:
1. Highest sessions-committed count (most overdue coaching commitment)
2. If tied, oldest `_notion_edited` date (longest untouched)
3. If energy mismatch (Deep Work frog on a meeting-heavy day), pick next eligible

Present as:

```
🐸 TODAY'S FROG: [task title]
   Committed: [N] coaching sessions ([dates])
   Days stalled: [N]
   First step: [from "First micro-step" in task body]
```

**MONDAY only:** After task ranking (Step 9), prompt [Owner] to add calendar blocks for top 3 frogs this week using AskUserQuestion.

**PULSE only:** Check if yesterday's frog was eaten (status changed from "Not started" to anything else since last pulse). Track in run log as `frog_eaten=true|false`.

## STEP 6: Portfolio Concentration (all modes)

**Uses:** B2, MEMORY.md. Reuse Step 5 data — no re-reading.

Always show: Client | Status | Type | Est. Monthly | Share. Revenue from MEMORY.md Active Leads, not `rate` fields.

## STEP 7: Energy Budget (MONDAY only)

**Uses:** C1, B8, B5, B6.

1. Remaining weekdays (including today if Monday)
2. Meeting days from C1 (exclude baseline calendar)
3. Available Deep Work slots = (free days) x 2
4. Committed = Deep Work tasks in B5/B6
5. Remaining = Available - Committed

Output: table + recommendation ("Room for N more" or "Overcommitted by N").

## STEP 8: Last Week Retro (MONDAY only)

**Uses:** A4, B3, B5, C3, C1. No new I/O.

1. **Shipped:** B3 tasks (pre-cleanup) + C3 git logs. Present Repo | Commits | Category table. Flag untracked commits.
2. **Wasted:** B5 tasks with `_notion_edited` > 7 days (planned but untouched).
3. **Enjoyed:** AskUserQuestion — "Energized" / "Mixed" / "Low energy"
4. **Meta-KPIs + Spear Sharpening:** Read `references/meta-kpis.md` for formulas.

## STEP 9: Task Ranking (MONDAY only)

**Uses:** B5, B6, B7. No new I/O.

Candidates: all tasks with status Not started, Planned this week, or In progress. Read `references/scoring-rules.md` for scoring criteria.

Present: Rank | Task | Project | Impact | Energy | Score. Use AskUserQuestion multiSelect for [Owner]'s top 5 (pre-select by score). After confirmation: chosen → "Planned this week", non-chosen → "Not started".

## STEP 10: Commit (MONDAY only)

```bash
git add notion-mirror/
git commit -m "chore: cockpit monday — plan week of [date]" </dev/null 2>&1
git push
```

See `_shared/conventions.md` for commit-and-verify process.

## Behavioral Rules

1. **Top-down always.** Scorecard → patterns → tasks. Never start with tasks.
2. **Three-phase execution.** Collect (Step 2) → analyze (Steps 3-9) → interact. No I/O during analysis.
3. **Parallel I/O.** Groups A, B, C fire simultaneously. Calls within groups also parallel.
4. **Pulse is fast.** 2-3 minutes, zero interaction unless critically stale.
5. **Monday is interactive.** AskUserQuestion for energy, KPIs, task selection. Structured 2-4 options.
6. **Coaching is separate.** `/goaly-coaching-prep` for [Coach] sessions.
7. See `_shared/conventions.md` for: tables-not-prose, qmd-first search, commit-and-verify.

## Run Log

After presenting output, append a run log entry:
```bash
bash ".claude/skills/_shared/scripts/append-run-log.sh" "${CLAUDE_SKILL_DIR}" "mode=MONDAY|PULSE execution=<score> energy=<score> tasks_planned=<count> frog_eaten=<true|false> frog_streak=<count>"
```

## Session Learning

When [Owner] corrects your output or expresses a preference during this session, immediately append it to the feedback log:

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data" && echo "$(date +%Y-%m-%d) <preference description>" >> "${CLAUDE_SKILL_DIR}/data/feedback.log"
```

Only log **general preferences** that apply to future sessions — skip task-specific corrections. Use judgment on detail: some preferences are one line, others need a sentence or two of context to be useful in future sessions.

## Related Files

| Purpose | Path |
|---------|------|
| Cockpit gotchas | `gotchas.md` (this directory) |
| Impact scoring criteria | `references/scoring-rules.md` |
| Ephemeral KPI formulas | `references/meta-kpis.md` |
| Shared conventions | `.claude/skills/_shared/conventions.md` |
| KPI files | `notion-mirror/kpis/` |
| Task files | `notion-mirror/tasks/` |
| Client files | `notion-mirror/clients/` |
| Interaction files | `notion-mirror/interactions/` |
| MEMORY.md | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| Revenue strategy | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/revenue-strategy.md` |
| Sync log | `.sync-log/push.log` |
