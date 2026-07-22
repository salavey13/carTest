---
name: leads-crm-text
description: >
  Text-based CRM leads dashboard for VIP Bike. Queries Supabase REST API directly
  (curl) and outputs formatted text — same data as `/franchize/vip-bike/leads` UI
  but as CLI/table output. Read + dismiss. No UI, no JSON blobs.
  Trigger phrases (RU): "покажи лиды", "статус лидов", "список лидов", "кто горячий",
  "закрой лид", "отклони лид", "воронка", "SLA лидов", "просроченные задачи",
  "KPI лидов", "аналитика лидов", "лиды по аренде", "лиды по продаже", "сервисные лиды".
  Trigger phrases (EN): "leads text", "text leads dashboard", "show leads",
  "lead status", "hot leads", "close lead", "dismiss lead", "leads pipeline",
  "leads funnel", "leads KPIs", "overdue lead todos".
---

# Leads CRM (text) — VIP Bike

Триггер-фразы (RU): **`покажи лиды`**, **`статус лидов`**, **`список лидов`**, **`кто горячий`**, **`закрой лид`**, **`отклони лид`**, **`воронка`**, **`SLA лидов`**, **`просроченные задачи`**, **`KPI лидов`**, **`аналитика лидов`**, **`лиды по аренде`**, **`лиды по продаже`**, **`сервисные лиды`**.
Триггер-фразы (EN): `leads text`, `text leads dashboard`, `show leads`, `lead status`, `hot leads`, `close lead`, `dismiss lead`, `leads pipeline`, `leads funnel`, `leads KPIs`, `overdue lead todos`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/leads`. Читает те же таблицы Supabase, что и server-action `getFranchizeLeads`, применяет логику слияния идентичностей (`addOrMerge`), выводит стадию pipeline через `computeLeadStage`, и сигналы SLA через `computeLeadSignals`. Результат — форматированная текстовая таблица вместо React UI.

Skill использует только `curl` к Supabase REST API (PostgREST) и стандартные shell-утилиты (`jq`, `awk`). Не запускает Node.js сервер, не требует сборки Next.js.

## When to Use

Use this skill when:

- Нужно быстро увидеть список лидов без открытия браузера / Telegram WebApp.
- Нужно отфильтровать горячих / просроченных / QR-не-принятых лидов из CLI (для утреннего standup).
- Нужно показать детали одного лида (контакты, аренды, задачи, документы, QR-claim).
- Нужно закрыть / отклонить лид с указанием причины (`dismiss-lead`).
- Нужно вывести KPI (конверсия, выручка, горячие) или воронку по стадиям.
- Нужно вывести список просроченных задач конкретного оператора.
- Нужно оценить service-режим (`intent_type='service'`).

## Supabase Access

Standard block — used by every command below.

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

# Operator IDs (vip-bike crew)
OP_OWNER=356282674        # I_O_S_NN
OP_CO_OWNER=244736261     # Roman_Vip_Bike_Electro
OP_ADMIN=413553377        # salavey13
OP_MEMBER=7813830016      # DJORUDJOV

# Common curl headers
HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private")
```

Service-role key bypasses RLS and gives read access to both `public` and `private` schemas. **Never** commit it; **never** pass it as URL param.

## Commands

### 1. `list-leads` — список лидов с фильтрами

```bash
# Все лиды экипажа vip-bike (stage != dismissed), newest first
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,slug,telegram_user_id,phone,intent_type,stage,urgency_score,metadata,\
last_seen_at,created_at,bike_id,source_route,contact_channel\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed\
&order=urgency_score.desc,updated_at.desc&limit=100" \
  "${HDR_PUBLIC[@]}"
```

**Hot filter** (urgency ≥ 80):

```bash
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,intent_type,stage,urgency_score,metadata\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed&urgency_score=gte.80\
&order=urgency_score.desc&limit=20" \
  "${HDR_PUBLIC[@]}"
```

**Stage filter** (e.g. `awaiting_qr_claim` requires joining with `rentals` — see `lead-detail` for stage derivation logic):

