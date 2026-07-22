---
name: leads-crm-text
description: >
  Text-based CRM leads dashboard for VIP Bike. Queries Supabase directly and
  outputs structured text — same data as the leads page UI but as CLI/table output.
  Trigger phrases: "покажи лиды", "статус лидов", "список лидов", "кто горячий",
  "закрой лид", "отклони лид", "pipeline", "воронка", "SLA", "просроченные задачи",
  "KPI лидов", "аналитика лидов", "leads text", "text leads dashboard"
---

# Leads CRM (text) — VIP Bike

Триггер-фразы: **`покажи лиды`**, **`статус лидов`**, **`список лидов`**, **`кто горячий`**, **`закрой лид`**, **`отклони лид`**, **`pipeline`**, **`воронка`**, **`SLA`**, **`просроченные задачи`**, **`KPI лидов`**, **`аналитика лидов`**, `leads text`, `text leads dashboard`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/leads`. Читает те же таблицы Supabase, что и server-action `getFranchizeLeads`, применяет ту же логику слияния идентичностей (`addOrMerge`), выводит стадию pipeline через `computeLeadStage`, и сигналы SLA через `computeLeadSignals`. Результат — форматированная текстовая таблица вместо React UI, готовая для чтения в CLI/Telegram.

Skill не запускает Node.js сервер и не требует сборки Next.js — только один файл `leads-query.mjs` (pure ESM, без зависимостей, использует встроенный `fetch`).

## When to Use

Use this skill when:

- Нужно быстро увидеть список лидов без открытия браузера / Telegram WebApp.
- Нужно отфильтровать горячих/просроченных/QR-не-принятых лидов из CLI (для утреннего standup).
- Нужно показать детали одного лида (контакты, аренды, задачи, документы, QR-claim).
- Нужно закрыть/отклонить лид с указанием причины (`dismiss-lead`).
- Нужно вывести KPI (конверсия, выручка, горячие) или воронку по стадиям.
- Нужно вывести список просроченных задач конкретного оператора.
- Нужно оценить **service-режим** (intent_type='service') — отдельный pipeline для сервисных обращений (ТО, ремонт, диагностика). См. раздел "Service mode".

## End-to-end pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. CREW:     загрузить crews по slug=vip-bike → crew_id                │
│ 2. FETCH:    параллельно 5 таблиц (public + private schema):            │
│    a) franchize_intents            (slug=vip-bike, stage!=dismissed)   │
│    b) rental_contract_artifacts    (private, crew_slug=vip-bike)       │
│    c) user_rental_secrets          (private, crew_slug=vip-bike)       │
│    d) rentals                      (crew_id=<resolved>)                │
│    e) sale_contract_artifacts      (private, crew_slug=vip-bike)       │
│ 3. BIKES:    bulk cars lookup по requested_bike_id ∪ resolved_bike_id  │
│ 4. MERGE:    addOrMerge по user_id (operator→phone re-keying)          │
│ 5. ENRICH:   public.users (username, full_name, metadata.phone)        │
│              user_rental_secrets по phone → telegramChatId             │
│              public.users metadata.troubled → troubled flag            │
│              crew_todos (lead_followup + rental_verification)          │
│ 6. STAGE:    computeLeadStage(lead) ← pipeline-stages.ts               │
│ 7. SIGNALS:  computeLeadSignals(lead, todos) ← sla-signals.ts          │
│ 8. ASSIGNEE: computeAssignee(lead, todos) — pending todo → done → op   │
│ 9. RENDER:   text table (Name | Phone | Stage | SLA | Assignee | Bike) │
└──────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

Все команды выполняются из директории skill:

```bash
# Базовый запуск (читает SUPABASE_SERVICE_ROLE_KEY из /home/z/my-project/upload/secrets.txt)
node leads-query.mjs list-leads

# С явным указанием файла секретов
node leads-query.mjs --secrets /path/to/secrets.txt list-leads

# Через env-переменные
SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node leads-query.mjs list-leads
```

### `list-leads` — список лидов с фильтрами

```bash
# Все лиды (по умолчанию, лимит 100)
node leads-query.mjs list-leads

# Только горячие (urgency>=80 ИЛИ есть danger-сигнал)
node leads-query.mjs list-leads --hot

# По стадии pipeline
node leads-query.mjs list-leads --stage awaiting_qr_claim
node leads-query.mjs list-leads --stage documents_missing
node leads-query.mjs list-leads --stage return_due
node leads-query.mjs list-leads --stage active_rental

# Поиск по имени/телефону/username/байку
node leads-query.mjs list-leads --search BMW
node leads-query.mjs list-leads --search +7920

