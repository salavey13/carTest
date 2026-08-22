# 🏍️ Review Checklists, Integration, Quality Gates

> **Part 4 of 4** — Read TODO.MD → TODO2.MD → TODO3.MD first.

---

## MARKET PAGE — CODE REVIEW CHECKLIST

When reviewing `CatalogClient.tsx` and related files, check:

### Theme Compliance
- [ ] All colors use `crew.theme.palette.*` or `surface.*` — no hardcoded hex (except semantic status colors)
- [ ] Glow effects use `withAlpha(crew.theme.palette.accentMain, 0.6)`
- [ ] Focus rings use `interactionRingStyle(crew.theme)`
- [ ] No Tailwind color classes used for franchise-themed elements (e.g., `bg-yellow-500` → should use palette)

### Product Cards
- [ ] Cards have neon border glow (via `catalogCardVariantStyles`)
- [ ] Images use `next/image` with proper `sizes` attribute
- [ ] "Свободен сегодня" and "Доступен к покупке" badges present
- [ ] Price shows `rentPriceLabel` and `salePrice` when available
- [ ] CTA button uses accent color with `readablePaletteTextOnColor`

### Search & Filters
- [ ] Search bar uses franchise theme, not hardcoded colors
- [ ] Filter chips use `accentMain` for active state, `bgCard` for inactive
- [ ] Quick filters show counts correctly

### Floating Cart (⚠️ BEING DITCHED)
- [ ] `FloatingCartIconLinkBySlug` is being **REMOVED** — it's replaced by a cart icon in `CrewHeader`
- [ ] If the floating cart icon still exists in code, it should be removed/disabled on cart page
- [ ] Cart icon now lives in `CrewHeader` with badge showing `itemCount`
- [ ] Verify no orphan references to `FloatingCartIconLinkBySlug` remain in cart flow

---

## HEADER/NAVBAR — CODE REVIEW CHECKLIST

### CrewHeader (`/app/franchize/components/CrewHeader.tsx`)
- [ ] Uses `crew.header.brandName` and `crew.header.logoUrl`
- [ ] **Cart icon with badge showing `itemCount`** — this replaces the old floating cart icon
- [ ] Navigation links use franchise slug
- [ ] Mobile-friendly with hamburger menu
- [ ] Sticky/fixed position

