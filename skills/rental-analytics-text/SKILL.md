---
name: rental-analytics-text
description: >
  Text-based rental analytics for VIP Bike. Mirrors the v2 web dashboard
  (3-tab Аренда/Продажа/Сервис, KPI row, RentalDetailDrawer 10 sections).
  Daily rentals, KPIs, returns due, overdue tracking, document checklist,
  handoff state, todos filtered per rental, history timeline, QR status,
  activate/complete rental.
  Trigger phrases: "аренды сегодня", "статус аренд", "возвраты сегодня",
  "просроченные аренды", "kpi аренд", "карточка аренды", "документы аренды",
  "передача байка", "история аренды", "активировать аренду", "завершить аренду",
  "rentals today", "rental kpis", "rental detail", "returns due",
  "overdue rentals", "rental documents", "rental handoff", "rental history",
  "activate rental", "complete rental"
---

# rental-analytics-text

Триггер-фразы: **`аренды сегодня`**, **`статус аренд`**, **`возвраты сегодня`**, **`просроченные аренды`**, **`kpi аренд`**, **`карточка аренды`**, **`документы аренды`**, **`передача байка`**, **`история аренды`**, **`активировать аренду`**, **`завершить аренду`**, **`rentals today`**, **`rental kpis`**, **`rental detail`**, **`returns due`**, **`overdue rentals`**, **`rental documents`**, **`rental handoff`**, **`rental history`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt (SUPABASE_SERVICE_ROLE_KEY=)
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746

## Web UI mirror (v2)

This skill mirrors the v2 analytics dashboard at
`/franchize/vip-bike/rentals-analytics?ui=v2`. The web page has 3 tabs
(Аренда / Продажа / Сервис), 4 KPI cards, a card list, and a 10-section
RentalDetailDrawer on tap. This skill exposes the same data via text.

KPI row (4 cards, computed for selected date):
1. **Аренд сегодня** — count of rentals where created_at OR rental period overlaps the day
2. **Выручка** — sum of `total_cost` for status IN (`active`, `completed`)
3. **Активных** — count where status = `active`
4. **Возвратов** — count where status = `active` AND `agreed_end_date` is today (LOCAL date)

Status color whitelist (matches web):
- 🟢 `#22c55e` active / completed / verified
- 🟡 `#f59e0b` pending_confirmation / warning SLA
- 🟣 `#8b5cf6` confirmed
- 🔴 `#ef4444` cancelled / disputed / overdue / missing docs
- 🔵 `#3b82f6` info / completed
- ⚪ `#64748b` neutral / cancelled

## Commands

### 1. rentals-day [--date YYYY-MM-DD]
All rentals for a date (created OR period overlapping). Excludes service rentals (vehicle_id NOT LIKE 'vip-bike-svc-%').

```bash
# IMPORTANT: use Europe/Moscow timezone for "today" default. The v2 web
# UI uses localDateOnly() to avoid the UTC+3 drift; this skill must match.
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"
curl -s "$URL/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,metadata,created_at,crew_id,created_by_operator_chat_id&crew_id=eq.$CREW_ID&or=(and(created_at.gte.$START,created_at.lte.$END),and(requested_start_date.lte.$END,requested_end_date.gte.$START),and(agreed_start_date.lte.$END,agreed_end_date.gte.$START))&vehicle_id=not.like.vip-bike-svc-*&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output per card (matches AnalyticsRentalCard):
- Bike title: `vehicle.make + " " + vehicle.model` (join `cars` on `vehicle_id`)
- Renter ФИО: `users.full_name` (join `users` on `user_id`) — **ФИО is primary, NOT phone**
- Status badge (RU): Активна / Завершена / Подтверждена / Ожидает / Отменена / Спор
- Date range: `agreed_start_date → agreed_end_date` (or requested_*)
- Cost: `total_cost` formatted as ₽
- Doc status: `3/5 ✅` or `2 missing 🔴` (see `rental-documents`)
- Handoff badge: `Передан` / `Ожидает` (see `rental-handoff`)
- SLA countdown: `До возврата: 2д 3ч` (red if past)

### 2. rental-kpis [--date YYYY-MM-DD]
Returns the 4 KPI cards for the date. Mirrors `AnalyticsClient.tsx:88-107`.

```bash
# Use LOCAL date for "today" default (Europe/Moscow). The v2 web uses
# localDateOnly() for the returnsDue KPI; this skill must match.
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"