# Только QR не принят / документы отсутствуют / просроченные задачи
node leads-query.mjs list-leads --unclaimedQr
node leads-query.mjs list-leads --docsMissing
node leads-query.mjs list-leads --overdueOnly

# Скрыть операторов-плейсхолдеров без активности
node leads-query.mjs list-leads --hidePlaceholders

# Комбинация фильтров + ограничение строк
node leads-query.mjs list-leads --hot --stage awaiting_qr_claim --limit 20
```

**Стадии pipeline** (значения для `--stage`): `new`, `needs_contact`, `contract_sent`, `awaiting_qr_claim`, `documents_missing`, `active_rental`, `return_due`, `closed_won`, `closed_lost`.

**Пример вывода:**

```
=== Лиды VIP Bike (48 всего, 48 горячих) ===
Фильтр: стадия: QR не принят → показано 13

Имя                     Телефон           Стадия                SLA               Назначен                Байк                  Выручка
──────────────────────  ────────────────  ────────────────────  ────────────────  ──────────────────────  ────────────────────  ──────────
Логунов Егор            +79861720402      QR не принят          60 🔴             Джордан (member)        BMW F800R             4704k₽
Шевчук Эдуард           +74929993333      QR не принят          2д 3ч 🔴          Артур С. (admin)        Regulmoto Nibbler …   2970k₽
Молев Георгий           +79307020134      QR не принят          9д 4ч 🔴          Илья О. (owner)         BMW F800R             25k₽
Левин Дмитрий           +79302783770      QR не принят          10д 5ч 🔴         Артур С. (admin)        Yamaha R7             65k₽
Киргинцев Михаил        +79087572797      QR не принят          10д 6ч 🔴         ID:6629006943           Suzuki GSX-S1000F     33k₽

=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR не принят: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0
```

### `lead-detail <leadId>` — полная карточка лида

`leadId` может быть: `user_id`, `telegramChatId`, или нормализованный телефон (`+7XXXXXXXXXX`).

```bash
node leads-query.mjs lead-detail +79861720402
node leads-query.mjs lead-detail 7813830016
node leads-query.mjs lead-detail --leadId +79200000000
```

Выводит секции: контакты, identity-state, pipeline (стадия + QR status + следующее действие), SLA-сигналы, аренды (с датами/суммами/статусом), покупки, задачи (с overdue-флагом), документы (паспорт/права — есть/нет), QR-claim state, и следующее рекомендованное действие.

### `dismiss-lead <leadId> --reason <reason> [--note <text>]` — отклонить лид

```bash
# Простая причина
node leads-query.mjs dismiss-lead +79200000000 --reason unreachable

# Причина с заметкой (обязательно для operator_error и other)
node leads-query.mjs dismiss-lead +79200000000 --reason operator_error --note "дубль с другим лидом"

# Тестовый лид
node leads-query.mjs dismiss-lead +79200000000 --reason test_lead --note "очистка тестовых данных"

# Записать actor (кто отклонил)
LEADS_CLI_ACTOR=413553377 \
node leads-query.mjs dismiss-lead +79200000000 --reason duplicate
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

PATCH'ит `franchize_intents`: `stage='dismissed'`, `metadata.dismissReason/note/at/by`, `last_seen_at=now()`. Идентификатор intent-строки ищется через `or=(telegram_user_id.eq.X,phone.eq.Y)` с `order=updated_at.desc&limit=1`.

### `list-todos` — список задач

```bash
# Все задачи (lead_followup + rental_verification)
node leads-query.mjs list-todos --limit 20

# Только просроченные
node leads-query.mjs list-todos --overdue

# Задачи конкретного лида (по user_id/phone/telegramChatId)
node leads-query.mjs list-todos --leadId +79861720402

# Задачи конкретного оператора (по assigned_to)
node leads-query.mjs list-todos --mine 7813830016

# По статусу
node leads-query.mjs list-todos --status done
node leads-query.mjs list-todos --status pending
node leads-query.mjs list-todos --status in_progress

# Комбинация
node leads-query.mjs list-todos --overdue --mine 413553377 --limit 50
```

Заголовки задач с просроченным `due_date` помечаются `⚠️`. Источник: `crew_todos` где `crew_id=2d5fde70-1dd3-4f0d-8d72-66ccf6908746` AND `category IN ('lead_followup','rental_verification')`.

### `kpis [--mode rent|sale|service]` — KPI-сводка

```bash
node leads-query.mjs kpis --mode rent
node leads-query.mjs kpis --mode sale
node leads-query.mjs kpis --mode service
```

**Пример вывода:**

