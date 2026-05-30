# Gold Standard Spec Schema — Electric Bikes

> Canonical spec-key mapping, category groups, data types, and comparator UI/UX guidance for the VIP BIKE electric bike catalog.  
> **v2** — updated with rental pricing fields and contract template integration keys.

---

## 1. Complete Label Map

Every `specs` JSONB object **MUST** include a `spec_labels` sub-object that maps each key present in the spec to its Russian display label. This allows the compare UI and stat cards to render localised headers without a separate i18n layer.

### 1.1 Identity & Classification

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `type` | Тип | identity | — | — |
| `year` | Год | identity | — | desc |
| `make` | Производитель | identity | — | — |
| `model` | Модель | identity | — | — |
| `bike_subtype` | Тип мотоцикла | identity | — | — |
| `brand_type` | Тип бренда | identity | — | — |
| `license_class` | Категория прав | identity | — | — |
| `color` | Цвет | identity | — | — |

### 1.2 Power & Dynamics

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `power_kw` | Пиковая мощность | power | кВт | desc |
| `motor_peak_kw` | Пиковая мощность мотора | power | кВт | desc |
| `motor_nominal_kw` | Номинальная мощность | power | кВт | desc |
| `motor_hp` | Мощность (л.с.) | power | л.с. | desc |
| `torque_nm` | Крутящий момент | power | Нм | desc |
| `torque_motor_nm` | Крутящий момент (мотор) | power | Нм | desc |
| `top_speed_kmh` | Макс. скорость | performance | км/ч | desc |
| `acceleration_0_50_s` | Разгон 0–50 км/ч | performance | с | asc |
| `acceleration_0_96_s` | Разгон 0–96 км/ч | performance | с | asc |
| `acceleration_0_100_s` | Разгон 0–100 км/ч | performance | с | asc |

### 1.3 Battery & Charging

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `range_km` | Запас хода | battery | км | desc |
| `range_eco_km` | Запас хода (Eco) | battery | км | desc |
| `range_mixed_km` | Запас хода (смешанный) | battery | км | desc |
| `range_offroad_km` | Запас хода (Off-road) | battery | км | desc |
| `range_100ah_km` | Запас хода (100Ah) | battery | км | desc |
| `range_120ah_km` | Запас хода (120Ah) | battery | км | desc |
| `battery` | Батарея | battery | — | — |
| `voltage_v` | Напряжение | battery | В | desc |
| `voltage_peak_v` | Пиковое напряжение | battery | В | desc |
| `charge_time_h` | Время зарядки | battery | ч | asc |
| `charging_a` | Зарядный ток | battery | А | desc |
| `charging_kw` | Мощность зарядки | battery | кВт | desc |
| `continuous_current_a` | Продолжительный ток | battery | А | desc |
| `battery_weight_kg` | Масса батареи | battery | кг | asc |

### 1.4 Chassis & Dimensions

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `weight_kg` | Масса | chassis | кг | asc |
| `max_load_kg` | Макс. нагрузка | chassis | кг | desc |
| `max_permissible_weight_kg` | Макс. допустимая масса | chassis | кг | — |
| `seat_height_mm` | Высота по седлу | chassis | мм | — |
| `ground_clearance_mm` | Дорожный просвет | chassis | мм | desc |
| `wheelbase_mm` | Колёсная база | chassis | мм | — |
| `dimensions_mm` | Габариты | chassis | мм | — |
| `rake_angle_deg` | Угол наклона вилки | chassis | ° | — |
| `max_climbing_angle_deg` | Макс. угол подъёма | chassis | ° | desc |

### 1.5 Drivetrain & Control

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `drive` | Привод | drivetrain | — | — |
| `transmission` | Трансмиссия | drivetrain | — | — |
| `controller_model` | Контроллер | drivetrain | — | — |
| `controller_phase_current_a` | Фазный ток контроллера | drivetrain | А | desc |

