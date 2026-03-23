---
name: goaly-coaching-prep
description: "Use when preparing for coaching with [Coach], collecting KPIs, or building a coaching agenda. Triggers: 'prep for [Coach]', 'coaching prep', 'coaching agenda'."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

## Before You Start
1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

# /goaly-coaching-prep — Coaching Session Prep

Prepares a structured agenda for [Owner]'s bi-weekly coaching session with [Coach]. Collects KPI updates, reviews progress since last session, surfaces standing items, and flags patterns.

## Context

- Today: !`date +%Y-%m-%d`
- Day: !`date +%A`
- Uncommitted changes: !`git status --short notion-mirror/`

---

## STEP 1: Freshness Check

Run sync verification per `_shared/conventions.md`. If uncommitted `notion-mirror/` changes exist, warn [Owner] before proceeding.

---

## STEP 2: Parallel Data Collection

Collect ALL data in a single parallel phase. Launch every group simultaneously.

### Group A — qmd Semantic Queries

Run in parallel:
```
qmd query "[Coach] coaching action items commitments next steps"
qmd query "coaching progress goals KPIs blockers"
qmd query "deprioritized parked deferred coaching"
```

### Group B — Grep Frontmatter Queries

Run ALL in parallel:
```
Grep "^lifecycle: Active" notion-mirror/goals/
Grep "^lifecycle: Active" notion-mirror/kpis/
Grep "^lifecycle: Active" notion-mirror/projects/
Grep "^status: Done This Week" notion-mirror/tasks/
Grep "^status: In progress" notion-mirror/tasks/
Grep "^status: Planned this week" notion-mirror/tasks/
Grep "^status: Deprioritized" notion-mirror/tasks/
Grep "## Coaching Accountability" notion-mirror/tasks/
```

### Group C — File Reads

Run in parallel:
```
Read ~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md
Glob "granola-mirror/meetings/*coaching*" OR Glob "granola-mirror/meetings/*[coach]*"
```

### Group D — Read All Matched Files

After Groups B and C return, read ALL matched files in parallel:
- Every file from active goals, KPIs, projects
- Every file from done/in-progress/planned/deprioritized tasks
- Most recent Granola coaching transcript (if any)

For KPI files, extract: `current_value`, `target_value`, `_progress`, `_gap`, `unit`, `goal`.

### Fallback: Granola MCP

Only if qmd + local granola-mirror return no recent coaching sessions, use `query_granola_meetings` for "[Coach] coaching". If unavailable, proceed with local data and inform [Owner].

---

**Data collection complete. Steps 3-8 use collected data only — no new I/O except KPI file edits and git commands.**

---

## Coaching Accountability Surface

**Uses:** Grep results for "## Coaching Accountability" in `notion-mirror/tasks/`. No new I/O.

For each task with a "Coaching Accountability" section in its body:
1. Read the task file
2. Extract: title, status, sessions-committed count, dates committed, frog type, first micro-step
3. Calculate days since first commitment date

Present as table:

| Task | Status | Sessions | First Committed | Days Stalled | Frog Type |
|------|--------|----------|----------------|-------------|-----------|

**Rules:**
- Sort by sessions-committed DESC (most repeated commitments first)
- Flag any task committed 3+ sessions as "RECURRING STALL — discuss pattern, not just task"
- Include in [Coach] agenda as "Accountability Check" section
- If a task was completed since last coaching session, celebrate it: "FROG EATEN: [task]"

---

## STEP 3: Flag Unmeasured Goals & Deprioritized Items

1. **Unmeasured goals:** For each active goal, check if any active KPI has a matching `goal_id`. Flag goals with zero KPIs.
2. **Deprioritized items:** List deprioritized tasks (confirm still parked). Cross-reference with `qmd:deprioritized`.
3. **Stalled tasks:** From in-progress and planned tasks, flag any where `_notion_edited` > 14 days ago.

---

## STEP 4: Collect KPI Values

Use `AskUserQuestion` with structured choices for each Active KPI:

| KPI | Current | Target | Progress | Gap |
|-----|---------|--------|----------|-----|
| MRR | EUR X | EUR Y | Z% | EUR N |

MRR is a standing question every session (see gotchas.md).

---

## STEP 5: Update KPI Files

Edit each KPI file where [Owner] provided an updated value — change `current_value:` only. Do NOT touch read-only `_` fields.

Commit KPI updates separately:
```bash
git add notion-mirror/kpis/
git commit -m "chore: update KPI values for coaching prep" </dev/null 2>&1
```

---

## STEP 6: Standing Items

Extract "Coaching Prep -- Standing Items" from MEMORY.md (collected in Step 2). Present as checklist:

```
### Standing Items
- [ ] Current MRR: EUR X (confirmed in Step 4)
- [ ] [each standing item from MEMORY.md, verbatim]
```

Do NOT hardcode standing items — always read them fresh from MEMORY.md.

---

## STEP 7: Build Agenda

```
## Coaching Agenda — [Coach] ([date])

### Progress Since Last Session
- [completed tasks, KPIs that moved, KPIs that didn't]

### Current Focus & Blockers
- [In progress and Planned tasks, stalled tasks from Step 3]

### Metrics Snapshot
| KPI | Current | Target | Progress | Trend |
|-----|---------|--------|----------|-------|

### Accountability Check
- [from Coaching Accountability Surface — frog table, recurring stalls, frogs eaten]

### Standing Items
- [ ] [from Step 6]

### Patterns & Flags
- [unmeasured goals, initiation avoidance, deprioritized items]

### Questions for [Coach]
- [open threads from qmd:coaching-actions, unresolved items]
```

---

## STEP 8: Present & Close

Present the compiled prep to [Owner]. End with: "After the call, run `/goaly-review-meeting coaching` to process the transcript."

Commit remaining changes and verify sync per `_shared/conventions.md`. Check memory enrichment: coaching insights to `dan-profile.md`, pipeline changes to `revenue-strategy.md`, new standing items to `MEMORY.md`.

---

## Session Learning

When [Owner] corrects your output or expresses a preference during this session, immediately append it to the feedback log:

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data" && echo "$(date +%Y-%m-%d) <preference description>" >> "${CLAUDE_SKILL_DIR}/data/feedback.log"
```

Only log **general preferences** that apply to future sessions — skip task-specific corrections. Use judgment on detail: some preferences are one line, others need a sentence or two of context to be useful in future sessions.

---

## Error Handling

| Failure | Fallback |
|---------|----------|
| qmd returns zero results | Warn [Owner], suggest `qmd update && qmd embed`, fall back to Grep |
| Granola MCP unavailable | Proceed with local granola-mirror data only |
| No prior coaching interactions | Build agenda from KPI/task state only |

---

## Related Files

| Purpose | Path |
|---------|------|
| Skill gotchas | `gotchas.md` (this directory) |
| Shared conventions | `.claude/skills/_shared/conventions.md` |
| KPI files | `notion-mirror/kpis/` |
| Goal files | `notion-mirror/goals/` |
| Task files | `notion-mirror/tasks/` |
| Project files | `notion-mirror/projects/` |
| Meeting transcripts | `granola-mirror/meetings/` |
| MEMORY.md (standing items) | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| [Owner] profile | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/dan-profile.md` |
| Revenue strategy | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/revenue-strategy.md` |
| Sync log | `.sync-log/push.log` |
