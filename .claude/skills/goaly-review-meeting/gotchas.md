# Review-Meeting Gotchas

Failure modes specific to the review-meeting skill. Read before every run.

- **4-query Granola pattern.** When using Granola MCP, always run 4 queries in parallel: (1) goals/outcomes, (2) deprioritized items, (3) projects/deliverables, (4) action items/next steps. Querying deprioritized items prevents resurrecting dead work as new tasks.
- **Transcript may not be available yet.** Granola has a processing delay after meetings. If qmd and granola-mirror return nothing, try the Granola MCP. If that also fails, offer [Owner] three options: retry later, proceed with local data only, or paste transcript manually.
- **Always create an Interaction file.** Even for informal calls, hallway chats, or quick syncs. The Interaction log is the single source of truth for client touchpoint frequency. See `templates/interaction-template.md` for the YAML + body structure.
- **Extract ALL action items.** Not just ones with named owners. Unassigned items still need tracking — create tasks with `energy: "Waiting On"` and flag for [Owner] to assign.
- **Follow-up email is drafted inline.** Don't hand off to `/goaly-client-email`. The review skill has full meeting context already loaded — handing off loses that context. Draft the email in Step 8 using tone-of-voice.md.
- **Voice guide evolution check.** After processing the transcript, check if [Owner] used new expressions, metaphors, or communication patterns worth capturing. If yes, update `clients/tone-of-voice.md`.
- **Prep-to-review handoff.** If a prep Interaction exists for this meeting (from `/goaly-meeting-prep`), cross-reference which agenda questions were covered vs skipped. Note gaps under "Carried Forward" in the new Interaction file.
