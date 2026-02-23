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
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Apply the friend review UI parity deltas in franchize catalog surfaces while preserving existing modal/cart/order logic and crew-theme token architecture.
- next_step: Set task `in_progress`, implement listed file changes, then capture screenshot proof on `/franchize/vip-bike`.
- risks: Over-polishing typography/button heights can reduce content density on smaller Android viewports; validate 2-column card readability after changes.
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
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Apply strict engineering pass to remove architectural workarounds discovered in post-review audit: server-only admin key usage, SPA navigation integrity, cart write-throttle strategy, and context/theme maintainability. Keep embedding fallback redesign out-of-scope for this task per operator note.
- next_step: After T48 visual parity, start with admin-key isolation (security first) and then proceed sequentially through SPA/cart/state/style substeps.
- risks: Refactors may touch cross-cutting runtime paths (`hooks`, `contexts`, `franchize` navigation). Must preserve Telegram WebApp behavior and legacy routes while removing workaround patterns.
- dependencies: T48
- deliverables:
  - `hooks/useTelegram.ts`
  - `hooks/supabase.ts`
  - `hooks/useFranchizeCart.ts`
  - `app/franchize/components/*` (navigation touchpoints)
  - `contexts/AppContext.tsx` (or split contexts)
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. **Security first:** eliminate any client import path that can bundle `SUPABASE_SERVICE_ROLE_KEY`; move privileged user-create/update logic to server actions/route handlers only.
  2. **SPA recovery (critical):** remove full-reload navigation fallbacks (`window.location.assign`, hard `<a>` for internal routes) and restore deterministic Next.js `Link`/router transitions.
  3. **Root-cause tap fix:** audit z-index/overlay/stopPropagation conflicts in franchize header/menu/footer/modal layers so taps work without sacrificing SPA behavior.
  4. **Cart DB load guard:** stop high-frequency JSONB writes on every cart micro-change; keep cart local-first and persist on checkout/explicit sync points with bounded write cadence.
  5. **Style-system cleanup:** reduce inline-style dominance in franchize surfaces by moving palette delivery to CSS variables usable via Tailwind utilities (`bg-[var(--...)]`, `text-[var(--...)]`) so focus/hover/active states remain reliable.
  6. **Context split plan:** decompose oversized `AppContext` responsibilities into smaller logical providers (`Auth/Cart/Game`) and replace minute polling where possible with event/realtime-driven updates.
  7. **Theme flash hardening:** bootstrap theme from early server-readable signal (cookie/session hint) to avoid white-flash first paint before async profile/theme sync completes.
  8. **Micro-optimization rollback:** remove/avoid cargo-cult `React.memo` on trivial icon/text renderers unless profiling proves benefit.
  9. **AI JSON resilience:** harden franchize AI-JSON parsing/validation so malformed payloads produce inline actionable errors instead of component-breaking crashes.
  10. **Regression pack:** run focused smoke for Telegram-style navigation, modal/cart actions, and no-white-flash route transitions on `/franchize/vip-bike`.
- acceptance criteria:
  - No client-side bundle path can access admin/service-role Supabase credentials.
  - Internal franchize navigation uses SPA transitions (no forced full reload workaround for same-origin routes).
  - Cart persistence no longer performs frequent metadata writes per tiny quantity edit.
  - Interaction-state styles (`hover/focus/active`) remain visible after theme application without inline override conflicts.
  - Context updates avoid full-app rerenders for unrelated state and remove brittle timer-only dependency for realtime-like UX.
  - First paint does not flash incorrect light theme before dark theme sync for known dark-pref users.
  - AI JSON tooling reports precise validation errors without crashing franchize create flow.

### T49.1 — Postpone fake embedding fallback redesign (explicitly deferred)
- status: `todo`
- updated_at: `-`
- owner: `unassigned`
- notes: Documented deferral: vector-embedding fallback redesign is intentionally excluded from current hardening wave per operator instruction ("don't bother about embeddings generation").
- next_step: Revisit only when search relevance workstream is scheduled.
- risks: Search quality may remain degraded in edge-failure mode until dedicated embeddings task is prioritized.
- dependencies: T49
- deliverables:
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Keep current scope focused on security + SPA + state reliability.
  2. Capture explicit defer note in diary to prevent accidental silent scope creep.
- acceptance criteria:
  - Plan clearly states embeddings fallback redesign is deferred by instruction.

