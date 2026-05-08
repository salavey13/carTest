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

## 1) Plan modules

- Execution status board: `docs/THE_FRANCHEEZEPLAN_STATUS.MD`
- Historical diary/archive: `docs/THE_FRANCHEEZEPLAN_HISTORY_ARCHIVE.md`
- Visual system + implementation blueprint: `docs/THE_FRANCHEEZEPLAN_BLUEPRINT.md`
- Money micropolish backlog: `docs/FRANCHIZE_MONEY_MICROPOLISH_PLAN.md`

This root file stays intentionally compact so operators and agents can load it quickly in high-frequency loops.

---

## 2) Mini execution diary



### 2026-05-08 — SupaPlan rent strip deep-link review fix

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T14:55:00Z
- `owner`: codex
- `notes`: Addressed Codex review on `?vehicle=` deep-link modal initialization: rent tracking now uses a latest-callback ref, so Telegram auth/user hydration no longer recreates the effect dependency path and cannot reset in-progress modal options or double-log `viewed` for the same vehicle.
- `next_step`: Keep the live-data mobile smoke as the final verification gate before merge.
- `risks`: The deep-link initializer intentionally runs only from URL/items/auction option changes; user identity changes update the tracking ref but do not reinitialize the modal.


### 2026-05-08 — SupaPlan rent strip self-review polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T14:45:00Z
- `owner`: codex
- `notes`: Self-reviewed task `558d6b85-3f4a-48b5-ad4d-98b92746991e`: removed a type-only dependency on the server-action barrel from the shared strip helper, made malformed/missing availability labels fall back safely, prevented duplicate `viewed` tracking for `?vehicle=` modal auto-open rerenders, and aligned sale-card CTA text with the required reserve wording.
- `next_step`: Review PR visually in an environment with live `vip-bike` catalog rows, then merge so SupaPlan can close R2.
- `risks`: Local visual smoke remains data-limited when Supabase fetch fails; production/preview smoke should be performed with real crew catalog data.


### 2026-05-08 — SupaPlan rent card strip task 558d6b85

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T14:30:00Z
- `owner`: codex
- `notes`: Added the rental decision strip to franchize catalog cards and item modal: today availability, nearest start window, pickup hint, deposit/price teaser, and dominant “Hold this bike / Забронировать байк” CTA. Wired `intent_type='rent'` with `viewed` and `configured` stages for modal open and CTA taps.
- `next_step`: Apply the rent-intent constraint migration, then smoke `/franchize/vip-bike` on mobile viewport with real availability rows.
- `risks`: The nearest window uses item specs or crew working hours when explicit rental windows are absent; unknown availability falls back to “Уточним в Telegram” rather than blocking render.


### 2026-05-08 — FRZ-MONEY-R4 prebuy mini-flow

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T03:20:00Z
- `owner`: codex
- `notes`: Implemented SupaPlan task `6c5623ac-4e8a-4499-9bef-b062887a9feb`: sale bike pages now compare buy-now, rent-before-buy, test-drive, trade-in, and finance paths; each CTA records an R1 ledger intent with price, condition, checked status, availability, selected option, and source route metadata. Added minimal trade-in fields, a finance monthly estimate with operator-confirmed-terms disclaimer, and Telegram-first continuation copy. Self-review tightened two edge cases: trade-in's own contact field now satisfies non-Telegram continuation, and explicit lead CTAs now surface failed ledger writes instead of showing false success. Also hardened the shared bike loading variant with CSS keyframe fallbacks so motion does not freeze on first paint.
- `next_step`: Merge the R4 PR, apply the prebuy intent migration, then smoke `/franchize/vip-bike/market/<bike_id>/buy` in Telegram WebApp and regular browser.
- `risks`: Finance estimate is intentionally approximate; exact terms remain operator-confirmed. Non-Telegram users must provide phone/@handle before non-buy-now lead capture.

### 2026-05-08 — Franchize intent link review fix

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T02:22:00Z
- `owner`: codex
- `notes`: Addressed Codex review on the intent-link tracker: `tel:`/`mailto:` links now keep native click activation and do not wait on the tracking promise, while regular http(s) same-tab exits still get the short capped tracking wait. SupaPlan task `92bdb264-a626-450a-93b2-6eca5021711a` moved through `claimed -> running -> ready_for_pr` via `scripts/supaplan-skill.mjs`.
- `next_step`: Merge the intent ledger PR, then let the merge automation mark the task done.
- `risks`: External contact links still keep tracking non-blocking to protect tap latency; task status and claim-row verification were completed for the operator-specified SupaPlan task.


### 2026-05-08 — Franchize intent ledger self-review hardening

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T02:12:00Z
- `owner`: codex
- `notes`: Self-reviewed the first intent-ledger slice and hardened two edge cases: metadata sanitization no longer lets non-JSON values throw during validation, and navigation-prone contact/cart/prebuy tracking now keeps the intent write at the checkpoint instead of always fire-and-forget. Also audited client modules for direct service-role imports.
- `next_step`: Next SupaPlan money tasks can build on this ledger by reading `slug + urgency_score + updated_at` and adding recovery/operator UI without touching client-side Supabase admin paths.
- `risks`: External contact links still cap tracking wait time to protect tap latency; this intentionally favors UX over guaranteed analytics writes for low-criticality clicks.


