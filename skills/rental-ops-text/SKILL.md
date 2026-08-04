---
name: rental-ops-text
description: >
  Text-based rental lifecycle operations for VIP Bike. List, show, extend,
  close, find stuck rentals, and see today's returns — all from Telegram.
  Wraps Supabase queries + mirrors the web app's extendRental + close logic.
  Trigger phrases (RU): "продли аренду", "закрой аренду", "список аренд",
  "просроченные аренды", "возвраты сегодня", "детали аренды", "карточка аренды",
  "статус аренды".
  Trigger phrases (EN): "extend rental", "close rental", "list rentals",
  "overdue rentals", "returns today", "rental detail".
---

# Rental Ops (text) — VIP Bike

Триггер-фразы (RU): **`продли аренду`**, **`закрой аренду`**, **`список аренд`**, **`просроченные аренды`**, **`возвраты сегодня`**, **`детали аренды`**, **`карточка аренды`**, **`статус аренды`**.
Триггер-фразы (EN): `extend rental`, `close rental`, `list rentals`, `overdue rentals`, `returns today`, `rental detail`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/rental/[id]` + analytics. Позволяет оператору управлять жизненным циклом аренды прямо из Telegram: смотреть список, продлевать, закрывать, находить просроченные.

## When to Use

- Нужно продлить аренду (создать новую с тем же арендатором и байком)
- Нужно закрыть аренду (с одометром, состоянием, депозитом)
- Нужно посмотреть активные/просроченные аренды
- Нужно увидеть возвраты на сегодня
- Нужно посмотреть детали конкретной аренды (байк, арендатор, даты, одометр, депозит, задачи)

## Script

```bash
node scripts/rental-ops-skill.mjs <command> [options]
```

## Commands

### 1. `list-rentals` — список аренд

```bash
# Активные аренды (по умолчанию)
node scripts/rental-ops-skill.mjs list-rentals

# Только просроченные
node scripts/rental-ops-skill.mjs list-rentals --overdue

# Все статусы
node scripts/rental-ops-skill.mjs list-rentals --status all

# Завершённые
node scripts/rental-ops-skill.mjs list-rentals --status completed --limit 10
```

Output: JSON array с `rentalId`, `bike`, `status`, `endDate`, `totalCost`, `overdue` (если просрочена).

### 2. `show-rental <rentalId>` — полная карточка

```bash
node scripts/rental-ops-skill.mjs show-rental a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Output: bike, renter (name, phone, TG chat), dates, odometer, deposit, todos (with completion %).

### 3. `returns-today` — возвраты на сегодня

```bash
node scripts/rental-ops-skill.mjs returns-today
```

Output: rentals with `returnTime`, `bike`, `totalCost`, `overdue` flag.

### 4. `stuck` — просроченные аренды

```bash
node scripts/rental-ops-skill.mjs stuck
```

Output: active rentals past their end date, with `hoursOverdue`.

### 5. `extend` — продлить аренду (создать новую)

```bash
# Dry run (проверить, что получится)
node scripts/rental-ops-skill.mjs extend --rentalId <id> --start 2026-08-05 --end 2026-08-07 --dryRun

# Реальное продление (требует --actorUserId)
node scripts/rental-ops-skill.mjs extend --rentalId <id> --start 2026-08-05 --end 2026-08-07 --actorUserId 413553377
```

Проверяет: статус (active/completed), доступность байка на новые даты, цену. Создаёт новую аренду + отправляет TG уведомление оператору.

### 6. `close` — закрыть аренду

```bash
# Без повреждений, депозит возвращён
node scripts/rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage none --depositReturned --actorUserId 413553377

# Лёгкие повреждения
node scripts/rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage light --depositReturned --notes "Царапина на баке" --actorUserId 413553377

# Серьёзные повреждения, депозит удержан
node scripts/rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage heavy --no-deposit --notes "Повреждён пластик" --actorUserId 413553377
```

Обновляет: статус → completed, `metadata.closure_data` (odometer, damage, deposit), `cars.specs.last_known_odometer`. Отправляет TG уведомление арендатору.

## Auth

Write operations (`extend`, `close`) require `--actorUserId <telegram_chat_id>`. The script checks:
1. Is the actor the crew owner?
2. Is the actor a crew_member with role owner/admin/co_owner/member?
3. Is the actor a global admin (users.metadata.role=admin)?

If none match → `not_authorized` error.

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
```

Tables accessed:
- `rentals` (read + write)
- `cars` (read for bike info + write for odometer)
- `crews` (read for auth)
- `crew_members` (read for auth)
- `users` (read for auth)
- `rental_contract_artifacts` (private schema, read for renter info)

## Error table

| Error | Cause | Fix |
|-------|-------|-----|
| `missing_actor` | Write op without `--actorUserId` | Pass `--actorUserId <telegram_chat_id>` |
| `not_authorized` | Actor is not owner/admin/member | Use a crew owner/admin TG ID |
| `not_found` | Rental ID doesn't exist | Check the ID via `list-rentals` |
| `bad_status` | Trying to extend/close a rental in wrong status | Extend: only active/completed. Close: only active. |
| `bike_unavailable` | Bike already booked for the new dates | Choose different dates |
| `end_before_start` | End date is before start date | Fix date order |
| `invalid_damage` | Damage level not in none/light/heavy | Use one of: none, light, heavy |

## Related files

- `scripts/rental-ops-skill.mjs` — this skill's CLI
- `app/rentals/actions.ts` — web app's extendRental (pattern reference)
- `app/franchize/server-actions/rentals-dashboard.ts` — web app's updateRentalStatus (pattern reference)
- `skills/rental-card-text/SKILL.md` — read-only rental detail skill (sibling)
- `skills/rental-analytics-text/SKILL.md` — rental analytics skill (sibling)
- `skills/vip-bike-ops/SKILL.md` — umbrella skill router
