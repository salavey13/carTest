# VIP Bike Landing & Catalog Improvements — Design Specification

**Date:** 2026-06-18
**Author:** Claude (brainstorming session)
**Status:** Approved for implementation

---

## Executive Summary

Redesign root landing page to showcase actual bikes from database with instant load times, improve catalog categorization and filtering, and unify the visual language with gold-on-black VIP Bike aesthetic.

**Key changes:**
1. Root landing: Static, hardcoded bike showcase (no DB/Telegram blocking)
2. Electro-enduro: Filter by `type === "Electric"`
3. Main franchize: Categorize bikes by type + sale status
4. CatalogClient: Consistent 3-spec display with Russian labels
5. Social links: Prominent gold-on-black banner after hero
6. Loading: S1000RR bike GIF (gold on black)

**Estimated scope:** 5 files modified, ~600 lines changed

---

## 1. Root Landing Page (`app/page.tsx`)

### Current Issues
- Client-side only, heavy Framer Motion blocks render
- Hardcoded pricing ("от 1 500 ₽") doesn't match reality (actual: 6 000₽)
- Only shows Falcon GT, missing other bikes
- Bicycle loading component looks "like trash" (client quote)
- Waits for Telegram init (slow connections timeout)

### Design Goals
- Instant load (Server Component, no blocking dependencies)
- Show real bikes with real prices
- Preserve Max's good work (themes, structure, FAQ)
- Gold-on-black aesthetic throughout

### New Structure (Preserving Max's DNA)

```
1. Hero (keep stats, fix numbers)
2. SOCIAL BANNER (NEW - moved from bottom, gold-on-black)
3. Barrier cards (keep as-is)
4. Bike showcase (NEW - 6 curated bikes)
5. How it works (keep as-is)
6. Pricing (fix numbers)
7. FAQ (keep as-is)
8. Contacts (keep as-is)
9. Footer (keep as-is)
```

### Hardcoded Bike Selection

| Slot | Bike | Price | Category |
|------|------|-------|----------|
| Electric Entry | Falcon Pro 2025 | 10 000₽/day | Accessible electro |
| Electric Premium | Y-VOLT Surge V | 12 000₽/day | Flagship 35kW |
| Electric Sport | Ducati Panigale S Electro | 10 000₽/day | Ducati branding |
| ICE Liter | Suzuki GSX-S1000F | 14 000₽/day | 150hp sport-touring |
| ICE Entry | Nibbler 300 4V | 6 000₽/day | Budget-friendly |
| Mini/Commute | Sotion EM01 | Sale 100 000₽ | Ultra-compact |

### Pricing Fixes

| Current | Correct |
|---------|---------|
| "от 1 500 ₽" | "от 6 000 ₽" (lowest: Nibbler/Motoland) |
| "от 10 000 ₽" (day) | 10 000₽ (correct) |
| "от 60 000 ₽" (week) | Keep or adjust based on real multi-day pricing |

### Hero Stats Fixes

| Current | Correct |
|---------|---------|
| "10+ bikes" | "12 bikes" (actual count from CSV) |
| Keep others as-is | - |

### Implementation Notes
- Convert to Server Component (remove `"use client"`)
- Remove Framer Motion dependencies
- Use CSS animations for subtle effects
- Hardcode all bike data inline
- Keep `VIP_BIKE_THEMES`, `SOCIAL_LINKS`, `CONTACT_INFO` constants

---

## 2. Social Banner (New Hero-Adjacent Section)

### Placement
Immediately after hero section, before barrier cards.

### Design — Gold on Black

```
┌────────────────────────────────────────────────────────────────┐
│                    HERO + CTAS                                  │
└────────────────────────────────────────────────────────────────┘
                         ↓ BAM! ↓
┌────────────────────────────────────────────────────────────────┐
│  [VK] [Instagram] [Telegram Bot] [@I_O_S] [WhatsApp]           │
│  Gold icons on black | Hover: gold glow + scale                 │
└────────────────────────────────────────────────────────────────┘
```

