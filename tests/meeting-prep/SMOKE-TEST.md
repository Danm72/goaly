# /meeting-prep Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/meeting-prep/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/meeting-prep/promptfooconfig.yaml`

## [Coach] Redirect

- [ ] Trigger "prep for [Coach]" stops immediately and suggests `/coaching-prep`
- [ ] Trigger "coaching prep" stops immediately and suggests `/coaching-prep`
- [ ] No agenda, questions, or positioning sections produced on redirect

## Normal Client Prep

- [ ] Trigger "prep for BigCorp meeting" produces a structured agenda
- [ ] Agenda contains all 5 sections: Context, What I Know Going In, Questions to Ask, My Positioning, Watch For
- [ ] Questions grouped by theme with bullet points
- [ ] Open tasks for client listed in a table (filtered by project)

## Calendar Baseline Filter

- [ ] Baseline calendar events ignored: Fitzwilliam, Liffey Founders Club, Dock Yard, Give a Go
- [ ] Real client meetings detected and used for prep context

## Prep Interaction File

- [ ] File created at `notion-mirror/interactions/YYYY-MM-DD-prep-<client-slug>.md`
- [ ] All handoff contract fields present: `title`, `type` (Prep), `date`, `direction` (Outbound), `client`, `client_id`
- [ ] `client_id` is not null (validated against clients/ or MEMORY.md)
- [ ] `date` is set to today's date

## Strategy Notes

- [ ] Client file's "## Strategy Notes" section read and used
- [ ] "My Positioning" section draws from Strategy Notes
- [ ] "Watch For" section draws from Strategy Notes
- [ ] Engagement posture and boundaries reflected in prep

## Previous Interactions

- [ ] Prior interactions found via `Grep "^client:.*ClientName" notion-mirror/interactions/`
- [ ] Filtered by type (Meeting/Prep)
- [ ] Sorted by date descending (most recent first)
- [ ] Up to 3 most recent read and summarized
- [ ] Outstanding action items from last meeting surfaced

## Open Tasks

- [ ] Tasks filtered by client's project name
- [ ] Active statuses shown: Waiting On, In progress, Planned this week, Not started
- [ ] Presented as a scannable table (not prose)

## Handoff to /review-meeting

- [ ] Agenda ends with: "run `/review-meeting [client]` after the call"
- [ ] Client name included in the handoff message

## qmd First for Granola Discovery

- [ ] `qmd query "[client] meeting decisions action items"` runs before targeted Grep
- [ ] Granola mirror searched via Grep as fallback
- [ ] Granola MCP NOT called (local data is sufficient for prep)

## Commit & Sync

- [ ] Prep file committed with message: `chore: meeting prep — [Client] [date]`
- [ ] `.sync-log/push.log` checked after commit
- [ ] Sync errors surfaced if present

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/meeting-prep/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/meeting-prep/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
