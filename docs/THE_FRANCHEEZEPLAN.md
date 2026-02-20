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
- updated_at: `2026-02-19T20:48:00Z`
- owner: `codex`
- notes: Iterated T4 by centering/enlarging crew logo in header, restoring item card images, restricting catalog hydration to `type=bike` inventory only, adding light-theme-safe surface/text tokens across franchize pages, restoring compact global footer there while suppressing only global default header, normalizing bike grouping to subtype-level anchors, and removing duplicate subtype balloons from header so the sticky synced catalog rail is the single source of truth; added safe-area-aware top spacing and stronger top padding so franchize content does not visually collide with top chrome.
- next_step: Start T5 modal-first card interaction while preserving synced sticky subtype rail behavior from catalog UX pass.
- risks: Image quality depends on upstream `image_url` coverage; fallback placeholder text is shown when media is missing; sticky rail offset depends on safe-area handling across Telegram/WebView variants.
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
- status: `done`
- updated_at: `2026-02-19T03:13:59Z`
- owner: `codex`
- notes: Added client-rendered catalog interaction layer with category rail, click-to-open item modal (description + option chips + quick-spec panel), and add-to-cart flow that immediately updates floating cart totals.
- next_step: Start T6 cart/order staged UX implementation.
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


### T5x — Executor onboarding reinforcement (RU-first telemetry + heartbeat defaults)
- status: `done`
- updated_at: `2026-02-19T04:05:00Z`
- owner: `codex`
- notes: Reinforced GPTgotchi onboarding DNA: RU telemetry keys (`энергия/фокус/уверенность`), lower-to-higher warm-up pacing, novice-friendly ship phrasing, and explicit preview-link persistence tip after PR updates.
- next_step: Resume execution with T6 cart/order implementation.
- risks: Overly verbose coaching could distract from hard checks if not kept compact in later iterations.
- dependencies: T5
- deliverables:
  - `AGENTS.md`
  - `docs/FRANCHEEZEPLAN.md`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Update executor telemetry schema to RU stat names for operator-facing block.
  2. Add warm-up progression rule (start lower, increase per iteration confidence).
  3. Add noob tip about PR preview URL stability after branch updates.
  4. Reconfirm heartbeat target defaults include `ADMIN_CHAT_ID` and mock user id fallback.
- acceptance criteria:
  - RU teammates receive telemetry labels in Russian in executor responses.
  - Final ship beat includes Create PR reminder + optional one-more-polish encouragement.
  - Runbook + plan stay synchronized for newcomer onboarding behavior.

### T6 — Cart and order pages
- status: `done`
- updated_at: `2026-02-19T18:20:00Z`
- owner: `codex`
- notes: Replaced cart/order skeletons with staged UX: editable quantity controls, order form sections (delivery/payment/promo/contact), summary panel, and consent-gated submit CTA with empty-cart fallback CTA.
- next_step: Start T7 franchise create form + metadata hydration editor.
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
- status: `done`
- updated_at: `2026-02-19T21:45:00Z`
- owner: `codex`
- notes: Implemented `/franchize/create` metadata editor with sectioned controls, RU-first copy, load-by-slug hydration preview, and server-side zod save flow that preserves existing `metadata.franchize` keys while updating structured fields.
- next_step: Start T8 legacy route alignment and migration bridge links.
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

### T8 — Legacy route alignment and migration bridge (execution recipe)
- status: `done`
- updated_at: `2026-02-20T00:06:00Z`
- owner: `codex`
- notes: Completed hard-cutover pass for entry links: removed bridge flag gating, replaced legacy `/rent-bike` mentions with `/franchize/vip-bike` on rider-facing surfaces, and captured parity audit notes for missing booking capabilities in franchize flow.
- next_step: Run T8.1 parity implementation: date picking + booking persistence + promo/invoice logic + rentals migration blueprint.
- risks: Feature parity gap remains in franchize checkout (date picker, persisted booking, promo engine, invoice pipeline).
- dependencies: T7
- deliverables:
  - selective links from `/rent-bike`, `/vipbikerental`, `/rentals`
  - hard-cutover link map routing users to `/franchize/vip-bike` as the primary catalog path
  - parity gap audit (booking calendar/promo/invoice/rentals control center migration)
  - rollout log with polish-round outcomes