### Specification

```tsx
const SOCIAL_BANNER_STYLES = {
  container: "py-12 px-4 bg-[var(--vip-bg-base)]",
  grid: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto",
  card: {
    base: "relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden group",
    style: {
      borderColor: "var(--vip-accent-main)", // #FFD700
      backgroundColor: "transparent",
    },
    hover: {
      boxShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
      transform: "scale(1.05)",
    }
  },
  icon: {
    base: "w-12 h-12 transition-colors duration-300",
    color: "var(--vip-accent-main)", // All gold
  },
  label: {
    base: "text-sm font-semibold",
    color: "var(--vip-text-primary)",
  },
  description: {
    base: "text-xs",
    color: "var(--vip-text-secondary)",
  }
};
```

### Animations
- Subtle pulse on Telegram Bot + Operator cards (CSS keyframes)
- No rainbow gradients — pure gold-on-black
- Hover: Gold glow expansion + 5% scale

### Social Links (Keep Max's Structure)

```tsx
const SOCIAL_LINKS = [
  { id: "vk", label: "VK Group", href: "https://vk.com/vip_bike", icon: <VK svg/> },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/vipbikerental_nn", icon: <IG svg/> },
  { id: "telegram-bot", label: "Telegram Бот", href: BOT_HREF, icon: <TG svg/> },
  { id: "telegram-contact", label: "@I_O_S_NN", href: OPERATOR_HREF, icon: <TG svg/> },
  { id: "whatsapp", label: "WhatsApp", href: "https://wa.me/79200789888", icon: <WA svg/> },
];
```

**Note:** Convert all SVG `fill="currentColor"` to render in gold via CSS.

---

## 3. Loading Component (`app/loading.tsx`)

### Current Issue
- Bicycle SVG that "looks like trash" (client feedback)

### New Design: S1000RR Bike GIF

**Source:** `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif`

**Colorization:** Invert black→white, then apply gold tone

```tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--vip-bg-base)" }}>
      <div className="flex flex-col items-center gap-4">
        {/* Bike GIF — inverted + gold */}
        <img
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Загрузка..."
          className="w-32 h-32 animate-pulse"
          style={{
            filter: "invert(1) sepia(1) saturate(2) hue-rotate(5deg)",
          }}
        />
        <p className="text-sm font-medium" style={{ color: "var(--vip-text-secondary)" }}>
          Загружаем байки...
        </p>
      </div>
    </div>
  );
}
```

**CSS Filter breakdown:**
- `invert(1)` — Flips black→white, white→black
- `sepia(1)` — Adds brown/gold tone
- `saturate(2)` — Intensifies the gold
- `hue-rotate(5deg)` — Fine-tunes to VIP Bike gold

---

## 4. Electro-Enduro Filtering (`app/franchize/[slug]/electro-enduro/page.tsx`)

### Current Issue
- Only filters by name matching (`suzuki`, `kawasaki`)
- Misses Nibbler and Motoland (both ICE bikes)

### Fix: Data-Driven Filter

```typescript
// In electro-enduro/page.tsx, around line 136
const saleItems = items.filter((item) => {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  const isElectric = rs?.type === "Electric";  // ← NEW CHECK

  return (
    (item.saleAvailable || isSaleEnabled(rs?.sale) || SALE_ID_OVERRIDES.has(id))
    && isElectric  // ← MUST BE ELECTRIC
  );
});
```

**Logic:** `saleAvailable AND type === "Electric"`

This excludes:
- Nibbler 300 4V (`type: "ICE"`)
- Motoland Breakout (`type: "ICE"`)
- Suzuki GSX-S1000F (`type: "ICE"`)
- Kawasaki EX650K (`type: "ICE"`)

---

## 5. Main Franchize Categorization (`app/franchize/components/CatalogClient.tsx`)

### Current Behavior
- Shows all items in single list
- No differentiation between bike types

### New Behavior: Three Categories

