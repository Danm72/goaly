---
name: goaly-onboard-client
description: "Use when onboarding a new client, creating contracts, or drafting proposals. Triggers: 'new client [name]', 'onboard [client]', 'create a contract for [client]', 'draft proposal for [client]'."
argument-hint: "[client name]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - AskUserQuestion
---

# /goaly-onboard-client — New Client Onboarding

## Before You Start
1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`
## Context
- Today: !`date +%Y-%m-%d (%A)`
- Uncommitted changes: !`git status --short notion-mirror/`

## STEP 1: Mode Detection

| Condition | Mode | Steps |
|-----------|------|-------|
| "create a contract" or "draft proposal" for existing client | Contract-only | Verify client in `notion-mirror/clients/`, load file, skip to Step 6 |
| "new client" or "onboard" | Full onboarding | All steps (2-15) |

## STEP 2: Create Client File

Use `templates/client-file-template.md`. Write to `notion-mirror/clients/<client-slug>.md`.

## STEP 3: Create Contact Files

For each known contact, write to `notion-mirror/contacts/<name-slug>.md` with frontmatter: `title`, `email`, `role`, `client`. Body: relationship notes. Use `AskUserQuestion` if incomplete — minimum need name and email.

## STEP 4: Create Client Folder

```bash
mkdir -p "clients/<client-slug>"
```

Use `templates/readme-template.md` for `clients/<client-slug>/README.md`.

## STEP 5: Commit Batch 1

```bash
# cd to project root
git add notion-mirror/clients/ notion-mirror/contacts/ clients/
git commit -m "feat: onboard new client — [Client Name]" </dev/null 2>&1
git push
```

Verify sync per _shared/conventions.md. If errors in `.sync-log/push-error.log`, warn [Owner] and **stop** — subsequent steps need `notion_id` from the sync engine.

## STEP 6: Contract Decision

Use `AskUserQuestion`:

| Option | Template |
|--------|----------|
| Fractional CTO MSA | `clients/templates/fractional-cto-msa.md` |
| Web Development MSA | `clients/templates/web-development-msa.md` |
| Simple Agreement | `clients/templates/service-agreement-draft.md` |
| No contract needed | Skip to Step 10 |

## STEP 7: Fill Contract Placeholders

Read selected template. Replace placeholders. [Your Company] details (service provider):

| Field | Value |
|-------|-------|
| Company | [Your Company] (Co. No. [Company Reg], VAT [VAT Number]) |
| Address | [Your Address] |
| Contact | [Your Name], Founder (you@example.com) |
| Entity | Private company limited by shares, laws of Ireland |
| Jurisdiction | Ireland / Dublin |

Also fill: client company details, rate, billing terms, scope, start date, notice contacts.

## STEP 8: Contract Review with [Owner]

Present filled contract. Flag protective concerns (from Strategy Notes):
- Never volunteer investor/fundraising support in SOW
- Never promise documentation/knowledge transfer as a deliverable
- Always include immediate termination clause (no notice, no fee)
- Keep scope high-level advisory, not specific deliverables
- Check payment terms — upfront or weekly for startups, not net-30

## STEP 9: Generate Branded PDF

```bash
cd [configure path for your setup]
AGREEMENT_TITLE="[title]" AGREEMENT_SUBTITLE="[subtitle]" \
CLIENT_NAME="[client name]" PROVIDER_NAME="[Your Company]" \
AGREEMENT_DATE="$(date +%Y-%m-%d)" \
npx tsx generate.ts "[input.md]" "[output.pdf]"
```

Pre-fill [Owner]'s signature (`<!-- signature:[Your Name] -->`), leave client blocks blank. Save to `clients/<client-slug>/docs/legal/`. If tool fails, save markdown and inform [Owner].

## STEP 10: Create Project File

Write to `notion-mirror/projects/<client-slug>-<engagement-type>.md`:

```yaml
---
title: "[Client Name] — [Engagement Description]"
status: Not started
lifecycle: Active
priority: High
area:
  - [relevant areas]
horizon: This Quarter
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
goal: "Build Portfolio of Internet Companies"
client: "[Client Name]"
---
```

Body: Definition of Done + Scope sections. Set `client_id` from the client file's `notion_id` (written back after Step 5). If not yet available, omit `client_id` and note for manual update.

## STEP 11: Set Up Time Tracking

```bash
gog sheets copy "1YtNW9KW0zteCcsN0pRAQQJan8UKZ2Oqv8jdy96Hj1fk" "Time Tracking — [Client Name]" --account you@example.com
```

Update Dashboard title (A1), rate in config (L2), save sheet URL in client file `time_tracking_url`. If copy fails, inform [Owner] with the template ID.

## STEP 12: Update MEMORY.md and Notion Reference

Edit `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` — add to "Active Leads":
```
- **[Client Name]** ([Contact]) — [STATUS]. [Terms]. [Rate]. Client: `[client_id]` | Contact: [Name] `[contact_id]`
```

Edit `docs/claude/notion-reference.md` — add to "Active Client IDs" and "Active Project IDs" tables. Also update `revenue-strategy.md` pipeline section if it exists.

## STEP 13: Commit Batch 2

```bash
# cd to project root
git add notion-mirror/projects/ notion-mirror/clients/ clients/ docs/claude/notion-reference.md
git commit -m "feat: complete onboarding — [Client Name] project + time tracking + memory" </dev/null 2>&1
git push
```

Verify sync per _shared/conventions.md. If errors, warn [Owner].

## Session Learning

When [Owner] corrects your output or expresses a preference during this session, immediately append it to the feedback log:

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data" && echo "$(date +%Y-%m-%d) <preference description>" >> "${CLAUDE_SKILL_DIR}/data/feedback.log"
```

Only log **general preferences** that apply to future sessions — skip task-specific corrections. Use judgment on detail: some preferences are one line, others need a sentence or two of context to be useful in future sessions.

## Error Handling

| Failure | Fallback |
|---------|----------|
| branded-pdf fails | Save markdown, [Owner] generates PDF manually |
| gog sheets copy fails | [Owner] creates from template `1YtNW9KW0zteCcsN0pRAQQJan8UKZ2Oqv8jdy96Hj1fk` |
| Sync fails batch 1 | Stop. Check `.sync-log/push-error.log`. Do NOT proceed. |
| Sync fails batch 2 | Warn [Owner]. Batch 1 CRM data is safe. |
| notion_id not written back | Omit `client_id` on Project, note for manual update |

## Related Files

| Purpose | Path |
|---------|------|
| Shared conventions | `.claude/skills/_shared/conventions.md` |
| Skill gotchas | `gotchas.md` |
| Client file template | `templates/client-file-template.md` |
| README template | `templates/readme-template.md` |
| Client files | `notion-mirror/clients/` |
| Contact files | `notion-mirror/contacts/` |
| Project files | `notion-mirror/projects/` |
| Contract templates | `clients/templates/` |
| Branded PDF tool | `branded-pdf tool (configure path in your setup)` |
| Tone of voice | `clients/tone-of-voice.md` |
| Notion reference | `docs/claude/notion-reference.md` |
| MEMORY.md | `~/.claude/projects/-Users-dan-Admin-Goals---Tasks/memory/MEMORY.md` |
