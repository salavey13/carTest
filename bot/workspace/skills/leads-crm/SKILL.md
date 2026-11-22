---
name: leads-crm
description: >
  CRM-лидов VIP BIKE текстом в чат оператору: список лидов, горячие, в фокусе, QR-ждёт,
  полная карточка лида (контакты, аренды, задачи, verification), воронка по стадиям, KPI
  по аренде/продаже/сервису. Отклонение лида с причиной (мутация). Только текст — без UI.
  Триггеры: покажи лиды, статус лидов, список лидов, кто горячий, горячие лиды, лиды в
  фокусе, закрой лид, отклони лид, воронка, воронка лидов, SLA лидов, задачи в фокусе,
  KPI лидов, аналитика лидов, лиды по аренде, лиды по продаже, сервисные лиды, кто не
  отвечает, новые лиды, что с лидами, leads crm.
---

# leads-crm (бот VIP BIKE, операторский навык)

Триггер-фразы: **покажи лиды**, **статус лидов**, **список лидов**, **кто горячий**, **горячие лиды**, **лиды в фокусе**, **закрой лид**, **отклони лид**, **воронка**, **воронка лидов**, **SLA лидов**, **задачи в фокусе**, **KPI лидов**, **аналитика лидов**, **лиды по аренде**, **лиды по продаже**, **сервисные лиды**, **кто не отвечает**, **новые лиды**, **что с лидами**.

Результат — текстом в чат оператору. Skill использует только `curl` к Supabase REST API (PostgREST) и стандартные shell-утилиты (`jq`, `awk`). Не запускает Node.js сервер, не требует сборки. Часть команд — read-only, и только `dismiss-lead` мутирует состояние.

## Supabase Access

Переменные приходят из `.env` сервиса (`EnvironmentFile=/opt/claudeclaw/vip-bike/.env`):

```bash
# Фолбэк для ручного запуска из shell под claudeclaw:
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && { set -a; . /opt/claudeclaw/vip-bike/.env; set +a; }

SUPABASE_URL="${SUPABASE_URL:?no SUPABASE_URL in env}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?no key}"
CREW_SLUG="${CREW_SLUG:-vip-bike}"
CREW_ID="${CREW_ID:-2d5fde70-1dd3-4f0d-8d72-66ccf6908746}"
OPERATOR_ID="${ALLOWED_CHAT_ID:?no ALLOWED_CHAT_ID}"

HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private")
```

Service-role key обходит RLS и даёт read к `public` и `private` схемам. **Никогда** в git, в URL, в логи.

## Команды

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

**Stage filter** (например, `hold_created`):

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
Фильтр: стадия: QR ждёт активации → показано 13

Имя                     Телефон           Стадия                SLA               Назначен                Байк                  Выручка
──────────────────────  ────────────────  ────────────────────  ────────────────  ──────────────────────  ────────────────────  ──────────
Логунов Е.              +7XXXXXXXX02      QR ждёт активации     60 🔴             Джордан (member)        BMW F800R             4704k₽
Шевчук Э.               +7XXXXXXXX33      QR ждёт активации     2д 3ч 🔴          Артур С. (admin)        Regulmoto Nibbler …   2970k₽
Молев Г.                +7XXXXXXXX34      QR ждёт активации     9д 4ч 🔴          Илья О. (owner)         BMW F800R             25k₽

=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR ждёт активации: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0
```

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
=== Лид: +7XXXXXXXX02 (Логунов Е.) ===
Identity state:     claimed_user
Pipeline stage:     awaiting_qr_claim
QR status:          unclaimed (sent 9д 4ч ago)
SLA signals:        🔴 qr_age (9д 4ч), 🔴 first_contact (10д)
Next action:        Позвонить клиенту — QR-ссылка ждёт активации уже 9 дней

— Контакты —
Телефон:   +7XXXXXXX X02
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

### 3. `dismiss-lead <leadId> --reason <reason> [--note <text>]` — отклонить лид
**Мутирует состояние.** Ставит `stage='dismissed'` и пишет audit metadata.

```bash
LEAD_ID="+79200000000"
REASON="test_lead"
NOTE="sandbox cleanup"
ACTOR="${OPERATOR_ID}"   # кто отклонил = текущий оператор из ALLOWED_CHAT_ID
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

