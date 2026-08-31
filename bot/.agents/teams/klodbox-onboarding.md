# Team: klodbox-onboarding (M3)

## Цель
In-bot onboarding через Telegram: после первого `/start` клиент проходит 5-7 вопросов → персональный CLAUDE.md.

## Состав
- `state-machine` (sonnet) — `src/onboarding.ts` (state machine + SQLite таблица)
- `bot-integrator` (sonnet) — интеграция в `src/bot.ts`, команда `/reset-onboarding`
- `composio-glue` (sonnet) — проверяет что Composio MCP поднят через bootstrap-vps.sh ШАГ 7.6 (не генерирует OAuth URL — это делает Composio backend при `/connect <toolkit>`)

## Порядок
1. state-machine — пишет модуль, добавляет миграцию SQLite
2. bot-integrator — параллельно, интегрирует в src/bot.ts
3. composio-glue — независимо, проверяет и при необходимости чинит ШАГ 7.6 bootstrap-vps.sh

## Gate
1. Чистый деплой → /start → проходит 5 вопросов → бот говорит «Готово»
2. Сгенерирован `workspace/CLAUDE.md` из `workspace/CLAUDE.template.md` с заполненными placeholders
3. Флаг `.onboarded` создан
4. `/reset-onboarding` от владельца сбрасывает state
5. Composio MCP доступен: `/connect notion` от клиента открывает OAuth через Composio backend, `mcp__composio__*` tools работают в агентах
6. PRD.md M3 — все пункты ✅

## Артефакты
- `src/onboarding.ts` (новый)
- `src/bot.ts` (правки)
- `workspace/CLAUDE.template.md` (placeholders проверены)
- Тест: `tests/onboarding.test.ts`
- Запись в `progress.md`
- CHANGELOG v0.3.0
