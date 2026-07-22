---
name: franchize-catalog-text
description: >
  Text-based catalog for VIP Bike franchise. Query bikes, pricing, availability via Supabase.
  Trigger phrases: "каталог байков", "список байков", "сколько стоит аренда",
  "доступность байка", "покажи байки", "bike catalog", "bike list",
  "bike pricing", "bike availability", "какие байки есть"
---

# Franchize Catalog (text) — VIP Bike

Триггер-фразы: **`каталог байков`**, **`список байков`**, **`сколько стоит аренда`**, **`доступность байка`**, **`покажи байки`**, **`bike catalog`**, **`bike list`**, **`bike pricing`**, **`bike availability`**, **`какие байки есть`**.

## Overview

Text-based эквивалент каталога ТС для экипажа `vip-bike`. Читает таблицу `public.cars` через Supabase REST API (PostgREST), фильтрует по `crew_id = 2d5fde70-1dd3-4f0d-8d72-66ccf6908746` и `type = bike`, выводит форматированную текстовую таблицу вместо React UI. Также читает `public.rentals` для проверки доступности конкретного байка на дату.

Skill не запускает Node.js сервер и не требует сборки Next.js — только один файл `catalog-query.mjs` (pure ESM, без зависимостей, использует встроенный `fetch`).

Сibling skill'ы:
- `leads-crm-text` — та же архитектура (`leads-query.mjs`), для CRM-лидов.
- `analytics-text` — inline-`curl` команды для analytics-дашбордов (rentals/sales/todos).

## When to Use

Use this skill when:

- Нужно быстро увидеть список доступных байков экипажа `vip-bike` из CLI / Telegram.
- Нужно проверить цену аренды конкретного байка по всем tiers (будни / выходные / 2–4д / 5–10д / 11–30д / залог).
- Нужно показать полные спецификации одного байка (specs jsonb, image_url, availability_rules).
- Нужно проверить, свободен ли байк на конкретную дату (на основе активных/подтверждённых аренд).
- Нужно ответить клиенту в Telegram «какие байки есть» без открытия браузера.

## End-to-end pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. CREW:     hardcoded CREW_SLUG=vip-bike, CREW_ID=<uuid>             │
│ 2. AUTH:     read SUPABASE_SERVICE_ROLE_KEY from                     │
│              /home/z/my-project/upload/secrets.txt (or env/CLI)       │
│ 3. QUERY:    GET /rest/v1/cars?crew_id=eq.<id>&type=eq.bike           │
│              select=id,make,model,daily_price,image_url,specs,        │
│                       availability_rules,quantity,type                │
│ 4. RENDER:   text table (ID | Марка | Модель | Цена/день | Кол-во |   │
│                       Ключевые спецификации)                          │
│              + блок ссылок на image_url                               │
│ 5. (opt) AVAILABILITY: GET /rest/v1/rentals?vehicle_id=eq.<bikeId>    │
│                        &status=in.("active","confirmed")              │
│                        &requested_start_date=lte.<END>                │
│                        &requested_end_date=gte.<START>                │
│                        → bike blocked if blocking.length >= quantity  │
└──────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

Все команды выполняются из директории skill:

```bash
# Базовый запуск (читает SUPABASE_SERVICE_ROLE_KEY из /home/z/my-project/upload/secrets.txt)
node catalog-query.mjs list-bikes

# С явным указанием файла секретов
node catalog-query.mjs --secrets /path/to/secrets.txt list-bikes

# Через env-переменные
SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node catalog-query.mjs list-bikes
```

### `list-bikes [--type bike|scooter|all]` — список ТС экипажа

```bash
# Все байки (по умолчанию)
node catalog-query.mjs list-bikes

# Только самокаты
node catalog-query.mjs list-bikes --type scooter

# Все ТС (без фильтра по типу)
node catalog-query.mjs list-bikes --type all
```

**Логика:** Query `public.cars` where `crew_id = 2d5fde70-1dd3-4f0d-8d72-66ccf6908746` AND `type = bike` (или `scooter`, или без фильтра для `all`). Дополнительно `is_test_result = false` — отбрасывает ТС, сгенерированные embedding-пайплайном.

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