### T49.2 — AGENTS context diet + archive trigger policy
- status: `done`
- updated_at: `2026-02-23T12:20:00Z`
- owner: `codex`
- notes: Added explicit memory-system policy in AGENTS so long diary context is loaded on demand only (Telegram/Slack/screenshots/homework triggers), reducing routine prompt bloat while preserving incident memory quality.
- next_step: Continue with T48 implementation as next product-facing execution task.
- risks: If trigger list is ignored manually, agents may still over-read diary and lose focus on small UI tasks.
- dependencies: T47
- deliverables:
  - `AGENTS.md`
  - `docs/THE_FRANCHEEZEPLAN.md`
- implementation checklist:
  1. Keep AGENTS as constitutional rules and move historical depth to diary-on-demand behavior.
  2. Define concrete trigger categories when diary must be read before coding.
  3. Preserve existing diary contract (append lessons after meaningful incidents).
- acceptance criteria:
  - AGENTS contains explicit rule to skip full diary for routine edits.
  - AGENTS contains explicit trigger list for mandatory diary reads.
  - Plan diary records this context-diet update for traceability.

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

### 2026-02-23 — AGENTS context diet enabled (archive triggers)
- Added explicit memory-system policy in `AGENTS.md` so `docs/AGENT_DIARY.md` is no longer treated as default read for every task.
- Introduced mandatory trigger list for diary reads (Telegram, Slack, screenshot engine, homework pipeline) to keep high-signal lessons accessible without context-window overload.
- Kept chronology and safety intact: diary remains authoritative archive, but loaded only when relevant.
- Logged as T49.2 done so plan history stays merge-traceable.

### 2026-02-23 — Architecture commandments added to AGENTS + T49 scope expansion
- Added a dedicated “Архитектурные заповеди GTC-Daemon” block in `AGENTS.md` to prevent workaround regressions (security boundary, SPA routing oath, z-index/tap root-cause debugging, race-condition discipline, CSS-variable theming, context boundaries).
- Expanded T49 hardening checklist with additional engineering guardrails from review round 2: theme flash prevention, selective memoization (no cargo-cult `React.memo`), and robust AI JSON validation behavior.
- Kept operator-requested deferral intact: embeddings fallback redesign remains postponed and out-of-scope for this wave.
- Preserved ordered flow: T48 remains the immediate executable UI task; T49 remains the architectural hardening pass right after.

### 2026-02-23 — Engineer review intake (architectural risk backlog added)
- Added a dedicated hardening track after T48 to address root-cause architecture issues surfaced by strict engineering review: admin-key exposure risk, SPA navigation regressions, high-frequency cart metadata writes, CSS inline/tailwind conflicts, and oversized AppContext responsibilities.
- Marked SPA recovery as critical path and explicitly prioritized replacement of forced full reload navigation with Next.js SPA-safe transitions plus tap-layer root-cause fixes.
- Captured explicit deferral task for embedding fallback redesign (`T49.1`) per operator instruction to skip that stream for now.
- Kept sequence deterministic: T48 visual parity remains next, T49 hardening starts immediately after.

### 2026-02-23 — T47 completion (friend review digested into actionable parity backlog)
- Celebrated the strong baseline feedback first (dark theme, radiuses, layout flow, dynamic theme engine) and treated review as a precision polish input rather than a rewrite request.
- Converted friend visual-diff notes into deterministic implementation scope with file-level mapping: `CrewHeader`, `CatalogClient`, `FloatingCartIconLink`, and `lib/theme`.
- Added explicit acceptance criteria for five UI deltas: solid pill states, stronger section hierarchy, accent price + cart icon CTA, overlapping floating badge, and softer card borders.
- Appended T48 as a strict dependency-locked execution task so next iteration can implement with screenshot-backed verification on `/franchize/vip-bike`.

### 2026-02-22 — T28 completion (launch cockpit inside franchize create)
- Shifted focus away from order-page micropolish and shipped a broader operator capability: a dedicated `Launch cockpit` stage in `/franchize/create`.
- Added readiness score engine that distills core rollout constraints into 6 checks (identity, contacts, map kit, canonical routes, catalog readiness, contrast).
- Added blocker-oriented checklist cards with hints plus quick jump links to canonical `/franchize/{slug}` execution surfaces.
- This pass translates dispersed runbook ideas into one operational panel for faster franchise sandbox launch decisions.
- Next beat: T29 can wire this cockpit to automated QA smoke + screenshot evidence generation.



### 2026-02-22 — T32 completion (quick-filter stabilization + global reset)
- Addressed feedback on previous quick-filter pass by cleaning implementation and reducing interaction ambiguity.
- Added live counts to each quick filter chip so users can see expected result volume before tapping.
- Added `Сбросить всё` action to clear both search and chip filter in one motion.
- Kept scope catalog-only and non-destructive: no modal/cart/order logic changes.
- Next beat: T33 can move promo cards from text-only to image-backed campaign blocks.

