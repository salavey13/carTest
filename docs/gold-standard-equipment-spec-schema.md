# Gold Standard Spec Schema — Equipment

> Canonical spec-key mapping, categories, data types, and display rules for equipment items in the VIP BIKE catalog.
> **v2** — updated with Russian label requirements, sale pricing, and 21-item batch from PDF inventory.

---

## CRITICAL: Russian Labels

All display-facing values (category labels, badge labels, spec_labels values, features, colors, sizes, materials, description) MUST be in **Russian**. The `specs.category` field uses English keys (e.g. `"jacket"`) for internal logic, but the catalog displays Russian labels via `EQUIPMENT_CATEGORY_LABELS` mapping in `actions-runtime.ts`.

| English key (specs.category) | Russian label (displayed) |
|---|---|
| `helmet` | Шлемы |
| `jacket` | Куртки |
| `pants` | Штаны |
| `gloves` | Перчатки |
| `boots` | Боты |
| `security` | Безопасность |
| `electronics` | Электроника |
| `suit` | Комбинезоны |

The `spec_labels` sub-object maps each spec key to its Russian display label. Example:
```json
"spec_labels": {
  "category": "Категория",
  "badge": "Бейдж",
  "brand": "Бренд",
  "material": "Материал",
  "sizes": "Размеры",
  "colors": "Цвета",
  "features": "Особенности"
}
```

---

## 1. Overview

Equipment items are stored in `public.cars` with `type = 'equipment'`. They appear in the catalog under the "Экипировка" tab, using the same `CatalogClient` and `ItemModal` as bikes.

Equipment items are **rentable accessories** — helmets, jackets, pants, gloves, boots, locks, communicators. They are rented alongside bikes and have their own daily price.

### Key differences from bikes

| Aspect | Bikes | Equipment |
|---|---|---|
| `type` column | `"bike"` | `"equipment"` |
| `specs.type` | `"Electric"` or `"ICE"` | (not used — equipment has no propulsion type) |
| `specs.rent` | `1` / `true` | (not set — equipment is always rentable when `daily_price > 0`) |
| `specs.sale` | `1` / `true` | (not set — equipment is rental-only) |
| `specs.license_class` | Required | (not applicable) |
| `specs.category` | (not used) | **Required** — determines icon + filter |
| `specs.spec_labels` | Required dict | Optional (equipment has simpler specs) |
| `image_url` | Required | Should be set (currently missing on all items — needs fixing) |

---

## 2. Required Fields

Every equipment item MUST have:

| Field | Type | Location | Description |
|---|---|---|---|
| `id` | string | `cars.id` | Unique slug, format: `equip-{category}-{brand}-{model}` (e.g. `equip-helmet-street-pro`) |
| `make` | string | `cars.make` | Brand name (e.g. `"MT"`) |
| `model` | string | `cars.model` | Model name (e.g. `"Street Pro"`) |
| `description` | string | `cars.description` | 1–3 sentence description in Russian |
| `daily_price` | integer | `cars.daily_price` | Daily rental price in rubles (e.g. `500` for most items, `1000` for helmets) |
| `image_url` | string | `cars.image_url` | Main product image URL (Supabase storage public URL) |
| `type` | string | `cars.type` | Must be `"equipment"` |
| `crew_id` | uuid | `cars.crew_id` | Crew ID that owns this equipment |
| `specs.category` | string | `cars.specs` JSONB | Category key (see §3 below) |
| `specs.badge` | string | `cars.specs` JSONB | Badge label (see §4 below) |

---


## 2a. Operational Keys (salary / subrenter) 🆕

Equipment items also participate in salary bonuses and partner (subrent) flows. These keys live in `specs` JSONB, are NOT user-facing and must NOT appear in `spec_labels`:

| Key | Description |
|---|---|
| `salary` | Salary/bonus classification: `{ tier, subrented, rentalCategory, saleCategory, dailyPriceAtSet, setAt }`. Equipment bonuses use flat rates from `crews.metadata.franchize.salaryCoefficients` (`equipmentRentalUnit` for rentals, `equipmentSale.{helmet, balaclava, jacket, pants, gloves}` for sales). Written by `scripts/apply-salary-specs.mjs`. |
| `subrenter_chat_id` | Telegram chat id of the partner owner (mini admin) — same semantics as bikes: read access to rentals of his units. Plus audit keys `subrenter_set_at` / `subrenter_set_by`. Managed from the crew admin page. |

