=== notion-mirror/clients/big-client.md ===
---
title: BigCorp
status: Active
engagement_type: Fractional CTO
rate: 150
area:
  - Next.js
notion_id: test-client-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

## Strategy Notes
High-revenue client at €12K/month — should trigger concentration flag (>50% of MRR).

=== notion-mirror/clients/churned-client.md ===
---
title: OldCorp
status: Churned
engagement_type: Project
rate: 100
notion_id: test-client-003
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-01-15T10:00:00.000Z
---

## Strategy Notes
Churned client — should NOT appear in concentration calculations.

=== notion-mirror/clients/small-client.md ===
---
title: SmallCo
status: Active
engagement_type: Retainer
rate: 50
area:
  - React
notion_id: test-client-002
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

## Strategy Notes
Smaller engagement at ~[Client MRR]/month.

=== notion-mirror/contacts/test-contact-bigcorp.md ===
---
title: Jane Smith
email: jane@bigcorp.example.com
role: CTO
client: BigCorp
client_id: test-client-001
phone: 555-0101
notion_id: test-contact-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Contact for BigCorp. Used by review-meeting, meeting-prep, client-email for contact lookup.

=== notion-mirror/contacts/test-contact-smallco.md ===
---
title: Bob Johnson
email: bob@smallco.example.com
role: CEO
client: SmallCo
client_id: test-client-002
notion_id: test-contact-002
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Contact for SmallCo. Used by dormant client cross-reference.

=== notion-mirror/goals/active-goal.md ===
---
title: Build Portfolio of Internet Companies
status: In progress
lifecycle: Active
priority: High
area:
  - Product
  - Finance
horizon: Multi-Year
notion_id: test-goal-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Primary goal — should appear in cockpit scorecard.

=== notion-mirror/goals/archived-goal.md ===
---
title: Launch Game Project
status: Not started
lifecycle: Archived
priority: Low
horizon: Someday
notion_id: test-goal-002
_last_synced: 2026-01-15T10:00:00.000Z
_notion_edited: 2026-01-15T10:00:00.000Z
---

Deprioritized goal — should NOT appear in cockpit.

=== notion-mirror/goals/unmeasured-goal.md ===
---
title: Build Content & Distribution Audience
status: In progress
lifecycle: Active
priority: High
area:
  - Marketing
horizon: This Year
notion_id: test-goal-003
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Active goal with NO KPIs linking to its goal_id. Should be flagged as unmeasured.

=== notion-mirror/interactions/2026-02-20-meeting-old.md ===
---
title: Initial call — SmallCo
type: Meeting
date: 2026-02-20
direction: Outbound
client: SmallCo
client_id: test-client-002
contacts:
  - Test Contact 2
contacts_ids:
  - test-contact-002
notion_id: test-interaction-002
_last_synced: 2026-02-20T10:00:00.000Z
_notion_edited: 2026-02-20T10:00:00.000Z
---

Old meeting — SmallCo should be flagged as dormant (>14 days since last contact).

=== notion-mirror/interactions/2026-03-08-meeting-recent.md ===
---
title: Weekly sync — BigCorp
type: Meeting
date: 2026-03-08
direction: Outbound
client: BigCorp
client_id: test-client-001
contacts:
  - Test Contact
contacts_ids:
  - test-contact-001
notion_id: test-interaction-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-08T15:00:00.000Z
---

Recent meeting — BigCorp should NOT be flagged as dormant.

=== notion-mirror/interactions/2026-03-12-prep-bigcorp.md ===
---
title: Meeting prep — BigCorp
type: Prep
date: 2026-03-12
direction: Outbound
client_id: test-client-001
client: BigCorp
contacts_ids:
  - test-contact-001
contacts:
  - Jane Smith
notion_id: test-interaction-003
_last_synced: 2026-03-12T10:00:00.000Z
_notion_edited: 2026-03-12T10:00:00.000Z
---

## Questions to Ask

### Technical Progress
- How is the API migration going?
- Any blockers on the frontend refactor?

## My Positioning

Push for expanding scope to include monitoring.

## Watch For

- Scope creep on documentation requests
- Budget concerns about Q2 planning

Test fixture — Prep Interaction for meeting-prep handoff contract and review-meeting cross-reference.

=== notion-mirror/interactions/2026-03-14-slack-feedback-on-proposal-bigcorp.md ===
---
title: "Slack DM — feedback on Q2 proposal"
type: "Slack"
date: 2026-03-14
direction: "Inbound"
client_id: "fake-bigcorp-client-id"
client: "BigCorp"
contacts_ids:
  - "fake-bigcorp-contact-id"
contacts:
  - "Jane Smith"
action_items: "Reply to feedback; Schedule follow-up; Update proposal"
---

## Channel
Slack DM (bigcorp.slack.com)

## Key Messages