### 2026-02-22 — T31 completion (quick-filter energy pass, no order-modal changes)
- Responded to operator feedback ("order modal is boring") by focusing next beat on catalog energy, not checkout surfaces.
- Added quick filter chips for high-intent browsing: all, budget, premium, and newbie-friendly presets.
- Combined quick-filter and text search logic so filters stack naturally without breaking existing catalog behavior.
- Preserved item modal flow, cart pill, and order routes unchanged; this is a safe conversion-oriented catalog enhancement.
- Next beat: T32 can add image-backed promo tiles with scheduling for campaign precision.

### 2026-02-22 — T30 completion (search reset + section density cues)
- Closed follow-up review feedback from T29 by shipping practical conversion helpers instead of purely visual additions.
- Added one-tap `Сброс` action inside catalog search so operators/users can quickly recover full inventory after narrow queries.
- Added per-section count chips (`N шт.`) in catalog group headers to improve scan confidence and communicate filtered inventory density.
- Preserved existing modal-first item interaction, floating cart behavior, and checkout flow with no route/data-model churn.
- Next beat: T31 can add checkout urgency nudge copy if we want one more parity sweep.


### 2026-02-22 — T29 completion (Pepperolli subtle-gap audit + promo module pass)
- Performed side-by-side check of `v0-car-test.vercel.app/franchize/vip-bike` and `пепперолли.рф` to isolate subtle conversion gaps (beyond auction ticker and homepage ad popup already noted by operator).
- Found our catalog had weaker campaign density right below search compared to Pepperolli's immediate promo card stack.
- Added compact promo modules (3 max) under search, hydrated from ticker metadata, with concise CTA copy and dark/accent styling aligned to existing crew theme.
- Kept change additive: no route churn, no modal/cart behavior changes, no inventory schema changes.
- Next beat: T30 should add local conversion helpers (search clear affordance + category item counts + checkout urgency badges).

### 2026-02-22 — T27 completion (checkout copilot expansion)
- Upgraded the order sidebar from tiny status chip to a larger `Checkout copilot` module with readiness %, blocker inventory, and guided UX messaging.
- Added dynamic blocker detection for cart/contact/consent and Telegram Stars context, so users can see exactly what blocks submission.
- Added next-action helper button that focuses the first unresolved field (`recipient`, `phone`, `time`, `consent`) for faster completion.
- Kept the whole pass visual/assistive only: checkout payload creation and submit permissions remain unchanged.
- Next beat: T28 can add post-submit delight continuity so success feels as polished as pre-submit guidance.

### 2026-02-22 — T26 completion (checkout micro-delight readiness meter)
- Added a compact `Checkout vibe` meter in order sidebar with three milestones (cart/contact/consent) so readiness is visible before submit.
- Added accent badge that transitions from progress fraction (`N/3`) to `Готово ✨` once all milestones are complete.
- Kept change visual-only: submit eligibility, payment flow, and cart totals remain unchanged.
- Captured updated mobile screenshot on `/franchize/vip-bike/order/demo-order` after applying the sidebar polish.
- Next beat: optional T27 can add tiny celebratory motion states after successful submit for extra delight.


### 2026-02-22 — T25 completion (one-go interaction-state styling sweep)
- Added shared `focusRingOutlineStyle(theme)` helper and applied it to modal/cart/order actionable controls for consistent keyboard-visible focus.
- Polished controls with subtle hover/press transitions so tactile feedback remains clear in both dark and light crew palettes.
- Kept checkout/cart/modal behavior unchanged while improving perceived UX responsiveness across high-traffic franchize surfaces.
- Next beat: T26 can ship “interesting stuff” (micro-delight cues around checkout progression) if operator wants extra vibe boost.


### 2026-02-22 — T24 completion (catalog interaction-state polish)
- Added `interactionRingStyle(theme)` helper in franchize theme utilities to keep focus ring color tied to crew accent tokens.
- Wired focus-state visuals for catalog search input + `Искать` button and catalog item trigger buttons in `CatalogClient`.
- Kept behavior unchanged (same modal open/add-to-cart flow) while making keyboard/tap focus affordances visible on `vip-bike` storefront.
- Next beat: optional T25 can extend the same interaction-state parity to modal/cart/order actionable controls.


### 2026-02-22 — T23 completion (catalog tile token isolation)
- Added `catalogCardVariantStyles(theme, variantIndex)` helper so card variant borders/backgrounds/shadows are fully palette-driven.
- Replaced catalog card utility class variants with semantic style resolver usage in `CatalogClient`.
- Updated `/franchize/[slug]` page shell to use `crewPaletteForSurface(crew.theme).page` instead of global `bg-background/text-foreground` utility classes.
- Next beat: optional T24 can target focus-ring/hover-state parity checks for contrast in extreme custom palettes.