### 2026-05-08 — Franchize intent ledger foundation

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T02:05:00Z
- `owner`: codex
- `notes`: Added the server-only `franchize_intents` ledger migration with RLS/no direct anon-auth writes, a validated server upsert action, and first signal integrations for cart checkout start, invoice hold/failure, paid franchize orders, contact/map/address clicks, test-ride reserve clicks, and prebuy add-to-cart actions.
- `next_step`: Apply the migration in Supabase and wire operator dashboards/recovery automations to the highest-urgency `vip-bike` rows.
- `risks`: Click tracking is fire-and-forget so conversion UX is not blocked by network/Supabase failures; production recovery depends on the migration being applied before traffic analysis.


### 2026-05-08 — Franchize early theme loading hint

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T00:00:00Z
- `owner`: codex
- `notes`: Addressed the loading frontier with a static `vip-bike` early theme manifest, middleware-provided `franchize_slug_theme` cookie for `/franchize/:slug/*`, and server-only `loading.tsx` theme resolution that falls back to `DEFAULT_FRANCHIZE_THEME` without Supabase/client imports.
- `next_step`: Smoke `/franchize/vip-bike` in preview to confirm first-paint skeleton keeps the VIP Bike dark Pepperolli palette on cold navigations.
- `risks`: Early exact palette is limited to crews present in the static manifest; new crew palettes still need an additive manifest entry or a future safe theme-token cookie write.

### 2026-05-08 — Franchize money micropolish backlog shaping

- `status`: active-planning
- `updated_at`: 2026-05-08T00:00:00Z
- `owner`: codex
- `notes`: Converted the operator money-printing direction into a sequenced micropolish plan and wrote seven open SupaPlan tasks (`92bdb264-a626-450a-93b2-6eca5021711a`, `558d6b85-3f4a-48b5-ad4d-98b92746991e`, `a55a75bb-2e1d-4685-b26b-53596a95b594`, `6c5623ac-4e8a-4499-9bef-b062887a9feb`, `cc5ec5ef-e6bb-446b-8d91-a12002fbb57d`, `5993dab3-dd18-49dc-8138-52862bc32edb`, `734d604d-e96f-4b56-830f-977e3d3cfa07`). Exact first-paint crew theme hints are now addressed for `vip-bike` via the no-fetch loading path, while the revenue frontier is an intent ledger feeding ride-today availability, hold deposits, prebuy/test-ride/trade-in flows, abandoned checkout recovery, operator closing, and AI closer suggestions. Detailed plan lives in `docs/FRANCHIZE_MONEY_MICROPOLISH_PLAN.md`.
- `next_step`: Start R1 Franchize Intent Ledger before parallelizing R2/R4/R5 UI and recovery slices.
- `risks`: SupaPlan has existing open franchize tasks; newly shaped money tasks should be claimed one-by-one and not used to move unrelated older tasks to ready_for_pr.

### 2026-05-08 — Franchize server-rendered loading/error correction

- `status`: ready_for_pr
- `updated_at`: 2026-05-08T00:00:00Z
- `owner`: codex
- `notes`: Corrected the previous client hydration fallback and then self-reviewed for loading best practice: removed the shared fallback component, kept loading markup inside the route loading files, removed Supabase/page-data fetches from `loading.tsx` so the fallback can appear immediately, and removed retry/contact/Telegram action clusters from loading/error states. Error boundaries remain client files because Next.js requires `error.tsx` to be client-side, but they render only safe fallback copy, skeleton cards, a subdued digest line, and a catalog link.
- `next_step`: Mobile-smoke `/franchize/vip-bike` loading and a forced error state to confirm instant crew-themed shell, no action-button clutter, reduced-motion-safe shimmer, and safe digest behavior.
- `risks`: Exact first-paint crew palette is now available for known static-manifest crews such as `vip-bike`; unknown crews intentionally fall back to the default theme until added to the manifest.


### 2026-05-07 — Franchize palette variable contrast pass

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T23:55:00Z
- `owner`: codex
- `notes`: Refactored community, sales, onboarding, electro-enduro, CrewHeader, and CrewFooter away from hard-coded white/black surface combinations toward crew palette CSS variables for primary/secondary text, base/card surfaces, soft borders, and accent button foregrounds. Self-review tightened alpha handling for non-hex CSS colors, moved accent foreground selection to palette candidates, and reused the shared contrast helper in the reusable page shell. Verified contrast math for the `vip-bike` dark palette and the default light/custom palette.
- `next_step`: Run browser screenshot QA after Playwright host libraries are available in the runner.
- `risks`: Local screenshot capture was blocked by missing Playwright system libraries; HTTP smoke and static checks covered this pass.

- 2026-05-04 — Added support for metadata-driven franchize header logo routing via `header.logoHref` with default fallback to `/franchize/{slug}`; seeded `vip-bike` to land on `/vipbikerental` instead of catalog. Next step: expose `header.logoHref` in admin configurator UI for non-SQL operators.


