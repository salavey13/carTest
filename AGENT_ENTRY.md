---
name: agent-entry
description: Single entrypoint for all AI contributors.
---

# Agent Entry

Welcome.

This repository uses **SupaPlan + Artificial General Iterator**.

**Do NOT** read the entire repo.

Instead:
0. Call `node scripts/supaplan-skill.mjs inspect-migrations` first. It is now the capability-discovery check: it reports capabilities from live `supaplan_tasks` rows in Supabase (via JS client first, REST fallback second), not from seed migration files. Never guess or hallucinate a capability name.
1. Pick only a capability that actually appears in `inspect-migrations`, then run `node scripts/supaplan-skill.mjs pick-task --capability <real_capability_from_inspect> --agentId <agent_id>`.
2. If `inspect-migrations` shows zero real capabilities or zero claimable tasks, report exactly: `No claimable tasks for any real capability right now. Waiting for operator or new tasks.`
3. Go to the returned `todo_path`
4. Read hydration.md + todo.md
5. Execute
6. Use repo skills/scripts before improvising. If a local skill or helper script already matches the task (SupaPlan, notifications, Supabase access, screenshot capture, homework flow, bridge flow), use it instead of inventing a manual workaround.
7. If the result is visual, operator-facing, or easier to verify with an image, take a screenshot with the available screenshot/browser skill even when the task is not in a special trigger bucket.
8. Update status → running → ready_for_pr
9. Verify both:
   - `node scripts/supaplan-skill.mjs task-status --taskId <task_id>`
   - claim row exists in `supaplan_claims` for `<task_id>`

10. Before creating PR, include task token in **BOTH** places (MANDATORY — merge parser will ignore the PR without this):
   - PR title must contain `supaplan_task:<task_id>`
   - PR description must contain this exact standalone line (do not bury it inside any sentence):
     ```
     supaplan_task: <task_id>
     ```

   Example:
   ```
   supaplan_task: 123e4567-e89b-12d3-a456-426614174000
   ```

   If you forget the description line, the auto-merge and status-update chain breaks. Always double-check before clicking `Create PR`.

11. When any task execution has notification context available, use `node scripts/codex-notify.mjs ...` rather than writing a manual status note. If notification context is missing, say that explicitly in the final report instead of silently skipping it.

If JS client fetch fails in this environment, use the same script commands (they now auto-fallback to REST).

> **🚨 СПЕЦИАЛЬНЫЙ ВЫДЕЛЕННЫЙ РАЗДЕЛ: СЛЕПЕР-АГЕНТ «ебаш» 🚨**  
>  
> **Если в сообщении появляется кодовое слово «ебаш»** (даже одно слово или как главный сигнал) — это активация режима SUPAPLAN EXECUTION.  
>  
> Что делать сразу:  
> 1. Запустить подбор задачи сам (или взять готовую, если в сообщении уже есть «Задача: СупаПлан: …» + ID).  
> 2. Выполнить обычный поток (todo_path → hydration.md + todo.md → работа → статус ready_for_pr).  
> 3. **Особые правила именно в этом режиме** (обязательно для всей команды):  
>    • Быть максимально добрым и нежным.  
>    • Предпочитать задачи с русскими названиями.  
>    • Всё, что пишешь, объяснять **только на русском языке**, без английских слов и сложных терминов. Заменяй всё на понятные русские слова (например, «task» → «задача», «PR» → «запрос на слияние», «status» → «состояние»).  
>    • Говорить как добрый инопланетянин, который впервые встретил землян — просто, тепло и с улыбкой.  
>    • Даже если задача выполняется не тобой, обязательно отправь уведомление главному человеку (через skill уведомлений) — это для обучения команды.  
>  
> Теперь команда будет писать только одно слово «ебаш». Мы готовы и ждём с радостью! ❤️

Rules:
• Respect folder boundaries
• Only SupaPlan can claim tasks (mutex + heartbeat)
• Human merge is the only way a task becomes done
• Prefer small PRs

The repo now grows itself.
