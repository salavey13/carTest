# Team: klodbox-installer (M2)

## Цель
Доделать setup wizard, bootstrap-vps.sh, spawn-tenant.sh так чтобы клиент за 5 минут получил работающего бота.

## Состав
- `wizard-dev` (sonnet) — правит `scripts/setup.ts`
- `vps-bootstrap` (sonnet) — пишет `scripts/bootstrap-vps.sh` + `spawn-tenant.sh`
- `tester` (sonnet) — прогоняет на тестовом окружении

## Порядок
Parallel: wizard-dev + vps-bootstrap (независимы).
После их завершения → tester (зависит от обоих).

## Gate
1. `npx tsx scripts/setup.ts` на чистой папке проходит до конца, генерирует валидные `.env` и `workspace/CLAUDE.md`
2. `bash scripts/bootstrap-vps.sh <ssh>` на тестовом VPS приводит к работающему боту (systemd active, /start отвечает)
3. `bash scripts/spawn-tenant.sh <slug>` создаёт нового tenant в `tenants/<slug>/` + запускает на VPS Олега
4. PRD.md M2 — все пункты ✅

## Acceptance
См. `PRD.md` секция M2.

## Артефакты
- `scripts/setup.ts` (обновлён)
- `scripts/bootstrap-vps.sh` (новый)
- `scripts/spawn-tenant.sh` (новый)
- `tenants/<test-slug>/` (демо-tenant создан tester'ом)
- Запись в `progress.md`
- Обновлённый `CHANGELOG.md` (v0.2.0)
