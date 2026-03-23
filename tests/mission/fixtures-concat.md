=== fixtures/clients/big-client.md ===
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

=== fixtures/clients/churned-client.md ===
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

=== fixtures/clients/small-client.md ===
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

=== fixtures/goals/active-goal.md ===
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

Primary goal — should appear in mission scorecard.

=== fixtures/goals/archived-goal.md ===
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

Deprioritized goal — should NOT appear in mission.

=== fixtures/interactions/2026-02-20-meeting-old.md ===
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

=== fixtures/interactions/2026-03-08-meeting-recent.md ===
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

=== fixtures/kpis/conversations-archived.md ===
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

=== fixtures/kpis/mrr-green.md ===
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

=== fixtures/kpis/saas-red.md ===
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

=== fixtures/kpis/subscribers-yellow.md ===
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

=== fixtures/tasks/active-deep-work.md ===
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

=== fixtures/tasks/done-this-week-task.md ===
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

=== fixtures/tasks/frog-task.md ===
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

=== fixtures/tasks/quick-win.md ===
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

=== fixtures/tasks/stalled-in-progress.md ===
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

