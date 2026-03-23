# Gotchas — goaly-setup

## File Naming

- All file names MUST be kebab-case: lowercase letters, numbers, and hyphens only.
- Strip special characters before converting to kebab-case. "Grow Revenue 30%" becomes `grow-revenue-30-percent.md`, not `grow-revenue-30%.md`.
- Never use spaces, underscores, or uppercase in file names.

## Relations Must Use Exact Title Strings

- The `goal` field in KPI frontmatter must match the `title` field in the corresponding goal file exactly, including case.
- Example: if the goal title is `Grow Revenue 30 Percent`, the KPI must reference `goal: Grow Revenue 30 Percent` — not `grow revenue 30 percent` or `Grow Revenue`.
- Same applies to `project` references in task files.

## Goal Count — Keep It Focused

- Do not create more than 5 goals. If the user lists more than 5, ask them to prioritize.
- Goaly works best with 3 goals. Gently steer toward 3 unless the user insists on more.
- Quote: "If everything is a priority, nothing is."

## KPIs Must Be SMART

- Every KPI needs a concrete metric with a number, not a vague aspiration.
- Bad: "Improve customer satisfaction" — no number, no unit.
- Good: "NPS score, current: 32, target: 50" — measurable, has a unit.
- If the user gives a vague KPI, ask a follow-up to make it specific before creating the file.

## Existing Files — Warn Before Overwriting

- Before generating any files, check if `notion-mirror/goals/`, `notion-mirror/kpis/`, `notion-mirror/projects/`, or `notion-mirror/tasks/` already contain `.md` files.
- If they do, warn the user: "You already have files in notion-mirror/. Do you want to overwrite, merge with existing, or skip?"
- Never silently overwrite existing files.

## This Generates Local Files Only

- The setup wizard creates markdown files on disk. It does NOT sync anything to Notion.
- If the user asks about Notion sync, explain that syncing is a separate step and point them to the sync documentation (if it exists) or note that it's not yet configured.
- The local files are the source of truth for Goaly's local-first workflow.

## Directory Creation

- Always ensure target directories exist before writing files. Create `notion-mirror/goals/`, `notion-mirror/kpis/`, `notion-mirror/projects/`, `notion-mirror/tasks/`, and `.claude-memory/` if they don't exist.

## Empty or Minimal Responses

- If the user gives a one-word answer or skips details, don't guess. Ask a clarifying follow-up.
- Example: User says "Revenue" as a goal. Ask: "Can you expand on that? Something like 'Grow monthly recurring revenue to $50k by end of year'?"
