---
name: analytics-text
description: >
  Text-based analytics dashboard for VIP Bike. Queries Supabase directly and
  outputs structured text — rentals, sales, todos, crew stats.
  Trigger phrases: "аналитика аренд", "статистика продаж", "дашборд задач",
  "сколько аренд сегодня", "выручка за месяц", "статистика экипажа",
  "rentals analytics text", "analytics dashboard text"
---

# analytics-text

Text-based analytics dashboard for VIP Bike. Queries Supabase REST API directly
(via `curl`) and outputs structured text — no UI, no JSON blobs. Replaces the
web analytics dashboards (rentals-analytics, sales-analytics, todos-dashboard)
when only a CLI/Telegram channel is available.

Same pattern as `leads-crm-text`: CLI skill, agent runs `curl` against
PostgREST, formats results as aligned text tables.

## Trigger phrases

- "аналитика аренд"
- "статистика продаж"
- "дашборд задач"
- "сколько аренд сегодня"
- "выручка за месяц"
- "статистика экипажа"
- "rentals analytics text"
- "analytics dashboard text"

## Prerequisites

### Supabase credentials

Read from `/home/z/my-project/upload/secrets.txt`:

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
```

### Crew context (hardcoded defaults)

| Field        | Value                                  |
|--------------|----------------------------------------|
| `crew_slug`  | `vip-bike`                             |
| `crew_id`    | `2d5fde70-1dd3-4f0d-8d72-66ccf6908746` |

Override with `--crewSlug` / `--crewId` only if a different crew is needed.

### Common curl invocation

Every query uses the same headers + base URL:

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/<table>?<query>" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept: application/json"
```

Service-role key bypasses RLS and gives read access to both `public` and
`private` schema tables (the latter are exposed via PostgREST when the service
role is used — `sale_contract_artifacts`, `user_rental_secrets`,
`rental_contract_artifacts`).

### Helper: format rubles

```bash
fmtRub() {  # 8500 -> "8 500 ₽"
  printf "%s ₽" "$(printf "%'d" "$1" | tr ',' ' ')"
}
```

### Helper: format date range

```bash
fmtRange() {  # "2026-07-20T10:00:00Z" "2026-07-21T18:00:00Z" -> "20.07 - 21.07"
  local s="$1" e="$2"
  [ -n "$s" ] && s=$(date -u -d "$s" '+%d.%m' 2>/dev/null || echo "--.--")
  [ -n "$e" ] && e=$(date -u -d "$e" '+%d.%m' 2>/dev/null || echo "--.--")
  echo "${s} - ${e}"
}
```

---

## Commands

### 1. `rentals-dashboard [--date YYYY-MM-DD]`

Text version of the rentals analytics page.

**Defaults:** `--date` = today (UTC), format `YYYY-MM-DD`.

**Logic:** A rental shows up for the selected day if **EITHER**:
1. It was created on that day (`created_at` within `[startOfDay, endOfDay]`), **OR**
2. Its rental period overlaps that day (`requested_start_date <= endOfDay` AND `requested_end_date >= startOfDay`).

PostgREST cannot OR across different columns, so we run **two** queries and
merge by `rental_id` (period-overlapping wins over created-today because more
relevant to the selected day).

#### Query A — created today

```bash
DATE="${1:-$(date -u '+%Y-%m-%d')}"
START="${DATE}T00:00:00.000Z"
END="${DATE}T23:59:59.999Z"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,\
agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,\
created_at,metadata,vehicle:cars!inner(id,make,model,crew_id,type,specs),\
user:users!rentals_user_id_fkey(user_id,full_name,username,metadata)\
&vehicle.crew_id=eq.${CREW_ID}\
&created_at=gte.${START}&created_at=lte.${END}\
&order=created_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Query B — period overlapping

Same `select`, replace the date filter:

```
&requested_start_date=lte.${END}&requested_end_date=gte.${START}
```

#### Dedupe

Merge A + B into a map keyed by `rental_id`; if a rental appears in both, keep
the B (period-overlapping) record. Then dedupe further by
`(user_id, vehicle_id)` — keep only the **latest** by `created_at DESC` so
multiple re-uploads of the same transaction don't inflate the count.

#### Verification status enrichment

For each surviving `rental_id`, fetch the latest document secret from the
**private schema**:

```bash
RENTAL_IDS='"uuid1","uuid2",...'   # JSON array, urlencoded

curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/user_rental_secrets?\
select=source_rental_id,verification_status,doc_sha256,renter_full_name,created_at\
&source_rental_id=in.(${RENTAL_IDS})\
&order=created_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept-Profile: private"     # private schema
```

Dedupe by `source_rental_id` (newest first), keep only the latest record per
rental. Attach `verification_status` (one of: `verified`, `pending`, `revoked`)
to the rental.

#### Summary

| Metric             | Calculation                                            |
|--------------------|--------------------------------------------------------|
| total rentals      | `items.length`                                         |
| total revenue      | `Σ total_cost` (sum over all surviving items)          |
| active count       | `items.filter(status === 'active').length`             |
| completed count    | `items.filter(status === 'completed').length`          |

#### Output format

```
=== Аренды за 2026-07-21 (12 всего, выручка 85 000 ₽) ===
   active: 5 | completed: 4 | other: 3

Байк                    Рентер              Статус     Даты                  Сумма      Документы
79BIKE Falcon Lynx      Test Test Test      active     20.07 - 21.07         8 500 ₽    verified
Sur-Ron Light Bee X     Закиров Артур       completed  18.07 - 20.07         12 000 ₽   verified
Segway Dirt eBike X160  Иванов Иван         pending    21.07 - 22.07         5 000 ₽    pending
Rawrr Mantis S          (no name)           active     19.07 - 23.07         22 000 ₽   revoked
...
```

Column widths: bike 22, renter 19, status 10, dates 21, sum 10, docs 10.
Pad with spaces; left-align text; right-align the sum.

#### Optional flag: `--verification <verified|pending|revoked|all>`

Filter items by latest `verification_status`. Default `all`.

---

### 2. `sales-dashboard [--date YYYY-MM-DD]`

Text version of the sales analytics page.

**Defaults:** `--date` = today (UTC), format `YYYY-MM-DD`.

**Logic:** Sales live in `private.sale_contract_artifacts` (PII, service_role
only). The crew filter is applied via `resolved_bike_id IN (this crew's bikes)`.

#### Step 1 — fetch crew bike IDs

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/cars?\
select=id&crew_id=eq.${CREW_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Extract `id` values into a comma-separated list `BIKE_IDS`.

#### Step 2 — query sales

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/sale_contract_artifacts?\
select=id,contract_key,buyer_full_name,buyer_passport_number,buyer_email,\
sale_price,price_words,warranty_months,created_at,resolved_bike_id\
&resolved_bike_id=in.(${BIKE_IDS})\
&created_at=gte.${START}&created_at=lte.${END}\
&order=created_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept-Profile: private"     # private schema
```

If `BIKE_IDS` is empty (no bikes registered for crew), pass
`resolved_bike_id=in.(__none__)` to force an empty result instead of skipping
the filter (which would return all sales across all crews).

#### Step 3 — fetch bike details

For each unique `resolved_bike_id`, fetch make/model:

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/cars?\
select=id,make,model,crew_id,type&id=in.(${UNIQUE_BIKE_IDS})" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Dedupe

Same `(buyer_full_name, resolved_bike_id)` dedupe as rentals: keep only the
latest by `created_at DESC`. Multiple sale contracts for the same transaction
(re-uploads) should not inflate the count.

#### Summary

| Metric          | Calculation                                                            |
|-----------------|------------------------------------------------------------------------|
| total sales     | `items.length`                                                         |
| total revenue   | `Σ parseInt(sale_price.replace(/\s/g,''))` (format "390 000" → 390000) |

#### Output format

```
=== Продажи за 2026-07-21 (3 всего, выручка 1 070 000 ₽) ===

Байк                    Покупатель          Цена         Дата
79BIKE Falcon Lynx      Иванов Иван         390 000 ₽    21.07 14:32
Sur-Ron Light Bee X     Петров Пётр         280 000 ₽    21.07 11:05
Segway Dirt eBike X160  Сидоров Сидор       400 000 ₽    21.07 09:18
...
```

Column widths: bike 22, buyer 19, price 12, date 14.
Right-align price; left-align the rest.

---

### 3. `todos-dashboard`

Text version of the crew todos dashboard.

**No date filter** — shows all todos for the crew, grouped by category.

#### Query

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/crew_todos?\
select=id,crew_id,assigned_to,title,description,category,status,priority,\
due_date,created_at,created_by,updated_at,completed_at,\
created_by_user:users!crew_todos_created_by_fkey(user_id,full_name,username),\
assignee:users!crew_todos_assigned_to_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}\
&order=created_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Stats

| Metric    | Calculation                                                          |
|-----------|----------------------------------------------------------------------|
| total     | `items.length`                                                       |
| pending   | `items.filter(status === 'pending').length`                         |
| in_progress | `items.filter(status === 'in_progress').length`                   |
| done      | `items.filter(status === 'done').length`                            |
| overdue   | `items.filter(due_date != null && due_date < now() && status != 'done').length` |

#### Grouping

Group by `category`. Known categories (extend as needed):

- `lead_followup` — follow-up tasks on leads
- `rental_verification` — verify renter documents
- `general` / `maintenance` / `documents` — fallback buckets

#### By assignee

For each unique `assigned_to` user_id, show counts (total / pending / done /
overdue). Unassigned todos are grouped under `(unassigned)`.

#### Output format

```
=== Задачи экипажа vip-bike (47 всего, pending 18, in_progress 4, done 25, overdue 3) ===

— По категориям —

[lead_followup]  12 todo (pending 6 | in_progress 2 | done 4 | overdue 2)
  #1  Позвонить Андрею по аренде Falcon Lynx      assigned: salavey13   due: 22.07 ⚠ overdue
  #2  Отправить КП для ООО Вектор                  assigned: Roman_Vip  due: 25.07
  ...

[rental_verification]  9 todo (pending 4 | done 5 | overdue 0)
  #1  Проверить паспорт Закиров Артур              assigned: salavey13   due: 21.07  ✓ done
  ...

— По исполнителям —

salavey13 (admin)            15 todo (pending 7 | done 7 | overdue 1)
Roman_Vip_Bike_Electro       12 todo (pending 4 | done 7 | overdue 1)
DJORUDJOV                     8 todo (pending 3 | done 5 | overdue 1)
I_O_S_NN (owner)             10 todo (pending 4 | done 6 | overdue 0)
(unassigned)                  2 todo (pending 0 | done 0 | overdue 0)
```

Indicators: `⚠ overdue`, `✓ done`, `→ in_progress` (default pending has none).

---

### 4. `crew-stats`

Crew member statistics.

#### Step 1 — fetch crew members

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/crew_members?\
select=user_id,role,membership_status,\
user:users!inner(user_id,full_name,username,metadata)\
&crew_id=eq.${CREW_ID}\
&membership_status=eq.active\
&order=role.asc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Step 2 — fetch all crew todos (lightweight)

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/crew_todos?\
select=assigned_to,status,due_date\
&crew_id=eq.${CREW_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

#### Aggregate per member

For each crew member, count from the todos array:

| Metric        | Calculation                                                          |
|---------------|----------------------------------------------------------------------|
| todo count    | `todos.filter(assigned_to === user_id).length`                      |
| completed     | `todos.filter(assigned_to === user_id && status === 'done').length` |
| overdue       | `todos.filter(assigned_to === user_id && due_date < now() && status !== 'done').length` |

#### Output format

```
=== Статистика экипажа vip-bike (4 активных) ===

Имя                       Роль      Задач    Выполнено   Просрочено
salavey13 (admin)         admin     15       7           1
Roman_Vip_Bike_Electro    co_owner  12       7           1
DJORUDJOV                 member    8        5           1
I_O_S_NN                  owner     10       6           0
```

Column widths: name 25, role 9, total 8, done 11, overdue 11.
Right-align numbers; left-align names.

---

## Schema reference

Quick lookup for the tables this skill touches.

### `public.rentals`

| Column                  | Type        | Notes                                    |
|-------------------------|-------------|------------------------------------------|
| `rental_id`             | uuid (PK)   | Joined with `private.user_rental_secrets.source_rental_id` |
| `user_id`               | text        | FK → `users.user_id`                     |
| `vehicle_id`            | text        | FK → `cars.id`                           |
| `status`                | text        | `active` / `completed` / `cancelled` / `pending` |
| `payment_status`        | text?       | `paid` / `partial` / `unpaid` / null     |
| `total_cost`            | numeric?    | Rubles                                   |
| `agreed_start_date`     | timestamptz?| Negotiated start                         |
| `agreed_end_date`       | timestamptz?| Negotiated end                           |
| `requested_start_date`  | timestamptz?| Original request start                   |
| `requested_end_date`    | timestamptz?| Original request end                     |
| `created_at`            | timestamptz | Defaults `now()`                         |
| `metadata`              | jsonb       | Extra payload                            |

### `public.cars`

| Column    | Type   | Notes                            |
|-----------|--------|----------------------------------|
| `id`      | text   | PK (slug-like, e.g. `falcon-gt`) |
| `make`    | text   | e.g. `79BIKE`                    |
| `model`   | text   | e.g. `Falcon Lynx`               |
| `crew_id` | uuid   | FK → `crews.id`                  |
| `type`    | text   | `electric` / `gas` / etc.        |
| `specs`   | jsonb? | Optional specs (sale_price, etc.)|

### `public.users`

| Column      | Type   | Notes                                    |
|-------------|--------|------------------------------------------|
| `user_id`   | text   | PK (Telegram user ID)                    |
| `full_name` | text?  | Display name                             |
| `username`  | text?  | Telegram @username                       |
| `metadata`  | jsonb? | `{role: "admin"}` etc.                   |

### `public.crew_members`

| Column              | Type   | Notes                                  |
|---------------------|--------|----------------------------------------|
| `crew_id`           | uuid   | FK → `crews.id`                        |
| `user_id`           | text   | FK → `users.user_id`                   |
| `role`              | text   | `owner` / `co_owner` / `admin` / `member` |
| `membership_status` | text   | `active` / `inactive` / `invited`      |

### `public.crew_todos`

| Column         | Type        | Notes                                              |
|----------------|-------------|----------------------------------------------------|
| `id`           | text (PK)   | UUID                                               |
| `crew_id`      | text        | Filter by crew_id                                  |
| `assigned_to`  | text?       | FK → `users.user_id` (nullable = unassigned)       |
| `title`        | text        | Task title                                         |
| `description`  | text?       | Detailed description                               |
| `category`     | text        | `lead_followup` / `rental_verification` / `general` / etc. |
| `status`       | text        | `pending` / `in_progress` / `done`                 |
| `priority`     | text        | `low` / `medium` / `high`                          |
| `due_date`     | timestamptz?| Optional due date                                  |
| `created_at`   | timestamptz | Defaults `now()`                                   |
| `created_by`   | text?       | FK → `users.user_id`                               |
| `completed_at` | timestamptz?| Auto-set when `status` transitions to `done`       |

### `private.user_rental_secrets`

PII. Service-role only. Latest record per `source_rental_id` (by `created_at DESC`) wins.

| Column                | Type   | Notes                                  |
|-----------------------|--------|----------------------------------------|
| `source_rental_id`    | uuid?  | FK → `rentals.rental_id`               |
| `verification_status` | text   | `verified` / `pending` / `revoked`     |
| `renter_full_name`    | text?  | Extracted from passport                |
| `doc_sha256`          | text?  | Hash of source document                |
| `created_at`          | timestamptz | Defaults `now()`                  |

### `private.sale_contract_artifacts`

PII. Service-role only.

| Column                | Type        | Notes                                          |
|-----------------------|-------------|------------------------------------------------|
| `id`                  | uuid (PK)   |                                                |
| `contract_key`        | text        | Unique                                         |
| `resolved_bike_id`    | text?       | FK → `cars.id` (used for crew filtering)       |
| `buyer_full_name`     | text?       |                                                |
| `buyer_passport_number`| text?      |                                                |
| `buyer_email`         | text?       |                                                |
| `sale_price`          | text?       | Formatted digits, e.g. `"390 000"`             |
| `price_words`         | text?       | Russian words, e.g. `"Триста девяносто тысяч"` |
| `warranty_months`     | text        | Defaults `12`                                  |
| `created_at`          | timestamptz | Defaults `now()`                               |

---

## Notes & guardrails

- **Never** log or print full PII (passport numbers, registration addresses,
  driver license strings). The dashboards above only show `verification_status`
  and `buyer_full_name` — keep it that way in any extended output.
- The service-role key is **not** for client-side use. Only run this skill in
  server-side / sandboxed CLI contexts (Codex agent, server actions, scripts).
- For private schema queries, PostgREST requires the `Accept-Profile: private`
  header (and the `private` schema must be exposed in the Supabase project's
  API schemas config). If a query returns 404 for a private table, fall back to
  a direct `psql` call or an Edge Function — do not silently drop the data.
- Date filtering uses **UTC** boundaries (`YYYY-MM-DDT00:00:00.000Z` to
  `YYYY-MM-DDT23:59:59.999Z`) to match the rentals-dashboard server action.
- Currency formatting: thousands separator is a space (`8 500 ₽`), not a comma.
- When summarizing revenue, only count rows where the price is parseable as a
  number; rows with empty/non-numeric `total_cost` / `sale_price` are counted
  in the row count but contribute 0 to revenue.
- If a query returns no rows, output an empty-state message:

  ```
  === Аренды за 2026-07-21 (0 всего, выручка 0 ₽) ===
  Нет данных за выбранную дату.
  ```

## Related files

- Server actions: `app/franchize/server-actions/rentals-dashboard.ts`
  (reference for query shape, dedupe logic, summary computation)
- Migrations:
  - `supabase/migrations/20260621000000_crew_todos.sql` (crew_todos schema)
  - `supabase/migrations/20260607000000_create_sale_contract_artifacts.sql`
  - `supabase/migrations/20260612000000_fix_rental_contract_artifacts.sql`
  - `supabase/migrations/20260601000000_user_rental_secrets.sql`
- UI reference: `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx`
- Sibling skill: `download/skills/leads-crm-text/SKILL.md` (same pattern)