### 1.6 Wheels, Brakes, Frame, Suspension

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `tires_front` | Передняя резина | wheels | — | — |
| `tires_rear` | Задняя резина | wheels | — | — |
| `brake_type` | Тормоза | brakes | — | — |
| `frame_type` | Рама | frame | — | — |
| `suspension_type` | Подвеска | suspension | — | — |
| `suspension_front` | Передняя подвеска | suspension | — | — |
| `suspension_rear` | Задняя подвеска | suspension | — | — |

### 1.7 Sale Pricing

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `price_rub` | Цена | price | ₽ | asc | MSRP / list price (for compare display) |
| `sale_price` | Цена продажи | price | ₽ | asc | Actual selling price (may differ from price_rub with discounts) |
| `original_price_rub` | Старая цена | price | ₽ | — | Pre-discount price (shown strikethrough) |
| `discount_percent` | Скидка | price | % | desc | Current discount percentage |

> ⚠️ **Important:** `price_rub` and `sale_price` are **sale/purchase prices**, NOT rental daily rates. Do NOT use them as daily rental prices in contract generation.

### 1.8 Rental Pricing 🆕

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `dailyPrice` | Аренда (сутки) | rent | ₽/сутки | asc | **Primary daily rental rate.** Used by the contract skill as the first-choice daily price. Must be > 0 for rentable bikes. |
| `price_per_hour` | Аренда (час) | rent | ₽/час | asc | **Primary hourly rental rate.** Falls back to `dailyPrice / 8` if not set. Used when rental duration < 24h. |
| `rent_weekday` | Аренда (будни) | rent | ₽/сутки | asc | Weekday-specific daily rate. Some bikes have different weekday/weekend pricing. |
| `rent_weekend` | Аренда (выходные) | rent | ₽/сутки | asc | Weekend-specific daily rate. Typically 15–20% higher than weekday. |
| `rent_weekday_hour` | Аренда (будни, час) | rent | ₽/ч | asc | Weekday hourly rate (for bikes rented primarily by the hour, e.g. Y-VOLT Surge V). |
| `rent_weekend_hour` | Аренда (выходные, час) | rent | ₽/ч | asc | Weekend hourly rate. |
| `rent_price_label` | Аренда | rent | — | — | Human-readable label, e.g. "15 000 ₽/день" or "5 000 ₽/час (будни)". Used in UI cards. |

#### Rental pricing priority (contract skill lookup order):

```
bikeDailyPrice  = specs.dailyPrice  → specs.rent_weekday  → arg('dailyPrice', '10000')
bikeHourlyPrice = specs.price_per_hour → arg('hourlyPrice', dailyPrice / 8)
bikeValueRub    = specs.sale_price  → specs.price_rub     → arg('bikeValue', '850000')
```

#### Rate card examples from current catalog:

| Bike | `dailyPrice` | `price_per_hour` | `rent_weekday` | `rent_weekend` | Notes |
|---|---|---|---|---|---|
| Falcon GT | 12 000 | 1 500 | 12 000 | 14 000 | Standard daily bike |
| Falcon Pro | 12 000 | 1 500 | 12 000 | 14 000 | Same rate as GT |
| Horwin SK3+ | 10 000 | 1 250 | 10 000 | 12 000 | Most affordable |
| Sequence Zero | 15 000 | 1 875 | 15 000 | 18 000 | Premium sport |
| Y-VOLT Surge V | 40 000 | 5 000 | 40 000 | 48 000 | Premium enduro (hourly-primary: 5K/6K per hour) |
| Ducati Panigale S Electro | 10 000 | 1 250 | 10 000 | 12 000 | Entry-level sport replica |

### 1.9 Contract Template Integration 🆕

These keys are **computed** by `make-rental-contract-skill.mjs` and written to the `specs` JSONB in the seed CSV for traceability. They are NOT user-facing compare specs and should NOT be added to `spec_labels`.

| Key | Description | Source |
|---|---|---|
| `bike_engine_spec_line_1` | Contract п.1.2 line 1: "мощность двигателя (номинальная) N кВт" (electro) | Computed from `power_kw` |
| `bike_engine_spec_line_2` | Contract п.1.2 line 2: "максимальная конструктивная скорость N км/ч" | Computed from `top_speed_kmh` |
| `bike_engine_spec_line_3` | Contract п.1.2 line 3: "аккумулятор: тип/ёмкость ..." (electro) | Computed from `battery` |

