# Client README Template

Write to `clients/<client-slug>/README.md`:

```markdown
# [Client Name]

## Notion (synced)
- Client: `notion-mirror/clients/<slug>.md`
- Contacts: `notion-mirror/contacts/<name>.md`
- Interactions: `notion-mirror/interactions/` (filtered by client)
- Project: `notion-mirror/projects/<slug>.md`

## Local Docs
- `docs/` — client-specific documents (not synced to Notion)
```

Create `docs/` directory only. Subdirs (`legal/`, `research/`, `project/`) are lazy — only create when a file needs them.