### 2026-05-07 — Franchize about page self-review polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T22:45:00Z
- `owner`: codex-review
- `notes`: Self-reviewed the structured `/franchize/[slug]/about` slice: normalized theme usage toward shell CSS variables, added zero-catalog trust-strip copy, moved repeated trust card rendering into typed data, and routed the sales/configurator CTA through the sales hub so users see the full purchase/configurator funnel. Floating cart remains intentionally omitted from this intent page to avoid mobile CTA overlap.
- `next_step`: Browser-smoke `/franchize/vip-bike/about` in a runtime where the operator wants visual QA; screenshot capture intentionally skipped in this pass per operator instruction.
- `risks`: Live trust-strip values still depend on crew/catalog hydration; sparse metadata fallback is designed to keep the page useful when Supabase data is incomplete.

### 2026-05-07 — Franchize intent rail navigation

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Added optional CrewHeader section intent links for non-catalog franchize routes while preserving catalog category rail behavior and SPA Next.js Link navigation. Applied shared intent rails to about, contacts, sales, onboarding, community, MapRiders, and rentals.
- `next_step`: Visual-smoke `/franchize/vip-bike/about`, `/contacts`, `/sales`, `/onboarding`, `/community`, `/map-riders`, and `/rentals` on mobile width to confirm active pill visibility/touch comfort.
- `risks`: Runtime screenshot not captured in this non-browser code pass; route hydration still depends on crew/catalog data availability.

### 2026-05-07 — VS same-propulsion micropolish

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Tightened franchize bike VS comparisons so electric bikes compare only with electric bikes, gas bikes compare only with gas bikes, and both sale-buy + rental modal surfaces explain the active comparison class. Self-review moved propulsion inference into a focused lib with score-based structured-spec detection and regression coverage for gas bikes that mention a support battery.
- `next_step`: Smoke `/franchize/vip-bike` catalog modal and `/franchize/vip-bike/market/<bike_id>/buy` with mixed electric/gas catalog data.
- `risks`: Propulsion is inferred from existing free-text category/spec metadata until catalog rows get a structured propulsion field.


### 2026-05-07 — Franchize reusable content shell

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T21:22:00Z
- `owner`: codex
- `notes`: Added reusable `FranchizePageShell` + `FranchizeHero` components and applied the themed content hero/card shell to about, contacts, rentals, rental detail, and sale-buy franchize pages. Self-review tightened the shell toward agency polish: contrast-safe accent CTA text, richer badge/card treatment, sanitized sale anchors, and removal of the duplicate sale-page H1.
- `next_step`: Visual-smoke `/franchize/vip-bike/about`, `/contacts`, `/rentals`, a rental card, and a sale-buy route in a browser-capable environment; next polish task should focus route-specific metadata coverage.
- `risks`: Local screenshot capture remains blocked by missing Playwright host libraries; curl smoke reached the about route after fallback crew loading.


### 2026-05-07 — Franchize route metadata coverage

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Added route-specific `generateMetadata` coverage for franchize community, electro-enduro, configurator, cart, profile, admin, MapRiders, sale-buy, order, rental, and review routes via the shared `[slug]/metadata.ts` helper with canonical paths, OpenGraph/Twitter-compatible social cards, VK meta hints, and route-aware item imagery when available; self-review tightened sale-buy title/description to include the selected bike when hydrated.
- `next_step`: Production-smoke `/franchize/vip-bike/community`, `/electro-enduro`, `/configurator`, `/cart`, `/profile`, `/admin`, `/map-riders`, and one dynamic buy/order/rental/review route to confirm crawlers/VK/Telegram receive expected tags.
- `risks`: Dynamic order/rental/review metadata intentionally uses crew/logo fallback imagery unless the page has an item-specific image source in route params or hydrated catalog data.

## 3) Active ad-hoc task — `/vipbikerental` interactive landing

- status: `ready_for_pr`
- updated_at: `2026-05-07T00:00:00Z`
- owner: `codex`
- notes: `Polished /vipbikerental copy density, removed the duplicated partner-link audit block, improved hero-tab contrast over video, moved VIP Bike catalog hydration behind client-side skeleton cards, russified the newest loader/landing labels, brightened the MapRiders preview map, and replaced the invalid FaShieldAlt marker with FaShieldCat.`
- next_step: `Production-smoke /vipbikerental and /franchize/vip-bike with real catalog latency; confirm skeleton-to-card transition on mobile Telegram WebApp.`
- risks: `Catalog API still depends on server Supabase env; production QA should verify live item hydration and fallback behavior when Supabase is slow.`


### 2026-05-06 — SupaPlan franchize maintenance pair

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:30:00Z
- `owner`: codex-frz-couple-01
- `notes`: Implemented `FIX-STARTPARAM` stale-ref reset for repeated Telegram deep links and started `RENT-P3.2` with Vitest coverage for franchize navigation/theme helpers; self-review tightened duplicate-processing/stale-result guards and category anchor normalization.
- `next_step`: Add mocked Supabase coverage for server action validators after this PR lands.
- `risks`: Server-action integration tests remain future work because this slice intentionally focused on low-conflict pure helper coverage.


### 2026-05-06 — SupaPlan franchize maintenance pair

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:30:00Z
- `owner`: codex-frz-couple-01
- `notes`: Implemented `FIX-STARTPARAM` stale-ref reset for repeated Telegram deep links and started `RENT-P3.2` with Vitest coverage for franchize navigation/theme helpers; self-review tightened duplicate-processing guards and category anchor normalization.
- `next_step`: Add mocked Supabase coverage for server action validators after this PR lands.
- `risks`: Server-action integration tests remain future work because this slice intentionally focused on low-conflict pure helper coverage.