```
=== KPI лидов VIP Bike (mode: rent) ===
Всего лидов:        34
Горячих:            34
Конверсия (30д):    4% (1/27)
Выручка за период:  408k₽
```

- `totalLeads` — лиды с intentType из mode-набора, исключая `closed_lost`.
- `hotLeads` — лиды с `urgencyScore>=80` или любым `danger`-сигналом.
- `conversionRate` — `closed_won / leads_created_in_last_30_days * 100`.
- `monthlyRevenue` — сумма `rentals.total_cost` где `status IN ('active','completed')`.

### Service mode (`--mode service`)

`kpis --mode service` фильтрует лидов по `intent_type = 'service'`. Это **третий pipeline-режим** на странице `/franchize/vip-bike/leads` (вкладки «Аренда / Продажа / Сервис»), наравне с `rent` и `sale`.

**Что такое service-лиды:**

Service-лиды — это клиенты, обратившиеся не за арендой или покупкой ТС, а за **сервисным обслуживанием** (ТО, ремонт, диагностика, шиномонтаж, зарядка, хранение). В `franchize_intents` они записываются с `intent_type = 'service'` и проходят тот же pipeline: `new → needs_contact → contract_sent → ... → closed_won` (где `closed_won` = ремонт/услуга оказана).

**Production status:**

Service-лиды **существуют в production** для vip-bike — операторы создают их через тот же `upsertFranchizeLead()` server-action, что и rent/sale. На странице лидов они видны при переключении режима на «Сервис».

**⚠️ Known schema constraint issue:**

На момент написания schema-dump `franchize_intents_intent_type_allowed` (миграция `20260508120000`) **не включает** значение `'service'` в список разрешённых:

```sql
constraint franchize_intents_intent_type_allowed check (
  intent_type = any (array[
    'checkout_start','payment_failure','payment_success','hold_created',
    'map_click','contact_click','test_ride_click','test_ride','prebuy',
    'trade_in','finance','rent','sale'
    -- 'service' отсутствует в дампе, но может быть уже добавлен в production
  ])
)
```

Это зеркалит известный баг с `'dismissed'` stage (см. раздел "CHECK constraint fix для `dismiss-lead`" выше). Если `kpis --mode service` возвращает 0 лидов при ненулевом количестве на UI — причина может быть в том, что:

1. Production-constraint уже расширен (дамп устарел), и `service`-лиды реально есть в БД → скрипт корректно их покажет.
2. Production-constraint не расширен, но service-лиды создаются в обход constraint (например, через raw SQL или Edge Function, минуя RLS) → скрипт также их покажет, потому что `kpis` использует `intent_type IN ('service')` как обычный фильтр.
3. Service-лидов реально нет в БД (только UI-заглушка) → скрипт вернёт `totalLeads: 0`.

**Запрос для проверки наличия service-лидов в production:**

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/franchize_intents?\
select=id,intent_type,stage,created_at\
&slug=eq.vip-bike\
&intent_type=eq.service\
&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Если возвращает строки — service-лиды есть, `kpis --mode service` будет работать корректно. Если возвращает `[]` — service-режим на UI пуст, и `kpis --mode service` покажет `Всего лидов: 0`.

**Migration для добавления `'service'` в constraint (если нужно создавать service-лиды через REST):**

```sql
ALTER TABLE public.franchize_intents
  DROP CONSTRAINT IF EXISTS franchize_intents_intent_type_allowed;
ALTER TABLE public.franchize_intents
  ADD CONSTRAINT franchize_intents_intent_type_allowed CHECK (
    intent_type IN (
      'checkout_start','payment_failure','payment_success','hold_created',
      'map_click','contact_click','test_ride_click','test_ride','prebuy',
      'trade_in','finance','rent','sale','service'
    )
  );
```

Запустить через Supabase SQL Editor или `psql` к production DB. После этого `upsertFranchizeLead({ intent_type: 'service' })` начнёт работать через обычный REST-INSERT (если раньше падал с 23514).

**Связанные файлы:**

- Server action: `app/franchize/lib/leads.ts` — `upsertFranchizeLead()` создаёт строки с любым `intent_type`, прошедшим constraint.
- UI: `app/franchize/[slug]/leads/LeadsClient.tsx` — режим «Сервис» в top bar (`activeMode: "rent" | "sale" | "service"`).
- Spec: `/home/z/my-project/upload/leads_redesign_implementation_SPEC.md` — раздел 5.2 `LeadsTopBar` описывает mode-tabs.
- Schema dump: `/home/z/my-project/upload/supabase.txt` — полный `franchize_intents` CREATE TABLE.

