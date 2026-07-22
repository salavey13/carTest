---
name: rental-card-text
description: >
  Text-based rental card detail for VIP Bike. Shows one rental: status, dates, renter,
  bike, payment, documents, QR-claim state, contract artifact, todos. Queries Supabase
  REST API (curl), outputs formatted text.
  Trigger phrases (RU): "карточка аренды", "детали аренды", "покажи аренду", "аренда по id",
  "статус аренды", "документы аренды", "QR-claim аренды", "контракт аренды", "кто арендовал",
  "вернуть байк".
  Trigger phrases (EN): "rental card", "rental detail", "show rental", "rental status",
  "rental documents", "rental QR", "rental contract", "who rented", "return bike".
---

# Rental Card (text) — VIP Bike

Триггер-фразы (RU): **`карточка аренды`**, **`детали аренды`**, **`покажи аренду`**, **`аренда по id`**, **`статус аренды`**, **`документы аренды`**, **`QR-claim аренды`**, **`контракт аренды`**, **`кто арендовал`**, **`вернуть байк`**.
Триггер-фразы (EN): `rental card`, `rental detail`, `show rental`, `rental status`, `rental documents`, `rental QR`, `rental contract`, `who rented`, `return bike`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/rental/[id]`. Показывает полную карточку одной аренды: статус, даты, рентера, байк, оплату, документы (паспорт/регистрация/права — есть/нет), QR-claim state, связанный contract artifact, задачи (lead_followup + rental_verification). Skill read-only.

## When to Use

Use this skill when:

- Нужно быстро посмотреть детали конкретной аренды без открытия браузера.
- Нужно проверить, прислал ли рентер документы (паспорт/права/регистрация).
- Нужно проверить, принят ли QR-claim (`user_rental_secrets.qr_claimed_at`).
- Нужно понять, на каком этапе аренда (pending_confirmation / confirmed / active / completed / cancelled / disputed).
- Нужно увидеть связанный contract artifact (rental_contract_artifacts) — даты, депозит, total_sum.
- Нужно посмотреть задачи по этой аренде (rental_verification category).

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

### 1. `rental-detail <rentalId>` — полная карточка аренды

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# 1. Сама аренда + bike + renter
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,owner_id,status,payment_status,interest_amount,total_cost,\
requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,delivery_address,\
created_at,updated_at,metadata,passport_mainpage_photo,passport_registration_photo,drivers_licence_frontal_photo,\
crew_id,created_by_operator_chat_id,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,daily_price,specs,type,crew_id),\
renter:users!rentals_user_id_fkey(user_id,full_name,username,metadata)\
&rental_id=eq.${RENTAL_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'

# 2. Contract artifact (private schema)
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=id,contract_key,requested_bike_id,resolved_bike_id,telegram_chat_id,renter_full_name,\
renter_phone,rent_start_date,rent_end_date,daily_price,deposit_rub,total_sum,original_sha256,\
sts_pledge_used,sts_vehicle_plate,sts_vehicle_vin,storage_path,created_at\
&rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"

# 3. QR-claim state (private schema, latest user_rental_secret)
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=id,chat_id,verification_status,renter_full_name,renter_phone,qr_generated_at,\
qr_first_viewed_at,qr_claimed_at,qr_regeneration_count,source_rental_id,created_at\
&source_rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"

# 4. Задачи, привязанные к аренде
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,due_date,priority,category,assigned_to,completed_at\
&crew_id=eq.${CREW_ID}&rental_id=eq.${RENTAL_ID}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Аренда a1b2c3d4-e5f6-7890-abcd-ef1234567890 ===
Статус:           confirmed
Payment:          interest_paid (interest 2 000 ₽, total 14 000 ₽)
Crew:             vip-bike (2d5fde70-1dd3-4f0d-8d72-66ccf6908746)

— Байк —
ID:               bmw-f800r-001
Марка/модель:     BMW F800R
Тип:              bike
Базовая цена/день: 7 000 ₽

— Рентер —
User ID:          78901234
ФИО:              Иванов Иван
Username:         @ivan_ivanov
Телефон:          +7XXXXXXXX42 (masked)
Source:           market_bmw_f800r

— Даты —
Запрошено:        25.07 10:00 — 27.07 20:00 (2 дня)
Согласовано:      25.07 10:00 — 27.07 20:00
Создано:          21.07 14:32 (UTC)

— Документы —
Паспорт главная:   ✓ (✗ test_result)
Паспорт регистр.:  ✗ (нет)
Водит. права:      ✓ (✗ test_result)

— Contract artifact —
contract_key:      ra_vip-bike_2026-07-21_a1b2c3d4
rental_id:         a1b2c3d4-e5f6-7890-abcd-ef1234567890
даты:              25.07 — 27.07
daily_price:       7 000 ₽
deposit_rub:       30 000 ₽
total_sum:         14 000 ₽
sts_pledge_used:   нет
sha256:            abc123…
storage_path:      contracts/2026/07/ra_vip-bike_…_a1b2c3d4.docx
создан:            21.07 14:35 (UTC)

— QR-claim —
Sent at:           2026-07-21T14:36:00Z
First viewed:      2026-07-21T15:02:00Z
Claimed at:        — (не принят)
Regenerations:     1
Verification:      pending

— Задачи (2) —
  #1  ⚠️ overdue   Проверить паспорт Иванов Иван        assigned: salavey13   due: 22.07
  #2              Отправить contract-draft               assigned: Roman_Vip  due: 25.07
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 2. `rental-documents <rentalId>` — статус документов

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,passport_mainpage_photo,passport_registration_photo,drivers_licence_frontal_photo\
&rental_id=eq.${RENTAL_ID}" \
  "${HDR_PUBLIC[@]}"
```

