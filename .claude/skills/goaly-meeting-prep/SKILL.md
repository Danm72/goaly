---
name: goaly-meeting-prep
description: "Use when preparing for a client meeting or building a meeting agenda. NOT for coaching — use /goaly-coaching-prep for [Coach]. Triggers: 'prep for [client] meeting', 'agenda for [client]'."
argument-hint: "[client name or meeting title]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

# /goaly-meeting-prep — Client Meeting Prep

## Before You Start
1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

Build a structured meeting agenda from client history, open tasks, and prior interactions. Creates a Prep Interaction file in `notion-mirror/interactions/` that syncs to Notion on commit.

## Context

- Today: !`date +%Y-%m-%d (%A)`
- Uncommitted: !`git status --short notion-mirror/`

---

## STEP 1: [Coach] Redirect

If trigger contains "[Coach]", "coaching", or "coaching prep" — redirect to `/goaly-coaching-prep`. **Stop.**

---

## STEP 2: Resolve Client Slug

1. `Glob "notion-mirror/clients/*.md"` — find all client files
2. Match trigger argument against filenames (fuzzy/substring)
3. If no match, `AskUserQuestion` to confirm client name

Note `<client-slug>` and `<client-project-name>` for collection phase.

---

## STEP 3: Parallel Data Collection

Run ALL in a single parallel batch. No sequential dependencies.

### 3a. Freshness + Calendar (Bash — parallel)

Run sync verification per shared conventions. Then:

```bash
gog calendar events --all --account you@example.com --plain
```

### 3b. Client Context (Read)

```
Read notion-mirror/clients/<client-slug>.md
```

### 3c. Interaction History (Grep)

```
Grep "^client:.*ClientName" notion-mirror/interactions/
```

### 3d. Granola Transcripts (qmd + Grep — parallel)

```bash
qmd query "[client name] meeting decisions action items"
```
```
Grep "[client name]" granola-mirror/meetings/
```

### 3e. Open Tasks (Grep)

```
Grep "^project:.*ClientProject" notion-mirror/tasks/
```

### 3f. Read Matched Files

After parallel batch returns:

- **Interactions**: Filter by type (Meeting/Prep), sort by date desc. Read **5 most recent** (see `gotchas.md`).
- **Granola**: Read transcripts not already captured in interaction files.
- **Tasks**: Read all matching task files.

---

## STEP 4: Process Collected Data

All data is now local. No further I/O needed for analysis.

**Freshness** — If `gog` failed, `AskUserQuestion` for meeting details (who, when, topic). Filter baseline events per `gotchas.md`.

**Client Context** — Extract Context + Strategy Notes sections. Strategy Notes are mandatory (see `gotchas.md`).

**Previous Interactions** — Extract decisions, action items (completed vs outstanding), open questions. Check for unchecked `- [ ]` items per `gotchas.md`.

**Granola** — Review transcripts for context not in interaction files. If nothing found, skip.

**Open Tasks** — Filter active statuses, present as table:

| Task | Status | Energy | Due |
|------|--------|--------|-----|

---

## STEP 5: Create Prep Interaction File

Write to `notion-mirror/interactions/YYYY-MM-DD-prep-<client-slug>.md`:

```yaml
---
title: "Meeting prep — [Client Name]"
type: Prep
date: YYYY-MM-DD
direction: Outbound
client_id: <from client file>
client: "[Client Name]"
---
```

**Body sections:** Context, What I Know Going In, Questions to Ask (grouped by theme), My Positioning (from Strategy Notes), Watch For (red flags, scope creep, commitments to avoid).

**Validation** — Verify `client_id` not null, `date` is today, `type` is `Prep`. See `gotchas.md` for handoff contract requirements.

**Commit** — Per shared conventions (commit, push, verify sync log).

---

## STEP 6: Present to [Owner]

Show complete agenda. End with:

> After the call, run `/goaly-review-meeting [client]` to process the transcript.

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
| No prior interactions | Note gap, rely on Client file only |
| Granola unavailable | Proceed with qmd + Grep on `granola-mirror/` |
| gog calendar fails | `AskUserQuestion` for meeting details |
| Client file not found | `AskUserQuestion` to confirm name |
| Sync fails after commit | Warn [Owner], check `.sync-log/push-error.log` |

---

## Behavioral Rules

1. **Parallel collection first.** All I/O in Step 3. Steps 4-6 use only collected data.
2. **Strategy Notes inform positioning.** Never prep without reading them.
3. **No coaching.** Client meetings only. [Coach] uses `/goaly-coaching-prep`.

---

## Related Files

| Purpose | Path |
|---------|------|
| Meeting prep gotchas | `gotchas.md` (this directory) |
| Client files | `notion-mirror/clients/` |
| Interaction files | `notion-mirror/interactions/` |
| Task files | `notion-mirror/tasks/` |
| Granola transcripts | `granola-mirror/meetings/` |
| Tone of voice | `clients/tone-of-voice.md` |
| MEMORY.md | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| Sync log | `.sync-log/push.log` |
