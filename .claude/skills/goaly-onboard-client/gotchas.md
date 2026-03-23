# Onboard Client — Gotchas

1. **Create Client before Contacts.** Contacts need `client_id` from the client file. If you create contacts first, the relation link will be missing.

2. **Create Project before Tasks.** Tasks need `project_id` from the project file. Same ordering constraint as above.

3. **Time tracking sheet formula columns.** Columns G and H need explicit formulas per row — they do NOT auto-extend:
   - G: `=GOOGLEFINANCE("CURRENCY:EURUSD")`
   - H: `=Fn*Gn` (Cost EUR x rate = Cost USD)

4. **Don't create contract until engagement terms are confirmed.** Step 6 asks [Owner] explicitly. Never assume a contract is needed or generate one without confirmed terms.

5. **Two-batch commit is mandatory.** Batch 1 (client + contacts + folder) must sync before Batch 2 (project + memory + references). This prevents orphan projects with no client link in Notion.

6. **notion_id not yet available after batch 1.** The sync engine writes `notion_id` back async. If it hasn't arrived by Step 11, omit `client_id` on the Project file and note it needs manual update.

7. **Strategy Notes inform contracts.** The "Watch for" items in contract review (Step 9) draw from the client's Strategy Notes. Never generate a contract without reading them first.

8. **Memory enrichment is mandatory.** Always update MEMORY.md Active Leads and `docs/claude/notion-reference.md`. These are the lookup tables every other skill depends on.

9. **Lazy directory creation.** Only create `docs/legal/`, `docs/research/`, `docs/project/` when a file actually needs them. No `.gitkeep` scaffolding.
