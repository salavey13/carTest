# Gold Standard Spec Schema — ICE (Internal Combustion Engine) Bikes

> Canonical spec-key mapping, category groups, data types, and contract template integration for ICE motorcycles in the VIP BIKE catalog.  
> **v1** — initial release, based on Kawasaki EX650K as reference bike.

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

> **Critical:** `type` must be set to `"ICE"` (not `"Electric"` or `"bike"`). The contract skill uses `specs.type` as one of the signals for ICE/electro detection. A missing or wrong `type` value will cause the wrong contract template wording (e.g. "электромотоцикл" instead of "мотоцикл").

### 1.2 Engine & Power

This is the key difference from electric bikes. ICE bikes describe their engine in **displacement (cc)** and **horsepower**, not kilowatts.

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `engine_cc` | Объём двигателя | power | см³ | desc | Engine displacement in cubic centimeters. The primary ICE power metric. |
| `power_hp` | Мощность (л.с.) | power | л.с. | desc | Maximum engine power in horsepower. Primary for ICE (unlike electro which uses kW). |
| `power_kw` | Макс. мощность | power | кВт | desc | Maximum engine power in kilowatts. Often derived from HP (1 HP ≈ 0.7355 kW). Present for cross-type compare. |
| `torque_nm` | Крутящий момент | power | Нм | desc | Peak engine torque. |
| `top_speed_kmh` | Макс. скорость | performance | км/ч | desc | Maximum design speed. |

> **Note on `power_kw` for ICE:** ICE bikes should still include `power_kw` for cross-type comparison with electrics in the comparator UI, but the contract template uses `power_hp` (not `power_kw`) for the engine spec line.

### 1.3 Fuel System

These keys replace the Battery & Charging section from the electro schema.

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `fuel_type` | Тип топлива | fuel | — | — | "Бензин", "АИ-95", "АИ-92", etc. |
| `fuel_capacity_l` | Объём бака | fuel | л | desc | Fuel tank capacity in liters. |
| `fuel_consumption_l_100km` | Расход топлива | fuel | л/100км | asc | Average fuel consumption per 100 km. |
| `range_km` | Запас хода | fuel | км | desc | Approximate range on full tank. Computed: `fuel_capacity_l / consumption * 100`. |
| `battery` | Топливо | fuel | — | — | **Reuse for fuel display** — e.g. "Бензин, 15 л". The contract skill checks `battery` field presence for type detection; ICE bikes set it to fuel description. |

### 1.4 Drivetrain & Transmission

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `drive` | Привод | drivetrain | — | — | "Chain, 6-speed", "Belt", "Shaft" |
| `transmission` | Трансмиссия | drivetrain | — | — | "6-ступенчатая", "5-ступенчатая", etc. |
| `cooling` | Охлаждение | drivetrain | — | — | "Жидкостное", "Воздушное", "Воздушно-масляное" |
| `engine_layout` | Компоновка ДВС | drivetrain | — | — | "Параллельный твин", "Рядная четвёрка", "V-твин", etc. |

### 1.5 Chassis & Dimensions

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `weight_kg` | Масса | chassis | кг | asc |
| `seat_height_mm` | Высота по седлу | chassis | мм | — |
| `ground_clearance_mm` | Дорожный просвет | chassis | мм | desc |
| `wheelbase_mm` | Колёсная база | chassis | мм | — |
| `dimensions_mm` | Габариты | chassis | мм | — |

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
| `price_rub` | Цена | price | ₽ | asc | Market value / MSRP. Used as **bike value** for loss compensation in contracts (`bike_value_rub`). |
| `sale_price` | Цена продажи | price | ₽ | asc | Actual selling price. Set to `0` if bike is rent-only (not for sale). |

> ⚠️ **Critical:** `price_rub` is the **sale/market price**, NOT the daily rental rate. The contract skill uses `sale_price → price_rub` for `bike_value_rub` (loss compensation amount), and `dailyPrice` for the rental daily rate. Mixing these up produces contracts with absurd daily rates like "850 000 ₽/сутки".