```bash
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,stage,urgency_score\
&slug=eq.${CREW_SLUG}&stage=eq.hold_created\
&order=updated_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Лиды VIP Bike (48 всего, 48 горячих) ===
Фильтр: стадия: QR не принят → показано 13

Имя                     Телефон           Стадия                SLA               Назначен                Байк                  Выручка
──────────────────────  ────────────────  ────────────────────  ────────────────  ──────────────────────  ────────────────────  ──────────
Логунов Егор            +79861720402      QR не принят          60 🔴             Джордан (member)        BMW F800R             4704k₽
Шевчук Эдуард           +74929993333      QR не принят          2д 3ч 🔴          Артур С. (admin)        Regulmoto Nibbler …   2970k₽
Молев Георгий           +79307020134      QR не принят          9д 4ч 🔴          Илья О. (owner)         BMW F800R             25k₽

=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR не принят: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

### 2. `lead-detail <leadId>` — полная карточка лида

`leadId` может быть: `user_id`, `telegram_chat_id`, или нормализованный телефон (`+7XXXXXXXXXX`).

```bash
# 1. Найти intent по телефону
PHONE_NORMALIZED="+79200000000"
INTENTS=$(curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,telegram_user_id,phone,intent_type,stage,urgency_score,metadata,last_seen_at,created_at,bike_id\
&slug=eq.${CREW_SLUG}&or=(telegram_user_id.eq.${PHONE_NORMALIZED},phone.eq.${PHONE_NORMALIZED})\
&order=updated_at.desc&limit=1" \
  "${HDR_PUBLIC[@]}")
echo "$INTENTS" | jq .

# 2. Аренды этого лида (по user_id)
USER_ID="<resolved_user_id>"
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,payment_status,total_cost,requested_start_date,requested_end_date,\
agreed_start_date,agreed_end_date,metadata,passport_mainpage_photo,passport_registration_photo,drivers_licence_frontal_photo\
&user_id=eq.${USER_ID}&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"

# 3. Задачи на лид (по lead_id = user_id или phone)
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,due_date,priority,category,assigned_to\
&crew_id=eq.${CREW_ID}&or=(lead_id.eq.${USER_ID},phone.eq.${PHONE_NORMALIZED})\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"

# 4. QR-claim state (private schema) — latest user_rental_secret
curl -sS "${SUPABASE_URL}/rest/v1/user_rental_secrets?\
select=source_rental_id,verification_status,renter_full_name,renter_phone,qr_first_viewed_at,qr_claimed_at,created_at\
&crew_slug=eq.${CREW_SLUG}&renter_phone=eq.${PHONE_NORMALIZED}\
&order=created_at.desc&limit=1" \
  "${HDR_PRIVATE[@]}"
```

**Пример вывода:**

```
=== Лид: +79861720402 (Логунов Егор) ===
Identity state:     claimed_user
Pipeline stage:     awaiting_qr_claim
QR status:          unclaimed (sent 9д 4ч ago)
SLA signals:        🔴 qr_age (9д 4ч), 🔴 first_contact (10д)
Next action:        Позвонить клиенту — QR-ссылка не принята уже 9 дней

— Контакты —
Телефон:   +79 861 720 402
Username:  @egor_logunov
Source:    market_bmw_f800r

— Аренды (1) —
  rental_id:   4a3b2c1d-...
  статус:      confirmed
  байк:        BMW F800R (vehicle_id=bmw-f800r-001)
  даты:        25.07 10:00 — 27.07 20:00
  сумма:       14 000 ₽
  документы:   паспорт ✓ / регистрация ✗ / права ✓

— Задачи (2) —
  #1  ⚠️ overdue  Позвонить по QR-claim         due: 22.07
  #2              Отправить contract-draft        due: 25.07

— QR-claim —
  Sent at:      2026-07-13T08:00:00Z
  Viewed:       —
  Claimed:      —
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

### 3. `dismiss-lead <leadId> --reason <reason> [--note <text>]` — отклонить лид

```bash
LEAD_ID="+79200000000"
REASON="test_lead"
NOTE="sandbox cleanup"
ACTOR="${OP_ADMIN}"   # кто отклонил (для аудита)
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"

# 1. Найти intent
INTENT_ID=$(curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,metadata\
&slug=eq.${CREW_SLUG}&or=(telegram_user_id.eq.${LEAD_ID},phone.eq.${LEAD_ID})\
&order=updated_at.desc&limit=1" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].id')

# 2. PATCH: stage=dismissed + metadata fields
curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/franchize_intents?id=eq.${INTENT_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --arg reason "$REASON" --arg note "$NOTE" --arg at "$NOW_ISO" --arg by "$ACTOR" \
    '{stage: "dismissed", last_seen_at: $at,
      metadata: {dismissReason: $reason, dismissNote: $note, dismissedAt: $at, dismissedBy: $by}}')"
```

**Валидные причины** (`DISMISS_REASONS`):

| value              | label                          | requiresNote |
|--------------------|--------------------------------|--------------|
| `not_interested`   | Не заинтересован               | нет          |
| `unreachable`      | Недозвон / не отвечает         | нет          |
| `wrong_contact`    | Неверный контакт               | нет          |
| `booked_elsewhere` | Арендовал в другом месте       | нет          |
| `documents_missing`| Не предоставил документы       | нет          |
| `timing_issue`     | Не подошли даты                | нет          |
| `operator_error`   | Ошибка оператора               | **да**       |
| `duplicate`        | Дубликат                       | нет          |
| `test_lead`        | Тестовый лид                   | нет          |
| `other`            | Другое                         | **да**       |

**Пример вывода:**

```
✓ Лид отклонён
  ID:           27e054e3-8db9-4394-b5e9-78d48d973ced
  Lead key:     +79200000000
  Reason:       test_lead (Тестовый лид)
  Note:         sandbox cleanup
  Dismissed at: 2026-07-21T23:45:51.604Z
  By:           413553377 (salavey13)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

### 4. `list-todos` — список задач лида

```bash
# Только просроченные задачи экипажа по лидам (lead_followup + rental_verification)
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,due_date,priority,category,assigned_to,lead_id,phone\
&crew_id=eq.${CREW_ID}&category=in.(lead_followup,rental_verification)\
&status=neq.done&due_date=not.is.null&due_date=lt.${NOW_ISO}\
&order=due_date.asc&limit=50" \
  "${HDR_PUBLIC[@]}"

# Задачи конкретного оператора
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,status,due_date,category,lead_id\
&crew_id=eq.${CREW_ID}&assigned_to=eq.${OP_ADMIN}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Просроченные задачи (3) ===
#1  ⚠️ overdue   Позвонить Андрею по аренде Falcon Lynx     assigned: salavey13   due: 22.07
#2  ⚠️ overdue   Проверить паспорт Закиров Артур             assigned: salavey13   due: 21.07
#3  ⚠️ overdue   Отправить КП для ООО Вектор                 assigned: Roman_Vip  due: 25.07
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

### 5. `kpis [--mode rent|sale|service]` — KPI-сводка

```bash
MODE="rent"   # rent | sale | service

# Лиды по mode (rent → intent_type IN rent,checkout_start,hold_created,…; sale → sale,prebuy,trade_in,finance; service → service)
INTENT_TYPES_RENT="checkout_start,hold_created,rent,test_ride,test_ride_click"
INTENT_TYPES_SALE="sale,prebuy,trade_in,finance"
INTENT_TYPES_SERVICE="service"

curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,urgency_score,stage,intent_type,created_at\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed\
&intent_type=in.(${INTENT_TYPES_RENT})" \
  "${HDR_PUBLIC[@]}"

# Revenue: sum rentals.total_cost where status IN active|completed за период
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=total_cost,status\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)" \
  "${HDR_PUBLIC[@]}" | jq '[.[] | .total_cost // 0] | add'
```

**Пример вывода:**

```
=== KPI лидов VIP Bike (mode: rent) ===
Всего лидов:        34
Горячих:            34
Конверсия (30д):    4% (1/27)
Выручка за период:  408k₽
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

### 6. `pipeline-funnel` — распределение по стадиям

```bash
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=stage,intent_type\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.stage) | map({stage: .[0].stage, count: length})'
```

**Пример вывода:**

```
=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR не принят: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0

