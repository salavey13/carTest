---
name: rider-profile-text
description: >
  Text-based rider/user profile for VIP Bike. Shows one rider: identity, contacts,
  rentals history, sales, intent history, todos, verification status. Queries Supabase
  REST API (curl), outputs formatted text.
  Trigger phrases (RU): "профиль райдера", "профиль клиента", "профиль пользователя",
  "детали клиента", "история аренд клиента", "контакт клиента", "верификация клиента",
  "телефон клиента", "username клиента", "плохой клиент", "troubled user".
  Trigger phrases (EN): "rider profile", "user profile", "customer profile",
  "rider detail", "rider rentals", "rider contact", "rider verification",
  "rider phone", "rider username", "troubled rider".
---

# Rider Profile (text) — VIP Bike

Триггер-фразы (RU): **`профиль райдера`**, **`профиль клиента`**, **`профиль пользователя`**, **`детали клиента`**, **`история аренд клиента`**, **`контакт клиента`**, **`верификация клиента`**, **`телефон клиента`**, **`username клиента`**, **`плохой клиент`**, `troubled user`.
Триггер-фразы (EN): `rider profile`, `user profile`, `customer profile`, `rider detail`, `rider rentals`, `rider contact`, `rider verification`, `rider phone`, `rider username`, `troubled rider`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/profile`. Показывает профиль одного райдера: identity (user_id, username, ФИО), контакты (телефон, email), историю аренд и покупок, intent-историю, задачи (где райдер — lead), verification status (verified/pending/revoked), troubled-флаг (если есть). Skill read-only.

## When to Use

Use this skill when:

- Нужно быстро посмотреть профиль клиента перед звонком.
- Нужно проверить, есть ли у клиента активные аренды / покупки.
- Нужно проверить verification status (`user_rental_secrets.verification_status`).
- Нужно понять, является ли клиент "troubled" (`users.metadata.troubled`).
- Нужно вывести историю обращений (franchize_intents) по клиенту.
- Нужно найти клиента по телефону / username / user_id.

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

### 1. `find-rider <query>` — поиск райдера по телефону / username / user_id

```bash
QUERY="+79861720402"

# По user_id (если это Telegram ID)
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,avatar_url,metadata,language_code,created_at\
&user_id=eq.${QUERY}" \
  "${HDR_PUBLIC[@]}"

# По username (case-insensitive)
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,metadata,language_code\
&username=ilike.${QUERY}" \
  "${HDR_PUBLIC[@]}"

# По телефону в metadata->>phone (PostgREST jsonb arrow operator)
PHONE_NORMALIZED="+79861720402"
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,metadata,language_code\
&metadata->>phone=eq.${PHONE_NORMALIZED}" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Поиск: "+79861720402" — 1 совпадение ===
User ID:          78901234
Username:         @egor_logunov
Full name:        Логунов Егор
Телефон:          +79861720402
Язык:             ru
Создан:           13.07.2026
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile`

---

### 2. `rider-detail <userId>` — полная карточка райдера

```bash
USER_ID="78901234"

# 1. User profile
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,avatar_url,website,status,role,metadata,language_code,\
created_at,updated_at,active_organizer_id,badges,test_progress,description\
&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'

# 2. Rentals этого райдера (по user_id)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,vehicle_id,status,payment_status,total_cost,requested_start_date,requested_end_date,\
created_at,vehicle:cars!rentals_vehicle_id_fkey(id,make,model,type)\
&user_id=eq.${USER_ID}\
&order=created_at.desc&limit=20" \
  "${HDR_PUBLIC[@]}"

# 3. Intent history (franchize_intents)
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,intent_type,stage,urgency_score,created_at,last_seen_at,bike_id,metadata\
&telegram_user_id=eq.${USER_ID}\
&order=created_at.desc&limit=20" \
  "${HDR_PUBLIC[@]}"

