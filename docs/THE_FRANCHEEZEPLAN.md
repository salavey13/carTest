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



### T8.2 — Pepperolli parity polish: omnipresent balloons + searchable catalog + top ticker metadata
- status: `done`
- updated_at: `2026-02-20T02:33:43Z`
- owner: `codex`
- notes: Refined franchize header/catalog parity against Pepperolli cues: removed header clutter, moved motto into menu modal, introduced omnipresent quick-link balloons in header, implemented top ticker sourced from `catalog.tickerItems`, and added full search bar with working item filtering.
- next_step: Continue T8.1 booking parity implementation before QA.
- risks: `catalog.quickLinks` values that do not match actual section ids will still navigate to catalog top; future enhancement can support `{label,href}` quick-link objects for custom anchors.
- dependencies: T8
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
  - `app/franchize/actions.ts`
  - `docs/sql/vip-bike-franchize-hydration.sql`
  - `docs/sql/sly13-franchize-test-hydration.sql`
- implementation checklist:
  1. Remove excessive storefront text from header and keep compact logo-first lockup.
  2. Add omnipresent quick links in header for cross-page jump-back to catalog sections.
  3. Add ticker strip at top and hydrate from SQL metadata seeds (`catalog.tickerItems`).
  4. Add full-width catalog search input + action button and wire filtering among items.
  5. Move tagline/motto from dense header area into menu modal.
- acceptance criteria:
  - Header now contains ticker + quick links and appears consistently on catalog/about/contacts.
  - Search input visibly filters catalog items by title/subtitle/description/category.
  - VIP-BIKE and SLY13 SQL hydration docs include demo ticker metadata entries.

### T8.3 — Pepperolli parity follow-up: header cleanup + map contacts + footer alignment + route cleanup
- status: `done`
- updated_at: `2026-02-20T04:05:00Z`
- owner: `codex`
- notes: Executed requested follow-up step-by-step: removed header search icon, switched to dedicated profile component wrapper, removed catalog title/path clutter, added contact map block sourced from metadata coordinates, deleted mistakenly created unslugged franchize pages, and rebuilt footer layout closer to Pepperolli reference.
- next_step: Continue T8.1 booking/rentals parity before QA.
- risks: map iframe relies on metadata `contacts.map.gps`; if missing, fallback placeholder is shown until crew metadata is filled.
- dependencies: T8.2
- deliverables:
  - `app/franchize/components/FranchizeProfileButton.tsx`
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/components/CrewFooter.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
  - `app/franchize/actions.ts`
  - removed: `app/franchize/about/page.tsx`
  - removed: `app/franchize/cart/page.tsx`
  - removed: `app/franchize/contacts/page.tsx`
  - removed: `app/franchize/order/[id]/page.tsx`
- implementation checklist:
  1. Header icon cleanup: remove search icon from top bar, keep profile access via dedicated component wrapper over global user widget.
  2. Catalog cleanup: remove lingering title/path label clutter near search block.
  3. Contacts map integration: parse `metadata.franchize.contacts.map.gps` and render embedded map with transport/directions notes.
  4. Footer visual pass: restructure into full-width yellow slab with sectioned contacts/menu/profile/social rows and bottom info strip.
  5. Route cleanup: delete obsolete unslugged franchize pages that were previously used as redirects.
- acceptance criteria:
  - Header has no search icon and still provides profile action.
  - Catalog top area starts from search bar without extra title/path text.
  - Contacts page includes map card and metadata-driven map context details.
  - Footer visual hierarchy is closer to Pepperolli screenshots on mobile/desktop.
  - Only slug-scoped franchize info/cart/order pages remain.

### T8.4 — Reinvestigate car-rent VibeMap and integrate into franchize contacts
- status: `done`
- updated_at: `2026-02-20T05:05:00Z`
- owner: `codex`
- notes: Reinvestigated reusable `VibeMap`, fixed practical bugs (safe fallback image + object-fit containment + reset control + cleanup), and integrated VibeMap-driven map card into `/franchize/[slug]/contacts` using metadata coordinates instead of Yandex iframe.
- next_step: Continue T8.1 booking/rentals parity before QA.
- risks: static-image map calibration still depends on valid per-crew bounds; defaults target NN map preset and may require crew-specific tuning later.
- dependencies: T8.3
- deliverables:
  - `components/VibeMap.tsx`
  - `app/franchize/components/FranchizeContactsMap.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
  - `app/franchize/actions.ts`
  - `docs/sql/vip-bike-franchize-hydration.sql`
  - `docs/sql/sly13-franchize-test-hydration.sql`
- implementation checklist:
  1. Audit existing car-rent VibeMap behavior and identify regressions/rough edges.
  2. Improve VibeMap resilience (fallback map image + better contain rendering + quick reset control).
  3. Add franchize contacts map wrapper powered by VibeMap with marker from `contacts.map.gps`.
  4. Extend contacts-map metadata contract with optional map image and bounds.
  5. Update SQL hydration docs so VIP-BIKE/SLY13 include map image + bounds metadata.
- acceptance criteria:
  - Contacts page uses VibeMap component (no iframe dependency).
  - Invalid/missing GPS data shows safe placeholder state.
  - VibeMap has safer defaults and remains reusable on existing pages.

### T8.5 — No-code map calibration tab + Telegram-first footer/contact copy cleanup
- status: `done`
- updated_at: `2026-02-20T06:10:00Z`
- owner: `codex`
- notes: Implemented dedicated map/social tab in franchize create UI (GPS/image/bounds/social links), wired save/load in server actions, removed outdated email-focused UX from franchize contacts/footer, and swapped footer auth links with crew social links to match Telegram always-online model.
- next_step: Continue T8.1 booking/rentals parity before QA.
- risks: existing crews without `footer.socialLinks` rely on derived fallback from footer columns/telegram.
- dependencies: T8.4
- deliverables:
  - `app/franchize/create/CreateFranchizeForm.tsx`
  - `app/franchize/actions.ts`
  - `app/franchize/components/CrewFooter.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
- implementation checklist:
  1. Add special `Карта+соцсети` stage in create form.
  2. Expose map calibration fields (`gps`, `imageUrl`, bounds) + social links text in no-code UI.
  3. Persist/load these fields through `saveFranchizeConfig` / `loadFranchizeConfigBySlug`.
  4. Remove legacy email-forward UX fragments from contacts/footer surfaces.
  5. Replace footer auth links with social links sourced from crew metadata.
- acceptance criteria:
  - Create form has working map calibration tab and saved values survive reload.
  - Footer no longer shows login/register items and instead lists crew socials.
  - Contacts screen avoids email-first presentation and stays Telegram-first.

### T8.1 — Franchize booking parity + rentals control-center migration plan
- status: `done`
- updated_at: `2026-02-20T12:35:00Z`
- owner: `codex+operator`
- notes: Completed planning-focused parity package and split implementation into phased tracks: booking data contract, promo/invoice pipeline, and rentals control-center extraction. Added explicit pre-QA "maximum polish" backlog task (T8.6) so QA starts only after UX/copy/state consistency hardening.
- next_step: Execute T8.6 polish backlog in sequence, then run T9 QA matrix.
- risks: legacy `/rent-bike` remains source-of-truth for some booking mechanics until implementation phase; parity rollout needs feature-flagged smoke checks to avoid checkout regressions during transfer.
- dependencies: T8
- deliverables:
  - parity checklist mapped to legacy booking mechanics
  - implementation plan for promo + invoice + booking persistence
  - migration blueprint for `/rentals` UX into `/franchize/[slug]/rentals`
  - pre-QA maximum polish backlog (`T8.6`) with dependency gating before QA
- implementation checklist:
  1. Freeze parity scope from legacy `/rent-bike` + `/rentals`: date-lock rules, validation gates, promo interactions, booking persistence, invoice lifecycle, status transitions.
  2. Define implementation order with rollback notes:
     - P1 booking calendar/date-lock + `createBooking` parity,
     - P2 promo + totals + invoice wiring,
     - P3 rentals control-center migration into `/franchize/[slug]/rentals`.
  3. Define data contracts and telemetry checkpoints for each phase (request payload, expected state transition, operator-visible status text, fallback path).
  4. Add pre-QA polish backlog task to close UX debt before screenshots/lint/build QA pass.
  5. Keep discontinued static-page assumptions out of scope (operator confirmed those pages were intentionally removed in previous merge).
- acceptance criteria:
  - Phased parity plan is explicit, ordered, and executable without parallel ambiguity.
  - Data/telemetry contract is documented for booking, promo, invoice, and rentals states.
  - T8.6 exists as the mandatory pre-QA polish gate.

### T8.6 — Maximum polish backlog before QA (UX/state/copy hardening)
- status: `done`
- updated_at: `2026-02-20T16:30:00Z`
- owner: `codex+operator`
- notes: Closed remaining polish items by normalizing RU fallback copy on `/about` and adding checkout submit-state hints for empty cart/consent/Telegram-WebApp prerequisites to keep order flow status legible before QA.
- next_step: Start T9 QA matrix (screenshots + route smoke + lint/build evidence).
- risks: XTR invoice flow requires Telegram auth context (`user.id`) and valid bot runtime env in deployment; keep non-Telegram fallback payment options usable.
- dependencies: T8.1
- deliverables:
  - polish checklist with completion evidence links/notes
  - updated UX copy consistency pass for franchize shell/modals/cart/order/contacts
  - route/state edge-case matrix with resolved behaviors
- implementation checklist:
  1. P0 — Copy/uniformity: normalize CTA labels, empty-state wording, and error/consent text across `/franchize/[slug]`, cart, order, contacts.
  2. P1 — Visual consistency: align spacing/radius/token usage (header/menu/category rail/cards/modal/cart pill/footer) for light/dark-safe rendering.
  3. P2 — Interaction reliability: confirm modal open/close, quantity updates, subtotal recalculation, and back navigation are deterministic across mobile breakpoints.
  4. P3 — Route/state resilience: harden missing slug/item/cart/order states, add no-crash fallbacks, and verify redirect/bridge links where still active.
  5. P4 — Operator observability: ensure status indicators are visible (loading/saving/submitting), and update rollout notes with known limitations before T9.
- acceptance criteria:
  - No obvious UX copy drift across franchize core surfaces.
  - Core interactions are stable under quick user actions (tap spam/back-forward/reopen modal).
  - T9 can start with a clean QA checklist instead of discovering basic polish issues.

### T9 — QA, screenshots, and rollout notes
- status: `done`
- updated_at: `2026-02-20T06:50:41Z`
- owner: `codex`
- notes: Completed QA matrix: captured required franchize screenshots (catalog, menu, item modal, cart, order, contacts), validated key viewport renders, executed lint/build, and confirmed slug-scoped route smoke responses are HTTP 200.
- next_step: Start extension task for post-QA fixes (optional visual/token cleanup + warning backlog triage).
- risks: Non-blocking global lint warnings and missing env warnings remain outside T9 scope; franchize routes still gracefully degrade to fallback data when Supabase fetch is unavailable.
- dependencies: T8.6
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

### T10 — Post-QA franchize smoke automation script
- status: `done`
- updated_at: `2026-02-20T17:20:00Z`
- owner: `codex`
- notes: Added a reusable smoke-check script for canonical slug-scoped franchize routes and exposed it via `npm run qa:franchize` for quick post-deploy validation.
- next_step: Propose next extension task for warning backlog triage outside franchize scope.
- risks: Smoke status depends on reachable deployment URL; route health checks do not replace visual/manual UX validation.
- dependencies: T9
- deliverables:
  - `scripts/franchize-qa-check.mjs`
  - `package.json`
