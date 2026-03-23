# Client Management

### Notion CRM Database Structure

All client data lives in three Notion databases, synced locally to `notion-mirror/`. Read and write the local markdown files — changes sync to Notion automatically on git commit.

#### Databases

| Database | Local Path | Data Source ID (internal — sync engine only) |
|----------|-----------|----------------------------------------------|
| Clients | `notion-mirror/clients/` | `collection://YOUR-CLIENTS-DATABASE-ID` |
| Contacts | `notion-mirror/contacts/` | `collection://YOUR-CONTACTS-DATABASE-ID` |
| Interactions | `notion-mirror/interactions/` | `collection://YOUR-INTERACTIONS-DATABASE-ID` |

#### Client Page Properties

| Property | Type | Frontmatter Key | Purpose |
|----------|------|-----------------|---------|
| Name | title | `title` | Company name |
| Status | select | `status` | Lead, Discovery, Active, Paused, Churned |
| Risk Level | select | `risk_level` | Low, Medium, High |
| Engagement Type | select | `engagement_type` | Fractional CTO, Retainer, Project, Advisory, Pilot |
| Engagement Posture | select | `engagement_posture` | Expansive, Cautious, Protective |
| Rate | number | `rate` | Hourly rate (EUR) |
| Area | multi_select | `area` | Tech stack / industry tags |
| Website | url | `website` | Company website |
| Time Tracking URL | url | `time_tracking_url` | Google Sheets link for this client |

**Client Page Body** contains two sections (use headings in the page content):
- **Context** — Company details, tech stack, platform info, engagement terms
- **Strategy Notes** — [Owner]'s private strategic thinking, red flags, engagement posture, what NOT to offer

#### Contact Page Properties

| Property | Type | Purpose |
|----------|------|---------|
| Name | title | Full name |
| Email | email | Primary email |
| Role | rich_text | Job title / role |
| Client | relation | Links to Clients database |
| Phone | phone_number | Optional |
| Notes | rich_text | Relationship notes |

#### Interaction Page Properties

| Property | Type | Purpose |
|----------|------|---------|
| Name | title | Short description (e.g., "Discovery call — Client-A") |
| Type | select | Email, Meeting, WhatsApp, Prep, Call, Note |
| Date | date | When it happened |
| Client | relation | Links to Clients database |
| Contact | relation | Links to Contacts database |
| Direction | select | Inbound, Outbound |

**Interaction Page Body** contains the actual content — email text, meeting notes, WhatsApp messages, prep agendas. Use headings to structure (Attendees, Decisions, Action Items, etc.).

#### Relationships

```
Clients (1) ──→ (many) Contacts
Clients (1) ──→ (many) Interactions
Contacts (1) ──→ (many) Interactions
Clients (1) ──→ (many) Projects (existing Projects database)
```

#### What Still [Partner]es on Disk

| Path | Purpose |
|------|---------|
| `clients/tone-of-voice.md` | [Owner]'s communication style guide |
| `clients/templates/` | Contract templates (MSA, service agreements) |
| `clients/[client]/README.md` | Index linking notion-mirror files + local docs |
| `clients/[client]/docs/` | Client-specific local documents (not synced to Notion) |

##### Local Docs Convention

Each client folder under `clients/` has a `README.md` index and a `docs/` directory for local documents. Subdirectories are created lazily — only when needed:

| Subdir | Purpose | Create When |
|--------|---------|-------------|
| `docs/legal/` | Contracts, amendments, signed PDFs | First contract drafted |
| `docs/research/` | Naming research, competitor analysis, tech reviews | First research doc |
| `docs/project/` | Scope docs, deployment guides, architecture | First project planning doc |
| `docs/` (flat) | Ad-hoc files, email attachments | Anytime |

Rules:
- No `.gitkeep` scaffolding — create subdirs only when a file needs them
- Flat files in `docs/` are fine for small engagements
- `README.md` is created at onboarding, updated when adding docs
- `clients/` is indexed by qmd for semantic search (`**/*.md` pattern)

Everything else (CRM properties, strategy notes, comms logs, meeting notes) lives in `notion-mirror/` and syncs to Notion on commit.

### Shared Resources (in `clients/`)

