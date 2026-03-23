# Notion Mirror

This directory contains your business data as markdown files with YAML frontmatter. Each subdirectory maps to a database (goals, KPIs, tasks, projects, clients, contacts, interactions, brainstorms, personal tasks).

## Notion Is Optional

These are just markdown files. You can:
- **Write them by hand** — create .md files with YAML frontmatter
- **Generate them** — run `/goaly-setup` to create starter files from a few questions
- **Sync from Notion** — use `tools/notion-sync` to pull/push from a Notion workspace
- **Export from anywhere** — any tool that outputs markdown with YAML frontmatter works

## File Format

Each file has YAML frontmatter with properties and a markdown body:

```yaml
---
title: Deploy staging environment
status: Planned this week
project: Client-A Project
goal: Build Portfolio
impact: Needle Mover
energy: Deep Work
---

Additional notes and context go here.
```

## Directories

| Directory | Contains | Key Properties |
|-----------|----------|---------------|
| `tasks/` | Business actions | status, project, goal, impact, energy, timeframe |
| `personal-tasks/` | Personal actions | status, area, energy, timeframe |
| `goals/` | Strategic goals | status, area, horizon |
| `kpis/` | Measurable outcomes | lifecycle, unit, current_value, target_value, goal |
| `projects/` | Bodies of work | status, area, horizon |
| `clients/` | Client CRM data | status, type |
| `contacts/` | People | client, role, email |
| `interactions/` | Meetings, emails, calls | client, type, date |
| `brainstorms/` | Ideas and exploration | status, space, category |