**Логика:** Каждое поле — это URL на Storage. `null` = документ не загружен. Non-null = URL (доступ только через signed URL или service role).

**Пример вывода:**

```
=== Документы аренды a1b2c3d4-... ===
Паспорт (главная):     ✓ загружен
Паспорт (регистрация): ✗ отсутствует
Водительские права:    ✓ загружены

Рекомендация: запросить у рентера регистрацию паспорта.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 3. `rental-qr-status <rentalId>` — состояние QR-claim

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=id,chat_id,verification_status,qr_generated_at,qr_first_viewed_at,qr_claimed_at,\
qr_regeneration_count,source_rental_id\
&source_rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== QR-claim для аренды a1b2c3d4-... ===
Secret ID:            b2c3d4e5-...
Chat ID:              78901234 (renter's Telegram)
Verification:         pending
QR generated at:      2026-07-21T14:36:00Z
First viewed at:      2026-07-21T15:02:00Z
Claimed at:           — (не принят)
Regeneration count:   1

Статус: 🔴 unclaimed — рентер открыл QR, но не принял secrets.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 4. `rental-contract <rentalId>` — связанный contract artifact

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/rental_contract_artifacts?\
select=id,contract_key,renter_full_name,renter_phone,rent_start_date,rent_end_date,\
daily_price,deposit_rub,total_sum,sts_pledge_used,sts_vehicle_plate,sts_vehicle_vin,\
storage_path,created_at\
&rental_id=eq.${RENTAL_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Contract artifact(s) для аренды a1b2c3d4-... (1) ===
contract_key:      ra_vip-bike_2026-07-21_a1b2c3d4
renter_full_name:  Иванов Иван Иванович
renter_phone:      +7XXXXXXXX42
даты:              25.07 10:00 — 27.07 20:00
daily_price:       7 000 ₽
deposit_rub:       30 000 ₽
total_sum:         14 000 ₽
sts_pledge_used:   нет
storage_path:      contracts/2026/07/ra_vip-bike_…_a1b2c3d4.docx
создан:            21.07 14:35 (UTC)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 5. `rental-todos <rentalId>` — задачи на эту аренду

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,due_date,priority,category,assigned_to,completed_at,\
assignee:users!crew_todos_assigned_to_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}&rental_id=eq.${RENTAL_ID}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Задачи по аренде a1b2c3d4-... (2) ===
#1  ⚠️ overdue   [rental_verification]  Проверить паспорт Иванов Иван       assigned: salavey13   due: 22.07
#2              [lead_followup]         Отправить contract-draft              assigned: Roman_Vip  due: 25.07
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## Schema Access

### Public schema

- `rentals` — `rental_id` (uuid PK), `user_id`, `vehicle_id`, `owner_id`, `status` (`pending_confirmation` / `confirmed` / `active` / `completed` / `cancelled` / `disputed`), `payment_status` (`pending` / `interest_paid` / `fully_paid` / `refunded` / `failed`), `interest_amount`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `delivery_address`, `created_at`, `updated_at`, `metadata`, `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo`, `crew_id`, `created_by_operator_chat_id`.
- `cars` — `id`, `make`, `model`, `daily_price`, `specs` (jsonb), `type`, `crew_id`.
- `users` — `user_id`, `username`, `full_name`, `metadata` (phone в `metadata->>phone`).
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `status`, `priority`, `due_date`, `category`, `rental_id`, `lead_id`, `phone`, `user_id`, `completed_at`, `created_by`.

### Private schema (requires `Accept-Profile: private`)

- `rental_contract_artifacts` — PII. `id`, `contract_key`, `requested_bike_id`, `resolved_bike_id`, `telegram_chat_id`, `renter_full_name`, `renter_passport`, `renter_phone`, `rent_start_date`, `rent_end_date`, `daily_price`, `deposit_rub`, `total_sum`, `original_sha256`, `sts_pledge_used`, `sts_series`, `sts_number`, `sts_vehicle_plate`, `sts_vehicle_vin`, `sts_vehicle_model`, `sts_owner_full_name`, `rental_id`, `storage_path`, `crew_slug`, `created_by_operator_chat_id`, `created_at`.
- `user_rental_secrets` — PII. `id`, `chat_id`, `crew_slug`, `doc_sha256`, `renter_full_name`, `renter_passport`, `renter_registration`, `renter_driver_license`, `renter_phone`, `renter_email`, `renter_address`, `verification_status`, `qr_generated_at`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`, `source_rental_id`, `source_doc_key`, `is_web_app_flow`.

