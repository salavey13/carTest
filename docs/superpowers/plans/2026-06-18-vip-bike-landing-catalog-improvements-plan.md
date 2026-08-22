# VIP Bike Landing & Catalog Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign root landing to showcase actual bikes with instant load, improve electro-enduro filtering, add catalog categorization, and unify visual language with gold-on-black aesthetic.

**Architecture:** 
- Root landing: Server Component with hardcoded bike data (no DB/Telegram blocking)
- Social banner: Gold-on-black with S1000RR GIF loader
- Catalog filtering: Data-driven using `specs.type` + `specs.sale`
- Spec display: Consistent 3-spec priority with Russian labels

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, Supabase (data source)

---

## File Structure

| File | Responsibility | Lines |
|------|---------------|-------|
| `app/loading.tsx` | Loading component with S1000RR GIF (gold on black) | ~40 |
| `app/page.tsx` | Root landing - Server Component with hardcoded bikes, social banner, fixed pricing | ~400 |
| `app/franchize/[slug]/electro-enduro/page.tsx` | Electro-enduro page - add `type === "Electric"` filter | ~5 |
| `app/franchize/components/CatalogClient.tsx` | Catalog - categorization helper + spec display helper | ~100 |
| `app/franchize/modals/Item.tsx` | Item modal - Russian label helper | ~50 |

**Total:** ~595 lines across 5 files

---

## Task 1: Replace Loading Component (Bicycle → S1000RR GIF)

**Files:**
- Modify: `app/loading.tsx`

- [ ] **Step 1: Replace entire loading component with S1000RR GIF**

```tsx
// app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="flex flex-col items-center gap-4">
        {/* Bike GIF — inverted black→white, then sepia+gold tone */}
        <img
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Загрузка..."
          className="w-32 h-32 animate-pulse"
          style={{
            filter: "invert(1) sepia(1) saturate(2) hue-rotate(5deg)",
          }}
        />
        <p className="text-sm font-medium" style={{ color: "#D4AF37" }}>
          Загружаем байки...
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server to verify loading screen appears**

Run: `npm run dev`
Visit: `http://localhost:3000` (or refresh to trigger loading state)
Expected: Gold S1000RR bike on black background, pulsing

- [ ] **Step 3: Commit**

```bash
git add app/loading.tsx
git commit -m "feat(replace): loading component - bicycle to S1000RR GIF with gold filter"
```

---

## Task 2: Add Spec Display Helper to CatalogClient

**Files:**
- Modify: `app/franchize/components/CatalogClient.tsx` (add function after `tierVisuals`, around line 66)

- [ ] **Step 1: Add `getPrioritySpecs` helper function**

