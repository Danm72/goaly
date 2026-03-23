# Client Email Gotchas

Skill-specific failure modes. Read before every invocation.

- **Send-as alias** — Use the correct send-as alias for the email domain you want to appear in the "From" field. The primary account is for auth only.
- **Tone of voice first** — Always `Read clients/tone-of-voice.md` before drafting ANY response. Skipping this produces generic corporate copy that doesn't sound like [Owner].
- **Reply threading** — `--reply-to-message-id` is required when replying to an existing thread. Without it, Gmail creates a new thread instead of continuing the conversation.
- **Log every send** — Every sent email MUST be logged as an Outbound Interaction in `notion-mirror/interactions/`. No exceptions, even for quick replies.
- **Never offer calls** — [Owner] hates calls. Never include "let's hop on a call" or suggest scheduling a meeting in any draft. Email only. Let the other party suggest calls if they want one.
- **contacts_ids format** — Use `contacts_ids: []` (empty array) when no contacts are known. Never write `contacts_ids: null` — it breaks sync.
- **Strategy Notes drive boundaries** — The `## Strategy Notes` section in client files contains what NOT to offer. Read it before drafting and respect those boundaries in every draft.
- **Retainer framing** — When drafting for prospects, frame retainers early: "The way I work is ongoing retainers rather than fixed-scope projects." This is [Owner]'s default positioning.
- **Slack substance extraction** — When logging Slack DMs, extract decisions, feedback, action items, and commitments. Skip casual banter. The Interaction file should be useful for future reference.
- **Check MEMORY.md for Slack IDs** — Active Leads section stores Slack channel IDs and workspace info per client. Always check before searching via MCP.