| File | Purpose |
|------|---------|
| `tone-of-voice.md` | [Owner]'s communication style — apply to ALL client-facing writing |
| `templates/fractional-cto-msa.md` | Full MSA for advisory/CTO engagements |
| `templates/web-development-msa.md` | Full MSA for web development projects |
| `templates/service-agreement-draft.md` | Simpler agreement for smaller engagements |
| `templates/meeting-notes-template.md` | Standard structure for call notes |

### Tone of Voice Rules

When drafting ANY client-facing communication (emails, proposals, status updates, contracts cover letters):
1. Read `clients/tone-of-voice.md` first
2. Write in [Owner]'s voice — conversational, direct, Irish-inflected
3. Avoid corporate buzzwords, overly formal language, or certainty when uncertainty exists
4. Use short sentences, contractions, and [Owner]'s characteristic expressions
5. Present options rather than singular recommendations
6. Always have [Owner] review before sending
7. **Evolve the guide continuously** — When new client interactions reveal new patterns, expressions, metaphors, or voice nuances, update `clients/tone-of-voice.md` to capture them

### Tone of Voice Evolution

The tone of voice guide is a living document. As more client communications, meeting transcripts, WhatsApp messages, and emails flow through this system, watch for:

- New signature phrases or expressions [Owner] uses repeatedly
- Metaphors that land well in specific contexts (discovery calls, technical assessments, negotiations)
- Adjustments to formality level for different client types
- Patterns in how [Owner] handles specific situations (pushback, pricing discussions, scope negotiations)
- Channel-specific voice differences (e.g., [Owner] may be more direct on WhatsApp than in email)

After processing any client communication, ask: "Did [Owner] say something here that should be captured in the voice guide?" If yes, update the relevant section of `clients/tone-of-voice.md`.

<!-- Document & Contract Creation workflow moved to /onboard-client skill -->

### Local File Conventions for Client Work

When creating entries for client work, write markdown files in `notion-mirror/`. Changes sync to Notion automatically on git commit.

#### Projects (`notion-mirror/projects/`)
- Create one Project file per client engagement
- Required frontmatter: title, status, area, horizon, lifecycle, priority, goal, client
- **Always link Goals** — via `goal:` field (human-readable name) + `goal_id:` (Notion page ID)
- **Always link Client** — via `client:` field
- Save the Project page ID in MEMORY.md and notion-reference.md

#### Tasks (`notion-mirror/tasks/`)
- Create task files for every action item from calls, emails, WhatsApp
- Required frontmatter: title, status, area, timeframe, energy, goal, project
- **Goal relation is mandatory** — every client task links to its parent Goal
- **Project relation is mandatory** — every client task links to its parent Project
- Use the body for context (who asked, what Interaction it came from)

#### YAML Frontmatter Property Mapping

| Field | YAML Format | Example |
|-------|------------|---------|
| Relations (goal, project, client) | Human-readable name | `goal: "Build Portfolio of Internet Companies"` |
| Relation IDs | Notion page ID for sync | `goal_id: "YOUR-PAGE-ID-PORTFOLIO-GOAL"` |
| Area (multi-select) | YAML list | `area:` followed by `- Sales` and `- Engineering` |
| Date | ISO date string | `due_date: 2026-02-16` |
| Status (tasks) | String | `status: "Not started"` |
| Status (projects) | String | `status: "In progress"` |
| Select properties | String | `energy: "Deep Work"` |

#### Active Client Files

| Client | Project File | Notion Page ID |
|--------|-------------|----------------|
| Client-B | `notion-mirror/projects/client-b-sports-fractional-cto-discovery.md` | `YOUR-PROJECT-ID-1` |

### Cross-Client Query Capabilities

With all client data in `notion-mirror/`, agents can query across the full client portfolio using Grep/Glob:

| Query | How | Use Case |
|-------|-----|----------|
| Neglected clients | `Grep "^date:" notion-mirror/interactions/` per client, check most recent date | Weekly planning — flag clients with no interaction in 14+ days |
| All interactions for a client | `Grep "^client:.*ClientName" notion-mirror/interactions/` | Pre-meeting prep, context loading |
| Pipeline overview | `Grep "^status:" notion-mirror/clients/` and group by value | Coaching prep, revenue strategy review |
| Recent activity across all clients | `Glob "notion-mirror/interactions/*.md"` sorted by modification time | Morning triage, "what happened this week" |
| Contact lookup | `Grep "^client:.*ClientName" notion-mirror/contacts/` or `Grep "name" notion-mirror/contacts/` | Before sending emails, drafting contracts |
| Communication frequency | `Grep "^type:.*Meeting" notion-mirror/interactions/` + filter by date and client in frontmatter | Spot over-engagement or under-engagement patterns |
| Open action items from meetings | `Grep "^type:.*Meeting" notion-mirror/interactions/` then search bodies for unchecked `- [ ]` items | Task extraction, follow-up audits |
| Client revenue snapshot | `Grep "^rate:\|^engagement_type:" notion-mirror/clients/` | MRR calculations, coaching prep metrics |

