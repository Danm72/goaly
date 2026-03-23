# /review-meeting Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/review-meeting/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/review-meeting/promptfooconfig.yaml`

## Mode Detection

- [ ] Run `/review-meeting coaching` — verify Coaching mode activates (MEMORY + dan-profile updates, no follow-up email)
- [ ] Run `/review-meeting BigCorp` — verify Client mode activates (Strategy Notes loaded, follow-up email drafted)
- [ ] Run `/review-meeting [unknown name]` — verify `AskUserQuestion` fires listing active clients + "coaching" as options
- [ ] Trigger with both "coaching" AND client name — verify Coaching mode wins

## Prep Cross-Reference

- [ ] In Client mode, most recent `type: Prep` Interaction for that client is found
- [ ] Prep agenda questions compared against meeting transcript (covered vs skipped noted)
- [ ] Unanswered prep questions listed under "Carried Forward" in the Interaction body

## Null contacts_ids Validation

- [ ] `contacts_ids: null` NEVER appears in any created Interaction file
- [ ] When contacts are unknown, field is omitted or set to `[]`
- [ ] Existing fixtures with `contacts_ids: null` are detected as invalid (not copied as a pattern)

## MEMORY.md Updates (Coaching Mode Only)

- [ ] Standing items section in MEMORY.md read at runtime (not hardcoded)
- [ ] New standing items added from session action items
- [ ] Resolved standing items removed
- [ ] `dan-profile.md` updated if new coaching insights emerged (ADHD strategies, patterns, breakthroughs)

## Follow-Up Email (Client Mode Only)

- [ ] Email drafted inline (NOT handed off to `/client-email`)
- [ ] `clients/tone-of-voice.md` loaded before drafting
- [ ] Email addresses all commitments made during the meeting
- [ ] Email is in [Owner]'s voice — short, direct, no corporate buzzwords

## Task Deduplication Before Creation

- [ ] `qmd query` run for each action item before creating a task
- [ ] `Grep` run as fallback/complement for exact matches
- [ ] Existing task found → updated (status change, description append), not duplicated
- [ ] New task created only when no semantic or keyword match exists
- [ ] Every new task has both `goal`/`goal_id` AND `project`/`project_id` set

## Handoff to /triage

- [ ] Summary ends with suggestion to run `/triage` (not `/mission`)
- [ ] Handoff phrasing matches SKILL.md Step 9 output template

## Voice Guide Evolution

- [ ] After processing transcript, skill checks for new [Owner] expressions/metaphors
- [ ] If new patterns found, `clients/tone-of-voice.md` updated
- [ ] If no new patterns, no unnecessary edits made

## Commit & Sync

- [ ] All changes committed together with context-aware message
- [ ] Coaching: `chore: post-coaching review — [Coach] [date], [topic]`
- [ ] Client: `chore: post-meeting review — [client] [date]`
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced to [Owner] if present

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/review-meeting/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/review-meeting/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