`last_known_odometer` does NOT apply to equipment (no odometer).

## 3. Categories

The `specs.category` field determines the icon, filter group, and display section. Must be one of:

| Category key | Russian label | Icon | Description |
|---|---|---|---|
| `helmet` | Шлемы | 🪖 | Motorcycle helmets (full-face, modular, etc.) |
| `jacket` | Куртки | 🧥 | Motorcycle jackets (textile, leather, enduro) |
| `pants` | Штаны | 👖 | Motorcycle pants (enduro, touring) |
| `gloves` | Перчатки | 🧤 | Motorcycle gloves (summer, winter, enduro) |
| `boots` | Боты | 👢 | Motorcycle boots (touring, sport, enduro) |
| `security` | Безопасность | 🔒 | Locks, alarms, chains |
| `electronics` | Электроника | 📡 | Communicators, intercoms, chargers |

---

## 4. Badges

The `specs.badge` field shows a small label on the card. Must be one of:

| Badge key | Russian label | Color | Description |
|---|---|---|---|
| `bestseller` | Хит продаж | Gold | Most popular item |
| `essential` | Обязательно | Red | Required for safe riding |
| `versatile` | Универсально | Blue | Good for multiple use cases |
| `tech` | Технологично | Cyan | Advanced electronics |
| `security` | Безопасность | Orange | Security equipment |

Optional: `specs.badge_color` can override the badge color with a hex value (e.g. `"#f59e0b"`).

---

## 5. Complete Spec Key Map

### 5.1 Identity & Classification

| Key | Russian label | Type | Required | Description |
|---|---|---|---|---|
| `category` | Категория | string | ✅ | One of the category keys from §3 |
| `badge` | Бейдж | string | ✅ | One of the badge keys from §4 |
| `badge_color` | Цвет бейджа | string (hex) | ❌ | Override badge color |
| `brand` | Бренд | string | ❌ | Brand/manufacturer |
| `collection` | Коллекция | string | ❌ | Collection name (e.g. "Trail 2024") |

### 5.2 Sizing & Colors

| Key | Russian label | Type | Description |
|---|---|---|---|
| `sizes` | Размеры | array of strings | Available sizes (e.g. `["S", "M", "L", "XL"]` or `["EU 40-46"]`) |
| `colors` | Цвета | array of strings | Available colors (e.g. `["Чёрный", "Белый"]`) |
| `season` | Сезон | string | `"summer"`, `"winter"`, `"all-season"` |

### 5.3 Features & Materials

| Key | Russian label | Type | Description |
|---|---|---|---|
| `features` | Особенности | array of strings | Key features (e.g. `["Влагостойкость", "Съёмная подкладка"]`) |
| `materials` | Материалы | string | Primary material (e.g. `"Текстиль"`, `"Кожа"`, `"ABS-пластик"`) |
| `protection` | Защита | string | Protection level/details (e.g. `"CE Level 2"`) |

### 5.4 Category-Specific Specs

| Key | Russian label | Type | Categories | Description |
|---|---|---|---|---|
| `safety` | Безопасность | string | helmet | Safety rating (e.g. `"ECE 22.06"`, `"DOT"`) |
| `battery` | Батарея | string | electronics | Battery specs (e.g. `"Li-Ion 1200mAh"`) |
| `compatibility` | Совместимость | string | electronics, security | What it works with |
| `water_resistance` | Влагозащита | string | electronics | IP rating or description |

---

## 6. spec_labels (Optional)

Equipment items CAN include a `spec_labels` sub-object (like bikes), but it's optional. If present, it maps each spec key to its Russian display label:

```json
"spec_labels": {
  "category": "Категория",
  "badge": "Бейдж",
  "sizes": "Размеры",
  "colors": "Цвета",
  "features": "Особенности",
  "materials": "Материалы"
}
```

If `spec_labels` is absent, the labels from §5 are used as defaults.

---

## 7. Complete Example

Here's a complete equipment item spec for a helmet:

