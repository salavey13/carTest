# THE_FRANCHEEZEPLAN

Status: `active-planning`  
Owner: `product + codex`  
Scope: Motorbike rental franchise-ready public UX (`/franchize/*`) with Pepperolli-inspired visual language.

---

## 0) Goal and operating mode

### Product goal
Create a reusable **franchise storefront runtime** for bike crews where one crew slug can hydrate:
- main catalog,
- item modal flow,
- cart,
- order page,
- about,
- contacts,
- branded header/footer/menu.

### Execution mode (MANDATORY)
- Tasks are executed **strictly one-by-one** (sequential), not in parallel.
- A task may start only when all dependencies are completed.
- The plan must remain extensible: new tasks can be appended at the end or inserted with explicit dependency notes.
- If dependencies are unclear, mark current task `blocked` and add prerequisite tasks first.

### Progress protocol (MANDATORY)
For every task below, keep these fields updated:
- `status`: `todo` | `in_progress` | `blocked` | `done`
- `updated_at`: ISO timestamp
- `owner`: agent/operator
- `notes`: short implementation delta
- `next_step`: immediate follow-up
- `risks`: blockers or assumptions

---

## 1) Reference visual system (Pepperolli extraction, second pass)

> Based on provided screenshots: catalog, item modal, cart, checkout, contacts, yellow menu/footer sheets.

## 1.1 Palette + contrast (token candidates)

### Core dark surfaces
- `pep.bg.base = #0B0C10` (global app background)
- `pep.bg.card = #111217` (cards/modals)
- `pep.bg.elevated = #16181F` (inputs/toggles/secondary panels)
- `pep.border.soft = #24262E`
- `pep.border.card = #2A2D36`

### Accent family (yellow/orange)
- `pep.accent.main = #D99A00`
- `pep.accent.mainHover = #E2A812`
- `pep.accent.deep = #B57F00`
- `pep.accent.textOn = #16130A`

### Text family
- `pep.text.primary = #F2F2F3`
- `pep.text.secondary = #A7ABB4`
- `pep.text.muted = #7D828C`
- `pep.text.accent = #D99A00`

### Utility tokens
- `pep.success = #52C26D`
- `pep.warning = #E0A200`
- `pep.error = #E35B5B`

> Note: these are practical approximations from screenshots. Store in hydration metadata to allow crew-specific theming later.

## 1.2 Shape language + spacing
- Radius system:
  - `r-sm = 10px`
  - `r-md = 14px`
  - `r-lg = 18px`
  - `r-pill = 999px`
- Vertical rhythm:
  - section spacing 20-28px,
  - card internal spacing 12-16px,
  - form block spacing 16-24px.
- Shadow style:
  - subtle glow for accent CTAs,
  - low-lift shadows on dark cards (avoid heavy blur).

## 1.3 Information hierarchy
1. fixed top strip (back/title/controls),
2. brand row (hamburger + centered logo),
3. horizontal category rail,
4. promos + search,
5. 2-column product grid,
6. floating cart pill + up button.

## 1.4 Interaction patterns
- Item details in modal (not inline).
- Persistent floating cart pill on catalog/info/checkout pages.
- Compact hamburger menu modal for quick links.
- Checkout staged flow with visible progress markers.
- Promo code area as highlighted module (dark panel + accent button).

## 1.5 Hydration-ready theme contract
Add per-crew theme block in JSONB:

```json
{
  "theme": {
    "mode": "pepperolli_dark",
    "palette": {
      "bgBase": "#0B0C10",
      "bgCard": "#111217",
      "accentMain": "#D99A00",
      "accentMainHover": "#E2A812",
      "textPrimary": "#F2F2F3",
      "textSecondary": "#A7ABB4",
      "borderSoft": "#24262E"
    },
    "radius": { "card": 18, "button": 14, "pill": 999 },
    "spacing": { "section": 24, "card": 14 },
    "effects": { "accentGlow": true }
  }
}
```

