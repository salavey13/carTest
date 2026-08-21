---
name: catalog-adder-text
description: >
  Add new bikes / services / sale-items to the VIP Bike catalog (public.cars
  table) via Supabase REST API. Automates: image rename + upload to carpix
  bucket, specs JSON build, 11-tier price derivation, REST insert with correct
  crew_id / owner_id / type. Read commands: list-catalog, get-reference,
  find-reference. Trigger phrases (RU): "добавь байк", "новый байк в каталог",
  "выложи байк", "загрузи байк", "добавь услугу", "новая услуга",
  "выстави на продажу байк", "добавь товар на продажу", "покажи каталог для
  добавления", "шаблон байка", "референс байка".
  Trigger phrases (EN): "add bike", "add to catalog", "new bike", "upload bike",
  "add service", "add sale item", "list catalog for add", "bike template",
  "bike reference", "catalog adder".
---

# Catalog Adder (text) — VIP Bike

Триггер-фразы (RU): **`добавь байк`**, **`новый байк в каталог`**, **`выложи байк`**, **`загрузи байк`**, **`добавь услугу`**, **`новая услуга`**, **`выстави на продажу байк`**, **`добавь товар на продажу`**, **`покажи каталог для добавления`**, **`шаблон байка`**, **`референс байка`**.
Триггер-фразы (EN): `add bike`, `add to catalog`, `new bike`, `upload bike`, `add service`, `add sale item`, `list catalog for add`, `bike template`, `bike reference`, `catalog adder`.

## Overview

Write-side дополнение к `franchize-catalog-text` (который только читает). Этот skill:
1. Переименовывает фото оператора в стандартный формат (`image_N.jpg` + `image_1_4x3.jpg`)
2. Грузит их в Supabase Storage (`carpix/{bikeId}/`)
3. Собирает `specs` jsonb с правильными полями (rent/sale flags, gallery, features)
4. Считает 11 price tiers из базовой суточной цены
5. Вставляет строку в `public.cars` через REST API

Использует только `curl` + `jq`. Не требует Node.js / Next.js сборки.

## ⭐ Standard workflow (ВСЕГДА так)

Прежде чем вставлять байк, пройди эти шаги по порядку — экономит минуты и снижает риск ошибок в `specs`.

### 1. Найди reference (ближайший похожий байк)
Если добавляешь байк существующей серии/марки — сначала найди reference, чтобы скопировать структуру `specs` (включая `spec_labels`, `buy_colors`, `buy_options`, `bike_engine_spec_line_*`):

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh find-reference falcon
# или по id
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh get-reference falcon-pro-2025
```

Real references (проверенные структуры):
- **Электро-эндуро 79BIKE**: `falcon-pro-2025`, `falcon-gt-2025`, `falcon-lite-2026` — richest specs (spec_labels, buy_colors, buy_options, bike_engine_spec_line_*)
- **Электро-круизер**: `livewire-one`, `y-volt-surge-v` — Harley-style
- **Спорт**: `yamaha-r7`, `kawasaki-ex650k`, `suzuki-gsx-s1000f`
- **Кастом**: `ural-bobber`

### 2. Вытащи спеки с сайта производителя
Если оператор дал URL или назвал марку+модель — используй `WebFetch` для официального сайта. **Не выдумывай мощность/батарею/скорость** — гугли или читай source URL.

```
WebFetch(url="https://falcon-bike.ru/falcon_lite",
        prompt="Extract all tech specs: power, battery, range, top speed, weight, charge time, suspension, brakes, dimensions, tires, color options, marketing features.")
```

Также — если на странице есть расхождение (например battery 30Ah в тексте vs 35Ah в spec table) — выбери значение из более формальной секции (spec table) и укажи оператору на расхождение в ответе.

### 3. Собери `specs` JSON
Структура для **продажи-и-аренды** (electric enduro — richest): смотри reference `falcon-pro-2025`.

Структура для **только продажа** (rent=0): убери `dailyPrice`, `price_per_*`, `rent_*` — оставь `sale`, `sale_price`, `price_rub`, `original_price_rub`, `discount_percent`, `bike_engine_spec_line_*`.

**❗ Обязательно для каждого ключа в `specs` создай запись в `spec_labels`** — иначе UI не покажет русскую подпись поля. Скопируй `spec_labels` из reference и дополни своими ключами.

### 4. Загрузи фото + вставь row
```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-bike \
  --id falcon-lite-2026 \
  --make 79BIKE --model "Falcon Lite" \
  --sale-only --sale-price 280000 \
  --year 2026 --color "Чёрный" \
  --description "Компактный электробайк..." \
  --source-url "https://falcon-bike.ru/falcon_lite" \
  --specs-file /tmp/falcon-lite-specs.json \
  --image-dir /tmp/falcon-lite-photos \
  --features "3 режима мощности (Sport / Drive / Eco),Кроссовая подвеска с ходом 200 мм"
