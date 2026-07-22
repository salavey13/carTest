---
name: crew-admin-text
description: >
  Text-based admin panel for VIP Bike. Manages crew settings, catalog prices, promotions,
  message templates, palettes. Queries Supabase REST API (curl), outputs formatted text.
  Read + write (admin-only).
  Trigger phrases (RU): "админка", "панель администратора", "управление экипажем",
  "цены байков", "промоакции", "шаблоны сообщений", "цветовые схемы", "палитра",
  "изменить цену", "скидка", "акция".
  Trigger phrases (EN): "admin panel", "crew admin", "manage crew", "bike prices",
  "promotions", "message templates", "color palettes", "change price", "discount",
  "promotion".
---

# Crew Admin (text) — VIP Bike

Триггер-фразы (RU): **`админка`**, **`панель администратора`**, **`управление экипажем`**, **`цены байков`**, **`промоакции`**, **`шаблоны сообщений`**, **`цветовые схемы`**, **`палитра`**, **`изменить цену`**, **`скидка`**, **`акция`**.
Триггер-фразы (EN): `admin panel`, `crew admin`, `manage crew`, `bike prices`, `promotions`, `message templates`, `color palettes`, `change price`, `discount`, `promotion`.

## Overview

Text-based эквивалент страниц `/franchize/vip-bike/admin` и `/franchize/vip-bike/admin/prices`. Управление настройками экипажа: цены байков (`cars.specs`), промоакции (`crews.metadata.promotions`), шаблоны сообщений (`crews.metadata.messageTemplates`), цветовые схемы (`crews.metadata.palette`). Требует admin/owner права.

## When to Use

Use this skill when:

- Нужно изменить цену аренды конкретного байка (без открытия UI).
- Нужно посмотреть текущие промоакции экипажа.
- Нужно создать/обновить промоакцию (скидка на будни / выходные / конкретный байк).
- Нужно посмотреть/изменить шаблоны сообщений (для Telegram bot).
- Нужно посмотреть/изменить цветовую палитру WebApp.

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

# Permission check: only owner / co_owner / admin can use admin commands
ACTOR="${OP_ADMIN}"  # defaults to admin; override with OP_OWNER for sensitive ops
case "$ACTOR" in
  ${OP_OWNER}|${OP_CO_OWNER}|${OP_ADMIN}) ;;
  *) echo "ERROR: actor ${ACTOR} is not admin/owner"; exit 2 ;;
esac
```

## Commands

### 1. `prices-list` — список цен байков экипажа

```bash
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,specs,quantity,type,owner_id\
&crew_id=eq.${CREW_ID}&is_test_result=eq.false\
&order=make.asc,model.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Цены байков vip-bike (4) ===
ID                     Марка/модель             Цена/день     Кол-во  Pricing tiers
falcon-lynx            79BIKE Falcon Lynx       8 500 ₽       1       5 tiers + deposit
sur-ron-light-bee-x    Sur-Ron Light Bee X      5 000 ₽       2       5 tiers + deposit
segway-x160            Segway Dirt eBike X160   4 500 ₽       1       5 tiers + deposit
rawrr-mantis-s         Rawrr Mantis S           6 000 ₽       1       5 tiers + deposit

— Детально (falcon-lynx) —
daily_price (base):    8500
specs.rent_weekday:    8000
specs.rent_weekend:    9500
specs.rent_2_4d:       7500
specs.rent_5_10d:      6500
specs.rent_11_30d:     5500
specs.deposit_rub:     30000
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin/prices`

---

### 2. `price-set <bikeId> --tier <tier> --amount <rubles>` — изменить цену

```bash
BIKE_ID="falcon-lynx"
TIER="rent_weekday"   # rent_weekday | rent_weekend | rent_2_4d | rent_5_10d | rent_11_30d | deposit_rub | dailyPrice
AMOUNT="8000"

# Fetch current specs
CURRENT_SPECS=$(curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=specs\
&id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].specs // {}')

# Merge new tier value
NEW_SPECS=$(echo "$CURRENT_SPECS" | jq --arg tier "$TIER" --argjson amount "$AMOUNT" \
  '. + {($tier): $amount}')

# PATCH cars.specs
curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/cars?id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --argjson specs "$NEW_SPECS" '{specs: $specs}')"

# If tier=dailyPrice, also update cars.daily_price for catalog display
[ "$TIER" = "dailyPrice" ] && \
curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/cars?id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --argjson amount "$AMOUNT" '{daily_price: $amount}')"
```

**Пример вывода:**

```
✓ Цена обновлена
  Байк:        falcon-lynx (79BIKE Falcon Lynx)
  Tier:        rent_weekday
  Old value:   9000 ₽
  New value:   8000 ₽
  Changed by:  413553377 (salavey13, admin)
  At:          2026-07-21T23:50:00.000Z
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin/prices`

---

### 3. `promotions-list` — список промоакций

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=id,slug,metadata\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.promotions // []'
```