---

## 2) Current baseline map (existing project)

### Existing key pages/components
- `/rent-bike` (`app/rent-bike/page.tsx`) — current bike catalog and booking mechanics.
- `/vipbikerental` (`app/vipbikerental/page.tsx`) — all-in-one info page.
- `/rentals` + `/rentals/[id]` (`app/rentals/*`) — active rental dashboard/journey.
- `BikeHeader`, `BikeFooter`, `BottomNavigationBike` (`components/*`).
- `ClientLayout` route-driven shell (`components/layout/ClientLayout.tsx`).

### Existing data/runtime foundations
- `createCrew` + crew metadata persistence in `app/actions.ts`.
- Vehicle/rental server actions in `app/rentals/actions.ts`.
- DB schema via Supabase migrations for `crews`, `crew_members`, `cars`, `rentals`.

### Current route naming caution
- Existing route is `/vipbikerental` (singular).
- Product narrative mentions `/vipbikerentals` in places.
- Add explicit redirect/alias decision during migration tasks.

---

## 3) Target IA (franchise-ready)

Planned routes:
- `/app/franchize/create/page.tsx`
- `/app/franchize/[slug]/page.tsx`
- `/app/franchize/[slug]/cart/page.tsx`
- `/app/franchize/[slug]/order/[id]/page.tsx`
- `/app/franchize/[slug]/about/page.tsx`
- `/app/franchize/[slug]/contacts/page.tsx`
- legacy compatibility redirects:
  - `/app/franchize/cart/page.tsx`
  - `/app/franchize/order/[id]/page.tsx`
  - `/app/franchize/about/page.tsx`
  - `/app/franchize/contacts/page.tsx`

Planned shared runtime:
- `/app/franchize/actions.ts`
- `/app/franchize/components/CrewHeader.tsx`
- `/app/franchize/components/CrewFooter.tsx`
- `/app/franchize/components/FloatingCartIconLink.tsx`
- `/app/franchize/modals/HeaderMenu.tsx`
- `/app/franchize/modals/Item.tsx`

---

## 4) Data model (franchise metadata in JSONB)

Primary storage source (phase 1): `crews.metadata` JSONB.

## 4.1 Suggested schema blocks
- `branding`: logo, wordmark, accent color, dark mode defaults.
- `theme`: palette, radius, spacing, effects.
- `header`: nav groups, hero badges, top links.
- `footer`: contacts, menu columns, social links, legal links.
- `about`: text sections, features, FAQs.
- `contacts`: address, phone, email, map settings.
- `catalog`: category ordering, labels, promo banners.
- `order`: payment options, pickup/delivery toggles, promo settings.

## 4.2 Minimal executable JSON template

```json
{
  "is_provider": true,
  "branding": {
    "name": "VIP BIKE",
    "tagline": "Ride the vibe",
    "logoUrl": "",
    "centerLogoInHeader": true
  },
  "theme": {
    "mode": "pepperolli_dark",
    "palette": {
      "bgBase": "#0B0C10",
      "bgCard": "#111217",
      "accentMain": "#D99A00",
      "accentMainHover": "#E2A812",
      "textPrimary": "#F2F2F3",
      "textSecondary": "#A7ABB4",
      "borderSoft": "#24262E"
    }
  },
  "header": {
    "menuLinks": [
      { "label": "Каталог", "href": "/franchize/{slug}" },
      { "label": "О нас", "href": "/franchize/{slug}/about" },
      { "label": "Контакты", "href": "/franchize/{slug}/contacts" },
      { "label": "Корзина", "href": "/franchize/{slug}/cart" }
    ]
  },
  "footer": {
    "phone": "+7 9200-789-888",
    "address": "Нижний Новгород",
    "email": "hello@example.com"
  },
  "catalog": {
    "groupOrder": ["Naked", "Supersport", "Touring", "Neo-retro"],
    "showTwoColumnsMobile": true,
    "useModalDetails": true
  },
  "order": {
    "allowPromo": true,
    "deliveryModes": ["pickup", "delivery"],
    "defaultMode": "pickup"
  }
}
```