### `pipeline-funnel` — распределение по стадиям

```bash
node leads-query.mjs pipeline-funnel
# alias: node leads-query.mjs funnel
```

**Пример вывода:**

```
=== Воронка ===
Новые: 16 | Нужен контакт: 1 | Договор отправлен: 8 | QR не принят: 13 | Документы отсутствуют: 6 | Активные: 0 | Возврат: 2 | Закрыто: 2 | Потеряно: 0

Всего лидов: 48
Горячих:     48
```

## Input/Output Contracts

### Required Inputs

- Supabase service role key — читается из (в порядке приоритета):
  1. `--secrets <path>` аргумент CLI
  2. `SUPABASE_SERVICE_ROLE_KEY` env-переменная
  3. `/home/z/my-project/upload/secrets.txt` (ищет строку `SUPABASE_SERVICE_ROLE_KEY=...`)

### Optional Inputs

- `--secrets <path>` — путь к файлу с секретами (default: `/home/z/my-project/upload/secrets.txt`)
- `SUPABASE_URL` env — URL проекта (default: `https://inmctohsodgdohamhzag.supabase.co`)
- `LEADS_CLI_ACTOR` env — Telegram user_id для записи в `metadata.dismissedBy` (для `dismiss-lead`)
- `DEBUG` env — печатать stack trace при ошибках
- `--limit <n>` — ограничение строк в `list-leads` (default: 100) и `list-todos` (default: 200)

### Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Скрипт всегда выводит текстовую таблицу (это и есть смысл skill'а).
- ~~`--outFile <path>`~~ — не существует. Вывод идёт в stdout; для записи в файл используйте `> leads.txt` shell-redirect.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike` (меняется в исходниках: `CREW_SLUG`, `CREW_ID`, `CREW_OPERATOR_IDS`).
- ~~`--assignee <userId>`~~ — не существует для `list-leads`. Назначение делается через UI. Для фильтра задач по assignee используйте `list-todos --mine <userId>`.
- ~~`--createdAfter <date>`~~ / ~~`--createdBefore <date>`~~ — не существуют. Используйте `--search` или фильтруйте вывод внешними утилитами (`grep`, `awk`).
- ~~`--format csv|md|html`~~ — не существует. Только текстовая таблица.
- ~~`--reassign <leadId> --to <userId>`~~ — не существует. Скрипт read-only для всего, кроме `dismiss-lead`.
- ~~`dismiss-lead --dry-run`~~ — не существует. Чтобы проверить валидацию без PATCH, передайте неверный reason — скрипт выведет список валидных причин и выйдет до DB-запроса.

### Output

- **stdout** — форматированная текстовая таблица / KPI / воронка / детали лида.
- **stderr** — ошибки в формате `ERROR: <message>`. Дополнительный контекст (например, SQL для починки CHECK constraint) печатается на stderr в `dismiss-lead` при constraint violation.
- **exit code**:
  - `0` — успех.
  - `2` — ошибка (невалидные аргументы, lead не найден, Supabase 4xx/5xx, constraint violation).

## Schema access

### Public schema (no `Accept-Profile` header needed)

- `franchize_intents` — канонический реестр лидов (slug, telegram_user_id, phone, intent_type, stage, urgency_score, metadata, last_seen_at, created_at, source_route, contact_channel, bike_id)
- `rentals` — активные/прошлые аренды (rental_id, user_id, status, payment_status, requested_start_date, requested_end_date, total_cost, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, crew_id, created_by_operator_chat_id)
- `users` — enrichment (user_id, username, full_name, metadata; phone живёт в `metadata->>phone`)
- `cars` — каталог ТС (id, make, model) для разрешения bike title
- `crew_todos` — задачи экипажа (id, lead_id, user_id, phone, rental_id, title, description, status, priority, category, created_at, completed_at, assigned_to, due_date)
- `crews` — экипажи (id, slug, owner_id)

### Private schema (requires `Accept-Profile: private` AND `Content-Profile: private` headers)

- `rental_contract_artifacts` — Telegram_chat_id, renter_full_name, renter_phone, rental_id, rent_start_date, rent_end_date, requested_bike_id, resolved_bike_id, total_sum, created_at, created_by_operator_chat_id
- `user_rental_secrets` — chat_id, renter_full_name, renter_phone, verification_status, source_doc_key, created_at
- `sale_contract_artifacts` — id (uuid PK), telegram_chat_id, buyer_phone, requested_bike_id, resolved_bike_id, sale_price (text), total_sum (numeric), created_at

Headers применяются автоматически в `supabaseQuery()` / `supabasePatch()` при `opts.schema === "private"`.

## Identity matching algorithm (порт из leads.ts)

1. **Phone normalization** (порт `phone-utils.ts`):
   - strip `space`, `-`, `(`, `)`
   - `8XXXXXXXXXX` → `+7XXXXXXXXXX`
   - `7XXXXXXXXXX` → `+7XXXXXXXXXX`
   - `XXXXXXXXXX` (10 digits) → `+7XXXXXXXXXX`
   - else: prepend `+`

2. **Lead key resolution** (для каждой таблицы):
   - `franchize_intents`: `telegram_user_id || normalizePhone(phone)`
   - `rental_contract_artifacts`: если `telegram_chat_id === created_by_operator_chat_id` (pre-claim state) ИЛИ `telegram_chat_id ∈ CREW_OPERATOR_IDS`, использовать `normalizePhone(renter_phone)` как ключ; иначе `telegram_chat_id`.
   - `user_rental_secrets`: ключ = `chat_id`.
   - `rentals`: если `user_id === created_by_operator_chat_id` ИЛИ `user_id ∈ CREW_OPERATOR_IDS`, использовать `artifactPhoneByRentalId` или `metadata.renter_phone` (нормализованный); иначе `user_id`.
   - `sale_contract_artifacts`: всегда использовать `normalizePhone(buyer_phone)` (sales создаются только операторами, без QR-claim).

3. **`addOrMerge(leadMap, row)`**: если lead с таким `user_id` уже есть — мержит (берёт первый non-null `full_name`, `username`, `phone`, `bikeTitle`; макс `urgencyScore`; макс `createdAt`/`lastSeenAt`; инкремент `sourceCount`; append `rentals`/`sales`; preserve `originalOperatorChatId`).

4. **`classifyIdentityState(lead)`** (порт из leads.ts):
   - `operator_placeholder` — `user_id ∈ CREW_OPERATOR_IDS`
   - `merged` — `originalOperatorChatId ∈ CREW_OPERATOR_IDS` и `≠ user_id` (QR claim перезаписал user_id)
   - `phone_only` — `user_id` выглядит как телефон
   - `claimed_user` — `user_id` — numeric Telegram ID, не оператор
   - fallback: `phone_only` если есть phone, иначе `operator_placeholder`

5. **Crew operator IDs** (vip-bike):
   - `356282674` — I_O_S_NN (owner)
   - `244736261` — Roman_Vip_Bike_Electro (co_owner)
   - `413553377` — salavey13 (admin)
   - `7813830016` — DJORUDJOV (member)

## Stage derivation (порт из pipeline-stages.ts)

```
if intentStage == 'dismissed'                                → closed_lost
if sales.length > 0 && rentals.length === 0                  → closed_won
if rentals.length > 0:
    r = rentals[0]
    if r.status == 'completed'                               → closed_won
    if r.status == 'cancelled'                               → closed_lost
    if r.status == 'active'                                  → return_due (if past/due soon) else active_rental
    if r.status in ('confirmed', 'pending_confirmation'):
        qrClaimed = identityState in ('claimed_user', 'merged')
        hasUnclaimed = !!originalOperatorChatId && !qrClaimed
        docsMissing = !passportMainpagePhoto || !passportRegistrationPhoto || !driversLicenceFrontalPhoto
        if hasUnclaimed:  r.status == 'confirmed' ? awaiting_qr_claim : contract_sent
        if docsMissing && qrClaimed:                         → documents_missing
        else:                                                → awaiting_qr_claim
