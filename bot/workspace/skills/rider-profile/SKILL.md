---
name: rider-profile
description: >
  Профиль клиента/райдера VIP BIKE текстом в чат: идентичность (user_id, username, ФИО),
  контакты (телефон, email), история аренд и покупок, intent-история, задачи где клиент —
  lead, verification status (verified/pending/revoked), troubled-флаг. Только чтение.
  Триггеры: профиль клиента, профиль райдера, кто этот клиент, детали клиента, контакт
  клиента, телефон клиента, найди клиента, история аренд клиента, верификация клиента,
  проверен ли клиент, плохой клиент, troubled user, что известно о клиенте, username клиента,
  rider profile.
---

# rider-profile (бот VIP BIKE, операторский навык)

Триггер-фразы: **профиль клиента**, **профиль райдера**, **кто этот клиент**, **детали клиента**, **контакт клиента**, **телефон клиента**, **найди клиента**, **история аренд клиента**, **верификация клиента**, **проверен ли клиент**, **плохой клиент**, **что известно о клиенте**, **username клиента**, `troubled user`.

Результат — текстом в чат оператору. Навык **read-only**: только показывает, ничего не меняет.

## Supabase Access

Переменные приходят из `.env` сервиса (`EnvironmentFile=/opt/claudeclaw/vip-bike/.env`):

```bash
# Фолбэк для ручного запуска:
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && { set -a; . /opt/claudeclaw/vip-bike/.env; set +a; }

SUPABASE_URL="${SUPABASE_URL:?no SUPABASE_URL in env}"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
CREW_SLUG="${CREW_SLUG:-vip-bike}"
CREW_ID="${CREW_ID:-2d5fde70-1dd3-4f0d-8d72-66ccf6908746}"

HDR_PUBLIC=(-H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" -H "Accept: application/json" -H "Accept-Profile: private")
```

Service-role ключ даёт полный read ко всем таблицам, включая private-схему с ПДн. **Никогда** в URL, git, stdout.

## Команды

### 1. `find-rider <query>` — поиск по телефону / username / user_id

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

Вывод:
```
=== Поиск: "+79861720402" — 1 совпадение ===
User ID:          78901234
Username:         @egor_logunov
ФИО:              Логунов Егор
Телефон:          +79861720402
Язык:             ru
Создан:           13.07.2026
```

### 2. `rider-detail <userId>` — полная карточка

```bash
USER_ID="78901234"

# 1. Профиль юзера
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,username,full_name,avatar_url,website,status,role,metadata,language_code,\
created_at,updated_at,active_organizer_id,badges,test_progress,description\
&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'

# 2. Аренды райдера (FK disambiguation см. в rental-stats)
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

# 5. Покупки (private schema, по buyer phone из metadata)
BUYER_PHONE=$(curl -sS "${SUPABASE_URL}/rest/v1/users?select=metadata&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.phone // empty')
[ -n "$BUYER_PHONE" ] && \
curl -sS "${SUPABASE_URL}/rest/v1/sale_contract_artifacts?\
select=id,contract_key,buyer_full_name,sale_price,resolved_bike_id,created_at\
&buyer_phone=eq.${BUYER_PHONE}&crew_slug=eq.${CREW_SLUG}\
&order=created_at.desc" \
  "${HDR_PRIVATE[@]}"

# 6. Задачи, где райдер — lead
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,status,due_date,category,priority\
&crew_id=eq.${CREW_ID}&or=(user_id.eq.${USER_ID},lead_id.eq.${USER_ID})\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

Вывод:
```
=== Райдер: Логунов Егор (78901234) ===
User ID:          78901234
Username:         @egor_logunov
ФИО:              Логунов Егор
Телефон:          +7XXXXXXXX42 (маскировка)
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

— Покупки (0) —
  Нет покупок.

— Задачи (2) —
  #1  ⚠️ overdue   Позвонить по QR-claim         due: 22.07
  #2              Отправить contract-draft        due: 25.07
```

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

Вывод:
```
=== Verification для райдера 78901234 (latest: pending) ===
Secret ID:           b2c3d4e5-...
Verification:        pending
Renter full name:    Логунов Егор Иванович
Renter phone:        +7XXXXXXXX42 (маскировка)
Renter passport:     XXXX… (маскировка)
Renter driver lic.:  XXXX… (маскировка)
Renter registration: г. Мо… (маскировка)
Source rental:       4a3b2c1d-...
QR claimed at:       — (не принят)
Created at:          21.07 14:36 (UTC)

Рекомендация: запросить у райдера принятия QR-claim для завершения verification.
```

### 5. `rider-troubled <userId>` — проверка troubled-флага

```bash
USER_ID="78901234"
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,full_name,metadata\
&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0].metadata.troubled // false'
```

**Логика:** `metadata.troubled` — boolean, что клиент "проблемный" (конфликт, не вернул залог, и т.д.). Устанавливается вручную через UI/другим навыком. Этот навык только читает.

Вывод:
```
=== Troubled status для райдера 78901234 ===
ФИО:           Логунов Егор
Troubled:      ✗ (нет)