Всего лидов: 48
Горячих:     48
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads`

---

## Schema Access

### Public schema (no `Accept-Profile` header needed)

- `franchize_intents` — канонический реестр лидов. Columns: `id`, `slug`, `bike_id`, `intent_type`, `stage`, `source_route`, `contact_channel`, `urgency_score`, `metadata` (jsonb), `telegram_user_id`, `phone`, `last_seen_at`, `created_at`, `updated_at`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `owner_id`, `status`, `payment_status`, `interest_amount`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `delivery_address`, `created_at`, `metadata`, `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo`, `crew_id`, `created_by_operator_chat_id`.
- `users` — `user_id`, `username`, `full_name`, `avatar_url`, `status`, `role`, `metadata` (phone lives in `metadata->>phone`), `badges`, `language_code`.
- `cars` — `id`, `make`, `model`, `description`, `daily_price`, `image_url`, `rent_link`, `is_test_result`, `specs` (jsonb), `owner_id`, `type`, `crew_id`, `availability_rules` (jsonb), `quantity`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `category`, `status`, `priority`, `due_date`, `created_at`, `created_by`, `updated_at`, `completed_at`, `lead_id`, `user_id`, `phone`, `rental_id`.
- `crews` — `id`, `name`, `description`, `logo_url`, `owner_id`, `slug`, `hq_location`, `metadata`.
- `crew_members` — `id`, `crew_id`, `user_id`, `role`, `joined_at`, `membership_status`, `last_location`, `live_status`.
- `lead_notes` — `id`, `lead_id`, `crew_id`, `text`, `created_by`, `created_at`, `updated_at`.

### Private schema (requires `Accept-Profile: private` header)

- `rental_contract_artifacts` — `id`, `contract_key`, `requested_bike_id`, `resolved_bike_id`, `telegram_chat_id`, `renter_full_name`, `renter_passport`, `renter_phone`, `rent_start_date`, `rent_end_date`, `daily_price`, `deposit_rub`, `total_sum`, `original_sha256`, `created_at`, `rental_id`, `crew_slug`, `created_by_operator_chat_id`. PII.
- `user_rental_secrets` — `id`, `chat_id`, `crew_slug`, `doc_sha256`, `renter_full_name`, `renter_passport`, `renter_registration`, `renter_driver_license`, `renter_phone`, `renter_email`, `verification_status`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`, `source_rental_id`. PII.
- `sale_contract_artifacts` — `id`, `contract_key`, `buyer_full_name`, `buyer_passport_number`, `buyer_email`, `sale_price`, `price_words`, `warranty_months`, `total_sum`, `resolved_bike_id`, `telegram_chat_id`, `buyer_phone`, `crew_slug`, `created_at`. PII.