Вывод:
```
✓ Лид отклонён
  ID:           27e054e3-8db9-4394-b5e9-78d48d973ced
  Lead key:     +7XXXXXXXX00
  Reason:       test_lead (Тестовый лид)
  Note:         sandbox cleanup
  Dismissed at: 2026-07-21T23:45:51.604Z
  By:           ${OPERATOR_ID}
```

### 4. `list-todos` — задачи в фокусе по лидам

```bash
# Только задачи по лидам (lead_followup + rental_verification)
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,due_date,priority,category,assigned_to,lead_id,phone\
&crew_id=eq.${CREW_ID}&category=in.(lead_followup,rental_verification)\
&status=neq.done&due_date=not.is.null&due_date=lt.${NOW_ISO}\
&order=due_date.asc&limit=50" \
  "${HDR_PUBLIC[@]}"

# Задачи конкретного оператора (OPERATOR_ID подставляется автоматически)
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,status,due_date,category,lead_id\
&crew_id=eq.${CREW_ID}&assigned_to=eq.${OPERATOR_ID}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

Пример:
```
=== Просроченные задачи (3) ===
#1  ⚠️ overdue   Позвонить Андрею по аренде Falcon Lynx     due: 22.07
#2  ⚠️ overdue   Проверить паспорт Закиров Артур             due: 21.07
#3  ⚠️ overdue   Отправить КП для ООО Вектор                 due: 25.07
```

### 5. `kpis [--mode rent|sale|service]` — KPI-сводка

```bash
MODE="rent"   # rent | sale | service

INTENT_TYPES_RENT="checkout_start,hold_created,rent,test_ride,test_ride_click"
INTENT_TYPES_SALE="sale,prebuy,trade_in,finance"
INTENT_TYPES_SERVICE="service"

curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=id,urgency_score,stage,intent_type,created_at\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed\
&intent_type=in.(${INTENT_TYPES_RENT})" \
  "${HDR_PUBLIC[@]}"

# Revenue: sum rentals.total_cost where status IN active|completed
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=total_cost,status\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)" \
  "${HDR_PUBLIC[@]}" | jq '[.[] | .total_cost // 0] | add'
```

Вывод:
```
=== KPI лидов VIP Bike (mode: rent) ===
Всего лидов:        34
Горячих:            34
Конверсия (30д):    4% (1/27)
Выручка за период:  408k₽
```

### 6. `pipeline-funnel` — распределение по стадиям

```bash
curl -sS "${SUPABASE_URL}/rest/v1/franchize_intents?\
select=stage,intent_type\
&slug=eq.${CREW_SLUG}&stage=neq.dismissed" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.stage) | map({stage: .[0].stage, count: length})'
```

Вывод:
```
=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR ждёт активации: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0