History: нет записей о проблемах.
```

## Доступ к схеме

### Public schema

- `users` — `user_id` (text PK), `username`, `full_name`, `avatar_url`, `website`, `status` (`free` / `pro` / `admin`), `role`, `created_at`, `updated_at`, `active_organizer_id`, `metadata` (jsonb: `phone`, `troubled` и т.д.), `description`, `badges` (jsonb), `test_progress` (jsonb), `language_code`, `subscription_id`, `has_script_access`, `project_type_guess`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `payment_status`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `created_at`, `crew_id`.
- `cars` — `id`, `make`, `model`, `type`, `daily_price` (для display).
- `franchize_intents` — `id`, `slug`, `bike_id`, `intent_type`, `stage`, `urgency_score`, `metadata`, `telegram_user_id`, `phone`, `last_seen_at`, `created_at`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `status`, `due_date`, `category`, `priority`, `user_id`, `lead_id`, `phone`.

### Private schema (обязателен `Accept-Profile: private`)

- `user_rental_secrets` — ПДн. `chat_id`, `crew_slug`, `renter_full_name`, `renter_phone`, `renter_passport`, `renter_registration`, `renter_driver_license`, `renter_birth_date`, `renter_email`, `renter_address`, `verification_status`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`, `source_rental_id`, `created_at`.
- `sale_contract_artifacts` — ПДн. `buyer_full_name`, `buyer_phone`, `buyer_email`, `buyer_passport_number`, `buyer_registration`, `sale_price`, `total_sum`, `resolved_bike_id`, `telegram_chat_id`, `created_at`.
- `rental_contract_artifacts` — ПДн. `renter_full_name`, `renter_phone`, `renter_passport`, `renter_registration`, `renter_driver_license`, `rental_id`, `created_at`.

## Anti-hallucination

- ~~`--json`~~ — только текст.
- ~~`--includePii`~~ — PII (паспорт/права/адрес) ВСЕГДА маскируется.
- ~~`--withPhotos`~~ — навык не показывает фото аватара/паспорта.
- ~~`--set-troubled`~~ — не существует. Навык read-only.
- ~~`--set-verification <status>`~~ — не существует. Навык read-only.
- ~~`--merge <userId1> <userId2>`~~ — не существует. Слияние аккаунтов — через admin UI.
- ~~`--outFile <path>`~~ — используй redirect `> file.txt`.
- ~~`--format csv|md`~~ — только текст.
- ~~`--crew <slug>`~~ — захардкожен `CREW_SLUG` из `.env` (= vip-bike).
- ~~`find-rider --byEmail <email>`~~ — email живёт в `user_rental_secrets.renter_email` (private). Поиск по email — через private-запрос.

## Обработка ошибок

| Stage                | Reason                                | Когда                                                | Exit | Действие                                       |
|----------------------|---------------------------------------|------------------------------------------------------|------|------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found` | `.env` недоступен или var не задан                   | 2    | Проверить `.env` / env                          |
| `rider_not_found`    | `Rider not found: <userId>`           | Нет пользователя с `user_id`                         | 2    | Сначала `find-rider` для валидных IDs           |
| `rider_no_phone`     | `No phone in metadata`                | `find-rider` по телефону — у юзера нет `metadata.phone` | 0  | Вывод: `Нет райдера с таким телефоном.`         |
| `private_404`        | `404 for private.<table>`             | Не передан `Accept-Profile: private`                 | 2    | Добавить header                                  |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                 | 2    | Сверить со схемой выше                          |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`        | Supabase лежит                                       | 2    | Повторить через минуту                          |
| `no_verification`    | `No user_rental_secret found`         | Райдер никогда не проходил verification              | 0    | Вывод: `Verification: — (нет записей)`          |
| `no_rentals`         | `[]`                                   | У райдера нет аренд                                 | 0    | Вывод: `Аренды: нет.`                           |
| `no_intents`         | `[]`                                   | У райдера нет intents                               | 0    | Вывод: `Intent history: нет.`                   |

## Безопасность

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII-маскировка** (обязательно в stdout, т.к. вывод уходит в Telegram):
  - Телефон → `+7XXXXXXXX42` (первые 4 символа + `…`).
  - Паспорт → `XXXX…` (первые 4 символа серии + `…`).
  - Водительское удостоверение → `XXXX…`.
  - Регистрация (адрес) → `г. Мо…` (первые 4 символа + `…`).
  - Email → `l…@example.com` (первая буква + `…`).
  - ФИО → фамилия с инициалами в публичных каналах; полное ФИО только в приватном operator chat.
  - Дата рождения → только год (`1990`).
- **Private schema headers**: для `user_rental_secrets`, `sale_contract_artifacts`, `rental_contract_artifacts` обязателен `Accept-Profile: private`. Без него PostgREST вернёт 404.
- **Troubled flag** (`metadata.troubled`) — чувствительная информация. Выводить только в приватном operator chat (этот бот и есть приватный operator chat — `ALLOWED_CHAT_ID` фильтрует).
- Навык полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Связанные навыки бота

- `leads-crm` — лиды (райдер может быть лидом).
- `rental-stats` — общая аналитика аренд (аренды этого райдера видны в дашборде).
- `deposit-tracker` — залоги по арендам этого райдера.
- `contract-agent` — оформление аренды (подтягивает данные райдера из verification).
