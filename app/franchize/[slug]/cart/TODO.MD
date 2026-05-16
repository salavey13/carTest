# 🏍️ CyberForge Market — Cart Page Overhaul & Market Polish Agent

> **Part 1 of 4** — Start here. Then read TODO2.MD → TODO3.MD → TODO4.MD.

## MISSION BRIEFING

You are the **Cart & Polish Agent**. Other agents are concurrently working on the Market page and Header/Navbar. Your mission:

1. **CODE REVIEW & POLISH** the Market page and Header/Navbar
2. **OVERHAUL** the Cart page from its current basic state to the premium "CyberForge Market" design

The target visual is the **attached reference screenshot** (`megacart.png`) — dark premium cyberpunk with neon accents, product images, spec badges, protection plans, trust badges, and a gold CTA that screams "rent this bike NOW."

> 📸 **A picture of the desired result is attached for reference** — keep it open while you code. Every pixel of that `megacart.png` is the target. If your implementation doesn't look like that screenshot, it's not done.

---

## ⚠️ CRITICAL: EXISTING CODEBASE RULES

This project is **NOT greenfield**. There is a working franchise system with real hooks, real theming, real cart logic. You must **build on top of existing code**, not replace it.

### BANNED PATTERNS (will break things)

❌ **NO hardcoded hex colors for theme surfaces/accents** — `#FFD700`, `#1E1E1E`, `#121212` etc. are FORBIDDEN in component code for anything that should adapt to franchise theme
❌ **NO Zustand** — cart state uses `useFranchizeCart` hook, not Zustand
❌ **NO Prisma** — data uses Supabase via existing server actions
❌ **NO new API routes** — cart persistence uses `saveUserFranchizeCartAction`
❌ **NO replacing `CrewHeader`** — it's loaded by the server page wrapper
❌ **NO `CrewFooter` on cart page** — replaced by `BottomNavigationBike`; remove it from cart's server page if present
❌ **NO `FloatingCartIconLinkBySlug`** — being ditched; cart icon now lives in `CrewHeader`
❌ **NO modifying `globals.css` color variables** — theme comes from `crew.theme.palette.*`
❌ **NO `alert()` / `confirm()` / `prompt()`** — use inline UI for confirmations

### ALLOWED: Semantic / Status Colors

The following colors are **NOT franchise-themed** — they convey universal status semantics and ARE allowed as explicit hex values:

| Color | Usage | Allowed Hex |
|-------|-------|-------------|
| Success / Discount / "ВЫГОДНО" | Discount banner, availability badge | `#00C853` |
| Destructive / Delete | Delete confirmation, out-of-stock | `#FF3B30` (light), `#FF6B6B` (dark-safe) |
| Warning | Low stock, expiring offers | `#FF9500` |

> **Rule of thumb**: If a color represents franchise identity (gold accent, card bg, border), it MUST come from `crew.theme.palette.*`. If it represents a universal status (success=green, danger=red, warning=amber), you MAY use explicit hex with `withAlpha()` for transparency. Always wrap with `withAlpha()` for semi-transparent variants.

### REQUIRED PATTERNS (how things actually work)

✅ Use `crewPaletteForSurface(crew.theme)` for surface styles
✅ Use `crew.theme.palette.accentMain` for accent color
✅ Use `crew.theme.palette.textPrimary / textSecondary` for text
✅ Use `crew.theme.palette.borderSoft` for borders
✅ Use `withAlpha(crew.theme.palette.accentMain, 0.6)` for glow effects
✅ Use `withAlpha()` for ALL semi-transparent colors (never raw `rgba()`)
✅ Use `useFranchizeCart(slug)` for cart state
✅ Use `useFranchizeCartLines(slug, items, cartContext)` for computed cart data
✅ Use `motion` from `framer-motion` for animations (already in project)
✅ Use existing `CatalogItemVM` and `FranchizeCrewVM` types from `../actions`
✅ Use `interactionRingStyle(crew.theme)` for focus rings
✅ Use `readablePaletteTextOnColor(bg, palette)` for text on accent backgrounds
✅ Use `next/image` with `sizes` prop for all product images

---

## QUICK IMPORT MAP

Save yourself guesswork — here's what to import from where:

```tsx
// Cart page client — top of CartPageClient.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import {
  crewPaletteForSurface,
  withAlpha,
  readablePaletteTextOnColor,
  interactionRingStyle,
} from "../lib/theme";
import { upsertFranchizeIntent } from "../actions";
import { saveUserFranchizeCartAction } from "../server-actions/catalog";
import type { FranchizeCrewVM, CatalogItemVM, FranchizeTheme } from "../actions";

// Lucide icons (already in project)
import {
  ShoppingCart, Trash2, ArrowRight, Shield, Zap,
  Battery, Gauge, Headphones, Bike, ChevronRight,
  Palette, Calendar,
} from "lucide-react";
```

---

## EXISTING FILE MAP (what's already there)