# 1. Total today: count from rentals-day
# 2. Revenue: SUM(total_cost) WHERE status IN ('active','completed')
# 3. Active: COUNT(*) WHERE status = 'active'
# 4. Returns due: COUNT(*) WHERE status = 'active'
#    AND localDate(agreed_end_date) = $DATE
#    (i.e. TZ=Europe/Moscow date-of-agreed_end_date equals $DATE)
#
# Postgres stores agreed_end_date as timestamptz (UTC). To compare "today"
# in Moscow, use the +03:00 offset bounds — same as the v2 web's
# localDateOnly() comparison.
START_LOCAL="${DATE}T00:00:00+03:00"
END_LOCAL="${DATE}T23:59:59+03:00"
curl -s "$URL/rest/v1/rentals?select=rental_id,status,agreed_end_date,total_cost&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output format (mirror web KPI cards):
```
📊 KPI аренд за 2026-07-24:
   Аренд сегодня: 5
   Выручка: 85 000 ₽
   Активных: 22
   Возвратов: 3
```

### 3. rental-detail <rentalId>
Full 10-section detail (mirrors RentalDetailDrawer):

```bash
curl -s "$URL/rest/v1/rentals?select=*,vehicle:cars!vehicle_id(make,model,type),user:users!user_id(full_name,username,metadata)&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Sections (in order):
1. **Header** — bike title, renter ФИО, status badge
2. **Primary actions** — Activate / Complete / Cancel / Open rental page
3. **SLA overview** — 4 indicators:
   - `days_active` (since `agreed_start_date`)
   - `until_return` (or `return_overdue` if past)
   - `docs` (`3/5` completeness)
   - `overdue_todos` count for this rental
4. **Info grid** (12 tiles):
   - Байк, Арендатор, Телефон, Статус, Оплата, Начало, Конец, Стоимость, Депозит, Оператор, Экипаж, Создана
5. **Documents** — 5-item checklist:
   - passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, passport_backpage_photo, drivers_licence_back_photo
   - Each: ✅ present (with Открыть link) or 🔴 missing (with Запросить action)
6. **Todos** — filtered by All / Mine / Overdue (sub-filter pills)
7. **Handoff** — `rental_handoffs` table: odometer_before, odometer_after, equipment_checklist, damage_notes
8. **Notes** — list + add-note input
9. **History** — timeline of events (created → started → completed/cancelled)
10. **Sticky footer** — Open rental → link

### 4. rental-todos <rentalId>
All todos for this rental. v1 CrewTodo doesn't carry `rental_id` directly, so this command queries `crew_todos` filtered by `category` matching rental context and `assigned_to = rental.created_by_operator_chat_id`.

```bash
# Step 1: get the operator chat id for the rental
OPERATOR=$(curl -s "$URL/rest/v1/rentals?select=created_by_operator_chat_id&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].created_by_operator_chat_id')

# Step 2: todos assigned to that operator
curl -s "$URL/rest/v1/crew_todos?select=id,title,status,category,priority,due_date,assigned_to,created_at&crew_id=eq.$CREW_ID&assigned_to=eq.${OPERATOR}&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Sub-filters:
- **All** (default)
- **Mine** — `assigned_to = current_operator`
- **Overdue** — `due_date < now() AND status != 'done'`

### 5. rental-documents <rentalId>
Document completeness — 5-item checklist.

```bash
# From rental metadata (3 fields on rentals row + 2 in metadata JSONB)
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# From user_rental_secrets (verified OCR data)
curl -s "$URL/rest/v1/user_rental_secrets?select=renter_full_name,renter_passport,renter_passport_issue_date,renter_registration,renter_driver_license,renter_phone,renter_email,verification_status,doc_sha256&source_rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"
```

Output: `Docs: 3/5 ✅` (or `2/5 🔴 — missing: passport_back, license_back`).
PII masking: `passport = "XXXX…1234"`, `phone = "+7…XX-12"`, `email = "x…@y.ru"`.

### 6. rental-handoff <rentalId>
Handoff state from `rental_handoffs` table (or `metadata.handoff_*` fields).

```bash
# Primary: rental_handoffs table
curl -s "$URL/rest/v1/rental_handoffs?select=handoff_at,handoff_by,odometer_before,odometer_after,equipment_checklist,damage_notes&rental_id=eq.${rentalId}&order=handoff_at.desc&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: private"

# Fallback: metadata JSONB fields
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq '.[0].metadata | {handoff_at, odometer_before, odometer_after, equipment_checklist, damage_notes}'
```

Output:
- `Передан ✅` (if `handoff_at` exists) or `Ожидает 🔄`
- `Одометр: 1234 → 1567 км`
- `Снаряжение: шлем ✅ / перчатки ✅ / защита ❌`
- `Повреждения: царапина на левом баке` (or `—`)

### 7. rental-history <rentalId>
Timeline of events for this rental.

```bash
# Status changes from rentals table
curl -s "$URL/rest/v1/rentals?select=created_at,agreed_start_date,agreed_end_date,status&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Plus events from metadata.history (if present)
curl -s "$URL/rest/v1/rentals?select=metadata&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq '.[0].metadata.history // []'
```

Events (timeline order, most recent last):
- 🔵 `Аренда создана` (created_at)
- 🟢 `Аренда началась` (agreed_start_date, if status=active/completed)
- 🟢 `QR принят` (metadata.qr_claimed_at, if present)
- 🔵 `Аренда завершена` (agreed_end_date, if status=completed)
- 🔴 `Аренда отменена` (if status=cancelled)

### 8. activate-rental <rentalId> [--odometer <km>]
Activate rental: PATCH `status='active'` + set `metadata.odometer_before`.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"active","agreed_start_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","metadata":{"odometer_before":'"${ODOMETER:-null}"'}}'
```

### 9. complete-rental <rentalId> --odometer <km>
Complete rental: PATCH `status='completed'` + set `metadata.odometer_after`.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"completed","agreed_end_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","metadata":{"odometer_after":'"${ODOMETER}"'}}'
```

