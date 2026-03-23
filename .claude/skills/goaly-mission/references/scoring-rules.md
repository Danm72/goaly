# Impact Scoring Rules

Used in STEP 9 (Task Ranking) during MONDAY mode.

## Impact Scoring

Score each candidate task against these criteria:

| Question | Points |
|----------|--------|
| Does this move MRR? (client work, revenue-generating) | +3 |
| Does this ship a product toward paying users? | +3 |
| Does this grow audience/subscribers? | +2 |
| Does this have a hard deadline (due_date set)? | +1 |
| Is someone external waiting on this? (energy: Waiting On, or client task) | +1 |
| **Is this a coaching commitment?** (has "## Coaching Accountability" section) | **+3** |
| **Coaching sessions committed ≥ 3?** (recurring stall — highest priority frog) | **+2 bonus** |
| **Coaching sessions committed = 2?** | **+1 bonus** |

Maximum score: 15 points.

## Coaching Commitment Bias — WHY THIS MATTERS

[Owner]'s system is designed to bias toward coaching commitments because:
1. Client work moves naturally (external accountability exists)
2. Coaching commitments stall naturally (no external accountability)
3. Without scoring bias, frog tasks ALWAYS lose to client tasks — the system reinforces avoidance
4. [Coach] tracks these commitments — they're not optional backlog, they're agreed actions with a coach

**Rule: At least ONE coaching commitment task must appear in the top 5 every week.** If scoring alone doesn't surface one, manually insert the highest-sessions-committed frog into position 3-5. This is a floor, not a ceiling.

## Pareto Selection

The top 3-5 tasks by score are the Pareto 20% — protect time for these above all else. Present ranked list grouped by Project, then use AskUserQuestion with multiSelect to let [Owner] pick his top 5 priorities. Pre-select the top 5 by score as defaults.

**Always show coaching commitment tasks in a separate "FROG TASKS" section** above the regular ranking, so [Owner] sees them before making choices. Format:

```
🐸 COACHING COMMITMENTS (must pick at least 1):
| Rank | Task | Sessions | Days Stalled | First Step |
```

## After Selection

- Edit chosen task files: set `status: "Planned this week"`
- Edit non-chosen files that were `Planned this week`: set `status: "Not started"` (demote)
- Confirm changes with [Owner] before editing
- **For chosen frog tasks: prompt [Owner] to add a calendar block** (date + time). No calendar block = task won't happen.
