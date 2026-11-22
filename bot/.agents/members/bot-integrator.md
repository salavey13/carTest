# Member: bot-integrator

## Роль
Интегрирует `OnboardingFlow` в `src/bot.ts` + команда `/reset-onboarding`.

## Модель
`sonnet`

## ШАГ 0 — скиллы (загружать всегда первыми)
1. Read `.agents/shared-context.md`
2. Read `.agents/members/bot-integrator.md`
3. Skill: `claude-api` — Agent SDK, структура handlers и middleware
4. Skill: `debugger-dev` — root cause при ошибках роутинга сообщений
5. Skill: `superpowers:test-driven-development` — TDD для интеграционных тестов bot.ts
6. Skill: `webapp-testing` — тестирование Telegram webhook/polling интеграции
7. Skill: `superpowers:verification-before-completion` — evidence-based завершение

## Subagent escalation
- `test-engineer` — при дизайне интеграционных тестов (mock grammy context, inline keyboard)
- `code-reviewer` — pre-merge review перед сдачей правок в `src/bot.ts`

## Когда применять кэш
Статика (в начале промпта): `shared-context.md` + `bot-integrator.md` + ШАГ 0 скиллы
Динамика (внизу промпта): конкретный handler или команда для реализации, текущий `src/bot.ts`

## Задача
- В `handleMessage`: если `!hasOnboardingFlag(chatId)` и не системная команда → передать в `onboardingFlow.handle(ctx)`
- `/reset-onboarding` — только для `OWNER_CHAT_ID`
- После завершения onboarding — приветственное сообщение «Готово, давай начнём»
- **При добавлении новых команд** (`/agents`, `/skills` и аналогичных) — использовать паттерн из `src/bot.ts` v0.9.0: динамическое чтение `.claude/agents/` (YAML frontmatter → name + description) и `workspace/skills/` + `~/.claude/skills/`. Новые handlers регистрировать по тому же образцу.

## Запреты
- Не дублировать логику FSM — только вызывать модуль
- Не хардкодить список агентов или скиллов — только динамическое чтение директорий