- implementation checklist:
  1. Add route smoke script with configurable base URL + slug env overrides.
  2. Validate catalog/about/contacts/cart/order endpoints return HTTP 2xx.
  3. Expose script as a package command for easy operator reuse.
- acceptance criteria:
  - `npm run qa:franchize` exits 0 when core franchize routes are healthy.
  - Script prints actionable per-route pass/fail output for fast incident triage.

### T11 — Franchize header menu overlap + button chrome cleanup
- status: `done`
- updated_at: `2026-02-20T18:05:00Z`
- owner: `codex`
- notes: Fixed menu overlay layering/viewport fit to prevent content overlap when opened, and removed border chrome from header `Меню` + `Профиль` buttons per operator feedback.
- next_step: Re-run mobile visual pass for header/menu states and decide if close-button border should also be flattened for visual parity.
- risks: Visual behavior may vary slightly in Telegram WebView safe-area offsets across Android shells.
- dependencies: T10
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/FranchizeProfileButton.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
- implementation checklist:
  1. Remove bordered chrome from open-menu and profile action wrappers.
  2. Raise menu modal overlay z-index above sticky catalog surfaces.
  3. Constrain modal height with safe-area-aware top offset + internal scroll.
- acceptance criteria:
  - Header menu modal opens without underlay controls/content visually crossing over menu surface.
  - `Меню` and `Профиль` buttons render without border outlines in franchize header.


### T12 — Pepperolli card polish + unified sticky group balloons refactor
- status: `done`
- updated_at: `2026-02-21T00:45:00Z`
- owner: `codex`
- notes: Unified top section/group balloons into `CrewHeader` for all franchize pages, extended blur safe-area cap (`-42px`) with hidden rail scrollbars, and rebuilt catalog card styling with Pepperolli-like variants, dynamic badges, and mixed CTA text (`Добавить`/`Выбрать`). Expanded catalog hydration beyond `bike` to include `accessories`, `gear`, and `wbitem`, then added dynamic showcase groups (`23rd feb edition`, `Все по 6000`) rendered ahead of base categories.
- next_step: Optional T13 can tune exact card copy truncation and modal/button behavior parity using production Supabase data once network/env is available.
- risks: Supabase network/env in local runner failed (`fetch failed`), so dynamic multi-type hydration and group distribution were validated on fallback shell only.
- dependencies: T11
- deliverables:
  - `app/franchize/actions.ts`
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
- implementation checklist:
  1. Remove duplicate top balloons source and keep a single sticky rail in header for all franchize routes.
  2. Extend top blur beyond viewport cutout and suppress horizontal rail scrollbar chrome.
  3. Add card visual variants, dynamic HIT badge behavior, description fallback cleanup, and CTA text split.
  4. Expand supported catalog types + add synthetic showcase groups for richer roster rails.
- acceptance criteria:
  - Header owns a single top balloon rail and it is visible across catalog/about/contacts/cart.
  - Sticky blur cap removes camera-cutout gap on mobile while avoiding scrollbars in balloon rails.
  - Catalog cards show variant chrome + dynamic CTA labels and no hardcoded stale description behavior.
  - Catalog hydration includes non-bike types and displays synthetic showcase groups when matches exist.



### T13 — Modal truncation/specs + deterministic balloon rails + order extras polish
- status: `done`
- updated_at: `2026-02-21T01:35:00Z`
- owner: `codex`
- notes: Added 3-line expandable description behavior in item modal (Pepperolli-style), rendered real item specs from metadata, stabilized top balloon rail active-state selection via deterministic intersection logic, enforced `wbitem` subgroup ordering last, and expanded order flow totals with selectable extras included in sidebar total + XTR invoice 1% calculation/details.
- next_step: Start T14 functional closeout for modal-selected extras persistence into cart line identity and rental CRM transition statuses.
- risks: local runner cannot fetch Supabase live catalog (`fetch failed`), so modal/specs behavior was verified on fallback shell and production smoke checks by slug.
- dependencies: T12
- deliverables:
  - `app/franchize/actions.ts`
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/modals/Item.tsx`
  - `app/franchize/components/OrderPageClient.tsx`
- implementation checklist:
  1. Limit modal description to 3 lines on open, with explicit show more/less toggle.
  2. Surface real bike specs from `cars.specs` in modal instead of static placeholder copy.
  3. Remove jerkiness in top balloon rail selection by using deterministic visible-section scoring and stable active chip highlight.
  4. Keep `wbitem` subgroup hard-pinned to the end of rendered catalog groups.
  5. Add order extras to final amount and ensure XTR invoice tip uses 1% of full total with payload metadata.
- acceptance criteria:
  - Modal opens with compact 3-line description and expandable details.
  - Specs block shows meaningful metadata for available fields.
  - Balloon rail keeps stable active group state while scrolling category sections.
  - `wbitem` groups render last.
  - Checkout summary and XTR invoice include extras in total/tip calculation.

### T14 — Final franchize perfection pass (cart line options -> rental handoff)
- status: `done`
- updated_at: `2026-02-21T02:05:00Z`
- owner: `codex`
- notes: Implemented cart-line option persistence (`itemId+optionHash`), wired totals from structured cart lines across cart/order/floating widget, created franchize rental card route, and moved deep-link flow toward franchize rental pages. Added webhook handler for `franchize_order` to upsert rentals as hot leads on successful XTR payment and notify renter/owner/admin with franchize links.
- next_step: Start T15 for richer post-payment lifecycle automation (owner acceptance, photo checklist bridge, events parity with legacy rentals).
- risks: webhook flow depends on invoice metadata consistency and existing users/cars ownership links in Supabase; local fallback shell still limits full live validation.
- dependencies: T13
- deliverables:
  - `app/franchize/hooks/useFranchizeCart.ts`
  - `app/franchize/hooks/useFranchizeCartLines.ts`
  - `app/franchize/modals/Item.tsx`
  - `app/franchize/components/CartPageClient.tsx`
  - `app/franchize/components/OrderPageClient.tsx`
- implementation checklist:
  1. Store modal options as structured cart line payload.
  2. Recalculate cart/order totals from structured line-level extras.
  3. Attach order->rental transition hook after successful XTR payment.
- acceptance criteria:
  - cart and order totals stay consistent across reloads with optioned lines.
  - successful XTR confirmation marks lead as hot and advances rental flow stage.


### T15 — Franchize rental lifecycle parity (post-hot-lead automation)
- status: `done`
- updated_at: `2026-02-21T02:40:00Z`
- owner: `codex`
- notes: Investigated post-hot-lead stuck flow (`no active rental` on TG photo). Implemented auto-resolve fallback in Telegram photo webhook: when `awaiting_rental_photo` state is missing, backend now detects relevant renter rental by status/events and infers expected photo type (`start`/`end`). Also marked photo events as `completed` in both webhook and server action paths so owner confirmation gates are unblocked.
- next_step: Start T16 for full franchize rental card action parity (owner confirm + photo workflow controls directly on franchize rental page).
- risks: auto-resolve photo fallback currently targets renter-side rentals (`user_id`) and depends on accurate event history for inference.
- dependencies: T14
- deliverables:
  - `app/api/telegramWebhook/route.ts`
  - `app/rentals/actions.ts`
- implementation checklist:
  1. Add resilient fallback for Telegram photo uploads without explicit `user_states` session.
  2. Ensure photo events are persisted with `status=completed` so action gates can progress.
  3. Keep compatibility with existing `/actions` command flow.
- acceptance criteria:
  - Sending a rental photo from Telegram no longer hard-fails with `no active rental` when session state was lost.
  - Owner-side pickup/return confirmations can detect uploaded photos via completed events.


### T16 — Franchize rental page action controls (owner/renter parity UI)
- status: `done`
- updated_at: `2026-02-21T21:28:38Z`
- owner: `codex`
- notes: Finished role-aware lifecycle controls on franchize rental card: owner sees confirm pickup/return actions, renter sees Telegram photo DO/POСЛЕ launchers, and runtime card now receives owner/renter ids from `getFranchizeRentalCard` so actions are guarded by actual participant role.
- next_step: Start T17 theme mesh parity audit (crew palette vs global theme tokens).
- risks: Status badge/actions refresh still relies on page reload after server action completion; can be improved with optimistic/state re-fetch pass in follow-up polish.
- dependencies: T15
- deliverables:
  - `app/franchize/[slug]/rental/[id]/page.tsx`
  - `app/franchize/actions.ts`
  - `app/rentals/actions.ts`
- implementation checklist:
  1. Render role-aware action buttons on franchize rental page.
  2. Add server action bindings for pickup/return/photo initiation.
  3. Reflect real-time state transitions after action completion.
- acceptance criteria:
  - Core rental lifecycle can continue from franchize rental page without Telegram command roundtrip.


### T16A — Navigation tap reliability hotfix (menu/footer/profile/cart)
- status: `done`
- updated_at: `2026-02-21T18:30:00Z`
- owner: `codex`
- notes: Fixed franchize navigation taps in Telegram/mobile runtime where Next.js client-link interactions were intermittently swallowed: switched footer/cart to direct anchors, hardened profile dropdown actions with explicit `window.location.assign`, and kept header modal link handling explicit.
- next_step: Continue T16 role-aware rental action controls.
- risks: Full-page navigation reload is now preferred for reliability in webview contexts; acceptable for these utility links.
- dependencies: T16
- deliverables:
  - `app/franchize/components/CrewFooter.tsx`
  - `app/franchize/components/FranchizeProfileButton.tsx`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
- implementation checklist:
  1. Replace fragile client-side menu links in affected surfaces with deterministic navigation handlers/anchors.
  2. Verify header menu, footer menu, profile dropdown, and floating cart interactions on mobile viewport.
  3. Record ad-hoc polish task in FRANCHEEZEPLAN diary for traceability.
- acceptance criteria:
  - All primary franchize navigation entry points are tappable in mobile webview context and open the expected route.


### T16B — Subpage "back to catalog" link reliability
- status: `done`
- updated_at: `2026-02-21T19:05:00Z`
- owner: `codex`
- notes: Fixed remaining non-clickable returns from franchize subpages by replacing fragile internal `next/link` calls with deterministic anchors on cart/order/rental surfaces.
- next_step: Continue T16 role-aware lifecycle controls implementation.
- risks: anchor-based navigation forces full reload, but is acceptable for recovery/back-navigation actions in webview.
- dependencies: T16A
- deliverables:
  - `app/franchize/components/CartPageClient.tsx`
  - `app/franchize/components/OrderPageClient.tsx`
  - `app/franchize/[slug]/rental/[id]/page.tsx`
- implementation checklist:
  1. Replace `Вернуться в каталог` links on cart/order with direct anchors.
  2. Replace rental card `К каталогу` and follow-up action links with deterministic anchors.
  3. Re-validate mobile subpage back-navigation flows end-to-end.
- acceptance criteria:
  - Back-to-catalog links on franchize subpages open catalog reliably in mobile/webview contexts.


### T16C — Unified franchize navigation pattern + sticky category rail sync
- status: `done`
- updated_at: `2026-02-21T19:45:00Z`
- owner: `codex`
- notes: Unified navigation reliability pattern via shared helper (`navigateWithReload` + `toCategoryId`) and rebuilt catalog header rail to read real rendered section order, hide empty groups, smooth-scroll to section on tap, auto-keep active pill in view, and keep only the rail sticky while top header block scrolls away.
- next_step: Continue T16 role-aware lifecycle actions (or pick next ready planned task when operator requests generic FRANCHEEZEPLAN continuation).
- risks: rail sync depends on section DOM (`section[data-category]`) staying stable in catalog markup.
- dependencies: T16B
- deliverables:
  - `app/franchize/lib/navigation.ts`
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
  - `app/franchize/components/FranchizeProfileButton.tsx`
  - `AGENTS.md`
- implementation checklist:
  1. Introduce shared franchize navigation helper and reuse it in client navigation handlers.
  2. Sync header category rail with rendered catalog groups (same order, no empty hardcoded groups).
  3. Keep category pills scrollbar hidden, smooth scroll on click, and auto-scroll active pill into view while catalog is scrolled.
  4. Make top header block scroll out while category rail stays pinned.
  5. Lock QA default slug guidance to `vip-bike` in operator docs.
- acceptance criteria:
  - Category pills click-scroll correctly, active pill stays visible during catalog scroll, and rail order matches rendered groups without empty placeholders.



### T16D — Item modal action reliability (scroll lock + add-to-cart tap hardening)
- status: `done`
- updated_at: `2026-02-21T20:15:00Z`
- owner: `codex`
- notes: Completed ad-hoc reliability pass for catalog item modal: background scroll stays locked while modal is open, modal body scrolls independently, and add-to-cart CTA now handles touch/click with guarded handler to avoid swallowed taps in webview contexts.
- next_step: Continue T16 role-aware lifecycle actions, then start T17 theme mesh parity.
- risks: Touch + click event dedupe must remain stable across mobile browsers; keep regression checks on quantity increments.
- dependencies: T16C
- deliverables:
  - `app/franchize/modals/Item.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Keep page background non-scrollable during modal open without trapping modal content scroll.
  2. Harden modal add-to-cart CTA press handling for Telegram/mobile webview gestures.
  3. Record this as an ad-hoc task + diary note for franchise traceability.
