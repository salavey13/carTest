# Franchize Dynamic Item Modal Pricing — Design Spec

**Date:** 2026-06-19  
**Status:** Approved  
**Next:** Implementation plan

---

## Overview

Transform the franchize item modal from a static display with fake options into a **dynamic pricing calculator** that:
- Shows real-time pricing based on user-selected dates
- Uses actual bike spec pricing (hourly, daily, multi-day tiers)
- Auto-fills dates via duration shortcuts (1d → tomorrow, 3d → +3 days)
- Shows meaningful savings ("Экономия 12% vs посуточно!")
- Acknowledges returning users subtly (wow effect happens later)
- Eliminates all fake doors (fake packages, unavailable options)

**Success criteria:**
- Price in modal = price in cart = price in contract (no surprises)
- Returning users get subtle acknowledgment in modal, massive wow in order page
- No hardcoded options that don't match reality
- All prices calculable from bike specs + date range

---

## Architecture

### Component Structure

```
Item.tsx (Modal)
├── Date Pickers (start/end date, time)
├── Duration Shortcuts (1d, 3d, 7d, 3h, 6h, 12h)
├── Helmet Balloons (0/1/2)
├── Price Card (reveals when end date set)
└── Returning User Badge (subtle)

pricing-calculator.ts (shared utility)
├── Used by: Web app modal, OCR skill, /doc command
└── Source of truth for ALL pricing calculations
```

### New File: `lib/rental-pricing-calculator.ts`

Shared pricing calculator used by all three contract generation flows:
- Web app modal (client + server)
- OCR skill (scripts/make-deal-contract-skill.mjs)
- /doc command (Telegram bot)

```typescript
export interface PricingResult {
  totalRub: number;
  basePriceRub: number;
  helmetRub: number;       // 1000 per helmet
  depositRub: number;      // From specs.deposit_rub, fallback to 20000
  savingsRub: number;
  savingsPercent: number;  // rounded to nearest whole %
  tier: PricingTier;
  breakdown: {
    period: string;        // "3 дня", "6 часов", etc.
    ratePerPeriod: number; // "5000 ₽/день"
    periods: number;       // 3
  };
}

export type PricingTier =
  | "hourly"
  | "3-hours"
  | "6-hours" 
  | "12-hours"
  | "daily"
  | "multi-day-2-4"
  | "multi-day-5-10"
  | "multi-day-11-30";

export function calculatePrice(
  specs: BikePricingSpecs,
  startDate: string,  // ISO yyyy-MM-dd
  endDate: string,    // ISO yyyy-MM-dd
  startTime: string,  // HH:mm
  endTime: string,    // HH:mm
  helmetCount: number
): PricingResult;
```

### Data Flow

1. **User picks dates in modal** → `Item.tsx` state updates
2. **`calculatePrice()` called** → reads `item.rawSpecs`, returns `PricingResult`
3. **PriceCard renders** → shows total + savings + tier info
4. **User toggles helmet** → recalculate with `helmetCount: 1` → update UI
5. **User clicks "Забронировать"** → add to cart with `priceBreakdown` metadata
6. **Cart renders** → uses same `calculatePrice()` to verify and display
7. **Order checkout** → passes `priceBreakdown` to contract builder
8. **Contract generated** → uses passed subtotal (no recalculation, matches cart)

**Key principle:** **Single source of truth** for pricing. The same `calculatePrice()` function powers modal, cart, and contract.

---

## Components

### 1. Duration Shortcuts (date shortcuts)

**UI:**
```
┌─────────────────────────────────────────────┐
│ Быстрый выбор срока                          │
│ [3 часа]  [6 часов]  [12 часов]             │
│ [1 день]  [3 дня]  [7 дней]                 │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Click hour balloon → end date = today, end time = start + 3/6/12h
- Click day balloon → end date = start + 1/3/7 days, end time = start time
- If start date empty, default to today
- Prevents "2 days 5 hours" weirdness

### 2. Price Card (reveals when end date set)

**Collapsed state:**
```
┌─────────────────────────────────────────────┐
│ 💰 15 000 ₽  │  Экономия 12% vs посуточно  │
│ [Размер при клике]                           │
└─────────────────────────────────────────────┘
```

**Expanded state:**
```
┌─────────────────────────────────────────────┐
│ 📊 Детали стоимости                          │
│                                             │
│ • Период: 3 дня                             │
│ • Тариф: 5 000 ₽/день (скидка 7%)          │
│ • Аренда: 15 000 ₽                          │
│ • Шлем: 1 000 ₽                             │
│ • Залог: 20 000 ₽                          │
│                                             │
│ Итого: 16 000 ₽  (аренда + шлем)            │
│ Экономия 1 200 ₽ против трёх отдельных дней│
└─────────────────────────────────────────────┘
```

### 3. Helmet Selection (balloons)

**UI:**
```
┌─────────────────────────────────────────────┐
│ 🪖 Шлемы                                     │
│ [   ] +1 шлем     [   ] +2 шлема            │
│ (ни один не выбран = есть свой)             │
└─────────────────────────────────────────────┘
```

**Behavior:**
- Default: No balloon selected = "есть свой" (0 helmets)
- Active balloon: Accent background + checkmark
- Price updates: +1000 ₽ per helmet
- Savings % calculated EXCLUDING helmet (for cleaner math)

**Per-flow helmet handling:**

| Flow | Helmet UX | Default |
|------|-----------|---------|
| Web app modal | 0/1/2 balloons (per bike, deduces total) | 0 (none selected) |
| /doc command | Inline buttons: "Есть свой", "1 шлем (+1000 ₽)", "2 шлема (+2000 ₽)" | 0 |
| OCR skill | No UI, auto-detect from photos | 0 |

### 4. Rounding Warning (when user picks messy hours)

**UI (appears when rounding needed):**
```
┌─────────────────────────────────────────────┐
│ ⚠️ Округляем до 6 ч  [До 16:00]            │
└─────────────────────────────────────────────┘
```

**Behavior:**
- User picks 10:00 - 14:30 (4.5h) → Price shows 12 000 ₽ (6h rate)
- Warning appears with "До 16:00" button
- Click → end time becomes 16:00 → warning vanishes
- Price stays same (was already correct for 6h)

**Rounding rules:**
- 1-2 hours: Any duration allowed
- 3-5 hours: Round to 6 hours, show "Округляем до 6 ч"
- 7-11 hours: Round to 12 hours, show "Округляем до 12 ч"
- > 12 hours: Must switch to daily mode

### 5. Returning User Badge (subtle!)

```tsx
{isReturningUser && (
  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">
    С возвращением!
  </span>
)}
```

- Positioned near bike title, unobtrusive
- No pre-filled data shown — just acknowledgment
- Wow effect happens on order page (all fields pre-filled)

---

## Hourly vs Daily Modes

**Constraint:** Prevent "2 days 5 hours" weirdness.

| User selection | Mode | End time behavior |
|----------------|------|-------------------|
| Click 3/6/12 hour balloon | HOURLY | End time = start time + 3/6/12h (same day) |
| Set end date ≠ start date | DAILY | End time locked = start time |
| Set end date = start date | HOURLY | Can manually set end time (subject to rounding) |

**Date picker behavior:**
```tsx
<input
  type="time"
  value={endTime}
  disabled={endDate !== startDate}  // Lock if multi-day
  // If user tries manual hour pick on multi-day → hint:
  // "Для суточной аренды время сдачи равно времени выдачи"
