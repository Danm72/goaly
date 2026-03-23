# Meeting Prep Gotchas

## Interaction History Depth

Load at least the last 5 interactions for the client, not just the most recent. Context from older meetings reveals recurring themes, stalled action items, and relationship dynamics that a single meeting miss.

## Open Action Items from Prior Meetings

Always check prior meeting interaction bodies for unchecked `- [ ]` items. These are commitments [Owner] or the client made. Surface outstanding items in the "What I Know Going In" section — they're the first thing to address.

## Prep-to-Review Handoff Contract

The prep file created by this skill becomes input for `/goaly-review-meeting`. The review skill finds it by:

1. `Grep "^type: Prep" notion-mirror/interactions/` filtered by client name
2. Most recent by `date:` field

Minimum fields for handoff: `title`, `type` (Prep), `date`, `direction` (Outbound), `client`, `client_id`.

The review skill cross-references the prep's "Questions to Ask" against the transcript to identify which questions were covered vs skipped. If the prep file is malformed or missing these fields, the handoff breaks silently.

## Coaching Duplication

This skill is for client meetings only. Do NOT duplicate standing agenda items from `/goaly-coaching-prep` ([Coach] sessions). If the trigger mentions "[Coach]", "coaching", or "coaching prep" — redirect immediately.

## Baseline Calendar

Events from the `baseline` calendar (Fitzwilliam, Liffey Founders Club, Dock Yard, Give a Go) are NOT [Owner]'s events. When pulling calendar data to find the meeting slot, filter these out. Only use events from `you@example.com` and family/personal calendar.

## Strategy Notes Are Mandatory

Never generate the "My Positioning" or "Watch For" sections without reading the client's Strategy Notes. These contain red flags, engagement posture, and scope boundaries. Prepping without them risks [Owner] walking into a meeting unprepared for known risks.