- acceptance criteria:
  - Modal content scrolls internally while page background remains static.
  - `Добавить` in modal consistently adds a line to cart from mobile/webview tap interactions.


### T16E — Header/logo/nav regression hotfix (ticker offset + SPA links + branding ACL)
- status: `done`
- updated_at: `2026-02-21T21:35:00Z`
- owner: `codex`
- notes: Fixed header logo vertical drift caused by ticker offset, restored SPA-fast internal franchize navigation (menu/footer/cart/profile) to avoid hard reload re-auth feel, repaired profile branding link (`/franchize/create`), enabled category rail on franchize subpages with jump-back-to-catalog section scroll, and enforced branding editor ACL (`read-only for чужие`, save for crew owner/all-admin).
- next_step: Continue T16 role-aware lifecycle controls or start T17 palette mesh cleanup.
- risks: category jump relies on section ids generated from category labels (`toCategoryId`) remaining stable.
- dependencies: T16D
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CrewFooter.tsx`
  - `app/franchize/components/FranchizeProfileButton.tsx`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `app/franchize/components/CartPageClient.tsx`
  - `app/franchize/components/OrderPageClient.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
  - `app/franchize/create/CreateFranchizeForm.tsx`
  - `app/franchize/actions.ts`
- implementation checklist:
  1. Remove logo downshift and profile wrapper border chrome in franchize header.
  2. Keep subsection pills visible on subpages and route to catalog section anchors.
  3. Restore client-side internal navigation to avoid full-page reloads.
  4. Lock branding save permissions to owner/all-admin while keeping read-only load for others.
- acceptance criteria:
  - Header logo stays aligned with/without ticker.
  - Subpage category pills route to catalog and scroll to target section.
  - Franchize menu/footer/cart/profile internal links navigate without forced hard reload.
  - Branding editor exposes read-only mode for non-owners and blocks unauthorized saves.


### T17 — Theme mesh parity (crew palette vs global theme)
- status: `done`
- updated_at: `2026-02-21T21:47:16Z`
- owner: `codex`
- notes: Added shared `crewPaletteForSurface` resolver + migrated slug-scoped about/cart/contacts/order page wrappers from global theme tokens to crew-bound styles; extended franchize loader to resolve palette by mode from `theme.palette` and new `theme.palettes.{dark|light}` blocks to prevent contrast collisions.
- next_step: Start T18 (`/franchize/create` palette UX v2) and expose dual palette editing presets in form UI.
- risks: Several deeper franchize client components still carry generic utility tokens (`text-muted-foreground`, `bg-card`) and should be fully migrated during T18 polishing.
- dependencies: T16
- deliverables:
  - `app/franchize/components/*`
  - `app/franchize/modals/*`
  - `app/franchize/[slug]/*`
- implementation checklist:
  1. Build a tiny palette resolver (`crewPaletteForSurface`) for consistent text/background pairs.
  2. Migrate legacy theme utility classes in franchize shell to resolver output.
  3. Add contrast smoke checks for light and dark crews on key slugs.
- acceptance criteria:
  - No franchize page shows low-contrast title/body text due to global theme token leakage.

### T18 — `/franchize/create` palette UX v2 (light+dark sets)
- status: `done`
- updated_at: `2026-02-21T22:05:00Z`
- owner: `codex`
- notes: Extended create form with dedicated Light palette controls + live preview/contrast checks, added dual-palette fields to config schema, and persist/hydrate support for `theme.palettes.dark|light` while keeping backward compatibility with legacy flat palette.
- next_step: Start next extension task to migrate remaining franchize client components/modals to surface resolver and reduce leftover global token usage.
- risks: Advanced JSON local apply currently reads light palette from `theme.palettes.light`; malformed custom JSON may still bypass preset ergonomics.
- dependencies: T17
- deliverables:
  - `app/franchize/create/*`
  - `app/franchize/actions.ts`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add schema fields for dual palettes (`light`, `dark`) plus semantic text tokens.
  2. Provide preset swatches + live preview cards in create flow.
  3. Persist palette sets and hydrate correct set by runtime mode.
- acceptance criteria:
  - Operators can configure readable light and dark variants in create flow with preview confidence.


### T19 — Surface token cleanup for franchize modal/menu/cart floating controls
- status: `done`
- updated_at: `2026-02-22T00:20:00Z`
- owner: `codex`
- notes: Replaced remaining global muted/card token leakage in critical franchize overlays (item modal + header menu + floating cart chip) with crew palette-backed styles so light/dark crew themes stay readable without depending on global app theme utilities.
- next_step: Start T20 to migrate remaining catalog/cart/order utility token classes to `crewPaletteForSurface` primitives for complete theme isolation.
- risks: Floating cart background currently uses fixed dark translucent fill tuned for Pepperolli look; future task should derive this from palette mode for fully brand-native light crews.
- dependencies: T18
- deliverables:
  - `app/franchize/modals/Item.tsx`
  - `app/franchize/modals/HeaderMenu.tsx`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Import and apply `crewPaletteForSurface` in item modal containers and muted text blocks.
  2. Migrate menu tagline muted color from global utility token to crew palette resolver.
  3. Remove `bg-card/text-muted-foreground` dependency in floating cart button/chip shell styles.
- acceptance criteria:
  - Item modal/content text remains readable under both dark and light crew palettes without global token fallback.
  - Header menu tagline and floating cart empty state color inherit crew palette semantics.


### T20 — Floating cart palette-mode background polish
- status: `done`
- updated_at: `2026-02-22T04:05:00Z`
- owner: `codex`
- notes: Reworked floating cart shell background to derive from crew palette mode via shared theme helper, removing hardcoded dark RGBA fallback and restoring explicit `textColor` usage.
- next_step: Start T21 to continue migrating remaining catalog/cart/order utility tokens to resolver-driven semantic styles.
- risks: Other components still include legacy utility tokens (`text-muted-foreground` etc.) and can still create contrast drift in edge custom themes until T21 cleanup.
- dependencies: T19
- deliverables:
  - `app/franchize/lib/theme.ts`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `app/franchize/components/FloatingCartIconLinkBySlug.tsx`
  - `app/franchize/components/FranchizeFloatingCart.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/[slug]/about/page.tsx`
  - `app/franchize/[slug]/cart/page.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
  - `app/franchize/[slug]/order/[id]/page.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add helper to resolve floating cart overlay background from `theme.mode` + crew palette.
  2. Thread `theme` into floating cart wrapper props and compute background once near bridge component.
  3. Remove fixed `rgba(11,12,16,0.94)` from floating cart UI component.
- acceptance criteria:
  - Floating cart shell background adapts to crew palette mode (dark/light) and no longer depends on hardcoded dark RGBA.
  - Floating cart text/icon contrast remains readable under both palette modes on `vip-bike` smoke page.


### T21 — Token hotspot cleanup in catalog/cart/map + modal chips
- status: `done`
- updated_at: `2026-02-22T05:00:00Z`
- owner: `codex`
- notes: Continued theme-polish by removing several high-visibility utility-token hotspots from catalog empty/search states, cart blocks, contacts map placeholders, and item modal option headers; moved them to resolver/palette-backed inline styles for predictable crew contrast.
- next_step: Start T22 and finish the same migration sweep inside `OrderPageClient` sections (still the largest token-leak area).
- risks: Contacts map currently uses neutral dark-safe fallback colors without direct crew theme props; should be upgraded to explicit themed props in a follow-up for full palette parity.
- dependencies: T20
- deliverables:
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/components/CartPageClient.tsx`
  - `app/franchize/components/FranchizeContactsMap.tsx`
  - `app/franchize/modals/Item.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Apply `crewPaletteForSurface` to cart copy/cards/summary surfaces and remove key `text-muted-foreground/bg-card/border-border` dependencies.
  2. Replace catalog search/empty state muted utility usage with palette-resolver style tokens.
  3. Replace modal option-chip section label muted utility class with explicit palette text token.
- acceptance criteria:
  - Cart/catalog fallback text remains readable on `vip-bike` in light/dark theme modes without relying on global utility token palette.
  - Item modal option headers follow crew text-secondary color instead of global muted class.