### 1.10 Social & Warranty

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `rating` | Рейтинг | social | — | desc |
| `sold_count` | Продано | social | — | desc |
| `recommend_percent` | Рекомендация | social | % | desc |
| `warranty` | Гарантия | warranty | — | — |

---

## 2. Spec Categories (for grouped display)

The comparator and spec cards should group specs into visual sections. Each category has a Russian heading:

| Category key | Заголовок | Color accent | Icon suggestion |
|---|---|---|---|
| `identity` | Основные | muted | `Info` |
| `power` | Мощность и динамика | red/orange | `Zap` |
| `performance` | Динамика | orange | `Gauge` |
| `battery` | Батарея и зарядка | green | `Battery` |
| `chassis` | Размеры и масса | blue | `Ruler` |
| `drivetrain` | Трансмиссия | purple | `Cog` |
| `wheels` | Колёса | slate | `Circle` |
| `brakes` | Тормоза | red | `ShieldAlert` |
| `frame` | Рама | slate | `Box` |
| `suspension` | Подвеска | teal | `Waves` |
| `price` | Цена | gold | `Tag` |
| `rent` | Аренда | indigo | `Clock` |
| `social` | Отзывы и продажи | pink | `Star` |
| `warranty` | Гарантия | green | `ShieldCheck` |

### Display order within compare:

```
identity → power → performance → battery → chassis → drivetrain
→ suspension → brakes → wheels → frame → price → rent → social → warranty
```

---

## 3. Numeric Spec Bar Visualization

For specs with a numeric value + unit suffix, render a **horizontal bar** proportional to the max value across all compared bikes:

```
Key pattern:  {key}_bar_width_percent = (value / max_in_compare_set) * 100
```

### Bar color logic:
- **Higher is better** (power, range, speed, torque): green gradient, bar fills RIGHT
- **Lower is better** (weight, charge time, acceleration): blue gradient, bar fills LEFT (inverted)
- **Neutral** (seat height, dimensions): gray bar, no emphasis

### Inversion map (lower = better, bars fill left-to-right but colour is inverted):

| Key | Direction |
|---|---|
| `weight_kg` | lower is better |
| `charge_time_h` | lower is better |
| `acceleration_0_50_s` | lower is better |
| `acceleration_0_96_s` | lower is better |
| `acceleration_0_100_s` | lower is better |
| `price_rub` | lower is better |
| `sale_price` | lower is better |
| `price_per_hour` | lower is better |
| `dailyPrice` | lower is better |
| `rent_weekday` | lower is better |
| `rent_weekend` | lower is better |
| `rent_weekday_hour` | lower is better |
| `rent_weekend_hour` | lower is better |

All other numeric keys: **higher is better**.

---

## 4. Comparator UI/UX Improvements

### 4.1 Spec Card Component (`BikeSpecCard`)

Each bike in the compare view renders a vertical column. For each spec row:

1. Read `spec_labels[key]` for the row header (Russian label)
2. Format value with unit suffix from the table above
3. If numeric: render a proportional bar behind the value
4. Highlight the **winner** in each row (best value among compared bikes) with a subtle glow/badge

### 4.2 Winner Highlighting

```
For "higher is better" specs:  max value in row → green "●" badge + subtle ring
For "lower is better" specs:   min value in row → green "●" badge + subtle ring
For string specs:              no winner badge
```

### 4.3 Missing Spec Handling

If a bike lacks a key present in another compared bike:
- Show a dash `—` with a muted, empty bar
- This avoids N/A clutter and keeps the grid aligned

### 4.4 Range Variants (Eco / Mixed / Off-road)

When `range_eco_km`, `range_mixed_km`, `range_offroad_km` all exist, render a **mini stacked bar** or **3-segment bar** instead of 3 separate rows:

```
Eco ████████████████ 150 km
Mix ████████████     120 km
Off ██████            80 km
```