### 2026-02-22 — T22 completion (order flow token parity + contacts map bridge)
- Migrated `OrderPageClient` section cards/inputs/muted labels/summary blocks from global utility token classes to `crewPaletteForSurface` + palette-driven border/input styles.
- Kept order CTA/payment selection behavior unchanged while improving theme readability consistency for light/dark crew palettes.
- Added optional `theme` prop to `FranchizeContactsMap` and wired it from contacts page so fallback/frame colors follow crew palette tokens.
- Next beat: T23 should tackle remaining catalog tile utility background classes for complete storefront token isolation.


### 2026-02-22 — T21 completion (token hotspot cleanup)
- Migrated cart page headline/empty state/cards/summary/muted copy to `crewPaletteForSurface` styles and explicit border tokens.
- Migrated catalog search input + empty blocks + fallback description copy away from global muted utility token defaults.
- Updated item modal option-chip section headers to use crew `textSecondary` token.
- Next beat: T22 should finish `OrderPageClient` utility-token migration and run another vip-bike light-mode readability sweep.


### 2026-02-22 — T20 completion (floating cart palette-mode background)
- Added `floatingCartOverlayBackground(theme)` helper in franchize theme lib so cart shell translucency is derived from crew palette + mode.
- Threaded `theme` through floating cart wrappers and removed hardcoded dark RGBA from `FloatingCartIconLink`.
- Restored direct usage of `textColor` prop for icon/label contrast instead of shadowing it as an unused argument.
- Next beat: continue with T21 and migrate remaining `text-muted-foreground/bg-card` hotspots in catalog/cart/order components.


### 2026-02-22 — T19 completion (surface token cleanup for overlays)
- Updated `Item` modal surfaces/muted text/spec cards to use `crewPaletteForSurface` styles instead of global `bg-card/text-muted-foreground` classes.
- Updated `HeaderMenu` tagline muted text to resolver-driven palette color to keep copy readable in custom crew themes.
- Updated `FloatingCartIconLink` shell/empty state styling to remove reliance on global theme card/muted utility tokens.
- Next beat: continue with T20 and migrate remaining catalog/cart/order utility-token hotspots.

### 2026-02-21 — T18 completion (`/franchize/create` dual palette UX)
- Added Light palette fieldset in create form (7 semantic tokens) with separate preview card and additional contrast diagnostics.
- Extended `FranchizeConfigInput`/validation/defaults to carry both dark (existing) and light palette tokens.
- Updated save pipeline to persist `theme.palettes.dark|light` and sync active `theme.palette` based on selected `theme.mode`.
- Updated load/apply logic so editor hydrates light palette values from metadata and keeps legacy compatibility.

### 2026-02-21 — T17 completion (palette resolver + dual-palette seed support)
- Added `crewPaletteForSurface` helper and applied it to `/franchize/[slug]/about|cart|contacts|order/[id]` page shells to stop leaking global `bg-background/text-foreground` tokens into crew-themed surfaces.
- Extended `getFranchizeBySlug` palette hydration to resolve by theme mode from either flat `theme.palette` or dual `theme.palettes.dark/light` metadata.
- Updated demo SQL hydration seeds (`vip-bike`, `sly13`) with explicit dual palette sets; `sly13` now defaults to a light-mode variant while preserving dark palette fallback.
- Next beat: T18 form UX should expose both palette sets in `/franchize/create` for no-code operators.

### 2026-02-21 — T16 completion (rental lifecycle controls on franchize card)
- Added role-aware control panel directly in `/franchize/[slug]/rental/[id]`: owner actions (confirm pickup/return) and renter actions (open Telegram photo flow for start/end).
- Extended `getFranchizeRentalCard` payload with `ownerId`/`renterId` so UI can deterministically gate controls by participant role.
- Kept Telegram-first flow by reusing existing rental server actions (`confirmVehiclePickup`, `confirmVehicleReturn`, `initiateTelegramRentalPhotoUpload`) instead of duplicating lifecycle logic.
- Next beat: begin T17 palette resolver migration to prevent crew dark palette clashes with global light/dark tokens.


### 2026-02-21 — T16C ad-hoc polish (category rail + unified nav helper)
- Added shared franchize navigation helper (`app/franchize/lib/navigation.ts`) and reused it in header modal/profile actions + category id mapping.
- Rebuilt header category rail to derive links from rendered catalog sections (`section[data-category]`), so order now mirrors catalog and empty showcase groups are auto-hidden.
- Implemented smooth click-scroll to chosen group, active-pill auto-scroll-into-view, hidden scrollbar rail, and split sticky behavior (top header scrolls away, pills rail stays visible).
- Updated AGENTS with two routing hints: RU task text defaults to FRANCHEEZEPLAN and generic `FRANCHEEZEPLAN` requests should execute the next ready planned task; also set default QA slug to `vip-bike`.