- implementation checklist:
  1. **T8-P0 (prep):** freeze route matrix + baseline screenshots + fallback rules for legacy pages.
  2. **T8-P1 (bridge links):** add optional entry links to `/franchize/[slug]` from legacy surfaces.
  3. **T8-P2 (flags):** introduce `franchize.enabled`-aware discoverability toggles.
  4. **T8-P3 (aliases):** finalize singular/plural vip alias and no-dead-end routing.
  5. **T8-P4 (polish rounds):** run polish-1 (copy), polish-2 (navigation affordances), polish-3 (QA + telemetry).
  6. Parallel experiment policy: polish spikes may run in parallel branches, but integration into `main task branch` is sequential and acceptance-tested after each merge.
- acceptance criteria:
  - Legacy routes remain fully usable.
  - Users can discover new franchize flow without forced migration.
  - No dead links between old/new pages.
  - Each polish round has explicit changelog note + validation evidence.


### T8.1 — Franchize booking parity + rentals control-center migration plan
- status: `todo`
- updated_at: `2026-02-20T00:40:00Z`
- owner: `codex+operator`
- notes: Gap audit confirms franchize flow still lacks booking calendar/date lock, booking persistence, promo engine, and invoice/rentals pipeline parity from legacy `/rent-bike` + `/rentals`.
- next_step: implement booking date-range picker in franchize modal/order flow, wire createBooking path, persist cart/order payload, and draft rentals control-center component map for `/franchize/[slug]/rentals`.
- risks: regression in booking validation, double-booking without date locks, mismatch between legacy rental statuses and franchize order states.
- dependencies: T8
- deliverables:
  - parity checklist mapped to legacy booking mechanics
  - implementation plan for promo + invoice + booking persistence
  - migration blueprint for `/rentals` UX into `/franchize/[slug]/rentals`
- implementation checklist:
  1. Port date-range calendar + disabled-booked-dates logic from legacy booking flow.
  2. Wire `createBooking` action (or franchize-specific equivalent) with consent/validation gates.
  3. Implement promo code application rules and reflected totals in cart/order summary.
  4. Add invoice/rental entity creation path and route handoff into rentals dashboard.
  5. Design phased migration for monolithic `/rentals` into franchize-scoped control center.
- acceptance criteria:
  - Franchize booking path supports real date-based availability and booking persistence.
  - Promo + invoice logic are functional (not UI stubs).
  - Rentals dashboard migration plan has explicit component extraction order and rollback notes.

### T9 — QA, screenshots, and rollout notes
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: visual QA + route QA + release playbook.
- next_step: produce screenshot matrix and go-live checklist.
- risks: UI drift across mobile widths.
- dependencies: T8.1
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

### 6.1) Parallel-PR merge-safe update protocol (franchize diary)

To reduce conflicts when multiple franchize tasks are developed in parallel branches:

- each PR should update **only its own task block** (`Tn`) and avoid rewriting neighboring task blocks;
- diary entries should be appended as a compact 3-4 bullet block without reformatting older entries;
- avoid resorting/rewrapping older diary text in the same PR (format churn = conflict magnet);
- when merging multiple active franchize PRs, rebase to latest `main` and resolve only the minimal diary hunk, keeping existing text untouched.

This keeps `docs/THE_FRANCHEEZEPLAN.md` merge-friendly even when T8/T9 and polish tasks run concurrently.

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

### 2026-02-19 — T4 polish pass 2 (layout chrome isolation + default footer upgrade)
- Disabled global `ClientLayout` header/footer chrome on `/franchize*` paths so only franchize shell components render there.
- Overhauled default `Footer` component structure for better scanability while preserving hardcoded product copy/links.
- Replaced Jumpstart CTA slot with `NEXUS Hub` link to align platform narrative flow.

