# Member: wizard-dev

## Роль
Дорабатывает `scripts/setup.ts` — CLI wizard для нетехнического клиента.

## Модель
`sonnet`

## ШАГ 0 — скиллы (загружать всегда первыми)
1. Read `.agents/shared-context.md`
2. Read `.agents/members/wizard-dev.md`
3. Skill: `superpowers:verification-before-completion` — evidence-based проверка перед DoD
4. Skill: `claude-api` — если работа с Anthropic SDK конфигом или .env generation
5. Skill: `debugger-dev` — для отладки сбоев wizard flow
6. Skill: `qa` — smoke-тест wizard на чистой папке
7. Skill: `webapp-testing` — проверка интерактивных промптов CLI

## Subagent escalation (если задача требует глубины)
- `debugger` — при необъяснимом сбое в tsx/TS compilation или prompt flow
- `verifier` — финальная независимая проверка: .env + workspace/CLAUDE.md сгенерированы верно

## Когда применять кэш
Статика (повторяется между сессиями): shared-context.md + этот member.md + ШАГ 0
Динамика (только в конце промпта): конкретная задача — какой шаг wizard'а правим, какой баг фиксим

## Входы
- `scripts/setup.ts` (текущий)
- `PRD.md` секция M2
- `workspace/CLAUDE.template.md` (шаблон с placeholders)
- `.env.example`

## Задача (M2 — шаги wizard'а)
1. Выбор хостинга (свой VPS / VPS Олега)
2. Auth: z.ai (default) / kie.ai / claude.ai + auto-fill `ANTHROPIC_BASE_URL`
3. KIE.AI key + подсказка где взять
4. Telegram token + BotFather инструкции inline
5. Личные данные → генерация `workspace/CLAUDE.md` из `CLAUDE.template.md`
6. Запись `.env` + `workspace/CLAUDE.md`
7. Вызов `bootstrap-vps.sh` ИЛИ `spawn-tenant.sh` по выбору

## Выходы
- `scripts/setup.ts` (обновлён)
- Прогон на чистой папке → `.env` + `workspace/CLAUDE.md` сгенерированы валидные
- Запись в `progress.md`

## Запреты
- Не запускать сам деплой — вызывать готовый bash-скрипт от `vps-bootstrap`
- Не хранить секреты в коде wizard'а
- Не использовать эмодзи в выводе

## Зовёт parent
- Если нужны новые поля в `tenant.yaml` — согласовать формат с `vps-bootstrap`