```typescript
// Add after `tierVisuals` function (around line 66)

function getPrioritySpecs(item: CatalogItemVM): Array<{ label: string; value: string; unit: string }> {
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

- [ ] **Step 2: Replace carousel card spec badges (around line 818)**

Find this code in carousel card section:
```typescript
{getVisibleSpecChips(item).slice(0, 2).map((spec, si) => (
```

Replace with:
```typescript
{getPrioritySpecs(item).slice(0, 2).map((spec, si) => (
  <span key={`${item.id}-badge-${si}`} className="inline-flex items-center gap-1 rounded-lg bg-[var(--catalog-bg)]/65 px-1.5 py-1 text-[9px] font-semibold text-[var(--catalog-accent)] backdrop-blur-sm">
    <span className="block text-[8px] uppercase opacity-70 leading-tight">{spec.label}</span>
    <span className="text-[10px]">{spec.value} {spec.unit}</span>
  </span>
))}
```

- [ ] **Step 3: Replace grid card spec badges (around line 937)**

Find this code in grid card section:
```typescript
{getVisibleSpecs.length > 0 && (
  <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
    {getVisibleSpecs.slice(0, 3).map((spec, index) => (
```

Replace with:
```typescript
{(() => {
  const prioritySpecs = getPrioritySpecs(item);
  return prioritySpecs.length > 0 ? (
    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
      {prioritySpecs.slice(0, 3).map((spec, index) => (
        <span key={`${item.id}-spec-${index}`} className="inline-flex flex-col items-center gap-0.5 rounded-lg bg-[var(--catalog-bg)]/65 px-2 py-1 text-[10px] font-semibold text-[var(--catalog-accent)] backdrop-blur-sm">
          <span className="text-[8px] uppercase opacity-70 leading-none">{spec.label}</span>
          <span className="leading-tight">{spec.value} {spec.unit}</span>
        </span>
      ))}
    </div>
  ) : null;
})()}
```

- [ ] **Step 4: Run dev server and verify spec display**

Run: `npm run dev`
Visit: `http://localhost:3000/franchize/vip-bike`
Expected: 
- Electric bikes show: Мощность (кВт), Скорость (км/ч), Запас хода (км)
- ICE bikes show: Мощность (л.с.), Скорость (км/ч), Объём (см³)
- Labels appear above values in grid cards

- [ ] **Step 5: Commit**

```bash
git add app/franchize/components/CatalogClient.tsx
git commit -m "feat(catalog): add priority spec display with Russian labels"
```

---

## Task 3: Add Categorization Helper to CatalogClient

**Files:**
- Modify: `app/franchize/components/CatalogClient.tsx` (add useMemo after `orderedCategories`, around line 367)

- [ ] **Step 1: Add `categorizedItems` useMemo**

Find this line (around line 367):
```typescript
const orderedCategories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))), [items]);
```

Add immediately after:
```typescript
// Categorize bikes by type + sale status for vip-bike franchize
const categorizedItems = useMemo(() => {
  const electric = items.filter(i =>
    (i.rawSpecs as Record<string, unknown> | undefined)?.type === "Electric"
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
```

- [ ] **Step 2: Update render to use categorizedItems when slug is vip-bike**

Find the render section that uses `itemsByCategory` (around line 733):
```typescript
{itemsByCategory.length === 0 ? (
```

Add conditional logic before this:
```typescript
{/* Use categorized items for vip-bike, itemsByCategory for others */}
{(() => {
  const displayGroups = (slug === "vip-bike" || crew.slug === "vip-bike") ? categorizedItems : itemsByCategory;
  
  return displayGroups.length === 0 ? (
```

- [ ] **Step 3: Update the closing of conditional logic**

Find the end of the empty state section (around line 731):
```typescript
  ) : (
    <div className="space-y-6">
      {itemsByCategory.map((group) => (
```

Replace with:
```typescript
  ) : (
    <div className="space-y-6">
      {displayGroups.map((group) => (
```

- [ ] **Step 4: Update the category rendering to conditionally show title**

Find the section header inside the map (around line 735):
```typescript
<section key={group.category} id={toCategoryId(group.category)} data-category={group.category} data-count={group.items.length}>
  <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">
      {group.category}
    </h2>
```

Replace with:
```typescript
<section key={group.category || group.title || "section"} id={toCategoryId(group.category || group.title || "section")} data-category={group.category || group.title} data-count={group.items.length}>
  {group.title && (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">
        {group.title}
      </h2>
```

And close the conditional properly - find the closing div for the header (around line 743):
```typescript
    </div>
  )}
```

Make sure the structure is:
```typescript
{group.title && (
  <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">
      {group.title}
    </h2>
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--catalog-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--catalog-muted)]">
      {group.items.length} шт.
    </span>
  </div>
)}
```

- [ ] **Step 5: Run dev server and verify categorization**

Run: `npm run dev`
Visit: `http://localhost:3000/franchize/vip-bike`
Expected:
- Electric bikes shown first (no title)
- ICE sale bikes shown next (no title)
- ICE rent-only bikes shown last with "Байки партнёров" header

- [ ] **Step 6: Commit**

```bash
git add app/franchize/components/CatalogClient.tsx
git commit -m "feat(catalog): add vip-bike categorization by type + sale status"
```

---

## Task 4: Add Electric Filter to Electro-Enduro Page

**Files:**
- Modify: `app/franchize/[slug]/electro-enduro/page.tsx`

- [ ] **Step 1: Update saleItems filter to include electric check**

Find this code (around line 136):
```typescript
  const saleItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    return (
      item.saleAvailable ||
      isSaleEnabled(item.rawSpecs?.sale) ||
      SALE_ID_OVERRIDES.has(id)
    );
  });
```

Replace with:
```typescript
  const saleItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    const rs = item.rawSpecs as Record<string, unknown> | undefined;
    const isElectric = rs?.type === "Electric";
    
    return (
      isElectric &&  // ← MUST BE ELECTRIC
      (item.saleAvailable ||
      isSaleEnabled(rs?.sale) ||
      SALE_ID_OVERRIDES.has(id))
    );
  });
```

- [ ] **Step 2: Update rentItems filter to include electric check**

Find this code (around line 144):
```typescript
  const rentItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    return (
      item.availabilityStatus === "available" ||
      isRentEnabled(item.rawSpecs?.rent) ||
      RENT_ID_OVERRIDES.has(id)
    );
  });
```

Replace with:
```typescript
  const rentItems = items.filter((item) => {
    const id = item.id.toLowerCase();
    const rs = item.rawSpecs as Record<string, unknown> | undefined;
    const isElectric = rs?.type === "Electric";
    
    return (
      isElectric &&  // ← MUST BE ELECTRIC
      (item.availabilityStatus === "available" ||
      isRentEnabled(rs?.rent) ||
      RENT_ID_OVERRIDES.has(id))
    );
  });
```

- [ ] **Step 3: Run dev server and verify filtering**

Run: `npm run dev`
Visit: `http://localhost:3000/franchize/vip-bike/electro-enduro`
Expected:
- Only electric bikes shown (Ducati, Falcon, Sequence, Y-VOLT, Sotion, Horwin)
- No ICE bikes (no Nibbler, Motoland, Suzuki, Kawasaki)

- [ ] **Step 4: Commit**

```bash
git add app/franchize/[slug]/electro-enduro/page.tsx
git add app/franchize/[slug]/electro-enduro
git commit -m "feat(electro-enduro): filter by type === Electric to exclude ICE bikes"
```

---

## Task 5: Add Russian Label Helper to Item Modal

**Files:**
- Modify: `app/franchize/modals/Item.tsx`

- [ ] **Step 1: Add `getRussianLabel` helper function**

Add this function near the top of the file, after imports (around line 15):

```typescript
// Helper to get Russian label from spec_labels in rawSpecs
function getRussianLabel(key: string, item: CatalogItemVM): string {
  const specLabels = (item.rawSpecs as Record<string, unknown> | undefined)?.spec_labels as Record<string, string> | undefined;
  return specLabels?.[key] || key;
}
```

- [ ] **Step 2: Find where specs are rendered in modal**

Search for pattern like:
- `Object.entries(item.rawSpecs || {}).map`
- `item.specs?.map`
- Any section showing bike specifications

The exact location will vary — look for sections displaying power, speed, range, etc.

- [ ] **Step 3: Replace English labels with Russian**

Find any hardcoded English labels in spec rendering and replace with calls to `getRussianLabel`. For example, if you find:

```typescript
<span>Power: {item.power_kw} kW</span>
```

Replace with:
```typescript
<span>{getRussianLabel("power_kw", item)}: {item.power_kw} кВт</span>
```

Common label mappings from CSV:
- `power_kw` → "Пиковая мощность"
- `top_speed_kmh` → "Максимальная скорость"  
- `range_km` → "Запас хода"
- `dailyPrice` → "Аренда (сутки)"
- `engine_cc` / `bike_engine_cc` → "Рабочий объем"
- `power_hp` / `bike_power_hp` → "Мощность (л.с.)"
- `torque_nm` → "Крутящий момент"
- `weight_kg` → "Масса"
- `seat_height_mm` → "Высота по седлу"

- [ ] **Step 4: Run dev server and verify Russian labels**

Run: `npm run dev`
Visit: `http://localhost:3000/franchize/vip-bike`
Click on any bike card to open modal
Expected: All spec labels shown in Russian

- [ ] **Step 5: Commit**

```bash
git add app/franchize/modals/Item.tsx
git commit -m "feat(modal): use Russian labels from spec_labels for bike specs"
```

---

## Task 6: Create Server Component Landing Page

**Files:**
- Modify: `app/page.tsx` (complete refactor)

- [ ] **Step 1: Backup current page.tsx**

```bash
cp app/page.tsx app/page.tsx.max-backup
```

- [ ] **Step 2: Create new Server Component landing**

Replace entire `app/page.tsx` content with:

```tsx
import Link from "next/link";
import Image from "next/image";

/* ────────────────────────────────────────────
   VIP Bike Theme Palette (preserved from Max's work)
   ──────────────────────────────────────────── */
const VIP_BIKE_THEMES = {
  dark: {
    bgBase: "#0A0A0A",
    bgCard: "#1A1A1A",
    accentMain: "#FFD700",
    accentMainHover: "#FFC125",
    textPrimary: "#FFFAF0",
    textSecondary: "#D4AF37",
    borderSoft: "#2A2A2A",
  },
  light: {
    bgBase: "#FAFAFA",
    bgCard: "#FFFFFF",
    accentMain: "#00FFFF",
    accentMainHover: "#00CED1",
    textPrimary: "#1A1A1A",
    textSecondary: "#4A4A4A",
    borderSoft: "#E0F7FA",
  },
};

/* ────────────────────────────────────────────
   Hero Image (preserved from Max's work)
   ──────────────────────────────────────────── */
const HERO_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";

/* ────────────────────────────────────────────
   CTA targets
   ──────────────────────────────────────────── */
const CATALOG_HREF = "/franchize/vip-bike";
const BOT_HREF = "https://t.me/oneBikePlsBot";
const OPERATOR_HREF = "https://t.me/I_O_S_NN";
const CONFIGURATOR_HREF = "/franchize/vip-bike/configurator";
const MAP_HREF = "/franchize/vip-bike/map-riders";

/* ────────────────────────────────────────────
   Social Links Configuration (preserved from Max's work)
   ──────────────────────────────────────────── */
const SOCIAL_LINKS = [
  {
    id: "vk",
    label: "VK Group",
    href: "https://vk.com/vip_bike",
    description: "Подписывайтесь на группу",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 2.7 4.675 2.85 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.49c0 .373.17.508.271.508.22 0 .407-.135.813-.542 1.254-1.406 1.558-1.664 4.031-1.664 4.031.248-.694.248-1.289.248-1.289.17-.49.085-.744-.576-.744h-1.744c-.66 0-.864.525-2.05 1.727-1.033 1-1.49 1.135-1.744 1.135-.356 0-.458-.102-.458-.593v-1.575c0-.424.135-.678 1.253-.678 1.846 0 3.896 1.12 5.335 3.202 1.253 1.12 1.653 1.591 1.653 1.591.17.49-.085.744-.576.744z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vipbikerental_nn",
    description: "Фотографии и сторис",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.227-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069 3.205 0 3.584.012 4.849.069 3.227.149 4.771 1.699 4.919 4.92.058 1.265.07 1.644.07 4.849 0 3.204-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.22-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    id: "telegram-bot",
    label: "Telegram Бот",
    href: BOT_HREF,
    description: "Забронируйте байк в боте",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: "telegram-contact",
    label: "@I_O_S_NN",
    href: OPERATOR_HREF,
    description: "Связь с оператором",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/79200789888",
    description: "Напишите нам в WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

const CONTACT_INFO = {
  phone: "+7 9200-789-888",
  phoneHref: "tel:+79200789888",
  address: "Н. Н. пл. Комсомольская 2",
  workingHours: "10:00 — 22:00 (ежедневно)",
};

/* ────────────────────────────────────────────
   Hardcoded Bike Showcase (real data from CSV)
   ──────────────────────────────────────────── */
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
    rentLink: CATALOG_HREF,
    saleLink: CONFIGURATOR_HREF,
  },
  {
    id: "y-volt-surge-v",
    title: "Y-VOLT Surge V 35 кВт",
    subtitle: "Electric Enduro",
    pricePerDay: 12000,
    priceLabel: "от 12 000 ₽/день",
    salePrice: 550000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/y-volt-surge-v/image_1.jpg",
    specs: [
      { label: "Мощность", value: "35", unit: "кВт" },
      { label: "Скорость", value: "125", unit: "км/ч" },
      { label: "Запас хода", value: "150", unit: "км" },
    ],
    rentLink: CATALOG_HREF,
    saleLink: CONFIGURATOR_HREF,
  },
  {
    id: "ducati-panigale-s-electro",
    title: "Ducati Panigale S Electro",
    subtitle: "Electric Sport",
    pricePerDay: 10000,
    priceLabel: "от 10 000 ₽/день",
    salePrice: 600000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/ducati-panigale-s-electro/image_1.jpg",
    specs: [
      { label: "Мощность", value: "5", unit: "кВт" },
      { label: "Скорость", value: "120", unit: "км/ч" },
      { label: "Запас хода", value: "150", unit: "км" },
    ],
    rentLink: CATALOG_HREF,
    saleLink: CONFIGURATOR_HREF,
  },
  {
    id: "suzuki-gsx-s1000f",
    title: "Suzuki GSX-S1000F",
    subtitle: "Sport-Touring",
    pricePerDay: 14000,
    priceLabel: "от 14 000 ₽/день",
    salePrice: null,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/suzuki-gsx-s1000f/image_1.jpg",
    specs: [
      { label: "Мощность", value: "150", unit: "л.с." },
      { label: "Скорость", value: "255", unit: "км/ч" },
      { label: "Объём", value: "999", unit: "см³" },
    ],
    rentLink: CATALOG_HREF,
    saleLink: null,
  },
  {
    id: "nibbler-regumoto-4v",
    title: "Regulmoto Nibbler 300 4V",
    subtitle: "Naked",
    pricePerDay: 6000,
    priceLabel: "от 6 000 ₽/день",
    salePrice: 265000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nibbler-regumoto-4v/image_1.jpg",
    specs: [
      { label: "Мощность", value: "27", unit: "л.с." },
      { label: "Скорость", value: "150", unit: "км/ч" },
      { label: "Объём", value: "300", unit: "см³" },
    ],
    rentLink: CATALOG_HREF,
    saleLink: CONFIGURATOR_HREF,
  },
  {
    id: "sotion-em01",
    title: "Sotion EM01",
    subtitle: "Mini Electric",
    pricePerDay: 0,
    priceLabel: "Только продажа",
    salePrice: 100000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sotion-em01/image_1.jpg",
    specs: [
      { label: "Мощность", value: "3", unit: "кВт" },
      { label: "Скорость", value: "45", unit: "км/ч" },
      { label: "Запас хода", value: "50", unit: "км" },
    ],
    rentLink: null,
    saleLink: CONFIGURATOR_HREF,
  },
];

/* ────────────────────────────────────────────
   Pricing Tiers (preserved from Max's work, numbers fixed)
   ──────────────────────────────────────────── */
const PRICING_TIERS = [
  {
    id: "hour",
    label: "Час",
    emoji: "⚡️",
    price: "от 5 000 ₽",
    per: "/ час",
    note: "минимум 1 час",
    features: [
      "Шлем + перчатки в комплекте",
      "200 км/сутки включено (для ДВС)",
      "150 км/сутки включено (для электро)",
      "Страховка депозита от 20 000 ₽",
    ],
    cta: "Покататься часок",
    href: BOT_HREF,
    highlighted: false,
  },
  {
    id: "day",
    label: "Сутки",
    emoji: "🔥",
    price: "от 6 000 ₽",
    per: "/ сутки",
    note: "бронь на 18:00→10:00",
    features: [
      "Всё из тарифа «Час», но на сутки",
      "Скидка 10% от 3 суток",
      "Скидка 15% от 7 суток",
      "СТС вместо депозита — без денег в кассу",
      "Доставка по городу — 500 ₽",
    ],
    cta: "Забрать на сутки",
    href: BOT_HREF,
    highlighted: true,
  },
  {
    id: "week",
    label: "Неделя",
    emoji: "🚀",
    price: "от 42 000 ₽",
    per: "/ 7 суток",
    note: "скидка 20% от 14 суток",
    features: [
      "Всё из тарифа «Сутки», но дешевле",
      "Приоритетное бронирование",
      "Экипировка с брендированием (по запросу)",
      "Выделенный менеджер в Telegram",
      "Бесплатная доставка по городу",
    ],
    cta: "Уйти в неделю",
    href: BOT_HREF,
    highlighted: false,
  },
];

/* ────────────────────────────────────────────
   FAQ Items (preserved from Max's work)
   ──────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Так, мне правда не нужна категория А? 🤨",
    a: "Правда. Наши электромотоциклы до 4 кВт — это L1e-B, по закону категория B (или M, если есть). Права обычные, без мотоциклетной категории. Покажешь — садись.",
  },
  {
    q: "А ОСАГО и ПТС точно не нужны?",
    a: "Точно. Электро до 4 кВт не регистрируется в ГИБДД, ПТС нет, ОСАГО нет. Никакой бюрократии. Сел — поехал.",
  },
  {
    q: "А если без прав категории B? 🙃",
    a: "Тогда никак — закон есть закон. Но если у тебя M или A1 — тоже прокатит, позвони оператору, подберём байк под твою категорию.",
  },
  {
    q: "Что за СТС вместо депозита? 🪪",
    a: "Вместо денежного залога 20 000 ₽ можно оставить оригинал СТС своего автомобиля или мотоцикла. СТС возвращаем в течение 3 рабочих дней после возврата байка. Удобно, если не хочешь замораживать кэш.",
  },
  {
    q: "Можно ли обменять/вернуть байк? 💸",
    a: "Да. Первые 10 дней — тест-драйв с возвратом денег, если что-то не зашло. Возврат — по акту приёма-передачи, деньги возвращаем в течение 3 рабочих дней.",
  },
  {
    q: "А если я уроню или утоплю? 😬",
    a: "Царапины — по прайсу (от 5 000 ₽). Глубокие повреждения — по счёту СТО. Утопление — стоимость восстановительного ремонта. Всё прозрачно, в договоре прописано до копейки. GPS-трекер на каждом байке — это не слежка, это страховка от «байк угнали».",
  },
  {
    q: "Доставка есть? 📍",
    a: "Да. По Нижнему Новгороду — 500 ₽. За пределы города — по согласованию. Привозим и забираем сами, тебе не надо никуда ехать.",
  },
  {
    q: "А экипировка? 🪖",
    a: "Шлем и перчатки — обязательно, выдаём бесплатно. Куртка/черепаха/второй шлем — по запросу. За утрату или порчу экипировки — по прайсу из приложения №3 к договору.",
  },
];

/* ────────────────────────────────────────────
   How It Works Steps (preserved from Max's work)
   ──────────────────────────────────────────── */
const HOW_IT_WORKS_STEPS = [
  {
    n: "01",
    title: "Выбрал",
    desc: "Жмёшь «Выбрать байк» → попадаешь в каталог. Смотришь фото, читаешь спеку, выбираешь по сердцу.",
    emoji: "👆",
  },
  {
    n: "02",
    title: "Забронировал",
    desc: "В боте @oneBikePlsBot — 2 клика: даты + формат поездки. Депозит или СТС — на твой выбор.",
    emoji: "📲",
  },
  {
    n: "03",
    title: "Забрал",
    desc: "Приезжаешь на пл. Комсомольская 2. Подписываешь договор (3 минуты), получаешь байк + экипировку.",
    emoji: "🔑",
  },
  {
    n: "04",
    title: "Катался",
    desc: "Откручиваешь ручку. Возвращаешь в согласованное время — забираешь депозит/СТС. Всё.",
    emoji: "🏍️",
  },
];

/* ────────────────────────────────────────────
   Hero Stats (fixed numbers)
   ──────────────────────────────────────────── */
const HERO_STATS = [
  { value: 1000, suffix: "+", label: "поездок" },
  { value: 12, suffix: "", label: "байков" },
  { value: 4.9, suffix: "★", label: "рейтинг", decimals: 1 },
  { value: 3, suffix: " года", label: "на рынке" },
];

/* ────────────────────────────────────────────
   Barrier Cards (preserved from Max's work)
   ──────────────────────────────────────────── */
const BARRIER_CARDS = [
  {
    id: "prohodimost",
    number: "01",
    title: "Поле, лес, грязь, лестницы 🌲",
    description:
      "Кочки, корни, песок, снег, подъёмы и спуски. Куда сам дошёл — туда и заехал. В обзорах «корни съел как нефиг нафиг», едет по кроссовой трассе наравне с бензином.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b1-prohodimost.jpeg",
  },
  {
    id: "razgon",
    number: "02",
    title: "Выстреливает из рогатки 🚀",
    description:
      "Электро-тяга бьёт мгновенно — без сцепления и передач. Проваливаешься в кресло как в суперкаре. Открутил ручку — и поехал, на максимум сразу.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
  },
  {
    id: "voda",
    number: "03",
    title: "Топили в озере — едет 🌊",
    description:
      "Влагозащита IP67. На тесте погружали в ледяное озеро — завёлся, год катается. Лужи, дождь, мокрая трава — без последствий.",
    image:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b3-voda.jpeg",
  },
];

/* ────────────────────────────────────────────
   Social Banner Component (gold-on-black)
   ──────────────────────────────────────────── */
function SocialBanner() {
  return (
    <section className="py-16 px-4" style={{ backgroundColor: "var(--vip-bg-base, #0A0A0A)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden"
              style={{
                borderColor: "var(--vip-accent-main, #FFD700)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 30px rgba(255, 215, 0, 0.4)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <div
                className="w-12 h-12 transition-colors duration-300"
                style={{ color: "var(--vip-accent-main, #FFD700)" }}
              >
                {social.icon}
              </div>
              <div className="text-center">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--vip-text-primary, #FFFAF0)" }}
                >
                  {social.label}
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--vip-text-secondary, #D4AF37)" }}
                >
                  {social.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Bike Showcase Card
   ──────────────────────────────────────────── */
function BikeShowcaseCard({ bike }: { bike: typeof LANDING_BIKES[0] }) {
  return (
    <Link
      href={bike.rentLink || bike.saleLink || "#"}
      className="group overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02]"
      style={{
        borderColor: "var(--vip-border-soft, #2A2A2A)",
        backgroundColor: "var(--vip-bg-card, #1A1A1A)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--vip-accent-main, #FFD700)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--vip-border-soft, #2A2A2A)";
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={bike.imageUrl}
          alt={bike.title}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{
            background: "linear-gradient(to top, rgba(10,10,10,0.95), transparent)",
          }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--vip-text-secondary, #D4AF37)" }}>
            {bike.subtitle}
          </p>
          <h3 className="text-xl font-bold" style={{ color: "var(--vip-text-primary, #FFFAF0)" }}>
            {bike.title}
          </h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          {bike.specs.map((spec) => (
            <span
              key={spec.label}
              className="text-xs px-2 py-1 rounded-full border"
              style={{
                borderColor: "var(--vip-accent-main, #FFD700)",
                color: "var(--vip-accent-main, #FFD700)",
              }}
            >
              {spec.value} {spec.unit}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--vip-accent-main, #FFD700)" }}>
            {bike.priceLabel}
          </p>
          {bike.salePrice && (
            <p className="text-sm" style={{ color: "var(--vip-text-secondary, #D4AF37)" }}>
              {bike.salePrice.toLocaleString("ru-RU")} ₽
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ────────────────────────────────────────────
   Main Page Component (Server Component)
   ──────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      {/* CSS Variables Injection */}
      <style jsx global>{`
        :root {
          --vip-bg-base: #0A0A0A;
          --vip-bg-card: #1A1A1A;
          --vip-accent-main: #FFD700;
          --vip-accent-hover: #FFC125;
          --vip-text-primary: #FFFAF0;
          --vip-text-secondary: #D4AF37;
          --vip-border-soft: #2A2A2A;
        }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--vip-bg-base)" }}>
        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "rgba(10,10,10,0.8)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-hover))" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-bg-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M5 16v-4a8 8 0 0116 0v4" />
                  <circle cx="8" cy="16" r="2" />
                  <circle cx="16" cy="16" r="2" />
                  <path d="M10 16h4" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight" style={{ color: "var(--vip-text-primary)" }}>
                  VIP BIKE ELECTRO
                </h1>
                <p className="text-[10px] leading-tight hidden sm:block" style={{ color: "var(--vip-text-secondary)" }}>
                  Электромотоциклы без категории А
                </p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              {[
                { label: "Каталог", href: CATALOG_HREF },
                { label: "Конфигуратор", href: CONFIGURATOR_HREF },
                { label: "Карта", href: MAP_HREF },
                { label: "Контакты", href: "#contacts" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="transition-colors duration-200 hover:opacity-80" style={{ color: "var(--vip-text-secondary)" }}>
                  {link.label}
                </Link>
              ))}
              <Link
                href={CATALOG_HREF}
                className="px-5 py-2 rounded-full font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}
              >
                Забронировать
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          {/* ─── HERO ─── */}
          <section className="relative min-h-[80vh] flex items-center overflow-hidden">
            <div className="absolute inset-0 z-0">
              <Image
                src={HERO_IMAGE}
                alt="VIP BIKE ELECTRO"
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.95) 50%, #0A0A0A 100%)",
                }}
              />
            </div>
            <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
              <div className="inline-block mb-6 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                ⚡️ Электромотоциклы в Нижнем Новгороде
              </div>
              <h2 className="text-5xl sm:text-7xl md:text-8xl font-black mb-6 leading-[0.95] tracking-tight" style={{ color: "var(--vip-text-primary)" }}>
                VIP <span style={{ color: "var(--vip-accent-main)" }}>BIKE</span> ELECTRO
              </h2>
              <p className="text-xl md:text-2xl max-w-2xl mx-auto mb-4 font-medium" style={{ color: "var(--vip-text-primary)" }}>
                Электро-кайф без заморочек 🏍️💨
              </p>
              <p className="text-base md:text-lg max-w-2xl mx-auto mb-10" style={{ color: "var(--vip-text-secondary)" }}>
                Без категории А. Без ОСАГО. Без ПТС. По правам B — сел и поехал. Мощно, тихо, экологично.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  href={CATALOG_HREF}
                  className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}
                >
                  Выбрать байк →
                </Link>
                <Link
                  href={BOT_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ border: "2px solid var(--vip-accent-main)", color: "var(--vip-accent-main)" }}
                >
                  Бронь в боте
                </Link>
              </div>
              {/* Hero Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-16 pt-8 border-t" style={{ borderColor: "var(--vip-border-soft)" }}>
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-4xl md:text-5xl font-black mb-1" style={{ color: "var(--vip-accent-main)" }}>
                      {stat.value.toLocaleString("ru-RU")}{stat.suffix}
                    </div>
                    <div className="text-xs md:text-sm uppercase tracking-wide" style={{ color: "var(--vip-text-secondary)" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── SOCIAL BANNER ─── */}
          <SocialBanner />

          {/* ─── BARRIER CARDS ─── */}
          <section className="py-20 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  Почему мы, а не бензин ⛽️❌
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Три барьера,{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>которые мы снесли</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Тестили 79bike Falcon PRO везде: город, просёлок, снег, грязь, лёд. Без пинков, без отказов, без драмы.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {BARRIER_CARDS.map((card) => (
                  <div key={card.id} className="overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02]" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "var(--vip-bg-card)" }}>
                    <div className="relative aspect-video overflow-hidden">
                      <Image src={card.image} alt={card.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,215,0,0.2)", border: "1px solid var(--vip-accent-main)" }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-accent-main)" strokeWidth="2" className="w-5 h-5">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                        </div>
                        <span className="text-2xl font-bold text-white drop-shadow-lg">{card.number}</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="text-xl font-bold mb-3" style={{ color: "var(--vip-text-primary)" }}>{card.title}</h4>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{card.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── BIKE SHOWCASE ─── */}
          <section className="py-20 px-4" style={{ backgroundColor: "rgba(26,26,26,0.5)" }}>
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  Наши байки
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Электро и бензин —{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>выбирай свой</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  От доступного новичку до литрового спорт-тура. Прокатись перед покупкой.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {LANDING_BIKES.map((bike) => (
                  <BikeShowcaseCard key={bike.id} bike={bike} />
                ))}
              </div>
              <div className="text-center mt-12">
                <Link
                  href={CATALOG_HREF}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}
                >
                  Смотреть все байки в каталоге →
                </Link>
              </div>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section className="py-20 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  Как это работает 🛠️
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Забери. Покатайся.{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>Верни.</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  От «хочу» до «катюсь» — 15 минут. Без очередей, без бумажной волокиты, без звонков «а можно забронировать?».
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 z-0" style={{ background: "linear-gradient(to right, transparent, var(--vip-accent-main), transparent)", opacity: 0.3 }} />
                {HOW_IT_WORKS_STEPS.map((step) => (
                  <div key={step.n} className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative w-24 h-24 rounded-full flex items-center justify-center mb-5 text-4xl" style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))", border: "2px solid rgba(255,215,0,0.4)" }}>
                      <span>{step.emoji}</span>
                      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ background: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>
                        {step.n}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold mb-2" style={{ color: "var(--vip-text-primary)" }}>{step.title}</h4>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>{step.desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-14">
                <Link
                  href={BOT_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}
                >
                  Погнали в бота →
                </Link>
              </div>
            </div>
          </section>

          {/* ─── PRICING ─── */}
          <section className="py-20 px-4" style={{ backgroundColor: "rgba(26,26,26,0.5)" }}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  Тарифы 💰
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Платишь за время,{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>не за нервы</span>
                </h3>
                <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Никаких скрытых платежей. Депозит или СТС — на выбор. Скидки от объёма работают автоматически.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {PRICING_TIERS.map((tier) => (
                  <div key={tier.id} className="relative flex flex-col rounded-3xl border-2 p-6 md:p-8" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: tier.highlighted ? "var(--vip-accent-main)" : "var(--vip-border-soft)", boxShadow: tier.highlighted ? "0 20px 60px rgba(255,215,0,0.2)" : "none" }}>
                    {tier.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide" style={{ background: "var(--vip-accent-main)", color: "var(--vip-bg-base)" }}>
                        🔥 Хит
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <div className="text-4xl mb-2">{tier.emoji}</div>
                      <h4 className="text-xl font-bold uppercase tracking-wide" style={{ color: "var(--vip-text-primary)" }}>{tier.label}</h4>
                      <p className="text-xs mt-1" style={{ color: "var(--vip-text-secondary)" }}>{tier.note}</p>
                    </div>
                    <div className="text-center mb-6">
                      <span className="text-3xl md:text-4xl font-black" style={{ color: "var(--vip-accent-main)" }}>{tier.price}</span>
                      <span className="text-sm ml-1" style={{ color: "var(--vip-text-secondary)" }}>{tier.per}</span>
                    </div>
                    <ul className="flex-1 space-y-3 mb-6">
                      {tier.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--vip-text-secondary)" }}>
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--vip-accent-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={tier.href} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] transition-all hover:scale-105 text-center" style={{ borderColor: "var(--vip-accent-main)", color: "var(--vip-accent-main)" }}>
                      {tier.cta} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section className="py-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  FAQ 🤔
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Вопросы, которые{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>задают всегда</span>
                </h3>
                <p className="text-lg" style={{ color: "var(--vip-text-secondary)" }}>
                  Коротко, честно, без воды. Если чего-то нет — пиши в{" "}
                  <Link href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: "var(--vip-accent-main)" }}>
                    @I_O_S_NN
                  </Link>
                  .
                </p>
              </div>
              <div className="space-y-3">
                {FAQ_ITEMS.map((item, index) => (
                  <details key={index} className="group rounded-2xl border-2" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "var(--vip-bg-card)" }}>
                    <summary className="w-full text-left p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer list-none" style={{ color: "var(--vip-text-primary)" }}>
                      <span className="text-base md:text-lg font-bold pr-2">{item.q}</span>
                      <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center group-open:bg-[var(--vip-accent-main)] group-open:text-[var(--vip-bg-base)]" style={{ background: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", transition: "all 0.3s" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </summary>
                    <p className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ─── CONTACTS ─── */}
          <section id="contacts" className="py-20 px-4" style={{ backgroundColor: "rgba(26,26,26,0.5)" }}>
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-14">
                <div className="inline-block mb-4 px-4 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: "rgba(255,215,0,0.1)", color: "var(--vip-accent-main)", border: "1px solid var(--vip-accent-main)" }}>
                  Контакты 📞
                </div>
                <h3 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>
                  Свяжись{" "}
                  <span style={{ color: "var(--vip-accent-main)" }}>с нами</span>
                </h3>
                <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--vip-text-secondary)" }}>
                  Всегда на связи — выбирай удобный способ
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <a href={CONTACT_INFO.phoneHref} className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02]" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}>
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>{CONTACT_INFO.phone}</p>
                    <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Позвонить</p>
                  </div>
                </a>
                <a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02]" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(38,165,228,0.1)", border: "1px solid rgba(38,165,228,0.3)" }}>
                    <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-7 h-7">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>@I_O_S_NN</p>
                    <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>Telegram</p>
                  </div>
                </a>
                <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 sm:col-span-2 lg:col-span-1" style={{ backgroundColor: "var(--vip-bg-card)", borderColor: "var(--vip-border-soft)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-7 h-7" style={{ stroke: "var(--vip-accent-main)" }}>
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--vip-text-primary)" }}>{CONTACT_INFO.address}</p>
                    <p className="text-sm mt-1" style={{ color: "var(--vip-text-secondary)" }}>{CONTACT_INFO.workingHours}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ─── FOOTER ─── */}
        <footer className="border-t py-12 md:py-16" style={{ borderColor: "var(--vip-border-soft)", backgroundColor: "var(--vip-bg-base)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(to-br, var(--vip-accent-main), var(--vip-accent-hover))" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--vip-bg-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <path d="M5 16v-4a8 8 0 0116 0v4" />
                      <circle cx="8" cy="16" r="2" />
                      <circle cx="16" cy="16" r="2" />
                      <path d="M10 16h4" />
                    </svg>
                  </div>
                  <span className="font-bold text-lg" style={{ color: "var(--vip-text-primary)" }}>VIP BIKE ELECTRO</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--vip-text-secondary)" }}>
                  Электромотоциклы в Нижнем Новгороде. 79bike: мощно, быстро, законно, без ОСАГО. ⚡️🏍️
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Разделы</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "Каталог", href: CATALOG_HREF },
                    { label: "Конфигуратор", href: CONFIGURATOR_HREF },
                    { label: "Карта", href: MAP_HREF },
                    { label: "Контакты", href: "#contacts" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm transition-colors duration-200" style={{ color: "var(--vip-text-secondary)" }}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Соцсети</h4>
                <div className="space-y-3">
                  {SOCIAL_LINKS.map((social) => (
                    <a key={social.id} href={social.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm transition-colors duration-200 group" style={{ color: "var(--vip-text-secondary)" }}>
                      <div className="w-5 h-5 transition-colors duration-300 group-hover:text-[var(--vip-accent-main)]" style={{ color: "var(--vip-accent-main)" }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          {social.icon.props.children}
                        </svg>
                      </div>
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold mb-4" style={{ color: "var(--vip-text-primary)" }}>Связь</h4>
                <div className="space-y-3">
                  <a href={OPERATOR_HREF} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm transition-colors duration-200" style={{ color: "var(--vip-text-secondary)" }}>
                    <svg viewBox="0 0 24 24" fill="#26A5E4" className="w-4 h-4">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    @I_O_S_NN
                  </a>
                  <a href={CONTACT_INFO.phoneHref} className="flex items-center gap-2.5 text-sm transition-colors duration-200" style={{ color: "var(--vip-text-secondary)" }}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="w-4 h-4" style={{ stroke: "var(--vip-accent-main)" }}>
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {CONTACT_INFO.phone}
                  </a>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: "var(--vip-border-soft)" }}>
              <p className="text-xs" style={{ color: "var(--vip-text-secondary)" }}>
                &copy; {new Date().getFullYear()} VIP BIKE ELECTRO ⚡️
              </p>
              <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-xs transition-colors" style={{ color: "var(--vip-text-secondary)" }}>
                powered by oneSitePls &middot; @SALAVEY13
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify landing page renders correctly**

Run: `npm run dev`
Visit: `http://localhost:3000`
Expected:
- Instant load, no bicycle spinner
- Hero stats show "12 байков" (not "10+")
- Social banner appears after hero (gold-on-black)
- 6 bike showcase cards with real prices
- Pricing tiers show "от 6 000 ₽" (not "от 1 500 ₽")
- Max's FAQ, how-it-works preserved

- [ ] **Step 4: Verify images load**

Check browser console for broken images
Expected: All images load from Supabase storage

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(landing): refactor to Server Component with hardcoded bikes, social banner, fixed pricing (Max was here ✉️)"
```

---

## Task 7: Final Verification

**Files:**
- No files modified (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Verify all user-facing changes**

Checklist:
- [ ] Loading shows gold S1000RR GIF
- [ ] Root landing loads instantly
- [ ] Social banner is gold-on-black
- [ ] Bike showcase shows 6 bikes with real prices
- [ ] Electro-enduro shows only electric bikes
- [ ] Main franchize categorizes bikes
- [ ] Catalog cards show 3 specs with Russian labels

- [ ] **Step 4: Create summary commit**

```bash
git add .
git commit -m "chore: final verification - VIP Bike landing & catalog improvements complete"
```

---

## Success Criteria Verification

After implementation, verify:

- [ ] Root landing loads instantly (< 1s First Contentful Paint)
- [ ] Landing shows 6 curated bikes with real prices
- [ ] Social banner appears immediately after hero (gold-on-black)
- [ ] Electro-enduro shows only electric bikes (no ICE)
- [ ] Main franchize categorizes bikes into 3 groups
- [ ] Catalog cards show consistent 3 specs with Russian labels
- [ ] Loading shows gold bike GIF (no bicycle)
- [ ] Max's contributions preserved (FAQ, how-it-works, etc.)

---

**End of Implementation Plan**

*Dependencies:* Next.js App Router, React Server Components, Tailwind CSS
*Testing:* Manual verification in browser + `npm test`
*Estimated completion time:* 2-3 hours
*Commit strategy:* One commit per task, atomic changes