```
/app/franchize/
├── [slug]/
│   ├── layout.tsx                 # Bare layout, just {children}
│   ├── page.tsx                   # Market/Catalog page (server)
│   ├── cart/
│   │   └── page.tsx               # Cart page (server) ← YOUR TARGET
│   └── metadata.ts
├── components/
│   ├── CartPageClient.tsx         # Cart client component ← OVERHAUL THIS
│   ├── CatalogClient.tsx          # Market client (review only)
│   ├── CrewHeader.tsx             # Franchise header (review only)
│   ├── CrewFooter.tsx             # ⚠️ LEGACY — being replaced by BottomNavigationBike
│   ├── FloatingCartIconLinkBySlug.tsx  # ⚠️ BEING DITCHED — cart icon moves to CrewHeader
│   └── ErrorBoundary.tsx
├── hooks/
│   ├── useFranchizeCart.ts        # Cart state hook ← USE THIS
│   └── useFranchizeCartLines.ts   # Computed cart lines ← USE THIS
├── lib/
│   ├── theme.ts                   # crewPaletteForSurface, withAlpha, etc. ← USE THIS
│   ├── theme-resolver.ts          # resolveFranchizeTheme
│   ├── route-cta-policy.ts        # CTA policies
│   ├── navigation.ts              # toCategoryId
│   └── catalog-rental-strip.ts    # buildCatalogRentalStrip
├── modals/
│   └── Item.tsx                   # Item detail modal
├── server-actions/
│   ├── palette.ts                 # getCrewPaletteBySlug
│   └── catalog.ts                 # getFranchizeBySlug wrapper
└── actions.ts                     # getFranchizeBySlug, upsertFranchizeIntent, types
```

### Key Types from `actions.ts` (use these, don't recreate)

```typescript
interface FranchizeCrewVM {
  slug: string;
  header: { brandName: string; logoUrl: string; subtitle?: string };
  theme: FranchizeTheme;
  contacts: { address?: string; workingHours?: string };
  catalog: { promoBanners: ...; adCards: ...; tickerItems: ... };
  hqLocation: string;
  isFound: boolean;
}

interface FranchizeTheme {
  mode: "light" | "dark";
  palette: {
    bgBase: string;        // Page background
    bgCard: string;        // Card background
    accentMain: string;    // Primary accent (gold/neon)
    accentMainHover: string;
    textPrimary: string;
    textSecondary: string;
    borderSoft: string;
  };
}

interface CatalogItemVM {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  imageUrl: string;
  pricePerDay: number;
  rentPriceLabel: string;    // e.g. "15 000 ₽ / день"
  saleAvailable: boolean;
  salePrice?: number;        // Purchase price (from specs JSONB)
  isHot: boolean;
  availabilityStatus: string;
  reviewSummary: { average: number; count: number; latest?: { text: string } };
  specs: Record<string, unknown>;  // JSONB with power, battery, range, etc.
}
```

### Cart Hook API (use these, don't recreate)

```typescript
// From useFranchizeCart(slug):
const { cart, itemCount, addItem, changeLineQty, removeLine } = useFranchizeCart(slug);

// cart = Record<string, { qty: number; options: {...} }>  (keyed by item ID)
// itemCount = total quantity across all lines
// addItem(itemId, options, qty)
// changeLineQty(lineId, delta)  // delta = +1 or -1
// removeLine(lineId)

// From useFranchizeCartLines(slug, items, cartContext):
const { cartLines, subtotal, itemCount } = useFranchizeCartLines(slug, items, {
  cart,
  itemCount: rawItemCount,
  changeLineQty,
  removeLine,
});

// cartLines = Array<CartLine>  where CartLine is:
interface CartLine {
  lineId: string;
  itemId: string;
  item?: CatalogItemVM;         // undefined if item removed from catalog
  qty: number;
  options: {
    package?: string;
    duration?: number;           // ← rental days (USE THIS, not a hardcoded number!)
    perk?: string;
    auction?: string;
  };
  saleAvailable: boolean;
  lineTotal: number;
}
// subtotal = sum of all lineTotal values
```

> ⚠️ **Rental days come from `line.options.duration`**, NOT a hardcoded constant. If `duration` is undefined, fall back to `1` (single day). NEVER hardcode `36` or any other rental period.

---

## EXISTING THEME HELPERS (use these!)

From `/app/franchize/lib/theme.ts`:
- `crewPaletteForSurface(theme)` → `{ page, card, mutedText, subtleCard, accentPill }`
- `withAlpha(color, alpha)` → `rgba(...)` string
- `readableTextOnColor(background, candidates)` → best text color
- `readablePaletteTextOnColor(background, palette)` → best text from palette
- `catalogCardVariantStyles(theme, index)` → card border/bg variants
- `interactionRingStyle(theme)` → focus ring box-shadow

> ~~`floatingCartOverlayBackground(theme)`~~ — legacy, being removed alongside FloatingCartIconLinkBySlug.

---

**→ Next: [TODO2.MD](./TODO2.MD) — Cart page spec & styling rules**
