# Cockpit Gotchas

Failure modes specific to the cockpit skill. Read before every run.

- **MRR is confirmed by [Owner], not calculated.** MRR comes from MEMORY.md Active Leads monthly estimates. Rates in client files are hourly — multiplying rate x arbitrary hours is misleading. Always present computed value and ask [Owner] to confirm.
- **Meta-KPIs are ephemeral.** Execution Score, High-Leverage Ratio, Deep Work Ratio are computed per session and presented in chat only. They are NOT written to Notion KPI files or notion-mirror.
- **Energy budget slots are 30min minimum.** Each Deep Work slot represents a meaningful block. Don't subdivide below 30min or count Quick Win tasks as Deep Work slots.
- **MONDAY vs PULSE mode detection changes entire output.** PULSE skips Steps 3, 7, 8, 9, 10. Getting the mode wrong means either overwhelming [Owner] on a quick check or giving him a shallow view on planning day.
- **Don't re-rank tasks [Owner] already planned.** If tasks are already "Planned this week" from a prior session, present them as-is in Step 9 and let [Owner] adjust. Don't silently demote or reorder.
- **Baseline calendar events are not [Owner]'s.** The `baseline` calendar (Fitzwilliam, Liffey Founders Club, Dock Yard, Give a Go) must be excluded from meeting counts and energy budget. See _shared/conventions.md for the full list.
- **Dormancy detection must cross-reference Gmail.** `notion-mirror/interactions/` only contains manually logged interactions. Client emails that were never logged as Interactions will be invisible to dormancy checks. Always run a per-client Gmail search (`gog gmail search`) alongside the interactions grep. Use whichever source has the most recent date.
- **MONDAY email window is 7 days, not 2.** PULSE uses `newer_than:2d` for daily checks, but MONDAY must use `newer_than:7d` to cover the full week since last planning session. Using 2d on Monday misses mid-week emails entirely.
- **Scoring rules include coaching commitment bias (Mar 23).** Tasks with "## Coaching Accountability" sections get +3 base, +2 bonus for 3+ sessions committed. Floor rule: at least one coaching commitment must appear in top 5 weekly. Don't re-rank without checking for these tags. See `references/scoring-rules.md`.
- **Frog streak tracking in run log.** Run log now includes `frog_eaten=true|false` and `frog_streak=N`. PULSE checks if yesterday's frog was eaten. Don't skip this — it's the accountability mechanism.