### 2026-05-07 — MapRiders drawer empty-state copy

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Replaced sad dead-copy fallbacks in the mobile MapRiders drawer with dynamic history/meetup summary text when parent state already knows about completed rides or active meetup points, plus a short genuinely-empty fallback.
- `next_step`: Preview-smoke `/franchize/vip-bike/map-riders` once Playwright host dependencies are available.
- `risks`: Local screenshot capture was blocked by missing browser shared libraries in the runner; runtime visual QA still needs a browser-capable environment.

### 2026-05-07 — MapRiders idle tick + dead-stat polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Kept idle eviction ticks referentially stable when no live rider changes are needed, split static map point sanitization away from dynamic rider/session/meetup points, softened just-started ride overlays/duration formatting for zero-distance and zero-speed states, added History-tab GPS warmup hints for active zero-distance rides, clarified empty replay warmup, and made `/vipbikerental` MapRiders preview honest when live ride data has not arrived yet.
- `next_step`: Preview-smoke `/franchize/vip-bike/map-riders` and `/vipbikerental` with empty/just-started MapRiders data to confirm the surfaces explain GPS/data warmup without visual regressions or render noise.
- `risks`: Runtime render-count validation still needs a browser/profiler session; this pass used code review and type/lint checks.

## 4) Mini execution diary addendum

- 2026-05-07 — MapRiders idle/perceived-live polish: eviction ticks now clone the rider map only when stale/evicted status actually changes, static map points are memoized separately from moving riders/routes/meetups, the live overlay and drawer explain zero-distance GPS warmup, replay empty-state copy no longer looks broken, and `/vipbikerental` avoids fake/latest-ride dead stats while live data is warming up. Next step: profiler + mobile drawer/landing smoke on `/franchize/vip-bike/map-riders` and `/vipbikerental`.
- 2026-05-07 — MapRiders drawer UX copy pass: parent state now prepares live-aware History/Meetups fallback copy, the drawer consumes those strings instead of hardcoded “go do it first” text, and genuinely empty tabs use a shorter playful fallback. Screenshot capture remains blocked until Playwright host libraries are installed.
- 2026-05-07 — UX cleanup for `/vipbikerental`: removed literal explanatory copy and duplicated partner-link section, changed active hero tabs to light-on-tinted styling, added a route-level VIP Bike loader plus client-side catalog skeleton hydration, and tuned the global bike loader wheel/wind animation. Next step: mobile smoke with live Supabase catalog latency.
- 2026-05-07 — Self-review polish for the UX cleanup: reduced new English labels in loader/landing/onboarding surfaces, brightened the MapRiders preview into a lighter VibeMap-like card, and replaced the invalid `FaShieldAlt` VCR token with `FaShieldCat` for the production-history easter egg. Next step: mobile visual smoke once browser libraries are available.
- 2026-05-07 — Franchize-wide text polish: reduced fresh English labels in create/admin/catalog/order/rental-document surfaces, russified launch/order helper chips, and kept technical field names only where operators need exact JSON/DB keys. Next step: spot-check `/franchize/vip-bike`, `/franchize/create`, and rental document flows in preview.
- 2026-05-06 — Started `/vipbikerental` interactive enhancement stream from `app/vipbikerental/todo.md`; shipped the first Hero tabs slice with animated mode preview and MapRiders overview metrics. Next step: replace fallback rent/buy preview cards with real catalog item data.
- 2026-05-06 — Continued `/vipbikerental` stream: split page into server wrapper + client runtime, hydrated real `vip-bike` catalog items, upgraded Hero rent/buy cards to catalog data, and replaced static Electro-Enduro cards with horizontal slider + quick preview configurator. Next step: MapRiders mini-map/social proof preview.
- 2026-05-06 — Self-reviewed `/vipbikerental` refactor by comparing old/new section headings, then shipped lightweight MapRiders preview: static glowing route map, live rider dots, meetup labels, latest ride stats and SVG speed sparkline. Next step: interactive newbie stepper.
- 2026-05-06 — Finalized `/vipbikerental` PR readiness review: updated TODO with finished/not-finished checklist, confirmed no important visible sections were intentionally removed, and moved active status to `ready_for_pr`. Next PR should begin with the interactive newbie stepper.
- 2026-05-06 — Final polish iteration: implemented `StepsProgress` for the newbie flow and reworded `/app/vipbikerental/todo.md` so completed scope is clearly closed while remaining quick-action/technical items are future backlog, not an automatic trigger.
- 2026-05-06 — Continued explicit `/vipbikerental` TODO work: replaced static quick-action link cards with `RentalQuickActionHub`, including latest rental readiness, live rider counters and a quick bike chooser modal hydrated from catalog/fallback items. Next step: technical cleanup backlog or production QA with real Supabase rental/map data.
- 2026-05-06 — Continued cleanup after quick actions: extracted shared sale config/color parsing into `app/franchize/lib/sale-config.ts` and reused it in both the sale buy page and `/vipbikerental` Electro-Enduro quick preview, removing duplicated package/color constants. Next step: OSRM/route loading cleanup or production QA.