/>
```

---

## Edge Cases

### 1. Missing Pricing Data
- Detect in `calculatePrice()`, return error with `needsAdminFix: true`
- Modal shows: "⚠️ Временно недоступен. Владелец уведомлен."
- Admin panel: `/franchize/[slug]/admin/fix-pricing` — bulk edit prices, hide bikes

### 2. Invalid Date Ranges
- Grey out dates before today in date picker
- Max date: 1 year from today

### 3. Bike Unavailable for Selected Dates
- CatalogClient shows "currently in use"
- Grey out overlapping dates in picker
- Show "Занят до {date}" tooltip

### 4. Returning User Detection Fails
- Treat as new user (fail open)
- No error shown to user

### 5. Cart Edit (NEW FEATURE!)
```tsx
<button onClick={reopenModalWithPreset}>✏️ Изменить</button>
```
- Opens modal with dates, helmet selection pre-filled from cart
- On save → replaces cart line (no duplicate)

### 6. Price Drift
- Shared `calculatePrice()` prevents this
- If happens → bug in calculator, fix there

### 7. /doc Skill Hallucination
- Recalculate at save using `calculatePrice()`
- If mismatch > 1000 ₽ → log warning, use recalculated price
- Or: trust AI for now, QR code page can tweak later

---

## Testing

**Test file:** `tests/franchize/pricing-calculator.spec.ts`

**Test scenarios:**
1. 2-hour rental (any duration allowed)
2. 3-hour rental (exact balloon)
3. 4.5-hour rental (rounds to 6h)
4. 1-day rental
5. 3-day rental (2-4 day tier with 7% discount)
6. 7-day rental (5-10 day tier with 11% discount)
7. Helmet cost calculation
8. 11-hour rental (rounds to 12h)

**Run:**
```bash
npm test -- pricing-calculator
```

Tests shared `calculatePrice()` used by all three flows (web app, skill, /doc).

---

## Files to Modify

| File | Changes |
|------|----------|
| `lib/rental-pricing-calculator.ts` | NEW - shared pricing utility |
| `app/franchize/modals/Item.tsx` | Duration shortcuts, helmet balloons, price card, rounding warning, returning badge |
| `app/franchize/hooks/useFranchizeCartLines.ts` | Edit button, verify priceBreakdown |
| `app/franchize/actions-runtime.ts` | Pass calculated priceBreakdown to contract builder |
| `app/lib/rental-contract-vars.ts` | Accept optional priceBreakdown parameter, use passed subtotal |
| `app/franchize/lib/rental-contract-vars.ts` | Mirror canonical changes |
| `app/franchize/lib/catalog-rental-strip.ts` | Extend to include pricing tiers |
| `scripts/make-deal-contract-skill.mjs` | Use shared calculator |
| `app/api/.../doc/route.ts` | Use shared calculator, helmet inline buttons |
| `app/franchize/components/CartPageClient.tsx` | Returning user header, saved data badge |
| `app/franchize/components/cart/CartItemCard.tsx` | Edit button to reopen modal with preset |
| `app/franchize/components/OrderPageClient.tsx` | Returning user pre-fill (passport, license) - WOW effect |
| `tests/franchize/pricing-calculator.spec.ts` | NEW - calculation tests |

---

## Implementation Order

1. **Shared calculator** (`lib/rental-pricing-calculator.ts`) + tests
2. **Modal components** (duration shortcuts, helmet balloons, price card)
3. **Cart integration** (priceBreakdown, edit button)
4. **Contract builder** (use passed priceBreakdown)
5. **Skill + /doc integration** (use shared calculator)
6. **Returning user badge** (subtle acknowledgment)

---

## Success Metrics

- ✅ All 8 test scenarios pass
- ✅ Manual test: Add item via modal → cart → contract, prices match
- ✅ Manual test: Returning user sees badge in modal, pre-filled data on order page
- ✅ No fake options in UI (all balloon options match bike specs)
- ✅ Rounding warning works for messy hour selections
