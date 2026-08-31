# Shared Context — для всех агентов vip-bot

> Подгружается КАЖДЫМ тимейтом как часть ШАГ 0. Общие соглашения проекта, чтобы не дублировать в каждом member-файле.
> Команда унаследована от KLOD-BOX (vip-bot — форк его рантайма) и адаптирована под этот проект.

## Что такое vip-bot

Telegram-бот VIP BIKE ELECTRO на **форке рантайма KLOD-BOX** (Claude Code CLI через Telegram, single-agent). Главный навык — **агент договоров аренды**: оператор шлёт фото паспорта/ВУ + параметры → бот распознаёт (Z.AI vision), подтверждает поля в чате, генерирует готовый `.docx` договора, отдаёт файлом. Договоры — один из скиллов.

Лежит ВНУТРИ `vip-bike-site/` как **отдельный Node-проект** (свой `node_modules`/`dist`), к Next-сайту отношения не имеет.

## Структура проекта (что где)

| Папка | Что |
|-------|-----|
| `src/` | Копия рантайма KLOD-BOX (bot.ts, agent.ts, media.ts, memory.ts, …). Копировать ДОСЛОВНО (пост-v0.9.5), кастом минимизировать — ради ре-синхронизации с upstream |
| `workspace/` | Кастом тенанта: `CLAUDE.template.md` (личность+роутинг), `reference/*.md`, `skills/` (вкл. `contract-agent/SKILL.md`), `.claude/settings.template.json`, `store/` (SQLite), `uploads/` (входящие фото — чистить!) |
| `modules/contract/` | Вынесенный ТРЕК A: `lib/{recognize,contractDoc,contracts,db,types}.ts`, `db/`, `templates/`, `scripts/`, `cli.ts`. Переиспользуем, юр-логику НЕ переписываем |
| `bundled-skills/` | lean-подмножество: docx, officecli, pdf, task-planner, todo |
| `scripts/` | bootstrap-vps.sh, seed-mcp-settings.sh, install-default-skills.sh (адапт. из KLOD-BOX) |
| `tenants/vip-bike/` | `tenant.yaml` + `.env` (секреты — вручную пользователем) |
| `.agents/` | Эта команда агентов проекта (members/ + teams/) |
| `agents/` | 11 generic coding-субагентов (architect, security, code-reviewer, verifier, …) для `subagent_type` |

## Стек / глобальные соглашения

- TypeScript ESM, Node 20+. Build: `npm run build` (tsc, `src→dist`). Модуль договоров гоняется через `tsx` (не билдится).
- **БД = SQLite (better-sqlite3, СИНХРОННО, без `await`).** ⛔ НЕ Postgres, НЕ `pg`, НЕ `DATABASE_URL`. Файл — `CONTRACTS_DB_PATH` (дефолт `workspace/store/contracts.db`).
- **OCR = `recognize.ts`** напрямую в Z.AI (`Z_AI_API_KEY`, `Z_AI_VISION_MODEL`). Без ключа / `RECOGNIZE_MOCK=1` — детерминированный мок.
- Точечные правки (Edit > Write для существующих). `set -euo pipefail` для bash. Fail-fast в тестах.
- Без эмодзи в исходниках и выводе бота. Без длинных тире в текстах для клиента/оператора.
- Любая фаза завершается записью в `progress.md` + обновлением статуса в `README.md`.

## Definition of Done

1. Поведение работает (happy + edge). 2. `npm run typecheck` = 0, `npm run build` exit 0. 3. Модуль договоров (мок): recognize-sample 19/19; gen-contract-sample → валидный `.docx` (0 сырых `{{плейсхолдеров}}`, МСК-время, стабильный sha256, строка в SQLite). 4. Для ПДн-кода — проход `security` (PASS). 5. `progress.md` + `README.md` обновлены.

## Запреты (для всех тимейтов)

- ⛔ Postgres / `pg` / `DATABASE_URL` — только SQLite.
- ⛔ `.claude/agents/` для договоров и спавн субагентов из бота — договоры это SKILL, бот single-agent (вывод субагента не дойдёт до чата — фикс KLOD-BOX v0.9.5).
- ⛔ Менять `src/*` сверх необходимого (расхождение с upstream KLOD-BOX).
- ⛔ Хранить фото документов в БД — только распознанные поля; после генерации чистить `workspace/uploads/` (152-ФЗ, паспортные данные).
- ⛔ Коммитить секреты — `tenants/*/.env*`, токены, ключи.
- ⛔ Выдумывать реквизиты `lessor` / тарифы / VIN — нет данных → `{{уточнить}}`.
- ⛔ Тащить marketing-плагины Олега (content-dept, razvedka, china-buyer) — держим стартовый контекст лёгким (окно z.ai 200k).
- ⛔ `subagent_type="general-purpose"` если есть специализированный.
- Терминология: «бот VIP BIKE» (не уменьшительные формы).

## Источники истины

- Цены/спеки моделей — `../../MARKETING DEPT/VIP-BIKE-ELECTRO/brand/offer-core.md` (НЕ выдумывать).
- Оригинал ТРЕКа A (если нужен) — `../lib/*`, `../db/schema.sql`, `../templates/contract-rental.docx`.
- Upstream рантайма — `../../KLOD-BOX/` (src, workspace, scripts, bundled-skills) — пост-v0.9.5.
- Правило установки тенанта на VPS — `~/.claude/rules/klodbox-tenant-install.md`.

## Параллельная работа

- Параллельные тимейты — ТОЛЬКО `TeamCreate` + `Agent(team_name=..., name=...)`, `teammateMode: tmux`. ⛔ `Agent(run_in_background=true)` без team_name = критический баг.
- Каждый тимейт в ШАГ 0 читает этот `shared-context.md` + свой `.agents/members/<name>.md`.
- Модель указывается явно (haiku/sonnet/opus, `~/.claude/rules/agent-model-selection.md`). Verifier ≠ автор.

## Связанные документы

- `CLAUDE.md` — конвенции проекта · `PRD.md` — фичи · `progress.md` — журнал · `README.md` — статус
- `PLAN-2026-06-09-vip-bot-klodbox.md` — план · `LAUNCH-PROMPT.md` — старт сессии
- `.agents/README.md` — команды (teams) и как добавить агента · `AGENTS.md` — агенты бота (в Telegram)

*Адаптировано из KLOD-BOX/.agents/shared-context.md под vip-bot, 2026-06-09.*