- 2026-05-06 — Responded to operator rating request for `/vipbikerental`: added a visible ConversionPilot scorecard/decision dock after the hero showcase, deriving score/next action from catalog and MapRiders data, plus replaced the stale 2025 promo code with evergreen `VIPSTART`. Next step: visual smoke in local/preview runtime.
- 2026-05-06 — Self-reviewed the ConversionPilot slice: reduced the audit feeling, made the score compact, rewrote the section as a customer-facing route cockpit, added route aria labels, fixed rider pluralization, and kept the recommended bike CTA data-driven. Next step: preview QA with production catalog/map data.
## 3) Active implementation slices


### 2026-05-06 — Franchize accessibility labels for MapRiders/configurator

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:25:00Z
- `owner`: codex
- `notes`: Added screen-reader labels/aria names for MapRiders ride controls, privacy dropdowns, meetup drawer inputs, replay scrubber, and configurator option controls. SupaPlan task `dc8f8c2b-2234-4c0a-6789-ccc000ccf789`.
- `next_step`: Verify `vip-bike` configurator and `/franchize/vip-bike/map-riders` with a browser accessibility audit when a local runtime is available.
- `risks`: Visual layout should be unchanged because labels are hidden where needed; runtime audit still depends on app boot and route data.

### 2026-05-06 — Sale buy page VS + test-drive reservation

- `status`: done
- `updated_at`: 2026-05-06T00:00:00Z
- `owner`: codex
- `notes`: Implemented `/franchize/[slug]/market/[bike_id]/buy` inline VS comparison and switched sale XTR primary CTA to a small Telegram test-drive reservation invoice.
- `next_step`: Smoke-test `vip-bike` buy page in Telegram WebApp with a real Telegram user id and confirm invoice delivery UX.
- `risks`: Local build may still surface unrelated repository warnings; invoice delivery requires configured Telegram Bot/API secrets.

### 2026-05-06 — Sale buy polish follow-up

- `status`: done
- `updated_at`: 2026-05-06T00:00:00Z
- `owner`: codex
- `notes`: Aligned sale reservation CTA copy with the same 100-500 XTR formula used by backend invoices, centralized VS spec aliases, and split reservation/cart CTA state so secondary cart actions do not display invoice success.
- `next_step`: Verify production `vip-bike` sale bike with real catalog specs and Telegram WebApp invoice delivery.
- `risks`: Visual/live invoice verification still depends on reachable Supabase and Telegram bot credentials.
- 2026-05-06 — SupaPlan franchize maintenance pair: fixed repeated `startapp` handling in `useStartParamRouter` and added a test-coverage foundation for franchize helper libraries. Next step: mocked Supabase action validation tests.
- 2026-05-06 — Self-reviewed SupaPlan franchize maintenance pair: replaced the boolean start-param guard with active/last-handled param refs to prevent duplicate processing during pathname/clear races, removed dead sale metadata, and normalized category anchors before tests codify the behavior.
- 2026-05-06 — Final code review polish for SupaPlan franchize maintenance: added a run-id freshness guard so slow async start-param resolutions cannot navigate after a newer deep link wins.

- 2026-05-06 — Claimed SupaPlan franchize accessibility task `dc8f8c2b-2234-4c0a-6789-ccc000ccf789`; labeled MapRiders dropdown/input controls and configurator option controls for screen readers. Next step: PR review + runtime accessibility smoke on `vip-bike`.
### 2026-05-06 — Telegram auth unmount guard

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:25:00Z
- `owner`: codex
- `notes`: Claimed SupaPlan `CQ-TELEGRAM-GUARD` and moved `useTelegram` async initialization from a local boolean to a lifecycle ref guard so delayed auth results do not update state after unmount.
- `next_step`: Merge PR, then verify Telegram WebApp auth/navigation on `vip-bike` under slow network throttling.
- `risks`: Runtime Telegram validation still depends on configured bot/API env and a real WebApp launch context.


### 2026-05-06 — SupaPlan RENT-P2.2 rental reviews

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:20:00Z
- `owner`: codex-franchize-1778108121
- `supaplan_task`: 88d44bfc-1f3b-4004-b5e2-d123479d7d39
- `notes`: Added rental review schema, completed-rental review form route, catalog card/modal review display, Top rated filter, crew rating blocks, Telegram review deep link, and admin soft-hide moderation panel.
- `next_step`: Apply migration in Supabase, complete a real return_confirmed rental, submit a review through Telegram WebApp, and verify public catalog/admin moderation with live data.
- `risks`: Review table must be migrated before runtime review queries can hydrate; local smoke is limited by unavailable production Supabase data.

### 2026-05-06 — RENT-P2.2 self-review polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:18:00Z
- `owner`: codex-franchize-1778108121
- `supaplan_task`: 88d44bfc-1f3b-4004-b5e2-d123479d7d39
- `notes`: Self-review tightened the review flow: notification slug lookup no longer depends on nested PostgREST embeds, review form disables submission for non-renter Telegram profiles before server call, and RLS insert checks now verify the bike belongs to the submitted crew.
- `next_step`: Merge after applying the migration in the target Supabase project and smoke-test one completed rental review from the renter account.
- `risks`: Existing runtime still relies on Telegram WebApp identity hydration; production smoke should verify the renter user id matches stored rental user_id.

