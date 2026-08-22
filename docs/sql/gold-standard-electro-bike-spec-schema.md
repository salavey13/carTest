# Gold Standard Spec Schema — Electric Bikes

> Canonical spec-key mapping, category groups, data types, and comparator UI/UX guidance for the VIP BIKE electric bike catalog.

---

## 1. Complete Label Map

Every `specs` JSONB object **MUST** include a `spec_labels` sub-object that maps each key present in the spec to its Russian display label. This allows the compare UI and stat cards to render localised headers without a separate i18n layer.

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `type` | Тип | identity | — | — |
| `year` | Год | identity | — | desc |
| `make` | Производитель | identity | — | — |
| `model` | Модель | identity | — | — |
| `bike_subtype` | Тип мотоцикла | identity | — | — |
| `brand_type` | Тип бренда | identity | — | — |
| `license_class` | Категория прав | identity | — | — |
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
| `weight_kg` | Масса | chassis | кг | asc |
| `max_load_kg` | Макс. нагрузка | chassis | кг | desc |
| `max_permissible_weight_kg` | Макс. допустимая масса | chassis | кг | — |
| `battery_weight_kg` | Масса батареи | chassis | кг | asc |
| `seat_height_mm` | Высота по седлу | chassis | мм | — |
| `ground_clearance_mm` | Дорожный просвет | chassis | мм | desc |
| `wheelbase_mm` | Колёсная база | chassis | мм | — |
| `dimensions_mm` | Габариты | chassis | мм | — |
| `rake_angle_deg` | Угол наклона вилки | chassis | ° | — |
| `max_climbing_angle_deg` | Макс. угол подъёма | chassis | ° | desc |
| `drive` | Привод | drivetrain | — | — |
| `transmission` | Трансмиссия | drivetrain | — | — |
| `controller_model` | Контроллер | drivetrain | — | — |
| `controller_phase_current_a` | Фазный ток контроллера | drivetrain | А | desc |
| `tires_front` | Передняя резина | wheels | — | — |
| `tires_rear` | Задняя резина | wheels | — | — |
| `brake_type` | Тормоза | brakes | — | — |
| `frame_type` | Рама | frame | — | — |
| `suspension_type` | Подвеска | suspension | — | — |
| `suspension_front` | Передняя подвеска | suspension | — | — |
| `suspension_rear` | Задняя подвеска | suspension | — | — |
| `price_rub` | Цена | price | ₽ | asc |
| `sale_price` | Цена продажи | price | ₽ | asc |
| `original_price_rub` | Старая цена | price | ₽ | — |
| `discount_percent` | Скидка | price | % | desc |
| `rating` | Рейтинг | social | — | desc |
| `sold_count` | Продано | social | — | desc |
| `recommend_percent` | Рекомендация | social | % | desc |
| `warranty` | Гарантия | warranty | — | — |
| `rent_price_label` | Аренда | rent | — | — |
| `rent_weekday_hour` | Аренда (будни) | rent | ₽/ч | asc |
| `rent_weekend_hour` | Аренда (выходные) | rent | ₽/ч | asc |

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
| `social` | Отзывы и продажи | pink | `Star` |
| `warranty` | Гарантия | green | `ShieldCheck` |
| `rent` | Аренда | indigo | `Clock` |

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

### 4.7 Buy Options (Trim Levels)

Render `buy_options` as a selectable radio group. When the user picks a trim:
- Recalculate `sale_price + priceDelta`
- Update the price block dynamically
- Show `subtitle` as helper text under each option

### 4.8 Color Variants

When `color_variants` exists, each color swatch should:
- Switch the gallery images to that variant's gallery
- Update the `image_url` (primary) to the first image of that variant
- Active swatch gets a ring matching `accentMain`

---

## 5. Data Contract

### Required fields (every bike MUST have):

```
type, year, drive, battery, power_kw, range_km, price_rub,
sale_price, weight_kg, bike_subtype, charge_time_h,
motor_peak_kw, motor_nominal_kw, top_speed_kmh, seat_height_mm,
spec_labels
```

### Optional but encouraged:

```
torque_nm, ground_clearance_mm, tires_front, tires_rear,
brake_type, frame_type, suspension_type (or suspension_front + suspension_rear),
features, buy_colors, buy_options, gallery, color_variants
```

### Premium-tier additions (Surge V, Seqvens Zero):

```
motor_hp, acceleration_0_96_s / acceleration_0_100_s,
range_eco_km, range_mixed_km, range_offroad_km,
voltage_v, dimensions_mm, warranty,
rent_price_label, rent_weekday_hour, rent_weekend_hour
```

---