```

### 5. Проверь
```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh get-reference falcon-lite-2026
```
Открыть в браузере: `https://vip-bike.ru/rent/falcon-lite-2026` (или на фронте каталога `/franchize/vip-bike`).

### 5b. ⚠️ VIP-BIKE RENTAL ALLOWLIST — обязательный шаг для rent-режима

Если байк добавляется в экипаж `vip-bike` и должен отображаться в **rent-режиме** каталога
(`/franchize/vip-bike` или `rental.vip-bike.ru`), его `id` нужно добавить в **allowlist**
в файле `lib/vip-bike-rental-catalog.ts` (маппинг `VIP_BIKE_RENTAL_CATALOG`).

**Без этого шага байк будет в БД, но НЕ появится в каталоге** — фильтр `buildVipBikeRentalCatalog`
проходит по allowlist'у и дропает всё, чего там нет.

```ts
// lib/vip-bike-rental-catalog.ts — добавить запись по алфавиту в свою секцию (electric/petrol):
"<bike-id>": {
  title: "<Human-readable title>",
  pricePerDay: <суточная цена в ₽>,  // должна совпадать с cars.daily_price
  segment: "electric" | "petrol",   // electric = электро, petrol = ДВС
  weekendPrice: <опц.>,             // только если отличается
},
```

**Когда НЕ нужно добавлять в allowlist:**
- Sale-only байки (rent=0) — они показываются в sale-режиме, allowlist не нужен
- Байки других экипажей (не vip-bike) — allowlist применяется только к vip-bike
- Сервисы / equipment — они не проходят через `buildVipBikeRentalCatalog`