### 2026-05-06 — RENT-P2.2 Codex review fixes

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:32:00Z
- `owner`: codex
- `supaplan_task`: 88d44bfc-1f3b-4004-b5e2-d123479d7d39
- `notes`: Fixed automated review findings: review submission now verifies Telegram initData server-side instead of trusting caller-provided userId, and hidden reviews cannot be restored by renter upsert/edit.
- `next_step`: Production smoke with a real Telegram WebApp review link after migration apply.
- `risks`: TEMP_BYPASS_TG_AUTH_VALIDATION must remain disabled in production for the server-side initData check to be authoritative.
### 2026-05-06 — FRZ-R5 pilot KPI scoreboard

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:55:00Z
- `owner`: codex-cli
- `notes`: Added a compact `/nexus` KPI scoreboard for the VIP Bike franchise funnel with pilot conversion/SLA/partner signals and lead-to-paid-booking stages. SupaPlan task `913e8a73-46f6-4c22-8278-c1b5aabe661e`.
- `next_step`: Wire the same KPI cards to real order/lead events after event analytics storage is finalized.
- `risks`: Current numbers are explicitly pilot targets, not live production analytics.

### 2026-05-06 — CQ franchize config/theme hardening

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:15:00Z
- `owner`: codex
- `notes`: Executed SupaPlan CQ-03 (`9513da34-2e8b-445e-a43a-09a22c8e5bc3`) and CQ-04 (`43499f79-1513-47b3-9b2c-3a85fdb30653`): extracted franchise defaults into shared config constants and moved crew theme resolution behind null-safe metadata guards.
- `next_step`: Merge PR, then use the shared config constants for future create-form cleanup slices.
- `risks`: Full repository typecheck is still blocked by pre-existing syntax errors outside this slice (`data/questions.ts`, `supabase/functions/arbitrage-scan-instance/index.ts`).

- 2026-05-06 — CQ franchize config/theme hardening: centralized hardcoded default palette/map/menu/promo/contract values and added malformed theme metadata coverage so bad crew records fall back to defaults instead of crashing.
- 2026-05-06 — Self-review polish for CQ config/theme hardening: removed the type-only cycle between shared config and server actions, kept `FranchizeTheme` exported through the old action module contract, and made array-shaped crew metadata reads defensive for menu/footer/catalog/order buckets.
### 2026-05-06 — Storefront a11y + XTR orphan invoice cleanup

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:20:00Z
- `owner`: codex
- `notes`: Completed SupaPlan `RENT-P3.1` and `FIX-ORPHAN-INVOICE`: public storefront controls now expose stronger labels/current/pressed states, overlay focus containment/return was tightened in self-review, and failed Telegram XTR sends clean up newly-created pending franchize invoices.
- `next_step`: Merge PR, then run browser accessibility smoke on `/franchize/vip-bike` and a Telegram invoice failure-path smoke with test credentials.
- `risks`: Visual a11y smoke depends on a bootable local/prod runtime; invoice delivery/failure verification depends on Telegram bot credentials.

### 2026-05-06 — RENT-P1.2 promo validation engine

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T00:00:00Z
- `owner`: codex-cli
- `supaplan_task`: c272370f-4cbe-4063-83c8-1120c3494699
- `notes`: Replaced checkout promo UI stub with Supabase-backed promo validation, active-window checks, discount extraction, checkout blocker handling, and server-side total revalidation before order notification/XTR invoice creation.
- `next_step`: Smoke-test `/franchize/vip-bike/order/<id>` with active `NEURO2026` promo in a real cart and confirm Telegram invoice metadata shows the discounted total.
- `risks`: Live validation depends on crew metadata containing active `catalog.promoBanners` and `order.allowPromo` in Supabase.
- 2026-05-07 — RENT-P1.2 self-review polish: made promo resolution canonical across notification, direct invoice, and checkout paths; added structured discount fields/minimum subtotal support; moved checkout cooldown after successful promo validation; and invalidated applied promos when cart/extras totals change.
### 2026-05-06 — FRZ-R6 VIP BIKE company + service hub

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T23:58:00Z
- `owner`: codex
- `supaplan_task`: 4de0a224-e88d-4bf7-909f-f27e96a2d5e1
- `notes`: Re-checked the stale ready_for_pr task with no visible PR and implemented the missing public-facing company/service hub on `/vipbikerental`: one section now explains VIP BIKE as rental + service + rider community, links to catalog, service contact and MapRiders, and keeps the existing service cards/FAQ as supporting detail.
- `next_step`: Production-smoke `/vipbikerental` with real `vip-bike` catalog data and verify service CTA destination with operator.
- `risks`: Service CTA currently routes to the existing Telegram operator contact until a dedicated service booking route exists.

### 2026-05-07 — VIP Bike QA rhythm + configurator style containment

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T07:20:00Z
- `owner`: codex
- `supaplan_task`: d3c8f9f2-3234-4c3a-def0-33330003cdef
- `notes`: Addressed operator QA notes across `/vipbikerental`, `/franchize/vip-bike/configurator`, and `/franchize/vip-bike/electro-enduro`: tightened the hero-to-showcase rhythm, scoped ConfiguratorClient CSS variables away from `:root`, added resilient bike image presentation/fallbacks, removed the global franchize footer from the configurator page, compacted the shared footer elsewhere, and added a VipBike fallback catalog for Electro-Enduro when live crew hydration is empty.
- `next_step`: Browser-smoke the three routes against production data/preview and verify the Electro-Enduro fallback notice disappears when the live `vip-bike` crew/items hydrate correctly.
- `risks`: Electro-Enduro fallback prevents an empty showroom but does not replace the need to seed/repair production Supabase crew + catalog rows.