| Group | Filter | Title |
|-------|--------|-------|
| Electric | `type === "Electric"` | *(no title)* |
| ICE for Sale | `type === "ICE" AND sale === true` | *(no title)* |
| ICE Rent-Only | `type === "ICE" AND sale !== true` | **"Байки партнёров"** |

### Implementation

```typescript
// Add after `orderedCategories` definition (around line 367)
const categorizedItems = useMemo(() => {
  const electric = items.filter(i =>
    (i.rawSpecs as Record<string, unknown>)?.type === "Electric"
  );

  const iceForSale = items.filter(i => {
    const rs = i.rawSpecs as Record<string, unknown> | undefined;
    return rs?.type === "ICE" && (rs?.sale === true || i.saleAvailable);
  });

  const iceRentOnly = items.filter(i => {
    const rs = i.rawSpecs as Record<string, unknown> | undefined;
    return rs?.type === "ICE" && !(rs?.sale === true || i.saleAvailable);
  });

  return [
    { title: "", items: electric },
    { title: "", items: iceForSale },
    { title: "Байки партнёров", items: iceRentOnly },
  ].filter(g => g.items.length > 0);
}, [items]);

// Replace `itemsByCategory` with `categorizedItems` in render
```

**Note:** Empty titles mean no section header — just show the cards.

---

## 6. CatalogClient Spec Display (`app/franchize/components/CatalogClient.tsx`)

### Current Issue
- Shows 3 random specs without labels
- No icon consistency
- English labels in some places

### New Behavior: Consistent 3 Specs with Labels

#### Helper Function

```typescript
// Add near top of file, after `tierVisuals`
function getPrioritySpecs(item: CatalogItemVM): Array<{ label: string; value: string; unit?: string }> {
  const rs = item.rawSpecs as Record<string, unknown> | undefined;
  const isElectric = rs?.type === "Electric";

  if (isElectric) {
    return [
      { label: "Мощность", value: String(rs?.power_kw ?? ""), unit: "кВт" },
      { label: "Скорость", value: String(rs?.top_speed_kmh ?? ""), unit: "км/ч" },
      { label: "Запас хода", value: String(rs?.range_km ?? ""), unit: "км" },
    ].filter(s => s.value !== "" && s.value !== "undefined" && s.value !== "null");
  } else {
    return [
      { label: "Мощность", value: String(rs?.power_hp ?? rs?.bike_power_hp ?? ""), unit: "л.с." },
      { label: "Скорость", value: String(rs?.top_speed_kmh ?? ""), unit: "км/ч" },
      { label: "Объём", value: String(rs?.engine_cc ?? rs?.bike_engine_cc ?? ""), unit: "см³" },
    ].filter(s => s.value !== "" && s.value !== "undefined" && s.value !== "null");
  }
}
```

#### Usage in Cards

**Carousel cards (line ~818):**
```typescript
{/* Speed / spec badge on image */}
{getPrioritySpecs(item).slice(0, 2).map((spec, si) => (
  <span key={`${item.id}-badge-${si}`} className="...">
    {spec.icon && <span>{spec.icon}</span>}
    {spec.value} {spec.unit}
  </span>
))}
```

**Grid cards (line ~937):**
```typescript
{getPrioritySpecs(item).slice(0, 3).map((spec, index) => (
  <span key={`${item.id}-spec-${index}`} className="...">
    <span className="text-[11px]">{spec.icon}</span>
    {spec.value} {spec.unit}
  </span>
))}
```

**Note:** Add spec label above value if space permits:
```tsx
<div className="...">
  <span className="block text-[8px] uppercase opacity-70">{spec.label}</span>
  <span className="font-semibold">{spec.value} {spec.unit}</span>
</div>
```

---

## 7. Item Modal Russian Labels (`app/franchize/modals/Item.tsx`)

### Current Issue
- English labels in spec display

### Fix: Use Russian Labels from Data