## Web Links

| Command          | Web page                                                                          |
|------------------|-----------------------------------------------------------------------------------|
| `list-leads`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |
| `lead-detail`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |
| `dismiss-lead`   | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |
| `list-todos`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |
| `kpis`           | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |
| `pipeline-funnel`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leads       |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Skill всегда выводит текстовую таблицу (это и есть смысл skill'а).
- ~~`--outFile <path>`~~ — не существует. Вывод идёт в stdout; для записи в файл используйте `> leads.txt` shell-redirect.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike` (меняется в переменных `CREW_SLUG` / `CREW_ID`).
- ~~`--assignee <userId>`~~ — не существует для `list-leads`. Назначение делается через UI. Для фильтра задач по assignee используйте `list-todos` с `&assigned_to=eq.<userId>`.
- ~~`--createdAfter <date>`~~ / ~~`--createdBefore <date>`~~ — не существуют. Используйте `&created_at=gte.<ISO>` / `&created_at=lte.<ISO>` в curl.
- ~~`--format csv|md|html`~~ — не существует. Только текстовая таблица.
- ~~`--reassign <leadId> --to <userId>`~~ — не существует. Skill read-only для всего, кроме `dismiss-lead`.
- ~~`dismiss-lead --dry-run`~~ — не существует. Чтобы проверить валидацию без PATCH, передайте неверный reason — команда выведет список валидных причин и выйдет до DB-запроса.
- ~~`--mode all`~~ для `kpis` — не существует. Только `rent`, `sale`, `service`.
- ~~`--lead-id <id>`~~ — не существует как named flag. leadId — positional аргумент.

## Error Handling

| Stage                       | Reason                                          | Когда возникает                                                                | Exit | Что делать                                                                  |
|-----------------------------|-------------------------------------------------|--------------------------------------------------------------------------------|------|-----------------------------------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | Нет env-переменной, путь `/home/z/my-project/upload/secrets.txt` недоступен   | 2    | Передать `SUPABASE_SERVICE_ROLE_KEY=...` env или проверить путь             |
| `crew_lookup`               | `Экипаж не найден`                              | `CREW_SLUG` не существует в `crews` таблице                                    | 2    | Проверить `CREW_SLUG` (хардкод `vip-bike`)                                  |
| `supabase_query_4xx`        | `Supabase <schema>.<table> 4xx: <body>`         | Неверный select-список, RLS запретил, нет такой таблицы/колонки                 | 2    | Проверить схему (см. раздел "Schema Access")                                |
| `supabase_query_5xx`        | `Supabase <schema>.<table> 5xx: <body>`         | Supabase лежит, rate-limit, timeout                                            | 2    | Повторить через минуту                                                       |
| `lead_not_found`            | `Lead not found: <leadId>`                      | `lead-detail`/`dismiss-lead` — нет совпадения по user_id/phone/telegramChatId | 2    | Проверить `list-leads` — какой у лида реальный `user_id`                    |
| `dismiss_reason_missing`    | `--reason is required`                          | `dismiss-lead` без `--reason`                                                  | 2    | Передать `--reason <value>` (список валидных причин в таблице выше)         |
| `dismiss_reason_invalid`    | `invalid reason "<value>"`                       | `--reason bogus`                                                               | 2    | Использовать одно из значений `DISMISS_REASONS`                              |
| `dismiss_note_required`     | `reason "<value>" requires --note`               | `--reason operator_error` или `--reason other` без `--note`                    | 2    | Добавить `--note "<text>"`                                                  |
| `dismiss_constraint_23514`  | `CHECK constraint 'franchize_intents_stage_allowed' rejected 'dismissed'` | DB constraint не включает `'dismissed'` в список разрешённых стадий | 2    | Запустить миграцию (SQL ниже)                                                |
| `dismiss_patch_no_rows`     | `PATCH returned no rows`                        | Intent удалён между SELECT и PATCH, или RLS                                    | 2    | Проверить что intent ещё существует через REST                               |
| `mode_invalid`              | `invalid mode "<value>"`                         | `kpis --mode bogus`                                                            | 2    | Использовать `rent` / `sale` / `service`                                    |
| `unknown_command`           | `unknown command "<value>"`                     | Опечатка в подкоманде                                                          | 2    | Запустить `--help` для списка команд                                         |

### CHECK constraint fix для `dismiss-lead`

Production DB `franchize_intents_stage_allowed` (из миграции `20260508120000`) **не включает** значение `'dismissed'`. SQL для починки:

```sql
ALTER TABLE public.franchize_intents
  DROP CONSTRAINT IF EXISTS franchize_intents_stage_allowed;
ALTER TABLE public.franchize_intents
  ADD CONSTRAINT franchize_intents_stage_allowed CHECK (
    stage IN (
      'discovered','clicked','prebuy_started','checkout_started',
      'hold_created','payment_failed','payment_confirmed',
      'contacted','test_ride_requested','viewed','configured',
      'contract_generated','alternative_offered','offer_sent',
      'manual_reserved','closed','dismissed'
    )
  );
```

Запустить через Supabase SQL Editor или `psql` к production DB.

### Service-mode constraint

`franchize_intents_intent_type_allowed` в дампе не включает `'service'`. Migration:

```sql
ALTER TABLE public.franchize_intents DROP CONSTRAINT IF EXISTS franchize_intents_intent_type_allowed;
ALTER TABLE public.franchize_intents ADD CONSTRAINT franchize_intents_intent_type_allowed CHECK (
  intent_type = ANY (ARRAY[
    'checkout_start', 'payment_failure', 'payment_success', 'hold_created',
    'map_click', 'contact_click', 'test_ride_click', 'test_ride',
    'prebuy', 'trade_in', 'finance', 'rent', 'sale', 'service'
  ])
);
```

## Security

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) даёт полный read/write доступ ко всем таблицам, **включая private-схему с ПДн клиентов**. Никогда не коммитить ключ в git, не логировать в stdout/stderr, не передавать как URL-параметр (только header `apikey` / `Authorization: Bearer`), не встраивать в клиентский код.
- **PII masking** в stdout для логирования в Telegram-чаты / CI logs:
  - Телефон → `+7XXXXXXXX42` (первые 4 + `…`).
  - Паспорт → `XXXX…` (первые 4 символа серии + `…`).
  - Водительское удостоверение → `XXXX…` (первые 4 символа + `…`).
  - Регистрация (адрес) → `г. Мо…` (первые 4 символа + `…`).
  - ФИО → фамилия с инициалами (`Иванов И. И.`).
- **Private schema headers** (`Accept-Profile: private` AND `Content-Profile: private` for writes) обязательны для `rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts`. Без них PostgREST вернёт 404.
- Skill не делает `INSERT` / `UPDATE` нигде, кроме `dismiss-lead` (PATCH одной строки `franchize_intents`). Все остальные команды — read-only.
- `dismiss-lead` пишет `metadata.dismissedBy` — указывайте `ACTOR=<your_telegram_id>` для аудита.
- Все HTTP-запросы идут через HTTPS. Не использовать plain HTTP proxy.
- Skill не сохраняет результаты запросов на диск. Вывод в stdout принадлежит вызывающей стороне.

## Related Files

**Sibling text skills (same VIP Bike CLI family):**

- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — rentals/sales/todos dashboards (text)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog, pricing, availability (text)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — single rental card detail (text)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew members list, roles, live status (text)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider/user profile, identity, rentals history (text)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — rental reviews list (text)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft + artifacts (text)
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders / checkout flow (text)
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — crew admin panel (text)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — riders leaderboard (text)
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — public crew info (text)
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/leads.ts` — `getFranchizeLeads()` (matching logic)
- `app/franchize/lib/leads.ts` — `upsertFranchizeLead()`, `touchFranchizeLead()`
- `app/franchize/lib/phone-utils.ts` — `normalizePhone()`
- `app/franchize/server-actions/leads-dismiss.ts` — `dismissLeadWithReason()`
- `app/franchize/server-actions/leads-kpis.ts` — `getLeadsKpis()`
- `app/franchize/server-actions/lead-notes.ts` — lead notes CRUD
- `app/franchize/server-actions/intents.ts` — franchize_intents upsert

**Pipeline / SLA implementations (in `/impl/new_files/`):**

- `pipeline-stages.ts` — `computeLeadStage()`, `matchTodosToLead()`, `computeAssignee()`, `computeQrStatus()`
- `sla-signals.ts` — `computeLeadSignals()`, `isHotLead()`
- `lead-history.ts` — `computeLeadHistory()` (для UI timeline)
- `dismiss-reasons.ts` — `DISMISS_REASONS` enum

**Schema migrations:**

- `20260508120000_create_franchize_intents.sql` — `franchize_intents`
- `20260304_private_scheme.sql` — private schema setup
- `20260612000000_fix_rental_contract_artifacts.sql`
- `20260607000000_create_sale_contract_artifacts.sql`
- `20260601000000_user_rental_secrets.sql`
- `20260621000000_crew_todos.sql`
- `20260705000000_crew_todos_lead_id.sql`
- `20260720120200_add_crew_todos_rental_id.sql`
- `20260720120100_add_operator_chat_id.sql`
- `20260714000000_lead_notes.sql`

**UI (for reference, not used by skill):**

- `app/franchize/[slug]/leads/LeadsClient.tsx` — main React component
- `app/franchize/[slug]/leads/components/LeadCard.tsx`
- `app/franchize/[slug]/leads/components/LeadDetailContent.tsx`
- `app/franchize/[slug]/leads/components/LeadsKPICards.tsx`

**Secrets:**

- `/home/z/my-project/upload/secrets.txt` — `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_CHAT_ID`
- `/home/z/my-project/upload/supabase.txt` — full schema dump

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID`, operator IDs захардкожены под `vip-bike`. Для другого crew — отредактировать переменные в начале скрипта.
2. **No pagination**: `list-leads` показывает максимум 100 лидов (по умолчанию). Для больших списков увеличивать лимит или использовать фильтры.
3. **No timezone conversion**: Все даты выводятся в ISO / UTC. Локализация в MSK (UTC+3) — на стороне вызывающего.
4. **`dismiss-lead` dismisses ONE intent**: если у лида несколько `franchize_intents` строк, PATCH'ится только самая свежая по `updated_at`. Соответствует поведению `leads-dismiss.ts`.
5. **`troubled` users filter**: JSONB-фильтр `metadata->>troubled IS NOT NULL` не поддерживается напрямую в PostgREST. Фильтруйте в `jq`.
