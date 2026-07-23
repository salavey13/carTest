---
name: analytics-text
description: >
  Text-based analytics dashboards for VIP Bike. Queries Supabase REST API directly
  (curl) and outputs structured text — rentals, sales, todos, crew stats. Replaces
  the web analytics pages when only CLI/Telegram channel is available.
  Trigger phrases (RU): "аналитика аренд", "статистика продаж", "дашборд задач",
  "сколько аренд сегодня", "выручка за месяц", "статистика экипажа", "аренды за дату",
  "продажи за дату", "просроченные задачи", "сколько заработали", "KPI экипажа".
  Trigger phrases (EN): "rentals analytics text", "analytics dashboard text",
  "sales dashboard", "todos dashboard", "crew stats", "revenue today",
  "rentals count today", "overdue todos", "crew KPIs".
---

# analytics-text — VIP Bike

Триггер-фразы (RU): **`аналитика аренд`**, **`статистика продаж`**, **`дашборд задач`**, **`сколько аренд сегодня`**, **`выручка за месяц`**, **`статистика экипажа`**, **`аренды за дату`**, **`продажи за дату`**, **`просроченные задачи`**, **`сколько заработали`**, **`KPI экипажа`**.
Триггер-фразы (EN): `rentals analytics text`, `analytics dashboard text`, `sales dashboard`, `todos dashboard`, `crew stats`, `revenue today`, `rentals count today`, `overdue todos`, `crew KPIs`.

## Overview

Text-based аналитические дашборды для экипажа `vip-bike`. Заменяет страницы `/franchize/vip-bike/rentals-analytics`, `/franchize/vip-bike/sales-analytics`, `/franchize/vip-bike/dashboard`, `/franchize/vip-bike/todos` на CLI/Telegram-вывод. Использует только `curl` + `jq`.

## When to Use

Use this skill when:

- Нужно быстро увидеть количество аренд / продаж / задач за день без открытия браузера.
- Нужно посчитать выручку за период (день / месяц).
- Нужно вывести сводку по задачам экипажа (pending / in_progress / done / overdue).
- Нужно оценить статистику операторов (кто закрыл больше задач, у кого больше просрочек).
- Нужно morning standup-summary по аналитике.

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

OP_OWNER=356282674        # I_O_S_NN
OP_CO_OWNER=244736261     # Roman_Vip_Bike_Electro
OP_ADMIN=413553377        # salavey13
OP_MEMBER=7813830016      # DJORUDJOV

HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private")

# Helpers
fmtRub() {  # 8500 -> "8 500 ₽"
  printf "%s ₽" "$(printf "%'d" "$1" | tr ',' ' ')"
}
fmtRange() {  # "2026-07-20T10:00:00Z" "2026-07-21T18:00:00Z" -> "20.07 - 21.07"
  local s="$1" e="$2"
  [ -n "$s" ] && s=$(date -u -d "$s" '+%d.%m' 2>/dev/null || echo "--.--")
  [ -n "$e" ] && e=$(date -u -d "$e" '+%d.%m' 2>/dev/null || echo "--.--")
  echo "${s} - ${e}"
}
```

## Commands

### 1. `rentals-dashboard [--date YYYY-MM-DD]` — аренды за день

**Логика:** A rental shows up for the selected day if **EITHER**:
1. It was created on that day (`created_at` within `[startOfDay, endOfDay]`), **OR**
2. Its rental period overlaps that day (`requested_start_date <= endOfDay` AND `requested_end_date >= startOfDay`).

PostgREST cannot OR across different columns, so run **two** queries and merge by `rental_id`.

```bash
DATE="${1:-$(date -u '+%Y-%m-%d')}"
START="${DATE}T00:00:00.000Z"
END="${DATE}T23:59:59.999Z"

# Query A — created today
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,\
agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,\
created_at,metadata,vehicle:cars!inner(id,make,model,crew_id,type,specs),\
user:users!rentals_user_id_fkey(user_id,full_name,username,metadata)\
&vehicle.crew_id=eq.${CREW_ID}\
&created_at=gte.${START}&created_at=lte.${END}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"

# Query B — period overlapping (replace date filter)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,\
agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,\
created_at,metadata,vehicle:cars!inner(id,make,model,crew_id,type,specs),\
user:users!rentals_user_id_fkey(user_id,full_name,username,metadata)\
&vehicle.crew_id=eq.${CREW_ID}\
&requested_start_date=lte.${END}&requested_end_date=gte.${START}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Verification status enrichment** (private schema):

