# PLAN — VIP-BOT: бот VIP BIKE на рантайме KLOD-BOX, договоры = агент-скилл

> Refined-версия (утверждена Олегом 2026-06-09). Заменяет старый «grammY bot/» план трека A.

## Дельты против первой версии (применены)
1. **БД → SQLite, не Postgres.** Порт `lib/db.ts`+`lib/contracts.ts` на **better-sqlite3** (уже в рантайме KLOD-BOX). Убрать `pg`, `@types/pg`, `DATABASE_URL`, провижн Postgres. `schema.sql` → SQLite-синтаксис. Договоры пишутся в локальный SQLite ВСЕГДА. ⚠️ better-sqlite3 **синхронный** — при портаже из pg убрать `await` у запросов.
2. **«Агент договоров» = SKILL, не субагент.** Бот KLOD-BOX одноагентный, `.claude/agents/` нет, субагентов не спавнит (их вывод не доходит до чата — фикс v0.9.5). Реализуем как `workspace/skills/contract-agent/SKILL.md` — персона-«агент договоров», которую единый бот принимает по триггеру. Имя `contract-agent` сохраняем; физически — скилл. НЕ создавать `.claude/agents/`.
3. **Копировать KLOD-BOX пост-v0.9.5.** Лёгкий контекст: agent.ts без двойной загрузки CLAUDE.md, сжатый CLAUDE.template.md + reference/, settings.template.json без notionApi/zai-reader, bootstrap-vps.sh с рендером reference/. Не копировать старые версии.
4. **OCR: `recognize.ts` (прямой Z.AI)** — точнее generic-vision для документов, тот же `Z_AI_API_KEY`. MCP `zai-vision` — доступный фолбэк, но юр-выемку делает recognize.ts.

## Context
ТРЕК A (договоры) написан и верифицирован внутри `vip-bike-site/` (Next-монорепо): `lib/recognize`, `lib/contractDoc`, `lib/contracts`, db-схема, docxtemplater-шаблон 45 плейсхолдеров, sha256, МСК-время. Шаг 4 (сам бот) не сделан. Решение: не писать бота с нуля, а форкнуть рантайм KLOD-BOX как самостоятельный проект `vip-bike-site/vip-bot/`, где договоры — один из скиллов-агентов. Логику переиспользуем как TS-модуль через CLI; код бота не трогаем.

## Tradeoff (принято осознанно)
Форк рантайма KLOD-BOX в `vip-bot/` дублирует движок и расходится с upstream. Митигация: `src/` копируем дословно (ре-синхронизация = обычный diff), кастом — только в `workspace/` (личность, роутинг, скиллы) и `modules/contract/`.

## Целевая структура `vip-bike-site/vip-bot/`
```
vip-bot/
├── CLAUDE.md README.md progress.md PRD.md       # continuity (✅ созданы)
├── package.json tsconfig.json .env.example      # ✅ merge рантайм+модуль, БЕЗ pg
├── src/                      # дословная копия KLOD-BOX/src (пост-v0.9.5)
├── workspace/
│   ├── CLAUDE.template.md    # личность VIP + таблица роутинга (+строка contract-agent)
│   ├── welcome.md active-context.md
│   ├── reference/*.md        # подмножество: telegram-output, tools-web, ops, calendar-dates
│   ├── skills/{<lean штатные>, contract-agent/SKILL.md}   # ✅ SKILL.md готов
│   └── .claude/settings.template.json    # MCP: zai-vision (OCR), zai-search, playwright
├── modules/contract/         # вынос ТРЕКа A + CLI (✅ сырые файлы скопированы)
│   ├── lib/{db,types,contracts,recognize,contractDoc}.ts   # db+contracts → SQLite
│   ├── db/{schema.sql, migrations/001_init.sql}            # SQLite-синтаксис
│   ├── templates/contract-rental.docx
│   ├── scripts/{gen-contract-sample,recognize-sample,make-contract-template}
│   └── cli.ts                ← НОВЫЙ CLI: recognize | gen-contract | migrate
├── scripts/                  # bootstrap-vps.sh, seed-mcp-settings.sh, install-default-skills.sh (адапт.)
├── bundled-skills/           # lean: docx, officecli, pdf, task-planner, todo
└── tenants/vip-bike/{tenant.yaml, .env.example}
```
> НЕ тащить marketing-плагины Олега (content-dept, razvedka, china-buyer).

## Флоу агента договоров
1. Оператор: «новый договор» + фото паспорта + ВУ + срок/тариф/депозит/байк.
2. `src/media.ts` сохраняет фото в `workspace/uploads/`, Claude получает пути.
3. Скилл → Bash: `cli recognize --passport <p> --license <l>` → JSON полей (recognize.ts → Z.AI vision; без ключа — мок).
4. Бот показывает поля оператору ТЕКСТОМ на подтверждение/правку.
5. Подтверждение → Bash: `cli gen-contract --client <json> --bike <id> --start … --end … --tariff …` → `.docx` + sha256 + запись в SQLite, возвращает путь.
6. Ответ содержит `<file>/abs/path/contract-VB-2026-NNN.docx</file>` → `src/bot.ts` (sendTaggedFiles) шлёт документ в Telegram.
7. После генерации — удалить исходные фото из `workspace/uploads/`.

CLI — единственный новый «клей»: оборачивает функции модуля в команды (вход/выход JSON). Юр-критичный путь детерминирован в TS.