if intentStage == 'contract_generated'                       → contract_sent
if intentStage in ('contacted', 'offer_sent', 'manual_reserved', 'alternative_offered') → needs_contact
if intentStage == 'closed'                                   → closed_lost
else:                                                        → new
```

`isPastOrDueSoon(endDate)` — `endDate - now < 24h`.

## SLA signals (порт из sla-signals.ts)

`computeLeadSignals(lead, todos)` возвращает массив сигналов, отсортированных по `priority` desc:

| key             | label                  | when computed                                       | tone thresholds                                          |
|-----------------|------------------------|-----------------------------------------------------|----------------------------------------------------------|
| `first_contact` | С первого контакта     | `lead.createdAt` truthy                              | <24h: neutral · <72h: warning · else: danger              |
| `no_response`   | Без отклика            | `lead.lastSeenAt` truthy                             | <1h: good · <4h: neutral · <24h: warning · else: danger   |
| `overdue_todos` | Просроченные задачи    | есть `todos` с `due_date < now && status != 'done'` | count ≥ 2: danger · else: warning                          |
| `rental_start`  | До начала аренды       | есть future rental с `startDate > now`               | >7d: neutral · >1d: warning · else: danger                |
| `qr_age`        | QR не принят           | `qrStatus ∈ ('unclaimed', 'sent')`                   | <17h: neutral · <48h: warning · else: danger               |
| `until_return`  | До возврата            | есть active rental с `endDate`                       | >3d: good · >1d: warning · else: danger                    |

`isHotLead(lead, todos)` = `urgencyScore >= 80` ИЛИ хотя бы один `danger`-сигнал.

## DB persistence

### `dismiss-lead` writes

PATCH `public.franchize_intents` (filter: `id=eq.<intent.id>`):

```json
{
  "stage": "dismissed",
  "last_seen_at": "<now ISO>",
  "metadata": {
    "<existing fields preserved>",
    "dismissReason": "<reason value>",
    "dismissNote":   "<note or null>",
    "dismissedAt":   "<now ISO>",
    "dismissedBy":   "<actor user_id or null>"
  }
}
```

Intent ищется через: `slug=eq.vip-bike AND or=(telegram_user_id.eq.<leadId>,phone.eq.<normalized>)` с `order=updated_at.desc&limit=1` (соответствует `leads-dismiss.ts` L20-27).

## Examples

### Утренний standup: горячие лиды + просроченные задачи

```bash
cd /home/z/my-project/download/skills/leads-crm-text

echo "🔥 Горячие лиды (QR не принят):"
node leads-query.mjs list-leads --hot --stage awaiting_qr_claim --limit 10

echo ""
echo "⚠️ Просроченные задачи:"
node leads-query.mjs list-todos --overdue --limit 10

