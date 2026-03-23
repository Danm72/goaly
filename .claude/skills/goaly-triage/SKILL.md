---
name: goaly-triage
description: "Use for morning triage, checking calendar and emails, or catching missed items. Triggers: 'check calendar and emails', 'anything I'm missing?', 'morning triage'."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

# /goaly-triage — Calendar & Email Triage

## Before You Start
1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

### Recent Triage
!`tail -5 "${CLAUDE_SKILL_DIR}/data/run-log.txt" 2>/dev/null || echo "No previous triage runs."`

Surface actionable items from calendar and email. Filter noise, cross-reference with existing tasks, create/update tasks for anything new. Present grouped by urgency with handoff suggestions.

- "check calendar and emails", "anything I'm missing?", "what else needs updating?", "morning triage"
---

## Context

- Today: !`date +%Y-%m-%d' ('%A')'`
- Uncommitted changes: !`git status --short notion-mirror/`

---

## STEP 1: Freshness Check

Run sync verification per shared conventions (git pull, warn on uncommitted notion-mirror changes).

---

## STEP 2: Parallel Data Collection

Fire ALL I/O in one burst. Three groups run simultaneously — no group waits for another.

### Group A — External Services (parallel)

| Call | Command | Stored As |
|------|---------|-----------|
| A1 | `gog calendar events --all --account you@example.com --plain` | `CALENDAR_DATA` |
| A2 | `gog gmail search 'newer_than:7d' --max 30 --account you@example.com --plain` | `EMAIL_LIST` |
| A3 | `qmd query "actionable emails this week"` | `QMD_EMAIL_HITS` |

After A2 returns, identify actionable thread IDs (applying ignore rules from `gotchas.md`). Then fetch each actionable thread in parallel:

| Call | Command | Stored As |
|------|---------|-----------|
| A4 (per thread) | `gog gmail thread get <id> --account you@example.com --plain` | `EMAIL_THREADS[id]` |

### Group B — Notion Mirror Grep (parallel)

| Call | Pattern | Path | Stored As |
|------|---------|------|-----------|
| B1 | `"^email:"` | `notion-mirror/contacts/` | `KNOWN_CONTACTS` |
| B2 | `"^status:"` | `notion-mirror/clients/` | `CLIENT_STATUSES` |
| B3 | `"^title:"` | `notion-mirror/tasks/` | `EXISTING_TASKS` |
| B4 | `"^client:"` | `notion-mirror/interactions/` | `RECENT_INTERACTIONS` |
| B5 | `"^status: Planned this week\|^status: In progress\|^status: Not started"` | `notion-mirror/tasks/` | `OPEN_TASKS` |
| B6 | `"^project:"` | `notion-mirror/tasks/` | `TASK_PROJECTS` |

### Group C — Local File Listings (parallel with B)

| Call | Pattern | Stored As |
|------|---------|-----------|
| C1 | `Glob "notion-mirror/interactions/*.md"` | `INTERACTION_FILES` |
| C2 | `Glob "email-mirror/threads/*.md"` | `LOCAL_EMAIL_FILES` |

### Error Handling

| Failure | Action |
|---------|--------|
| A1 (calendar) fails | Set `CALENDAR_DATA = null`, present error in results |
| A2 (gmail search) fails | Set `EMAIL_LIST = null`, present error in results |
| A3 (qmd) fails | Fall back to `Grep` on `email-mirror/threads/` using C2 |
| A4 (thread fetch) fails | Skip that thread, note in results |
| Any Group B call fails | Proceed with partial data, note gap |
| Both A1 and A2 fail | Present error, suggest manual check |

---

## STEP 3: Calendar Triage (uses CALENDAR_DATA + KNOWN_CONTACTS)

Filter baseline calendar events per `gotchas.md`. Only surface events from `you@example.com` and family/personal calendar.

### Unknown Contact Detection

For each attendee email in `CALENDAR_DATA`:
1. Check against `KNOWN_CONTACTS` (B1) — match email addresses
2. Flag unmatched: `(unknown) [name/email] — meeting [title] at [time]`

### Calendar Task Creation Rules