# 4. Verification status (latest user_rental_secret, private schema)
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=id,verification_status,renter_full_name,renter_phone,source_rental_id,created_at\
&chat_id=eq.${USER_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=5" \
  "${HDR_PRIVATE[@]}"

# 5. Sales (private schema, by buyer phone if known from metadata)
BUYER_PHONE=$(curl -sS "${SUPABASE_URL}/rest/v1/users?select=metadata&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.phone // empty')
[ -n "$BUYER_PHONE" ] && \
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=id,contract_key,buyer_full_name,sale_price,resolved_bike_id,created_at\
&buyer_phone=eq.${BUYER_PHONE}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc" \
  "${HDR_PRIVATE[@]}"

# 6. Todos related to this rider
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,status,due_date,category,priority\
&crew_id=eq.${CREW_ID}&or=(user_id.eq.${USER_ID},lead_id.eq.${USER_ID})\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Райдер: Логунов Егор (78901234) ===
User ID:          78901234
Username:         @egor_logunov
Full name:        Логунов Егор
Телефон:          +7XXXXXXXX42 (masked)
Email:            —
Язык:             ru
Создан:           13.07.2026
Status:           free
Troubled:         ✗ (нет)

— Аренды (2) —
  rental_id:   4a3b2c1d-...   статус: confirmed   байк: BMW F800R          даты: 25.07-27.07   сумма: 14 000 ₽
  rental_id:   b2c3d4e5-...   статус: completed    байк: Sur-Ron Light Bee  даты: 10.07-12.07   сумма: 10 000 ₽

— Intent history (3) —
  #1  intent: hold_created     stage: hold_created       urgency: 90   at: 21.07 14:30
  #2  intent: checkout_start   stage: checkout_started   urgency: 70   at: 21.07 14:00
  #3  intent: map_click        stage: clicked            urgency: 30   at: 13.07 10:15

— Verification (latest) —
  verification_status: pending
  renter_full_name:    Логунов Егор Иванович
  renter_phone:        +7XXXXXXXX42
  source_rental_id:    4a3b2c1d-...
  created_at:          21.07 14:36

— Sales (0) —
  Нет покупок.

— Задачи (2) —
  #1  ⚠️ overdue   Позвонить по QR-claim         due: 22.07
  #2              Отправить contract-draft        due: 25.07
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile`

---

### 3. `rider-rentals <userId>` — история аренд

```bash
USER_ID="78901234"
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,vehicle_id,status,payment_status,total_cost,\
requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,created_at,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,type,daily_price)\
&user_id=eq.${USER_ID}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Аренды райдера 78901234 (2) ===
rental_id:   4a3b2c1d-...
  байк:      BMW F800R (bmw-f800r-001)
  статус:    confirmed
  payment:   interest_paid (2 000 ₽ / 14 000 ₽)
  даты:      25.07 10:00 — 27.07 20:00 (2 дня)
  создана:   21.07 14:32

rental_id:   b2c3d4e5-...
  байк:      Sur-Ron Light Bee X (sur-ron-light-bee-x)
  статус:    completed
  payment:   fully_paid (10 000 ₽)
  даты:      10.07 — 12.07 (2 дня)
  создана:   08.07 09:15
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile`

---

### 4. `rider-verification <userId>` — verification status

```bash
USER_ID="78901234"
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=id,verification_status,renter_full_name,renter_phone,renter_passport,renter_driver_license,\
renter_registration,source_rental_id,qr_claimed_at,created_at\
&chat_id=eq.${USER_ID}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc&limit=5" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Verification для райдера 78901234 (latest: pending) ===
Secret ID:           b2c3d4e5-...
Verification:        pending
Renter full name:    Логунов Егор Иванович
Renter phone:        +7XXXXXXXX42 (masked)
Renter passport:     XXXX… (masked)
Renter driver lic.:  XXXX… (masked)
Renter registration: г. Мо… (masked)
Source rental:       4a3b2c1d-...
QR claimed at:       — (не принят)
Created at:          21.07 14:36 (UTC)

Рекомендация: запросить у райдера принятия QR-claim для завершения verification.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile`

---

### 5. `rider-troubled <userId>` — проверка troubled-флага

```bash
USER_ID="78901234"
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,full_name,metadata\
&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0].metadata.troubled // false'
```

**Логика:** `metadata.troubled` — это boolean флаг, что клиент "проблемный" (был конфликт, не вернул залог, и т.д.). Устанавливается вручную оператором через UI.

**Пример вывода:**

```
=== Troubled status для райдера 78901234 ===
ФИО:           Логунов Егор
Troubled:      ✗ (нет)

