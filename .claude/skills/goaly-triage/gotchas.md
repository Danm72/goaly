# Triage Gotchas

## Email Ignore Rules

Always ignore — never create tasks for:
- Revenue/ROS correspondence
- Google Workspace security alerts
- Coillte safety notices
- Vercel deployment notifications
- Xero/billing invoices
- Newsletters and promotional emails
- Automated service notifications
- Framer

## Email Surface Rules

Always surface — create tasks or flag:
- Client replies (active clients, prospects, partners)
- Meeting invites from real people (especially unknown senders)
- Emails requiring a decision or response
- Action items sent by collaborators

**Priority order:** Surface decisions-needed items first, FYIs last.

## Calendar Ignore

Events from the `baseline` calendar (Fitzwilliam, Liffey Founders Club, Dock Yard, Give a Go, etc.) are NOT [Owner]'s events. Never surface these. Only surface events from `you@example.com` and family/personal calendar.

## Task Creation

- Don't create tasks for emails that are just FYI — only actionable items needing a decision or response.
- Before creating any task, grep `notion-mirror/tasks/` for similar titles (semantic dedup). Avoid duplicates.
- Cross-reference with `OPEN_TASKS` (B5) before creating — the item may already be tracked.
- Every new task MUST have `project` + `project_id` and `goal` + `goal_id` relations set.

## Run Log

After presenting triage results, previous runs are available in `${CLAUDE_SKILL_DIR}/data/run-log.txt`. Check this to avoid resurfacing items already triaged today.