Колонки: `ID` (22), `Марка` (16), `Модель` (24), `Цена/день` (12, right-align), `Кол-во` (7), `Ключевые спецификации` (60). Цена форматируется с пробелом как thousand separator (`8 500 ₽`).

«Ключевые спецификации» — это композит из `specs` jsonb по полям: `color`, `year`, `engine`, `power_kw`, `battery_kwh`, `range_km`, `weight_kg`, `vin`. Пустые поля пропускаются.

### `bike-detail <bikeId>` — полные детали байка

```bash
node catalog-query.mjs bike-detail falcon-lynx
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

### `bike-pricing <bikeId>` — все pricing tiers

```bash
node catalog-query.mjs bike-pricing falcon-lynx
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

Если в `specs` нет каких-то tier-полей, в таблице будет `—` для цены. Это нормально — operator мог заполнить только базовую цену и залог.

### `check-availability <bikeId> [--date YYYY-MM-DD]` — доступность на дату

```bash
# На сегодня (UTC)
node catalog-query.mjs check-availability falcon-lynx

# На конкретную дату
node catalog-query.mjs check-availability falcon-lynx --date 2026-07-25
```

**Логика:** Байк **недоступен** на дату `D` если существует хотя бы одна запись в `public.rentals` где:

```
vehicle_id = <bikeId>
AND status IN ('active', 'confirmed')
AND requested_start_date <= <D end-of-day>
AND requested_end_date   >= <D start-of-day>
```

Если у байка `quantity > 1`, то он недоступен только когда **количество блокирующих аренд** `>= quantity`. Это позволяет иметь в парке 2 одинаковых байка (например, 2 × Sur-Ron Light Bee X) и сдавать их параллельно.

`status = 'pending_confirmation'` **не блокирует** — заявка ещё не согласована, байк остаётся бронируемым. `status = 'cancelled'` и `status = 'completed'` не блокируют.

`status = 'disputed'` не блокирует (оспариваемая аренда — решение оператора).

**Пример вывода (байк доступен):**

```
=== Доступность байка 79BIKE Falcon Lynx (id: falcon-lynx) ===
Дата:                       2026-07-25
Количество в парке:         1
Активных/подтверждённых аренд на эту дату: 0
Доступен:                   ✅ ДА
Правила доступности:        доступен, сезон: Apr-Oct, мин. аренда 1 дн., макс. аренда 30 дн.
```

**Пример вывода (байк занят):**

```
=== Доступность байка 79BIKE Falcon Lynx (id: falcon-lynx) ===
Дата:                       2026-07-25
Количество в парке:         1
Активных/подтверждённых аренд на эту дату: 1
Доступен:                   ❌ НЕТ
Правила доступности:        доступен, сезон: Apr-Oct, мин. аренда 1 дн., макс. аренда 30 дн.

— Блокирующие аренды —
rental_id                              status      payment      период (requested)      период (agreed)         renter
──────────────────────  ──────────  ──────────  ──────────  ──────────  ──────
a1b2c3d4-...                           active      fully_paid   24.07.2026 → 27.07.2026  24.07.2026 → 27.07.2026  413553377
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
- `--type <bike|scooter|all>` — фильтр типа ТС для `list-bikes` (default: `bike`)
- `--date <YYYY-MM-DD>` — дата для `check-availability` (default: today UTC)
- `DEBUG` env — печатать stack trace при ошибках

### Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Скрипт всегда выводит текстовую таблицу.
- ~~`--outFile <path>`~~ — не существует. Вывод идёт в stdout; для записи в файл используйте `> catalog.txt` shell-redirect.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike` (меняется в исходниках: `CREW_SLUG`, `CREW_ID`).
- ~~`--sort <field>`~~ — не существует. Сортировка всегда `make.asc, model.asc`. Для другой сортировки парсьте stdout.
- ~~`--format csv|md|html`~~ — не существует. Только текстовая таблица.
- ~~`--only-available`~~ — не существует для `list-bikes`. Доступность проверяется только в `check-availability` (она требует конкретную дату).
- ~~`bike-detail --include-rentals`~~ — не существует. Аренды байка — это отдельная команда `check-availability`. Для истории всех аренд смотри skill `analytics-text`.
- ~~`list-bikes --price-max <rub>`~~ / ~~`--price-min <rub>`~~ — не существуют. Фильтруйте вывод внешними утилитами (`grep`, `awk`, `jq`).
- ~~`bike-pricing --days <n>`~~ — не существует. Скрипт выводит ВСЕ tiers из `specs`. Подбор конкретной цены по длительности — на стороне вызывающего.