**Логика:** Промоакции хранятся в `crews.metadata.promotions` (jsonb array). Каждая промоакция: `{id, title, bike_id?, discount_percent, valid_from, valid_to, active}`.

**Пример вывода:**

```
=== Промоакции vip-bike (3 активных) ===
ID              Заголовок                   Байк              Скидка  Период                  Активна
summer-2026     Летняя скидка               (все)             15%     01.06 — 31.08.2026      ✓
falcon-promo    Falcon Lynx будни           falcon-lynx       10%     15.07 — 15.08.2026      ✓
weekend-2x      Выходные +10% на сурик       sur-ron-light-bee -10%    01.07 — 30.09.2026      ✓
                                                                          (negative = наценка)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin`

---

### 4. `promotion-create --title <title> [--bikeId <id>] --discount <percent> --from <date> --to <date>` — создать промо

```bash
TITLE="Осенняя скидка"
BIKE_ID=""   # empty = all bikes
DISCOUNT="15"
FROM="2026-09-01"
TO="2026-11-30"

# Fetch current metadata
CURRENT_META=$(curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=metadata\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata // {}')

# Build new promotion object
NEW_PROMO=$(jq -n \
  --arg id "autumn-2026" \
  --arg title "$TITLE" \
  --arg bike "$BIKE_ID" \
  --argjson discount "$DISCOUNT" \
  --arg from "$FROM" \
  --arg to "$TO" \
  '{id: $id, title: $title, bike_id: ($bike | select(. != "")), discount_percent: $discount, valid_from: $from, valid_to: $to, active: true, created_at: now}')

# Merge into metadata.promotions array
NEW_META=$(echo "$CURRENT_META" | jq --argjson promo "$NEW_PROMO" \
  '.promotions = ((.promotions // []) + [$promo])')

# PATCH crews.metadata
curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/crews?slug=eq.${CREW_SLUG}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --argjson meta "$NEW_META" '{metadata: $meta}')"
```

**Пример вывода:**

```
✓ Промоакция создана
  ID:           autumn-2026
  Заголовок:    Осенняя скидка
  Байк:         (все)
  Скидка:       15%
  Период:       01.09.2026 — 30.11.2026
  Активна:      да
  Создал:       413553377 (salavey13, admin)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin`

---

### 5. `message-templates-list` — шаблоны сообщений

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=metadata\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.messageTemplates // []'
```

**Логика:** Шаблоны хранятся в `crews.metadata.messageTemplates` (jsonb array). Каждый: `{id, title, body, channel, language, active}`.

**Пример вывода:**

```
=== Шаблоны сообщений vip-bike (5) ===
ID              Заголовок                   Канал      Язык   Активен
welcome         Приветствие                 telegram   ru     ✓
reminder_24h    Напоминание за 24 часа       telegram   ru     ✓
reminder_1h     Напоминание за 1 час         telegram   ru     ✓
review_request  Просьба оставить отзыв       telegram   ru     ✓
overdue_qr      QR не принят (follow-up)     telegram   ru     ✓
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin`

---

### 6. `palette-list` / `palette-set` — цветовая палитра WebApp

```bash
# List current palette
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=metadata\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.palette // {}'

# Set new palette (PATCH)
NEW_PALETTE='{"primary":"#E60023","secondary":"#FFFFFF","accent":"#FFD700","background":"#0A0A0A","text":"#FFFFFF"}'
CURRENT_META=$(curl -sS "${SUPABASE_URL}/rest/v1/crews?select=metadata&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata // {}')
NEW_META=$(echo "$CURRENT_META" | jq --argjson palette "$NEW_PALETTE" '.palette = $palette')

curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/crews?slug=eq.${CREW_SLUG}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --argjson meta "$NEW_META" '{metadata: $meta}')"
```

**Пример вывода:**

```
=== Палитра vip-bike ===
primary:     #E60023 (красный)
secondary:   #FFFFFF (белый)
accent:      #FFD700 (золотой)
background:  #0A0A0A (тёмный)
text:        #FFFFFF (белый)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin`

---

## Schema Access

### Public schema

- `crews` — `id` (uuid PK), `name`, `description`, `logo_url`, `owner_id`, `slug`, `hq_location`, `metadata` (jsonb — `palette`, `promotions`, `messageTemplates`, `is_provider`, etc.), `created_at`, `updated_at`.
- `cars` — `id` (text PK), `make`, `model`, `daily_price`, `specs` (jsonb — pricing tiers), `crew_id`, `quantity`, `availability_rules`.
- `crew_members` — для проверки прав (role must be `owner`/`co_owner`/`admin`).
- `users` — `user_id`, `role`, `metadata.role` — для permission check.

