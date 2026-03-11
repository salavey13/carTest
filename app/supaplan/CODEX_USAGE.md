# Using SupaPlan in Codex

When running agents in Codex:

Agents should continuously poll SupaPlan.

---

Loop

1 pick_task
2 execute task
3 update status
4 repeat

---

Example agent logic

pick_task("core")

if task exists

execute

update_status("ready_for_pr")

---

PR must contain:

supaplan_task:<task_id>

GitHub workflow will finalize task.