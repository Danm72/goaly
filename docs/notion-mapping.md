# Notion Mapping for Dictation System

This document defines how Claude routes dictated content to the correct Notion databases.

## Databases & Data Source IDs

| Database | Data Source ID | Purpose |
|----------|---------------|---------|
| Tasks Tracker (Business) | `collection://YOUR-TASKS-DATABASE-ID` | Work tasks, business actions |
| Personal Tasks | `collection://YOUR-PERSONAL-TASKS-DATABASE-ID` | Personal tasks, chores, life admin |
| Goals Tracker | `collection://YOUR-GOALS-DATABASE-ID` | Long-term direction, outcomes to achieve |
| Projects | `collection://YOUR-PROJECTS-DATABASE-ID` | Bounded initiatives with start/end |
| Brainstorm Session | `collection://YOUR-BRAINSTORMS-DATABASE-ID` | Ideas, explorations, things to consider |

## Item Type Detection

When parsing dictation, classify items by these patterns:

### Task (→ Tasks Tracker or Personal Tasks)
**Signals:** Action verbs, specific next actions, things to do
- "I need to..."
- "Remind me to..."
- "TODO:"
- "Follow up with..."
- "Book/Schedule/Send/Call/Email..."
- Short, concrete actions

**Routing:**
- If work/business context → Tasks Tracker (Business)
- If personal/chore context → Personal Tasks
- Use signal words from the Context Routing table below to decide

**Required properties:**
- `Task name` (title)
- `Status`: "Not started" (default)

**Optional properties:**
- `Priority`: "High" | "Medium" | "Low"
- `Due date`: If mentioned ("by Friday", "next week")
- `Goal`: Link if task clearly supports an existing goal
- `Area`: multi_select, infer from task content (business: Finance / Marketing / Product / Operations / Legal / Sales / Engineering; personal: Health / Home / Finance / Family / Social / Learning / Travel)
- `Timeframe`: select, set if timing mentioned ("urgent" / "today" → This Week, "soon" → This Month, "this quarter" → This Quarter, no rush → Someday)
- `Energy`: select, infer from task nature (quick email → Quick Win, tax filing → Deep Work, "waiting for John" → Waiting On, paperwork → Admin, "pick up groceries" → Errand)

### Goal (→ Goals Tracker)
**Signals:** Outcomes, achievements, directional intent
- "I want to..."
- "My goal is..."
- "I'm aiming for..."
- "By Q2, I should..."
- Measurable outcomes, not specific actions

**Required properties:**
- `Goal name` (title)
- `Status`: "Not started" (default)

**Optional properties:**
- `Priority`: "High" | "Medium" | "Low"
- `Due date`: If timeframe mentioned
- `Project`: Link if goal is part of a project
- `From Brainstorm`: Link if promoted from a brainstorm
- `Area`: multi_select, infer from goal content (Finance / Marketing / Product / Operations / Health / Personal Growth)
- `Horizon`: select, infer from timeframe ("this quarter" → This Quarter, "this year" / "by December" → This Year, "long-term" / "eventually" → Multi-Year)

### Project (→ Projects)
**Signals:** Multi-step initiatives, bounded work
- "The X project..."
- "We're building..."
- "This quarter we're working on..."
- Has clear start/end or phases

**Required properties:**
- `Project name` (title)
- `Status`: "Not started" (default)

**Optional properties:**
- `Priority`: "High" | "Medium" | "Low"
- `Start date` / `End date`: If mentioned
- `Goals`: Link to relevant goals
- `Area`: multi_select, infer from project domain (Finance / Marketing / Product / Operations / Engineering / Growth)
- `Horizon`: select, infer from project duration ("this quarter" → This Quarter, "this year" → This Year, "long-term" → Multi-Year)

### Brainstorm (→ Brainstorm Session)
**Signals:** Exploration, ideas, possibilities
- "What if..."
- "I'm thinking about..."
- "Maybe we could..."
- "An idea:"
- Unvalidated concepts, things to explore

**Required properties:**
- `Idea` (title)
- `Status`: "New idea" (default)

**Optional properties:**
- `Space`: Tag relevant domains (B2B, AI, Automation, etc.)
- `Problem Category`: If addressing a specific problem
- `Problem Statement`: Brief description of the problem
- `Priority`: "High" | "Medium" | "Low"

## Relationship Rules

### Linking Tasks to Goals
- If dictation mentions "for [goal name]" or "to support [goal]", look up the goal and link
- Don't force links - standalone tasks are fine

### Promoting Brainstorms to Goals
- When user says "let's commit to this" or "moving forward with [idea]":
  1. Update Brainstorm status to "Committed"
  2. Create new Goal with `From Brainstorm` relation
  3. Optionally create initial tasks

### Linking Goals to Projects
- If a goal clearly belongs to a project ("for the website redesign"), link it
- Multiple goals can share a project

## Context Routing (Tasks)

Context determines which database a task goes to:

| Signal Words | Database |
|-------------|----------|
| client, meeting, deadline, ship, deploy, code, work, invoice, business, corporation tax | Tasks Tracker (Business) |
| home, family, personal, self, health, hobby, clean, fix, buy, grocery, maintenance, errands, dentist, passport, personal tax | Personal Tasks |

## Status Mappings

### Tasks Tracker (Business)
- Not started (default)
- Planned (queued for specific time)
- In progress
- Done This Week
- Done

### Personal Tasks
- Not started (default)
- Planned (queued for specific time)
- In progress
- Done This Week
- Done

### Goals Tracker
- Not started (default)
- In progress
- Done

### Projects
- Not started (default)
- In progress
- Done

### Brainstorm Session
- New idea (default)
- Need more info
- Under discussion
- In review
- Committed (promoted)
- Rejected
- Archived

## Example Dictation Parsing

**Input:**
> "Okay so I've been thinking about building a WhatsApp bot for B2B sales, that could be interesting. Also I need to follow up with John about the contract, that's urgent. And my goal for this quarter is to close 5 new deals."

**Output:**
1. **Brainstorm** → "WhatsApp bot for B2B sales"
   - Space: ["WhatsApp", "B2B", "Sales"]
   - Status: "New idea"

2. **Task** → "Follow up with John about the contract"
   - Context: "Work"
   - Priority: "High" (urgent)
   - Status: "Not started"

3. **Goal** → "Close 5 new deals"
   - Due date: End of quarter
   - Status: "Not started"

## Claude Behavior

After parsing dictation:
1. Create items in appropriate databases
2. Summarize what was created (don't ask for confirmation)
3. Mention any relationships established
4. Note anything ambiguous that wasn't captured

Example response:
> "Created:
> - Task: 'Follow up with John about the contract' (Work, High priority)
> - Goal: 'Close 5 new deals' (Q1 2026)
> - Brainstorm: 'WhatsApp bot for B2B sales'
>
> The task wasn't linked to any goal - let me know if it should be."
