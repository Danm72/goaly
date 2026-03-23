# Epic Template

Use this template for parent issues that contain multiple sub-issues. Extends the issue template with funnel tracking.

---

## Overview

[3-5 sentence scope description. What user problem does this epic solve? What capability does it create?]

---

## Sub-Issues

| Issue | Title | Type |
|-------|-------|------|
| [TEAM-XX](url) | [Title] | Feature |
| [TEAM-YY](url) | [Title] | Feature |

---

## User Flow

1. User [starts here — entry point]
2. User [takes action]
3. User [sees result]
4. User [completes goal or exits]

---

## Key Dependencies

* [TEAM-XX](url) — [blocking relationship]
* [External dependency] — [what and why]

---

## PostHog Tracking Plan — Epic Funnel

Track the full user journey across sub-issues:

* `epic_step_1_event` — [entry point] (properties: `user_id`, `auth_status`)
* `epic_step_2_event` — [key action] (properties: `entity_id`)
* `epic_step_3_event` — [conversion] (properties: `entity_id`, `completion_pct`)
* `epic_drop_off_event` — [user abandoned] (properties: `last_step`, `reason`)

**Key funnel metric:** `step_1` -> `step_2` -> `step_3`. Drop-off at each step indicates where friction exists.

**Epic success target:** [End-to-end conversion rate or engagement metric]