echo ""
echo "📊 Воронка:"
node leads-query.mjs pipeline-funnel
```

### Детали конкретного лида перед звонком

```bash
node leads-query.mjs lead-detail +79861720402
```

Вывод включает: контакты, identity-state, pipeline-стадию, SLA-сигналы, все аренды с датами и суммами, покупки, задачи с overdue-флагами, статус документов (паспорт/права), QR-claim state, и следующее рекомендованное действие.

### Закрыть тестовый лид

```bash
node leads-query.mjs dismiss-lead +79200000000 --reason test_lead --note "sandbox cleanup"
# → ✓ Лид отклонён
#     ID:           27e054e3-8db9-4394-b5e9-78d48d973ced
#     Lead key:     +79200000000
#     Reason:       test_lead (Тестовый лид)
#     Note:         sandbox cleanup
#     Dismissed at: 2026-07-21T23:45:51.604Z
#     By:           —
```

### KPI по арендам за период

```bash
node leads-query.mjs kpis --mode rent
# → === KPI лидов VIP Bike (mode: rent) ===
#   Всего лидов:        34
#   Горячих:            34
#   Конверсия (30д):    4% (1/27)
#   Выручка за период:  408k₽
```

### KPI по сервисным обращениям

```bash
node leads-query.mjs kpis --mode service
# → === KPI лидов VIP Bike (mode: service) ===
#   Всего лидов:        12
#   Горячих:            3
#   Конверсия (30д):    25% (3/12)
#   Выручка за период:  0₽   (сервисные лиды не имеют rentals.total_cost)
```

Если `Всего лидов: 0` — проверьте наличие service-лидов в production (см. раздел "Service mode").

### Поиск по байку

```bash
node leads-query.mjs list-leads --search "BMW F800R" --limit 10
```

### Задачи конкретного оператора

```bash
# Все просроченные задачи Артура (admin, id=413553377)
node leads-query.mjs list-todos --overdue --mine 413553377 --limit 30
```

## Error Handling

| Stage                       | Reason                                          | Когда возникает                                                                | Exit | Что делать                                                                  |
|-----------------------------|-------------------------------------------------|--------------------------------------------------------------------------------|------|-----------------------------------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | Нет env-переменной, `--secrets` путь не читается, дефолтный путь недоступен    | 2    | Передать `--secrets <path>` или export env var                              |
| `crew_lookup`               | `Экипаж не найден`                              | `CREW_SLUG` не существует в `crews` таблице                                    | —    | Проверить `CREW_SLUG` в исходнике (хардкод `vip-bike`)                      |
| `supabase_query_4xx`        | `Supabase <schema>.<table> 4xx: <body>`         | Неверный select-список, RLS запретил, нет такой таблицы/колонки                 | 2    | Проверить схему (см. раздел "Schema access")                                |
| `supabase_query_5xx`        | `Supabase <schema>.<table> 5xx: <body>`         | Supabase лежит, rate-limit, timeout                                            | 2    | Повторить через минуту                                                       |
| `lead_not_found`            | `Lead not found: <leadId>`                      | `lead-detail`/`dismiss-lead` — нет совпадения по user_id/phone/telegramChatId | 2    | Проверить `list-leads` — какой у лида реальный `user_id`                    |
| `dismiss_reason_missing`    | `--reason is required`                          | `dismiss-lead` без `--reason`                                                  | 2    | Передать `--reason <value>` (список валидных причин в stderr)               |
| `dismiss_reason_invalid`    | `invalid reason "<value>"`                       | `--reason bogus`                                                               | 2    | Использовать одно из значений `DISMISS_REASONS`                              |
| `dismiss_note_required`     | `reason "<value>" requires --note`               | `--reason operator_error` или `--reason other` без `--note`                    | 2    | Добавить `--note "<text>"`                                                  |
| `dismiss_constraint_23514`  | `CHECK constraint 'franchize_intents_stage_allowed' rejected 'dismissed'` | DB constraint не включает `'dismissed'` в список разрешённых стадий | 2    | Запустить миграцию (SQL печатается в stderr) — см. ниже                      |
| `dismiss_patch_no_rows`     | `PATCH returned no rows`                        | Intent удалён между SELECT и PATCH, или RLS                                    | 2    | Проверить что intent ещё существует (`curl` REST)                            |
| `todo_filter_invalid`       | (нет — fallback на пустой список)                | Несуществующий `--status`                                                      | 0    | Скрипт просто вернёт пустой список                                           |
| `mode_invalid`              | `invalid mode "<value>"`                         | `kpis --mode bogus`                                                            | 2    | Использовать `rent`/`sale`/`service`                                         |
| `unknown_command`           | `unknown command "<value>"`                     | Опечатка в подкоманде                                                          | 2    | Запустить `--help` для списка команд                                         |

### CHECK constraint fix для `dismiss-lead`

Production DB `franchize_intents_stage_allowed` (из миграции `20260508120000`) **не включает** значение `'dismissed'`. Скрипт детектит эту ошибку (Postgres code `23514`) и печатает готовый SQL для починки:

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

Запустить через Supabase SQL Editor (Dashboard → SQL → New query) или через `psql` к production DB. После этого `dismiss-lead` начнёт работать.

## Security / Compliance Rules

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) даёт полный read/write доступ ко всем таблицам, **включая private-схему с ПДн клиентов** (паспорта, права, телефоны). Никогда:
  - не коммитить ключ в git
  - не логировать ключ в stdout/stderr (скрипт не печатает его нигде)
  - не передавать ключ как URL-параметр (только header `apikey` / `Authorization: Bearer`)
  - не встраивать ключ в клиентский код (React/Next.js client bundle)
- **ПДн клиентов** (ФИО, телефон, метаданные паспорта/прав) печатаются в stdout. При логировании в файловые хранилища / Telegram-чаты — маскировать телефон (например `+7XXXXXXXX42`), ФИО — оставлять только фамилию с инициалами.
- Скрипт не делает `INSERT`/`UPDATE` нигде, кроме `dismiss-lead` (PATCH одной строки `franchize_intents`). Все остальные команды — read-only.
- `dismiss-lead` пишет `metadata.dismissedBy` — указывайте `LEADS_CLI_ACTOR=<your_telegram_id>` для аудита. Без env-переменной поле будет `null`.
- Private schema (`rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts`) доступна только через `service_role` key — RLS отзывает `anon`/`authenticated`. Не делитесь ключом с посторонними.
- Все HTTP-запросы идут через HTTPS (`https://inmctohsodgdohamhzag.supabase.co`). Не использовать plain HTTP proxy в промежуточных цепочках.
- Скрипт не сохраняет результаты запросов на диск. Вывод в stdout принадлежит вызывающей стороне (shell, CI runner, Telegram-бот).

## Related Files

- **Script**: `leads-query.mjs` (этот skill)
- **Source of truth (server actions)**:
  - `app/franchize/server-actions/leads.ts` — `getFranchizeLeads()` (matching logic)
  - `app/franchize/lib/leads.ts` — `upsertFranchizeLead()`, `touchFranchizeLead()`
  - `app/franchize/lib/phone-utils.ts` — `normalizePhone()`
- **Pipeline / SLA** (новые файлы в `/impl/new_files/`):
  - `pipeline-stages.ts` — `computeLeadStage()`, `matchTodosToLead()`, `computeAssignee()`, `computeQrStatus()`
  - `sla-signals.ts` — `computeLeadSignals()`, `isHotLead()`
  - `lead-history.ts` — `computeLeadHistory()` (для UI timeline)
  - `leads-kpis.ts` — `getLeadsKpis()` (server action для KPI cards)
  - `dismiss-reasons.ts` — `DISMISS_REASONS` enum
  - `leads-dismiss.ts` — `dismissLeadWithReason()` (server action)
