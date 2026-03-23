# Interaction Template — Meeting

Use this template when creating the Interaction file in Step 4.

## Frontmatter

```yaml
---
title: "[Meeting description — e.g., Weekly standup — Client-B]"
type: Meeting
date: YYYY-MM-DD
direction: Outbound
client_id: [from client file, or omit for coaching]
client: "[client name, or omit for coaching]"
contacts_ids:
  - [contact notion_id]
contacts:
  - [contact name]
---
```

**Validation:** Never set `contacts_ids: null`. Omit the field entirely or use `[]` if no contacts identified. Always set both `_id` and human-readable name together (see `_shared/conventions.md`).

## Body Structure

```markdown
## AI Summary

<details>
<summary>Key Decisions</summary>

- [decisions from transcript]

</details>

<details>
<summary>Key Takeaways</summary>

- [takeaways]

</details>

## Pre-Session Prep

[Link to or summarize the prep Interaction, if one exists]

## Session Notes

[Structured notes from transcript — attendees, topics covered, key discussion points]

## Action Items

- [ ] [owner] — [action item]
- [ ] [owner] — [action item]

## Carried Forward

- [items from last session still unresolved]
```

## Filename Convention

`notion-mirror/interactions/YYYY-MM-DD-meeting-[slug].md`

Do NOT set `notion_id`, `_last_synced`, or `_notion_edited` on new files. The sync engine adds these after creation.
