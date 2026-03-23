---
name: goaly-review-meeting
description: "Use after any meeting to process transcripts, extract action items, and update tasks. Triggers: 'review notes from X', 'review [client] call', 'update tasks from meeting'."
argument-hint: "[client name or 'coaching']"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

# /goaly-review-meeting — Post-Meeting Review

## Before You Start
1. Read `.claude/skills/_shared/conventions.md` — shared process rules and data integrity gotchas
2. Read `gotchas.md` in this directory — review-meeting-specific failure modes

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

Processes meeting transcripts, creates Interaction files, extracts action items, updates tasks, and handles mode-specific follow-ups (coaching insights, client follow-up emails).

## Context

- Today: !`date +%Y-%m-%d`
- Day: !`date +%A`
- Uncommitted changes: !`git status --short notion-mirror/`

---

## STEP 1: Detect Meeting Type

Parse the trigger phrase and argument to determine mode.

| Condition | Mode | Additional Steps |
|-----------|------|-----------------|
| Trigger contains "[Coach]" or "coaching" | **Coaching** | Cross-ref prep Interaction, update MEMORY.md standing items, update dan-profile.md |
| Trigger contains known client name (match against `Glob "notion-mirror/clients/*.md"` filenames) | **Client** | Load client file + Strategy Notes, draft follow-up email |
| Both coaching AND client terms present | **Coaching** | Also load client file |
| No match | **--** | `AskUserQuestion` to clarify: list active clients + "coaching" as options |

---

## STEP 2: Parallel Context Collection

Launch all independent reads in a single parallel batch. These reads do NOT depend on each other.

**All modes:**

| Read | Purpose | Tool |
|------|---------|------|
| Transcript search (qmd) | Find the meeting transcript | `qmd query "[client/coaching] meeting transcript action items"` |
| Transcript search (granola-mirror) | Backup transcript source | `Grep "[client name or [Coach]]" granola-mirror/meetings/` |
| Existing tasks for project | Pre-load for deduplication in Step 5 | `Grep "project: \"[project name]\"" notion-mirror/tasks/` |
| Recent interactions | Context on last touchpoint | `Grep "client: \"[client name]\"" notion-mirror/interactions/` |

**Client mode — add to same batch:**

| Read | Purpose | Tool |
|------|---------|------|
| Client file | Context + Strategy Notes | `Read notion-mirror/clients/[client-slug].md` |
| Tone of voice | For follow-up email (Step 8) | `Read clients/tone-of-voice.md` |
| Client contacts | For Interaction frontmatter | `Grep "client: \"[client name]\"" notion-mirror/contacts/` |

**Coaching mode — add to same batch:**