### 1.8 Rental Pricing

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) | Description |
|---|---|---|---|---|---|
| `dailyPrice` | Аренда (сутки) | rent | ₽/сутки | asc | **Primary daily rental rate.** First-choice for contract skill. Must be > 0 for rentable bikes. |
| `price_per_hour` | Аренда (1 час) | rent | ₽/час | asc | **Hourly rental rate.** Falls back to `dailyPrice / 8` if not set. Used when rental < 24h. |
| `price_per_3h` | Аренда (3 часа) | rent | ₽/3ч | asc | 3-hour rental rate. Short-ride / city tour pricing. |
| `price_per_6h` | Аренда (6 часов) | rent | ₽/6ч | asc | Half-day rental rate (6 hours). |
| `price_per_12h` | Аренда (12 часов) | rent | ₽/12ч | asc | Half-day+ rental rate (12 hours). |
| `rent_weekday` | Аренда (будни) | rent | ₽/сутки | asc | Weekday-specific daily rate. |
| `rent_weekend` | Аренда (выходные) | rent | ₽/сутки | asc | Weekend-specific daily rate. Typically 15–20% higher. |
| `rent_2_4d` | Аренда (2–4 суток) | rent | ₽/сутки | asc | Daily rate when renting for 2–4 days. Lower per-day rate than 1-day. |
| `rent_5_10d` | Аренда (5–10 суток) | rent | ₽/сутки | asc | Daily rate when renting for 5–10 days. Volume discount tier 2. |
| `rent_11_30d` | Аренда (11–30 суток) | rent | ₽/сутки | asc | Daily rate when renting for 11–30 days. Maximum volume discount tier. |
| `rent_price_label` | Аренда | rent | — | — | Human-readable label for UI cards. |

#### Rental pricing priority (contract skill lookup order):

```
bikeDailyPrice  = specs.dailyPrice  → specs.rent_weekday  → arg('dailyPrice', '10000')
bikeHourlyPrice = specs.price_per_hour → arg('hourlyPrice', dailyPrice / 8)
bikeValueRub    = specs.sale_price  → specs.price_rub     → arg('bikeValue', '850000')

// Multi-hour rates (fallback to hourly × hours if not set)
bike3hPrice  = specs.price_per_3h  → bikeHourlyPrice × 3
bike6hPrice  = specs.price_per_6h  → bikeHourlyPrice × 6
bike12hPrice = specs.price_per_12h → bikeHourlyPrice × 12

// Multi-day rates (fallback to dailyPrice if not set)
bike2_4dPrice   = specs.rent_2_4d   → specs.dailyPrice
bike5_10dPrice  = specs.rent_5_10d  → specs.dailyPrice
bike11_30dPrice = specs.rent_11_30d → specs.dailyPrice
```

> Note: For ICE bikes where `sale_price = 0` (rent-only), `price_rub` becomes the fallback for `bike_value_rub`. Ensure `price_rub` reflects actual market value.

#### Rate card example (Kawasaki EX650K):

| Key | Value |
|---|---|
| `dailyPrice` | 16 000 |
| `price_per_hour` | 2 000 |
| `price_per_3h` | — |
| `price_per_6h` | — |
| `price_per_12h` | — |
| `rent_weekday` | 16 000 |
| `rent_weekend` | 18 000 |
| `rent_2_4d` | — |
| `rent_5_10d` | — |
| `rent_11_30d` | — |
| `price_rub` (market value) | 850 000 |
| `sale_price` | 0 (rent-only) |

### 1.9 Contract Template Integration

These keys are **computed** by `make-rental-contract-skill.mjs` and written to the `specs` JSONB in the seed CSV for traceability. They are NOT user-facing compare specs and should NOT be added to `spec_labels`.

| Key | Description | Source |
|---|---|---|
| `bike_engine_spec_line_1` | Contract п.1.2 line 1: "рабочий объем N куб. см, мощность N л.с." (ICE) | Computed from `engine_cc` + `power_hp` |
| `bike_engine_spec_line_2` | Contract п.1.2 line 2: "максимальная конструктивная скорость N км/ч" | Computed from `top_speed_kmh` |
| `bike_engine_spec_line_3` | Contract п.1.2 line 3: **empty** for ICE (no battery) | Always `""` |

#### ICE vs Electro contract spec line logic:

```
if (isElectric) {
  line_1 = "мощность двигателя (номинальная) {power_kw} кВт"
  line_2 = "максимальная конструктивная скорость {top_speed_kmh} км/ч"
  line_3 = "аккумулятор: тип/ёмкость {battery}"
} else {
  line_1 = "рабочий объем {engine_cc} куб. см, мощность {power_hp} л.с."
  line_2 = "максимальная конструктивная скорость {top_speed_kmh} км/ч"
  line_3 = ""  // No battery for ICE
}
```

### 1.10 Social