**Jane Smith (Mar 14, 10:30):**
- Reviewed Q2 proposal — "looks solid, well thought through"
- Wants to adjust the timeline from 8 weeks to 6
- Asked about adding AI integration to Phase 2
- Will share internal stakeholder feedback by Friday

## Pending Actions
- [ ] Reply acknowledging feedback
- [ ] Revise timeline in proposal
- [ ] Research AI integration options for Phase 2

=== notion-mirror/interactions/bad-null-contacts.md ===
---
title: Follow-up email — BigCorp
type: Email
date: 2026-03-11
direction: Outbound
client_id: test-client-001
client: BigCorp
contacts_ids: null
contacts: null
notion_id: test-interaction-004
_last_synced: 2026-03-11T10:00:00.000Z
_notion_edited: 2026-03-11T10:00:00.000Z
---

Test fixture — INVALID pattern: contacts_ids set to null. Should be detected as invalid by review-meeting and client-email null validation tests.

=== notion-mirror/kpis/conversations-archived.md ===
---
title: Weekly External Conversations
lifecycle: Archived
unit: Count
current_value: 3
target_value: 3
_progress: 100
_gap: 0
tracking_frequency: Weekly
goal_id: YOUR-PAGE-ID-GOAL-2
goal: Protect Energy & Focus
notion_id: test-kpi-004
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test KPI — archived, should NOT appear in scorecard

=== notion-mirror/kpis/mrr-green.md ===
---
title: Monthly Recurring Revenue
lifecycle: Active
unit: EUR
current_value: 9600
target_value: 12000
_progress: 80
_gap: 2400
confidence: Realistic
tracking_frequency: Monthly
horizon: This Quarter
area:
  - Finance
deadline: 2026-06-30
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
goal: Build Portfolio of Internet Companies
notion_id: test-kpi-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-08T14:30:00.000Z
---

Test KPI — green threshold (>=75%)

=== notion-mirror/kpis/saas-red.md ===
---
title: SaaS Products with Paying Users
lifecycle: Active
unit: Count
current_value: 0
target_value: 1
_progress: 0
_gap: 1
confidence: Realistic
tracking_frequency: Weekly
horizon: This Quarter
area:
  - Product
deadline: 2026-06-30
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
goal: Build Portfolio of Internet Companies
notion_id: test-kpi-003
_last_synced: 2026-02-18T10:00:00.000Z
_notion_edited: 2026-02-18T10:00:00.000Z
---

Test KPI — red threshold (<25%) AND stale (weekly tracking, >10 days since edit)

=== notion-mirror/kpis/subscribers-yellow.md ===
---
title: Email Subscribers
lifecycle: Active
unit: Count
current_value: 250
target_value: 500
_progress: 50
_gap: 250
confidence: Stretch
tracking_frequency: Monthly
horizon: This Quarter
area:
  - Marketing
deadline: 2026-06-30
goal_id: YOUR-PAGE-ID-CONTENT-GOAL
goal: Build Content & Distribution Audience
notion_id: test-kpi-002
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-05T09:00:00.000Z
---

Test KPI — yellow threshold (25-74%)

=== notion-mirror/personal-tasks/personal-errand.md ===
---
title: Renew passport
status: Not started
priority: Medium
area:
  - Admin
timeframe: This Month
energy: Errand
notion_id: test-ptask-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Personal task for triage personal-tasks coverage.

=== notion-mirror/projects/project-with-null-client.md ===
---
title: Internal Tooling
status: Not started
lifecycle: Active
priority: Medium
area:
  - Engineering
horizon: This Quarter
goal_id: test-goal-001
goal: Build Portfolio of Internet Companies
client_id: null
client: null
notion_id: test-project-002
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — INVALID pattern: client_id set to null. Should be detected by onboard-client null relation validation.

=== notion-mirror/projects/project-without-client-field.md ===
---
title: Operations Overhead
status: In progress
lifecycle: Active
priority: Low
area:
  - Operations
horizon: This Quarter
goal_id: test-goal-001
goal: Build Portfolio of Internet Companies
notion_id: test-project-003
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Valid pattern: client_id field omitted entirely (not null). Acceptable for non-client projects.

=== notion-mirror/projects/test-project.md ===
---
title: BigCorp — Fractional CTO Discovery
status: In progress
lifecycle: Active
priority: High
area:
  - Engineering
horizon: This Quarter
goal_id: test-goal-001
goal: Build Portfolio of Internet Companies
client_id: test-client-001
client: BigCorp
notion_id: test-project-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Test fixture — Valid project with all required fields.

=== notion-mirror/tasks/active-deep-work.md ===
---
title: Build API integration for Client-E
status: Planned this week
area:
  - Engineering
