# /triage Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/triage/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/triage/promptfooconfig.yaml`

## Ignore List

- [ ] Revenue/ROS correspondence — not surfaced
- [ ] Google Workspace security alerts — not surfaced
- [ ] Coillte safety notices — not surfaced
- [ ] Vercel deployment notifications — not surfaced
- [ ] Xero/billing invoices — not surfaced
- [ ] Newsletters and promotional emails — not surfaced
- [ ] Automated notifications from services — not surfaced
- [ ] Framer — not surfaced

## Surface List

- [ ] Client replies shown (Client-C, prospects, partners)
- [ ] Meeting invites from real people flagged (especially unknown senders)
- [ ] Emails requiring a decision or response surfaced
- [ ] Action items from collaborators surfaced ([Coach] templates, etc.)

## Baseline Calendar Events Ignored

- [ ] Fitzwilliam events not surfaced
- [ ] Liffey Founders Club events not surfaced
- [ ] Dock Yard events not surfaced
- [ ] Give a Go events not surfaced
- [ ] Only `you@example.com` and family/personal calendar events shown

## Unknown Contacts Flagged

- [ ] Email sender not in `notion-mirror/contacts/` is flagged as `(unknown)`
- [ ] Known contacts (email match in contacts/) are NOT flagged
- [ ] Calendar attendees not in contacts are flagged

## Cross-Reference with Existing Tasks

- [ ] Actionable email checked against `notion-mirror/tasks/` before creating
- [ ] Existing coverage in `notion-mirror/interactions/` detected
- [ ] No duplicate tasks created for items already tracked
- [ ] Existing tasks updated (status changes) when email/calendar reveals new state

## Personal Tasks Directory Searched

- [ ] `notion-mirror/personal-tasks/` is included in triage scope
- [ ] Personal tasks with due dates are surfaced if relevant

## Search Order (qmd First, gog Second)

- [ ] qmd query runs first for email discovery
- [ ] gog gmail search only used for fresh/recent data not in local mirror
- [ ] Grep on `email-mirror/threads/` used as fallback if qmd returns nothing

## Handoff Suggestions

- [ ] Client email needing reply suggests `/client-email [Client]` with thread ID
- [ ] Meeting needing prep suggests `/meeting-prep [Client]` with meeting day/time
- [ ] Lead needing screening suggests `/screen-lead [Name]`
- [ ] Pre-filled context included in every handoff suggestion

## Commit & Sync Verification

- [ ] Changes committed with `chore: triage — [summary]` message
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced if present in `.sync-log/push-error.log`

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/triage/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/triage/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
