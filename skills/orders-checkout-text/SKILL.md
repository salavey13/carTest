---
name: orders-checkout-text
description: >
  Text-based orders & checkout flow for VIP Bike. Lists orders, cart state, checkout
  intents, payment status. Queries Supabase REST API (curl), outputs formatted text.
  Trigger phrases (RU): "заказы", "корзина", "оформление заказа", "чекаут", "покупка байка",
  "аренда в корзине", "intent оформления", "статус заказа", "оплачен ли заказ",
  "payment failure", "провал оплаты".
  Trigger phrases (EN): "orders", "cart", "checkout", "order status", "buy bike",
  "rental in cart", "checkout intent", "payment status", "payment failure",
  "order detail".
---

# Orders & Checkout (text) — VIP Bike

Триггер-фразы (RU): **`заказы`**, **`корзина`**, **`оформление заказа`**, **`чек аут`**, **`покупка байка`**, **`аренда в корзине`**, **`intent оформления`**, **`статус заказа`**, **`оплачен ли заказ`**, `payment failure`, **`провал оплаты`**.
Триггер-фразы (EN): `orders`, `cart`, `checkout`, `order status`, `buy bike`, `rental in cart`, `checkout intent`, `payment status`, `payment failure`, `order detail`.

## Overview

Text-based эквивалент страниц `/franchize/vip-bike/order`, `/franchize/vip-bike/order/[id]`, `/franchize/vip-bike/cart`, `/franchize/vip-bike/market/[bike_id]/buy`. Показывает заказы и checkout flow: cart state, intent history (`franchize_intents` с `intent_type` in checkout/payment), payment status, hold state.

## When to Use

Use this skill when:

- Нужно увидеть активные заказы/checkout flows клиентов vip-bike.
- Нужно проверить, на каком этапе оформления находится клиент (checkout_start → hold_created → payment_success/failed).
- Нужно найти брошенные корзины (checkout_start без payment).
- Нужно показать провалы оплаты (`intent_type='payment_failure'`) для follow-up.
- Нужно вывести intent history конкретного клиента (от map_click до payment_success).

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
```

## Commands

### 1. `list-orders [--status all|abandoned|paid|failed]` — список заказов/intents

```bash
# Все checkout/payment intents за последние 30 дней
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"
FROM_ISO="$(date -u -d '30 days ago' '+%Y-%m-%dT%H:%M:%S.000Z')"

curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,slug,bike_id,intent_type,stage,urgency_score,metadata,telegram_user_id,phone,\
last_seen_at,created_at\
&slug=eq.${CREW_SLUG}\
&intent_type=in.(checkout_start,hold_created,payment_success,payment_failure,prebuy,trade_in,finance,rent,sale)\
&created_at=gte.${FROM_ISO}\
&order=created_at.desc&limit=50" \
  "${HDR_PUBLIC[@]}"

# Брошенные корзины (checkout_start без последующего payment)
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,bike_id,stage,metadata,created_at,last_seen_at\
&slug=eq.${CREW_SLUG}\
&intent_type=eq.checkout_start\
&stage=in.(checkout_started,prebuy_started)\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"

# Провалы оплаты
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,bike_id,stage,metadata,created_at\
&slug=eq.${CREW_SLUG}\
&intent_type=eq.payment_failure\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Заказы vip-bike (50 последних за 30 дней) ===

Тип               Стадия              Байк                  Клиент           Создан
checkout_start    checkout_started    bmw-f800r-001         +7XXXXXXXX42     21.07 14:30
hold_created      hold_created        falcon-lynx           +7XXXXXXXX99     21.07 13:15
payment_success   payment_confirmed   sur-ron-light-bee-x   +7XXXXXXXX77     21.07 12:00
payment_failure   payment_failed      segway-x160           +7XXXXXXXX33     21.07 11:45
prebuy            prebuy_started      rawrr-mantis-s        +7XXXXXXXX55     21.07 10:30

— Сводка —
Всего intents:     50
Брошенных корзин:  12 (checkout_start без payment_success)
Успешных оплат:    28
Провалов оплат:    10

— Топ-3 брошенных корзины (по давности) —
  #1  bmw-f800r-001     +7XXXXXXXX42     3 дня назад   21.07 14:30
  #2  falcon-lynx       +7XXXXXXXX99     2 дня назад   19.07 16:20
  #3  segway-x160       +7XXXXXXXX33     1 день назад  20.07 11:45
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order`

---

### 2. `order-detail <intentId>` — детали заказа/intent

```bash
INTENT_ID="27e054e3-8db9-4394-b5e9-78d48d973ced"

# 1. Intent details
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,slug,bike_id,intent_type,stage,urgency_score,metadata,telegram_user_id,phone,\
source_route,contact_channel,last_seen_at,created_at,updated_at\
&id=eq.${INTENT_ID}&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'

# 2. Bike details (if bike_id present)
BIKE_ID="<from_intent>"
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id,make,model,daily_price,specs,type,crew_id\
&id=eq.${BIKE_ID}&crew_id=eq.${CREW_ID}" \
  "${HDR_PUBLIC[@]}"