### 2026-02-21 — T16B ad-hoc polish (subpage back-link reliability)
- Fixed remaining flaky internal links on cart/order/rental subpages where `Вернуться в каталог` / `К каталогу` sometimes did not navigate in Telegram webview.
- Switched those actions to direct anchor navigation and kept visual hierarchy unchanged.
- Re-tested on mobile viewport: cart->catalog, order->catalog, rental->catalog all route correctly.


### 2026-02-21 — T16A ad-hoc polish (tap/click reliability sweep)
- Investigated shared root cause across franchize header/footer/profile/cart: internal client-link taps were unreliable in modal/dropdown/webview surfaces.
- Hardened routing by using deterministic navigation paths (anchors or explicit `window.location.assign`) for footer menu links, profile dropdown items, and floating cart pill.
- Re-validated interaction flow on mobile viewport: header menu link opens `/about`, footer `Контакты` opens `/contacts`, profile dropdown opens `/settings`, cart pill opens `/cart`.
- Added AGENTS keyword-trigger note so Pepperolli/VIP-bike/franchize requests always spawn/update an ad-hoc FRANCHEEZEPLAN task for historical continuity.






### 2026-02-21 — T16 polish (post-payment "You are in" notification)
- Upgraded `franchize_order` success notification to rich celebratory payload with full order details (recipient/phone/delivery/slot/cart/extras/totals), deep links, and visual image query.
- Kept primary continuation CTA first in notification keyboard and preserved Telegram deep-link as dedicated secondary action.
- Added owner/admin message refinements with richer totals breakdown for faster operator verification.

### 2026-02-21 — T16 polish (CTA hierarchy + fallback minimization)
- Swapped action hierarchy so the primary button is now `Продолжить оформление` (main next step after invoice intent), while Telegram deep-link moved to subtle fallback row.
- Removed `Legacy rentals` shortcut entirely to keep franchize-first flow deterministic.
- Added celebratory deal-start badge and info-icon tooltip for fallback semantics to keep UX clear without noisy body copy.

### 2026-02-21 — T16 polish (deep-link CTA clarity + checkout rename)
- Clarified why Telegram button exists directly in rental card UX copy: fallback entrypoint for restoring `startapp=rental-...` context when opened outside mini-app session.
- Renamed/visual-polished checkout action to `Перейти в оформление` with icon for clearer operator intent and stronger scanability.
- Captured fresh screenshot and reran lint/build/franchize smoke checks.

### 2026-02-21 — T16 progress (profile dropdown in franchize header)
- Replaced franchize header avatar link with role-aware dropdown navigation: `Профиль`, `Настройки`, `Branding`, optional `Мой экипаж`, and `Admin` for admins only.
- Kept dropdown shell palette-bound to crew metadata to avoid global theme contrast regressions.
- Clarified next beat: role-bound rental action controls remain pending in T16 scope.

### 2026-02-21 — T16 pre-hotfix (header palette source)
- Resolved dark/light mesh issue from QA screenshot by switching `CrewHeader` surface colors (header bg, ticker rail, menu/profile shells, balloon text) to crew metadata palette tokens.
- Added follow-up tasks: T17 for full palette/theming parity audit and T18 for `/franchize/create` dual-palette UX expansion.
- Captured updated `/franchize/vip-bike/rental/demo-order` screenshot after header pre-hotfix and reran lint/build/smoke checks.

### 2026-02-21 — T16 progress (franchize rental page styling + build unblock)
- Fixed production build import path for franchize rental page (`../../../actions`), resolving missing-export errors during Next.js build.
- Overhauled `/franchize/[slug]/rental/[id]` visuals to use crew metadata palette and shared franchize shell (`CrewHeader` + `CrewFooter`) for brand-consistent runtime UX.
- Revalidated production build after refactor and captured fresh mobile screenshot artifact for `/franchize/vip-bike/rental/demo-order`.

### 2026-02-21 — T15 execution complete (Telegram photo fallback + completed events)
- Fixed Telegram rental photo ingestion when `user_states.awaiting_rental_photo` is missing by auto-detecting likely renter rental context and expected photo type from status/events.
- Prevented stuck return/pickup confirmations by saving `photo_start`/`photo_end` events with `status=completed` in both webhook and `addRentalPhoto` paths.
- Kept `/actions` compatibility while reducing fragile dependency on short-lived chat session state.