### T22 — Order flow theme token parity + contacts map theme bridge
- status: `done`
- updated_at: `2026-02-22T05:35:00Z`
- owner: `codex`
- notes: Finished the largest remaining theme hotspot by migrating `OrderPageClient` away from global utility token leakage and added explicit `theme` bridge for contacts map fallback/frame styles.
- next_step: Start T23 for optional card-variant/token cleanup inside catalog tiles (remaining `bg-card/from-card/to-background` classes).
- risks: Catalog card variants still include utility background classes by design; should be migrated to semantic style variants in T23 for full token isolation.
- dependencies: T21
- deliverables:
  - `app/franchize/components/OrderPageClient.tsx`
  - `app/franchize/components/FranchizeContactsMap.tsx`
  - `app/franchize/[slug]/contacts/page.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Apply `crewPaletteForSurface` in order flow blocks (section cards, fields, summary, muted hints).
  2. Replace `text-muted-foreground/bg-card/border-border/bg-background` usage in order page controls with palette-based styles.
  3. Thread crew theme into contacts map component for fallback/frame color parity.
- acceptance criteria:
  - `/franchize/vip-bike/order/demo-order` reads correctly in themed mode without global utility token dependence on major order sections.
  - contacts map placeholder/frame colors inherit crew palette when theme is provided.


### T23 — Catalog tile token isolation (remove residual utility card variants)
- status: `done`
- updated_at: `2026-02-22T04:08:20Z`
- owner: `codex`
- notes: Replaced remaining `bg-card/from-card/to-background` tile variant classes with semantic style helpers bound to crew theme palette, and moved `/franchize/[slug]` shell off global `bg-background/text-foreground` tokens.
- next_step: Start T24 for optional interaction polish (focus/hover contrast parity) if additional UI tuning is requested.
- risks: Variant style parity still depends on palette contrast quality in crew metadata; very low-contrast custom palettes may need per-crew tuning.
- dependencies: T22
- deliverables:
  - `app/franchize/lib/theme.ts`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/[slug]/page.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add catalog card variant style resolver in theme lib using palette-driven border/background/shadow values.
  2. Replace catalog tile utility variant class array with resolver-backed inline styles.
  3. Remove global theme utility shell classes from `/franchize/[slug]` root and use `crewPaletteForSurface(theme).page`.
- acceptance criteria:
  - No remaining `bg-card/from-card/to-background` utility variant usage in franchize catalog cards.
  - `/franchize/vip-bike` page shell uses crew theme page tokens instead of global background/text utility classes.

### T24 — Catalog interaction-state polish (focus/hover contrast parity)
- status: `done`
- updated_at: `2026-02-22T06:25:00Z`
- owner: `codex`
- notes: Added crew-theme-based interaction ring helper and applied it to catalog search field, search CTA, and card trigger buttons so keyboard/tap focus state stays visible in both light and dark palettes.
- next_step: Start T25 for cross-surface interaction-state parity in modal/cart/order controls if operator asks for deeper accessibility polish.
- risks: Ring visibility still depends on crew accent contrast; extremely low-contrast custom accent colors may require guardrails in create form validation.
- dependencies: T23
- deliverables:
  - `app/franchize/lib/theme.ts`
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add reusable palette-driven interaction ring style helper in franchize theme utilities.
  2. Apply focus ring styles to catalog search input and `Искать` CTA.
  3. Apply focus ring to catalog tile trigger button so keyboard navigation remains visually clear.
- acceptance criteria:
  - `/franchize/vip-bike` catalog controls show visible focus state in light/dark palettes using crew accent instead of global theme defaults.
  - Interaction polish is additive and does not alter existing add-to-cart/modal behavior.


### T25 — Cross-surface interaction-state parity (modal/cart/order controls)
- status: `done`
- updated_at: `2026-02-22T07:10:00Z`
- owner: `codex`
- notes: Completed one-go interaction-state styling sweep across Item modal, cart controls, and order form/actions using a shared palette-aware focus outline helper and subtle hover/press transitions.
- next_step: Start T26 with richer “interesting stuff” pass (micro-delight: contextual badges/animated CTA hints on franchize checkout surfaces) if operator wants further vibe uplift.
- risks: Outline contrast still depends on crew accent quality; super-low-contrast custom accents may need future guardrails in `/franchize/create` validation.
- dependencies: T24
- deliverables:
  - `app/franchize/lib/theme.ts`
  - `app/franchize/modals/Item.tsx`
  - `app/franchize/components/CartPageClient.tsx`
  - `app/franchize/components/OrderPageClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add reusable palette-driven focus outline helper for keyboard-visible controls.
  2. Apply consistent focus/hover/active interaction states to modal actions + option chips.
  3. Apply same interaction treatment to cart quantity/remove/checkout actions and order form/actions.
- acceptance criteria:
  - `/franchize/vip-bike/cart`, `/franchize/vip-bike/order/demo-order`, and item modal controls show visible focus states without falling back to global theme defaults.
  - Interaction-state changes are visual-only and do not alter booking/cart logic.

### T26 — Checkout micro-delight pass (readiness meter + vibe badge)
- status: `done`
- updated_at: `2026-02-22T04:39:40Z`
- owner: `codex`
- notes: Added compact checkout readiness meter (cart/contact/consent) with accent badge (`N/3` -> `Готово ✨`) in order sidebar; visual-only micro-delight with no submit/cart logic changes.
- next_step: Start T27 for optional animated empty-state CTA pulse + post-payment celebration cues if operator wants one more vibe layer.
- risks: Sidebar now contains one extra compact module; if future widgets are added, spacing should be rebalanced on narrow devices.
- dependencies: T25
- deliverables:
  - `app/franchize/components/OrderPageClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add compact milestone meter (`cart/contact/consent`) to sidebar summary.
  2. Add small status badge (`N/3` -> `Готово ✨`) with crew-accent-based contrast.
  3. Keep behavior visual-only with no submit/cart logic changes.
- acceptance criteria:
  - `/franchize/vip-bike/order/demo-order` shows progress meter reflecting completion state before submit.
  - Badge/readiness chips stay readable in dark/light crew palettes.

### T27 — Checkout copilot expansion (blockers + guided next action)
- status: `done`
- updated_at: `2026-02-22T04:47:09Z`
- owner: `codex`
- notes: Expanded order sidebar into a larger copilot module: readiness progress bar, active blockers list, and guided “next action” jump to the first fixable missing field.
- next_step: Start T28 for post-submit celebratory layer + success-state continuity if operator wants an even larger narrative pass.
- risks: Sidebar density increased; future additions should keep typography compact and avoid pushing totals below fold on short viewports.
- dependencies: T26
- deliverables:
  - `app/franchize/components/OrderPageClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add readiness percentage bar tied to milestone completion.
  2. Add blocker inventory sourced from real form/cart/telegram state.
  3. Add guided next-action button that focuses first unresolved field.
- acceptance criteria:
  - `/franchize/vip-bike/order/demo-order` sidebar shows both progress and blocker state with clear next-step guidance.
  - Guided action focuses the relevant unresolved field without changing checkout logic.

### T28 — Franchize launch cockpit (distilled strategy -> execution panel)
- status: `done`
- updated_at: `2026-02-22T04:55:32Z`
- owner: `codex`
- notes: Built a new high-impact launch cockpit inside `/franchize/create`: readiness scoring, launch-check matrix, blockers, and canonical execution-surface jump links derived from franchize docs/runbook priorities.
- next_step: Start T29 for cross-route QA automation from the same cockpit (one-click smoke + screenshot checklist) if operator wants next-level ops tooling.
- risks: Cockpit metrics are heuristic and form-driven; future iteration can connect live route health probes and persisted QA snapshots.
- dependencies: T27
- deliverables:
  - `app/franchize/create/CreateFranchizeForm.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add dedicated `Launch cockpit` stage to create form navigation.
  2. Compute readiness score from core franchize launch constraints (identity/contacts/map/routes/catalog/contrast).
  3. Render blocker-aware check cards and canonical route jump links for operator execution flow.
- acceptance criteria:
  - `/franchize/create` exposes a separate cockpit surface with launch score + blockers, not tied to order-page micro-polish.
  - Cockpit provides immediate navigation to slug-scoped execution routes.

### T29 — Pepperolli parity audit pass (VIP-bike subtle conversion gaps)
- status: `done`
- updated_at: `2026-02-22T06:30:00Z`
- owner: `codex`
- notes: Compared production `/franchize/vip-bike` against `пепперолли.рф` and shipped missing subtle conversion layer: compact promo modules below search to mirror campaign-first scanning used on Pepperolli catalog.
- next_step: Start T30 for checkout urgency badges + sticky "clear search" and per-section item counters.
- risks: Promo modules currently hydrate from ticker entries and depend on metadata quality; richer media tiles can be added later via dedicated promo JSON block.
- dependencies: T28
- deliverables:
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Run visual comparison between current VIP-bike storefront and Pepperolli production page.
  2. Identify subtle conversion differences beyond known auction ticker and popup ad (campaign cards density, scan rhythm, CTA framing).
  3. Implement first high-impact parity improvement with minimal invasive diff.
- acceptance criteria:
  - `/franchize/vip-bike` shows campaign promo modules under search, improving first-screen scan rhythm.
  - Existing catalog, category rail, modal flow, and cart CTA behavior remain unchanged.


### T30 — Conversion micro-helpers pass (search reset + section density cues)
- status: `done`
- updated_at: `2026-02-22T07:20:00Z`
- owner: `codex`
- notes: Addressed follow-up parity comments by adding sticky search reset affordance and per-section item counters to improve catalog scannability/conversion confidence.
- next_step: Start T31 for optional checkout urgency copy pass if operator wants deeper parity with food-commerce pacing.
- risks: Section counters reflect filtered results and can fluctuate during search; this is intentional but should be monitored for user clarity.
- dependencies: T29
- deliverables:
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add explicit search reset action near `Искать` CTA for rapid catalog recovery.
  2. Add per-category item count chips in section headers.
  3. Keep modal/cart/order interactions unchanged.
- acceptance criteria:
  - `/franchize/vip-bike` search field supports one-tap `Сброс` while preserving existing search CTA behavior.
  - Category headers display visible result counts (`N шт.`) matching current filtered state.



### T31 — Catalog quick-filter energy pass (non-order anti-boring step)
- status: `done`
- updated_at: `2026-02-22T08:00:00Z`
- owner: `codex`
- notes: Implemented high-signal quick filter chips on catalog (`Все`, `До 5000`, `Премиум 7000+`, `Для новичка`) to boost exploration speed without touching order modal/checkout UI.
- next_step: Start T32 if needed for richer promo tiles (image-backed cards + scheduled campaign windows).
- risks: "Для новичка" currently uses lightweight heuristics based on title/category text and may need metadata-backed tags later.
- dependencies: T30
- deliverables:
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add non-invasive quick-filter chip rail under promo modules.
  2. Keep search + quick filter composable so users can combine both.
  3. Keep modal/cart/order flows untouched.
- acceptance criteria:
  - `/franchize/vip-bike` exposes quick filter chips with clear active state.
  - Filtered item list updates immediately while preserving existing section rendering and item modal actions.



### T32 — Smart quick-filter stabilization (counts + unified reset)
- status: `done`
- updated_at: `2026-02-22T08:40:00Z`
- owner: `codex`
- notes: Refined quick-filter layer with centralized config, live per-filter counts, and one-tap `Сбросить всё` to reduce friction and make filter state transparent.
- next_step: Start T33 for image-backed promo cards with scheduling metadata if operator wants the next non-modal excitement beat.
- risks: "Для новичка" still uses heuristic text matching and should be replaced by explicit metadata tags when available.
- dependencies: T31
- deliverables:
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Centralize quick-filter definitions and remove ad-hoc casting.
  2. Add dynamic counts per filter based on active search subset.
  3. Add global reset action to clear search + filter state in one tap.
- acceptance criteria:
  - `/franchize/vip-bike` shows `label · count` for each quick filter.
  - `Сбросить всё` appears when any filter/search is active and restores baseline catalog state.



### T33 — Crew metadata promo/ad control + payment options pass (branding editor)
- status: `done`
- updated_at: `2026-02-22T09:45:00Z`
- owner: `codex`
- notes: Added promo/ad card editing fields in `/franchize/create`, wired load/save to `crews.metadata.franchize.catalog`, switched catalog promo render to metadata-backed promos/ads, and expanded editable payment options list beyond Telegram XTR.
- next_step: Start T34 for storefront visual parity gap audit + final cloning checklist.
- risks: Textarea CSV/pipe format is operator-friendly but still manual; future iteration can move to row-based UI editor.
- dependencies: T32
- deliverables:
  - `app/franchize/actions.ts`
  - `app/franchize/create/CreateFranchizeForm.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `docs/sql/vip-bike-franchize-hydration.sql`
  - `docs/sql/sly13-franchize-test-hydration.sql`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add config fields to load/save `catalog.promoBanners` and `catalog.adCards` from metadata.
  2. Expose editable controls for promos/ads in branding editor.
  3. Read order payment options from metadata and make them editable (`telegram_xtr`, `card`, `sbp`, `cash`, etc.).
  4. Update SQL hydration docs so both VIP_BIKE and SLY13 seeds contain promo/ad samples and expanded payment options.