# 3. Renter (if telegram_user_id present)
TG_USER_ID="<from_intent>"
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,metadata\
&user_id=eq.${TG_USER_ID}" \
  "${HDR_PUBLIC[@]}"

# 4. All intents this user has on this bike (timeline)
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,intent_type,stage,urgency_score,created_at,last_seen_at\
&slug=eq.${CREW_SLUG}&telegram_user_id=eq.${TG_USER_ID}&bike_id=eq.${BIKE_ID}\
&order=created_at.asc" \
  "${HDR_PUBLIC[@]}"

# 5. Rental created from this checkout (if any)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,vehicle_id,status,total_cost,created_at\
&crew_id=eq.${CREW_ID}&user_id=eq.${TG_USER_ID}&vehicle_id=eq.${BIKE_ID}\
&order=created_at.desc&limit=1" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Intent: 27e054e3-... ===
Slug:               vip-bike
Intent type:        checkout_start
Stage:              checkout_started
Urgency:            70
Source route:       /franchize/vip-bike/market/bmw-f800r-001
Contact channel:    telegram
Created:            21.07 14:30 (UTC)
Last seen:          21.07 14:32 (UTC)

— Байк —
ID:                 bmw-f800r-001
Марка/модель:       BMW F800R
Цена/день:          7 000 ₽

— Рентер —
TG user_id:         78901234
Username:           @egor_logunov
ФИО:                Логунов Е.
Телефон:            +7XXXXXXXX42 (masked)

— Timeline (5 events) —
  13.07 10:15  map_click         clicked              urgency 30
  21.07 14:00  checkout_start    checkout_started     urgency 70
  21.07 14:30  hold_created      hold_created         urgency 80
  21.07 14:32  checkout_start    checkout_started     urgency 70  (re-entry)
  ... (no payment_success yet — брошенная корзина)

— Rental —
Аренда не создана (checkout не завершён).

Рекомендация: позвонить клиенту для помощи в оформлении.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order`

---

### 3. `cart-detail <userId>` — состояние корзины клиента

```bash
TG_USER_ID="78901234"

# Все активные intents клиента (cart-like)
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,bike_id,intent_type,stage,urgency_score,metadata,created_at,last_seen_at\
&slug=eq.${CREW_SLUG}&telegram_user_id=eq.${TG_USER_ID}\
&stage=not.in.(closed,dismissed)\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"

# Bike details for all bikes in cart
# (используйте bike_id из предыдущего запроса для bulk cars lookup)
```

**Логика:** "Корзина" в VIP Bike — это совокупность активных `franchize_intents` клиента (stage != closed/dismissed). Каждый intent = один товар в "корзине" (байк для аренды/покупки).

**Пример вывода:**

```
=== Корзина клиента 78901234 (3 активных intent) ===

Байк                  Intent type        Стадия              Urgency   Создан
bmw-f800r-001         checkout_start     checkout_started    70        21.07 14:30
falcon-lynx           prebuy             prebuy_started      60        20.07 12:00
sur-ron-light-bee-x   map_click          clicked             20        18.07 09:15

— Самый свежий —
Байк:        BMW F800R (bmw-f800r-001)
Intent:      checkout_start (checkout_started)
Создан:      21.07 14:30 (UTC)

⚠️ Клиент в checkout, но платёж не прошёл. Follow-up рекомендован.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/cart`

---

### 4. `payment-failures [--from YYYY-MM-DD]` — провалы оплат

```bash
FROM_ISO="${FROM:-$(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%S.000Z')}"

curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,bike_id,stage,metadata,created_at\
&slug=eq.${CREW_SLUG}\
&intent_type=eq.payment_failure\
&created_at=gte.${FROM_ISO}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Провалы оплат vip-bike за 7 дней (10) ===

Дата          Байк                  Клиент           Причина (metadata)
21.07 11:45   segway-x160           +7XXXXXXXX33     card_declined
20.07 16:20   falcon-lynx           +7XXXXXXXX99     insufficient_funds
19.07 10:15   rawrr-mantis-s        +7XXXXXXXX55     card_expired
...

Рекомендация: 10 клиентов нуждаются в follow-up по оплате.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order`

---

### 5. `checkout-funnel` — воронка оформления

```bash
# Group intents by stage
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=intent_type,stage\
&slug=eq.${CREW_SLUG}\
&intent_type=in.(checkout_start,hold_created,payment_success,payment_failure)" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.intent_type) | map({type: .[0].intent_type, count: length})'
```

**Пример вывода:**

```
=== Воронка оформления vip-bike ===

checkout_start:    48
  → hold_created:        30 (62%)
  → payment_success:     28 (58%)
  → payment_failure:     10 (21%)

Конверсия checkout → payment_success: 58%
Отток: 21% (payment failures) + 21% (abandoned после hold)

