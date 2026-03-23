# SMOKE-TEST: linear-product-ops

## Prerequisites
- [ ] Linear MCP connected and authenticated
- [ ] At least 1 project with issues in the workspace
- [ ] PostHog MCP connected (for MEASURE mode only)

## INGEST Mode
- [ ] Invoke with a short transcript excerpt (~500 words)
- [ ] Verify: new issues use all 6 template sections
- [ ] Verify: PostHog tracking plan present with event names + properties + success target
- [ ] Verify: deduplication check ran before creation (look for search in tool calls)
- [ ] Verify: cross-references use [TEAM-XX](url) format
- [ ] Verify: run-log.jsonl updated

## ENRICH Mode
- [ ] Pick an existing issue with a description
- [ ] Invoke with new context to add
- [ ] Verify: existing description preserved (not replaced)
- [ ] Verify: new section appended with date and source header
- [ ] Verify: cross-references to related issues included

## AUDIT Mode
- [ ] Invoke on the full board
- [ ] Verify: issues without PostHog tracking flagged
- [ ] Verify: empty/thin descriptions flagged
- [ ] Verify: orphan issues (no project) flagged
- [ ] Verify: findings presented as table with severity

## MEASURE Mode
- [ ] Requires PostHog MCP — skip if not configured
- [ ] Invoke MEASURE
- [ ] Verify: reads event registry
- [ ] Verify: queries PostHog for each defined event
- [ ] Verify: reports volume and target comparison
- [ ] Verify: updates event status in registry

## Edge Cases
- [ ] Invoke INGEST with empty source — should ask for input
- [ ] Invoke MEASURE without PostHog MCP — should fail gracefully with setup instructions
- [ ] Invoke ENRICH on a Done/Canceled issue — should warn
