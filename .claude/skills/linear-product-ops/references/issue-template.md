# Issue Template

Use this template when creating new Linear issues. All 6 sections are required.

---

## What This Is

[2-3 sentence summary. What is this feature/fix/improvement? Why does it exist?]

---

## Intended User Experience

[Narrative walkthrough of what the user sees and does. NOT implementation details.]

**Key UI elements:**
* [Element 1 — what it shows, how it behaves]
* [Element 2]
* [Element 3]

[Include empty state, loading state, and error state when relevant.]

---

## Intended Outcomes

* [What success looks like for the user]
* [What success looks like for the business]
* [What behavior this enables or prevents]

---

## Acceptance Criteria

- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Performance: responsive and fast on mobile]
- [ ] [Accessibility: keyboard navigable, screen reader friendly]

---

## Dependencies

* [TEAM-XX](url) — [what it blocks or enables]
* [TEAM-YY](url) — [relationship]

If no dependencies, state "None — can be built independently."

---

## PostHog Tracking Plan

* `feature_action_event` — [what triggers it] (properties: `entity_id`, `context_prop`, `auth_status`)
* `feature_secondary_event` — [what triggers it] (properties: `entity_id`, `variant`)

**Success target:** [Quantitative metric. Examples:]
* ">= 40% of page viewers click the primary CTA"
* "< 5% error rate on form submission"
* ">= 70% of users who start the flow complete it"

If you cannot define a success target, the feature's purpose is unclear — revisit the Intended Outcomes section.
