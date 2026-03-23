---
name: goaly-screen-lead
description: "Use when an inbound lead needs vetting before [Owner] engages. Deep research on profile, company, flags, fit assessment, and optional reply draft."
---

# Screen Lead

## Before You Start
1. Read `.claude/skills/_shared/conventions.md`
2. Read `gotchas.md` in this directory

### Context
- Today: !`date +%Y-%m-%d' ('%A')'`
- Uncommitted changes: !`git status --short notion-mirror/`

### Learned Preferences
!`tail -20 "${CLAUDE_SKILL_DIR}/data/feedback.log" 2>/dev/null || echo "No feedback yet — preferences will accumulate over sessions."`

## Trigger Phrases

- `/goaly-screen-lead` or `/goaly-screen-lead [name or email]`
- "screen this lead", "research this lead", "check this person out"
- "new lead from [source]"

## Input

Accept any combination of: Name, Email, Company name, Website URL, LinkedIn URL, raw lead form submission, or "check emails for [name]" (triggers Gmail search first).

## Quick Start

```
/goaly-screen-lead Contact-9, Tripadmit
/goaly-screen-lead contact1@example.com
/goaly-screen-lead "check emails for Contact-8"
```

## Process

```
GATHER → ANALYZE → ACT (optional, only after [Owner] confirms interest)
```

### Phase 1: GATHER

Collect all available information. Run these in PARALLEL where possible.

**1. Email search** (if email reference given):
```bash
gog gmail search '[name] newer_than:30d' --max 10 --account you@example.com --plain
```

**2. LinkedIn research** — Use `perplexity_search` or `web_search_exa`. Check: career history, title consistency across platforms, connections, time at company, skills.

**3. Company research** — Try `curl -s -H "Accept: text/markdown" [url]` first, fall back to `crawling_exa`. Check: what the business does (strip buzzwords), stage, revenue signals, funding, real content vs stock.

**4. Company registry** — UK: Companies House API. Ireland: CRO. US: State SOS / SEC EDGAR. Note if no verifiable entity found.

**5. Web presence** — Search "[name] [company]" via `perplexity_search` or `web_search_exa`. Find press, speaking, community involvement, social media (`sherlock "[name]"` if warranted), published content.

**6. Tech signals** — Visible stack (job postings, GitHub, BuiltWith). Flag proprietary/unknown platforms with no docs or community.

**7. How they found [Owner]** — Cross-reference language with [Owner]'s blog/site. Content-sourced leads are warm but may have inflated expectations.

### Phase 2: ANALYZE

Compile findings into a structured report. Present directly in chat:

```markdown
## [Name] — Lead Research Report

### Profile Summary
[2-3 sentences: who they are, career background, credibility level]

### Company Summary
[What it does, stage, revenue signals, team size, funding status]

### Green Flags
- [Specific budget, already running, phased approach, verifiable career,
  content-sourced, retainer mention, Clear problem, team in place]

### Red Flags
- [AI buzzword overload, vague/stock website, Title shifting,
  proprietary unknown tech, ASAP + ambitious scope,
  No budget mentioned, pre-revenue, decision-maker absent,
  wants free prototype, can't articulate without buzzwords,
  expects blockchain/crypto build]

### What They Actually Want
[Strip ALL buzzwords. 3-5 bullet points in plain language.]

### Fit for [Owner]
**Alignment:** [What matches [Owner]'s services]
**Concerns:** [Budget risk, scope risk, timeline risk, payment risk]
**Engagement model:** [fCTO retainer, web dev retainer, advisory, pass]
**Bottom line:** [1-2 sentence recommendation]

### Qualifying Questions
[3-5 key questions tailored to what's still unknown]
```

See `memory/lead-screening.md` for detailed red/green flag definitions and screening checklist.

### Phase 3: ACT (only when [Owner] confirms interest)

Do NOT proceed here until [Owner] says "interested" or explicitly asks.

**1. Create client files** — Write `notion-mirror/clients/[slug].md` and `notion-mirror/contacts/[name].md` with proper frontmatter. Check for duplicates first (see gotchas.md).

**2. Draft reply** — Read `clients/tone-of-voice.md` first. Rules:
- NEVER offer or suggest calls (never offer a call in any draft) — email only
- Angle toward retainers, not fixed-scope projects
- Be upfront about boundaries (what [Owner] doesn't do)
- Ask budget question directly: "Is that budget confirmed and ready to go?"
- First email qualifies, doesn't promise
- Present draft to [Owner] for review before sending

**3. Create Notion task** — In `notion-mirror/tasks/`:
- Project: Business Development (`YOUR-PROJECT-ID-4`)
- Goal: Build Portfolio of Internet Companies (`YOUR-PAGE-ID-PORTFOLIO-GOAL`)
- Area: Sales | Timeframe: This Week | Energy: Research | Impact: Supporting

**4. Update MEMORY.md** — Add new lead to Active Leads section.

## Session Learning

When [Owner] corrects your output or expresses a preference during this session, immediately append it to the feedback log:

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data" && echo "$(date +%Y-%m-%d) <preference description>" >> "${CLAUDE_SKILL_DIR}/data/feedback.log"
```

Only log **general preferences** that apply to future sessions — skip task-specific corrections. Use judgment on detail: some preferences are one line, others need a sentence or two of context to be useful in future sessions.

## Error Handling

| Scenario | Action |
|----------|--------|
| No LinkedIn found | Yellow flag, search alternate spellings |
| Company website down | Check Wayback Machine, note as flag |
| No company registry record | Flag unregistered entity, check alternate jurisdictions |
| Vague lead brief | List gaps, suggest qualifying questions |
| Warm intro lead | Note referrer and relationship — adjusts posture |
| No email in Gmail | Ask [Owner] for lead source, web research only |
| Multiple people with same name | Present options, ask [Owner] to confirm |

## Output

Present the structured report in chat. Then ask [Owner]:

1. **Interested** — Create client files, draft reply, create task, update MEMORY.md
2. **Maybe** — Create screening task with "This Month" timeframe
3. **Pass** — No action needed

## Related Files

| Purpose | Path |
|---------|------|
| Screening checklist & flags | `.claude-memory/lead-screening.md` |
| Tone of voice guide | `clients/tone-of-voice.md` |
| [Owner]'s profile & preferences | `.claude-memory/dan-profile.md` |
| Revenue strategy | `.claude-memory/revenue-strategy.md` |
| Research tools reference | `docs/claude/research-tools.md` |
| Notion reference data | `docs/claude/notion-reference.md` |
| Contract templates | `clients/templates/` |