Same pattern for `range_100ah_km` / `range_120ah_km`.

### 4.5 Feature Tags

The `features` array should render as tag chips below the spec table. When comparing:
- Shared features → default style
- Unique to one bike → highlighted with accent border
- Missing vs. other → subtle/muted

### 4.6 Price Block

When `original_price_rub` and `discount_percent` exist:
- Show `original_price_rub` with ~~strikethrough~~
- Show `sale_price` in bold with discount badge (`-5%`)
- If only `price_rub` / `sale_price`: show single price

### 4.7 Rental Rate Block 🆕

When rental keys are present, show a **rental rate card**:

```
┌──────────────────────────┐
│  АРЕНДА                   │
│  Будни:  12 000 ₽/сутки   │
│  Выходные: 14 000 ₽/сутки │
│  Час:    1 500 ₽/час      │
└──────────────────────────┘
```

If `rent_price_label` exists, use it as the primary display string instead.

### 4.8 Buy Options (Trim Levels)

Render `buy_options` as a selectable radio group. When the user picks a trim:
- Recalculate `sale_price + priceDelta`
- Update the price block dynamically
- Show `subtitle` as helper text under each option

### 4.9 Color Variants

When `color_variants` exists, each color swatch should:
- Switch the gallery images to that variant's gallery
- Update the `image_url` (primary) to the first image of that variant
- Active swatch gets a ring matching `accentMain`

---

## 5. Data Contract

### Required fields (every electric bike MUST have):

```
type, year, drive, battery, power_kw, range_km, price_rub,
sale_price, weight_kg, bike_subtype, charge_time_h,
motor_peak_kw, motor_nominal_kw, top_speed_kmh, seat_height_mm,
spec_labels,
color, license_class
```

### Required rental fields (every rentable bike MUST have): 🆕

```
dailyPrice, price_per_hour, rent_weekday, rent_weekend
```

### Optional but encouraged:

```
torque_nm, ground_clearance_mm, tires_front, tires_rear,
brake_type, frame_type, suspension_type (or suspension_front + suspension_rear),
features, buy_colors, buy_options, gallery, color_variants
```

### Premium-tier additions (Surge V, Sequence Zero):

```
motor_hp, acceleration_0_96_s / acceleration_0_100_s,
range_eco_km, range_mixed_km, range_offroad_km,
voltage_v, dimensions_mm, warranty,
rent_price_label, rent_weekday_hour, rent_weekend_hour
```

---

## 6. Adding a New Electric Bike — Checklist

1. Collect specs from official source / dealer listing
2. Map every spec to the canonical key from the table above
3. **Set rental pricing:** `dailyPrice`, `price_per_hour`, `rent_weekday`, `rent_weekend` — these are mandatory for rentable bikes
4. Build `spec_labels` — include ONLY keys that exist in this bike's specs (include all rent category labels)
5. Add `gallery` array with all Supabase storage URLs
6. If multiple colors with separate gallery sets → add `color_variants`
7. Set `brand_type`: `official_reseller` | `official_website_data` | `dealer_data` | `community`
8. Set `source` URL for traceability
9. Set `type: "Electric"` (used by contract skill for ICE/electro detection)
10. Run the INSERT SQL (or add to `seed-bikes-full.sql`)
11. Verify in compare UI that all rows render correctly
12. Test contract generation with `make-rental-contract-skill.mjs`

---

## 7. File Reference

| File | Purpose |
|---|---|
| `cars_rows_7bikes_golden.csv` | Golden seed CSV for all 7 bikes (5 electro + 1 ICE + 1 electro replica) |
| `seed-bikes-full.sql` | Full idempotent seed (DELETE + INSERT) for all bikes |
| `gold-standard-electro-bike-spec-schema.md` | This document |
| `gold-standard-ice-bike-spec-schema.md` | ICE bike spec schema (companion document) |
| `RENTAL_DEAL_TEMPLATE.html` | Contract template with ~42 `{{mustache}}` placeholders |
| `make-rental-contract-skill.mjs` | Skill that fills template from bike specs + rental params |
