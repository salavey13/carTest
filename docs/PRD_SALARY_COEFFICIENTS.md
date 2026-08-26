# PRD — Salary Coefficients (Коэффициенты ЗП)

**Status:** v1.0 · 2026-08-26
**Owner:** Crew owner / admin
**Source of truth:** official bonus document (Аренда / Продажа / Овер Прайс) provided by business 2026-08-26

---

## 1. Background

The analytics CSV/table exports (`/franchize/[slug]/rentals-analytics`, `/franchize/[slug]/sales-analytics`)
fill the salary columns («ЗП Аренда», «ЗП Продажа») from `commission_rates` — a percentage
of the deal price (iter4). The business has now provided the **actual compensation scheme**:
fixed bonuses per equipment category + a cut of the overprice markup. Percentage-of-price
is wrong for this crew; the official numbers must become the defaults, configurable by
crew owner / admin.

## 2. Official scheme (defaults)

### 2.1 Аренда (per closed rental, by bike category)

| Category | Key | Bonus, ₽ | Bikes (default mapping) |
|---|---|---|---|
| Бюджетные | `budget` | 750 | U2 Pro, Breakout 300, Nibbler 300 4V, Jilang Max Pro, Leopard Asaka, Kayo TSD 110, HMD M02 |
| Обычные | `regular` | 1000 | BMW F800R, BMW S1000RR Electro Silver, Ducati 1199 Panigale (Зубик), Falcon GT, Falcon Pro, Rerode R1+, Y-VOLT Surge V |
| Партнерские обычные | `partner_regular` | 500 | Yamaha R7, Kawasaki EX650K, Aprilia Shiver, Ducati Panigale S Electro (Black, Black Aero, Black Chain, Gold, Green) |
| Премиум | `premium` | 1500 | Sequence Zero, LiveWire ONE (Харлей) |
| Партнерские премиум | `partner_premium` | 750 | Suzuki GSX-S1000F |
| Экип (per unit) | `equipment` | 200 | любой экип в аренде (шлемы, перчатки, куртка, штаны, ботинки, сет, рюкзак; зарядка — бесплатно, не считается) |

### 2.2 Продажа (per sale, by bike category)

| Category | Key | Bonus, ₽ |
|---|---|---|
| Эндуро, мопеды | `enduro_moped` | 5000 |
| Обычные | `regular` | 10000 |
| Премиум | `premium` | 15000 |

Default sale mapping: enduro/scooter/pitbikes → `enduro_moped`; road bikes
(BMW, Ducati, Honda, Aprilia, Yamaha, Kawa, electro replicas) → `regular`;
Sequence / LiveWire / Suzuki → `premium`.

### 2.3 Продажа экипировки (per unit sold)

| Item | Key | Bonus, ₽ |
|---|---|---|
| Шлем | `helmet` | 500 |
| Балаклава | `balaclava` | 100 |
| Куртка | `jacket` | 500 |
| Штаны | `pants` | 500 |
| Перчатки | `gloves` | 200 |

Equipment-sale bonuses are configured now and exposed via the salary engine;
systematic equipment-sale tracking lands later (no itemized table yet).

### 2.4 Овер Прайс

`overprice_percent = 10` — оператор получает **10% от наценки**:
`markup = max(0, фактическая цена − стандартная цена каталога)`.

Standard price = `calculatePrice(specs, …)` from `lib/rental-pricing-calculator.ts`
(canonical tiered catalog price for the rental period) **+ стандартная стоимость экипа**
(шлемы ×1000/500, перчатки ×500, куртка/штаны/боты/сет/рюкзак ×500 — как в CSV-колонке «Экип»).
For sales the markup baseline has no stored asking price yet — applies to rentals only
until `asking_price` is tracked on sale artifacts.

## 3. Salary formulas

```
ЗП аренды  = bonus(bike.rental_category)
           + equipment_bonus × equipment_unit_count
           + overprice_percent% × max(0, total_cost − standard_price)

ЗП продажи = bonus(bike.sale_category)          [+ overprice when baseline exists]
```

Equipment unit count: helmets + gloves (counts) + jacket/pants/boots/net/backpack (0/1).
Charger is free → excluded.

## 4. Data model

```sql
public.salary_coefficients (
  crew_id UUID → crews, kind TEXT, category TEXT,
  amount NUMERIC ≥ 0, is_active BOOL, updated_at,
  PK (crew_id, kind, category)
)
-- kind: 'rental' (categories incl. 'equipment'), 'sale',
--       'equipment_sale', 'overprice' (category 'percentage')

public.bike_salary_categories (
  crew_id UUID → crews, bike_id TEXT → cars,
  rental_category TEXT, sale_category TEXT, updated_at,
  PK (crew_id, bike_id)
)
```

Code-level defaults (`lib/salary-coefficients.ts`) mirror the official numbers and the
default bike mapping, so the feature degrades gracefully when the migration is not yet
applied (same defensive pattern as `has_commission_rates`).

## 5. UI — /franchize/[slug]/salary-coefficients

Dedicated page (profile is already 1500+ lines). Sections:

1. **Аренда** — 5 category cards + экип, amount inputs, category descriptions with bikes.
2. **Продажа** — 3 category cards.
3. **Продажа экипировки** — 5 item cards.
4. **Оверпрайс** — percent input + explanation.
5. **Категории техники** — crew bike list, two dropdowns per bike
   (категория аренды / категория продажи), search, «не настроено» highlight,
   quick bulk-assign by default mapping.
6. Sticky save bar, dirty tracking, «Сбросить к официальным» action.
7. Read-only view for regular members (transparency of how ЗП is computed).

Access: edit = owner / co_owner / admin (`verifyCrewAccess().isOwner`); view = crew members.
Entry points: profile «Операции экипажа» grid + banner on `/commissions` + `/salary`.

## 6. Integration points

| Consumer | Change |
|---|---|
| `lib/csv-builders/rentals-csv.ts` | «ЗП Аренда» = category bonus + экип + оверпрайс (replaces %) |
| `lib/csv-builders/sales-csv.ts` | «ЗП Продажа» = category bonus (replaces %) |
| `app/franchize/server-actions/analytics-csv-send.ts` | inherits via shared builders (XLSX + TG send) |
| `app/franchize/server-actions/salary-calculations.ts` | when coefficients configured: rental bonuses by `rentals.created_by_operator_chat_id`, sale bonuses by `sale_contract_artifacts.telegram_chat_id`; else legacy %/recorded path |
| Analytics table modal | no schema change; summary card keeps summing the column |

Operator credit: rentals → `created_by_operator_chat_id`; sales → `telegram_chat_id`
(chat where the sale contract was created).

## 7. Rollout & compatibility

- Migration seeds official defaults for **all** crews (ON CONFLICT DO NOTHING).
- Before migration: code defaults active — CSV salary column switches from % to
  official bonuses immediately after deploy.
- `commission_rates` remains for shifts/services and legacy crews; commissions page
  gets a banner pointing to the new page for rental/sale bonuses.
- Salary page (`/salary`) breakdown shows per-category lines («Аренда (обычные): 3 × 1000 ₽»).

## 8. Acceptance

- [ ] Owner can view/edit all coefficients + bike categories; save persists (PK upsert).
- [ ] Rentals CSV «ЗП Аренда»: Ducati Panigale S Electro Black Z → 500 + экип×200 + 10% оверпрайса.
- [ ] Sales CSV «ЗП Продажа»: enduro sale → 5000.
- [ ] Zero-config deploy works via code defaults (no migration required).
- [ ] Profile salary table uses category bonuses when configured.
- [ ] `tsc --noEmit` — no new errors vs baseline.
