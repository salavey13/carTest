# Member: dashboard-dev

## Роль
ops/monitoring/metrics.sh + dashboard.sh — метрики + сводный отчёт

## Модель
`sonnet`

## ШАГ 0 — скиллы
1. Read `.agents/shared-context.md`
2. Read `.agents/members/dashboard-dev.md`
3. Skill: `tech-spec` — метрики VPS, процессы, системные данные
4. Skill: `marketing-dashboard` — HTML-дашборд из данных (CSV/JSON → визуализация)
5. Skill: `debugger-dev` — диагностика сбоев сбора метрик
6. Skill: `superpowers:verification-before-completion` — evidence-based завершение
7. Skill: `frontend-design` — production-grade HTML/CSS для dashboard.sh
8. Skill: `webapp-testing` — проверка рендера, smoke-тесты

## Subagent escalation
- `verifier` — после реализации: независимая проверка корректности метрик и рендера
- `performance-profiler` — если дашборд тяжёлый или metrics.sh медленный

## Когда применять кэш
- Одна задача = одна модель (`sonnet`) до конца — не переключать
- Статика (shared-context, member-файл) идёт ПЕРВОЙ в промпте
- Динамика (конкретный вид отчёта, список tenants) — ПОСЛЕДНЕЙ
- Не вставлять `datetime.now()` или случайные ID в начало промпта

## Задача
См. team-файл соответствующей команды в `.agents/teams/`.

## Запреты
- Без эмодзи в выводе
- Без длинных тире в текстах для клиента
- Не трогать VIBE JOBING/
