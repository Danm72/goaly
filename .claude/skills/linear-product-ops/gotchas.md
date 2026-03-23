# Linear Product Ops — Gotchas

Real failure modes from production use. Read before every run.

## API & Data

- **Payload truncation**: `list_issues` with 100+ issues returns truncated output saved to a file. Use `jq` or `python3` to parse the file, don't try to read it directly with the Read tool.
- **`save_issue` creates vs updates**: With `id` parameter = update. Without `id` = create. Forgetting the `id` on an update silently creates a duplicate. Always verify you're passing the issue identifier (e.g., "Client-B-68").
- **Project descriptions truncated in list views**: `get_project` returns full description but `list_projects` truncates. Always use `get_project` for reading.
- **Summary max 255 chars**: Project `summary` field silently truncates. Keep summaries concise.

## Enrichment

- **ALWAYS read before writing**: `save_issue` with `description` REPLACES the entire description. If you don't read first and append, you destroy existing content. This is the #1 failure mode.
- **Append pattern**: Read existing description -> concatenate new section at the end -> write the combined result. Never just write the new section alone.
- **Context sections should be dated**: Use `## [Date] [Source] Context` headers so enrichments from different sessions are distinguishable.

## Deduplication

- **Fuzzy title matching**: "Email verification" and "Email/phone verification" are the same issue. Search broadly, then human-confirm before skipping.
- **Cross-project duplicates**: Same feature can exist in two projects (e.g., "Notification preferences" in both Notifications and Account Settings). Check across all projects.
- **Don't deduplicate enrichments**: Adding context from a new source to an already-enriched issue is fine. Enrichments from different sources stack.

## PostHog Tracking

- **Event names**: `snake_case`, no spaces. Prefix with feature area when helpful (e.g., `job_board_index_viewed` not just `page_viewed`).
- **Properties**: Always include the entity ID (e.g., `job_id`, `profile_id`) plus contextual properties.
- **Success targets**: Must be quantitative. ">= 40% click rate" not "users find it useful." If you can't quantify it, the tracking plan is incomplete.
- **Funnel metrics at epic level**: Individual issues have per-feature events. Epics track the full user journey funnel across child issues.

## Templates

- **Don't over-template**: The Intended User Experience section should describe what the user SEES and DOES, not implementation details. Keep it at wireframe fidelity.
- **AI-generated descriptions need review**: Chat PRD (and Claude) tend to write generic UX descriptions. Flag obviously generic content for human review.
- **Dependencies should be actionable**: "Requires notification infrastructure" is too vague. "Blocked by [Client-B-17](url) SendGrid integration" is specific.

## Labels

- **Labels must pre-exist**: `save_issue` with a non-existent label fails. Check available labels with `list_issue_labels` first. Create missing labels with `create_issue_label` before using them.
- **Use consistent label casing**: "Feature" not "feature" or "FEATURE".

## PostHog / MEASURE Mode

- **PostHog MCP must be installed first**: MEASURE mode depends on PostHog MCP tools. If not installed, fail gracefully with setup instructions (point to `references/posthog-setup.md`).
- **Event names are case-sensitive**: `Job_Board_Viewed` ≠ `job_board_viewed`. Always use `snake_case` in the registry and Linear descriptions.
- **Custom events vs autocapture**: PostHog autocaptures `$pageview`, `$pageleave`, etc. These won't match custom event names in the registry. Only query for explicitly defined events.
- **Query timeouts**: Large HogQL queries can timeout. Use async mode (`"async": true`) for queries spanning > 30 days.
- **Registry is the bridge**: The event registry connects Linear (where events are defined) to PostHog (where events are measured). If an event isn't in the registry, MEASURE won't check it. If it's not in PostHog, it hasn't been instrumented.
- **Don't trust zero volume**: An event with zero volume could mean: (a) not instrumented, (b) instrumented but no users triggered it, or (c) wrong environment (staging vs production). Check instrumentation status separately.