```bash
RENTAL_IDS='"uuid1","uuid2",...'   # JSON array, urlencoded
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=source_rental_id,verification_status,doc_sha256,renter_full_name,created_at\
&source_rental_id=in.(${RENTAL_IDS})\
&order=created_at.desc" \
  "${HDR_PRIVATE[@]}"
```

Dedupe by `source_rental_id` (newest first), keep only the latest record per rental.

**Пример вывода:**

```
=== Аренды за 2026-07-21 (12 всего, выручка 85 000 ₽) ===
   active: 5 | completed: 4 | other: 3

Байк                    Рентер              Статус     Даты                  Сумма      Документы
79BIKE Falcon Lynx      Test Test Test      active     20.07 - 21.07         8 500 ₽    verified
Sur-Ron Light Bee X     Закиров Артур       completed  18.07 - 20.07         12 000 ₽   verified
Segway Dirt eBike X160  Иванов Иван         pending    21.07 - 22.07         5 000 ₽    pending
Rawrr Mantis S          (no name)           active     19.07 - 23.07         22 000 ₽   revoked
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rentals-analytics`

---

### 2. `sales-dashboard [--date YYYY-MM-DD]` — продажи за день

```bash
# Step 1 — fetch crew bike IDs
BIKE_IDS=$(curl -sS "${SUPABASE_URL}/rest/v1/cars?select=id&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}" | jq -r '[.[].id] | join(",")')
[ -z "$BIKE_IDS" ] && BIKE_IDS="__none__"

# Step 2 — query sales (private schema)
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=id,contract_key,buyer_full_name,buyer_email,sale_price,price_words,\
warranty_months,created_at,resolved_bike_id\
&resolved_bike_id=in.(${BIKE_IDS})\
&created_at=gte.${START}&created_at=lte.${END}\
&order=created_at.desc" \
  "${HDR_PRIVATE[@]}"

# Step 3 — fetch bike details for display
curl -sS "${SUPABASE_URL}/rest/v1/cars?select=id,make,model,crew_id,type&id=in.(${UNIQUE_BIKE_IDS})" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Продажи за 2026-07-21 (3 всего, выручка 1 070 000 ₽) ===

Байк                    Покупатель          Цена         Дата
79BIKE Falcon Lynx      Иванов Иван         390 000 ₽    21.07 14:32
Sur-Ron Light Bee X     Петров Пётр         280 000 ₽    21.07 11:05
Segway Dirt eBike X160  Сидоров Сидор       400 000 ₽    21.07 09:18
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/sales-analytics`

---

### 3. `todos-dashboard` — задачи экипажа

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,crew_id,assigned_to,title,description,category,status,priority,\
due_date,created_at,created_by,updated_at,completed_at,\
created_by_user:users!crew_todos_created_by_fkey(user_id,full_name,username),\
assignee:users!crew_todos_assigned_to_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Задачи экипажа vip-bike (47 всего, pending 18, in_progress 4, done 25, overdue 3) ===

— По категориям —

[lead_followup]  12 todo (pending 6 | in_progress 2 | done 4 | overdue 2)
  #1  Позвонить Андрею по аренде Falcon Lynx      assigned: salavey13   due: 22.07 ⚠ overdue
  #2  Отправить КП для ООО Вектор                  assigned: Roman_Vip  due: 25.07

[rental_verification]  9 todo (pending 4 | done 5 | overdue 0)
  #1  Проверить паспорт Закиров Артур              assigned: salavey13   due: 21.07  ✓ done

— По исполнителям —

salavey13 (admin)            15 todo (pending 7 | done 7 | overdue 1)
Roman_Vip_Bike_Electro       12 todo (pending 4 | done 7 | overdue 1)
DJORUDJOV                     8 todo (pending 3 | done 5 | overdue 1)
I_O_S_NN (owner)             10 todo (pending 4 | done 6 | overdue 0)
(unassigned)                  2 todo (pending 0 | done 0 | overdue 0)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/todos`

---

### 4. `crew-stats` — статистика операторов

```bash
# Step 1 — fetch crew members
curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=user_id,role,membership_status,\
user:users!inner(user_id,full_name,username,metadata)\
&crew_id=eq.${CREW_ID}\
&membership_status=eq.active\
&order=role.asc" \
  "${HDR_PUBLIC[@]}"

