---
name: franchize-catalog-text
description: >
  Text-based catalog for VIP Bike franchise. Query bikes, pricing, availability via Supabase
  REST API (curl). Outputs formatted text — no UI, no JSON blobs.
  Trigger phrases (RU): "каталог байков", "список байков", "сколько стоит аренда",
  "доступность байка", "покажи байки", "какие байки есть", "цена байка", "залог за байк",
  "характеристики байка", "свободен ли байк", "бронь байка".
  Trigger phrases (EN): "bike catalog", "bike list", "bike pricing", "bike availability",
  "show bikes", "bike specs", "bike deposit", "is bike free", "bike tier prices".
---

# Franchize Catalog (text) — VIP Bike

Триггер-фразы (RU): **`каталог байков`**, **`список байков`**, **`сколько стоит аренда`**, **`доступность байка`**, **`покажи байки`**, **`какие байки есть`**, **`цена байка`**, **`залог за байк`**, **`характеристики байка`**, **`свободен ли байк`**, **`бронь байка`**.
Триггер-фразы (EN): `bike catalog`, `bike list`, `bike pricing`, `bike availability`, `show bikes`, `bike specs`, `bike deposit`, `is bike free`, `bike tier prices`.

## Overview

Text-based эквивалент каталога ТС для экипажа `vip-bike`. Читает таблицу `public.cars` через Supabase REST API (PostgREST), фильтрует по `crew_id = 2d5fde70-1dd3-4f0d-8d72-66ccf6908746` и `type = bike`, выводит форматированную текстовую таблицу. Также читает `public.rentals` для проверки доступности конкретного байка на дату.

Skill использует только `curl` к Supabase REST API и стандартные shell-утилиты. Не запускает Node.js сервер, не требует сборки Next.js.

## When to Use

Use this skill when:

- Нужно быстро увидеть список доступных байков экипажа `vip-bike` из CLI / Telegram.
- Нужно проверить цену аренды конкретного байка по всем tiers (будни / выходные / 2–4д / 5–10д / 11–30д / залог).
- Нужно показать полные спецификации одного байка (specs jsonb, image_url, availability_rules).
- Нужно проверить, свободен ли байк на конкретную дату (на основе активных/подтверждённых аренд).
- Нужно ответить клиенту в Telegram «какие байки есть» без открытия браузера.

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
```

## Commands

### 1. `list-bikes [--type bike|scooter|all]` — список ТС экипажа

```bash
# Все байки (type=bike)
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,image_url,specs,availability_rules,quantity,type,owner_id\
&crew_id=eq.${CREW_ID}&type=eq.bike&is_test_result=eq.false\
&order=make.asc,model.asc" \
  "${HDR_PUBLIC[@]}"

# Самокаты
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,quantity,specs\
&crew_id=eq.${CREW_ID}&type=eq.scooter&is_test_result=eq.false\
&order=make.asc" \
  "${HDR_PUBLIC[@]}"

# Все ТС (без фильтра по типу)
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,quantity,type,specs\
&crew_id=eq.${CREW_ID}&is_test_result=eq.false\
&order=type.asc,make.asc" \
  "${HDR_PUBLIC[@]}"
```

**Логика:** Query `public.cars` where `crew_id = ${CREW_ID}` AND `type = bike` (или `scooter`, или без фильтра для `all`). Дополнительно `is_test_result = false` — отбрасывает ТС, сгенерированные embedding-пайплайном.

**Пример вывода:**

```
=== Каталог vip-bike (bikes) — 4 позиций ===
ID                     Марка             Модель                   Цена/день     Кол-во  Ключевые спецификации
──────────────────────  ────────────────  ────────────────────────  ──────────  ──────  ────────────────────────────────────────────────────
falcon-lynx            79BIKE            Falcon Lynx              8 500 ₽      1       color=black, year=2025, power_kw=8, battery_kwh=2.1
sur-ron-light-bee-x    Sur-Ron           Light Bee X              5 000 ₽      2       color=white, year=2024, power_kw=6, battery_kwh=1.8
segway-x160            Segway            Dirt eBike X160          4 500 ₽      1       color=blue, year=2024, power_kw=3
rawrr-mantis-s         Rawrr             Mantis S                 6 000 ₽      1       color=gray, year=2025, range_km=120

— Изображения —
  falcon-lynx:          https://.../falcon-lynx.jpg
  sur-ron-light-bee-x:  https://.../sur-ron-light-bee-x.jpg
  segway-x160:          https://.../segway-x160.jpg
  rawrr-mantis-s:       https://.../rawrr-mantis-s.jpg
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

---

### 2. `bike-detail <bikeId>` — полные детали байка