### 2026-02-21 — T14 execution complete (cart-line persistence + franchize rental handoff)
- Migrated franchize cart storage to structured cart lines with option hash (`itemId::package|duration|perk`) and backward-compatible hydration from legacy qty-only storage.
- Unified cart/order/floating totals on line-level pricing so option selections persist and affect totals consistently.
- Extended invoice metadata with generated `rental_id` + deep links and introduced `/franchize/[slug]/rental/[id]` runtime page as the new handoff surface.
- Added `franchize_order` webhook handler to upsert `rentals` as confirmed hot leads after successful XTR payment and notify renter/owner/admin with franchize-first links.
- Updated startapp routing in `ClientLayout` to resolve `rental-<uuid>` toward franchize rental pages before falling back to legacy routes.


### 2026-02-21 — T13 execution complete (modal/specs + smooth rails + extras totals)
- Updated item modal UX to open with 3-line description clamp and explicit `Показать ещё.../Скрыть` toggle for long texts.
- Replaced static quick-spec copy with parsed `cars.specs` metadata cards (with fallback values) to match VIP motorbike rental context.
- Stabilized header balloon rail active-state behavior with deterministic intersection scoring and visual selected state, while keeping scrollbar chrome hidden.
- Hard-pinned `wbitem` subgroup ordering to render at the end of catalog grouping.
- Added selectable checkout extras and included them in final total + XTR invoice 1% tip calculation/metadata.


### 2026-02-21 — T12 execution complete (pepperolli card polish + top balloons refactor)
- Moved section/group balloon rail ownership into `CrewHeader` so it now persists across all `/franchize/[slug]/*` pages and removed duplicate in-catalog sticky rail source.
- Extended top header blur with a `-42px` safe-area cap and applied scrollbarless horizontal rails to avoid camera-cutout visual gap on phones.
- Refined catalog cards with mixed visual variants, dynamic `Хит 🔥` badge logic for bobber-like entries, richer description rendering, and split CTA labels (`Добавить` vs `Выбрать`).
- Expanded catalog query scope to include `bike`, `accessories`, `gear`, `wbitem` plus dynamic showcase groups (`23rd feb edition`, `Все по 6000`) for roster-style duplication.
- Captured updated mobile screenshot artifact and sent execution closeout telemetry attempt via notify script (env-dependent).

### 2026-02-20 — T11 execution complete (header overlap + borderless controls)
- Updated franchize header action buttons to borderless styling for `Меню` and `Профиль` wrappers while preserving tap area and hover feedback.
- Raised header menu overlay stacking order and added safe-area-aware modal sizing/scroll behavior to avoid visual overlap with sticky catalog/search layers.
- Captured refreshed mobile screenshot evidence after menu-open state validation.
- Sent Telegram heartbeat update for task closeout with next-beat note.

### 2026-02-20 — T10 execution complete (post-QA smoke automation)
- Added `scripts/franchize-qa-check.mjs` to validate canonical slug-scoped franchize pages (`catalog/about/contacts/cart/order`) against a configurable base URL.
- Added `npm run qa:franchize` command so operators can run a single-step post-deploy smoke pass.
- Re-ran targeted franchize lint gate (`npm run lint:target`) and smoke verification against production URL.
- Sent Telegram heartbeat closeout via `scripts/codex-notify.mjs telegram` with super-admin mirror recipient included.

### 2026-02-20 — T9 execution complete (QA matrix + rollout evidence)
- Verified viewport coverage for `/franchize/vip-bike` catalog at 360x800, 390x844, 768x1024, and desktop; captured screenshot matrix artifacts.
- Captured required franchize flow screenshots: catalog, header menu, item modal, cart, order, and contacts pages.
- Ran `npm run lint` (pass with existing repo-wide warnings), `npm run build` (pass with non-blocking env warnings), and route smoke check via `curl` for core slug routes (`200` responses).
- Sent executor heartbeat via `scripts/codex-notify.mjs telegram` with super-admin mirror behavior enabled by script defaults.

### 2026-02-20 — T8.6 execution complete (copy + submit-state observability pass)
- Normalized `/franchize/[slug]/about` fallback description to RU-first operator copy and removed leftover English scaffold tone.
- Added deterministic submit-hint text on checkout sidebar to surface why CTA is blocked (empty cart, missing consent, Telegram WebApp requirement).
- Kept checkout CTA language aligned with current payment branch (`XTR` vs regular confirm) while retaining no-crash behavior for non-Telegram sessions.
- Marked T8.6 done and opened path for T9 QA matrix.

