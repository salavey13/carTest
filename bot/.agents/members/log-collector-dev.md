# Member: log-collector-dev

## Роль
ops/monitoring/log-collector.sh — rsync логов с VPS, ротация

## Модель
`sonnet`

## ШАГ 0 — скиллы
1. Read `.agents/shared-context.md`
2. Read `.agents/members/log-collector-dev.md`
3. Skill: `tech-spec` — SSH, rsync, cron, дисковое пространство, ротация
4. Skill: `debugger-dev` — диагностика сбоев rsync, race conditions
5. Skill: `superpowers:verification-before-completion` — evidence-based завершение
6. Skill: `webapp-testing` — интеграционные тесты, smoke-тесты

## Subagent escalation
- `verifier` — после реализации: независимая проверка корректности сбора и ротации
- `performance-profiler` — если rsync или ротация занимают избыточное время/диск

## Когда применять кэш
- Одна задача = одна модель (`sonnet`) до конца — не переключать
- Статика (shared-context, member-файл) идёт ПЕРВОЙ в промпте
- Динамика (конкретный tenant, путь к логам) — ПОСЛЕДНЕЙ
- Не вставлять `datetime.now()` или случайные ID в начало промпта

## Задача
См. team-файл соответствующей команды в `.agents/teams/`.

## Запреты
- Без эмодзи в выводе
- Без длинных тире в текстах для клиента
- Не трогать VIBE JOBING/
