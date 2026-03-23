# Meta-KPIs (Ephemeral)

Session-only metrics computed during MONDAY mode STEP 8 (Last Week Retro). These are presented in chat — never written to Notion.

## Formulas

| Meta-KPI | Formula | Target | Warning Threshold |
|----------|---------|--------|-------------------|
| Execution Score | Shipped / (Shipped + Wasted) | > 70% | < 50% |
| High-Leverage Ratio | Needle Mover shipped / Total shipped | > 40% | < 20% |
| Deep Work Ratio | Deep Work tasks shipped / Total shipped | > 50% | < 30% |

- **Shipped** = tasks with status "Done This Week" (B3 data, captured before auto-cleanup)
- **Wasted** = tasks with status "Planned this week" where `_notion_edited` is > 7 days ago (planned but untouched)

## Spear Sharpening Check

After computing Meta-KPIs, check whether any Active KPI actually changed value this week:

1. From B1 (active KPI files) — check `_notion_edited` for edits in the past 7 days
2. If Shipped count >= 3 but zero KPIs moved value, flag:

```
(spear-sharpening) Lots of activity (N tasks shipped) but no KPI movement — are you sharpening the spear instead of hunting the mammoth?
```

This catches adjacent work (organizing, prepping, researching) that feels productive but doesn't advance measurable outcomes. Common triggers: all shipped tasks are `impact: Supporting` or `impact: Maintenance`, or shipped tasks have no Goal/KPI link.