### Output

- **stdout** — форматированная текстовая таблица / детали байка / pricing tiers / availability-чек.
- **stderr** — ошибки в формате `ERROR: <message>`.
- **exit code**:
  - `0` — успех (включая empty state: «Нет ТС в каталоге»).
  - `2` — ошибка (невалидные аргументы, байк не найден, Supabase 4xx/5xx).

## Schema access

Только `public` schema. Private schema (`rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts`) НЕ используется этим skill'ом — это каталог ТС, а не PII-документы арендаторов. Если нужны PII, смотри `leads-crm-text` или `analytics-text`.

### `public.cars` — основной источник

```sql
create table public.cars (
  id text not null,                         -- PK, slug-like (e.g. "falcon-lynx")
  make text not null,                       -- e.g. "79BIKE", "Sur-Ron"
  model text not null,                      -- e.g. "Falcon Lynx", "Light Bee X"
  description text not null,                -- long description
  embedding public.vector null,             -- pgvector embedding (ignored here)
  daily_price numeric null,                 -- base price (₽/day); can be null if specs.dailyPrice is set
  image_url text not null,                  -- public CDN URL
  rent_link text null,                      -- affiliate/booking URL (e.g. t.me link)
  is_test_result boolean default false,     -- skip these in catalog listings
  specs jsonb default '{}'::jsonb,          -- full specs (see below)
  owner_id text null,                       -- operator telegram id (FK users.user_id)
  type text not null default 'car',         -- 'bike' | 'scooter' | 'car' | custom
  crew_id uuid null,                        -- FK crews.id (filter = vip-bike id)
  availability_rules jsonb default '{}'::jsonb,
  quantity numeric default 1,               -- number of identical units in fleet
  constraint cars_pkey primary key (id)
);
```

Indexes (relevant for queries):
- `idx_cars_crew_id` on `crew_id` — primary filter for crew catalog.
- `cars_embedding_idx` HNSW on `embedding` — for semantic search (not used here).

### `specs` jsonb — known keys

Это гибкий jsonb-объект, накапливающий все известные характеристики ТС. Skill интерпретирует конкретные ключи для pricing tiers и key specs. Остальные ключи выводятся как «name: value» в полном дампе.

**Pricing tiers (читаются `bike-pricing` и `bike-detail`):**

| Key             | Label                  | Unit     |
|-----------------|------------------------|----------|
| `rent_weekday`  | Будни (1 день)         | ₽/день   |
| `rent_weekend`  | Выходной (1 день)      | ₽/день   |
| `rent_2_4d`     | 2–4 дня                | ₽/день   |
| `rent_5_10d`    | 5–10 дней              | ₽/день   |
| `rent_11_30d`   | 11–30 дней             | ₽/день   |
| `deposit_rub`   | Залог                  | ₽        |

Дополнительно: `dailyPrice` — дублирующее поле базовой цены (может отличаться от `cars.daily_price`).

**Key specs (читаются `list-bikes` в компактную колонку):**

| Key            | Example       | Notes                                |
|----------------|---------------|--------------------------------------|
| `color`        | `black`       |                                      |
| `year`         | `2025`        |                                      |
| `engine`       | `1500W`       | free-form string                     |
| `power_kw`     | `8`           | numeric, kW                          |
| `battery_kwh`  | `2.1`         | numeric, kWh                         |
| `range_km`     | `150`         | numeric, km                          |
| `weight_kg`    | `65`          | numeric, kg                          |
| `vin`          | `XYZ123456789`| string                               |

