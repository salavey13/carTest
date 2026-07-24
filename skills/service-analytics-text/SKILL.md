---
name: service-analytics-text
description: >
  Text-based service analytics for VIP Bike. Mirrors the v2 web dashboard
  (Сервис tab, ServiceDetailDrawer 5 sections). Service rentals are rentals
  where vehicle_id IN (cars.type='service'). List services, KPIs, detail,
  catalog, mechanic assignment, stats.
  Trigger phrases: "сервис", "обслуживание", "услуги", "сервисные работы",
  "нормо-час", "замена масла", "kpi сервиса", "карточка сервиса",
  "механик сервис", "service list", "service kpis", "service detail",
  "service catalog", "service stats", "service mechanic"
---

# service-analytics-text

Триггер-фразы: **`сервис`**, **`обслуживание`**, **`услуги`**, **`сервисные работы`**, **`нормо-час`**, **`замена масла`**, **`kpi сервиса`**, **`карточка сервиса`**, **`механик сервис`**, **`service list`**, **`service kpis`**, **`service detail`**, **`service catalog`**, **`service stats`**, **`service mechanic`**

## Supabase Access
- URL: https://inmctohsodgdohamhzag.supabase.co
- Key: from /home/z/my-project/upload/secrets.txt
- Crew: vip-bike, ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
- Service rentals live in the same `rentals` table — distinguished by `vehicle_id IN (cars.type='service')` OR `vehicle_id LIKE 'vip-bike-svc-%'`

## Web UI mirror (v2)

Mirrors the Сервис tab at `/franchize/vip-bike/rentals-analytics?ui=v2`.
Service rentals use the same `rentals` table but the v2 dashboard filters
them into the Сервис tab. The ServiceDetailDrawer has 5 sections.

Service detection (matches `isServiceRental` in `lib/analytics-utils.ts`):
```
vehicle_id LIKE 'vip-bike-svc-%'  OR  vehicle_id IN (SELECT id FROM cars WHERE type='service')
```

KPI row for services (computed for selected date):
- **Сервисов сегодня** — count of service rentals for the date
- **Выручка сервиса** — sum of `total_cost` for status IN (`active`, `completed`)
- **Активных** — count where status = `active`
- **Завершено** — count where status = `completed`

Status color whitelist:
- 🟣 `#8b5cf6` service accent (purple stripe on cards)
- 🟢 `#22c55e` active / completed
- 🟡 `#f59e0b` pending_confirmation
- 🔴 `#ef4444` disputed / cancelled
- ⚪ `#64748b` neutral

## Commands

### 1. services-list [--date YYYY-MM-DD]
All service rentals for a date. Mirrors AnalyticsServiceCard.

```bash
DATE="${1:-$(date -u +%Y-%m-%d)}"
START="${DATE}T00:00:00Z"; END="${DATE}T23:59:59Z"

# Step 1: get service bike IDs (cars.type='service')
SVC_IDS=$(curl -s "$URL/rest/v1/cars?select=id&crew_id=eq.$CREW_ID&type=eq.service" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[].id' | paste -sd, -)

# Step 2: query rentals for those bikes + the vip-bike-svc-* prefix
curl -s "$URL/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,metadata,created_at,created_by_operator_chat_id&crew_id=eq.$CREW_ID&or=(and(created_at.gte.${START},created_at.lte.${END}),and(requested_start_date.lte.${END},requested_end_date.gte.${START}))&vehicle_id=in.(${SVC_IDS})&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output per card (matches AnalyticsServiceCard):
- Service type: `vehicle.make` (e.g. "Замена масла", "Нормо-час") — joined from `cars`
- Client ФИО: `users.full_name` (joined on `user_id`)
- Status badge (RU): Активна / Завершена / Подтверждена / Ожидает
- Date: `agreed_start_date` or `created_at`
- Cost: `total_cost` formatted as ₽
- Mechanic: from `crew_todos.assigned_to` matching `rental.created_by_operator_chat_id` → `assigned_to_user.full_name`

### 2. service-kpis [--date YYYY-MM-DD]
4 KPI cards for the date.

```bash
# Reuse services-list output and compute:
# 1. total_today = COUNT(*)
# 2. revenue = SUM(total_cost) WHERE status IN ('active','completed')
# 3. active_count = COUNT(*) WHERE status = 'active'
# 4. completed_count = COUNT(*) WHERE status = 'completed'
```

### 3. service-detail <rentalId>
Full 5-section detail (mirrors ServiceDetailDrawer):

```bash
curl -s "$URL/rest/v1/rentals?select=*,vehicle:cars!vehicle_id(make,model,type,specs,daily_price),user:users!rentals_user_id_fkey(full_name,username,metadata)&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Sections (in order):
1. **Header** — service type (vehicle.make), client ФИО, status badge, cost pill, wrench icon
2. **Primary actions** — 4 buttons:
   - `Активировать` (green — PATCH status='active')
   - `Завершить` (blue — PATCH status='completed')
   - `Отменить` (red — PATCH status='cancelled')
   - `Открыть` (purple — open rental page)
3. **Info grid** (8 tiles):
   - Услуга, Клиент, Телефон, Статус, Оплата, Начало, Конец, Стоимость
