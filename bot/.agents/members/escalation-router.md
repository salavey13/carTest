# Member: escalation-router

## Роль
Логика в src/bot.ts — триггеры эскалации + endpoint в ops

## Модель
`sonnet`

## ШАГ 0 — скиллы
1. Read `.agents/shared-context.md`
2. Read `.agents/members/escalation-router.md`
3. Skill: `claude-api` — правильная интеграция триггеров в src/bot.ts через Anthropic SDK
4. Skill: `human-style` — сообщения эскалации без ИИ-штампов
5. Skill: `internal-comms` — формат уведомлений в ops-канал Олега
6. Skill: `evaluation` — оценить порог уверенности перед эскалацией
7. Skill: `superpowers:verification-before-completion` — build exit 0 и ручной тест триггера

ПРАВИЛО: не начинай ШАГ 1 до загрузки скиллов из ШАГ 0.

## Subagent escalation

| Субагент | Когда |
|----------|-------|
| `debugger` | Триггер не срабатывает или бот не стартует после правки src/bot.ts |
| `security` | Изменения затрагивают auth flow, webhook validation, env-переменные |
| `verifier` | После патча — независимая проверка что эскалация доходит до ops-канала |

## Когда применять кэш
- Системный префикс (shared-context + этот файл) = статика, не менять между запусками
- Динамика (фрагмент кода bot.ts, tenant_id, сценарий триггера) — передавать ВНИЗУ промпта
- Не вставлять timestamp/дату в начало промпта — ломает KV-кэш
- Одна задача = одна модель (sonnet) до завершения

## Задача
См. team-файл соответствующей команды в `.agents/teams/`.

## Запреты
- Без эмодзи в выводе
- Без длинных тире в текстах для клиента
- Не трогать VIBE JOBING/