Также могут встречаться: `motor_type`, `top_speed_kmh`, `charge_time_h`, `brakes`, `suspension`, `tyres`, `seat_height_mm`, `load_capacity_kg`, `lights`, `display`, `connectivity`, `warranty_months`. Все они выводятся в полном дампе `bike-detail`.

### `availability_rules` jsonb — known keys

Опциональный объект с правилами доступности ТС. Если пусто — используется «по умолчанию доступен».

| Key                | Type            | Example              | Notes                                            |
|--------------------|-----------------|----------------------|--------------------------------------------------|
| `available`        | boolean         | `true`               | Master switch                                    |
| `season`           | string          | `"Apr-Oct"`          | Human-readable season window                     |
| `blackout_dates`   | array<string>   | `["2026-01-01"]`     | Specific dates when bike is unavailable           |
| `notice_hours`     | number          | `2`                  | Minimum booking notice (hours before pickup)     |
| `min_rental_days`  | number          | `1`                  | Minimum rental duration                          |
| `max_rental_days`  | number          | `30`                 | Maximum rental duration                          |

`check-availability` **не** автоматически применяет `blackout_dates` или `season` — эти правила информационные и выводятся в чек. Реальная блокировка идёт только через `rentals` table. Если нужно учитывать blackouts, оператор должен либо создать `rental` со статусом `active`, либо валидировать дату по `availability_rules` на стороне приложения.

### `public.rentals` — для availability-чек

| Column                  | Type        | Notes                                            |
|-------------------------|-------------|--------------------------------------------------|
| `rental_id`             | uuid (PK)   |                                                  |
| `vehicle_id`            | text        | FK → `cars.id` (filter column)                   |
| `status`                | text        | `pending_confirmation` / `confirmed` / `active` / `completed` / `cancelled` / `disputed` |
| `payment_status`        | text        | `pending` / `interest_paid` / `fully_paid` / `refunded` / `failed` |
| `requested_start_date`  | timestamptz | Original request start (used for overlap check)  |
| `requested_end_date`    | timestamptz | Original request end (used for overlap check)    |
| `agreed_start_date`     | timestamptz | Negotiated start (shown in output but not filter)|
| `agreed_end_date`       | timestamptz | Negotiated end (shown in output but not filter)  |
| `total_cost`            | numeric?    | Rubles                                           |
| `user_id`               | text        | FK → `users.user_id`                             |

**Overlap-фильтр** использует `requested_start_date` / `requested_end_date` (а не `agreed_*`) — это соответствует поведению server-action `getFranchizeRentals`. Если `requested_*` пустые, запись не попадёт в блокирующий набор (это редкий случай — обычно заявка создаётся с `requested_*` сразу).

## Crew context (hardcoded defaults)

| Field        | Value                                  |
|--------------|----------------------------------------|
| `crew_slug`  | `vip-bike`                             |
| `crew_id`    | `2d5fde70-1dd3-4f0d-8d72-66ccf6908746` |

Override через `--crewSlug` / `--crewId` **не существует** (anti-hallucination rule). Для другого crew — отредактировать `CREW_SLUG` / `CREW_ID` в начале `catalog-query.mjs`.