```typescript
// Helper to get Russian label from spec_labels
function getRussianLabel(key: string, item: CatalogItemVM): string {
  const specLabels = (item.rawSpecs as Record<string, unknown>)?.spec_labels as Record<string, string> | undefined;
  return specLabels?.[key] || key;
}

// Usage in modal
{Object.entries(item.rawSpecs || {}).map(([key, value]) => (
  <div key={key}>
    <span className="label">{getRussianLabel(key, item)}</span>
    <span className="value">{value}</span>
  </div>
))}
```

**Common labels from CSV:**
- `power_kw` → "Пиковая мощность"
- `top_speed_kmh` → "Максимальная скорость"
- `range_km` → "Запас хода"
- `dailyPrice` → "Аренда (сутки)"
- `engine_cc` / `bike_engine_cc` → "Рабочий объем"
- `power_hp` / `bike_power_hp` → "Мощность (л.с.)"

---

## 8. Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `app/page.tsx` | ~300 | Convert to Server Component, add bike showcase, fix pricing, add social banner |
| `app/loading.tsx` | ~50 | Replace bicycle with S1000RR GIF + gold filter |
| `app/franchize/[slug]/electro-enduro/page.tsx` | ~5 | Add `type === "Electric"` filter |
| `app/franchize/components/CatalogClient.tsx` | ~100 | Add categorization + spec display helper |
| `app/franchize/modals/Item.tsx` | ~50 | Add Russian label helper |

**Total:** ~5 files, ~505 lines changed

---

## 9. Success Criteria

- [ ] Root landing loads instantly (< 1s First Contentful Paint)
- [ ] Landing shows 6 curated bikes with real prices
- [ ] Social banner appears immediately after hero (gold-on-black)
- [ ] Electro-enduro shows only electric bikes (no ICE)
- [ ] Main franchize categorizes bikes into 3 groups
- [ ] Catalog cards show consistent 3 specs with Russian labels
- [ ] Loading shows gold bike GIF (no bicycle)
- [ ] Max's contributions preserved (FAQ, how-it-works, etc.)

---

## 10. Technical Notes

### Performance
- Root landing: Server Component, zero client JS for render
- CSS animations only (no Framer Motion on landing)
- Inline critical CSS for above-fold content

### Accessibility
- Social banner: Semantic `<a>` tags with proper labels
- Alt text for all images (bike GIF, bike photos)
- Keyboard navigation for all interactive elements

### Future Enhancements (Out of Scope)
- Shared `BikeShowcaseCard` component (reuse landing cards in franchize)
- Hybrid landing with async DB fetch (non-blocking)
- Spec label localization system (beyond Russian)

---

## Appendix A: Bike Data for Landing (Hardcoded)

```typescript
const LANDING_BIKES = [
  {
    id: "falcon-pro-2025",
    title: "79BIKE Falcon Pro 2025",
    subtitle: "Electric Enduro",
    pricePerDay: 10000,
    priceLabel: "от 10 000 ₽/день",
    salePrice: 310000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-pro/image_1.jpg",
    specs: [
      { label: "Мощность", value: "10", unit: "кВт" },
      { label: "Скорость", value: "100", unit: "км/ч" },
      { label: "Запас хода", value: "120", unit: "км" },
    ],
    category: "electric",
    rentLink: "/franchize/vip-bike",
    saleLink: "/franchize/vip-bike/configurator",
  },
  // ... 5 more bikes with same structure
];
```

## Appendix B: CSS Variables (VIP Bike Palette)

```css
:root {
  --vip-bg-base: #0A0A0A;
  --vip-bg-card: #1A1A1A;
  --vip-accent-main: #FFD700;     /* Gold */
  --vip-accent-hover: #FFC125;    /* Darker gold */
  --vip-text-primary: #FFFAF0;
  --vip-text-secondary: #D4AF37;  /* Muted gold */
  --vip-border-soft: #2A2A2A;
}
```

---

**End of Specification**

*This spec preserves Max's contributions (Max was here ✉️) while grounding the experience in real data and instant performance.*