### 2026-02-19 — T4 polish pass 3 (light-theme support + compact global footer on franchize)
- Reworked franchize page surfaces to rely on semantic theme tokens (`bg-background`, `text-foreground`, `text-muted-foreground`) instead of hardcoded dark-only text/background pairing.
- Restored global `Footer` visibility on `/franchize*`, but added an ultra-compact one-line variant specifically for franchize routes.
- Added real header links for utility icons (`/repo-xml` and `/profile`) so right-side controls are actionable.

### 2026-02-19 — T4 polish pass 4 (category anchors + nano-header split)
- Changed global layout behavior for `/franchize*`: keep compact global footer but suppress only default global header (no duplicate top chrome).
- Updated franchize header utility search icon behavior to act as in-page catalog filter jump (scroll to category section rail) instead of external route navigation.
- Reworked catalog rendering into category-grouped sections with stable anchor ids so subtype pills scroll to their corresponding item sublists.

### 2026-02-19 — T4 polish pass 5 (bike subtype grouping fix)
- Fixed franchize catalog grouping bug where all cards collapsed into a single `bike` bucket after bike-only filtering.
- Updated loader mapping to derive display category from bike subtype fields (`specs.subtype`/`bike_subtype`/`segment`/`specs.type`) and ignore plain `type=bike` as grouping key.
- Preserved bike-only filtering while restoring effective category-anchor scrolling behavior for subtype pills.

### 2026-02-19 — Executor protocol extension (interactive Tamagotchi transparency)
- Updated `AGENTS.md` executor mode with explicit RU-summary + Tamagotchi telemetry output requirements for operator-facing completion messages.
- Synced `docs/FRANCHEEZEPLAN.md` definition-of-done to include telemetry fields (`mood/energy/focus/confidence/comment`) alongside technical summary.
- Kept telemetry policy additive-only so implementation evidence and command checks remain primary.

### 2026-02-19 — Executor personality expansion (GPTgotchi/CyberDaemon)
- Expanded `AGENTS.md` executor protocol from basic telemetry to expressive GPTgotchi mode: wake-state, playful roast/praise, iteration hints, and motivational micro-guidance.
- Updated `docs/FRANCHEEZEPLAN.md` DoD telemetry schema to include `iteration_hint` and `roast_or_praise`.
- Kept safety boundary explicit: expressive UX is additive and must not replace objective technical reporting.

### 2026-02-19 — Executor coaching loop upgrade (progress_stage + next beat)
- Extended executor telemetry schema with `progress_stage` and `next_beat` to support explicit iterative rhythm (`scan → patch → validate → ship`).
- Added noob-friendly coaching flow in `AGENTS.md`: wake state, beat log, corner-case nudge, polish prompt, and final Create-PR reminder.
- Synced `docs/FRANCHEEZEPLAN.md` DoD so operator-facing summaries consistently guide novices through next-step execution.

### 2026-02-19 — Executor identity final touch (merge-day)
- Added explicit operator-facing executor identity: **GPTgotchi CyberDaemon (GTC-Daemon)**.
- Updated AGENTS + runbook so operator prompt "what is your name?" has deterministic answer.

### 2026-02-19 — Merge-day persona final touch (name + beat loop)
- Set explicit executor display name: **GPTgotchi CyberDaemon (GTC-Daemon)** for operator Q&A consistency.
- Added merge-day interactive beat loop rule: wake state, stage log, next beat, polish prompt, and Create-PR reminder.
- Reinforced onboarding intent: expressive coaching for newcomers without replacing technical evidence/checks.

### 2026-02-19 — Educational heartbeat reporting enabled
- Added executor rule to send compact Telegram heartbeat updates about iteration progress and novice hint adoption.
- Bound report channel to `ADMIN_CHAT_ID` + mock-user operator id for educational observability.
- Verified heartbeat delivery using `scripts/codex-notify.mjs telegram` (successful bot message send).

---