Operator chat IDs (для справки, не используются этим skill'ом напрямую):
- `356282674` — I_O_S_NN (owner)
- `244736261` — Roman_Vip_Bike_Electro (co_owner)
- `413553377` — salavey13 (admin)
- `7813830016` — DJORUDJOV (member)

## Examples

### Утренний оператор: какие байки есть в парке

```bash
cd /home/z/my-project/download/skills/franchize-catalog-text
node catalog-query.mjs list-bikes
```

### Клиент спрашивает «сколько стоит аренда Falcon Lynx на 3 дня в будни»

```bash
# 1. Показать все pricing tiers
node catalog-query.mjs bike-pricing falcon-lynx

# 2. Найти tier "2–4 дня" — это 7 500 ₽/день
# 3. Итого: 7 500 × 3 = 22 500 ₽ + залог 30 000 ₽
```

### Клиент хочет забронировать байк на 25 июля

```bash
# Проверить доступность
node catalog-query.mjs check-availability falcon-lynx --date 2026-07-25
# → ✅ ДА → можно принимать заявку
# → ❌ НЕТ → показать клиенту другой байк:
node catalog-query.mjs list-bikes --type all
```

### Полные детали байка для онбординга оператора

```bash
node catalog-query.mjs bike-detail sur-ron-light-bee-x
```

Вывод включает: ID, тип, owner_id, полную спецификацию (specs jsonb), все pricing tiers, правила доступности, ссылку на изображение и rent_link.

### Telegram-бот: показать клиенту 3 самых дешёвых байка

```bash
# Получить список, отсортировать по цене через awk
node catalog-query.mjs list-bikes | tail -n +3 | sort -t '₽' -k1 -n | head -3
```

(Внутри skill нет флага `--sort` по цене — это анти-функция. Используйте unix-pipeline.)

## Error Handling

| Stage                       | Reason                                          | Когда возникает                                                                | Exit | Что делать                                                                  |
|-----------------------------|-------------------------------------------------|--------------------------------------------------------------------------------|------|-----------------------------------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | Нет env-переменной, `--secrets` путь не читается, дефолтный путь недоступен    | 2    | Передать `--secrets <path>` или export env var                              |
| `type_invalid`              | `invalid type "<value>"`                        | `list-bikes --type bogus`                                                      | 2    | Использовать `bike` / `scooter` / `all`                                     |
| `date_invalid`              | `invalid date "<value>"`                        | `check-availability --date 2026/07/25`                                         | 2    | Использовать формат `YYYY-MM-DD`                                            |
| `bike_id_missing`           | `bikeId is required`                            | `bike-detail` / `bike-pricing` / `check-availability` без позиционного арг.   | 2    | Передать `<bikeId>` первым позиционным аргументом                            |
| `bike_not_found`            | `bike not found: <bikeId>`                      | Нет строки в `cars` с таким `id`                                               | 2    | Проверить `list-bikes` — какой у байка реальный `id`                        |
| `supabase_query_4xx`        | `Supabase public.<table> 4xx: <body>`           | Неверный select-список, RLS запретил, нет такой колонки                         | 2    | Проверить схему (см. раздел "Schema access")                                |
| `supabase_query_5xx`        | `Supabase public.<table> 5xx: <body>`           | Supabase лежит, rate-limit, timeout                                            | 2    | Повторить через минуту                                                       |
| `unknown_command`           | `unknown command "<value>"`                     | Опечатка в подкоманде                                                          | 2    | Запустить `--help` для списка команд                                         |

## Security / Compliance Rules

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) даёт полный read/write доступ ко всем таблицам, включая private-схему с ПДн клиентов. Никогда:
  - не коммитить ключ в git
  - не логировать ключ в stdout/stderr (скрипт не печатает его нигде)
  - не передавать ключ как URL-параметр (только header `apikey` / `Authorization: Bearer`)
  - не встраивать ключ в клиентский код (React/Next.js client bundle)
- Этот skill **не читает PII**: только `public.cars` (каталог ТС) и `public.rentals` (rental_id, vehicle_id, status, dates, user_id). Поля `passport_*_photo`, `drivers_licence_frontal_photo` из `rentals` НЕ запрашиваются в select-списке.
- Тем не менее `rentals.user_id` — это Telegram chat_id арендатора; в публичных логах / Telegram-чатах маскировать (например `4135XXXX77`).
- Скрипт полностью read-only: не делает `INSERT` / `UPDATE` / `PATCH` / `DELETE`. Только `GET` к PostgREST.
- Все HTTP-запросы идут через HTTPS. Не использовать plain HTTP proxy.
- Скрипт не сохраняет результаты запросов на диск. Вывод в stdout принадлежит вызывающей стороне.

## Integration with boss-mode / Telegram bot

Скрипт можно вызывать из Telegram-бота для ответов на запросы клиентов/операторов:

```
Клиент: "какие байки есть?"
Бот: exec `node catalog-query.mjs list-bikes`
     → вывод таблицы в Telegram-чат

Клиент: "сколько стоит Falcon Lynx на 3 дня?"
Бот: exec `node catalog-query.mjs bike-pricing falcon-lynx`
     → парсит tier "2–4 дня" → 7 500 ₽/день
     → отправляет: "3 дня = 22 500 ₽ + залог 30 000 ₽"

Оператор: "свободен ли Falcon Lynx 25 июля?"
Бот: exec `node catalog-query.mjs check-availability falcon-lynx --date 2026-07-25`
     → ✅ ДА / ❌ НЕТ с деталями блокирующей аренды
```

При интеграции с Telegram учитывать:
- Длинные таблицы (>4096 символов) разбивать на несколько сообщений или отправлять как файл.
- Image URLs из `list-bikes` отправлять как preview-фото в Telegram.
- Если каталог большой (>50 байков), рекомендовать фильтрацию по `--type`.

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID` захардкожены в `catalog-query.mjs` под `vip-bike`. Для другого crew — отредактировать константы в начале файла.

2. **Resource embedding not used**: Supabase REST `?select=...,crew:crews!inner(name,slug)` JOIN syntax не используется. Crew уже захардкожен — JOIN не нужен.

3. **`availability_rules` not auto-applied**: Правила `blackout_dates`, `season`, `notice_hours` выводятся как информация, но не блокируют automatically. Реальная блокировка — только через `rentals` таблицу со статусом `active`/`confirmed`. Это соответствует поведению production-CRM.

4. **`requested_*` dates only for overlap**: Если у rental пустые `requested_start_date` / `requested_end_date` (только `agreed_*`), запись не попадёт в блокирующий набор. Это редкий кейс — обычно заявка создаётся с `requested_*` сразу. Если нужно учитывать `agreed_*`, расширить фильтр через PostgREST `or` syntax.

5. **`is_test_result` filter is hardcoded**: `list-bikes` всегда добавляет `is_test_result=eq.false`. Если нужно показать test bikes — убрать фильтр в исходнике.

6. **No timezone conversion**: Все даты выводятся в ISO / UTC. Локализация в MSK (UTC+3) — на стороне вызывающего.

7. **Type filter exact match**: `--type bike` ищет `type = 'bike'` (case-sensitive). Если в БД есть `'Bike'` или `'BIKE'`, они не попадут в результат. Production-data для vip-bike использует lowercase.

8. **`specs` keys are case-sensitive**: `specs.rent_weekday` ≠ `specs.Rent_Weekday`. Если operator заполнил specs с разными casing'ом, скрипт выведет `—` в pricing table.

## Related Files

- **Script**: `catalog-query.mjs` (этот skill)
- **Sibling skills**:
  - `download/skills/leads-crm-text/SKILL.md` + `leads-query.mjs` — CRM-лиды (та же архитектура)
  - `download/skills/analytics-text/SKILL.md` — analytics (rentals/sales/todos dashboards, inline-`curl`)
  - `download/skills/vip-bike-ops/SKILL.md` — primary-agent super-skill, объединяющий все три
- **Schema migrations**:
  - `supabase/migrations/00000000000000_create_cars.sql` (или аналог) — `cars` table
  - `supabase/migrations/00000000000000_create_rentals.sql` (или аналог) — `rentals` table
  - Полный дамп схемы: `/home/z/my-project/upload/supabase.txt`
- **UI reference** (для справки, не используется скриптом):
  - `app/franchize/[slug]/catalog/CatalogClient.tsx` (если есть) — React UI каталога
  - `app/franchize/server-actions/catalog.ts` (если есть) — server actions
- **Crew constants**:
  - Crew slug: `vip-bike`
  - Crew ID: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
  - Секреты: `/home/z/my-project/upload/secrets.txt`
- **Schema source**: `/home/z/my-project/upload/supabase.txt` (полный CREATE TABLE дамп для `cars`, `rentals`, `users`, `crews`, `crew_members`, `crew_todos`, `franchize_intents`, `rental_contract_artifacts`, `user_rental_secrets`, `sale_contract_artifacts`)