### Vocabulary Mapping

Maps [Owner]'s natural commands to actions. Entries marked with a skill name are handled by on-demand skills (`.claude/skills/`). Others use inline local file operations.

| [Owner] Says | Agent Does |
|----------|-----------|
| "Check on [client]" | Read `notion-mirror/clients/<slug>.md` + Grep last 5 interactions + Grep open tasks by project. For email checks, use `/client-email` skill. |
| "Log this email" | Use `/client-email` skill (creates Interaction file automatically) |
| "What did we discuss with [client]?" | Grep `"^client:.*ClientName"` + `"^type:.*Meeting"` in `notion-mirror/interactions/`, read matches sorted by date desc |
| "When did I last talk to [client]?" | Grep `"^client:.*ClientName"` in `notion-mirror/interactions/`, read most recent by date |
| "Who's at [client]?" | Grep `"^client:.*ClientName"` in `notion-mirror/contacts/` |
| "Add [name] as a contact for [client]" | Write `notion-mirror/contacts/<name>.md` with client relation in frontmatter |
| "Update [client] notes" | Edit `notion-mirror/clients/<slug>.md`, update Strategy Notes section in body |
| "How's my pipeline?" | Grep `"^status:"` in `notion-mirror/clients/`, group by status, summarize Active/Lead counts and MRR |
| "Any clients I'm neglecting?" | Grep interactions per client, flag any Active client with last interaction > 14 days ago. Also surfaced by `/mission` pattern detection. |
| "New client [name]" | Use `/onboard-client` skill |
| "Prep for [client] meeting" | Use `/meeting-prep` skill |
| "Review [client] call" | Use `/review-meeting` skill |
| "Email [client]" / "Reply to [client]" | Use `/client-email` skill |
| "Check what [client] sent on WhatsApp" | Use `/client-email` skill (WhatsApp mode) |
| "Screen this lead" | Use `/screen-lead` skill |
| "Prep for [Coach]" / "coaching prep" | Use `/coaching-prep` skill |
| "Invoice [client]" / "Bill [client] for [month]" | Use `/goaly-xero-invoice` skill |

### Local File Agent Patterns

Concrete examples for common CRM operations. All use local `notion-mirror/` files. Changes sync to Notion automatically on git commit via the post-commit hook.

#### Read a Client

```bash
Read notion-mirror/clients/client-a.md
```
Returns YAML frontmatter (properties) AND body (Context + Strategy Notes).

#### Create a New Client

Write `notion-mirror/clients/new-client-name.md`:

```yaml
---
title: "Client Name"
status: "Lead"
engagement_type: "Fractional CTO"
rate: 150
---

## Context

Company details, tech stack, engagement terms here...

## Strategy Notes

Strategic thinking, red flags, engagement posture here...
```

The sync engine assigns a `notion_id` on the next push. Leave it empty for new files.

#### Create a Contact

Write `notion-mirror/contacts/contact-name.md`:

```yaml
---
title: "Contact Name"
email: "email@example.com"
role: "CTO"
client: "Client Name"
client_id: "<client-notion-id>"
---

Relationship notes here...
```

#### Create an Interaction

Write `notion-mirror/interactions/discovery-call-client-a-2026-02-26.md`:

```yaml
---
title: "Discovery call — Client-A"
type: "Meeting"
date: 2026-02-26
direction: "Outbound"
client: "Client-A"
client_id: "YOUR-CLIENT-ID-A"
contacts:
  - Contact-1
contacts_ids:
  - YOUR-CONTACT-ID-1
---

## Attendees
- Contact-1 (Client-A)
- [Your Name]

## Key Decisions
...

## Action Items
- [ ] ...
```

#### Update Client Strategy Notes

Edit the body of `notion-mirror/clients/<client-slug>.md` — modify the `## Strategy Notes` section directly.

#### Query Interactions for a Client