### 2026-02-20 — T8.6 polish slice (checkout SoT + Telegram XTR payment)
- Unified checkout/cart composition through shared cart-line derivation and removed checkout-only seeded assumptions.
- Added empty-cart CTA/guard behavior and submit disable to prevent invalid order confirmation attempts.
- Implemented Telegram Stars (XTR) as primary checkout payment option with server action that creates invoice metadata and sends Telegram invoice for 1% proof-of-interest tip.
- Revalidated franchize-targeted lint and refreshed checkout screenshot evidence for the updated payment/summary UX.

### 2026-02-20 — T8.5 execution complete (map tab + Telegram-first copy pass)
- Added dedicated `Карта+соцсети` tab in franchize create form for no-code map calibration.
- Wired map calibration fields and social links through config load/save action contract.
- Updated footer to remove `Вход/Регистрация` block and show crew social links instead.
- Removed email-first copy from franchize contact surface and kept Telegram-driven comms emphasis.

### 2026-02-20 — T8.4 execution complete (VibeMap reinvestigation + contacts integration)
- Reinvestigated reusable `components/VibeMap.tsx` from car-rent/game surfaces and fixed practical robustness issues.
- Added fallback static map image and switched map image rendering to `object-contain` for safer calibrated overlays.
- Added reset control to quickly restore pan/zoom state on mobile interaction drift.
- Replaced contacts iframe approach with dedicated `FranchizeContactsMap` wrapper using VibeMap + metadata GPS marker.
- Extended SQL hydration docs with map `imageUrl` and `bounds` metadata for VIP-BIKE and SLY13.

### 2026-02-20 — T8.3 execution complete (follow-up parity sweep)
- Removed header search icon entirely and switched right-side action to dedicated franchize profile component wrapper based on shared user widget.
- Removed catalog clutter remnants (`Каталог (bike only)` and slug path label) so first fold starts with search.
- Added map section to `/franchize/[slug]/contacts` using metadata coordinates (`contacts.map.gps`) and fallback state when coordinates are absent.
- Reworked franchize footer into full-width yellow multi-section layout (contacts/menu/profile/social) with row separators + bottom strip.
- Deleted obsolete unslugged franchize pages (`/franchize/about|contacts|cart|order/[id]`) as requested.


### 2026-02-20 — T8.2 execution complete (Pepperolli parity polish slice)
- Added top ticker strip in franchize header and wired content from `catalog.tickerItems` metadata.
- Added omnipresent header quick-link balloons for catalog section recall from about/contacts surfaces.
- Implemented full-width catalog search (input + button) with real filtering across title/subtitle/description/category.
- Moved verbose tagline from header into `HeaderMenu` to reduce first-screen clutter and match reference rhythm.
- Extended SQL seed docs (`vip-bike`, `sly13`) with demo ticker metadata and quick-link arrays.

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

### 2026-02-20 — T8.1 planning closeout + pre-QA maximum polish gate
- Marked T8.1 `done` as a planning/documentation milestone (not feature implementation) per operator request to focus on prep before QA.
- Expanded parity plan into phased execution order with explicit rollback + telemetry expectations (booking, promo, invoice, rentals).
- Added T8.6 as mandatory pre-QA polish task to prevent avoidable churn during screenshot/lint/build QA run.
- Updated T9 dependency from T8.1 -> T8.6 so QA starts only after polish hardening is complete.


## 2026-02-21 — Item modal had mixed scroll contexts and flaky add CTA taps
- **Symptom:** in `/franchize/vip-bike` item modal, dragging scrolled page background instead of modal body; operator also reported `Добавить` occasionally doing nothing in webview gesture flow.
- **Root cause:** modal shell lacked strict body-scroll lock and CTA relied on plain click-only path, which can be dropped in some touch/webview gesture sequences.
- **Fix/workaround:** enforced `document.body` overflow lock for open modal lifecycle, made modal body the dedicated `overflow-y-auto` container, and added guarded add-to-cart press handler with explicit event `preventDefault/stopPropagation` for reliable mobile taps.
- **Verification:** `npm run lint -- --file app/franchize/modals/Item.tsx` + manual `/franchize/vip-bike` modal interaction pass.



## 2026-02-21 — Regression pass: ticker/logo alignment + SPA nav restore + branding ACL
- **Symptom:** logo in franchize header visually dropped below baseline after ticker changes; subpage category links became unavailable; forced full reload navigation caused perceived re-login on each route, and branding menu link pointed to `/crews/create`.
- **Root cause:** previous reliability patch replaced internal Next routing with hard reload anchors and left header logo container with negative bottom margin while ticker was enabled.
- **Fix/workaround:** removed logo negative offset, kept category rail available on subpages with `catalog#section` jump behavior, switched franchize internal nav handlers back to client routing (`router.push`/`Link`), corrected branding path to `/franchize/create`, and added server-side permission gate so only crew owner/all-admin can save while others stay read-only.
- **Verification:** `npm run lint -- --file app/franchize/components/CrewHeader.tsx --file app/franchize/components/CrewFooter.tsx --file app/franchize/components/FranchizeProfileButton.tsx --file app/franchize/create/CreateFranchizeForm.tsx --file app/franchize/actions.ts`.


