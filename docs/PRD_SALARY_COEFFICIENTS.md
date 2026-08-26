# PRD — Salary Coefficients (Коэффициенты ЗП)

**Status:** v1.1 · 2026-08-26 (iter6 rework: price-based classification, jsonb storage)
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

### 2.0 Classification rule (iter6 — «крутизну техники определяет цена»)

Bike category is **judged by the daily rental price** — no hardcoded model lists:

| Tier | Price (₽/сутки) | Rental category (own) | Rental category (subrented) | Sale category |
|---|---|---|---|---|
| Бюджет | < 7 000 | `budget` (750 ₽) | — | `enduro_moped` (5000 ₽) |
| Обычный | 7 000–13 999 | `regular` (1000 ₽) | `partner_regular` (500 ₽) | `regular` (10000 ₽) |
| Премиум | ≥ 14 000 | `premium` (1500 ₽) | `partner_premium` (750 ₽) | `premium` (15000 ₽) |

**Subrented (партнерские) bikes — the complete list (owner, 2026-08-26):**
Ducati Aero (`ducati-panigale-s-electro-black-aero`), Yamaha R7 (`yamaha-r7`),
Suzuki GSX-S1000F (`suzuki-gsx-s1000f`). Everything else is owned.

Thresholds are stored in `crews.metadata.franchize.salaryCoefficients.priceThresholds`
and used to derive categories for bikes without an explicit `specs.salary` override.
The admin UI warns when a bike's stored category disagrees with what its CURRENT
price derives («жёлтая метка») and offers «Пересчитать по ценам».

### 2.1 Аренда (per closed rental, by bike category)

| Category | Key | Bonus, ₽ |
|---|---|---|
| Бюджетные | `budget` | 750 |
| Обычные | `regular` | 1000 |
| Партнерские обычные | `partner_regular` | 500 |
| Премиум | `premium` | 1500 |
| Партнерские премиум | `partner_premium` | 750 |
| Экип (per unit) | `equipment` | 200 |

(Which bikes land in which category follows §2.0 — by price + subrented flag.)

### 2.2 Продажа (per sale, by bike category)

| Category | Key | Bonus, ₽ |
|---|---|---|
| Эндуро, мопеды | `enduro_moped` | 5000 |
| Обычные | `regular` | 10000 |
| Премиум | `premium` | 15000 |

Sale category follows the price tier (§2.0): budget → `enduro_moped`,
regular → `regular`, premium → `premium`. The subrented flag does not change
sale bonuses.

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

## 4. Data model (iter6 — NO new tables, jsonb only)

> The v1.0 design created `salary_coefficients` + `bike_salary_categories` tables
> via migration. The owner rejected table-schema changes: **everything lives in
> existing jsonb fields**, written via read-merge-write. The migration file was
> removed (it was never applied to production).

```jsonc
// crews.metadata.franchize.salaryCoefficients — crew-level ₽ rates + thresholds
{
  "rental": { "budget": 750, "regular": 1000, "partner_regular": 500, "premium": 1500, "partner_premium": 750 },
  "equipmentRentalUnit": 200,
  "sale": { "enduro_moped": 5000, "regular": 10000, "premium": 15000 },
  "equipmentSale": { "helmet": 500, "balaclava": 100, "jacket": 500, "pants": 500, "gloves": 200 },
  "overpricePercent": 10,
  "priceThresholds": { "premiumThreshold": 14000, "regularThreshold": 7000 },
  "updatedAt": "…"
}

// cars.specs.salary — per-bike classification (explicit override wins over price)
{
  "tier": "premium",              // budget | regular | premium
  "subrented": true,              // partner bike (Ducati Aero / R7 / Suzuki 1000)
  "rentalCategory": "partner_premium",
  "saleCategory": "premium",
  "dailyPriceAtSet": 14000,       // price when this was written — mismatch ⇒ UI warning
  "setAt": "…"
}
```

Resolution order (`resolveCategoriesForBike` in `lib/salary-coefficients-shared.ts`):
1. `cars.specs.salary.rentalCategory / saleCategory` — explicit, admin-set (source: `specs`)
2. else derive from `cars.daily_price` + subrented flag (source: `price`)
3. unknown bike ids → `regular / regular` (source: `fallback`)

Code-level defaults (`OFFICIAL_SALARY_CONFIG`) mirror the official numbers, so
unconfigured crews degrade gracefully. `hasSalaryCoefficients()` (gates the switch
from the legacy %-model in salary calculations) now checks the metadata block —
true for vip-bike since iter6 wrote the initial data.

## 5. UI — /franchize/[slug]/salary-coefficients

Dedicated page (profile is already 1500+ lines). Sections:

1. **Аренда** — 5 category cards + экип, amount inputs, category descriptions with bikes.
2. **Продажа** — 3 category cards.
3. **Продажа экипировки** — 5 item cards.
4. **Оверпрайс** — percent input + explanation.
5. **Категории техники** — crew bike list with price + tier chip + «Субаренда/Своя»
   toggle + two dropdowns per bike (категория аренды / категория продажи), search,
   «по цене: …» stale-price badges, «Пересчитать по ценам» bulk action.
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

- **iter6 wrote the initial data directly** (`scripts/apply-salary-specs.mjs`):
  `specs.salary` on all 28 vip-bike rentable bikes + official rates in crew metadata.
  No migration, no table changes.
- Unconfigured crews: code defaults active — CSV salary column switches from % to
  official bonuses immediately after deploy.
- `commission_rates` remains for shifts/services and legacy crews; commissions page
  gets a banner pointing to the new page for rental/sale bonuses.
- Salary page (`/salary`) breakdown shows per-category lines («Аренда (обычные): 3 × 1000 ₽»).

## 8. Acceptance

- [x] Owner can view/edit all coefficients + bike categories; save persists
      (metadata + specs jsonb, read-merge-write).
- [x] Ducati Aero / R7 rentals → `partner_regular` 500 ₽ + экип×200 + 10% оверпрайса;
      Suzuki 1000 → `partner_premium` 750 ₽ (verified against live Supabase data).
- [x] Sales CSV «ЗП Продажа»: enduro sale → 5000.
- [x] Zero-config deploy works via code defaults (no migration required).
- [x] Profile salary table uses category bonuses when configured (metadata gate).
- [x] `tsc --noEmit` — no new errors vs baseline; `eslint app/franchize` clean.