Всего лидов: 48
Горячих:     48
```

## Доступ к схеме

### Public schema (без `Accept-Profile`)

- `franchize_intents` — канонический реестр лидов. Columns: `id`, `slug`, `bike_id`, `intent_type`, `stage`, `source_route`, `contact_channel`, `urgency_score`, `metadata` (jsonb), `telegram_user_id`, `phone`, `last_seen_at`, `created_at`, `updated_at`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `owner_id`, `status`, `payment_status`, `interest_amount`, `total_cost`, `requested_start_date`, `requested_end_date`, `agreed_start_date`, `agreed_end_date`, `delivery_address`, `created_at`, `metadata`, `passport_mainpage_photo`, `passport_registration_photo`, `drivers_licence_frontal_photo`, `crew_id`, `created_by_operator_chat_id`.
- `users` — `user_id`, `username`, `full_name`, `avatar_url`, `status`, `role`, `metadata` (phone lives in `metadata->>phone`), `badges`, `language_code`.
- `cars` — `id`, `make`, `model`, `description`, `daily_price`, `image_url`, `rent_link`, `is_test_result`, `specs` (jsonb), `owner_id`, `type`, `crew_id`, `availability_rules` (jsonb), `quantity`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `category`, `status`, `priority`, `due_date`, `created_at`, `created_by`, `updated_at`, `completed_at`, `lead_id`, `user_id`, `phone`, `rental_id`.
- `crews` — `id`, `name`, `description`, `logo_url`, `owner_id`, `slug`, `hq_location`, `metadata`.
- `crew_members` — `id`, `crew_id`, `user_id`, `role`, `joined_at`, `membership_status`, `last_location`, `live_status`.
- `lead_notes` — `id`, `lead_id`, `crew_id`, `text`, `created_by`, `created_at`, `updated_at`.

### Private schema (обязателен `Accept-Profile: private`)

- `rental_contract_artifacts` — PII. `id`, `contract_key`, `requested_bike_id`, `resolved_bike_id`, `telegram_chat_id`, `renter_full_name`, `renter_passport`, `renter_phone`, `rent_start_date`, `rent_end_date`, `daily_price`, `deposit_rub`, `total_sum`, `original_sha256`, `created_at`, `rental_id`, `crew_slug`, `created_by_operator_chat_id`.
- `user_rental_secrets` — PII. `id`, `chat_id`, `crew_slug`, `doc_sha256`, `renter_full_name`, `renter_passport`, `renter_registration`, `renter_driver_license`, `renter_phone`, `renter_email`, `verification_status`, `qr_first_viewed_at`, `qr_claimed_at`, `qr_regeneration_count`, `source_rental_id`.
- `sale_contract_artifacts` — PII. `id`, `contract_key`, `buyer_full_name`, `buyer_passport_number`, `buyer_email`, `sale_price`, `price_words`, `warranty_months`, `total_sum`, `resolved_bike_id`, `telegram_chat_id`, `buyer_phone`, `crew_slug`, `created_at`.

## Anti-hallucination: флагов НЕ существует

- ~~`--json`~~ — навык всегда выводит текстовую таблицу.
- ~~`--outFile <path>`~~ — вывод в stdout; для записи используй redirect `> leads.txt`.
- ~~`--crew <slug>`~~ — crew захардкожен (`CREW_SLUG` / `CREW_ID` из `.env` = vip-bike).
- ~~`--assignee <userId>`~~ — для `list-leads` нет. Назначение через UI. Для фильтра по assignee — `list-todos` с `&assigned_to=eq.<userId>`.
- ~~`--createdAfter <date>`~~ / ~~`--createdBefore <date>`~~ — не существуют. Используй `&created_at=gte.<ISO>` / `&created_at=lte.<ISO>` в curl.
- ~~`--format csv|md|html`~~ — только текстовая таблица.
- ~~`--reassign <leadId> --to <userId>`~~ — не существует. Навык read-only кроме `dismiss-lead`.
- ~~`dismiss-lead --dry-run`~~ — не существует. Чтобы проверить валидацию без PATCH — передать неверный reason: команда выведет список валидных причин и выйдет до DB-запроса.
- ~~`--mode all`~~ для `kpis` — не существует. Только `rent`, `sale`, `service`.
- ~~`--lead-id <id>`~~ — не существует как named flag. leadId — позиционный аргумент.

## Обработка ошибок

| Stage                       | Reason                                          | Когда возникает                                                                | Exit | Что делать                                                                  |
|-----------------------------|-------------------------------------------------|--------------------------------------------------------------------------------|------|-----------------------------------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | Нет env-переменной, `.env` недоступен                                          | 2    | Проверить `.env` / env                                                       |
| `crew_lookup`               | `Экипаж не найден`                              | `CREW_SLUG` не существует в `crews`                                            | 2    | Проверить `CREW_SLUG` (хардкод `vip-bike`)                                  |
| `supabase_query_4xx`        | `Supabase <schema>.<table> 4xx: <body>`         | Неверный select-список, RLS запретил, нет такой таблицы/колонки                 | 2    | Сверить со схемой выше                                                      |
| `supabase_query_5xx`        | `Supabase <schema>.<table> 5xx: <body>`         | Supabase лежит, rate-limit, timeout                                            | 2    | Повторить через минуту                                                       |
| `lead_not_found`            | `Lead not found: <leadId>`                      | `lead-detail`/`dismiss-lead` — нет совпадения по user_id/phone/telegramChatId | 2    | Проверить `list-leads` — какой у лида реальный `user_id`                    |
| `dismiss_reason_missing`    | `--reason is required`                          | `dismiss-lead` без `--reason`                                                  | 2    | Передать `--reason <value>` (список валидных в таблице выше)                |
| `dismiss_reason_invalid`    | `invalid reason "<value>"`                       | `--reason bogus`                                                               | 2    | Использовать одно из значений `DISMISS_REASONS`                              |
| `dismiss_note_required`     | `reason "<value>" requires --note`               | `--reason operator_error` или `--reason other` без `--note`                    | 2    | Добавить `--note "<text>"`                                                  |
| `dismiss_constraint_23514`  | `CHECK constraint 'franchize_intents_stage_allowed' rejected 'dismissed'` | DB constraint не включает `'dismissed'` в список разрешённых стадий | 2    | Запустить миграцию (SQL ниже)                                                |
| `dismiss_patch_no_rows`     | `PATCH returned no rows`                        | Intent удалён между SELECT и PATCH, или RLS                                    | 2    | Проверить что intent ещё существует через REST                               |
| `mode_invalid`              | `invalid mode "<value>"`                         | `kpis --mode bogus`                                                            | 2    | Использовать `rent` / `sale` / `service`                                    |
| `unknown_command`           | `unknown command "<value>"`                     | Опечатка в подкоманде                                                          | 2    | Запустить `--help` для списка команд                                         |

### CHECK-constraint fix для `dismiss-lead` (если возникает)

Production DB `franchize_intents_stage_allowed` может **не включать** `'dismissed'`. SQL:

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

## Безопасность

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) даёт полный read/write доступ ко всем таблицам, **включая private-схему с ПДн клиентов**. Никогда не коммитить, не логировать в stdout/stderr, не передавать как URL-параметр (только header `apikey` / `Authorization: Bearer`), не встраивать в клиентский код.
- **PII masking** в stdout (вывод идёт в Telegram, но всё равно маскируем на всякий):
  - Телефон → `+7XXXXXXXX42` (первые 4 + `…`).
  - Паспорт → `XXXX…` (первые 4 символа серии + `…`).
  - Водительское удостоверение → `XXXX…`.
  - Регистрация (адрес) → `г. Мо…` (первые 4 символа + `…`).
  - ФИО → фамилия с инициалами (`Иванов И. И.`) — оператор видит полное ФИО только в `lead-detail` (приватный operator chat).
- **Private schema headers** (`Accept-Profile: private` для чтения, `Content-Profile: private` для записи) обязательны для `rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts`. Без них PostgREST вернёт 404.
- Навык не делает `INSERT` / `UPDATE` нигде, кроме `dismiss-lead` (PATCH одной строки `franchize_intents`). Все остальные — read-only.
- `dismiss-lead` пишет `metadata.dismissedBy` — используется `OPERATOR_ID` из `ALLOWED_CHAT_ID` (автоматически).
- Все HTTP-запросы — HTTPS.
- Навык не сохраняет результаты запросов на диск. Вывод в stdout принадлежит вызывающей стороне.

## Известные ограничения

1. **Crew захардкожен**: `CREW_SLUG`, `CREW_ID`, `OPERATOR_ID` берутся из `.env` под vip-bike. Для другого crew — править `.env`.
2. **No pagination**: `list-leads` показывает максимум 100 лидов (по умолчанию). Для больших списков — увеличивать лимит или фильтры.
3. **No timezone conversion**: даты в ISO / UTC. Локализация в MSK (UTC+3) — на стороне вывода.
4. **`dismiss-lead` закрывает ОДИН intent**: если у лида несколько `franchize_intents` строк, PATCH'ится только самая свежая по `updated_at`. Соответствует поведению server-action `dismissLeadWithReason`.
5. **`troubled` users filter**: JSONB-фильтр `metadata->>troubled IS NOT NULL` не поддерживается напрямую в PostgREST. Фильтруйте в `jq`.

## Связанные навыки бота

- `rider-profile` — полная карточка клиента (контрагента лида).
- `rental-stats` — статистика аренд (лид, дошедший до аренды, виден там).
- `deposit-tracker` — залоги (по аренде, возникшей из лида).
- `contract-agent` — оформление аренды (следующий шаг после "Договор отправлен" в воронке).