## Критические файлы
**Копировать как есть (рантайм пост-v0.9.5):** `KLOD-BOX/src/*`, `KLOD-BOX/workspace/{CLAUDE.template.md, reference/, lean skills, .claude/settings.template.json}`, `KLOD-BOX/scripts/{bootstrap-vps,seed-mcp-settings,install-default-skills}.sh`, `KLOD-BOX/bundled-skills/{docx,officecli,pdf,task-planner,todo}`.
**Переиспользовать (вынос ТРЕКа A, не переписывать логику):** `vip-bike-site/lib/{recognize,contractDoc,contracts,db,types}.ts`, `db/schema.sql`, `templates/contract-rental.docx`, sample-скрипты → `vip-bot/modules/contract/` (сырые — уже скопированы).
- Правки выноса: (а) `contracts.ts` алиасы `@/lib/db`→`./db`, `@/lib/types`→`./types`; (б) `db.ts`+`contracts.ts` порт pg→better-sqlite3 (sync, без await; schema.sql SQLite; JSONB→TEXT+JSON.parse/stringify; UUID→`lower(hex(randomblob(16)))` или crypto.randomUUID; `now()`→`datetime('now')`/ISO в коде; `date_part('year', …)` → по `contract_date`); (в) `types.ts` — оставить только `Lessor, Client, ClientOcrFields, BikeUnit, RentalContract` (убрать Model/ModelDetail/BikeNode/LeadPayload/QuizAnswers).
**Создать новое:** `modules/contract/cli.ts`, `workspace/skills/contract-agent/SKILL.md` (✅), `tenants/vip-bike/tenant.yaml`, continuity-доки (✅), `.env.example` (✅).

## npm-зависимости (✅ в package.json)
Рантайм: `@anthropic-ai/claude-agent-sdk, grammy, @grammyjs/runner, better-sqlite3, cron-parser, pino, pino-pretty`. Договоры: `docxtemplater, pizzip`. ⛔ БЕЗ pg. dev: `tsx, typescript, @types/node, @types/better-sqlite3, vitest`. ⛔ БЕЗ @types/pg.

## Env (`tenants/vip-bike/.env`) — ✅ шаблон в .env.example
`TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_ID, Z_AI_API_KEY, Z_AI_VISION_MODEL (glm-4.5v {{уточнить}}), Z_AI_BASE_URL, CONTRACTS_DB_PATH (дефолт workspace/store/contracts.db), RECOGNIZE_MOCK`. Реальный `.env` создаёт пользователь.

## Изоляция от Next-сайта
`vip-bot/` — отдельный Node-проект. Добавить в `.dockerignore` + rsync-excludes деплоя сайта; в `.gitignore` (`vip-bot/node_modules`, `vip-bot/dist`); подтвердить, что `next build` не компилирует `vip-bot/`.

## Шаги реализации (для сессии изнутри vip-bot/)
1. **Вынос модуля → SQLite** (db.ts+contracts.ts→better-sqlite3, schema.sql→SQLite, types.ts→трек A, @/→relative, +cli.ts). Verify (мок): `npm run contract:recognize-sample` → 19/19; `npm run contract:gen-sample` → .docx + запись в SQLite.
2. **Копия рантайма KLOD-BOX** (пост-v0.9.5) → src/ + workspace/ + lean bundled-skills/ + scripts/. `npm install` → typecheck 0 → build green.
3. **Скилл-агент** — SKILL.md (✅) + строка в роутинге `CLAUDE.template.md`; адаптировать личность под VIP; обрезать reference/skills до VIP-релевантных; сверить cli-вызов в SKILL (`tsx cli.ts` vs `node cli.js`) с фактическим cli.ts.
4. **Тенант** `tenants/vip-bike/tenant.yaml` + `.env`.
5. **E2E локально** (`npm run dev`, тест-токен, мок-OCR): фото → подтверждение в чат → .docx в Telegram. Прогон субагента `security` по ПДн.
6. **Деплой VPS** — отдельной сессией, по получении боевых токенов/реквизитов.

## 152-ФЗ / безопасность (паспортные данные!)
Фото не хранить в БД — только распознанные поля; после генерации чистить `workspace/uploads/`. Доступ только операторам (`ALLOWED_CHAT_ID`). Согласие на ПДн — пункт договора. Секреты — только в `.env` (chmod 600). Обязательный проход субагента `security`.

## Открытые данные клиента (боевой режим — {{уточнить}})
Реквизиты `lessor`; тарифы/депозит/прайс повреждений + адрес возврата; per-unit `bike_units` (VIN/год/цвет); `Z_AI_API_KEY`+модель; `TELEGRAM_BOT_TOKEN`+telegram_id операторов; VPS (SSH/ОС/домен/LibreOffice только если нужен PDF). ⛔ Postgres НЕ нужен.

## ШАГ 0 — скиллы/субагенты
`superpowers` первым; `tech-spec` (VPS/systemd/LibreOffice), `docx`, `debugger-dev`. Субагенты: `architect` (opus — интеграция бот↔CLI, FSM скилла), `security` (opus — 152-ФЗ/ПДн), `code-reviewer` (sonnet), `test-engineer`/`verifier` (sonnet). Параллельные агенты — ТОЛЬКО TeamCreate + tmux. Verifier ≠ автор.

## Verification (E2E)
1. Модуль (мок): recognize-sample 19/19; gen-contract-sample → .docx, 0 сырых `{{плейсхолдеров}}`, МСК-время, стабильный sha256, строка в SQLite.
2. CLI: `cli recognize …` / `gen-contract …` → корректный JSON / путь к .docx.
3. Бот: typecheck 0, build green.
4. E2E: `npm run dev` тест-токеном → фото → подтверждение → .docx в чате (мок-OCR, SQLite).
5. Security: PASS по ПДн.
6. DoD + запись в `progress.md`.