### 2026-02-22 — T33 completion (promo/ad metadata controls + payment options)
- Added non-JSON controls in `/franchize/create` for `catalog.promoBanners` and `catalog.adCards` so operator can edit campaign content directly from branding flow.
- Wired server load/save mapping in `app/franchize/actions.ts` to round-trip promo/ad rows into `crews.metadata.franchize.catalog`.
- Updated catalog promo rail rendering to prioritize metadata promos/ads, with ticker fallback preserved for backward compatibility.
- Extended order settings in branding config with editable `paymentOptions` CSV to support non-XTR methods (`card`, `sbp`, `cash`) without code edits.
- Synced both SQL hydration docs with `adCards` sample payload and normalized payment options list to new keys.


### 2026-02-22 — T34 completion (campaign intelligence rail)
- Added schedule-aware campaign metadata (`activeFrom/activeTo`), priority sorting, and per-card CTA labels for both promo and ad sources.
- Hardened corner-cases requested by operator: empty `href` now falls back to `/franchize/{slug}#catalog-sections`, and very long titles are clipped to avoid rail overflow.
- Upgraded catalog rail from static first-3 cards to a rotating window so extra campaigns can be showcased without bloating page height.
- Updated branding editor hints/defaults and SQL hydration examples to include the extended campaign fields for immediate operator testing.


### 2026-02-22 — T35 completion (navigation/cart regression hotfix pass)
- Switched franchize ticker and campaign promo links to SPA-safe `next/link` for internal routes while keeping external links in new tab mode.
- Restyled promo/ad cards to colorful gradients (instead of black slabs) to match storefront campaign look-and-feel.
- Unified group rail source so subpages and catalog share one category/group list baseline.
- Added explicit `+ В корзину` inline CTA on catalog cards and stabilized cart row keys by `lineId` for option-specific lines.


### 2026-02-22 — T35 correction pass (groups rail moved into header on all franchize pages)
- Moved groups/category balloon rail inside `CrewHeader` block (single sticky header container), instead of detached strip below header.
- Added `groupLinks` prop to `CrewHeader` and passed item-derived category links from all franchize routes (`catalog/about/contacts/cart/order/rental`) so rail stays consistent everywhere.
- Kept catalog intersection observer highlight logic on main page while preserving fallback groups on subpages.
- Re-ran targeted lint and refreshed `/franchize/vip-bike` screenshot evidence after correction.

### 2026-02-22 — T36-T44 operator hotfix closeout
- Added and completed nine fix tasks from operator screenshot checklist (scrollbar, promo ticker behavior, link taps, back links, cart add path, metadata persistence, seed color update, compact header, shell route override).
- Added reusable click-smoke skill `skills/franchize-click-smoke/SKILL.md` for future mobile tap regressions.
- Captured fresh mobile screenshot evidence on `/franchize/vip-bike` after patch set.

### 2026-02-23 — T45 completion (cart + link reliability sweep)
- Closed operator regression batch for franchize runtime: fixed modal `Добавить` handler reliability so cart count updates consistently after item modal action.
- Hardened Supabase cart persistence flow (`users.metadata.settings.franchizeCart`) via a settings-merge style update path that reads current metadata and writes merged cart payload per slug.
- Added compatibility route `/franchize/[slug]/rentals` -> `/rentals?slug=<slug>` to eliminate menu 404 for “My rents”.
- Normalized social footer links to auto-prepend `https://` for common short-domain entries (`t.me`, `vk.com`, `instagram.com`, etc.) so links open instead of routing as broken relative paths.
- Next beat: run one consolidated smoke pass with screenshot proof and capture edge-cases for malformed custom links.


### 2026-02-23 — T46 completion (auction tick persistence + franchize rentals shell)
- Reworked T45 follow-up per operator feedback: social links were already OK, so focus shifted to broken local footer links and franchize-native rentals route.
- Added selectable `Аукцион / тик` option in item modal, persisted together with cart line options in `users.metadata.settings.franchizeCart`, and displayed in cart + checkout summaries.
- Replaced temporary `/franchize/[slug]/rentals` redirect with real franchize page that keeps CrewHeader/CrewFooter and renders rentals control center inside franchize shell.
- Restored social link parser behavior (no aggressive auto-normalization), while internal footer menu links now use client-side `Link` for reliable navigation.
- Next beat: add “smart auction apply” assistant that preselects best tick by item category, active campaign priority, and delivery mode.