History: нет записей о проблемах.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile`

---

## Schema Access

### Public schema

- `users` — `user_id` (text PK), `username`, `full_name`, `avatar_url`, `website`, `status` (`free` / `pro` / `admin`), `role` (`attendee` и т.д.), `created_at`, `updated_at`, `active_organizer_id`, `metadata` (jsonb — `phone`, `troubled`, и т.д.), `description`, `badges` (jsonb), `test_progress` (jsonb), `language_code`, `subscription_id`, `has_script_access`, `project_type_guess`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `payment_status`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `created_at`, `crew_id`.
- `cars` — `id`, `make`, `model`, `type`, `daily_price` (для display).
- `franchize_intents` — `id`, `slug`, `bike_id`, `intent_type`, `stage`, `urgency_score`, `metadata`, `telegram_user_id`, `phone`, `last_seen_at`, `created_at`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `status`, `due_date`, `category`, `priority`, `user_id`, `lead_id`, `phone`.

### Private schema (requires `Accept-Profile: private`)

- `user_rental_secrets` — PII. `chat_id`, `crew_slug`, `renter_full_name`, `renter_phone`, `renter_passport`, `renter_registration`, `renter_driver_license`, `renter_birth_date`, `renter_email`, `renter_address`, `verification_status`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`, `source_rental_id`, `created_at`.
- `sale_contract_artifacts` — PII. `buyer_full_name`, `buyer_phone`, `buyer_email`, `buyer_passport_number`, `buyer_registration`, `sale_price`, `total_sum`, `resolved_bike_id`, `telegram_chat_id`, `created_at`.
- `rental_contract_artifacts` — PII. `renter_full_name`, `renter_phone`, `renter_passport`, `renter_registration`, `renter_driver_license`, `rental_id`, `created_at`.

## Web Links

| Command              | Web page                                                                              |
|----------------------|---------------------------------------------------------------------------------------|
| `find-rider`         | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile         |
| `rider-detail`       | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile         |
| `rider-rentals`      | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile         |
| `rider-verification` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile         |
| `rider-troubled`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/profile         |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--includePii`~~ — не существует. PII (паспорт/права/адрес) всегда маскируются.
- ~~`--withPhotos`~~ — не существует. Skill не показывает фото аватара/паспорта.
- ~~`--set-troubled`~~ — не существует. Skill read-only. Установка troubled — через UI.
- ~~`--set-verification <status>`~~ — не существует. Skill read-only.
- ~~`--merge <userId1> <userId2>`~~ — не существует. Слияние аккаунтов — через admin UI.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`find-rider --byEmail <email>`~~ — не существует. Email живёт в `user_rental_secrets.renter_email` (private schema). Поиск по email — через private schema query.

## Error Handling

| Stage                | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|----------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `rider_not_found`    | `Rider not found: <userId>`           | Нет пользователя с таким `user_id`                                    | 2    | Проверить `find-rider` для валидных IDs          |
| `rider_no_phone`     | `No phone in metadata`                | `find-rider` по телефону — у юзера нет `metadata.phone`               | 0    | Вывод: `Нет райдера с таким телефоном.`          |
| `private_404`        | `404 for private.<table>`             | Не передан `Accept-Profile: private` header                           | 2    | Добавить header                                  |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `no_verification`    | `No user_rental_secret found`         | Райдер никогда не проходил verification                               | 0    | Вывод: `Verification: — (нет записей)`           |
| `no_rentals`         | `[]`                                   | У райдера нет аренд                                                  | 0    | Вывод: `Аренды: нет.`                            |
| `no_intents`         | `[]`                                   | У райдера нет intents                                                | 0    | Вывод: `Intent history: нет.`                    |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking** (обязательно в stdout для всех PII полей):
  - Телефон → `+7XXXXXXXX42` (первые 4 символа + `…`).
  - Паспорт → `XXXX…` (первые 4 символа серии + `…`).
  - Водительское удостоверение → `XXXX…`.
  - Регистрация (адрес) → `г. Мо…` (первые 4 символа + `…`).
  - Email → `l…@example.com` (первая буква + `…`).
  - ФИО → фамилия с инициалами в публичных каналах; полное ФИО только в приватном operator chat.
  - Дата рождения → год только (`1990`).
- **Private schema headers**: для `user_rental_secrets`, `sale_contract_artifacts`, `rental_contract_artifacts` обязателен `Accept-Profile: private`. Без него PostgREST вернёт 404.
- **Troubled flag**: `metadata.troubled` — чувствительная информация. Не выводить в публичных каналах (только в приватном operator chat).
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (rider is a lead)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (rider rentals show in dashboard)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (renter info)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (operator vs rider)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews (rider leaves reviews)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft (rider signs)
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders (rider creates orders)
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (manage riders)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard (rider ranking)
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/[slug]/profile/ProfileClient.tsx`
- `app/franchize/[slug]/profile/page.tsx`
- `app/franchize/server-actions/rental-secrets-claim.ts`
- `app/franchize/lib/leads.ts` — `addOrMerge()` (identity matching)

**Schema migrations:**

- `users` table — original schema
- `20260601000000_user_rental_secrets.sql`
- `20260612000000_fix_rental_contract_artifacts.sql`
- `20260607000000_create_sale_contract_artifacts.sql`

**UI references:**

- `app/franchize/[slug]/profile/page.tsx` — rider profile page

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