### CrewFooter (⚠️ LEGACY — may already be removed)
- [ ] CrewFooter is being **replaced by `BottomNavigationBike`** — verify it's no longer rendered on franchise pages
- [ ] If still rendered in server page wrappers, flag for removal (but don't break other pages that may still use it)
- [ ] Contact info from `crew.contacts` should now appear in bottom nav or elsewhere

### Bottom Navigation (`BottomNavigationBike`)
- [ ] Already exists and works — don't break it
- [ ] **This IS the new footer** — franchise pages use bottom nav instead of CrewFooter
- [ ] "Rent" central button navigates to `/franchize/{slug}`
- [ ] Active state detection works for franchise routes
- [ ] Cart page should render bottom nav, NOT CrewFooter

---

## INTEGRATION CHECKLIST

- [ ] Navigation Market → Cart: clicking cart icon in `CrewHeader` → `/franchize/{slug}/cart` (floating cart widget is removed)
- [ ] Navigation Cart → Market: breadcrumb click or back button
- [ ] Cart badge count syncs in CrewHeader cart icon (FloatingCartIconLinkBySlug is being removed)
- [ ] Adding item on Market page reflects in Cart page
- [ ] `handleProceed` in cart still calls `upsertFranchizeIntent` and `saveUserFranchizeCartAction`
- [ ] Server page wrapper still passes `crew`, `slug`, `items` to client
- [ ] `CrewHeader` renders with cart icon in header (replacing floating cart icon)
- [ ] `CrewFooter` does NOT render on cart page — replaced by `BottomNavigationBike`
- [ ] `BottomNavigationBike` renders on cart page as the bottom navigation
- [ ] Franchise breadcrumbs show correct slug/brand name
- [ ] Cart server page (`/app/franchize/[slug]/cart/page.tsx`) does NOT render `<CrewFooter />`
- [ ] Cart persists on reload via `saveUserFranchizeCartAction`

---

## ANIMATIONS SUMMARY (all with framer-motion)

| Element | Animation | Duration | Delay | Implementation |
|---------|-----------|----------|-------|----------------|
| Page entrance | fade-in | 400ms | 0 | `initial={{ opacity: 0 }}` |
| Cart item cards | stagger + fade-up | 300ms | 0.08s per card | `initial={{ opacity: 0, y: 20 }}` + `delay: index * 0.08` |
| Quantity number | scale 1.3→1 + fade | 150ms | 0 | `AnimatePresence` + `key={qty}` |
| Delete item | slide-out-left | 250ms | 0 | `exit={{ opacity: 0, x: -100 }}` + `AnimatePresence` |
| Layout shift after delete | position animate | 200ms | 0 | `layout` prop on `motion.div` |
| Rent price | pulse on qty change (scale 1.15→1) | 200ms | on qty change | `AnimatePresence` + `key={`${lineId}-${qty}`}` |
| CTA button hover | scale 1.01 + glow expand | 150ms | 0 | `whileHover={{ scale: 1.01, boxShadow: ... }}` |
| CTA button press | scale 0.98 | 100ms | 0 | `whileTap={{ scale: 0.98 }}` |
| Discount banner | fade-up + shimmer bg | 300ms | 0.3s | `initial={{ opacity: 0, y: 10 }}` + CSS `@keyframes cart-shimmer` |
| Protection plan | fade-up | 300ms | 0.4s | `initial={{ opacity: 0, y: 10 }}` |
| Trust badges | stagger fade-up | 300ms | 0.5s + 0.1s each | `transition={{ delay: 0.5 + i * 0.1 }}` |
| Empty cart | scale 0.95→1 + fade | 400ms | 0 | `initial={{ opacity: 0, scale: 0.95 }}` |

> All animations should be gated behind `prefers-reduced-motion` — see Accessibility section in TODO2.MD.

---

## QUALITY GATES

### Visual
- [ ] Cart page matches `megacart.png` at 375px viewport
- [ ] All franchise-themed colors come from `crew.theme.palette.*` — zero hardcoded hex for accents/surfaces/text
- [ ] Semantic status colors (green/red/amber) use explicit hex with `withAlpha()`
- [ ] Typography uses Orbitron for headings, Inter for body
- [ ] Product images display in cart items (NEW feature)
- [ ] Spec badges show power/battery/range (NEW feature)
- [ ] Rent/Buy badge visible on each item (NEW feature)
- [ ] Quantity controls only show for Rent items (NEW feature)
- [ ] Discount banner has shimmer animation (NEW feature)
- [ ] Delete confirmation is inline UI, not browser dialog

### Functional
- [ ] `useFranchizeCart` and `useFranchizeCartLines` used correctly
- [ ] `changeLineQty` and `removeLine` work with animations
- [ ] Delete confirmation (inline, not alert())
- [ ] Empty cart state with navigation back to catalog
- [ ] Checkout saves cart + intent before navigating
- [ ] Mixed Rent+Buy cart calculates correctly
- [ ] Rental days sourced from `line.options.duration`, NOT hardcoded
- [ ] Discount percent has TODO comment for future crew config wiring
- [ ] Skeleton loading state shows while cart data loads
- [ ] Orphaned items (item undefined) are deletable

### Code
- [ ] No `any` types
- [ ] No hardcoded hex colors for franchise theme values
- [ ] All sub-components in `/app/franchize/components/cart/`
- [ ] All animations use framer-motion
- [ ] All theme values from `crew.theme.palette.*`
- [ ] Existing hooks and types reused, not recreated
- [ ] `withAlpha()` used for all semi-transparent colors
- [ ] `readablePaletteTextOnColor()` for text on accent backgrounds
- [ ] All icon-only buttons have `aria-label`
- [ ] `prefers-reduced-motion` respected for animations

### Architecture
- [ ] Cart server page does NOT render `CrewFooter`
- [ ] No references to `FloatingCartIconLinkBySlug` in cart flow
- [ ] Sub-components are barrel-exported from `cart/index.ts`
- [ ] `CartLine` type is properly imported/defined (not inline)
- [ ] Shimmer keyframe is in `globals.css` or injected inline (not missing)

---

## REFERENCE FILES

All reference images are co-located in the same directory as this TODO file.

- **Cart "after" target (ATTACHED)**: `./megacart.png`

---

## THE VIBE

Dark premium cyberpunk. Neon gold accents on deep black. Every state change has subtle motion. Product images glow. The CTA button radiates. The discount banner shimmers. If it looks "template-y" or "meh," it's wrong — make it feel like renting a $50,000 electric super-bike.

**Now go make the cart page that makes people want to check out just to see the animations.** 🏍️✨
