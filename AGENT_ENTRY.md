---
name: agent-entry
description: Single entrypoint for all AI contributors.
---

# Agent Entry

Welcome.

This repository uses **SupaPlan + Artificial General Iterator**.

**Do NOT** read the entire repo.

Instead:
1. Call `node scripts/supaplan-skill.mjs pick-task --capability <your_capability> --agentId <agent_id>`
2. Go to the returned `todo_path`
3. Read hydration.md + todo.md
4. Execute
5. Update status → running → ready_for_pr
6. Verify both:
   - `node scripts/supaplan-skill.mjs task-status --taskId <task_id>`
   - claim row exists in `supaplan_claims` for `<task_id>`

7. Before creating PR, include task token in both places for merge automation (MANDATORY, merge parser depends on this):
   - PR title contains `supaplan_task:<task_id>`
   - PR description contains `supaplan_task: <task_id>` on its own standalone line (do not bury inside sentence)

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
