# /onboard-client Smoke Test Checklist

Manual verification when the skill changes significantly. Run through all items before committing SKILL.md changes.

## Pre-Requisites

- [ ] `git pull` completed (fresh notion-mirror data)
- [ ] Layer 1 tests pass: `bash tests/onboard-client/test-computations.sh`
- [ ] Layer 2 eval baseline exists (or run first): `promptfoo eval -c tests/onboard-client/promptfooconfig.yaml`

## Mode Detection

- [ ] Run `/onboard-client TestCo` — verify **FULL** mode activates (all steps 2-16)
- [ ] Run with **"create a contract for BigCorp"** — verify **CONTRACT** mode (skips steps 2-5, jumps to step 6)
- [ ] Run with **"draft proposal for SmallCo"** — verify **CONTRACT** mode triggers
- [ ] Contract-only mode verifies client exists before proceeding

## Client File Creation (FULL only)

- [ ] Client file created in `notion-mirror/clients/<slug>.md`
- [ ] Required fields present: `title`, `status` (default "Lead")
- [ ] Optional fields set when provided: `engagement_type`, `rate`, `area`
- [ ] Body has `## Context` and `## Strategy Notes` sections
- [ ] `AskUserQuestion` used to collect missing details (company name, engagement type, rate, tags)

## Contact File Creation (FULL only)

- [ ] Contact files created in `notion-mirror/contacts/<name-slug>.md`
- [ ] Each contact has `title` and `client` relation set
- [ ] `client_id` set when available, omitted (not null) when unavailable
- [ ] `AskUserQuestion` used for incomplete contact details (minimum: name + email)

## Two-Batch Commit Strategy

- [ ] **Batch 1** commits: client file, contact files, client folder (`clients/<slug>/README.md`)
- [ ] Batch 1 commit message: `feat: onboard new client — [Client Name]`
- [ ] `git push` runs after batch 1
- [ ] `.sync-log/push.log` checked after batch 1 — sync verified before proceeding
- [ ] If sync errors in `.sync-log/push-error.log`, skill **stops** and warns [Owner]
- [ ] **Batch 2** commits: project file, client file updates (`time_tracking_url`), `notion-reference.md`
- [ ] Batch 2 commit message: `feat: complete onboarding — [Client Name] project + time tracking + memory`

## Null Relation ID Validation

- [ ] `client_id` on project file set from client file's `notion_id` (written by sync after batch 1)
- [ ] If `notion_id` not yet available, `client_id` field is **omitted entirely** — never set to `null`
- [ ] All `_id` fields verified before writing files (behavioral rule 1)

## Time Tracking

- [ ] `gog sheets copy` called with template ID `1YtNW9KW0zteCcsN0pRAQQJan8UKZ2Oqv8jdy96Hj1fk`
- [ ] Sheet named "Time Tracking — [Client Name]"
- [ ] Dashboard title (A1) updated with client name
- [ ] Rate in config (L2) updated if different from [Your Rate]/hr
- [ ] Sheet URL saved in client file's `time_tracking_url` frontmatter
- [ ] If `gog sheets copy` fails, error message shown with template ID for manual creation

## MEMORY.md Active Leads Update

- [ ] Entry added to `## Active Leads` section in MEMORY.md
- [ ] Format matches: `- **[Name]** ([Contact]) — STATUS. [Terms]. [Rate]. Client: \`[id]\` | Contact: [Name] \`[id]\``
- [ ] `revenue-strategy.md` pipeline also updated if it exists

## Notion Reference Update

- [ ] `docs/claude/notion-reference.md` updated with new client ID in "Active Client IDs" table
- [ ] Project ID added to "Active Project IDs" table
- [ ] Contact IDs added to client's key contacts

## Contract Generation (when selected)

- [ ] `AskUserQuestion` presents contract options: Fractional CTO MSA / Web Dev MSA / Simple Agreement / Skip
- [ ] Selected template read from `clients/templates/`
- [ ] [Your Company] placeholders filled ([Company Registration Number], VAT [VAT Number], address, etc.)
- [ ] Client-specific placeholders filled (company, rate, scope, start date, contact)
- [ ] [Owner]'s signature pre-filled ([Your Name], Founder, date, `<!-- signature:[Your Name] -->`)
- [ ] Client signature blocks left blank (underscores)
- [ ] Strategy Notes inform contract review (Step 9 protective concerns):
  - Never volunteer investor/fundraising support
  - Never promise documentation/knowledge transfer as deliverable
  - Always include immediate termination clause
  - Keep scope high-level advisory
  - Check payment terms (upfront/weekly for startups, not net-30)
- [ ] Branded PDF generated via `/Users/dan/dev/tools/branded-pdf/`
- [ ] Markdown saved to `clients/<slug>/docs/legal/`
- [ ] PDF saved to `clients/<slug>/docs/legal/`
- [ ] `docs/legal/` created lazily (only when contract generated)
- [ ] If branded-pdf fails, markdown saved and [Owner] informed

## Commit & Sync Verification

- [ ] Both batches committed with conventional commit messages
- [ ] `git push` runs after each batch
- [ ] `.sync-log/push.log` checked after each commit
- [ ] Sync errors surfaced to [Owner] if present
- [ ] No orphan projects (project only committed after client sync verified)

## Regression Check

After SKILL.md changes:
- [ ] Run Layer 1: `bash tests/onboard-client/test-computations.sh` — all pass
- [ ] Run Layer 2: `promptfoo eval -c tests/onboard-client/promptfooconfig.yaml`
- [ ] Compare Layer 2 results to baseline: `promptfoo eval --compare` — no regression