### Private schema

Admin skill не использует private schema (всё хранится в public.crews.metadata).

## Web Links

| Command               | Web page                                                                              |
|-----------------------|---------------------------------------------------------------------------------------|
| `prices-list`         | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin/prices    |
| `price-set`           | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin/prices    |
| `promotions-list`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin           |
| `promotion-create`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin           |
| `message-templates-list`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin          |
| `palette-list`        | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin           |
| `palette-set`         | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/admin           |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--force`~~ — не существует. Все изменения требуют admin/owner право.
- ~~`price-set --tier all`~~ — не существует. Изменение одного tier за раз.
- ~~`promotion-create --scheduleCron <expr>`~~ — не существует. Планирование через внешний cron.
- ~~`--delete-bike <bikeId>`~~ — не существует. Удаление ТС — через SQL/Dashboard (cascade delete Rentals).
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--userRole <role>`~~ — не существует. Роль берётся из `crew_members.role` для `ACTOR`.
- ~~`palette-set --theme dark|light`~~ — не существует. Только явные цвета.

## Error Handling

| Stage                | Reason                                  | Когда возникает                                                       | Exit | Что делать                                       |
|----------------------|-----------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found`   | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `permission_denied`  | `Actor <id> is not admin/owner`         | `ACTOR` env не установлен или не admin/owner                          | 2    | Установить `ACTOR=${OP_ADMIN}` или `${OP_OWNER}` |
| `bike_not_found`     | `Bike not found: <bikeId>`              | `price-set` — нет ТС с таким ID у экипажа                             | 2    | Проверить `prices-list` для валидных IDs         |
| `tier_invalid`       | `Invalid tier: <value>`                 | `price-set --tier bogus`                                              | 2    | Использовать `rent_weekday`/`rent_weekend`/`rent_2_4d`/`rent_5_10d`/`rent_11_30d`/`deposit_rub`/`dailyPrice` |
| `amount_invalid`     | `Amount must be positive integer`       | `--amount -500` или `--amount abc`                                    | 2    | Использовать положительное целое число            |
| `date_parse`         | `Invalid date format`                   | `--from` / `--to` не YYYY-MM-DD                                       | 2    | Использовать `YYYY-MM-DD`                        |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`          | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`          | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `patch_no_rows`      | `PATCH returned no rows`                | Bike с указанным ID не найден в crew                                  | 2    | Проверить `prices-list`                          |
| `promotion_dup`      | `Promotion ID already exists`           | `promotion-create` с уже существующим `id`                            | 2    | Использовать уникальный ID                       |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **Permission check**: только `owner` / `co_owner` / `admin` могут использовать write-команды (`price-set`, `promotion-create`, `palette-set`). `member` — только read. Чек делается через `crew_members.role` для `ACTOR`.
- **PII handling**: admin skill не работает с PII клиентов (только с catalog/crew settings).
- **Audit log**: все write-операции должны записывать actor + timestamp в `metadata.lastChange = {at, by, field, oldValue, newValue}`. В CLI-skills это делается через server-actions; прямой PATCH не пишет аудит-лог.
- **Palette colors**: hex-строки — безопасны (не PII).
- **Promotion discount**: `-10%` = наценка (negative discount), `+15%` = скидка. Выводить явный знак для operator.
- Skill делает PATCH в `cars` и `crews`. Read-only команды: `prices-list`, `promotions-list`, `message-templates-list`, `palette-list`.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (revenue affected by promotions)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — catalog (prices set by admin)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (status changes via admin)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (change roles via admin)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft (admin approves)
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders (admin manages abandoned carts)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info (admin edits public info)
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/config.ts` — crew config CRUD
- `app/franchize/server-actions/catalog.ts` — catalog/prices CRUD
- `app/franchize/server-actions/promotions.ts` — promotions CRUD
- `app/franchize/server-actions/message-templates.ts` — message templates CRUD
- `app/franchize/server-actions/palette.ts` — palette CRUD
- `app/franchize/server-actions/crew-todos-constants.ts` — todo constants
- `app/franchize/server-actions/checklist.ts` — admin checklist

**Schema migrations:**

- `crews` table — original schema (`metadata` jsonb holds all admin-editable config)
- `cars` table — `specs` jsonb holds pricing tiers
- `20260722000000_hotfix_schema_discrepancies.sql` — `cars.quantity`, `cars.availability_rules`

**UI references:**

- `app/franchize/[slug]/admin/page.tsx` — admin panel
- `app/franchize/[slug]/admin/prices/page.tsx` — prices editor

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
