# 🏍️ Cart Page Overhaul — Spec & Styling Rules

> **Part 2 of 4** — Read TODO.MD first. Then this file → TODO3.MD → TODO4.MD.

---

## What exists now (`CartPageClient.tsx`)

The current cart is a **minimal MVP**: plain cards with text, basic +/- buttons, simple aside summary. No product images, no spec badges, no protection plan, no trust badges, no animations, no discount banner, no Rent/Buy distinction.

## What the target looks like (attached `megacart.png`)

A **premium cyberpunk checkout experience**: product images, spec badge pills, neon accent colors, animated quantity controls, discount shimmer banner, protection plan card, trust badge row, gold glow CTA, and an Easter egg.

---

## Page Structure (top to bottom)

```
CrewHeader (already rendered by server page — includes cart icon with badge)
  ↓
Breadcrumb: / FRANCHIZE / {SLUG} / CART
  ↓
Title: "Корзина" (Orbitron, large)
Subtitle: "Проверьте состав заказа, количество и итог перед оформлением."
  ↓
┌─ Cart Item Card ──────────────────────────────────┐
│  [IMAGE]   Model Name (Orbitron, bold)            │
│  9:16      Short subtitle (muted)                 │
│  PORTRAIT  Badge: Покупка (gray) / Аренда (accent)│
│  TALL      ┌─────┐ ┌─────┐ ┌──────┐              │
│            │⚡val│ │🔋val│ │● val│  spec pills    │
│            └─────┘ └─────┘ └──────┘              │
│            Rent: 15 000 ₽ / день  [ВЫГОДНО]      │
│            Buy:  390 000 ₽  (text-2xl + gold glow)│
│            (●) 1 (●)           Удалить 🗑         │
│            ↑ ONLY for Rent, CIRCULAR buttons      │
└───────────────────────────────────────────────────┘
  ↓
┌─ Order Summary ───────────────────────────────────┐
│  Итого позиций                         1          │
│  Сумма за 1 день аренды              15 000 ₽     │
│  ──────────────────────────────────               │
│  Сумма за весь период               550 000 ₽     │
│                                    36 дней аренды │
│  ┌─ Discount Banner (shimmer) ───────────────┐    │
│  │ 🎉 Скидка 5%                    −27 500 ₽ │    │
│  └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
  ↓
┌─ Protection Plan ─────────────────────────────────┐
│  🛡️ Полная защита включена         [Включено]    │
│  Кража, повреждения и техподдержка 24/7          │
└───────────────────────────────────────────────────┘
  ↓
[▶ Перейти к оформлению]  (gold CTA, full width, glow on hover)
  ↓
⚡ Быстрое оформление   🛡️ Без скрытых платежей   🎧 Поддержка 24/7
  ↓
Easter Egg (hidden, opacity-30, hover→opacity-100)
  ↓
BottomNavigationBike (NOT CrewFooter!)
```

> ⚠️ **NO FOOTER ON CART PAGE.** The project has transitioned from `CrewFooter` to a `BottomNavigationBike` bottom navigation bar. The cart page should NOT render `CrewFooter`. If the server page wrapper still includes `<CrewFooter />`, REMOVE it from the cart page's server component (`/app/franchize/[slug]/cart/page.tsx`) — the bottom nav bar handles all footer-level navigation. Double-check the cart server page to ensure no `CrewFooter` is rendered there.

---

## Rent vs Buy Logic (CRITICAL)

The cart must support TWO independent flows. A cart can contain mixed items (some rent, some buy).

| Aspect | Rent Flow | Buy Flow |
|--------|-----------|----------|
| Price display | `X ₽ / день` | `Y ₽` (from `salePrice`) |
| Quantity controls | ✅ Show `[-] N [+]` | ❌ Hidden (always qty=1) |
| Period calculation | `pricePerDay × qty × rentalDays` | `salePrice × 1` |
| Summary "Сумма за день" | ✅ Show | ❌ Hide |
| Summary "Сумма за весь период" | `pricePerDay × qty × days` | `salePrice` |
| Badge on card | "Аренда" | "Покупка" |
| "ВЫГОДНО" badge | If discount applies | If sale price is good |

**Detection**: `line.saleAvailable` from `useFranchizeCartLines` tells you if this item is in Buy mode.

**How to get sale price**: `line.item?.salePrice` (already in `CatalogItemVM`). If `saleAvailable && salePrice`, the item is in Buy mode.

**Rental days**: Use `line.options.duration ?? 1`. Do NOT hardcode a default rental period.