energy: Deep Work
impact: Needle Mover
project: Client-E
project_id: YOUR-PAGE-ID-TASK-1
goal: Build Portfolio of Internet Companies
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
notion_id: test-task-004
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Active deep work task — counts toward energy budget.

=== notion-mirror/tasks/deprioritized-task.md ===
---
title: Research competitor platforms
status: Deprioritized
area:
  - Product
energy: Research
impact: Supporting
project: Experiments
project_id: YOUR-PROJECT-ID-7
goal: Build Portfolio of Internet Companies
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
notion_id: test-task-006
_last_synced: 2026-02-10T10:00:00.000Z
_notion_edited: 2026-02-10T10:00:00.000Z
---

Test fixture — Deprioritized task. Should appear in coaching-prep deprioritized items.

=== notion-mirror/tasks/done-this-week-task.md ===
---
title: Deploy staging environment
status: Done This Week
area:
  - Engineering
energy: Deep Work
impact: Needle Mover
project: Client-B
project_id: YOUR-PROJECT-ID-1
goal: Build Portfolio of Internet Companies
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
notion_id: test-task-001
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-09T16:00:00.000Z
---

Task completed this week — should be archived to "Done" during auto-cleanup.

=== notion-mirror/tasks/frog-task.md ===
---
title: Write Hero's Journey stories
status: Planned this week
area:
  - Marketing
energy: Deep Work
impact: Supporting
project: Executive Development
project_id: YOUR-PROJECT-ID-8
goal: Build Content & Distribution Audience
goal_id: YOUR-PAGE-ID-CONTENT-GOAL
notion_id: test-task-003
_last_synced: 2026-02-17T10:00:00.000Z
_notion_edited: 2026-02-17T10:00:00.000Z
---

Task repeatedly planned but never started — should be flagged as frog task (3 weeks stuck).

=== notion-mirror/tasks/quick-win.md ===
---
title: Reply to Contact-1 email
status: Planned this week
area:
  - Sales
energy: Quick Win
impact: Supporting
project: Client-A
project_id: YOUR-PROJECT-ID-2
goal: Build Portfolio of Internet Companies
goal_id: YOUR-PAGE-ID-PORTFOLIO-GOAL
notion_id: test-task-005
_last_synced: 2026-03-10T10:00:00.000Z
_notion_edited: 2026-03-10T10:00:00.000Z
---

Quick win task — should NOT count toward energy budget deep work slots.

=== notion-mirror/tasks/stalled-in-progress.md ===
---
title: Write first blog post
status: In progress
area:
  - Marketing
energy: Deep Work
impact: Needle Mover
project: Content & Brand
project_id: YOUR-PROJECT-ID-5
goal: Build Content & Distribution Audience
goal_id: YOUR-PAGE-ID-CONTENT-GOAL
notion_id: test-task-002
_last_synced: 2026-02-18T10:00:00.000Z
_notion_edited: 2026-02-18T10:00:00.000Z
---

Task in progress but untouched for 20 days — should be flagged as stalled (initiation avoidance).

=== clients/tone-of-voice.md ===
# [Your Name] — Tone of Voice Guide (Test Fixture)

## Core Voice

Direct, warm, no-bullshit. Irish inflection. Contractions always. Short sentences.

## Rules

1. Never use corporate buzzwords (leverage, synergy, stakeholder alignment)
2. Present options, not recommendations
3. Say "I" not "we" (solo operator)
4. Use contractions: "I'm", "we're", "that's", "don't"
5. Keep paragraphs to 2-3 sentences max

## Channel Notes

- **Email**: Slightly more formal but still direct. Sign off as "[Owner]"
- **WhatsApp**: Casual, short messages, emoji OK

Test fixture — Minimal voice guide for client-email tone loading.

=== email-mirror/threads/ignore-newsletter.md ===
---
subject: "This week in AI: March 2026"
from: newsletter@techcrunch.com
date: 2026-03-12
thread_id: test-email-003
---

Top stories this week in artificial intelligence...

Test fixture — Newsletter/promotional email. Should be IGNORED by triage rules.

=== email-mirror/threads/ignore-vercel-deploy.md ===
---
subject: "Deployment succeeded: client-b-platform (production)"
from: notifications@vercel.com
date: 2026-03-12
thread_id: test-email-001
---

Your deployment to production was successful.

Project: client-b-platform
Domain: app.client-b.com
Status: Ready

Test fixture — Vercel deployment notification. Should be IGNORED by triage rules.

=== email-mirror/threads/ignore-xero-invoice.md ===
---
subject: "Invoice INV-0234 from [Your Company]"
from: notifications@xero.com
date: 2026-03-11
thread_id: test-email-002
---

A new invoice has been created in your Xero account.

Test fixture — Xero billing notification. Should be IGNORED by triage rules.

=== email-mirror/threads/surface-client-reply.md ===
---
subject: "Re: Q2 Planning — BigCorp"
from: jane@bigcorp.example.com
date: 2026-03-12
thread_id: test-email-004
---