4. **Исполнитель** (mechanic assignment section):
   ```bash
   # Get the rental's operator chat id
   OPERATOR=$(curl -s "$URL/rest/v1/rentals?select=created_by_operator_chat_id&rental_id=eq.${rentalId}" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].created_by_operator_chat_id')

   # Find the assigned mechanic (best-effort match via crew_todos)
   curl -s "$URL/rest/v1/crew_todos?select=id,title,status,assigned_to,assigned_to_user:users!assigned_to(full_name,username)&crew_id=eq.$CREW_ID&assigned_to=eq.${OPERATOR}&limit=1" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
   ```
   Output: `Исполнитель: Артур Б.` (or `Не назначен`)
5. **Sticky footer** — "Открыть сервис →"

### 4. service-catalog
List all service items in the catalog (cars.type='service').

```bash
curl -s "$URL/rest/v1/cars?select=id,make,model,daily_price,specs&crew_id=eq.$CREW_ID&type=eq.service&order=make.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: 10 service items (production data):
- `Нормо-час` — 2 000 ₽
- `Замена масла` — 2 000 ₽
- `Замена колодок` — 3 000 ₽
- `Диагностика` — 1 500 ₽
- `Шиномонтаж` — 2 500 ₽
- `Регулировка карбюратора` — 2 500 ₽
- `Прошивка ECU` — 3 500 ₽
- `Замена свечей` — 1 500 ₽
- `Прокачка тормозов` — 2 000 ₽
- `Кастомная настройка` — 5 000 ₽

### 5. service-mechanic <rentalId>
Get assigned mechanic for a service rental.

```bash
# v1 CrewTodo doesn't carry rental_id directly. Best-effort match: find
# the most recent crew_todo where assigned_to = rental.created_by_operator_chat_id.
OPERATOR=$(curl -s "$URL/rest/v1/rentals?select=created_by_operator_chat_id&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].created_by_operator_chat_id')

curl -s "$URL/rest/v1/crew_todos?select=id,title,assigned_to,status,assigned_to_user:users!assigned_to(full_name,username)&crew_id=eq.$CREW_ID&assigned_to=eq.${OPERATOR}&order=created_at.desc&limit=5" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output: `Механик: Артур Б. (5 задач, 2 завершено)` or `Не назначен`.

### 6. service-assign-mechanic <rentalId> --mechanicId <userId>
Assign a mechanic to a service rental (creates a `crew_todo` linked to the rental's operator).

```bash
# 1. Get the rental context
RENTAL=$(curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,created_by_operator_chat_id&rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")

VEHICLE_ID=$(echo "$RENTAL" | jq -r '.[0].vehicle_id')
OPERATOR=$(echo "$RENTAL" | jq -r '.[0].created_by_operator_chat_id')

# 2. Get vehicle label for the todo title
TITLE=$(curl -s "$URL/rest/v1/cars?select=make&vehicle_id=eq.${VEHICLE_ID}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[0].make')

# 3. Create a crew_todo assigned to the mechanic
curl -s -X POST "$URL/rest/v1/crew_todos" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"crew_id\": \"$CREW_ID\",
    \"assigned_to\": \"${MECHANIC_ID}\",
    \"title\": \"Сервис: ${TITLE}\",
    \"description\": \"Заказ на обслуживание: ${rentalId}\",
    \"category\": \"maintenance\",
    \"status\": \"pending\",
    \"priority\": \"medium\",
    \"created_by\": \"${OPERATOR}\"
  }"
```

### 7. service-stats [--from YYYY-MM-DD] [--to YYYY-MM-DD]
Aggregate stats.

```bash
FROM="${1:-$(date -u -d '30 days ago' +%Y-%m-%d)}"
TO="${2:-$(date -u +%Y-%m-%d)}"

SVC_IDS=$(curl -s "$URL/rest/v1/cars?select=id&crew_id=eq.$CREW_ID&type=eq.service" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | jq -r '.[].id' | paste -sd, -)

curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,status,total_cost,created_at&crew_id=eq.$CREW_ID&vehicle_id=in.(${SVC_IDS})&created_at=gte.${FROM}T00:00:00Z&created_at=lte.${TO}T23:59:59Z" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Output:
- `Всего сервисов: 18`
- `Выручка: 42 000 ₽`
- `Топ-услуга: Замена масла (8 заказов, 16 000 ₽)`
- `По статусам: завершено 12, активно 4, ожидает 2`

### 8. service-activate <rentalId>
Activate a service rental.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"active","agreed_start_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
```

### 9. service-complete <rentalId>
Mark service as completed.

```bash
curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${rentalId}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"status":"completed","agreed_end_date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
```

## Anti-hallucination
- ~~--json~~, ~~--outFile~~, ~~--crew~~
- Always check both `vehicle_id LIKE 'vip-bike-svc-%'` AND `vehicle_id IN (cars.type='service')` — some legacy services use one convention, some the other
- Mechanic assignment is best-effort (v1 CrewTodo doesn't carry rental_id); note this caveat in output

## Security
- PII: mask client phone (`+7…XX-12`)
- Private schema (`user_rental_secrets` for OCR data): `Accept-Profile: private` required
- Service key: never expose to client

## Related Files
- Web v2: `app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx` (Сервис tab)
- Web v2 card: `app/franchize/[slug]/rentals-analytics/components/AnalyticsServiceCard.tsx`
- Web v2 drawer: `app/franchize/[slug]/rentals-analytics/components/ServiceDetailDrawer.tsx`
- Web v2 utils: `app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts` (`isServiceRental`)
- Server actions: `app/franchize/server-actions/rentals-dashboard.ts` (`getRentalsDashboard` — service rentals are a subset)
- Sibling skills: `rental-analytics-text`, `sale-analytics-text`, `leads-crm-text`, `franchize-catalog-text`
- Umbrella: `vip-bike-ops`