- acceptance criteria:
  - Branding page can edit and save promo/ad metadata without raw JSON-only fallback.
  - Catalog promo strip reads metadata `promoBanners/adCards` before ticker fallback.
  - SQL docs in `docs/sql/*` reflect the new metadata contract and payment options list.


### T34 — Campaign intelligence rail (schedule + priority + resilient CTA fallback)
- status: `done`
- updated_at: `2026-02-22T11:10:00Z`
- owner: `codex`
- notes: Upgraded promo/ad layer from static tiles to campaign engine with scheduling windows, priority sorting, CTA labels, long-title clipping, resilient href fallback for empty links, and lightweight auto-rotation window.
- next_step: Start T35 for analytics hooks (campaign impression/click telemetry + operator dashboard counters).
- risks: Date parsing expects ISO-like values in metadata; invalid dates gracefully treated as always active.
- dependencies: T33
- deliverables:
  - `app/franchize/actions.ts`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/create/CreateFranchizeForm.tsx`
  - `docs/sql/vip-bike-franchize-hydration.sql`
  - `docs/sql/sly13-franchize-test-hydration.sql`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Extend promo/ad metadata contract with `activeFrom`, `activeTo`, `priority`, `ctaLabel`.
  2. Add parser-level sanitization for empty href and overlong title.
  3. Render only active campaigns and sort by priority before fallback to ticker.
  4. Add rotating visible window in catalog promo rail for richer campaign density.
- acceptance criteria:
  - Empty `href` campaign no longer breaks navigation and safely opens catalog anchor.
  - Very long titles are clipped consistently without layout blowups.
  - Active-window + priority impact visible campaign order in `/franchize/vip-bike`.



### T35 — Regression hotfix: SPA links + campaign rail restyle + cart add reliability
- status: `done`
- updated_at: `2026-02-22T13:00:00Z`
- owner: `codex`
- notes: Restored internal franchize navigation to true SPA transitions (without full page reload), restyled campaign promo cards away from full-black blocks, unified visible groups rail behavior across subpages, and added direct catalog add-to-cart CTA to remove tap ambiguity. Correction pass moved groups rail strictly into header container and fed shared item-based group links on every franchize subpage.
- next_step: Re-run `/franchize/vip-bike` smoke checks and confirm header group balloons are visible on all `/franchize/[slug]/*` routes.
- risks: Mixed webview runtimes may still handle touch and click differently; keep both modal and inline add paths covered in smoke checks.
- dependencies: T34
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/components/CartPageClient.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Replace internal ticker/promo anchors with SPA-safe `next/link` while preserving external target behavior.
  2. Replace dark promo strip visuals with colorful campaign cards for storefront parity.
  3. Keep group rail consistent across catalog and subpages by sharing fallback group source.
  4. Add explicit `+ В корзину` inline CTA in catalog cards and keep modal add flow intact.
- acceptance criteria:
  - Internal franchize links navigate client-side without forced full reload.
  - Campaign cards no longer render as full-black promo blocks on catalog.
  - Group rail uses one consistent list model across `/franchize/[slug]` and subpages.
  - Clicking catalog `+ В корзину` immediately increments floating cart counter.

---


### T36 — Mobile filter rail scrollbar removal
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Hidden horizontal scrollbar visuals for quick-filter rail and promo rail on mobile while preserving horizontal swipe behavior.
- next_step: Start T37 mobile auction ticker compaction.
- risks: None.
- dependencies: T35

### T37 — Mobile auction/promo rail single-line ticker behavior
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Converted promo/auction cards to a one-line horizontal ticker behavior on mobile and kept multi-column layout on larger breakpoints.
- next_step: Start T38 link click reliability sweep.
- risks: Very long campaign titles can still be truncated by card width by design.
- dependencies: T36

### T38 — Header/mobile navigation click reliability hardening
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Replaced fragile client-side route handlers in franchize header menu/profile/footer/subpage recovery links with deterministic anchor/window navigation for Telegram webview tap reliability.
- next_step: Start T39 cart flow parity fixes.
- risks: Full-page navigations are intentional for reliability and can feel less SPA-like.
- dependencies: T37

### T39 — Franchize cart flow parity (remove inline bypass + fix modal add)
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Removed inline `+ В корзину` bypass CTA from catalog cards and fixed modal `Добавить` interaction path to ensure add-to-cart always goes through options-aware modal flow.
- next_step: Start T40 cart persistence in users metadata.
- risks: None.
- dependencies: T38

### T40 — Cart persistence to `users.metadata.settings.franchizeCart`
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Added server action + client sync to persist per-slug franchize cart state in Supabase `users.metadata.settings.franchizeCart` and hydrate local cart from metadata when local storage is empty.
- next_step: Start T41 footer text color seed alignment.
- risks: High-frequency cart edits can trigger many writes; debounced sync is applied.
- dependencies: T39

### T41 — Footer text color black in VIP_BIKE + SLY13 seed docs
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Added `footer.textColor = #16130A` in both seed SQL docs and consumed this value in franchize footer renderer.
- next_step: Start T42 header ticker deprecation + compact-on-scroll behavior.
- risks: Existing crews without `footer.textColor` fallback to `#16130A`.
- dependencies: T40

### T42 — Header cleanup: remove obsolete top auction ticker + compact scroll mode
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Removed obsolete header auction running line and added partial hide-on-scroll behavior where only category bubble rail remains visible with safe-area top offset.
- next_step: Start T43 route shell visibility overrides.
- risks: Compact threshold tuned for mobile; may need micro-adjustment per device.
- dependencies: T41

### T43 — Route shell override: disable BikeHeader/BikeFooter on `/vipbikerental`
- status: `done`
- updated_at: `2026-02-22T15:00:00Z`
- owner: `codex`
- notes: Updated ClientLayout theme path matching to stop injecting bike shell on `/vipbikerental`.
- next_step: Start T44 click-testing skill + smoke pass evidence.
- risks: `/vipbikerental` now uses default shell behavior by design.
- dependencies: T42

### T44 — Click testing skill pass for franchize mobile interactions
- status: `done`
- updated_at: `2026-02-22T15:25:00Z`
- owner: `codex`
- notes: Added reusable click smoke skill (`skills/franchize-click-smoke/SKILL.md`) and executed mobile Playwright smoke/screenshot against `/franchize/vip-bike`.
- next_step: Queue next operator-reported UX fix as T45+ with strict dependency chain.
- risks: Chromium may crash in container runtime; Firefox fallback works.
- dependencies: T43

### T45 — Cart persistence hardening + broken navigation/social links cleanup
- status: `done`
- updated_at: `2026-02-23T00:00:00Z`
- owner: `codex`
- notes: Hardened franchize cart metadata persistence action, switched modal add CTA to click-based handler for reliable cart updates, added `/franchize/[slug]/rentals` compatibility redirect to prevent header-menu 404 for “My rents”, and normalized footer social URLs to include protocol when operators enter short domains.
- next_step: Queue T46 for full Playwright cross-path smoke (catalog -> modal -> cart -> rentals redirect -> contacts links).
- risks: Legacy custom menu links can still point to fully invalid domains; protocol normalization only covers common short-domain patterns.
- dependencies: T44



### T46 — Auction tick options in cart + franchize-native rentals page
- status: `done`
- updated_at: `2026-02-23T00:40:00Z`
- owner: `codex`
- notes: Added auction tick selection into item modal/cart metadata flow and surfaced selected tick on cart/order summaries; replaced temporary rentals redirect with real `/franchize/[slug]/rentals` shell page reusing rentals runtime inside franchize branding. Also fixed footer local link reliability by switching internal footer menu links to Next.js `Link` while keeping social links external-only behavior unchanged.
- next_step: T47 can add intelligent auction recommendation scoring (price window + stock pressure + campaign schedule) instead of manual pick only.
- risks: Rentals bridge currently embeds existing `/rentals` client surface; future pass may split dedicated franchize-tailored rentals list for lighter payload.
- dependencies: T45

### T47 — Friend review intake + Pepperolli parity action-plan expansion
- status: `done`
- updated_at: `2026-02-23T09:15:00Z`
- owner: `codex`
- notes: Logged friend visual-diff praise + extracted high-signal parity deltas into an execution-ready backlog (pills, section headers, card CTA/iconography, floating cart badge overlap, softer borders). Added concrete file-level instructions and acceptance checks to reduce ambiguity before coding.
- next_step: Execute T48 implementation pass in UI code, then run screenshot smoke on `/franchize/vip-bike`.
- risks: Minor pixel drift can still occur due to Telegram WebView safe-area quirks and runtime crew palette differences.
- dependencies: T46
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Convert friend review into structured task scope with explicit impacted files/components.
  2. Preserve architecture constraints (single sticky rail source, crew theme token usage, no route regressions).
  3. Define measurable acceptance criteria tied to visible UX outcomes.
  4. Queue a follow-up implementation task with dependency lock to keep strict one-by-one flow.
- acceptance criteria:
  - Plan includes actionable, file-scoped implementation steps (not generic prose).
  - New implementation task is dependency-linked and ready for execution without additional clarification.

### T48 — Pepperolli parity implementation pass (pills/headers/cards/floating cart/borders)
- status: `done`
- updated_at: `2026-02-23T10:35:00Z`
- owner: `codex`
- notes: Implemented parity polish across franchize catalog surfaces: solid-filled category/quick-filter pills, stronger section title hierarchy, accent price emphasis, cart-icon CTA for Добавить, softened card borders/shadows, and floating cart pill with overlapping white quantity badge.
- next_step: Start T49 engineering hardening sweep (security boundary first, then SPA/state/style tasks in order).
- risks: Slight text-density increase from larger section headers; validate on smallest Android viewport during T49 smoke pass.
- dependencies: T47
- deliverables:
  - `app/franchize/components/CrewHeader.tsx`
  - `app/franchize/components/CatalogClient.tsx`
  - `app/franchize/components/FloatingCartIconLink.tsx`
  - `app/franchize/lib/theme.ts`
- implementation checklist:
  1. **Category pills (header + quick filters):** switch from outline-dominant style to solid fills (`active=accent`, `inactive=bgCard`) with no border stroke and improved tap-target contrast.
  2. **Section headers:** promote category titles to large bold white hierarchy (`text-2xl`, tighter tracking), keep count chips muted-solid for quick scan.
  3. **Card pricing + CTA semantics:** make price accent-colored/bold; add `ShoppingCart` icon to `Добавить` CTA; keep `Выбрать` path for premium/high-ticket entries per existing threshold logic.
  4. **Floating cart widget:** convert main pill to solid accent surface, force black foreground text, and move quantity into absolute overlapping white badge on top-right corner.
  5. **Card border softness:** reduce border alpha in `catalogCardVariantStyles` so separation relies on dark-surface contrast + subtle shadow rather than visible strokes.
  6. **Regression guardrail:** verify no breakage in sticky rail activation, modal open/add flow, and cart totals after style updates.
- acceptance criteria:
  - Active/inactive pills visually match Pepperolli bubble behavior (solid fill states, no outlined inactive mode).
  - Section headers read as primary content anchors (large white uppercase) with muted count pills.
  - Product cards show accent price and cart-icon CTA without harming text truncation/layout.
  - Floating cart shows solid yellow pill + overlapping white counter bubble across catalog scroll states.
  - Card borders appear visually softer than pre-pass baseline while preserving card separation.
  - Fresh screenshot artifact documents parity pass on `vip-bike` slug.

### T49 — Software-engineering hardening sweep (security/SPA/state/CSS/cart-write load)
- status: `in_progress`
- updated_at: `2026-03-06T00:40:00Z`
- owner: `codex`
- notes: T49 remains active parent. Completed T49.5 split in `contexts/AppContext.tsx` (auth/runtime/cart/strikeball boundaries + strikeball-specific hook extraction) and switched active-lobby refresh to realtime event subscriptions instead of timer-only pseudo-realtime. Completed T49.6 by adding first-paint theme bootstrap script in `app/layout.tsx` and precise recoverable Advanced JSON validation in `/app/franchize/create/*`. Follow-up T49.8 fixed franchize admin route normalization (`/franchize/admin`) and adaptive crew-themed styling/linking regressions from review.
- next_step: Start **T50 — checkout/admin resilience pass** (local template fallback, order retry snapshot, server-side crew ACL scope, and franchize-form tokenization for light-theme parity).
- risks: Realtime lobby subscription currently listens on full `lobbies` table change feed; verify acceptable event volume for high-match concurrency and tighten filters if needed.
- dependencies: T48

- subtask tracking:
  - **T49.11 — Item modal gallery rail correction + VIP Bike Rental launch tile**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-23T20:05:00Z`
    - notes: Narrowed the scope back to the actual storefront ask: item modal gallery now presents the hero image first with a wrapping thumbnail rail below it (no horizontal swipe trap for Telegram webview), modal scroll ownership is simplified to avoid nested-scroll hiccups, modal option copy is Russian-first, and the shared capability launch grid links to `/vipbikerental` instead of Greenbox when the optional fourth tile is enabled.
    - risks: `/greenbox` now also shows the VIP Bike Rental launch tile because the shared component stays unified across surfaces.
    - next_step: Keep future shared-launch tweaks scoped to operator-requested destinations only; avoid unrelated Greenbox additions during franchize polish passes.
  - **T49.10 — Remove mistaken flat admin redirects + mobile overflow polish**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T04:05:00Z`
    - notes: Removed mistakenly created flat admin redirect pages (`/franchize/admin`, `/admin/franchize`) and kept only canonical slug route `/franchize/[slug]/admin` plus legacy `/admin`. Polished mobile overflow issues in admin UX by making top controls/buttons/select blocks wrap and stack safely in `CarSubmissionForm`; fixed dark-on-dark legacy `/admin` title contrast.
    - risks: `CarSubmissionForm` remains shared across multiple domains; further franchize-only theme tokenization could still improve light-theme parity.
    - next_step: Add optional `appearance` mode to `CarSubmissionForm` so franchize admin can fully consume crew palette tokens without affecting other product surfaces.
  - **T49.9 — Crew-scoped admin route migration to `/franchize/[slug]/admin` + light-theme contrast polish**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T03:10:00Z`
    - notes: Migrated franchize admin routing from flat `/franchize/admin` to crew-scoped `/franchize/[slug]/admin` with legacy redirects preserving `slug/edit` query forwarding. Updated profile/admin links to slug route and polished page contrast by forcing crew metadata theme tokens for headers/filters/info blocks instead of project-default button/text colors.
    - risks: `CarSubmissionForm` still contains global style classes and can look partially off-theme on light crews; dedicated form-level tokenization should be planned.
    - next_step: Add themed wrapper/token map for `CarSubmissionForm` (or franchize-only variant) to fully eliminate default project palette bleed in light mode.
  - **T49.8 — Franchize admin route normalization + adaptive themed polish**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T02:25:00Z`
    - notes: Moved crew admin surface from `/admin/franchize` to canonical `/franchize/admin` with compatibility redirect, updated franchize profile dropdown + admin links, and rebuilt page styling to hydrate from crew branding/theme palette (slug-aware) with mobile-safe text wrapping.
    - risks: Fleet scope currently still uses editable vehicles action and filters client-side by crew; strict server-side ACL hardening remains in T50.
    - next_step: In T50 add server-side scoped query endpoint for crew-owner subsets and remove client-side filtering fallback.
  - **T49.7 — Franchize checkout doc-notification + crew-admin VIN UX pass**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T01:35:00Z`
    - notes: Wired checkout notification action to generate DOCX from RENTAL_DEAL template with live order/cart/specs (including VIN) and send it as Telegram document to admin on order submit (manual + XTR flows). Added mobile-first `/admin` improvements (bike/car filters + VIN guidance) plus dedicated `/admin/franchize` crew-owner console for VIN-centric editing.
    - risks: Current DOC render pulls template from GitHub raw URL; if network is unavailable, notification send fails.
    - next_step: Add local template fallback and optional persisted `orders` table snapshot for audit/retry in next iteration.
  - **T49.5 — App context decomposition and realtime strategy audit**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T00:32:00Z`
    - notes: Responsibility map finalized and split into isolated providers (auth/runtime/cart/strikeball). `useStrikeballLobbyContext` extracted for strikeball-only consumers, reducing unrelated rerender pressure from lobby state. Active lobby updates now refresh via Supabase realtime events instead of timer-only polling.
    - risks: Current realtime listener for `lobbies` is broad (`event:*`); may need tighter filter if noisy in production.
    - next_step: Run focused strikeball smoke checks on join/leave/active-state transitions under mobile latency.
  - **T49.6 — Theme flash prevention + AI JSON robustness**
    - status: `done`
    - owner: `codex`
    - updated_at: `2026-03-06T00:38:00Z`
    - notes: Added `beforeInteractive` theme bootstrap script to align html class before hydration and avoid first-paint mismatch. Hardened `/app/franchize/create/CreateFranchizeForm.tsx` Advanced JSON parsing with explicit validation states (empty payload, parse error details, root object shape, franchize object shape) while preserving recoverable UI feedback.
    - risks: LocalStorage theme value can be stale vs DB preference; DB sync still reconciles post-auth.
    - next_step: Start **T50 — T49 closure regression pack** and capture final smoke evidence.
- deliverables:
  - `docs/T49-security_sweep.md`
  - `docs/THE_FRANCHEEZEPLAN.md`
  - `docs/AGENT_DIARY.md`
  - `hooks/useTelegram.ts`
  - `hooks/supabase.ts`
  - `hooks/useFranchizeCart.ts`
  - `app/franchize/components/*` (navigation + themed controls)
  - `contexts/AppContext.tsx` (or split providers)
- implementation checklist:
  1. **T49.0 — continue as FRANCHEEZEPLAN_EXECUTIONER: Unbloat planning ledger by moving legacy diary archive** (`done`): move oversized section-7 history into `docs/AGENT_DIARY.md`, keep only compact pointer section in THE plan.
  2. **T49.1 — continue as FRANCHEEZEPLAN_EXECUTIONER: Security boundary hardening (server-only admin paths)**: verify privileged Supabase logic remains server-only and no client import chain can touch service-role key access.
  3. **T49.2 — continue as FRANCHEEZEPLAN_EXECUTIONER: SPA navigation oath recovery in franchize shell**: keep internal links SPA-first and solve tap reliability through layering/event fixes (not hard reload fallbacks).
  4. **T49.3 — continue as FRANCHEEZEPLAN_EXECUTIONER: Cart write-pressure control and checkpoint persistence**: preserve local-first UX and flush on explicit checkpoints/page lifecycle with retry-safe queue semantics.
  5. **T49.4 — continue as FRANCHEEZEPLAN_EXECUTIONER: Style-system variable migration and interaction-state safety**: migrate remaining inline color hotspots toward CSS-variable Tailwind utilities and keep focus/hover/active visibility intact.
  6. **T49.5 — continue as FRANCHEEZEPLAN_EXECUTIONER: App context decomposition and realtime strategy audit**: split oversized app context by concern and reduce timer-only pseudo-realtime behavior.
  7. **T49.6 — continue as FRANCHEEZEPLAN_EXECUTIONER: Theme flash prevention + AI JSON robustness**: ensure first paint uses early theme signal and malformed JSON remains recoverable with precise inline errors.
  8. **Sync point:** reflect subtask outcomes in `docs/THE_FRANCHEEZEPLAN_STATUS.MD` after each completed substep.
  9. **T49.7 — Franchize checkout doc-notification + crew-admin VIN UX pass**: reuse markdown-doc template generation during order submit, send DOC to admin with order details, and improve `/admin` + dedicated `/admin/franchize` mobile-first editor with bike/car VIN focus.
- acceptance criteria:
  - T49 subtasks are explicit, dependency-ordered, and actionable without additional interpretation.
  - Section 7 of THE plan remains slim, with historical narrative archived in `docs/AGENT_DIARY.md`.
  - Security/SPA/cart/style/context/theme/AI-json checks are represented as concrete subtask goals in both T49 docs.


### T50 — Checkout contract payload resilience + franchize crew ACL expansion
- status: `in_progress`
- updated_at: `2026-03-13T09:00:00Z`
- owner: `codex`
- notes: Implemented server-side template fallback chain (GitHub raw -> local docs file), added durable `franchize_order_notifications` snapshot log with send-status transitions (`pending/sent/failed`), and exposed retry action restoring payload from latest snapshot.
- next_step: Finish crew-owner ACL expansion in franchize admin/editor scope and wire operator retry trigger in admin UI.
- risks: Retry action currently re-inserts snapshot on each attempt (expected audit trail growth); ACL scope depends on shared admin page shape.
- dependencies: T49
- deliverables:
  - `app/franchize/actions.ts`
  - `app/admin/franchize/page.tsx`
  - `supabase/migrations/*` (if snapshot table is added)
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Add local fallback for doc template read (`docs/RENTAL_DEAL_TEMPLATE_DEMO.md`) when GitHub raw is unavailable.
  2. Store normalized order snapshot in DB before send attempts and mark send status (`pending/sent/failed`).
  3. Add retry endpoint/action for failed admin-doc sends.
  4. Expand crew-owner ACL in admin/franchize UI (filter by crew owner id when metadata role is limited admin).
- acceptance criteria:
  - Admin receives DOC for successful submits and failed sends are retryable without data loss.
  - Crew-owner editor cannot edit out-of-scope crew inventory rows.

### T51 — Franchize integration runway split for parallel SupaPlan execution
- status: `todo`
- updated_at: `2026-03-20T00:00:00Z`
- owner: `codex`
- notes: Разбил следующий этап интеграции на независимые дорожки, чтобы можно было запускать несколько агентов без конфликтов по файлам и маршрутам.
- next_step: Закрыть T50 ACL, затем запускать FRZ-R1 как блокирующий контрактный шаг и после него параллелить FRZ-R2/FRZ-R3.
- risks: Если начать FRZ-R2 до фикса FRZ-R1, возможен дрейф формата заказа и callback-полей между Telegram и storefront.
- dependencies: T50
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`
  - `app/franchize/actions.ts`
  - `app/franchize/components/OrderPageClient.tsx`
  - `app/nexus/page.tsx`
- implementation checklist:
  1. FRZ-R1 `d6088cf8-46e1-4637-98bc-9f9a334ce3ed` (`franchize.integration`) — зафиксировать контракт метаданных и fallback-матрицу (блокирующий шаг).
  2. FRZ-R2 `e837b793-3de3-49f9-b777-3294a58f36af` (`franchize.telegram`) — Telegram checkout callback parity (параллельно после FRZ-R1).
  3. FRZ-R3 `bce46dac-bc09-4215-aac9-c66810b51f81` (`franchize.analytics`) — операторские виджеты состояния интеграции в `/nexus` (параллельно после FRZ-R1).
  4. FRZ-R4 `941503e4-9092-4d1f-bc93-3bf3147dbd69` (`franchize.onboarding`) — onboarding checklist page для новых партнёров (параллельно после FRZ-R1).
  5. FRZ-R5 `913e8a73-46f6-4c22-8278-c1b5aabe661e` (`franchize.kpi`) — pilot KPI scoreboard по воронке франшизы (параллельно после FRZ-R1).
- acceptance criteria:
  - После FRZ-R1 формат данных заказа детерминированно совпадает между `/franchize` и callback-потоком.
  - FRZ-R2 и FRZ-R3 можно выполнять параллельно без изменения одних и тех же модулей.

### T52 — Seqvenz Zero catalog sync for VIP Bike
- status: `done`
- updated_at: `2026-03-22T00:00:00Z`
- owner: `codex`
- notes: Добавил новый электробайк Seqvenz Zero в витрину VIP Bike, загрузил фото в Supabase Storage и синхронизировал запись в `cars` + миграцию для повторяемого bootstrap.
- next_step: При следующем проходе добавить расширенное описание, точные характеристики батареи/разгона и финальный прайс.
- risks: Цена пока временная, потому что оператор дал только базовое позиционирование; подробные коммерческие поля нужно уточнить отдельно.
- dependencies: none
- deliverables:
  - `supabase/migrations/20260322120000_add_seqvenz_zero.sql`
  - `lib/fleet-manifest.ts`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Загрузить операторские фото Seqvenz Zero в публичный bucket.
  2. Создать/обновить карточку `cars` с VIP Bike `crew_id` и базовыми спеками.
  3. Зафиксировать изменение миграцией и локальным manifest-списком.
- acceptance criteria:
  - Seqvenz Zero доступен в базе и может гидратиться на storefront как bike-карточка.
  - Галерея содержит все загруженные фото из текущего запроса.


### T53 — VIP BIKE MapRiders live-map surface
- status: `done`
- updated_at: `2026-03-22T11:30:00Z`
- owner: `codex`
- notes: По явному запросу оператора добавлена отдельная страница `/franchize/[slug]/map-riders` для VIP BIKE: live-карта райдеров, включение/остановка геошеринга, meetup-пины, маршрутный replay, статистика по заездам и недельный лидерборд. Добавлены API-ручки и миграция таблиц `map_rider_*`, а также кнопки входа с главного VIPBIKE-экрана, футера и franchize-меню.
- next_step: Прогнать миграцию в рабочей Supabase, затем подключить crew-membership ACL и Telegram bot callback для нативного live-location bridge.
- risks: Текущая версия использует browser geolocation внутри WebApp/браузера; для полного parity с Telegram Live Location нужен отдельный бот-мост на стороне Telegram update handlers.
- dependencies: none
- deliverables:
  - `app/franchize/[slug]/map-riders/page.tsx`
  - `app/franchize/components/MapRidersClient.tsx`
  - `app/api/map-riders/*`
  - `lib/map-riders.ts`
  - `supabase/migrations/20260322110000_map_riders.sql`
  - `app/vipbikerental/page.tsx`
  - `components/BikeFooter.tsx`
- implementation checklist:
  1. Добавить отдельный rider-map маршрут в franchize shell с кнопкой входа из VIPBIKE home.
  2. Собрать live-карту поверх `VibeMap`: активные райдеры, meetup-пины и выбранный route replay.
  3. Реализовать start/stop session + точечные location updates + weekly leaderboard snapshot через новые API-ручки.
  4. Вести статистику заезда: дистанция, средняя скорость, максимум, длительность и просмотр сохранённого маршрута.
  5. Добавить несколько уместных бонусов: Convoy Pulse, Telegram-share мост, meetup-комментарии.
- acceptance criteria:
  - У VIP BIKE есть отдельная страница MapRiders, доступная кнопкой с главного экрана.
  - Авторизованный райдер может включить геошеринг, писать трек и завершать заезд с сохранением статистики.
  - Все пользователи видят активных райдеров, meetup-точки, историю заездов и недельный лидерборд.

### T54 — SupaPlan franchize human-board + idea-to-task mapping
- status: `done`
- updated_at: `2026-03-24T17:45:00Z`
- owner: `codex`
- notes: Усилен `/supaplan/franchize`: добавлены фазовые секции по плану (апрель→2027), явный `taskType` (R1-R4), расширенные `SupaPlan task details` (task_id, todo_path, updated_at, PR URL, body), а также отдельный блок `Epic decomposition cues` для спауна детальных subtask во время реализации каждого эпика.
- next_step: Создать и подключить `docs/sql/vip-cross-franchize-hydration.sql` по аналогии с `vip-bike`, затем добавить фильтр по `crew slug` при появлении мульти-crew задач в `supaplan_tasks`.
- risks: Если в рантайме отсутствует `SUPABASE_SERVICE_ROLE_KEY`, страница покажет fallback с ошибкой загрузки SupaPlan-данных вместо live-статуса; детализация epics зависит от дисциплины заполнения `body/todo_path` в SupaPlan.
- dependencies: T51
- deliverables:
  - `app/supaplan/franchize/page.tsx`
  - `app/supaplan/page.tsx`
  - `app/nexus/page.tsx`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Создать dedicated `/supaplan/franchize` страницу c human-first UI и легендой.
  2. Связать идеи клиента с capability и показать соответствующие SupaPlan task/status.
  3. Добавить входы из `/supaplan` и `/nexus` как операторские launch-точки.
- acceptance criteria:
  - На `/supaplan/franchize` видно соответствие «идея ↔ capability ↔ task/status».
  - У оператора есть быстрый переход на страницу из `/supaplan` и `/nexus`.
  - План отражает alias `viphbike` и канонический slug `vip-bike`.
 


### T55 — MapRiders goldmine ingestion + phased SupaPlan decomposition
- status: `in_progress`
- updated_at: `2026-04-06T12:55:00Z`
- owner: `codex`
- notes: После повторного анализа deep-research и внешних review выполнен ещё один UI-полиш-срез в рамках I5: у rider markers добавлены heading indicators (ориентация по bearing) и плавная интерполяция позиций, чтобы убрать "телепорт" при realtime-обновлениях. Одновременно backlog расширен новой секцией `I6 — Production-hardening` в `app/franchize/[slug]/map-riders/todo.md`: privacy controls, replay scrubber, speed-gradient routes, ordering guardrails и anti-spoof sanity checks; добавлены seed-пункты под SupaPlan task decomposition для I6.
- next_step: Закрыть полевой two-phone прогон (Telegram stale/offline + meetup persistence) и добавить drawer+leaderboard screenshot evidence, после чего перейти к I6 privacy/replay задачам через SupaPlan.
- risks: до I5 field QA остаётся интеграционный риск Telegram WebApp (слои карты/FAB/drawer) + риск отсутствия privacy controls до старта production-трафика.
- dependencies: T53
- deliverables:
  - `app/franchize/[slug]/map-riders/todo.md`
  - `supabase/migrations/20260406113000_map_riders_live_layer_foundation.sql`
  - `AGENTS.md`
- implementation checklist:
  1. Инвентаризация AGI handoff: выделить code-ready фрагменты и research-only предложения.
  2. Зафиксировать последовательный план портинга (I1..I5) c чёткими done-criteria.
  3. Подготовить idempotent SQL migration для live read-model и leaderboard read-model.
  4. Создать SupaPlan задачи на I2/I3/I4 с ссылками на секции todo.
- acceptance criteria:
  - Есть явный поэтапный backlog для map-riders porting.
  - SQL подготовлен в `supabase/migrations/*` и не ломает существующие таблицы.
  - SupaPlan содержит task decomposition для следующих итераций.

### T56 — FRZ-R11: Challenges/events/district capture framework
- status: `ready_for_pr`
- updated_at: `2026-04-26T15:10:00Z`
- owner: `codex`
- notes: Разложен геймификационный контур по трём безопасным срезам: (1) модель событий и сезонных испытаний, (2) слой district-capture с анти-спам ограничениями, (3) Telegram-first витрина прогресса без тяжёлых realtime-перерисовок.
- next_step: Завести связанные SupaPlan подзадачи на backend-contract, UI-слой и anti-cheat телеметрию.
- risks: без анти-абьюз счётчиков районов возможны накрутки; без локального кеша у Telegram-пользователей будут заметные лаги при открытии карты.
- dependencies: T55
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Зафиксировать контракт сущностей: challenge, event, district, capture-window, reward-tier.
  2. Уточнить порядок релиза: backend contract -> leaderboard sync -> mobile UX.
  3. Добавить критерии против накруток (rate limits, speed sanity, cooldown окна).
- acceptance criteria:
  - В плане есть явная архитектурная рамка FRZ-R11 по данным, UX и anti-abuse.
  - Следующие задачи можно брать параллельно без конфликтов по зонам файлов.

### T57 — FRZ-R12: Pro subscription + multi-city expansion framework
- status: `ready_for_pr`
- updated_at: `2026-04-26T15:10:00Z`
- owner: `codex`
- notes: Добавлен каркас роста для Pro-подписки и мультигородской модели: baseline-пакеты, платные опции, региональные пресеты, и этапный rollout с контрольными KPI для каждого города.
- next_step: Создать отдельные SupaPlan задачи на billing-contract, operator dashboard и onboarding-kit для новых городов.
- risks: без контрактов по биллингу нельзя запускать автосписания; без city-template чеклистов вырастет время запуска новых локаций.
- dependencies: T55
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Описать линейку Pro-пакетов (single-city, multi-city, enterprise) и минимальные SLA.
  2. Разделить rollout на волны: pilot-city -> 3-city cohort -> regional scaling.
  3. Зафиксировать KPI-контур: activation rate, ride retention, CAC payback.
- acceptance criteria:
  - В плане зафиксирована конкретная рамка FRZ-R12 по продукту, rollout и KPI.
  - Есть ясные точки декомпозиции для следующих инженерных задач.


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

## 7) Progress changelog / diary is in /docs/AGENT_DIARY.MD

Historical diary entries were moved to `docs/AGENT_DIARY.md` to keep this execution ledger readable.
Append only compact session deltas here as pointers when needed; full narrative belongs to the diary archive.

- 2026-03-13: T50 started — added order-doc template local fallback + DB snapshot/retry pipeline (`franchize_order_notifications`) in server actions/migration; next focus is crew ACL + retry UI wire-up.
- 2026-03-20: Провёл SupaPlan-разбиение franchize интеграции на FRZ-R1/FRZ-R2/FRZ-R3 с явными зависимостями; FRZ-R1 блокирует контракт, FRZ-R2 и FRZ-R3 разрешены параллельно после фикса контракта.
- 2026-03-20: Выполнен cleanup истории: длинный хвост execution-логов вынесен в `docs/THE_FRANCHEEZEPLAN_HISTORY_ARCHIVE.md`, активный план оставлен компактным для параллельной работы новых участников.
- 2026-03-20: Добавлены дополнительные клиентские SupaPlan-дорожки FRZ-R4/FRZ-R5 для ускоренного онбординга партнёров и прозрачной KPI-коммуникации.
- 2026-03-20: FRZ-R1 закрыт как блокирующий шаг: зафиксирован контракт метаданных и fallback-матрица в `docs/FRANCHIZE_METADATA_CONTRACT.md`; FRZ-R2/FRZ-R3/FRZ-R4/FRZ-R5 теперь можно выполнять параллельно.
- 2026-03-22: По операторскому запросу добавлен новый товар Seqvenz Zero для `vip-bike`: фото загружены в Supabase Storage, запись синхронизирована напрямую в `public.cars`, а повторяемый upsert закреплён отдельной миграцией.
- 2026-03-24: Закрыт FRZ-R3 в практическом виде — добавлены операторские виджеты в `/nexus` и новая витрина `/supaplan/franchize` с легендой, фазами и live-сопоставлением SupaPlan задач к клиентским идеям `vip-bike`/`viphbike`.
- 2026-03-24: FRZ-R10 improvement pass (rental flow hardening): в `/franchize/[slug]` добавлены бейджи availability + HOT на карточки байков, фикс мультидневного ценообразования в cart lines (поддержка `1/3/7` дней RU/EN), а в `order` встроены дата-диапазон и e-signature поля (ФИО + consent fingerprint). DOCX из markdown-шаблона теперь отправляется не только админу, но и арендатору + owner (когда telegram id доступен через users.metadata).
- 2026-03-24: FRZ-R11 старт/выполнение — добавлена страница `/doc-verifier` для tamper-check DOCX: регистрация оригинала в Supabase Storage + SHA-256 в таблице `doc_verifier_records` (scope-aware для повторного использования в разных интеграциях), затем верификация загруженного файла через сравнение `uploaded hash` vs `db hash` + контроль целостности storage-копии (`storage hash` vs `db hash`).
- 2026-04-06: Стартован T55 (MapRiders goldmine ingestion) — собран phased backlog I1..I5, подготовлена migration-заготовка `20260406113000_map_riders_live_layer_foundation.sql`, создано 3 SupaPlan task-а для I2/I3/I4 (IDs: `c7af132c-3f44-4129-a4d7-e50b2e2e593c`, `a947b563-1fd2-4459-84bc-8978c6f520eb`, `3da1fba0-84bc-4afb-ada0-42240f625999`).

- 2026-04-06: Выполнен SupaPlan task `c7af132c-3f44-4129-a4d7-e50b2e2e593c` (I2) — добавлены `GET /api/map-riders/overview`, `GET /api/map-riders/leaderboard`, `GET /api/map-riders/health`, вынесен общий data-layer `app/api/map-riders/_lib/shared.ts`, legacy `GET /api/map-riders` оставлен backward-compatible через shared fetch-пайплайн.

- 2026-04-06: Выполнены SupaPlan задачи `a947b563-1fd2-4459-84bc-8978c6f520eb` (I3) и `3da1fba0-84bc-4afb-ada0-42240f625999` (I4) — добавлены batch-write endpoint + fallback/deprecation, внедрены reducer/provider и UI-срезы goldmine, `MapRidersClient` переведён на refactored orchestration без изменения page route-контракта.

- 2026-04-06: T55 update — добавлен `scripts/map-riders-qa-check.mjs` и `npm run qa:map-riders` для repeatable smoke (страница `vip-bike/map-riders` + split APIs + legacy), backlog `app/franchize/[slug]/map-riders/todo.md` синхронизирован: stale rider eviction отмечен как выполненный.

- 2026-04-06: T55 polish pass — после reread `goldmine/mr_*` закрыт TODO в clustering UX: `RiderMarkerLayer` теперь показывает cluster count marker + tap-to-zoom drilldown на low zoom, и добавлены `title/alt/keyboard` marker-атрибуты для a11y-совместимости с исследовательским чеклистом.
- 2026-04-06: Создан следующий SupaPlan task для I5: `492d4564-1f97-4b49-b61f-a979bc4019fb` (`MapRiders I5 field QA evidence pack (vip-bike)`, capability `ui.ux`, `todo_path=app/franchize/[slug]/map-riders/todo.md#Next SupaPlan seed (post-I5)`).
- 2026-04-06: T55 update — в `components/map-canvas/RiderMarker.tsx` добавлены heading arrow + плавная интерполяция marker position (убран резкий jump на realtime packets), а в `app/franchize/[slug]/map-riders/todo.md` добавлены секции `I6 — Production-hardening backlog` и `I6.1 — Screenshot + demo artifacts` для следующего SupaPlan цикла.
- 2026-04-06: Для `I6` заведены новые SupaPlan задачи: privacy `3edabd9c-6f88-4491-aa31-2f11566e3059`, replay UI `b2fb8b78-dc2d-4913-b379-caf22eb1c4e5`, speed-gradient `92b48f2c-9c24-451e-bd4e-7cc761a7fc68`, ordering/anti-spoof `2d2c9b4a-ca83-4f41-9bf6-75f7bc475830`, field QA + screenshots `e9c8f76f-0863-4f20-a871-6a09dd3bf7f8`.
- 2026-04-06: По обратной связи оператора закрыт SupaPlan task `2d2c9b4a-ca83-4f41-9bf6-75f7bc475830`: в `lib/map-riders-reducer.ts` добавлены guardrails против out-of-order realtime packets и anti-spoof sanity checks (нереалистичные GPS прыжки/координаты отбрасываются). Дополнительно удалён бинарный screenshot из git и зафиксированы guardrails для `scripts/page-screenshot-skill.mjs` в `AGENTS.md`, `README.MD`, `docs/README_TLDR.md`.

- 2026-04-17: T55 hotfix slice — закрыт P1 leak в `hooks/useLiveRiders.ts` (Telegram callback polling теперь гарантированно останавливается по timeout/resolve), усилен mobile long-press захват в `components/maps/MapInteractionCapture.tsx`, карта на `/franchize/vip-bike/map-riders` сделана ниже и full-bleed на mobile + добавлен нижний overlay для перекрытия attribution-зоны; demo rider координаты синхронизированы с базой на Стригинский переулок 13Б (`map_rider_sessions` + `live_locations`), а demo-id исключены из eviction в reducer, чтобы кластер не исчезал через несколько секунд.
- 2026-04-17: T55 meetup/map polish — добавлен tap-first fallback: в map overlay появилась `+` кнопка для мгновенного создания meetup из выбранной точки, `MapInteractionCapture` теперь обрабатывает tap и на touch-устройствах (без desktop-only gating), а миграция `20260417023000_update_vip_bike_map_meet_points.sql` обновляет дефолтные POI в Supabase: `Стригинский бульвар 13Б` синхронизирован с demo rider (`56.204245, 43.798905`), river-point перенесён на безопасную локацию и добавлена третья точка `Площадь Комсомольская 2`.
- 2026-04-17: T55 admin-map-routes UX pass — русифицирован интерфейс `/franchize/[slug]/map-riders` и `/admin/map-routes`, в `map-routes` добавлена нижняя карта только с маршрутами + выбор существующего route для редактирования, реализовано добавление конечной точки через `+` после тапа по карте и динамическая достройка хвоста (включая loop-режим: пересборка замыкания с удалением старого сегмента к старту), а в `ClientLayout` отключены BikeHeader/BikeFooter на `/admin/map-routes` для большего полезного пространства карты.
- 2026-04-23: SupaPlan task `492d4564-1f97-4b49-b61f-a979bc4019fb` (I5 QA evidence) — прогнан `npm run qa:map-riders` с PASS по route + split APIs + legacy (все HTTP 200), получен screenshot `artifacts/map-riders-vip-bike-i5.png` через fallback `thum.io` (Playwright в раннере упал из-за отсутствующих системных библиотек); two-phone stale/offline + meetup persistence и drawer/leaderboard screenshot зафиксированы как полевой блокер окружения и оставлены в следующем шаге.
- 2026-04-23: P0 hardening batch (MapRiders security) — закрыт кросс-модульный слой защиты write-ручек: в `/api/map-riders/session`, `/meetups`, `/batch-points`, `/location` добавлены guard-проверки `Authorization` + `Origin` + `X-Requested-With`, введён per-user in-memory rate-limit (10/мин session, 5/мин meetup create/delete, 30/мин batch/location), а клиентские write-запросы (`RiderFAB`, `MapRidersClientRefactored`, `RidersDrawer`, `useLiveRiders`) переведены на единый helper заголовков с `X-Requested-With` и Bearer-токеном из Supabase session; дополнительно включён debounce 2с на meetup create/delete и send-throttle 3с в live GPS hook.
- 2026-04-23: SupaPlan status sync + UX-01 — выставлены `ready_for_pr` для задач `SEC-01` (`bc93d9af-9029-4522-8c85-c0d9de361488`) и `SEC-02` (`fda4e153-d540-478a-8cef-c810ad600a74`) после фактического hardening; дополнительно закрыт `UX-01` (`6b1d27ce-a9b4-4b9c-959d-bc8d7ea49dbc`): в `MapRidersClientRefactored` удалены `window.prompt/window.confirm`, добавлены `FranchizePromptModal` и `FranchizeConfirmModal` с сохранением текущей логики create/delete meetup.
- 2026-04-23: P1 review-fix по security guard — устранён регресс Telegram-only авторизации: `guardMapRidersWriteRequest` теперь валидирует как Supabase bearer, так и app JWT (`/api/auth/jwt`), а rate-limit ключи переведены на authenticated subject (не `payload.userId`). Дополнительно проведён smoke-run `createFranchizeOrderCheckout` (cash, без XTR): тест дошёл до server action, но упал на `Failed to persist order snapshot: TypeError: fetch failed` (Supabase connectivity/runtime env blocker), поэтому full rent flow + doc generation остаются в статусе blocked-by-env.
- 2026-04-24: SupaPlan task `3edabd9c-6f88-4491-aa31-2f11566e3059` (MapRiders I6 privacy) переведён в `ready_for_pr`: добавлены privacy-контролы в rider-панель (видимость crew/public, авто-истечение 1/5/15/60, toggle home blur, pause/resume sharing), прокинут privacy payload в live write API, включено server-side истечение с auto-stop (409 на просроченные записи) и запись privacy-метаданных в `map_rider_sessions.stats`.
- 2026-04-26: SupaPlan task `e9c8f76f-0863-4f20-a871-6a09dd3bf7f8` (MapRiders I6 screenshot pack) — повторно прогнан `npm run qa:map-riders` (PASS по `/franchize/vip-bike/map-riders` + split APIs + legacy), обновлены доказательства `artifacts/map-riders-vip-bike-i6-live-map.png` и `artifacts/map-riders-vip-bike-i6-drawer-leaderboard.png`; Playwright Chromium/Firefox/WebKit в раннере не стартовали из-за отсутствующих системных библиотек, поэтому применён fallback `thum.io`.
- 2026-04-26: Выполнен пакет «5 задач сразу» по запросу оператора: закрыты инженерные задачи `d8b4e4e7-8234-4b8d-2345-88880008f345` (dedup meetup creation), `da6d6a09-0234-4ade-4567-aaa000aaf567` (GPS source lock), `db7e7b1a-1234-4bef-5678-bbb000bbf678` (a11y drawer), а также оформлены плановые фреймворки `d0521b55-8bd4-4c94-9360-7e93219d57fd` (FRZ-R11) и `fa5eed14-bc10-4c33-800b-3daef27a3148` (FRZ-R12) в текущем плане.

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

### History archive pointer
Detailed historical execution notes moved to:
- `docs/THE_FRANCHEEZEPLAN_HISTORY_ARCHIVE.md`
- `docs/AGENT_DIARY.md` (compact) and `docs/AGENT_DIARY_ARCHIVE_2026Q1.md` (full)
- 2026-04-23: Выполнен UX-02 (`c55e20dc-f8a8-47a0-9dda-d16a44de3ef9`) — добавлен хук `useIsAdmin` для единой проверки глобальной/crew-admin роли, скрыты admin-only ссылки для non-admin в `MapRidersClientRefactored` (`/admin/map-routes`) и в профайл-меню franchize (`Franchize admin`).