```json
{
  "id": "equip-helmet-street-pro",
  "make": "MT",
  "model": "Street Pro",
  "description": "Шлем с визором и солнцезащитной кассетой. ABS-пластик, съёмный подшлемник.",
  "daily_price": 1000,
  "image_url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/equip-helmet-street-pro/image_1.jpg",
  "type": "equipment",
  "crew_id": "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
  "specs": {
    "category": "helmet",
    "badge": "bestseller",
    "badge_color": "#f59e0b",
    "brand": "MT",
    "collection": "Street 2024",
    "sizes": ["S", "M", "L", "XL"],
    "colors": ["Чёрный", "Белый"],
    "safety": "ECE 22.06",
    "features": [
      "Встроенный солнцезащитный визор",
      "Съёмный подшлемник",
      "Быстросъёмная застёжка"
    ],
    "materials": "ABS-пластик",
    "gallery": [
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/equip-helmet-street-pro/image_1.jpg"
    ],
    "spec_labels": {
      "category": "Категория",
      "badge": "Бейдж",
      "sizes": "Размеры",
      "colors": "Цвета",
      "safety": "Сертификация",
      "features": "Особенности",
      "materials": "Материал"
    }
  }
}
```

---

## 8. Catalog Display Rules

Equipment items are displayed in the catalog when:
1. `cars.type = 'equipment'` — included in `catalogTypes` in `actions-runtime.ts`
2. `hasEquipmentPrice(item)` returns `true` — checks `item.type === "equipment"`
3. `displayMode === "equipment"` — set by `DisplayModeProvider lockMode="equipment"` on the equipment page

Equipment items are **excluded** from:
- Аренда tab (via `hasRentPrice` guard: `if (hasEquipmentPrice(item)) return false`)
- Продажа tab (via `hasSalePrice` guard: `if (hasEquipmentPrice(item)) return false`)
- Сервис tab (equipment is not a service)

---

## 9. Adding New Equipment

### Via Admin Page

1. Go to `/franchize/vip-bike/admin`
2. Click "Добавить запись"
3. Select type: **Equipment**
4. Fill in make, model, description, daily_price
5. In specs JSON builder, include at minimum:
   - `category` (required — determines icon + filter)
   - `badge` (required — shows label on card)
   - `features` (array of strings)
   - `sizes` (array of strings, if applicable)
   - `colors` (array of strings, if applicable)
6. Upload image to Supabase storage, set `image_url`

### Via Supabase REST API (script)

```bash
curl -X POST "https://inmctohsodgdohamhzag.supabase.co/rest/v1/cars" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "equip-helmet-new-model",
    "make": "BrandName",
    "model": "Model Name",
    "description": "Описание на русском.",
    "daily_price": 500,
    "image_url": "https://...",
    "type": "equipment",
    "crew_id": "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
    "specs": {
      "category": "helmet",
      "badge": "essential",
      "features": ["Feature 1", "Feature 2"],
      "sizes": ["S", "M", "L"],
      "colors": ["Чёрный"]
    }
  }'
```

---

## 10. Known Issues (as of 2026-08-17)

1. **Missing `image_url`** — all 7 equipment items have empty `image_url`. Need to upload product images to Supabase storage and update.

2. **Missing `spec_labels`** — all 7 items have `spec_labels: null`. Optional but recommended for proper display.

3. **Missing `gallery`** — no equipment items have a `gallery` array in specs. Add for multi-image display.

4. **No `rent` flag** — equipment items don't have `specs.rent` set. This is by design (equipment is always rentable when `daily_price > 0`), but `hasRentPrice` explicitly excludes equipment via the `hasEquipmentPrice` guard.

---

## 11. Related Files

- **Bike spec schemas**: `docs/gold-standard-ice-bike-spec-schema.md`, `docs/gold-standard-electro-bike-spec-schema.md`
- **Catalog filtering**: `app/franchize/lib/catalog-utils.ts` (`hasEquipmentPrice`)
- **Catalog display**: `app/franchize/components/CatalogClient.tsx`
- **Item modal**: `app/franchize/modals/Item.tsx`
- **Admin form**: `components/CarSubmissionForm.tsx` (type="equipment" option)
- **Equipment page**: `app/franchize/[slug]/equipment/page.tsx`
- **Seed migration**: `supabase/migrations/20260812000006_seed_equipment.sql`
