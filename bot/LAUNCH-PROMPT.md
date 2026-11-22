# LAUNCH PROMPT — vip-bot (чистая сессия ИЗНУТРИ vip-bot/)

> Открой терминал с `cwd = .../vip-bike-site/vip-bot`, запусти `claude`, вставь блок ниже.
> Скелет уже собран координатором. Эта сессия делает БИЛД, начиная с шага 1 (порт модуля на SQLite).

---

```
Продолжаем dev-проект vip-bot — Telegram-бот VIP BIKE на форке рантайма KLOD-BOX. Чистая сессия, cwd = vip-bot/.

СНАЧАЛА загрузи контекст по порядку:
1. CLAUDE.md — стек (SQLite, не Postgres!), слои, запреты, Definition of Done
2. PRD.md — фичи (F1 агент договоров — ядро)
3. README.md — Implementation Status (что готово: скелет ✅; шаги 1-10 ⬜)
4. progress.md — запись 2026-06-09 (решения: SQLite, скилл-не-субагент, tsx, OCR=recognize.ts)
5. PLAN-2026-06-09-vip-bot-klodbox.md — план целиком (дельты вверху)
6. workspace/skills/contract-agent/SKILL.md — готовый скилл-агент договоров
7. modules/contract/ — сырые файлы ТРЕКа A (ещё на pg): lib/{recognize,contractDoc,contracts,db}.ts,
   lib/_types-FULL-from-site.ts (урезать до трека A), db/_schema-postgres-ORIGINAL.sql (портировать в SQLite),
   templates/contract-rental.docx, scripts/{gen-contract-sample,recognize-sample,make-contract-template}
Подтверди понимание статуса.

ЧТО УЖЕ ГОТОВО (скелет):
- Структура vip-bot/ (src пуст, workspace/, modules/contract/ с сырыми файлами, scripts/, bundled-skills/, tenants/vip-bike/).
- package.json (рантайм KLOD-BOX + docxtemplater/pizzip/better-sqlite3, БЕЗ pg), tsconfig (rootDir=src), .env.example.
- Continuity-доки + SKILL.md контракт-агента + refined-PLAN.

ЖЁСТКИЕ ПРАВИЛА (нарушение = критический баг):
- БД = SQLite (better-sqlite3, СИНХРОННО, без await в запросах). ⛔ НЕ Postgres, НЕ pg, НЕ DATABASE_URL.
- Договоры = SKILL (есть), НЕ субагент. ⛔ НЕ создавать .claude/agents/. Бот single-agent.
- src/ KLOD-BOX копировать ДОСЛОВНО (пост-v0.9.5), кастом только в workspace/ и modules/contract/.
- Фото документов НЕ в БД (только поля); после генерации чистить workspace/uploads/. ПДн = 152-ФЗ.
- Не выдумывать реквизиты/тарифы/VIN — нет данных → {{уточнить}}. НЕ тащить marketing-плагины Олега.
- Точечные правки (Edit > Write). Логировать в progress.md после каждого шага.

ШАГ 0 — СКИЛЛЫ/СУБАГЕНТЫ:
- superpowers первым; tech-spec (VPS/systemd/LibreOffice), docx (шаблон договора), debugger-dev при ошибках.
- Субагенты (TeamCreate + tmux, если параллелить): architect (opus — бот↔CLI/cli.ts), security (opus — ПДн/152-ФЗ),
  code-reviewer (sonnet), test-engineer/verifier (sonnet). Verifier ≠ автор.

ЗАДАЧА СЕССИИ (по PLAN, начни с шага 1):

ШАГ 1 — ВЫНОС МОДУЛЯ НА SQLite (modules/contract/):
  - types.ts: из lib/_types-FULL-from-site.ts оставить только Lessor, Client, ClientOcrFields, BikeUnit, RentalContract
    (убрать Model/ModelDetail/BikeNode/DetailIcon/LeadPayload/QuizAnswers). Сохранить как lib/types.ts, удалить _FULL.
  - db.ts: переписать pg.Pool → better-sqlite3 (sync). query() станет sync (без Promise). Открытие БД по CONTRACTS_DB_PATH
    (дефолт workspace/store/contracts.db), PRAGMA journal_mode=WAL. dbConfigured() → есть ли файл/путь.
  - schema.sql (SQLite-синтаксис из _schema-postgres-ORIGINAL.sql): SERIAL→INTEGER PRIMARY KEY AUTOINCREMENT;
    UUID DEFAULT → TEXT (id заполнять crypto.randomUUID() в коде); TIMESTAMPTZ/DATE→TEXT (ISO); BOOLEAN→INTEGER 0/1;
    JSONB→TEXT (JSON.stringify/parse в мапперах); NUMERIC→REAL; now()/CURRENT_DATE → проставлять в коде; убрать ::jsonb/date_part.
    Положить в db/schema.sql + db/migrations/001_init.sql (идентично). Применять при старте (CREATE TABLE IF NOT EXISTS).
  - contracts.ts: @/lib/db→./db, @/lib/types→./types; убрать await у query; параметры $1→? (better-sqlite3 позиционные ?);
    RETURNING * не поддерживается старым sqlite — после insert делать SELECT по lastInsertRowid/id; JSON-поля parse/stringify;
    nextContractNumber по году из contract_date (substr или сравнение ISO).
  - cli.ts (НОВЫЙ): аргументы recognize | gen-contract | migrate. recognize → recognizeClient → JSON в stdout.
    gen-contract → читает client JSON, createClient→createContract→getActiveLessor+getBikeUnit→generateContract→
    пишет .docx в workspace/store/ (или out/), attachContractDoc, печатает путь + №. migrate → применить schema.sql.
    Сверить вызовы CLI в SKILL.md (там `node modules/contract/cli.js`) с фактикой: либо гонять через tsx и поправить SKILL
    на `npx tsx modules/contract/cli.ts`, либо добавить компиляцию модуля в build. Реши и синхронизируй SKILL.md.
  - Verify (мок): `npm run contract:recognize-sample` → 19/19 (адаптируй скрипт под новые пути/sync при необходимости);
    `npm run contract:gen-sample` → валидный .docx (0 сырых {{плейсхолдеров}}, МСК-время, стабильный sha256) + строка в SQLite.

ШАГ 2 — КОПИЯ РАНТАЙМА KLOD-BOX (пост-v0.9.5):
  UP=../../KLOD-BOX
  rsync -a $UP/src/ src/
  rsync -a $UP/workspace/ workspace/   # затем НЕ затирать наш skills/contract-agent — он уже на месте; сверить
  cp $UP/workspace/.claude/settings.template.json workspace/.claude/
  cp $UP/scripts/{bootstrap-vps,seed-mcp-settings,install-default-skills}.sh scripts/
  for s in docx officecli pdf task-planner todo; do rsync -a $UP/bundled-skills/$s/ bundled-skills/$s/; done
  npm install → npm run typecheck (0) → npm run build (green). (Память бота — своя SQLite в workspace, отдельно от договоров.)

ШАГ 3 — СКИЛЛ В РОУТИНГ + ЛИЧНОСТЬ:
  В workspace/CLAUDE.template.md — отрендерить/адаптировать личность под VIP BIKE (ассистент оператора проката),
  добавить строку роутинга: «Договор, паспорт, ВУ, оформить аренду → skill contract-agent».
  Обрезать reference/ и skills/ до VIP-релевантных (telegram-output, tools-web, ops, calendar-dates + lean штатные).

ШАГ 4 — ТЕНАНТ: tenants/vip-bike/tenant.yaml (slug vip-bike, display «Бот VIP BIKE», операторы) + .env (из .env.example, ВРУЧНУЮ).

ШАГ 5 — E2E локально (тест-токен, RECOGNIZE_MOCK=1): npm run dev → прислать фото паспорта+ВУ → подтверждение полей в чат
  → .docx приходит в Telegram. Прогнать субагента security по ПДн (PASS).

ПОРЯДОК: skeleton-first где уместно; после каждого шага — запись в progress.md + обновить README статус.
ИЗОЛЯЦИЯ ОТ САЙТА: добавить vip-bot/ в ../.dockerignore и rsync-excludes деплоя сайта; ../.gitignore → vip-bot/node_modules, vip-bot/dist.

Подтверди план и начни с ШАГА 1.
```

---

## Эталоны / ссылки
- Upstream рантайма: `../../KLOD-BOX/` (src, workspace, scripts, bundled-skills) — пост-v0.9.5.
- Правило установки тенанта на VPS: `~/.claude/rules/klodbox-tenant-install.md`.
- Исходник ТРЕКа A (если нужен оригинал): `../lib/*`, `../db/schema.sql`, `../templates/contract-rental.docx`.

*Создан: 2026-06-09. Скелет готов, билд — с шага 1.*