### 10. returns-due [--date YYYY-MM-DD]
Rentals due for return: `status='active'` AND `agreed_end_date` falls on $DATE **in Europe/Moscow timezone**.

```bash
# Use LOCAL date for "today" default (Europe/Moscow).
DATE="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
# Use +03:00 offset bounds — same as v2 web's localDateOnly() comparison.
# Using UTC bounds (Z suffix) would drift by 3 hours and miss returns near midnight.
START_LOCAL="${DATE}T00:00:00+03:00"
END_LOCAL="${DATE}T23:59:59+03:00"
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost,status&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=gte.${START_LOCAL}&agreed_end_date=lte.${END_LOCAL}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: list with renter ФИО + bike + `agreed_end_date` formatted as `до 18:00`.

### 11. overdue-rentals
Active rentals past their `agreed_end_date`.

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,agreed_end_date,total_cost&crew_id=eq.$CREW_ID&status=eq.active&agreed_end_date=lt.${NOW}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: list with `Просрочен: 3д` countdown per row.

## SLA signal computation (matches computeSlaSignals in lib/analytics-utils.ts)

For each active rental, compute 4 SLA indicators:
1. `days_active` — floor((now - agreed_start_date) / 86400000) → "5д"
2. `until_return` — floor((agreed_end_date - now) / 3600000) → "2д 3ч" or "5ч"
   - tone: `good` (>72h), `warning` (24-72h), `danger` (<24h)
3. `return_overdue` — if agreed_end_date < now → "Просрочен: 3д" (tone: `danger`)
4. `docs` — `3/5` completeness (tone: `good` if 5/5, `warning` if 2-4, `danger` if ≤1)

Priority order: `return_overdue` (10) > `until_return` (8) > `docs` (5) > `days_active` (1).

## Anti-hallucination
- ~~--json~~ — text output only
- ~~--outFile~~ — stdout only
- ~~--crew~~ — hardcoded to vip-bike
- Never invent KPI numbers — always recompute from raw rentals
- Never show renter phone in card view (phone is drawer-only)

## Security
- Service key: never expose to client
- PII masking: passport `XXXX…1234`, license `XXXX…5678`, phone `+7…XX-12`, email `x…@y.ru`
- Private schema (`user_rental_secrets`, `sale_contract_artifacts`, `rental_handoffs`): `Accept-Profile: private` header required

## Related Files
- Web v2: `app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx`
- Web v2 cards: `app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalCard.tsx`
- Web v2 drawer: `app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx`
- Web v2 utils: `app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts`
- Server actions: `app/franchize/server-actions/rentals-dashboard.ts`
- Sibling skills: `sale-analytics-text`, `service-analytics-text`, `leads-crm-text`, `rental-card-text`
- Umbrella: `vip-bike-ops`
