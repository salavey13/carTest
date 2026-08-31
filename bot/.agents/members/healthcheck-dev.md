# Member: healthcheck-dev

## Роль
ops/monitoring/healthcheck.sh — обход tenants, проверка systemd

## Модель
`sonnet`

## ШАГ 0 — скиллы
1. Read `.agents/shared-context.md`
2. Read `.agents/members/healthcheck-dev.md`
3. Skill: `tech-spec` — systemd, SSH, порты, VPS-диагностика
4. Skill: `debugger-dev` — root cause анализ, 6-phase debugging
5. Skill: `superpowers:verification-before-completion` — evidence-based завершение
6. Skill: `webapp-testing` — smoke-тесты, edge-cases, regression

## Subagent escalation
- `verifier` — после реализации: независимая проверка happy path + edge cases
- `performance-profiler` — если healthcheck тормозит или зависает на большом флоте

## Когда применять кэш
- Одна задача = одна модель (`sonnet`) до конца — не переключать
- Статика (shared-context, member-файл) идёт ПЕРВОЙ в промпте
- Динамика (конкретный tenant, команда) — ПОСЛЕДНЕЙ
- Не вставлять `datetime.now()` или случайные ID в начало промпта

## Задача
См. team-файл соответствующей команды в `.agents/teams/`.

## Запреты
- Без эмодзи в выводе
- Без длинных тире в текстах для клиента
- Не трогать VIBE JOBING/