Hi [Owner],

Thanks for sending the architecture doc. We've reviewed it internally and have a few questions about the API migration timeline. Can you outline the expected phases?

Also, budget for Q2 has been approved — we're good to continue at the current rate.

Test fixture — Client reply email. Should be SURFACED by triage rules.

=== email-mirror/threads/surface-meeting-invite.md ===
---
subject: "Meeting: Product Strategy Session"
from: contact7@example.com
date: 2026-03-13
thread_id: test-email-005
---

You've been invited to a meeting.

When: Thursday, March 14, 2026 at 2:00 PM
Where: Google Meet

Attendees: you@example.com, contact7@example.com

Test fixture — Meeting invite from real person. Should be SURFACED by triage rules.

=== email-mirror/threads/unknown-sender.md ===
---
subject: "Intro: AI consulting opportunity"
from: unknown@newcompany.example.com
date: 2026-03-12
thread_id: test-email-006
---

Hi [Owner],

I came across your blog and would love to discuss a potential AI consulting engagement...

Test fixture — Email from unknown sender (not in contacts). Should be flagged as unknown contact by triage.

=== granola-mirror/meetings/2026-03-10-coaching-[coach].md ===
---
title: Coaching Session — [Coach] (Mar 10)
date: 2026-03-10
attendees:
  - [Your Name]
  - [Coach]
---

## AI Summary

Key Decisions:
- Focus on marketing consistency this quarter
- Implement reward/deprivation system for frog tasks

Key Takeaways:
- Initiation avoidance pattern confirmed across multiple stalled items
- Insurance (PI + cyber) committed to completing this month

## Transcript Excerpt

[Owner]: I keep planning the Hero's Journey stories but never starting them.
[Coach]: That's the initiation avoidance pattern we discussed. What's the smallest step?
[Owner]: Maybe just an outline for one story.
[Coach]: Good. Let's check in on that next time.

## Action Items
- [ ] [Owner] — Write outline for one Hero's Journey story
- [ ] [Owner] — Get PI insurance quote this week
- [ ] [Owner] — Email Client-A to schedule kick-off

Test fixture — Mock coaching transcript for coaching-prep granola search and review-meeting coaching mode.

=== granola-mirror/meetings/2026-03-13-weekly-sync-bigcorp.md ===
---
title: Weekly Sync — BigCorp (Mar 13)
date: 2026-03-13
attendees:
  - [Your Name]
  - Jane Smith
---

## AI Summary

Key Decisions:
- Proceed with API v2 migration
- Jane to provide test credentials by Friday

Key Takeaways:
- Frontend refactor ahead of schedule
- Need to plan Q2 roadmap session

## Action Items
- [ ] [Owner] — Send architecture doc for API v2
- [ ] Jane — Share test credentials by Friday
- [ ] [Owner] — Schedule Q2 planning session

Test fixture — Mock client meeting transcript for review-meeting client mode and meeting-prep discovery.

=== memory/MEMORY.md ===
# Goals & Tasks Project Memory (Test Fixture)

## Coaching Prep — Standing Items
- Coaching page: `YOUR-PAGE-ID-COACHING`
- ALWAYS ask [Owner] for current MRR (standing KPI question)
- Check for unmeasured goals (Goals with no KPIs)
- Check Weekly External Conversations count
- Check ikigai alignment on planned tasks
- Client-B guardrail check: staying within 2hrs/day?
- Check marketing challenge progress
- Check insurance status (PI + cyber)
- Check reward/deprivation system implementation (frog tasks)
- Hero's Journey stories: 4 sessions outstanding — ask if still the right exercise
- "Killed the mammoth" check: any accepted proposals sitting without action?
- Check Client-A activation status
- Check Client-D pilot reactivation
- Initiation avoidance pattern: flag tasks that need outreach/initiation

## Active Goals (Feb 2026 audit)
| Goal | Page ID | KPIs |
|------|---------|------|
| **Secure Family Future** (north star) | `YOUR-PAGE-ID-TASK-2` | Net Worth, Annual Income 2026, Revenue Sources, Savings Rate, Runway |
| Build Portfolio of Internet Companies | `YOUR-PAGE-ID-PORTFOLIO-GOAL` | MRR, SaaS Products, Weekly Conversations |
| Build Content & Distribution Audience | `YOUR-PAGE-ID-CONTENT-GOAL` | Email Subscribers |

## Active Leads (Mar 2026)
- **Client-B** — ACTIVE. ~EUR 12K/month
- **Client-A** — ACCEPTED. Month 1 FREE, Month 2+ EUR 2K/month
- **Client-E** — ACTIVE. [Your Rate]/hr, ~EUR 6K/month

Test fixture — minimal MEMORY.md for coaching-prep test assertions.