- 2026-05-07 — VIP Bike QA pass: reduced `/vipbikerental` post-hero depth, contained configurator styles, made configurator bike imagery readable with fallback art, removed the mustard footer from the configurator flow, compacted shared footer scale, hardened Electro-Enduro contrast, and added a temporary non-empty VipBike fallback catalog for hydration failures.

### 2026-05-07 — Telegram back + VIP Bike MapRiders triage

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Fixed Telegram WebApp back handling to use an internal SPA history stack instead of `router.back()`, corrected Seqvens Zero code identifiers to `seqvens-zero` while intentionally preserving existing `carpix/seqvenz-zero/*` storage paths, and tightened MapRiders QA to smoke the requested `vip-bike` slug APIs with JSON success checks.
- `next_step`: Field-test Telegram BackButton in the real bot WebApp and collect the exact MapRiders failing action if testers still report “doesn't work”.
- `risks`: CLI smoke confirms the route/APIs are alive, but two-phone live GPS and Telegram BackButton behavior still need real Telegram WebApp device verification.

### 2026-05-07 — MapRiders lint + mobile UX hardening

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Bulk lint pass normalized the legacy warning policy and fixed remaining blocking lint findings, then MapRiders review fixed mobile long-press duplicate/click suppression, coalesced fallback realtime snapshot refreshes, synced FAB privacy/start payloads with the main rider panel, and added clearer live/stale/queue cockpit UI hints for `vip-bike` riders.
- `next_step`: Smoke `/franchize/vip-bike/map-riders` in a real Telegram WebApp with two devices to verify long-press meetup creation and privacy-preserving geoshare start from both CTA surfaces.
- `risks`: Local CI can validate lint/build/API shape, but true GPS accuracy and Telegram permission UX still require device testing.

- 2026-05-07 — MapRiders review pass: reduced realtime overfetch pressure, made mobile long-press meetup selection safer, aligned floating and panel start actions, and surfaced live/stale/queue state directly in the map cockpit.

### 2026-05-07 — FRZ-R9 + UX-03 + RENT-P1.1 MapRiders visible value slice

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `notes`: Executed the explicit operator scope: MapRiders now has self-hosted inline SVG initial avatars instead of external placeholder-style marker art, a Russian 3-step beginner quiz that configures ride name/bike/privacy/auto-stop before sharing, a new `/franchize/[slug]/community` city events + partners hub, and `TEMP_BYPASS_TG_AUTH_VALIDATION` is allowed only on preview request URLs/headers containing `salavey13`.
- `next_step`: Browser-smoke `/franchize/vip-bike/map-riders` and `/franchize/vip-bike/community` on a Vercel preview URL that contains `salavey13`.
- `risks`: Community events/partners are curated starter content until real operator calendar/partner data is connected; auth bypass remains explicitly env-gated and preview-host-gated.

### 2026-05-07 — supaplan_task:dd9a9d3c-3234-4d1b-7890-ddd000ddf890 Telegram auth + smart mockuser fallback

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex-tg-auth-fallback
- `supaplan_task`: dd9a9d3c-3234-4d1b-7890-ddd000ddf890
- `notes`: Claimed the SupaPlan security task and corrected Telegram WebApp HMAC derivation (`WebAppData` as the HMAC key, bot token as message) in both auth validators. Mock user activation is now explicitly gated: allowed only when `NEXT_PUBLIC_USE_MOCK_USER=true` and the client URL contains `salavey13` or `NEXT_PUBLIC_IS_PREVIEW=true`; otherwise production shows a strict Telegram-open/auth error. MapRiders write headers can request the mock app JWT only in that same allowed preview context.
- `next_step`: Verify on a real Telegram WebApp session and a Vercel preview URL containing `salavey13`; keep `TEMP_BYPASS_TG_AUTH_VALIDATION` unset on real production domains.
- `risks`: Local runner cannot provide real Telegram signed initData; production verification needs bot-generated `initData` and current `TELEGRAM_BOT_TOKEN`.

### 2026-05-07 — SupaPlan four-task self-review + Telegram auth test harness

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex-review
- `supaplan_tasks`: FRZ-R9=`74fcc094-6990-4657-bf13-91460a291e32`, RENT-P1.1=`309a8777-6bc0-4d9d-aa8a-b6a9ec11b730`, UX-03=`9db00978-92dd-48a3-8913-d6972243dfbd`, SEC-BYPASS-CHECK=`dd9a9d3c-3234-4d1b-7890-ddd000ddf890`
- `notes`: Self-review found the Telegram HMAC fix should not remain duplicated, so validation was extracted to `lib/telegram-webapp-auth.ts` with Vitest coverage using an independent Node `createHmac` oracle. RENT-P1.1 was tightened from a MapRiders-only quiz into checkout gating too: `OrderPageClient` now blocks confirmation until the 3-question beginner safety quiz is passed and persists the pass in browser storage per slug/user.
- `next_step`: Real-device Telegram WebApp smoke with a current signed `initData`, plus production preview smoke on a `salavey13` Vercel URL with `NEXT_PUBLIC_USE_MOCK_USER=true`.
- `risks`: The checkout safety completion is browser-local for this slice, not yet persisted to `users.metadata.quiz_completed_at`; follow-up DB persistence can make it cross-device.