Топ-3 причины отвала:
  1. card_declined            4
  2. abandoned_at_checkout    3
  3. insufficient_funds       2
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order`

---

## Schema Access

### Public schema

- `franchize_intents` — `id` (uuid PK), `slug`, `bike_id`, `intent_type` (`checkout_start` / `payment_failure` / `payment_success` / `hold_created` / `map_click` / `contact_click` / `test_ride_click` / `test_ride` / `prebuy` / `trade_in` / `finance` / `rent` / `sale`), `stage` (`discovered` / `clicked` / `prebuy_started` / `checkout_started` / `hold_created` / `payment_failed` / `payment_confirmed` / `contacted` / `test_ride_requested` / `trade_in_requested` / `finance_requested` / `viewed` / `configured` / `offer_sent` / `manual_reserved` / `alternative_offered` / `closed` / `contract_generated`), `source_route`, `contact_channel`, `urgency_score` (0–100), `metadata` (jsonb — `paymentFailureReason`, `holdId`, etc.), `telegram_user_id`, `phone`, `last_seen_at`, `created_at`, `updated_at`.
- `cars` — `id`, `make`, `model`, `daily_price`, `specs`, `type`, `crew_id`. Для bike display.
- `users` — `user_id`, `username`, `full_name`, `metadata`. Для renter display.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `total_cost`, `created_at`. Чтобы найти созданную аренду из успешного checkout.

### Private schema

- `sale_contract_artifacts` — PII. Для покупок, прошедших checkout (intent_type=sale → sale_contract_artifacts).
- `rental_contract_artifacts` — PII. Для аренд, прошедших checkout (intent_type=rent → rental → rental_contract_artifacts).

## Web Links

| Command            | Web page                                                                              |
|--------------------|---------------------------------------------------------------------------------------|
| `list-orders`      | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order           |
| `order-detail`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order/<id>      |
| `cart-detail`      | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/cart            |
| `payment-failures` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order           |
| `checkout-funnel`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/order           |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--addToCart <bikeId>`~~ — не существует. Skill read-only. Добавление в корзину — через UI.
- ~~`--removeFromCart <intentId>`~~ — не существует. Skill read-only. Удаление — через UI.
- ~~`--checkout <intentId>`~~ — не существует. Skill read-only. Checkout — через UI/server-action.
- ~~`--refund <paymentId>`~~ — не существует. Рефанды — через платежную систему (YooKassa/Stripe) admin panel.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--includePaymentId`~~ — не существует. Payment ID живёт в `metadata.paymentId`; выводится если есть.
- ~~`--groupBy bikeId`~~ — не существует. Группировка делается через `jq 'group_by(.bike_id)'`.

## Error Handling

| Stage                | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|----------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `intent_not_found`   | `Intent not found: <intentId>`        | `order-detail` — нет intent с таким `id`                              | 2    | Проверить `list-orders` для валидных IDs         |
| `user_not_found`     | `User not found: <userId>`            | `cart-detail` — нет пользователя с таким `telegram_user_id`           | 2    | Проверить `find-rider` в `rider-profile-text`    |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `date_parse`         | `Invalid date format`                 | `--from` не парсится как YYYY-MM-DD                                   | 2    | Использовать `YYYY-MM-DD`                        |
| `no_intents`         | `[]`                                   | У клиента нет intents                                                | 0    | Вывод: `Нет заказов.`                            |
| `no_failures`        | `[]`                                   | Нет провалов оплат за период                                          | 0    | Вывод: `Провалов оплат не было.`                 |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking**:
  - Телефон → `+7XXXXXXXX42` (первые 4 + `…`).
  - Email → `i…@example.com`.
  - ФИО → фамилия с инициалами в публичных чатах.
  - Payment ID / card info — **никогда** не выводить в stdout (чувствительные платёжные данные).
  - `metadata.paymentFailureReason` — можно выводить (это причина, не данные карты).
- **Private schema headers**: для `sale_contract_artifacts`, `rental_contract_artifacts` (если используются) обязателен `Accept-Profile: private`.
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (orders = leads in checkout stage)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (checkout-funnel + revenue)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog (bike_id resolution)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (rental created from successful checkout)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew (operator follow-up on abandoned carts)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (rider's order history)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews (after completed order)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft (sale_contract_artifacts from sale orders)
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (manage orders)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/orders.ts` — `getOrders()`, `getOrder()`
- `app/franchize/server-actions/intents.ts` — `upsertFranchizeIntent()`
- `app/franchize/server-actions/catalog.ts`
- `app/franchize/server-actions/buy-print.ts` — sale contract flow
- `app/franchize/[slug]/cart/page.tsx`
- `app/franchize/[slug]/order/page.tsx`
- `app/franchize/[slug]/order/[id]/page.tsx`
- `app/franchize/[slug]/market/[bike_id]/buy/page.tsx`

**Schema migrations:**

- `20260508120000_create_franchize_intents.sql` — `franchize_intents`
- `rentals` table — original schema
- `cars` table — original schema

**UI references:**

- `app/franchize/[slug]/cart/page.tsx` — cart page
- `app/franchize/[slug]/order/page.tsx` — orders list
- `app/franchize/[slug]/order/[id]/page.tsx` — order detail
- `app/franchize/[slug]/market/[bike_id]/buy/page.tsx` — buy page

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