| Key | Русский лейбл | Category | Unit suffix | Sort (compare) |
|---|---|---|---|---|
| `rating` | Рейтинг | social | — | desc |
| `recommend_percent` | Рекомендация | social | % | desc |

---

## 2. Spec Categories (for grouped display)

| Category key | Заголовок | Color accent | Icon suggestion |
|---|---|---|---|
| `identity` | Основные | muted | `Info` |
| `power` | Двигатель и мощность | red/orange | `Zap` |
| `performance` | Динамика | orange | `Gauge` |
| `fuel` | Топливо и запас хода | amber | `Fuel` |
| `chassis` | Размеры и масса | blue | `Ruler` |
| `drivetrain` | Трансмиссия | purple | `Cog` |
| `wheels` | Колёса | slate | `Circle` |
| `brakes` | Тормоза | red | `ShieldAlert` |
| `frame` | Рама | slate | `Box` |
| `suspension` | Подвеска | teal | `Waves` |
| `price` | Цена | gold | `Tag` |
| `rent` | Аренда | indigo | `Clock` |
| `social` | Отзывы | pink | `Star` |

### Display order within compare:

```
identity → power → performance → fuel → chassis → drivetrain
→ suspension → brakes → wheels → frame → price → rent → social
```

> **Key difference from electro:** `battery` category is replaced with `fuel` category. No `charging` or `voltage` specs.

---

## 3. Numeric Spec Bar Visualization

Same bar visualization rules as electro schema, with these ICE-specific additions:

### Inversion map (lower = better):

| Key | Direction |
|---|---|
| `weight_kg` | lower is better |
| `fuel_consumption_l_100km` | lower is better |
| `price_rub` | lower is better |
| `sale_price` | lower is better |
| `price_per_hour` | lower is better |
| `dailyPrice` | lower is better |
| `rent_weekday` | lower is better |
| `rent_weekend` | lower is better |
| `price_per_3h` | lower is better |
| `price_per_6h` | lower is better |
| `price_per_12h` | lower is better |
| `rent_2_4d` | lower is better |
| `rent_5_10d` | lower is better |
| `rent_11_30d` | lower is better |

All other numeric keys: **higher is better**.

---

## 4. Cross-Type Comparison (ICE vs Electro)

When comparing an ICE bike with an electric bike in the same compare view:

| Dimension | ICE | Electro | Comparator handling |
|---|---|---|---|
| Power | `power_hp` (л.с.) | `power_kw` (кВт) | Show both columns, add a conversion helper (1 кВт ≈ 1.36 л.с.) |
| Range | `range_km` (from fuel) | `range_km` (from battery) | Same key, directly comparable |
| "Fuel" | `fuel_capacity_l` + `fuel_consumption` | `battery` + `charge_time_h` | Show different labels per type |
| Top speed | `top_speed_kmh` | `top_speed_kmh` | Same key, directly comparable |
| Weight | `weight_kg` (heavier) | `weight_kg` (lighter) | Same key, directly comparable |

### Keys that exist in ONE type but not the other:

| Electro-only key | ICE-only key | UI handling |
|---|---|---|
| `battery` (capacity) | `fuel_capacity_l` | Show with type-specific label |
| `charge_time_h` | `fuel_consumption_l_100km` | Show with type-specific label |
| `voltage_v` | `cooling` | Dash `—` for missing type |
| `motor_peak_kw` | `engine_cc` | Dash `—` for missing type |
| `motor_nominal_kw` | `engine_layout` | Dash `—` for missing type |
| `charging_a` / `charging_kw` | `fuel_type` | Dash `—` for missing type |
| `bike_engine_spec_line_3` | *(none — ICE has no line 3)* | Empty for ICE |

---

## 5. Data Contract

### Required fields (every ICE bike MUST have):

```
type: "ICE", year, drive, engine_cc, power_hp, power_kw, top_speed_kmh,
fuel_capacity_l, transmission, cooling, torque_nm,
price_rub, weight_kg, bike_subtype, license_class,
color, spec_labels
```

### Required rental fields (every rentable ICE bike MUST have):

```
dailyPrice, price_per_hour, rent_weekday, rent_weekend
```

### Recommended rental fields (fill when pricing strategy requires):

```
price_per_3h, price_per_6h, price_per_12h,
rent_2_4d, rent_5_10d, rent_11_30d
```