## 6. Adding a New Bike — Checklist

1. Collect specs from official source / dealer listing
2. Map every spec to the canonical key from the table above
3. Build `spec_labels` — include ONLY keys that exist in this bike's specs
4. Add `gallery` array with all Supabase storage URLs
5. If multiple colors with separate gallery sets → add `color_variants`
6. Set `brand_type`: `official_reseller` | `official_website_data` | `dealer_data` | `community`
7. Set `source` URL for traceability
8. Run the INSERT SQL (or add to `seed-bikes-full.sql`)
9. Verify in compare UI that all rows render correctly

---

## 8. Common Mistakes & Validation Guards

> **⚠️ CRITICAL: Read this section BEFORE adding a new electric bike to prevent data quality issues.**

### 8.1 Pricing Validation (MUST CHECK)

The most common mistake is setting `price_per_hour` too high, which causes 3h/6h/12h rentals to cost MORE than a full day.

**Rule:** `price_per_hour` MUST be ≤ 25% of `dailyPrice` (ideally `dailyPrice / 8`).

```
✅ GOOD: dailyPrice=12000, price_per_hour=1500 (12.5%)
❌ BAD:  dailyPrice=12000, price_per_hour=5000 (42%) → 3h=15000 > daily!
```

**Required pricing ladder (each tier MUST be less than the next):**
```
price_per_hour < price_per_3h < price_per_6h < price_per_12h < dailyPrice
```

**Formula: "Halve the time, lose 10% of daily" (v2 — operator-approved)**
```javascript
// Each halving of rental duration costs 10% less than daily.
// This ensures minimum 70% revenue even for 3h rentals.
price_per_hour = Math.round(dailyPrice * 0.10);  // 10%
price_per_3h   = Math.round(dailyPrice * 0.70);  // 70%
price_per_6h   = Math.round(dailyPrice * 0.80);  // 80%
price_per_12h  = Math.round(dailyPrice * 0.90);  // 90%
// dailyPrice stays at 100%
```

**Example for dailyPrice=10 000 ₽:**
| Tier | Price | % of daily |
|---|---|---|
| 1h | 1 000 ₽ | 10% |
| 3h | 7 000 ₽ | 70% |
| 6h | 8 000 ₽ | 80% |
| 12h | 9 000 ₽ | 90% |
| 24h (daily) | 10 000 ₽ | 100% |

**Business rationale:** Each rental requires fixed overhead (prep, paperwork, handover). Short rentals still incur full overhead, so minimum charge = 70% of daily. Upgrading from 3h→6h costs only 1 000 ₽ extra, incentivizing longer rentals.

### 8.2 Access Tier Deduction

`access_tier` is REQUIRED for all bikes. If missing, deduce automatically:

| Condition | Tier |
|---|---|
| `power_kw >= 30` (e.g., Y-VOLT Surge V 35kW) | `pro` |
| `top_speed_kmh >= 150` AND `power_kw >= 25` | `pro` |
| Everything else (light electro, category M, ≤30kW) | `entry` |

### 8.3 Chinese Replicas — Frame Type Warning

**⚠️ NEVER claim premium frame types for Chinese replica bikes!**

Chinese replicas (e.g., Ducati Panigale S Electro, various "look-alike" bikes) typically have simple welded steel frames, NOT:
- ~~Трубчатая рама~~ (tube frame)
- ~~Периметральная рама~~ (perimeter frame)
- ~~Диагональная рама~~ (diagonal frame)

**Correct frame_type for replicas:** `"Стальная (китайская реплика)"` or simply `"Стальная сварная"`.

### 8.4 Pre-Insert Checklist

Before adding a new electric bike:
1. ☐ Read this gold standard document FIRST
2. ☐ Set `type: "Electric"` (not "bike" or "Electro")
3. ☐ Verify `price_per_hour ≤ dailyPrice * 0.25`
4. ☐ Set explicit `price_per_3h`, `price_per_6h`, `price_per_12h` (or verify fallback math)
5. ☐ Set `access_tier` ("pro" or "entry")
6. ☐ Verify `frame_type` is honest (no premium claims for replicas)
7. ☐ Set `charge_time_h` (required for electric bikes!)
8. ☐ Set `removable_battery` if applicable
9. ☐ Build complete `spec_labels` for ALL keys present in specs
10. ☐ Set `brand_type`: `official_reseller` | `official_website_data` | `dealer_data` | `community`

---

## 9. File Reference

| File | Purpose |
|---|---|
| `seed-bikes-full.sql` | Full idempotent seed (DELETE + INSERT) for all 5 bikes |
| `gold-standard-spec-schema.md` | This document |
