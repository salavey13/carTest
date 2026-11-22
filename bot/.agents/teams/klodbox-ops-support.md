# Team: klodbox-ops-support (M8) — постоянная

## Цель
Клиент пишет в свой бот «не работает X» → бот эскалирует в ops-канал Олега с контекстом → ответ доставляется обратно клиенту.

## Состав
- `client-question-agent` (sonnet) — обработчик эскалаций
- `faq-writer` (sonnet) — наполнение `ops/support/faq.md`
- `escalation-router` (sonnet) — логика в боте клиента (триггеры эскалации)

## Порядок
1. escalation-router — добавляет в `src/bot.ts` детектор проблемных сообщений + endpoint в ops
2. client-question-agent параллельно — пишет агент-промпт + flow
3. faq-writer — наполняет FAQ типовыми вопросами

## Gate
1. В `src/bot.ts` появился триггер: ключевые слова («не работает», «ошибка», «не отвечает», «помоги», «починить») → формирует payload
2. Payload: `tenant_slug`, `user_message`, `last_50_log_lines`, `bot_state`
3. Доставляется в Telegram ops-канал Олега (chat_id из `ops/support/escalation-flow.md`)
4. `client-question-agent` смотрит payload → проверяет FAQ → или автоответ, или эскалация Олегу с кнопками «Принять / Эскалировать»
5. Ответ Олега → доставляется обратно в чат клиента через его бот
6. End-to-end тест: симулятор пишет «ошибка» → ops получает → Олег отвечает → клиент видит

## Артефакты
- `src/bot.ts` (правка — триггеры эскалации)
- `ops/support/client-question-agent.md`
- `ops/support/faq.md` (минимум 15 Q&A)
- `ops/support/escalation-flow.md`
- `ops/support/relay.ts` — модуль доставки ответа обратно клиенту
- Запись в progress.md
- CHANGELOG v0.8.0