### 2026-05-07 — Telegram bypass review fix + VIP Bike seed/navigation polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex-review
- `notes`: Addressed Codex review P1: auth bypass no longer reads caller-controlled URL/query/origin/referer; it now depends only on server-known Vercel deployment metadata (`VERCEL_ENV=preview` + deployment URL containing `salavey13`) or exact `TELEGRAM_AUTH_BYPASS_ALLOWED_HOSTS`. Added regression tests for forged `?salavey13` production URLs, live-like Telegram initData recreation, and preview/allowlist behavior. Updated VIP Bike seed SQL header/footer with `/franchize/{slug}/community`, and replaced `/vipbikerental` hardcoded Стригинский address with `ул. Комсомольская 2`.
- `next_step`: Apply updated `docs/sql/vip-bike-franchize-hydration.sql` to staging/prod Supabase after merge, then smoke header/footer navigation.
- `risks`: Bypass now requires Vercel preview metadata or explicit allowlist; if a preview runtime lacks `VERCEL_ENV/VERCEL_URL`, set `TELEGRAM_AUTH_BYPASS_ALLOWED_HOSTS` to the exact preview host.

### 2026-05-07 — FRZ-R4 + FRZ-R8 + CQ-01 partner/sales/session slice

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `supaplan_tasks`: `941503e4-9092-4d1f-bc93-3bf3147dbd69`, `b6180fa5-a62e-434b-b4c0-437cf996430e`, `b3950a88-bbd2-4eeb-9db4-b29da8026be8`
- `notes`: Added VIP-bike partner onboarding checklist route, added four-lane sales vertical route for new/electric/used/trade-in intent capture, and extracted duplicated MapRiders session start/stop write logic into `useSessionManager` for the map panel + floating FAB.
- `next_step`: Preview-smoke `/franchize/vip-bike/onboarding`, `/franchize/vip-bike/sales`, and `/franchize/vip-bike/map-riders`; after production data is verified, add onboarding/sales links to default crew menu metadata.
- `risks`: Local checks validate TypeScript/lint shape, but real Telegram GPS/session writes still require device QA with configured runtime secrets.

### 2026-05-07 — FRZ self-review navigation polish

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex-review
- `supaplan_tasks`: `941503e4-9092-4d1f-bc93-3bf3147dbd69`, `b6180fa5-a62e-434b-b4c0-437cf996430e`, `b3950a88-bbd2-4eeb-9db4-b29da8026be8`
- `notes`: Self-review found the new partner onboarding and sales routes were only direct URLs, so the VIP-bike hydration SQL now seeds both routes into header menu links and footer section links.
- `next_step`: Re-apply `docs/sql/vip-bike-franchize-hydration.sql` after merge and smoke `/franchize/vip-bike/onboarding` + `/franchize/vip-bike/sales` from hydrated navigation.
- `risks`: Existing production metadata will not show the new links until the updated seed/hydration SQL is applied.

### 2026-05-07 — SupaPlan franchize UX/perf/type strict trio

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex
- `supaplan_tasks`: `021bb5f2-9183-4733-b911-606cae9eb6d8`, `3905fad7-650a-446f-832d-d9bc848fa691`, `d6f2c2c5-6234-4f6b-0123-66660006f123`
- `notes`: Executed PERF-01, RENT-P3.3, and TS-STRICT together: MapRiders now exposes split state/action contexts for lower-noise consumers, the franchize profile menu has persisted notification opt-in/out controls, and a dedicated franchize TypeScript config/script starts the stricter path without changing the whole repo at once.
- `next_step`: Run preview smoke for `/franchize/vip-bike/map-riders` and the franchize header profile menu with a Telegram-authenticated user.
- `risks`: The new franchize typecheck surfaces existing legacy type debt outside this slice, so follow-up strict cleanup should burn down the current errors before making it merge-blocking.

- 2026-05-07 — SupaPlan trio pass: split MapRiders provider state/actions, added per-slug notification preference persistence in the profile dropdown, and introduced a dedicated franchize TypeScript check command for incremental strictness.

### 2026-05-07 — Self-review fixes for SupaPlan franchize trio

- `status`: ready_for_pr
- `updated_at`: 2026-05-07T00:00:00Z
- `owner`: codex-review
- `supaplan_tasks`: `021bb5f2-9183-4733-b911-606cae9eb6d8`, `3905fad7-650a-446f-832d-d9bc848fa691`, `d6f2c2c5-6234-4f6b-0123-66660006f123`
- `notes`: Self-review fixed the first pass: profile notification prefs now normalize slugs, handle read/write rejections, and protect metadata shape; RiderFAB no longer double-subscribes to MapRiders state; `useSessionManager` uses the split context hooks directly; the franchize typecheck command now exits cleanly for the allowlisted strict slice while summarizing legacy transitive debt.
- `next_step`: Burn down the surfaced transitive TypeScript debt in follow-up slices, then expand `tsconfig.franchize.json` allowlist.
- `risks`: The TypeScript check is intentionally allowlist-gated; it is a gradual guardrail, not yet a full `app/franchize/**` merge blocker.

- 2026-05-07 — Self-reviewed the SupaPlan trio and fixed the main regressions: no knowingly failing typecheck command, safer notification preference IO, normalized metadata keys, and reduced RiderFAB duplicate state subscription.
