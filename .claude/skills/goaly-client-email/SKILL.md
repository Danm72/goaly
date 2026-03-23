---
name: goaly-client-email
description: "Use when emailing clients, drafting responses, checking WhatsApp/Slack messages, or reviewing client emails. Triggers: 'email [client]', 'reply to [client]', 'check what [client] sent on WhatsApp', 'check slack with [client]', 'check emails from [client]'."
argument-hint: "[client name] [draft|check|reply]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
  - mcp__claude_ai_Slack__slack_search_channels
  - mcp__claude_ai_Slack__slack_read_channel
  - mcp__claude_ai_Slack__slack_search_public_and_private
  - mcp__claude_ai_Slack__slack_search_users
  - mcp__claude_ai_Slack__slack_send_message
  - mcp__claude_ai_Slack__slack_send_message_draft
  - mcp__claude_ai_Slack__slack_read_thread
---

# /goaly-client-email — Client Communication

Read, draft, and send client communications across email, WhatsApp, and Slack.

## Before You Start

1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

## Context

- Today: !`date +%Y-%m-%d' ('%A')'`
- Uncommitted changes: !`git status --short notion-mirror/`

---

## STEP 1: Mode Detection

| Condition | Mode | Behavior |
|-----------|------|----------|
| "check emails from [client]" (no "reply"/"draft") | **Read-only** | Search, summarize, create inbound Interaction. No draft. |
| Contains "WhatsApp" | **WhatsApp** | Log as Interaction. No send (manual platform). |
| Contains "Slack" or client has known Slack channel | **Slack** | Read DMs/channels, summarize, log. Draft reply if requested. |
| "reply to [client]" or has thread ID | **Email reply** | Full flow: draft, review, send via gog. |
| "email [client] about X" | **Email draft** | Full flow: draft, review, send via gog. |

Announce: `## Client Email — [Mode] — [Client Name] ([Date])`

---

## STEP 2: Read Incoming Content

| Mode | Action |
|------|--------|
| Read-only | Local first: `qmd query "[client] email"`, then `Grep "[client]" email-mirror/threads/`. If stale: `gog gmail search 'from:[email] newer_than:14d' --max 10 --account you@example.com --plain` |
| WhatsApp | Read screenshot path if provided. Transcribe content. |
| Slack | `slack_search_users` for user ID, then `slack_read_channel`. For known channels (Client-B `#client-b-development` = `C0AGAQ5B8FR`), read directly. Check MEMORY.md for stored Slack IDs. |
| Email reply | `gog gmail thread get <thread-id> --account you@example.com --plain` |
| Email draft | `gog gmail search 'from:[email] newer_than:14d' --max 5 --account you@example.com --plain` |

---

## STEP 3: Load Context (parallel)

Run these in parallel:

1. **Client file**: `Read notion-mirror/clients/<client-slug>.md` — extract Context + Strategy Notes sections
2. **Recent interactions**: `Grep "^client:.*[ClientName]" notion-mirror/interactions/` — read last 3-5 by date desc
3. **Tone of voice**: `Read clients/tone-of-voice.md` — apply [Owner]'s voice (conversational, direct, Irish-inflected)

Strategy Notes dictate tone, boundaries, and what to avoid committing to.

---

## STEP 4: Draft Response (Draft/Reply modes only)

Skip for Read-only. For WhatsApp/Slack, only draft if [Owner] explicitly asks.

Write in [Owner]'s voice, informed by Strategy Notes:
- Address all points raised in the incoming message
- Let Strategy Notes inform what NOT to offer
- Frame retainers early if relevant
- Present options rather than singular recommendations
- NEVER offer or suggest calls — see gotchas.md

---

## STEP 5: Present to [Owner] (Draft/Reply modes only)

Skip for Read-only. For WhatsApp/Slack, only present if draft was requested.

Use `AskUserQuestion`:

| Option | Description |
|--------|-------------|
| Send as-is | Send the draft immediately |
| Edit first | [Owner] will modify the draft |
| Scrap it | Start over with different approach |

---

## STEP 6: Create Interaction File

Write to `notion-mirror/interactions/YYYY-MM-DD-type-slug.md`:

```yaml
---
title: "Description — Client"
type: Email  # or WhatsApp, Slack
date: YYYY-MM-DD
direction: Inbound  # or Outbound
client_id: <client-notion-id>
client: "Client Name"
contacts_ids:
  - <contact-notion-id>
contacts:
  - Contact Name
---
```

| Mode | Interaction |
|------|-------------|
| Read-only | Inbound with email content |
| WhatsApp | Inbound with transcribed content and date headers |
| Slack | Inbound with key messages (decisions, action items, commitments) |
| Draft/Reply | Outbound with the sent draft |

---

## STEP 7: Create/Update Tasks

1. Check existing tasks: `Grep` across `notion-mirror/tasks/` for matching titles
2. Update existing: edit `status:` where emails reveal progress
3. Create new: all required frontmatter (`title`, `status`, `area`, `timeframe`, `energy`, `impact`, `goal` + `goal_id`, `project` + `project_id`)

---

## STEP 8: Send and Commit (Email modes only)

### Sending

```bash
# Reply to thread
gog gmail send --to [email] --subject "Re: [subject]" --from "you@example.com" --reply-to-message-id [message-id] --account you@example.com --plain --force

# New email
gog gmail send --to [email] --subject "[subject]" --from "you@example.com" --account you@example.com --plain --force
```

- WhatsApp: present message for manual sending
- Slack: `slack_send_message_draft` (requires approval) or present for manual sending

### Commit

Commit and verify per `_shared/conventions.md` (commit-and-verify convention).

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
| gog gmail send fails | Show draft for manual sending |
| Client file not found | AskUserQuestion: create new client or specify correct name |
| No recent interactions | Proceed with Client file context only |
| Contact not in notion-mirror | Note missing, create if [Owner] confirms |
| qmd returns nothing | Grep `email-mirror/threads/` and `notion-mirror/interactions/` |
| Slack user not found | Search name variations, check MEMORY.md for stored IDs |

---

## Behavioral Rules

1. **Always have [Owner] review before sending.** Never auto-send.
2. **Let Strategy Notes inform what NOT to offer.**
3. **Voice guide evolution.** After processing comms, check if [Owner] said something worth capturing in `clients/tone-of-voice.md`.

---

## Related Files

| Purpose | Path |
|---------|------|
| Skill gotchas | `.claude/skills/goaly-client-email/gotchas.md` |
| Client files | `notion-mirror/clients/` |
| Interaction files | `notion-mirror/interactions/` |
| Contact files | `notion-mirror/contacts/` |
| Tone of voice guide | `clients/tone-of-voice.md` |
| Cached email threads | `email-mirror/threads/` |
| Task files | `notion-mirror/tasks/` |
| MEMORY.md | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
| Sync log | `.sync-log/push.log` |
| Slack history (Client-B) | `clients/client-b-sports/slack-history.md` |