> **When to use multi-hour fields:** If a bike is frequently rented for short rides (3h city tour, 6h half-day), set explicit `price_per_3h`/`price_per_6h`/`price_per_12h` to offer a discount vs. straight hourly multiplication. If not set, the system falls back to `price_per_hour × hours`.
>
> **When to use multi-day fields:** If a bike has volume pricing for extended rentals, set `rent_2_4d`/`rent_5_10d`/`rent_11_30d` with the per-day rate for each tier. If not set, the system uses `dailyPrice` for all durations.

### ICE-specific required fields (not present in electro):

```
engine_cc, power_hp, fuel_capacity_l, transmission, cooling
```

### Optional but encouraged:

```
fuel_type, fuel_consumption_l_100km, engine_layout,
ground_clearance_mm, tires_front, tires_rear,
brake_type, frame_type, suspension_type (or suspension_front + suspension_rear),
features, buy_colors, gallery
```

---

## 6. Adding a New ICE Bike — Checklist

1. Collect specs from manufacturer data / owner's manual / dealer listing
2. Set `type: "ICE"` — **critical** for correct contract template detection
3. Map engine specs: `engine_cc`, `power_hp`, `power_kw`, `torque_nm`, `cooling`, `transmission`
4. Map fuel specs: `fuel_capacity_l`, `fuel_type`, `fuel_consumption_l_100km`, `range_km`
5. Set `battery` to fuel description, e.g. "Бензин, 15 л" — needed for type detection fallback
6. **Set rental pricing:** `dailyPrice`, `price_per_hour`, `rent_weekday`, `rent_weekend` — and optionally `price_per_3h`, `price_per_6h`, `price_per_12h`, `rent_2_4d`, `rent_5_10d`, `rent_11_30d`
7. Set `price_rub` to market value (used as `bike_value_rub` for loss compensation)
8. Build `spec_labels` — include ALL keys present in this bike's specs, especially `engine_cc`, `power_hp`, `fuel_capacity_l`, `transmission`, `cooling`
9. Add `gallery` array with Supabase storage URLs
10. Set `brand_type`: `manufacturer_data` | `dealer_data` | `community`
11. Set `source` URL for traceability
12. Run the INSERT SQL (or add to seed CSV)
13. **Test contract generation** — verify п.1.2 shows "рабочий объем N куб. см, мощность N л.с." (not kW)
14. Verify in compare UI that ICE-specific rows render correctly

---

## 7. Reference Bike: Kawasaki EX650K (Ninja 650)

### Full spec example:

```json
{
  "type": "ICE",
  "year": "2019",
  "drive": "Chain, 6-speed",
  "rating": 4.8,
  "source": "contract_doc",
  "battery": "Бензин, 15 л",
  "power_kw": "50.2",
  "range_km": "400",
  "price_rub": 850000,
  "torque_nm": "65.7",
  "voltage_v": "12",
  "weight_kg": "193",
  "brake_type": "Дисковые (передние 2x300 мм + задний 220 мм), ABS",
  "brand_type": "manufacturer_data",
  "dailyPrice": 16000,
  "frame_type": "Алюминиевая периметральная",
  "sale_price": 0,
  "bike_subtype": "Sport-Touring (ICE)",
  "license_class": "А / L3",
  "top_speed_kmh": "210",
  "seat_height_mm": "790",
  "suspension_type": "Телескопическая вилка 41 мм + задний моноамортизатор с регулировкой",
  "recommend_percent": 91,
  "color": "Зелёный",
  "wheelbase_mm": "1410",
  "fuel_capacity_l": "15",
  "engine_cc": "649",
  "power_hp": "68",
  "ground_clearance_mm": "130",
  "dimensions_mm": "2055 x 740 x 1135",
  "transmission": "6-ступенчатая",
  "cooling": "Жидкостное",
  "price_per_hour": 2000,
  "rent_weekday": 16000,
  "rent_weekend": 18000,
  "bike_engine_spec_line_1": "рабочий объем 649 куб. см, мощность 68 л.с.",
  "bike_engine_spec_line_2": "максимальная конструктивная скорость 210 км/ч",
  "bike_engine_spec_line_3": ""
}
```

---

## 8. File Reference

| File | Purpose |
|---|---|
| `cars_rows_7bikes_golden.csv` | Golden seed CSV for all 7 bikes (6 electro + 1 ICE) |
| `gold-standard-electro-bike-spec-schema.md` | Electric bike spec schema (companion document) |
| `gold-standard-ice-bike-spec-schema.md` | This document |
| `RENTAL_DEAL_TEMPLATE.html` | Contract template with dual ICE/electro support |
| `make-rental-contract-skill.mjs` | Skill that fills template — auto-detects ICE vs electro |