| Read | Purpose | Tool |
|------|---------|------|
| MEMORY.md | Standing items to cross-ref | `Read ~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| [Owner] profile | Coaching insights section | `Read ~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/dan-profile.md` |
| Prep Interaction search | Find most recent coaching prep | `Grep "^type: Prep" notion-mirror/interactions/` |

---

## STEP 3: Process Transcript

Using the transcript found in Step 2:

- If qmd or granola-mirror returned a match, read the most recent matching file.
- If local data is insufficient or meeting is too recent for sync, use the Granola MCP 4-query parallel pattern (see `gotchas.md`):
  1. `query_granola_meetings` -- "[client] goals outcomes"
  2. `query_granola_meetings` -- "[client] deprioritized items"
  3. `query_granola_meetings` -- "[client] projects deliverables"
  4. `query_granola_meetings` -- "[client] action items next steps"
- If Granola MCP is also unavailable, `AskUserQuestion`: (a) Retry later, (b) Proceed with local data only, (c) Paste transcript manually

---

## STEP 4: Create Interaction File

Write a new Interaction file using the template in `templates/interaction-template.md`.

**Filename:** `notion-mirror/interactions/YYYY-MM-DD-meeting-[slug].md`

See the template for full YAML frontmatter and body structure. Key reminders:
- Never set `contacts_ids: null` -- omit or use `[]`
- Always set both `_id` and human-readable name fields together
- Do NOT set `notion_id`, `_last_synced`, or `_notion_edited`

---

## STEP 5: Extract & Deduplicate Action Items

Parse transcript for every commitment, next step, and decision. Extract ALL action items, not just ones with named owners.

**Semantic deduplication before task creation:**
1. `qmd query "[action item description]"` -- catches fuzzy matches
2. Cross-reference against existing tasks loaded in Step 2
3. Only run additional `Grep` if pre-loaded task list is insufficient

Classify each:
- **Existing task found** -- update it (Step 6)
- **No match** -- create new task (Step 6)
- **Duplicate of completed task** -- note as "re-opened" if scope changed

---

## STEP 6: Update & Create Tasks

**Update existing tasks:** Edit matching task files -- set completed work to `status: "Done This Week"`, update `timeframe:` if deadline shifted.

**Create new tasks** in `notion-mirror/tasks/` with full frontmatter (`title`, `status`, `area`, `timeframe`, `energy`, `impact`, `goal_id` + `goal`, `project_id` + `project`). Use Project Routing Guide and Impact Classification from CLAUDE.md. Add body context: source meeting, who requested, what Interaction it came from.

---

## STEP 7: Audit Relations

After creating all tasks, verify each new task file:
1. `goal` + `goal_id` both set (not null)
2. `project` + `project_id` both set (not null)
3. Flag any task missing either relation -- ask [Owner] which Goal/Project to assign

---

## STEP 8: Mode-Specific Extras

### Client Mode

- **Update client file** if new facts emerged (edit Context or Strategy Notes section)
- **Create new contacts** if new people were introduced
- **Draft follow-up email** using tone-of-voice.md -- short, direct, options-first. Present draft inline for [Owner]'s review. Do NOT hand off to `/goaly-client-email`.

### Coaching Mode

- **Cross-reference prep Interaction** (see `gotchas.md` -- prep-to-review handoff). Note which agenda questions were covered vs skipped under "Carried Forward."
- **Update MEMORY.md standing items** -- add new items, remove resolved ones, update existing with new context
- **Update dan-profile.md** if new coaching insights emerged (patterns, breakthroughs, ADHD strategies)

---

## STEP 9: Commit & Present

See `_shared/conventions.md` for commit-and-verify process. Commit message format:
- Coaching: `chore: post-coaching review -- [Coach] [date], [brief topic]`
- Client: `chore: post-meeting review -- [client] [date]`

Present summary as a table:

| Item | Detail |
|------|--------|
| Interaction created | [filename] |
| Tasks updated | [count] (list titles + status changes) |
| Tasks created | [count] (list titles with Project + Goal links) |
| Follow-up email | [Client mode] drafted inline above |
| Memory updated | [Coaching mode] what changed in MEMORY.md / dan-profile.md |

Suggest: Run `/goaly-triage` to catch anything that fell through the cracks.

---

## STEP 10: Voice Guide Evolution

After processing the transcript, check: "Did [Owner] say something here that should be captured in the voice guide?" Look for new signature phrases, metaphors, channel-specific voice differences, or patterns in handling specific situations. If yes, update `clients/tone-of-voice.md`.

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
| Granola MCP unavailable | `AskUserQuestion`: (a) retry later, (b) proceed with local granola-mirror data, (c) paste transcript manually |
| No prior interactions for client | Note gap to [Owner], rely on Client file Context + Strategy Notes only |
| qmd returns nothing | Fall back to Grep across `notion-mirror/tasks/` for deduplication. Warn about potentially stale index. |
| Sync errors after commit | Show error from `.sync-log/push-error.log`, suggest manual `push` retry |

---

## Related Files

| Purpose | Path |
|---------|------|
| Shared conventions | `.claude/skills/_shared/conventions.md` |
| Skill gotchas | `.claude/skills/goaly-review-meeting/gotchas.md` |
| Interaction template | `.claude/skills/goaly-review-meeting/templates/interaction-template.md` |
| Notion mirror dirs | `notion-mirror/tasks/`, `interactions/`, `clients/`, `contacts/` |
| Meeting transcripts | `granola-mirror/meetings/` |
| Tone of voice | `clients/tone-of-voice.md` |
| Notion sync reference | `docs/claude/notion-sync-reference.md` |
| Memory files | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/` (MEMORY.md, dan-profile.md) |
| Sync log | `.sync-log/push.log` |
