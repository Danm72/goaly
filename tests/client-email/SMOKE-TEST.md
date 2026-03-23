# /client-email Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/client-email/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/client-email/promptfooconfig.yaml`

## Mode Detection

- [ ] Run `/client-email check emails from [client]` — verify **Read-only** mode (summary, no draft)
- [ ] Run `/client-email check WhatsApp from [client]` — verify **WhatsApp** mode (log interaction, manual send)
- [ ] Run `/client-email reply to [client]` — verify **Email reply** mode (loads thread, drafts response)
- [ ] Run `/client-email email [client] about X` — verify **Email draft** mode (drafts new email)
- [ ] Run `/client-email check slack with [client]` — verify **Slack** mode (read DMs, log interaction)

## Context Loading

- [ ] Tone of voice (`clients/tone-of-voice.md`) loaded before any draft
- [ ] Client file (`notion-mirror/clients/<slug>.md`) read for Strategy Notes
- [ ] Strategy Notes inform draft content — boundaries and exclusions honored
- [ ] Recent interactions found and sorted by date descending

## Draft Quality

- [ ] Draft uses [Owner]'s voice (contractions, short sentences, direct, Irish-inflected)
- [ ] NEVER offers or suggests calls — email only
- [ ] Retainer framing present when drafting for prospects
- [ ] Options presented rather than singular recommendations
- [ ] No corporate buzzwords (leverage, synergy, stakeholder alignment)

## Interaction File

- [ ] Interaction file created in `notion-mirror/interactions/` with correct filename format (`YYYY-MM-DD-type-slug.md`)
- [ ] Required fields present: `title`, `type`, `date`, `direction`
- [ ] `type` matches mode: Email for read/reply/draft, WhatsApp for WhatsApp mode
- [ ] `contacts_ids` is NEVER set to `null` — uses `[]` or omitted entirely
- [ ] `client_id` is NEVER set to `null` — omitted if unknown
- [ ] Client and Contact relations set correctly when available

## Read-Only Mode Specifics

- [ ] No unsolicited draft produced
- [ ] Action items surfaced from email content
- [ ] Inbound Interaction created with email content in body

## WhatsApp Mode Specifics

- [ ] Screenshots transcribed if provided
- [ ] Message presented for manual platform sending (not via gog)
- [ ] Interaction created with `type: WhatsApp`

## Slack Mode Specifics

- [ ] Run `/client-email check slack with [client]` — verify **Slack** mode detected
- [ ] Slack user/channel found via `slack_search_users` or MEMORY.md lookup
- [ ] Recent DM messages read via `slack_read_channel`
- [ ] Summary focuses on decisions, feedback, action items — not casual banter
- [ ] Interaction created with `type: Slack`
- [ ] Draft reply only produced if explicitly requested
- [ ] Cross-workspace clients noted (e.g., Client-E on client-e-corp.slack.com vs main workspace)

## Review Before Sending

- [ ] [Owner] reviews draft before sending (`AskUserQuestion` with Send/Edit/Scrap options)
- [ ] Never auto-sends without [Owner]'s approval

## Voice Guide Evolution

- [ ] After processing communication, check if [Owner] said something worth capturing
- [ ] If new pattern detected, `clients/tone-of-voice.md` updated

## Commit & Sync

- [ ] Changes committed with descriptive message: `chore: log [type] [direction], [client] — [summary]`
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced if present

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/client-email/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/client-email/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
