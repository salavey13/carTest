# vip-bot — Telegram-бот VIP BIKE ELECTRO

Форк рантайма **KLOD-BOX** (Claude Code CLI через Telegram). Главный навык — **агент договоров аренды**: фото паспорта/ВУ → распознавание → готовый `.docx` договора в чат. Договоры — один из скиллов бота.

> Отдельный Node-проект внутри `vip-bike-site/`. Свой `node_modules`/`dist`, к Next-сайту отношения не имеет.

## Запуск (dev)
```bash
cd vip-bot
npm install
cp .env.example tenants/vip-bike/.env   # заполнить токены/ключи
npm run typecheck && npm run build
npm run dev                              # бот в polling
# договоры локально, мок-OCR:
npm run contract:recognize-sample        # ожидаем 19/19
npm run contract:gen-sample              # → .docx
```

## Implementation Status

| # | Фича | Статус |
|---|------|--------|
| 0 | Скелет проекта (dirs, package.json SQLite, tsconfig, .env.example, continuity-доки) | ✅ |
| 0 | Сырые файлы модуля договоров скопированы в `modules/contract/` (ещё на pg) | ✅ |
| 0 | Команда агентов перенесена из KLOD-BOX (`.agents/` 20 members + 4 vipbot-teams), 11 coding-субагентов, `.claude/settings.json` (tmux teams), `AGENTS.md` — проект автономен | ✅ |
| 1 | Порт модуля на **SQLite** (`db.ts`+`contracts.ts`→better-sqlite3 sync; `schema.sql`→SQLite; `types.ts`→только трек A) | ✅ |
| 2 | `modules/contract/cli.ts` (recognize \| gen-contract \| migrate) | ✅ |
| 3 | Verify модуля (verifier PASS): recognize-sample 19/19, gen-sample детерминизм sha256, CLI gen-contract → строка в SQLite (lessorId связан), typecheck 0 | ✅ |
| 4 | Копия рантайма KLOD-BOX v0.9.5 (`src/` 22 модуля, `workspace/` templates+reference+skills, lean `bundled-skills/` ×5, `scripts/` ×3); contract-agent+store сохранены | ✅ |
| 5 | typecheck 0 → build green (dist/ собран) | ✅ |
| 6 | Личность VIP в `CLAUDE.template.md` (ассистент оператора) + роутинг contract-agent (главный); обрезаны skills (5) / reference (4) / MCP (только zai-vision); welcome.md под VIP | ✅ |
| 7 | `tenants/vip-bike/tenant.yaml` ✅; `.env` — создаёт пользователь (секреты в vps-access.md, хук блокирует автосоздание) | 🚧 |
| 8 | E2E локально: фото → подтверждение → .docx в чат (мок) | ⬜ |
| 9 | Security-проход по ПДн модуля (PASS-with-rec): #1 шифрование at-rest+chmod600, #3 чистка фото, #4 consent, #5/#R1 path-guard, #7 — CLOSED. #2 (трансгран Z.AI) — юр-решение клиента; E2E-проход бота — после ШАГ 4-8 | 🚧 |
| 10 | Деплой на VPS (отдельная сессия, по получении боевых данных) | ⬜ |

## Документы
`CLAUDE.md` (конвенции) · `PRD.md` (фичи) · `progress.md` (решения) · `PLAN-2026-06-09-vip-bot-klodbox.md` (план) · `LAUNCH-PROMPT.md` (старт сессии).

*v0.1 | 2026-06-09*