**Quantity floor for Rent**: The `-` button is disabled at `qty <= 1` — user must use the delete button to remove the item entirely. This is intentional (prevents accidental zero-qty state). For Buy items, qty is always 1 and controls are hidden.

---

## Discount Logic

The discount is a **franchise-level benefit**. Source it from `crew.catalog` config if available, otherwise use this fallback:

```tsx
// Discount is a franchise perk — use crew config when available
const DISCOUNT_PERCENT = 5; // Default franchise discount
// TODO: Replace with crew.catalog.discountPercent when available in schema
```

Mark it as a known TODO so it can be wired to real data later. Never hardcode business logic without a comment explaining where the real value should come from.

---

## Component Breakdown

You'll rewrite `CartPageClient.tsx` completely and extract sub-components into:

```
/app/franchize/components/cart/
├── CartItemCard.tsx        # Individual cart item with image, specs, controls
├── OrderSummary.tsx        # Summary card with discount banner
├── ProtectionPlan.tsx      # Shield card with "Включено" badge
├── TrustBadges.tsx         # 3-icon row below CTA
├── CheckoutButton.tsx      # Gold CTA with glow animation
├── EmptyCartState.tsx      # Empty cart with navigation back
├── SpecBadge.tsx           # Reusable spec pill [icon + value]
├── QuantityControl.tsx     # [-] N [+] with pulse animation
├── DiscountBanner.tsx      # Shimmer green discount banner
└── index.ts                # Barrel export
```

---

## Accessibility Requirements

- All icon-only buttons must have `aria-label` (e.g., delete button: `aria-label="Удалить товар"`)
- Quantity controls must have `aria-label` on +/- buttons (e.g., `aria-label="Уменьшить количество"`)
- Focus rings must use `interactionRingStyle(crew.theme)` on all interactive elements
- The cart page must be navigable by keyboard (Tab order follows visual order)
- The empty cart CTA must be focusable and activated by Enter/Space
- Motion animations should respect `prefers-reduced-motion` — wrap framer-motion animations with a check:

```tsx
const prefersReducedMotion = typeof window !== "undefined"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Then in motion components:
initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
```

---

## Loading & Error States

**Loading**: While `cartLines` is being computed, show a skeleton:

```tsx
{cartLines === undefined && (
  <div className="space-y-3">
    {[0, 1, 2].map(i => (
      <div key={i} className="h-32 rounded-2xl animate-pulse"
           style={{ backgroundColor: withAlpha(crew.theme.palette.borderSoft, 0.15) }} />
    ))}
  </div>
)}
```

**Item no longer available**: If `line.item` is `undefined`, show a degraded card:

```tsx
{!line.item && (
  <p className="text-xs italic" style={{ color: "#FF9500" }}>
    Товар больше недоступен в каталоге
  </p>
)}
```

Allow deletion of orphaned items (item is undefined but line still exists).

---

## STYLING RULES (with real codebase patterns)

```tsx
// ✅ CORRECT: Using franchise theme system
const surface = crewPaletteForSurface(crew.theme);
const accentColor = crew.theme.palette.accentMain;
const borderColor = crew.theme.palette.borderSoft;

// Card styling
<article className="rounded-2xl border p-4" style={surface.card}>

// Muted text
<p style={surface.mutedText}>

// Accent pill/badge
<span style={{
  backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.12),
  borderColor: crew.theme.palette.accentMain,
  color: crew.theme.palette.accentMain,
}}>

// Gold CTA button
<button style={{
  backgroundColor: crew.theme.palette.accentMain,
  color: readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette),
  boxShadow: `0 4px 12px ${withAlpha(crew.theme.palette.accentMain, 0.2)}`,
}}>

// Glow effect on hover (CSS custom property + Tailwind)
className="transition-shadow hover:shadow-[0_0_20px_var(--cart-glow)]"
style={{ ["--cart-glow" as string]: withAlpha(crew.theme.palette.accentMain, 0.4) }}

// ✅ ALLOWED: Status green (discount, availability) — semantic, not franchise-themed
style={{
  backgroundColor: withAlpha("#00C853", 0.1),
  border: `1px solid ${withAlpha("#00C853", 0.3)}`,
  color: "#00C853",
}}

// ✅ ALLOWED: Delete red — universal destructive color
style={{ color: crew.theme.mode === "dark" ? "#FF6B6B" : "#FF3B30" }}
```

---

**→ Next: [TODO3.MD](./TODO3.MD) — Component implementations (all the code)**