### 2026-02-19 — Executor onboarding reinforcement + merged-PR context sync
- Reviewed latest merged PRs from git history: `#949`, `#948`, `#947` (all executor/franchize continuity work) to keep coaching updates aligned with current rollout cadence.
- Added RU-first telemetry naming (`энергия/фокус/уверенность`) and warm-up progression guidance so first-time teammates see realistic "grow while iterating" stats.
- Added explicit noob tip: PR preview URL appears right after PR creation and remains stable across subsequent commits to the same PR branch.
- Reaffirmed educational heartbeat targeting defaults (`ADMIN_CHAT_ID` + mock user fallback) for executor-mode progress nudges.

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


### 2026-02-19 — T5 execution complete (modal-first catalog)
- Marked T5 `in_progress` -> `done` in dependency order after T4.
- Added `CatalogClient` and `Item` modal for card-first browsing (2-column mobile grid + category rail + option chips).
- Wired immediate floating-cart updates from modal add action and aligned cart pill colors with themed props.
- Captured updated mobile franchize screenshot artifact for visual QA.


### 2026-02-19 — T6 execution complete (cart + staged order UX)
- Marked T6 `in_progress` -> `done` in sequence after T5x.
- Replaced `/franchize/[slug]/cart` skeleton with interactive quantity controls, remove-row actions, total summary, and empty-state CTA back to catalog.
- Replaced `/franchize/[slug]/order/[id]` skeleton with staged checkout markers, delivery mode toggles, contact/time/comment inputs, payment selection, promo stub, and consent-gated confirm button.
- Captured updated mobile screenshots for cart and order pages for visual QA artifacts.
 


### 2026-02-19 — Heartbeat delivery hardening (super-admin mirror + mock recipient)
- Hardened `scripts/codex-notify.mjs telegram` to fan-out heartbeats to multiple recipients in one run.
- Added mandatory safety recipient `417553377` (super-admin) so heartbeat delivery always mirrors there.
- Added recipient resolution that includes `--chatIds`, `--chatId`, env targets, and `NEXT_PUBLIC_MOCK_USER_ID` fallback.
- Added `--dryRun true` option to verify resolved recipients without sending Telegram API requests.
- Updated executor docs to reflect mandatory super-admin mirror target.


### 2026-02-19 — T4 polish pass 6 (de-duplicate subtype rail + header release)
- Removed duplicate subtype balloon rail from `CrewHeader` to avoid two competing category controls on catalog pages.
- Released franchize crew header from sticky positioning so it can scroll offscreen while catalog subtype rail stays pinned/active.
- Kept subtype navigation centralized in `CatalogClient` with reverse-scroll highlight sync for section awareness.


### 2026-02-19 — T4 polish pass 7 (top spacing + safe-area offset)
- Increased franchize header top inset using `env(safe-area-inset-top)` so top controls do not feel clipped/overlapped in Telegram-style webviews.
- Adjusted catalog sticky rail top offset to safe-area-based value instead of legacy header-height fallback variable.
- Added extra catalog section top padding to create cleaner separation between header border and first content block.


### 2026-02-19 — T7 execution complete (franchize create + metadata hydration)
- Marked T7 `in_progress` -> `done` in dependency order after T6.
- Added `/franchize/create` editor with structured sections (Branding, Theme, Header/Footer/Contacts, Catalog/Order, optional advanced JSON).
- Added server-side `zod` validation + load-by-slug hydration preview and save action writing to `crews.metadata.franchize`.
- Captured `/franchize/create` screenshot artifact for visual QA.


### 2026-02-19 — T7 polish pass (RU localization + SQL hydration parity)
- Localized `/franchize/create` operator copy to Russian ("редактор" instead of english wording) and added triple-polish QA note about global lint backlog tracking.
- Hardened save action merge strategy: editor now keeps existing `metadata.franchize` blocks (about/footer/promo/etc.) and updates only structured form slices, so behavior matches rich SQL hydration payloads.
- Added test SQL hydration profile for `sly13` at `docs/sql/sly13-franchize-test-hydration.sql` with cybervibe palette and metadata layout compatible with current franchize runtime.