```bash
BIKE_ID="falcon-lynx"
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,description,daily_price,image_url,rent_link,is_test_result,\
specs,owner_id,type,crew_id,availability_rules,quantity\
&id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'
```

**Пример вывода:**

```
=== Байк: 79BIKE Falcon Lynx ===
ID:               falcon-lynx
Тип:              bike
Crew:             2d5fde70-1dd3-4f0d-8d72-66ccf6908746 (vip-bike)
Количество:       1
Базовая цена/день: 8 500 ₽
Is test result:   нет
Owner ID:         413553377
Ссылка на аренду: https://t.me/...
Изображение:      https://.../falcon-lynx.jpg

— Описание —
Электрический мотоцикл городского класса, дальность до 150 км...

— Pricing tiers (from specs) —
Tier                   Цена         Единица
──────────────────────  ──────────  ─────────
Будни (1 день)         8 000 ₽     ₽/день
Выходной (1 день)      9 500 ₽     ₽/день
2–4 дня                7 500 ₽     ₽/день
5–10 дней              6 500 ₽     ₽/день
11–30 дней             5 500 ₽     ₽/день
Залог                  30 000 ₽    ₽

— Полные спецификации (specs jsonb) —
  dailyPrice            8500
  rent_weekday          8000
  rent_weekend          9500
  rent_2_4d             7500
  rent_5_10d            6500
  rent_11_30d           5500
  deposit_rub           30000
  color                 black
  year                  2025
  vin                   XYZ123456789
  power_kw              8
  battery_kwh           2.1
  range_km              150
  weight_kg             65

— Правила доступности (availability_rules jsonb) —
  available             true
  season                Apr-Oct
  min_rental_days       1
  max_rental_days       30
  notice_hours          2
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

---

### 3. `bike-pricing <bikeId>` — все pricing tiers

```bash
BIKE_ID="falcon-lynx"
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,specs\
&id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0] | {daily_price, specs: (.specs // {})}'
```

**Пример вывода:**

```
=== Pricing: 79BIKE Falcon Lynx (id: falcon-lynx) ===
Базовая цена/день (cars.daily_price): 8 500 ₽

— Tiers from specs jsonb —
Tier                   Цена         Единица
──────────────────────  ──────────  ─────────
Будни (1 день)         8 000 ₽     ₽/день
Выходной (1 день)      9 500 ₽     ₽/день
2–4 дня                7 500 ₽     ₽/день
5–10 дней              6 500 ₽     ₽/день
11–30 дней             5 500 ₽     ₽/день
Залог                  30 000 ₽    ₽

specs.dailyPrice: 8 500 ₽
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

---

### 4. `check-availability <bikeId> [--date YYYY-MM-DD]` — доступность на дату

```bash
BIKE_ID="falcon-lynx"
DATE="${1:-$(date -u '+%Y-%m-%d')}"
START="${DATE}T00:00:00.000Z"
END="${DATE}T23:59:59.999Z"

# Активные/подтверждённые аренды этого байка, пересекающие выбранную дату
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,status,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date\
&vehicle_id=eq.${BIKE_ID}\
&status=in.(active,confirmed,pending_confirmation)\
&requested_start_date=lte.${END}&requested_end_date=gte.${START}\
&order=requested_start_date.asc" \
  "${HDR_PUBLIC[@]}"

# Количество ТС (для определения, свободен ли ещё байк, если quantity > 1)
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=quantity\
&id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0].quantity'
```

**Логика:** Если `blocking.length >= quantity` → байк занят. Иначе — свободен (но может быть частично занят, если `blocking.length > 0 && quantity > 1`).

**Пример вывода:**

```
=== Доступность: falcon-lynx на 2026-07-25 ===
Количество ТС:     1
Активных броней:   1 (пересекают дату)

— Брони —
  rental_id:   a1b2c3d4-...
  статус:      confirmed
  renter_id:   78901234
  даты:        25.07 10:00 — 27.07 20:00

Результат: ❌ ЗАКРЫТ для аренды на эту дату
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

---

### 5. `find-bike <query>` — поиск байка по марке/модели

```bash
QUERY="BMW"
# PostgREST `ilike` for case-insensitive substring match
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,type,quantity\
&crew_id=eq.${CREW_ID}&is_test_result=eq.false\
&or=(make.ilike.*${QUERY}*,model.ilike.*${QUERY}*,id.ilike.*${QUERY}*)\
&order=make.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Поиск: "BMW" — 2 совпадения ===
ID                     Марка             Модель                   Цена/день     Кол-во
──────────────────────  ────────────────  ────────────────────────  ──────────  ──────
bmw-f800r-001          BMW               F800R                    7 000 ₽      1
bmw-r1250rs            BMW               R1250RS                  12 000 ₽     1
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro`

---

## Schema Access

### Public schema

- `cars` — `id` (text PK), `make`, `model`, `description`, `embedding` (vector), `daily_price`, `image_url`, `rent_link`, `is_test_result`, `specs` (jsonb — `dailyPrice`, `rent_weekday`, `rent_weekend`, `rent_2_4d`, `rent_5_10d`, `rent_11_30d`, `deposit_rub`, `color`, `year`, `vin`, `power_kw`, `battery_kwh`, `range_km`, `weight_kg`), `owner_id`, `type` (`bike` / `scooter` / `car` / `service`), `crew_id`, `availability_rules` (jsonb — `available`, `season`, `min_rental_days`, `max_rental_days`, `notice_hours`), `quantity`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `crew_id`. Используется только для проверки доступности.
- `crews` — `id`, `slug`, `name`. Используется для резолва `crew_id` по `slug`.

### Private schema

Catalog skill не использует private schema.

## Web Links

| Command            | Web page                                                                              |
|--------------------|---------------------------------------------------------------------------------------|
| `list-bikes`       | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro  |
| `bike-detail`      | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro  |
| `bike-pricing`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro  |
| `check-availability`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro |
| `find-bike`        | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/electro-enduro  |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Skill всегда выводит текстовую таблицу.
- ~~`--currency USD|EUR`~~ — не существует. Только ₽.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--includeTestResults`~~ — не существует. `is_test_result=true` ТС всегда отбрасываются.
- ~~`--vin <vin>`~~ — не существует. VIN хранится в `specs->>vin`; для поиска по VIN используйте `find-bike` с VIN строкой.
- ~~`--embedding <vector>`~~ — не существует. Semantic search через embedding не поддерживается в text-skill.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует. Только текстовая таблица.
- ~~`bike-detail --withRentals`~~ — не существует. Для аренд байка используйте `rental-card-text` skill.
- ~~`check-availability --range <start> <end>`~~ — не существует. Только одна дата. Для диапазона вызовите команду несколько раз.

## Error Handling

| Stage             | Reason                                | Когда возникает                                              | Exit | Что делать                                       |
|-------------------|---------------------------------------|--------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`    | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен     | 2    | Проверить путь или export env                    |
| `bike_not_found`  | `Bike not found: <bikeId>`            | `bike-detail`/`bike-pricing` — нет ТС с таким ID у экипажа   | 2    | Проверить `list-bikes` для валидных IDs          |
| `bike_wrong_crew` | `Bike <id> belongs to another crew`   | `bike-detail` для ТС другого экипажа (crew_id не совпадает)  | 2    | Проверить `crew_id` в URL запроса                |
| `supabase_4xx`    | `Supabase cars 4xx: <body>`           | Неверный select, RLS, нет такой колонки                      | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`    | `Supabase cars 5xx: <body>`           | Supabase лежит, rate-limit                                   | 2    | Повторить через минуту                           |
| `date_parse`      | `Invalid date format`                 | `--date` не парсится как YYYY-MM-DD                          | 2    | Использовать `YYYY-MM-DD`                        |
| `empty_catalog`   | `[]`                                   | У экипажа нет ТС в `cars` с указанным `type`                | 0    | Вывод: `Каталог пуст.`                           |

## Security

- **Service role key** — полный read/write ко всем схемам. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header `apikey` / `Authorization: Bearer`.
- **PII handling**: catalog не содержит PII клиентов, но `specs` может включать VIN. Не выводить VIN в публичных каналах без необходимости.
- **Private schema headers**: не нужны для catalog skill (только public.cars / public.rentals).
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics dashboards
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — single rental card (uses bike info)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew members
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders/checkout (selects bike to rent)
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin panel (edits catalog prices)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/catalog.ts` — `getCatalog()`, `getBike()`
- `app/franchize/server-actions/get-crew-vehicles.ts` — `getCrewVehicles()`
- `app/franchize/lib/catalog-utils.ts` — pricing tier resolver
- `app/franchize/lib/catalog-tier-utils.ts` — tier constants
- `app/api/franchize/catalog/route.ts` — public catalog endpoint

**Schema migrations:**

- `cars` table — original schema (no migration file; legacy)
- `20260722000000_hotfix_schema_discrepancies.sql` — `cars.quantity`, `cars.availability_rules`

**UI references:**

- `app/franchize/[slug]/electro-enduro/page.tsx` — catalog page
- `app/franchize/[slug]/configurator/page.tsx` — bike configurator
- `app/franchize/[slug]/market/[bike_id]/buy/page.tsx` — buy page (uses bike specs)

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
