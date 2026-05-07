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

This root file stays intentionally compact so operators and agents can load it quickly in high-frequency loops.

---

## 2) Mini execution diary

- 2026-05-04 — Added support for metadata-driven franchize header logo routing via `header.logoHref` with default fallback to `/franchize/{slug}`; seeded `vip-bike` to land on `/vipbikerental` instead of catalog. Next step: expose `header.logoHref` in admin configurator UI for non-SQL operators.

## 3) Active ad-hoc task — `/vipbikerental` interactive landing

- status: `ready_for_pr`
- updated_at: `2026-05-06T23:45:00Z`
- owner: `codex`
- notes: `Self-reviewed and polished ConversionPilot into a more customer-facing route cockpit: score is now a compact operator signal, while the main surface recommends the next bike and three clear rent/buy/group-ride paths with better copy and accessibility labels.`
- next_step: `Create PR and production-smoke /vipbikerental with real vip-bike catalog/map data.`
- risks: `Local runtime can render fallback data when Supabase is unavailable; production QA should verify real vip-bike catalog/map records and active rental states.`


### 2026-05-06 — SupaPlan franchize maintenance pair

- `status`: ready_for_pr
- `updated_at`: 2026-05-06T22:30:00Z
- `owner`: codex-frz-couple-01
- `notes`: Implemented `FIX-STARTPARAM` stale-ref reset for repeated Telegram deep links and started `RENT-P3.2` with Vitest coverage for franchize navigation/theme helpers; self-review tightened duplicate-processing/stale-result guards and category anchor normalization.
- `next_step`: Add mocked Supabase coverage for server action validators after this PR lands.
- `risks`: Server-action integration tests remain future work because this slice intentionally focused on low-conflict pure helper coverage.

## 4) Mini execution diary addendum

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
