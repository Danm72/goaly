# Enrichment Guide

How to add context to existing Linear issues without destroying what's already there.

## Golden Rule

**ALWAYS read the existing description before writing.** `save_issue` with `description` REPLACES the entire field. If you write only the new content, you've deleted everything.

## Pattern

```python
# Pseudocode
existing = get_issue(id).description
new_section = format_enrichment(date, source, content)
save_issue(id, description=existing + "\n\n" + new_section)
```

## Enrichment Section Format

```markdown
## [YYYY-MM-DD] [Source] Context

### [Topic]
[Insight, quote, or context from source]

### [Topic 2]
[More context. Cross-reference related issues: see [TEAM-XX](url)]
```

## What Goes in an Enrichment vs a New Issue

| Signal | Action |
|--------|--------|
| New user-facing feature not covered by any existing issue | **Create new issue** |
| Additional context, quote, or decision about an existing feature | **Enrich existing issue** |
| New acceptance criterion for an existing feature | **Enrich** — add to AC section |
| Bug or edge case for an existing feature | **Enrich** or create sub-issue |
| Strategic decision affecting a project | **Update project description** |
| Product principle that spans multiple features | **Update project description** |

## Enrichment Quality Bar

- Date and source clearly labeled
- Cross-references to related issues included
- Quotes attributed to speaker
- Not just raw transcript dump — synthesized into actionable context
- If the enrichment reveals a missing acceptance criterion, ADD it to the AC section too (not just the context section)

## Don't Enrich When

- The issue is Done or Canceled (add to a new issue instead)
- The enrichment contradicts the existing description (update instead of append)
- The context is ephemeral (e.g., "James was sick on this call")