**Что проверить:**
- ✅ `pricePerDay` в allowlist совпадает с `cars.daily_price` (иначе клиент увидит цену из allowlist'а)
- ✅ `segment` правильный (electric/petrol) — иначе фильтр по propulsion сломается
- ✅ Commit + push (файл либный, не в БД)

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /opt/claudeclaw/vip-bike/.env | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
STORAGE_BUCKET="carpix"

OP_OWNER=356282674        # I_O_S_NN — default owner_id для новых байков

HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Content-Type: application/json")
```

## Schema (top-level columns of `public.cars`)

Только эти поля — top-level колонки. **Всё остальное (year, color, gallery, source, sale_price, all price tiers, features, spec_labels) лежит внутри `specs` jsonb.**

| Column | Type | Notes |
|---|---|---|
| `id` | text | bikeId slug, unique. Convention: `{make-model}-{year}` (e.g. `falcon-pro-2025`) |
| `make` | text | Производитель. Casing как в каталоге: `79BIKE`, `Y-Volt`, `Honda` |
| `model` | text | Модель. `Falcon Pro`, `Surge V` |
| `description` | text | Полное русское описание (для карточки байка). ~3-5 предложений |
| `daily_price` | int | Базовая суточная цена аренды в ₽. Для sale-only = 0 |
| `image_url` | text | URL обложки. = `specs.gallery[0]` |
| `rent_link` | text | `/rent/{bikeId}` |
| `is_test_result` | bool | всегда `false` для боевых байков |
| `specs` | jsonb | см. ниже |
| `owner_id` | text | chatId оператора-владельца (default `356282674`) |
| `type` | text | `bike` / `service` / `sale_item` / `parts` / `accessory` |
| `crew_id` | uuid | `2d5fde70-1dd3-4f0d-8d72-66ccf6908746` для vip-bike |
| `availability_rules` | jsonb | `{}` для обычных байков |
| `quantity` | int | обычно `1` |

**❌ `year`, `gallery`, `color`, `image_url`, `rent_link` — НЕ топ-level колонки.** Только что указано в таблице. `year` и `color` живут в `specs`.

## `specs` jsonb structure

Минимальный набор:
```json
{
  "rent": 1,                    // 1 = есть аренда, 0 = sale-only
  "sale": true,                 // true = доступен к покупке
  "sale_price": 280000,         // Цена продажи в ₽ (если sale=true)
  "price_rub": 280000,          // Дублирующее поле для UI "Цена"
  "type": "Electric",           // Electric / Gas / Hybrid
  "year": "2026",
  "color": "Чёрный",
  "source": "https://...",      // URL страницы со спеками (для верификации)
  "gallery": ["https://.../image_1.jpg", "..."],
  "features": ["...", "..."],
  "hidden": false
}
```

Rich electric enduro (см. `falcon-pro-2025`):
```json
{
  "rent": 1, "sale": true,
  "subtitle": "Falcon Lite 2026",
  "bike_subtype": "Electric Enduro",
  "battery": "72V 30Ah (NMC, M50LT)",
  "power_kw": "8",              // peak
  "motor_peak_kw": "8",
  "motor_nominal_kw": "3.9",
  "torque_nm": "340",
  "voltage_v": "72",
  "range_km": "80",
  "top_speed_kmh": "85",
  "weight_kg": "63",
  "seat_height_mm": "830",
  "charge_time_h": "3-4",
  "brake_type": "Гидравлические дисковые",
  "frame_type": "Алюминиевая",
  "suspension_type": "Перевернутая вилка (200 мм) + задний моноамортизатор (85 мм)",
  "tires_front": "70/100-19",
  "tires_rear": "90/90-18",
  "license_class": "М (49 сс), подходят права В или А1",
  "brand_type": "official_reseller",
  "access_tier": "entry",       // entry / mid / pro
  "buy_colors": [{"id": "black", "hex": "#111111", "label": "Чёрный"}],
  "buy_options": [{"id": "standard", "label": "Стандарт", "subtitle": "...", "priceDelta": 0}],
  "original_price_rub": 330000, // для скидки
  "discount_percent": 15,
  "bike_engine_spec_line_1": "мощность двигателя (пиковая) 8 кВт",
  "bike_engine_spec_line_2": "максимальная конструктивная скорость 85 км/ч",
  "bike_engine_spec_line_3": "аккумулятор: тип/ёмкость 72V 30Ah (NMC, M50LT)",
  "spec_labels": {              // ❗ каждый ключ выше должен иметь русский лейбл
    "type": "Тип",
    "year": "Год",
    "color": "Цвет",
    "power_kw": "Макс. мощность",
    "...": "..."
  },
  "dailyPrice": 0,              // 0 для sale-only, иначе базовая суточная
  "price_per_hour": 0,          // tiers пропускаются для sale-only
  "rent_weekday": 0
}
```

## Price tier derivation (11 tiers)

Из базовой суточной цены (`daily_price`) выводятся все остальные. Коэффициенты зафиксированы в spec; в реальных данных (livewire-one vs bmw-f800r) они слегка отличаются — эти значения по умолчанию можно переопределить флагами.

| Tier | Коэффициент | Пример (base=10000) |
|---|---|---|
| `price_per_hour`     | × 0.4  | 4 000 |
| `price_per_2h`       | × 0.6  | 6 000 |
| `price_per_3h`       | × 0.75 | 7 500 |
| `price_per_6h`       | × 0.8  | 8 000 |
| `price_per_12h`      | × 0.9  | 9 000 |
| `rent_weekday`       | × 1.0  | 10 000 |
| `rent_weekday_hour`  | × 0.4  | 4 000 |
| `rent_weekend`       | × 1.25 | 12 500 |
| `rent_weekend_hour`  | × 0.5  | 5 000 |
| `rent_2_4d`          | × 0.8  | 8 000 |
| `rent_5_10d`         | × 0.65 | 6 500 |
| `rent_11_30d`        | × 0.6  | 6 000 |

Округление до 100₽. Пропускаются для `--sale-only`.

## Commands

### 1. `add-bike` — аренда, продажа, или оба

Самый гибкий режим. `type=bike`. Поддерживает полный спектр: аренда-only, продажа-only, аренда+продажа.

```bash
# Аренда + продажа
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-bike \
  --id cbr-600rr-2010 \
  --make Honda --model "CBR 600RR" \
  --price 12000 \
  --sale --sale-price 310000 \
  --year 2010 --color red \
  --features "ABS,Спортбайк,4-цил." \
  --image-dir /tmp/cbr-photos \
  --owner 356282674

# Только продажа (rent=0, daily_price=0, no rent tiers)
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-bike \
  --id falcon-lite-2026 \
  --make 79BIKE --model "Falcon Lite" \
  --sale-only --sale-price 280000 \
  --year 2026 --color "Чёрный" \
  --description "Компактный электробайк 79BIKE Falcon Lite 2026..." \
  --source-url "https://falcon-bike.ru/falcon_lite" \
  --specs-file /tmp/falcon-lite-specs.json \
  --image-dir /tmp/falcon-lite-photos

# Только аренда (без sale)
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-bike \
  --id y-volt-surge-v \
  --make "Y-Volt" --model "Surge V" \
  --price 8000
```

Флаги:
- `--id <slug>` — bikeId (если не указан, выводится из make-model-year)
- `--make` / `--model` — **обязательные**
- `--price <₽>` — суточная цена аренды (обязателен, кроме `--sale-only`)
- `--sale` — помечает `specs.sale=true`, требует `--sale-price`
- `--sale-only` — `specs.rent=0`, `daily_price=0`, tiers пропускаются. Требует `--sale-price`
- `--sale-price <₽>` — цена продажи
- `--year`, `--color` — попадают в `specs`
- `--features "f1,f2,f3"` — список features через запятую
- `--description "<text>"` — полное русское описание для карточки
- `--source-url <url>` — сохраняется в `specs.source` для верификации
- `--specs-file <path>` — JSON-файл с дополнительными/override полями `specs` (deep-merge поверх defaults). Используй для rich-структур (spec_labels, buy_colors, bike_engine_spec_line_*, и т.д. — обычно копируется из reference и правится)
- `--image-dir <path>` — папка с фото (`.jpg`/`.jpeg`/`.png`/`.webp`)
- `--owner <chatId>` — default `356282674` (I_O_S_NN)

Что делает:
1. Если `--image-dir` — копирует файлы, переименовывает в `image_N.jpg`, создаёт `image_1_4x3.jpg` (ImageMagick, fallback Python/Pillow, иначе пропускает)
2. Загружает в `carpix/{bikeId}/` через Storage API
3. Если не sale-only и price>0 — считает 11 tiers
4. Если `--specs-file` — deep-merge
5. INSERT с `Prefer: return=representation`, возвращает вставленный row

### 2. `add-service` — услуги (type=service)

Цена — разовая, tiers НЕ выводятся.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-service \
  --id svc-delivery \
  --name "Доставка байка" \
  --price 1500 \
  --description "Доставка по Нижнему Новгороду в пределах КАД"
```

### 3. `add-sale-item` — устаревший алиас для sale-only

Используй лучше `add-bike --sale-only` — он даёт больше контроля (`type=bike`, не `sale_item`, и поддерживает `--specs-file`). `add-sale-item` оставлен для обратной совместимости, ставит `type=sale_item`.

### 4. `list-catalog [--type bike|service|sale_item|all]`

Список позиций экипажа (с rent/sale флагами).

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh list-catalog --type bike
```

### 5. `get-reference <bikeId>`

Полный row (id, make, model, daily_price, description, specs) существующего байка как шаблон.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh get-reference falcon-pro-2025
```

### 6. `find-reference <partial>` ⭐ NEW

Поиск по partial id или make/model (case-insensitive). Используй ПЕРВЫМ шагом — найдёт серию байков и их id'шники.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh find-reference falcon
# или
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh find-reference honda
```

## Image conventions

- `image_1.jpg` — обложка (используется в `image_url` и первой в `gallery`)
- `image_2.jpg` ... `image_N.jpg` — галерея
- `image_1_4x3.jpg` — обложка 4:3 для Авито. Создаётся автоматически:
  1. ImageMagick `convert` (если есть)
  2. Python `Pillow` (если есть)
  3. Иначе пропускается — основной каталог работает без неё

В текущем окружении (vip-bike bot) **ImageMagick недоступен** — если Python/Pillow нет, `image_1_4x3.jpg` не создаётся. Это нормально для каталога; для Авито-выгрузки потом досоздаётся вручную.

Public URL после загрузки:
`https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/{bikeId}/image_N.jpg`

## bikeId naming convention

- Серийные байки одного производителя — **суффикс года**: `falcon-pro-2025`, `falcon-gt-2025`, `falcon-lite-2026`
- Уникальные — без года: `y-volt-surge-v`, `livewire-one`, `ural-bobber`
- Sale-only варианты — суффикс `-sale`: `cbr-600rr-2010-sale`
- Slug: lowercase, kebab-case, без кириллицы

## Anti-hallucination

- **НЕ выдумывать bikeId** — оператор даёт или выводим из make+model+year slug
- **НЕ выдумывать цены** — только то, что дал оператор (базовая цена + вычисленные tiers)
- **НЕ выдумывать спеки** — гугли/читай официальный сайт (`WebFetch`). `source` URL сохраняй в `specs.source` для верификации
- **НЕ создавать байк с уже существующим id** — `add-bike` проверяет автоматически (409), но лучше сначала `find-reference`
- **НЕ плодить ключи без `spec_labels`** — каждый ключ в `specs` должен иметь русский лейбл в `spec_labels`, иначе UI покажет техническое имя поля
- **НЕ пушить в GitHub** без явного подтверждения оператора

## Related

- `franchize-catalog-text` — read-side (list, detail, pricing, availability)
- `vip-bike-ops` — umbrella router (раздел "Каталог")
- `commercial-proposal-from-offer` — КП для этих байков