| Condition | Action |
|-----------|--------|
| Meeting with a new contact | Create Business Task (Sales, This Week, Deep Work) |
| Client follow-up accepted | Update existing Waiting On task to Planned this week |
| Recurring personal events | Do NOT create tasks unless [Owner] asks |

---

## STEP 4: Email Triage (uses EMAIL_LIST + EMAIL_THREADS + QMD_EMAIL_HITS)

Apply ignore/surface rules from `gotchas.md`.

1. Scan `EMAIL_LIST` (A2) — filter actionable threads
2. Read full thread content from `EMAIL_THREADS[id]` (A4) for each actionable thread
3. Cross-reference with `QMD_EMAIL_HITS` (A3) for additional context
4. If qmd failed, scan `LOCAL_EMAIL_FILES` (C2) with targeted Grep as fallback

---

## STEP 5: Cross-Reference with Existing Data (uses Group B data)

For each actionable item from Steps 3-4:
1. Match client names against `CLIENT_STATUSES` (B2)
2. Check existing coverage in `RECENT_INTERACTIONS` (B4) — read matching files from C1 if needed
3. Check existing tasks in `EXISTING_TASKS` (B3) and `OPEN_TASKS` (B5)
4. Check project assignments via `TASK_PROJECTS` (B6)

Flag items already tracked. Only create new tasks for untracked items.

---

## STEP 6: Create/Update Tasks

For actionable items not already tracked:
- Write new task files to `notion-mirror/tasks/` with ALL required frontmatter: `title`, `status`, `area`, `timeframe`, `energy`, `impact`, `goal` + `goal_id`, `project` + `project_id`
- Edit existing task files to update `status:` if emails/calendar reveal changes

After creating/updating, commit per shared conventions (commit, push, verify sync log).

---

## STEP 7: Present Results

Present actionable items grouped by urgency:

```
### Urgent (needs response today)
- [item] — [context]

### This Week
- [item] — [context]

### FYI (no action needed)
- [item] — [context]

### Tasks Created/Updated
- Created: [task title] → [file path]
- Updated: [task title] — status changed to [new status]
```

### Handoff Suggestions

Include pre-filled context:
- Client email needing reply: "Run `/goaly-client-email [Client]` — thread ID [id]"
- Meeting needing prep: "Run `/goaly-meeting-prep [Client]` — meeting [day] [time]"
- Lead needing screening: "Run `/goaly-screen-lead [Name]`"

---

## Behavioral Rules

1. **All I/O in Step 2.** Steps 3-7 analyze collected data only — no new external calls (exception: `Read` for files matched by Grep in Step 2).
2. **Never create tasks** for ignored email categories (see `gotchas.md`).
3. **AskUserQuestion** for ambiguous items (is this actionable? which project?).
4. **Parallel execution.** All Group A, B, and C calls fire simultaneously in Step 2.
5. **Handoff format.** Always include pre-filled context when suggesting follow-up skills.

---

## Run Log

After presenting triage results, append a run log entry:

```bash
bash .claude/skills/_shared/scripts/append-run-log.sh "${CLAUDE_SKILL_DIR}" "emails_surfaced=<n> emails_ignored=<n> calendar_events=<n> tasks_created=<n>"
```

---

## Session Learning

When [Owner] corrects your output or expresses a preference during this session, immediately append it to the feedback log:

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data" && echo "$(date +%Y-%m-%d) <preference description>" >> "${CLAUDE_SKILL_DIR}/data/feedback.log"
```

Only log **general preferences** that apply to future sessions — skip task-specific corrections. Use judgment on detail: some preferences are one line, others need a sentence or two of context to be useful in future sessions.

---

## Related Files

| Purpose | Path |
|---------|------|
| Triage gotchas | `gotchas.md` (this directory) |
| Cached email threads | `email-mirror/threads/` |
| Task files | `notion-mirror/tasks/` |
| Client files | `notion-mirror/clients/` |
| Contact files | `notion-mirror/contacts/` |
| Interaction files | `notion-mirror/interactions/` |
| MEMORY.md | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| Sync log | `.sync-log/push.log` |