## 4.3 Normalization/fallback rules
- If `theme.palette` missing -> fallback to Pepperolli defaults in section 1.1.
- If header/footer links missing -> generate default links from route map.
- If contact fields missing -> fallback to crew owner contact metadata where available.
- If category order missing -> derive from bikes `specs.type` frequency.

---

## 5) Ordered task pipeline (single-thread execution)

> Rule: execute from T1 -> T2 -> ... strictly in order unless explicitly re-planned.

### T1 — Create planning/documentation foundation
- status: `done`
- updated_at: `2026-02-18T00:00:00Z`
- owner: `codex`
- notes: Created base plan, visual extraction, IA, and task structure.
- next_step: Start T2.
- risks: none
- dependencies: none
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`

### T2 — Add AGENTS rule to keep this plan as living status board
- status: `done`
- updated_at: `2026-02-18T00:00:00Z`
- owner: `codex`
- notes: Added mandatory franchise diary contract in AGENTS.
- next_step: Start T3.
- risks: none
- dependencies: T1
- deliverables:
  - `AGENTS.md`

### T3 — Scaffold `/franchize/*` routes and shared actions
- status: `done`
- updated_at: `2026-02-18T22:33:37Z`
- owner: `codex`
- notes: Added `app/franchize/actions.ts` with typed DTOs + safe `getFranchizeBySlug`, and scaffolded `/franchize/*` route pages with non-crashing fallback states.
- next_step: Start T4 shell components (header/footer/floating cart/menu modal).
- risks: route/theme conflicts with existing `ClientLayout` bike theme.
- dependencies: T2
- deliverables:
  - `app/franchize/actions.ts`
  - `app/franchize/[slug]/page.tsx`
  - `app/franchize/cart/page.tsx`
  - `app/franchize/order/[id]/page.tsx`
  - `app/franchize/about/page.tsx`
  - `app/franchize/contacts/page.tsx`
- implementation checklist:
  1. Add typed DTOs in `app/franchize/actions.ts` (`FranchizeTheme`, `FranchizeHeaderVM`, `CatalogItemVM`).
  2. Add loader `getFranchizeBySlug(slug)` that reads crew + cars + metadata.
  3. Create skeleton pages with server-side load and fallback empty states.
  4. Ensure no existing routes are replaced/deleted.
- acceptance criteria:
  - All new routes compile and render with fallback mock data.
  - Slug not found returns safe empty UI (not crash).
  - Existing `/rent-bike`, `/vipbikerental`, `/rentals` remain unaffected.

### T3a — Slug-in-path routing alignment and hydration mismatch fix
- status: `done`
- updated_at: `2026-02-18T23:27:47Z`
- owner: `codex`
- notes: Migrated franchize static pages into slug-scoped routes, added compatibility redirects to `vip-bike`, normalized header links to slug-aware paths, and fixed contact fallback priority in loader.
- next_step: Start T4 shell components.
- risks: temporary hardcoded redirect target (`vip-bike`) until multi-crew redirect strategy is introduced.
- dependencies: T3
- deliverables:
  - `app/franchize/[slug]/about/page.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
  - `app/franchize/[slug]/cart/page.tsx`
  - `app/franchize/[slug]/order/[id]/page.tsx`
  - `app/franchize/about/page.tsx`
  - `app/franchize/contacts/page.tsx`
  - `app/franchize/cart/page.tsx`
  - `app/franchize/order/[id]/page.tsx`
  - `app/franchize/actions.ts`
- implementation checklist:
  1. Move `/about`, `/contacts`, `/cart`, `/order/[id]` rendering into `/franchize/[slug]/*`.
  2. Keep old static paths as redirect bridges to `/franchize/vip-bike/*`.
  3. Normalize menu link hydration to always include crew slug context.
  4. Prioritize `metadata.franchize.contacts` over `footer` and crew fallbacks.
- acceptance criteria:
  - Required route shape exists and renders for `/franchize/vip-bike/*` pages.
  - Legacy static links redirect without dead ends.
  - Existing `/rent-bike`, `/vipbikerental`, `/rentals` remain untouched.

### T3b — Plan/doc path normalization after slug migration
- status: `done`
- updated_at: `2026-02-18T23:42:07Z`
- owner: `codex`
- notes: Audited `FRANCHEEZEPLAN` docs and normalized all future-looking franchize paths to slug-scoped variants; retained explicit legacy paths only where documenting redirect bridges/history.
- next_step: Start T4 shell components.
- risks: documentation drift if future task blocks reintroduce non-slug routes without explicit `legacy redirect` label.
- dependencies: T3a
- deliverables:
  - `docs/FRANCHEEZEPLAN.md`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Verify route map and JSON template paths use `/franchize/{slug}/...` shape.
  2. Verify future task deliverables/checklists use slug-scoped route references.
  3. Keep legacy static paths only in explicit compatibility/redirect notes.
- acceptance criteria:
  - No accidental static-path references remain in future-state sections.
  - Legacy static paths appear only in compatibility bridge context.

### T4 — Build Pepperolli-style shell components
- status: `done`
- updated_at: `2026-02-19T00:08:10Z`
- owner: `codex`
- notes: Iterated T4 by centering/enlarging crew logo in header, restoring item card images, and restricting catalog hydration to `type=bike` inventory only.
- next_step: Start T5 modal-first card interaction while preserving new bike-only/image-ready card baseline.
- risks: Image quality depends on upstream `image_url` coverage; fallback placeholder text is shown when media is missing.
- dependencies: T3b
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CrewFooter.tsx`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
- implementation checklist:
  1. Header: centered enlarged logo + left hamburger + right utility slot.
  2. Category rail: horizontally scrollable pills below brand row.
  3. Footer: yellow slab sections (contacts/menu/profile/social).
  4. Floating cart pill: icon capsule + price + quantity bubble + up button.
  5. Add CSS variable bridge from `theme.palette`.
- acceptance criteria:
  - Mobile shell matches screenshot structure and spacing.
  - Cart pill persists on catalog/about/contacts/order pages.
  - Menu modal shows quick links sourced from metadata.

### T5 — Catalog UX conversion to modal-first flow
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: 2-column mobile cards, category rail, item modal with options and sticky CTA.
- next_step: Connect add-to-cart state and modal variations.
- risks: preserving existing booking capabilities while re-skinning.
- dependencies: T4
- deliverables:
  - `app/franchize/modals/Item.tsx`
  - `/franchize/[slug]` catalog rendering
- implementation checklist:
  1. Build product card component with image/title/subtitle/price/button.
  2. Force `grid-cols-2` on mobile with consistent card heights.
  3. Add modal open from card click; modal supports:
     - expanded description,
     - option chips (size/package/perk),
     - secondary close button + primary add button.
  4. Add info tooltip/popup style inspired by nutrition card.
  5. Keep smooth section scroll via category links.
- acceptance criteria:
  - No inline product-details block remains in catalog page.
  - Modal closes/opens reliably and maintains selected options.
  - Add-to-cart updates floating cart values immediately.

### T6 — Cart and order pages
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Separate cart page + staged order UI (delivery/pickup, payment, promo).
- next_step: implement basic validation + legal consent gate.
- risks: mismatch with existing `rentals` booking semantics.
- dependencies: T5
- deliverables:
  - `/franchize/[slug]/cart`
  - `/franchize/[slug]/order/[id]`
- implementation checklist:
  1. Cart page: editable quantity controls, remove row, total summary.
  2. Order page: step markers + segmented delivery mode toggle.
  3. Add form sections: recipient/contact/time/payment/comment/promo.
  4. Add order summary card + consent checkbox + continue CTA.
  5. Maintain dark+yellow visual contract.
- acceptance criteria:
  - Empty cart state has clear CTA back to catalog.
  - Order CTA disabled until required fields + consent are valid.
  - Promo input present with apply action stub.

### T7 — Franchise create form and metadata hydration
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Rich create form for header/footer/about/contacts/theme metadata.
- next_step: add schema validation and preview capability.
- risks: malformed JSONB causing runtime breakage.
- dependencies: T6
- deliverables:
  - `/franchize/create`
  - nearby `action.ts` for save/update
- implementation checklist:
  1. Split form into sections: Branding, Theme, Header, Footer, Catalog, Order.
  2. Add structured controls first; optional advanced JSON textarea last.
  3. Validate with zod schema on server action before save.
  4. Save under `crews.metadata.franchize` namespace to avoid collisions.
  5. Add test button: “Load from crew slug” for hydration preview.
- acceptance criteria:
  - Can save and reload franchize config for existing crew.
  - Missing fields safely default.
  - Validation errors are human-readable and non-destructive.

### T8 — Legacy route alignment and migration bridge
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Keep history pages, wire incremental navigation to new surfaces.
- next_step: controlled redirects and operator toggles.
- risks: breaking bookmarked deep links.
- dependencies: T7
- deliverables:
  - selective links from `/rent-bike`, `/vipbikerental`, `/rentals`
- implementation checklist:
  1. Add optional bridge links from legacy pages to `/franchize/[slug]`.
  2. Introduce feature flag metadata (`franchize.enabled`).
  3. Add singular/plural alias strategy for vip routes.
  4. Preserve all existing workflows as fallback.
- acceptance criteria:
  - Legacy routes remain fully usable.
  - Users can discover new franchize flow without forced migration.
  - No dead links between old/new pages.

### T9 — QA, screenshots, and rollout notes
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: visual QA + route QA + release playbook.
- next_step: produce screenshot matrix and go-live checklist.
- risks: UI drift across mobile widths.
- dependencies: T8
- deliverables:
  - screenshots
  - route verification checklist
  - operator rollout notes
- implementation checklist:
  1. Verify key viewports: 360x800, 390x844, 768x1024, desktop.
  2. Capture screenshots of: catalog, item modal, cart, order, contacts, menu.
  3. Run lint/build and basic route smoke checks.
  4. Document rollback path and known limitations.
- acceptance criteria:
  - Visual parity with reference intent on mobile.
  - No blocking console/runtime errors on main flows.
  - Release notes include migration and fallback instructions.

---

## 6) Task template for future extension

When adding a new task, copy this block:

```md
### TX — <task title>
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: <what this task does>
- next_step: <immediate next action>
- risks: <assumptions/blockers>
- dependencies: <Tn or none>
- deliverables:
  - <file/path>
- implementation checklist:
  1. <step>
- acceptance criteria:
  - <check>
```

Insert new tasks by dependency, then renumber if needed and preserve order guarantees.

---

## 7) Progress changelog / diary

### 2026-02-18 — bootstrap
- Added full franchise execution plan with sequential tasks and status fields.
- Marked T1/T2 as completed for documentation bootstrap.
- Established extension template for future tasks.

### 2026-02-18 — refinement pass (deeper execution detail)
- Expanded remaining tasks (T3-T9) with implementation checklists, risks, and acceptance criteria for separate-session execution.
- Added second-pass visual extraction with more precise palette candidates from screenshots.
- Added hydration-ready theme token contract to include colors/spacing/radius in crew metadata.
- Added fallback/normalization rules and stronger progress protocol fields.

### 2026-02-18 — FRANCHEEZEPLAN_EXECUTIONER bootstrap
- Added local-skills discovery follow-up (notify + supabase-related repo skills and scripts).
- Added quick-start executor runbook at `docs/FRANCHEEZEPLAN.md` for next-session continuation.
- Added AGENTS protocol for `continue as FRANCHEEZEPLAN_EXECUTIONER` deterministic task pickup and state updates.

### 2026-02-18 — T3 execution complete (route scaffold)
- Marked T3 `in_progress` -> `done` following dependency order.
- Implemented franchize runtime loader/action with fallback hydration for unknown slug and cars query safety.
- Scaffolded pages: `/franchize/[slug]` plus legacy static placeholders (`/franchize/cart`, `/franchize/order/[id]`, `/franchize/about`, `/franchize/contacts`) before slug migration finalized.
- Captured mobile screenshot for `/franchize/demo` to document current scaffold visual baseline.

### 2026-02-18 — T3 refinement (VIP_BIKE hydration seed)
- Replaced scaffold demo navigation target with `/franchize/vip-bike` for operator-facing testing.
- Added detailed SQL hydration blueprint at `docs/sql/vip-bike-franchize-hydration.sql` to populate `crews.metadata.franchize` using VIP_BIKE data from existing pages/components.
- Preserved legacy metadata compatibility by keeping top-level provider/contact keys in SQL merge section.

### 2026-02-18 — T3a execution complete (slug-in-path stabilization)
- Added slug-scoped routes for about/contacts/cart/order and moved page rendering there.
- Added backward-compatible redirects from `/franchize/about|contacts|cart` (and `/franchize/order/[id]`) to `/franchize/vip-bike/*`.
- Updated `getFranchizeBySlug` contacts fallback order: `metadata.franchize.contacts` -> `metadata.franchize.footer` -> crew fields.
- Normalized fallback/header menu links to include slug in franchize scoped URLs.

### 2026-02-18 — T3b execution complete (doc slug consistency pass)
- Rechecked `docs/FRANCHEEZEPLAN.md` and `docs/THE_FRANCHEEZEPLAN.md` for non-slug franchize route references.
- Normalized target IA + JSON template + future task deliverables to `/franchize/{slug}/...` or `/franchize/[slug]/...` patterns.
- Kept static non-slug routes only when explicitly describing compatibility redirects/history.

### 2026-02-18 — T4 execution complete (Pepperolli shell baseline)
- Marked T4 `in_progress` -> `done` after implementing reusable shell components for franchize pages.
- Added `CrewHeader`, `HeaderMenu`, `CrewFooter`, and `FloatingCartIconLink` with palette-driven styling from `crew.theme.palette`.
- Integrated shell components on `/franchize/[slug]`, `/about`, `/contacts`, `/cart`, and `/order/[id]` so floating cart and menu scaffolding persist across core surfaces.

### 2026-02-19 — T4 polish pass (logo + images + bike-only filter)
- Applied follow-up polish from operator feedback: centered/enlarged crew logo in header for stronger brand lockup.
- Restored visual completeness of catalog cards by rendering bike images (with explicit placeholder when `image_url` is absent).
- Tightened data contract in loader to include only `type=bike` items for franchize catalog hydration.

---

## 8) Skills and tooling note

Checked available skills in this environment:
- System: `skill-creator`, `skill-installer`
- Repo-local: `skills/codex-bridge-operator/SKILL.md`, `skills/homework-solution-store-supabase/SKILL.md`, `skills/homework-ocr-intake/SKILL.md`, `skills/homework-pdf-rag-runtime/SKILL.md`

Notify/Supabase execution helpers:
- notifications/callbacks: `scripts/codex-notify.mjs`
- Supabase store/verify flow: `scripts/homework-solution-store-skill.mjs` (`save` then mandatory `exists`)

Notification mode requested by operator: `INFO` level.  
For implementation phases, emit concise progress updates in this file under section 7.

---

## 9) Execution entrypoint alias

For operator shortcut mode `FRANCHEEZEPLAN_EXECUTIONER`, use:
- `docs/FRANCHEEZEPLAN.md` as quick-start runbook,
- then continue with this file (`docs/THE_FRANCHEEZEPLAN.md`) as source-of-truth task ledger.
