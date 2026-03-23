# Coaching Prep Gotchas

- **Always ask [Owner] for current MRR** — This is a standing question every session. Never assume or calculate from rate x hours. Use AskUserQuestion with structured options ("still EUR 18K or changed?").
- **Check unmeasured goals** — For each active goal, verify at least one active KPI references its `goal_id`. Flag any goal with zero linked KPIs as "(unmeasured)".
- **Standing items list is dynamic** — The "Coaching Prep -- Standing Items" section in MEMORY.md changes between sessions. Always re-read it fresh -- never hardcode the list in skill output.
- **Granola query must include deprioritized items** — Always run a "deprioritized parked deferred coaching" qmd query to avoid resurrecting dead work as action items.
- **KPI updates committed separately** — Commit KPI value changes before generating the agenda. Two distinct commits: one for KPI data, one for any other notion-mirror changes. This keeps the sync clean.
- **All I/O in Step 2** — Steps 3-7 analyze collected data only. No new Grep, qmd, or Read calls after collection completes. Only exceptions: KPI file edits (Step 5) and git commands (Steps 5, 8).
- **Memory enrichment after completion** — Check if new coaching insights belong in `dan-profile.md`, pipeline changes in `revenue-strategy.md`, or new standing items in `MEMORY.md`.
