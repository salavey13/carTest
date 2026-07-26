---
name: catalog-adder-text
description: >
  Add new bikes / services / sale-items to the VIP Bike catalog (public.cars
  table) via Supabase REST API. Automates: image rename + upload to carpix
  bucket, specs JSON build, 11-tier price derivation, REST insert with correct
  crew_id / owner_id / type. Read commands: list-catalog, get-reference.
  Trigger phrases (RU): "добавь байк", "новый байк в каталог", "выложи байк",
  "загрузи байк", "добавь услугу", "новая услуга", "выстави на продажу байк",
  "добавь товар на продажу", "покажи каталог для добавления", "шаблон байка",
  "референс байка".
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

## When to Use

- Оператор прислал фото нового байка + параметры (марка, модель, базовая цена) → добавляем в каталог
- Нужно добавить сервисную услугу ( type=`service`) в каталог
- Нужно выставить байк на продажу ( specs.sale=true, type=`bike` или `sale_item`)
- Нужно посмотреть шаблон/референс существующего байка, чтобы скопировать структуру specs

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

## Commands

### 1. `add-bike <bikeId> --make <make> --model <model> --price <dailyPrice> [--sale] [--year YYYY] [--color ...] [--owner chatId] [--image-dir /path] [--features f1,f2]`

Добавляет байк в `public.cars` с `type=bike`, `specs.rent=true`. Флаг `--sale` добавляет `specs.sale=true` + `specs.sale_price`.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-bike \
  --id cbr-600rr-2010 \
  --make Honda --model "CBR 600RR" \
  --price 12000 \
  --year 2010 --color red \
  --features "ABS,Спортбайк,4-цил." \
  --image-dir /tmp/cbr-photos \
  --owner 356282674
```

Что делает:
1. Если `--image-dir` указан — копирует `*.jpg` в /tmp, переименовывает в `image_1.jpg`, `image_2.jpg`, ..., создаёт `image_1_4x3.jpg` (обрезка через ImageMagick, если доступен)
2. Загружает файлы в `carpix/{bikeId}/` через Storage API (`POST /storage/v1/object/carpix/{bikeId}/image_N.jpg`)
3. Считает 11 price tiers из `--price` (округление до 100₽)
4. Собирает `specs` JSON (make/model/year/color/features + все tiers + gallery URLs)
5. INSERT в `public.cars` через REST с `Prefer: return=representation`

### 2. `add-service <serviceId> --name <name> --price <price> [--description ...]`

Добавляет услугу с `type=service`. Цена — разовая (не суточная), tiers НЕ выводятся.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-service \
  --id svc-delivery \
  --name "Доставка байка" \
  --price 1500 \
  --description "Доставка по Нижнему Новгороду в пределах КАД"
```

### 3. `add-sale-item <bikeId> --make <make> --model <model> --price <salePrice> [--year YYYY] [--color ...] [--image-dir /path]`

Добавляет товар на продажу: `type=sale_item`, `specs.sale=true`, `specs.sale_price=<price>`. Без арендных tiers.

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh add-sale-item \
  --id cbr-600rr-2010-sale \
  --make Honda --model "CBR 600RR" \
  --price 310000 \
  --year 2010 --color red \
  --image-dir /tmp/cbr-photos
```

### 4. `list-catalog [--type bike|service|sale_item|all]`

Список существующих позиций (для проверки после добавления).

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh list-catalog --type bike
```

### 5. `get-reference <bikeId>`

Получить полный specs JSON существующего байка как шаблон (скопировать структуру, поменять значения).

```bash
bash ~/.claude/skills/catalog-adder-text/catalog-add.sh get-reference livewire-one
```

## Image conventions

- `image_1.jpg` — обложка (используется в `image_url` и первой в `gallery`)
- `image_2.jpg` ... `image_N.jpg` — галерея
- `image_1_4x3.jpg` — обложка 4:3 (для Авито; создаётся автоматически через ImageMagick, если доступен)

Public URL после загрузки:
`https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/{bikeId}/image_N.jpg`

## Anti-hallucination

- **НЕ выдумывать bikeId** — оператор даёт или выводим из make+model+year slug
- **НЕ выдумывать цены** — только то, что дал оператор (базовая цена + вычисленные tiers)
- **НЕ создавать байк с уже существующим id** — сначала проверить через `list-catalog` или SELECT
- **НЕ пушить в GitHub** без явного подтверждения оператора

## Related

- `franchize-catalog-text` — read-side (list, detail, pricing, availability)
- `vip-bike-ops` — umbrella router (раздел "Каталог")
- `commercial-proposal-from-offer` — КП для этих байков
