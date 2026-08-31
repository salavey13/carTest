# Team: vipbot-contract-module (Шаг 1 PLAN)

## Цель
Вынести ТРЕК A в `modules/contract/` и портировать с Postgres на **SQLite** (better-sqlite3, sync), написать `cli.ts`, верифицировать в мок-режиме.

## Состав
- `architect` (opus) — проектирует порт `db.ts`/`contracts.ts` (pg→better-sqlite3, sync, `?`-параметры, RETURNING→SELECT, JSONB→TEXT), схему SQLite, интерфейс `cli.ts`.
- `state-machine` (sonnet) — реализует `cli.ts` (recognize | gen-contract | migrate), флоу фото→JSON→.docx.
- `security` (opus) — аудит ПДн/152-ФЗ: паспортные данные, очистка `workspace/uploads/`, секреты, trust boundaries.
- `test-engineer` (sonnet) — адаптирует sample-скрипты под sync/новые пути.
- `verifier` (sonnet, ≠ автор) — FRESH-прогон gate.

## Порядок
architect (дизайн) → parallel: state-machine (cli.ts) + патч `db/contracts/types/schema` → test-engineer → verifier. security — параллельно, ревью ПДн-кода.

## Gate
1. `npm run contract:recognize-sample` → **19/19** (мок).
2. `npm run contract:gen-sample` → валидный `.docx`: 0 сырых `{{плейсхолдеров}}`, МСК-время, стабильный sha256, строка записана в SQLite (`workspace/store/contracts.db`).
3. `node_modules/.bin/tsx modules/contract/cli.ts recognize …` и `… gen-contract …` → корректный JSON / путь к `.docx`.
4. `npm run typecheck` (модуль) — 0 ошибок. ⛔ ни одного `pg`/`await query`/`DATABASE_URL`.
5. security — вердикт PASS по ПДн.

## Артефакты
- `modules/contract/lib/{db,contracts,types}.ts` (SQLite), `db/schema.sql`+`migrations/001_init.sql` (SQLite), `cli.ts` (новый).
- Удалить `lib/_types-FULL-from-site.ts`, `db/_schema-postgres-ORIGINAL.sql` после порта.
- Сверить cli-вызовы в `workspace/skills/contract-agent/SKILL.md` с фактикой (`tsx cli.ts` vs `node cli.js`).
- Запись в `progress.md`, статус в `README.md`.