## Web Links

| Command            | Web page                                                                                                         |
|--------------------|------------------------------------------------------------------------------------------------------------------|
| `rental-detail`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/<rentalId>                          |
| `rental-documents` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/<rentalId>                          |
| `rental-qr-status` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/<rentalId>                          |
| `rental-contract`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/<rentalId>                          |
| `rental-todos`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/rental/<rentalId>                          |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--includePii`~~ — не существует. Паспорт/права/адрес всегда маскируются.
- ~~`--withPhotos`~~ — не существует. Skill не загружает бинарные фото; показывает только факт наличия URL.
- ~~`rental-detail --downloadContract`~~ — не существует. Для скачивания используйте `curl` напрямую с `storage_path` + Supabase Storage API.
- ~~`--set-status <status>`~~ — не существует. Skill read-only. Статус меняется через `crew-admin-text` или UI.
- ~~`--regenerate-qr`~~ — не существует. Регенерация QR — через `app/franchize/server-actions/rental-secrets-claim.ts`.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`rental-documents --downloadAll`~~ — не существует. Только статус (есть/нет).
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.

## Error Handling

| Stage               | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|---------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`      | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `rental_not_found`  | `Rental not found: <rentalId>`        | Нет аренды с таким `rental_id`                                        | 2    | Проверить ID через `analytics-text rentals-dashboard` |
| `rental_wrong_crew` | `Rental belongs to another crew`      | `crew_id` аренды не совпадает с `vip-bike`                            | 2    | Проверить `crew_id` в URL                        |
| `private_404`       | `404 for private.<table>`             | Не передан `Accept-Profile: private` header                           | 2    | Добавить header                                  |
| `supabase_4xx`      | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`      | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `no_contract`       | `No contract artifact found`          | Аренда есть, но contract artifact не создан                           | 0    | Вывод: `Contract artifact: — (не сгенерирован)`  |
| `no_qr`             | `No user_rental_secret found`         | QR ещё не генерировался                                               | 0    | Вывод: `QR-claim: — (QR не отправлялся)`         |
| `invalid_uuid`      | `Invalid UUID: <rentalId>`            | `rentalId` не парсится как UUID                                       | 2    | Использовать полный UUID                         |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking** в stdout:
  - Телефон → `+7XXXXXXXX42` (первые 4 символа + `…`).
  - Паспорт → `XXXX…` (первые 4 символа серии + `…`).
  - Водительское удостоверение → `XXXX…`.
  - Регистрация (адрес) → `г. Мо…` (первые 4 символа + `…`).
  - ФИО → фамилия с инициалами.
  - STS (VIN, plate) — показывать полностью только в приватных каналах (operator chat), не в публичных.
- **Private schema headers**: для `rental_contract_artifacts`, `user_rental_secrets` обязателен `Accept-Profile: private`. Без него PostgREST вернёт 404.
- **Photo URLs**: `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo` — это Storage paths. Не выводить URL в stdout (могут быть подписаны и reused). Только факт наличия (`✓ загружен` / `✗ отсутствует`).
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (rentals surface there too)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — rentals-dashboard lists rentals for date
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog (vehicle_id resolution)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew (owner_id resolution)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (renter info)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews on this rental
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft page (uses rental_contract_artifacts)
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — order that led to this rental
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (change rental status)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/rentals.ts` — `getRental()`, `getRentals()`
- `app/franchize/server-actions/rentals-dashboard.ts`
- `app/franchize/server-actions/rental-activation.ts` — status changes
- `app/franchize/server-actions/rental-verification-todos.ts`
- `app/franchize/server-actions/rental-secrets-claim.ts` — QR claim
- `app/franchize/server-actions/rental-handoffs.ts` — handoff flow
- `app/franchize/server-actions/approve-contract.ts`
- `app/franchize/server-actions/decline-contract.ts`
- `app/franchize/server-actions/submit-contract-draft.ts`

**Schema migrations:**

- `rentals` table — original schema
- `20260304_private_scheme.sql` — private schema
- `20260601000000_user_rental_secrets.sql`
- `20260612000000_fix_rental_contract_artifacts.sql`
- `20260720120100_add_operator_chat_id.sql` — `created_by_operator_chat_id` on rentals + artifacts

**UI references:**

- `app/franchize/[slug]/rental/[id]/page.tsx` — rental card page

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