```bash
Grep "^client:.*Client-A" notion-mirror/interactions/
```
Then Read matching files. Sort by `date:` frontmatter field for chronological view.

#### Update Client Status (e.g., Lead to Active)

Edit `notion-mirror/clients/<client-slug>.md` frontmatter:

```yaml
status: "Active"   # was "Lead"
```

#### Archive a Client (Churned)

Edit `notion-mirror/clients/<client-slug>.md` frontmatter:

```yaml
status: "Churned"   # was "Active"
```

Also update MEMORY.md to move from Active Leads to a Churned section.

### Branded PDF Generation

Tool location: `/Users/dan/dev/tools/branded-pdf/`

Generates dark-themed branded PDFs from markdown files. Used for service agreements, proposals, and other client-facing documents.

#### Usage

```bash
cd /Users/dan/dev/tools/branded-pdf
AGREEMENT_TITLE="[title]" \
AGREEMENT_SUBTITLE="[subtitle]" \
CLIENT_NAME="[client name]" \
PROVIDER_NAME="[Your Company]" \
AGREEMENT_DATE="[date]" \
npx tsx generate.ts "[input.md]" "[output.pdf]"
```

#### Features
- Dark theme matching dan-malone.com (bg #141414, green #22c55e primary)
- Cover page with favicon, title, party names, date
- Markdown rendering with tables, lists, blockquotes
- `<!-- pagebreak -->` markers in markdown split content across pages
- Inline code (backticks) renders as green highlighted text — use for reference numbers (VAT, company numbers, EINs)
- Page numbers and confidential footer on every page

#### Tips
- Always add `<!-- pagebreak -->` before signature blocks so they don't split across pages
- Use stacked (not side-by-side) signature layouts with `&nbsp;` spacers for breathing room
- Wrap reference numbers in backticks for visual highlighting
- The tool handles italic text (e.g., `_ab initio_`) — italic font styles are registered as fallbacks
- `<!-- signature:Name -->` markers render in [Owner]cingScript handwriting font — must be on its own line (not inline with "By:") for the parser to detect it as an HTML block. Put "By:" on one line, then the signature marker on the next line with blank lines around it
- Always pre-fill [Owner]'s signature on Service Provider blocks: name ([Your Name]), title (Founder), date, and `<!-- signature:[Your Name] -->` on the By: line
- Leave Client signature blocks blank (underscores) for the client to fill

#### [Your Company] Details (for MSA placeholders)

| Field | Value |
|-------|-------|
| Company | [Your Company] |
| Company No. | [Company Reg] |
| VAT | [VAT Number] |
| Address | [Your Address] |
| Jurisdiction | Ireland |
| Dispute Resolution | Dublin, Ireland |
| Contact | [Your Name], Founder |
| Email | you@example.com |
| Entity Type | Private company limited by shares, organized under the laws of Ireland |

### Reusable Assets from Other Projects

Tools and patterns from [Owner]'s other repos that can be leveraged for client work:

| Asset | Location | Use For |
|-------|----------|---------|
| Comprehensive voice guide | `/Users/dan/dev/ai/blog/docs/voice-guide.md` | Extended metaphor bank, emotional patterns, blog formatting |
| Lead flow system | `/Users/dan/dev/frontend/dan-malone.com/components/lead-flow/` | AI-powered lead qualification pattern |
| Branded PDF tool | `/Users/dan/dev/tools/branded-pdf/` | Dark-themed PDF generation from markdown (agreements, proposals) |
| PDF brief generator | `/Users/dan/dev/frontend/dan-malone.com/lib/pdf/generate-brief-pdf.ts` | Lead capture brief PDF generation |
| Email templates | `/Users/dan/dev/frontend/dan-malone.com/lib/emails/` | Auto-reply and notification patterns |
| Pricing data | `/Users/dan/dev/frontend/dan-malone.com/data/pricing.ts` | CTO: [Your Rate] or [Client MRR]-5K/month; Web dev retainers: €500-2,500/month |
| Brand config | `/Users/dan/dev/frontend/dan-malone.com/scripts/brand-config.json` | Dark navy #0a1628, orange/gold accents |
| Content pipeline skills | `/Users/dan/.claude/skills/content-pipeline/` | State-machine lifecycle pattern, composable skills, voice checks |
| 5-point voice check | Built into `/content-generate` skill | Formal language, contractions, buzzwords, passive voice, sentence length |