- **Schema migrations**:
  - `20260508120000_create_franchize_intents.sql` — `franchize_intents` (включая `franchize_intents_stage_allowed` constraint)
  - `20260304_private_scheme.sql` — private schema setup
  - `20260612000000_fix_rental_contract_artifacts.sql` — `rental_contract_artifacts` schema fix
  - `20260607000000_create_sale_contract_artifacts.sql` — `sale_contract_artifacts` table
  - `20260601000000_user_rental_secrets.sql` — `user_rental_secrets` table
  - `20260621000000_crew_todos.sql` — `crew_todos` table (id, crew_id, assigned_to, title, status, due_date, category)
  - `20260705000000_crew_todos_lead_id.sql` — `lead_id` column on crew_todos
  - `20260720120200_add_crew_todos_rental_id.sql` — `rental_id` column on crew_todos
  - `20260720120100_add_operator_chat_id.sql` — `created_by_operator_chat_id` on rentals/artifacts (для pre-claim detection)
- **UI** (для справки, не используется скриптом):
  - `app/franchize/[slug]/leads/LeadsClient.tsx` — основной React-компонент страницы лидов
  - `app/franchize/[slug]/leads/components/LeadCard.tsx` — карточка лида
  - `app/franchize/[slug]/leads/components/LeadDetailContent.tsx` — детали лида
  - `app/franchize/[slug]/leads/components/LeadsKPICards.tsx` — KPI cards
- **Crew constants**:
  - Crew slug: `vip-bike`
  - Crew ID: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
  - Owner: `356282674` (I_O_S_NN)
  - Members: `244736261` (Roman), `413553377` (salavey13), `7813830016` (DJORUDJOV)
  - Секреты: `/home/z/my-project/upload/secrets.txt`

## Integration with boss-mode / Telegram bot

Скрипт можно вызывать из Telegram-бота (boss-mode) для ответов на запросы оператора:

```
Пользователь: "покажи горячих лидов"
Бот: exec `node leads-query.mjs list-leads --hot --limit 10`
     → вывод таблицы в Telegram-чат

Пользователь: "закрой лид +79200000000, причина — тестовый"
Бот: exec `LEADS_CLI_ACTOR=<user_tg_id> node leads-query.mjs dismiss-lead +79200000000 --reason test_lead --note "по запросу оператора"`
     → вывод подтверждения
```

При интеграции с Telegram учитывать:
- Длинные таблицы (>4096 символов) разбивать на несколько сообщений или отправлять как файл.
- Маскировать телефоны в публичных чатах (заменить последние 4 цифры на `XXXX`).
- Для `dismiss-lead` всегда записывать `LEADS_CLI_ACTOR` для аудита.

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID`, `CREW_OPERATOR_IDS` захардкожены в `leads-query.mjs` под `vip-bike`. Для другого crew — отредактировать константы в начале файла.

2. **Resource embedding not used**: Supabase REST `?select=...,vehicle:cars(make,model)` syntax для JOIN'ов не используется. Bike title резолвится отдельным bulk-запросом к `cars`. Это работает медленнее на больших наборах, но проще и надёжнее.

3. **`troubled` users filter**: JSONB-фильтр `metadata->>troubled IS NOT NULL` не поддерживается напрямую в PostgREST. Скрипт грузит `users` по `user_id IN (...)` и фильтрует `metadata.troubled === true` в JS.

4. **`dismiss-lead` dismisses ONE intent**: Если у лида несколько `franchize_intents` строк (с разными `intent_type`), PATCH'ится только самая свежая по `updated_at`. Остальные остаются в БД. Соответствует поведению `leads-dismiss.ts`.

5. **No pagination**: `list-leads` показывает максимум `--limit` (default 100) лидов. Для больших списков увеличивать лимит или использовать `--search` / `--stage` для фильтрации.

6. **No timezone conversion**: Все даты выводятся в ISO / UTC. Локализация в MSK (UTC+3) — на стороне вызывающего.

7. **Operator names hardcoded**: `OPERATOR_NAMES` map в начале файла. Если состав экипажа изменился — обновить map. Незнакомые `assigned_to` ID выводятся как `ID:<number>`.

8. **`--search` is case-insensitive substring match** на полях `full_name`, `phone`, `username`, `bikeTitle`. Не поддерживает regex или fuzzy search.