# Step 2 — fetch all crew todos (lightweight)
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=assigned_to,status,due_date\
&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Статистика экипажа vip-bike (4 активных) ===

Имя                       Роль      Задач    Выполнено   Просрочено
salavey13 (admin)         admin     15       7           1
Roman_Vip_Bike_Electro    co_owner  12       7           1
DJORUDJOV                 member    8        5           1
I_O_S_NN                  owner     10       6           0
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew`

---

### 5. `revenue-summary [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — выручка за период

```bash
FROM="${FROM:-$(date -u '+%Y-%m-01')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"

# Rentals revenue
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=total_cost,status\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)\
&created_at=gte.${START}&created_at=lte.${END}" \
  "${HDR_PUBLIC[@]}" | jq '[.[] | .total_cost // 0] | add // 0'

# Sales revenue (private schema)
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=sale_price,total_sum\
&crew_slug=eq.${CREW_SLUG}\
&created_at=gte.${START}&created_at=lte.${END}" \
  "${HDR_PRIVATE[@]}" | jq '[.[] | (.total_sum // (.sale_price | gsub("[^0-9]"; "") | tonumber))] | add // 0'
```

**Пример вывода:**

```
=== Выручка vip-bike за 2026-07-01 — 2026-07-21 ===
Аренды:    325 000 ₽   (28 закрытых)
Продажи:   1 070 000 ₽ (3 контракта)
Итого:     1 395 000 ₽
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/dashboard`

---

## Schema Access

### Public schema

- `rentals` — `rental_id` (uuid PK), `user_id`, `vehicle_id`, `owner_id`, `status` (`pending_confirmation` / `confirmed` / `active` / `completed` / `cancelled` / `disputed`), `payment_status` (`pending` / `interest_paid` / `fully_paid` / `refunded` / `failed`), `interest_amount`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `delivery_address`, `created_at`, `metadata`, `crew_id`, `created_by_operator_chat_id`.
- `cars` — `id` (text PK), `make`, `model`, `description`, `daily_price`, `image_url`, `rent_link`, `is_test_result`, `specs` (jsonb), `owner_id`, `type`, `crew_id`, `availability_rules` (jsonb), `quantity`.
- `users` — `user_id` (text PK), `username`, `full_name`, `avatar_url`, `status`, `role`, `metadata` (jsonb), `badges`, `language_code`.
- `crew_members` — `id`, `crew_id`, `user_id`, `role` (`owner` / `co_owner` / `admin` / `mechanic` / `member`), `joined_at`, `membership_status` (`pending` / `active` / `inactive`), `last_location`, `live_status`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `category`, `status` (`pending` / `in_progress` / `done`), `priority` (`low` / `medium` / `high`), `due_date`, `created_at`, `created_by`, `updated_at`, `completed_at`, `lead_id`, `user_id`, `phone`, `rental_id`.
- `crews` — `id` (uuid PK), `name`, `slug`, `description`, `logo_url`, `owner_id`, `hq_location`, `metadata`.

### Private schema (requires `Accept-Profile: private`)

- `user_rental_secrets` — PII. `source_rental_id`, `verification_status` (`verified` / `pending` / `revoked`), `renter_full_name`, `doc_sha256`, `renter_phone`, `renter_passport`, `renter_registration`, `renter_driver_license`, `created_at`.
- `sale_contract_artifacts` — PII. `id`, `contract_key`, `resolved_bike_id`, `buyer_full_name`, `buyer_passport_number`, `buyer_email`, `sale_price` (text formatted `"390 000"`), `price_words`, `warranty_months`, `total_sum`, `created_at`, `crew_slug`, `buyer_phone`.
- `rental_contract_artifacts` — PII. `id`, `contract_key`, `resolved_bike_id`, `telegram_chat_id`, `renter_full_name`, `renter_passport`, `renter_phone`, `rent_start_date`, `rent_end_date`, `daily_price`, `deposit_rub`, `total_sum`, `rental_id`, `crew_slug`, `created_at`.

## Web Links

| Command            | Web page                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------|
| `rentals-dashboard`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rentals-analytics   |
| `sales-dashboard`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/sales-analytics     |
| `todos-dashboard`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/todos               |
| `crew-stats`       | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew                |
| `revenue-summary`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/dashboard           |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--format csv|md|html`~~ — не существует. Только текстовая таблица.
- ~~`--json`~~ — не существует. JSON возвращается curl'ом, но skill форматирует его в текст.
- ~~`--outFile <path>`~~ — не существует. Используйте shell-redirect `> file.txt`.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--tz Europe/Moscow`~~ — не существует. Все даты в UTC; конвертация в MSK — на стороне вызывающего.
- ~~`--currency USD|EUR`~~ — не существует. Только ₽ (рубли).
- ~~`--includePii`~~ — не существует. PII (паспорт, права, адрес) никогда не выводятся в dashboard.
- ~~`--groupBy hour`~~ — не существует. Только по дате / периоду.
- ~~`sales-dashboard --bikeId <id>`~~ — не существует. Фильтр по `resolved_bike_id` можно добавить вручную в URL.

## Error Handling

| Stage                | Reason                                | Когда возникает                                                | Exit | Что делать                                         |
|----------------------|---------------------------------------|----------------------------------------------------------------|------|----------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен       | 2    | Проверить путь или export env                      |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`        | Неверный select, RLS, нет такой таблицы/колонки                | 2    | Проверить схему (раздел "Schema Access")           |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`        | Supabase лежит, rate-limit                                     | 2    | Повторить через минуту                             |
| `private_404`        | `404 for private.<table>`             | Не передан `Accept-Profile: private` header                    | 2    | Добавить header в curl                             |
| `bike_ids_empty`     | `No bikes found for crew`             | У экипажа нет ТС в `cars`                                      | 0    | Вывод пустой summary; не падать                    |
| `date_parse`         | `Invalid date format`                 | `--date` не парсится как YYYY-MM-DD                            | 2    | Использовать `YYYY-MM-DD`                          |
| `jq_parse`           | `jq: parse error`                     | Supabase вернул HTML вместо JSON (5xx, edge function error)    | 2    | Проверить stderr Supabase                          |
| `revenue_no_rows`    | `[]`                                   | Нет аренд/продаж за период                                    | 0    | Вывод: `Нет данных за выбранную дату.`             |

## Security

- **Service role key** — полный read/write ко всем схемам. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header `apikey` / `Authorization: Bearer`.
- **PII masking**: dashboard никогда не выводит паспорт/права/адрес. Если нужно вывести ФИО — оставлять фамилию с инициалами. Телефоны в выводе маскировать `+7XXXXXXXX42` (первые 4 символа + `…`).
- **Private schema headers**: для `user_rental_secrets`, `sale_contract_artifacts`, `rental_contract_artifacts` обязателен `Accept-Profile: private`. Для PATCH/INSERT также `Content-Profile: private`. Без них PostgREST вернёт 404.
- **Currency formatting**: thousands separator — пробел (`8 500 ₽`), НЕ запятая.
- **Date filtering**: UTC boundaries (`YYYY-MM-DDT00:00:00.000Z` to `YYYY-MM-DDT23:59:59.999Z`).
- **Revenue summing**: только rows с parseable `total_cost` / `sale_price`. Rows с null/non-numeric — считаются в count, но 0 в revenue.
- Skill полностью **read-only**. Никаких INSERT/UPDATE/PATCH.
- Все HTTP-запросы — HTTPS.

## Sibling Skills (Specialized Analytics)

| Skill | Focus | Commands |
|---|---|---|
| `rental-analytics-text` | Rental-specific analytics (daily, detail, todos, docs, handoff, activate/complete, returns, overdue) | 9 commands |
| `sale-analytics-text` | Sales analytics (list, detail, stats) | 3 commands |
| `service-analytics-text` | Service analytics (list, detail, catalog, stats) | 4 commands |

Use this skill (`analytics-text`) for general crew-wide dashboards (todos, crew-stats).
Use the specialized skills for drill-down into specific rental/sale/service details.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — single rental card
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew members
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders/checkout
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin panel
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/rentals-dashboard.ts`
- `app/franchize/server-actions/rentals.ts`
- `app/franchize/server-actions/crew-todos.ts`
- `app/franchize/server-actions/rental-verification-todos.ts`
- `app/franchize/server-actions/rental-secrets-claim.ts`

**Schema migrations:**

- `20260621000000_crew_todos.sql` — crew_todos schema
- `20260607000000_create_sale_contract_artifacts.sql`
- `20260612000000_fix_rental_contract_artifacts.sql`
- `20260601000000_user_rental_secrets.sql`

**UI references:**

- `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx`
- `app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx`
- `app/franchize/[slug]/dashboard/page.tsx`
- `app/franchize/[slug]/todos/page.tsx`

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
