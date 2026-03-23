---
name: goaly-setup
description: Use when setting up Goaly for the first time, initializing the workspace, or when someone types /goaly-setup. Generates all starter markdown files from 5 structured questions.
---

# Goaly Setup Wizard

First-run experience that bootstraps a complete Goaly workspace through 5 interactive questions. Generates owner profile, goals, KPIs, projects, tasks, and working style preferences as local markdown files.

## Prerequisites

Before starting, check if `notion-mirror/` already has files. If it does, warn the user and ask whether to overwrite or skip existing files. See `gotchas.md` for details.

## Flow

Run these 5 questions sequentially using `AskUserQuestion`. Each question generates files immediately before moving to the next.

### Question 1: Identity

Ask: "Let's set up your workspace. What's your name, company name, and role?"

Use `AskUserQuestion` with a free-text prompt. Parse the response for name, company, and role.

Generate `.claude-memory/owner-profile.md`:

```markdown
---
name: <name>
company: <company>
role: <role>
---

# Owner Profile

## Identity

- **Name:** <name>
- **Company:** <company>
- **Role:** <role>
```

### Question 2: Goals

Ask: "What are your top 3 strategic goals for this year? Describe each in a sentence."

Use `AskUserQuestion` with a free-text prompt. Parse 1-5 goals from the response.

For each goal, create `notion-mirror/goals/<kebab-case-title>.md`:

```markdown
---
title: <Goal Title>
status: Not started
area: <inferred from description or "General">
horizon: This Year
---

# <Goal Title>

<User's description of the goal>
```

### Question 3: KPIs

For each goal from Question 2, ask: "How will you measure progress on '<Goal Title>'? Give a metric name, current value, and target value."

Use `AskUserQuestion` for each goal. Parse metric, current value, and target.

For each KPI, create `notion-mirror/kpis/<kebab-case-metric-name>.md`:

```markdown
---
title: <Metric Name>
lifecycle: Active
unit: <inferred unit or "count">
current_value: <current>
target_value: <target>
goal: <Goal Title>
tracking_frequency: Monthly
deadline: <end of current year>
---

# <Metric Name>

Tracks progress toward: **<Goal Title>**

- **Current:** <current_value> <unit>
- **Target:** <target_value> <unit>
- **Frequency:** Monthly
```

### Question 4: Clients/Projects

Ask: "What are your current clients or active projects? List them with a one-line description each."

Use `AskUserQuestion` with a free-text prompt. Parse project names and descriptions.

For each project, create `notion-mirror/projects/<kebab-case-name>.md`:

```markdown
---
title: <Project Name>
status: Active
type: <Client or Internal>
---

# <Project Name>

<Description>
```

For each project, also create 2-3 starter tasks in `notion-mirror/tasks/<kebab-case-task>.md`:

```markdown
---
title: <Task Title>
status: Not started
project: <Project Name>
priority: Medium
---

# <Task Title>

Starter task for <Project Name>.
```

Generate sensible starter tasks based on the project description (e.g., "Define scope for X", "Set up tracking for X", "Schedule kickoff for X").

### Question 5: Working Style

Ask using `AskUserQuestion` with structured options for each sub-question:

**Deep work capacity per day:**
- 1-2 hours
- 2-4 hours
- 4-6 hours
- 6+ hours

**Do you prefer structured routines (time-blocking, checklists) or flexible/intuitive flow?**
- Structured
- Flexible

**When is your best time for deep work?**
- Morning
- Afternoon
- Evening

Update `.claude-memory/owner-profile.md` to append:

```markdown
## Working Style

- **Deep work capacity:** <selection>
- **Structure preference:** <Structured or Flexible>
- **Best deep work time:** <Morning, Afternoon, or Evening>
```

### After All Questions

1. Commit all generated files with message: `feat(setup): initialize workspace via goaly-setup wizard`
2. Print a summary of everything created (file count by category)
3. End with: **"Type /mission to see your first scorecard."**

## File Naming

All generated files use kebab-case: lowercase, hyphens for spaces, no special characters.

Examples:
- `grow-revenue-30-percent.md` (not `Grow Revenue 30%.md`)
- `monthly-recurring-revenue.md` (not `MRR.md`)

## Idempotency

The skill can be re-run safely. If files already exist in target directories, ask the user whether to overwrite, merge, or skip before proceeding.

## Sub-files

- `gotchas.md` — Common failure points and edge cases. Read before generating any files.