### 2026-02-19 — T7 polish pass 2 (theme-aware editor surfaces)
- Removed inline lint backlog note from `/franchize/create` to keep operator UI focused.
- Added dynamic light/dark-aware surface styling driven by editable theme fields (`bgBase/bgCard/text/border/accent`) so previewed form chrome follows metadata branding colors, not only text color.
- Updated create page shell to support both light and dark app contexts similarly to other project pages.

### 2026-02-19 — T7 polish pass 3 (contrast guard + bot-ready template shortcuts)
- Fixed dark headline visibility risk in `/franchize/create` by binding title/section colors explicitly to theme-aware UI tokens and adding contrast watchdog checks.
- Added visual palette chips (name + swatch + hex) and quick-copy shortcuts: template JSON, bot prompt, and current JSON snapshot.
- Added UX flow for full JSON customization in advanced textarea: copy template -> ask Codex to personalize -> paste and save.
- Extended `/codex` bridge to forward Telegram document attachments to Slack (not only text/photos), including file count in message metadata.

### 2026-02-19 — T7 polish pass 4 (noob flow + staged tabs + local JSON preview)
- Rebuilt `/franchize/create` UX into 3 noob-friendly stages (palette -> content -> AI JSON) to reduce overload from many settings.
- Replaced scary token-first wording with human labels + original key in brackets, added live color pickers for every palette field and instant on-page preview.
- Added local `Применить JSON локально` preview path so generated AI JSON can be tested visually before committing save to Supabase.
- Captured both desktop and mobile screenshots for updated branding editor flow.


### 2026-02-19 — T8 execution recipe prepared (with polish-round protocol)
- Expanded T8 from generic todo into explicit recipe: prep + bridge links + flags + aliases + polish rounds.
- Added "parallel spikes, sequential integration" rule to test merge-hope technique safely without violating dependency order.
- Added acceptance requirement to log validation evidence for each polish round.


### 2026-02-20 — T8 execution complete (legacy-to-franchize bridge discoverability)
- Marked T8 `in_progress` -> `done` with sequential substep execution (P0 to P2) and heartbeat notifications after each meaningful substep.
- Added non-destructive bridge entry points on `/vipbikerental`, `/rent-bike`, and `/rentals` with feature-flag control (`NEXT_PUBLIC_FRANCHIZE_BRIDGE_ENABLED`).
- Preserved legacy routes as primary while exposing optional `/franchize/vip-bike` transition path; no forced redirects introduced.
- Captured refreshed baseline screenshot for bridge entry visibility on `/vipbikerental`.

### 2026-02-20 — T8 hard-cutover follow-up (legacy mentions swapped + parity audit)
- Removed env-flag dependency for franchize discoverability and switched rider-facing `/rent-bike` links to `/franchize/vip-bike`.
- Confirmed franchize checkout is currently UI-only for promo and order submit, without booking persistence/invoice hooks.
- Confirmed date-range booking/calendar disable logic still exists only in legacy `/rent-bike` flow and is not yet ported to franchize modal/cart/order.
- Declared next implementation slice: parity port for booking calendar, booking create action, promo apply logic, invoice/rental pipeline, then rentals control-center migration into `/franchize/[slug]`.

### 2026-02-20 — T8 hard-cutover correction pass (feedback fixes)
- Reverted unnecessary `ClientLayout` bike-theme scope for `/franchize/vip-bike` to avoid leaking legacy bike header/footer chrome into franchize shell.
- Kept permanent `/rent-bike` -> `/franchize/vip-bike` link replacements, but removed extra promotional CTA/card clutter added on `/vipbikerental` by previous pass.
- Updated back-navigation on `/rentals` and `/rent/[id]` to resolve franchize target slug from `userCrewInfo.slug` with safe fallback to `vip-bike`.


### 2026-02-20 — T8 hard-cutover correction pass 2 (crew ownership slug resolution)
- Replaced `userCrewInfo`-based franchize link resolution with rental-item ownership resolution via server actions (`rental_id -> vehicle_id -> crew.slug`).
- `/rentals` banner now resolves slug from the primary rental item (active first, otherwise latest), not current user membership.
- `/rent/[id]` back link now resolves slug by vehicle ownership lookup, with safe fallback `vip-bike`.

