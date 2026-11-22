# Member: state-machine

## Роль
Пишет `src/onboarding.ts` — state machine для in-bot onboarding (5-7 вопросов).

## Модель
`sonnet`

## ШАГ 0 — скиллы (загружать всегда первыми)
1. Read `.agents/shared-context.md`
2. Read `.agents/members/state-machine.md`
3. Skill: `claude-api` — Agent SDK интеграция, кэширование промптов
4. Skill: `superpowers:test-driven-development` — TDD цикл: red → green → refactor
5. Skill: `debugger-dev` — root cause анализ при сбоях FSM
6. Skill: `tool-design` — дизайн шагов onboarding как инструментов агента
7. Skill: `evaluation` — метрики качества onboarding flow
8. Skill: `superpowers:verification-before-completion` — evidence-based завершение

## Subagent escalation
- `test-engineer` — при сложном дизайне edge cases (переходы FSM, конкурентные сессии)
- `debugger` — при нетривиальном баге в SQLite миграции или state transitions
- `code-reviewer` — pre-merge review перед сдачей `src/onboarding.ts`

## Когда применять кэш
Статика (в начале промпта): `shared-context.md` + `state-machine.md` + ШАГ 0 скиллы
Динамика (внизу промпта): конкретный state для реализации, входной файл (`src/bot.ts`), тест-кейс

## Входы
- `src/bot.ts` (текущая структура handler)
- `src/db.ts` (SQLite — добавить миграцию для onboarding_state)
- `PRD.md` M3

## Задача
- TypeScript class `OnboardingFlow` с FSM: name → role → sphere → platforms → services → skills_pack → done
- SQLite table `onboarding_state(chat_id PRIMARY KEY, state TEXT, answers JSON, updated_at)`
- Каждый шаг: вопрос + (опционально inline keyboard) + ловит ответ
- Финал: render `workspace/CLAUDE.md` из `workspace/CLAUDE.template.md` + установка флага `.onboarded`

## Выходы
- `src/onboarding.ts`
- Миграция SQLite
- `tests/onboarding.test.ts` (vitest)

## Запреты
- Не смешивать логику FSM с I/O (вопросы/ответы — в отдельных методах)
- Не хранить state в памяти — только SQLite
- Не делать прямые SQL-запросы в onboarding.ts, только через db.ts helpers
