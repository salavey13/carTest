# THE_FRANCHEEZEPLAN — history archive

Moved from tail of `docs/THE_FRANCHEEZEPLAN.md` to keep active ledger compact.

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

### T47 — Greenbox/Tesseract collaborative gamelab planning bootstrap (keyword-trigger ad-hoc)
- status: `done`
- updated_at: `2026-03-06T00:00:00Z`
- owner: `codex`
- notes: Operator request mentioned franchize-style structure for greenhouse management; created dedicated cross-team plan doc with scenario-gamedev workflow, tenant page IA, and newbie academy scope.
- next_step: Start G1 from `docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md` (academy MVP).
- risks: Scope is broad; requires disciplined sequential execution and simulator-first boundaries.
- dependencies: T46
- deliverables:
  - `docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md`

### 2026-03-06 — T47 completion (Greenbox/Tesseract plan bootstrap)
- Captured collaborative execution model for Alice + Codex with one shared MD status board.
- Defined page structure for multi-tenant greenbox management, simulator gameplay, alerts, academy, and replay flows.
- Locked simulator-first roadmap and deferred real hardware switching behind a future adapter contract.

### 2026-03-06 — T47 refinement pass (RU-first Greenbox collaboration + Alice pitch)
- Added mandatory RU-first language guidance directly into `docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md` for all Greenbox/Tesseract-triggered tasks.
- Added dedicated operator-ready Russian pitch file `docs/GREENBOX_ALICE_PITCH_RU.md` with clear onboarding CTA for Alice (`get me up to speed on greenbox plan`).
- Preserved simulator-first execution contract and kept implementation sequencing unchanged (next step remains G1 academy MVP).

### T48 — Formalize franchize as plugin (meta.plugin)
- status: `done`
- updated_at: `2026-03-14T00:00:00Z`
- owner: `codex`
- notes: Added plugin manifest + hydration + contract files for `/app/franchize` and synced `app/franchize/todo.md` checklist for formalization scope.
- next_step: Split follow-up into explicit tasks for metadata extraction into cores and leftover payments/items-sync features.
- risks: Current plugin docs describe existing runtime; deeper extraction into shared cores still pending and should be done incrementally.
- dependencies: T47
- deliverables:
  - `app/franchize/plugin.ts`
  - `app/franchize/hydration.md`
  - `app/franchize/CONTRACT.md`
  - `app/franchize/todo.md`

### 2026-03-14 — T48 completion (franchize plugin formalization + supaplan UX alignment support)
- Formalized `/app/franchize` as extension-style plugin with explicit capabilities/exports/uses manifest.
- Added hydration and contract docs so agents/operators can reason about public route surface and server/client boundaries.
- Synced franchize todo checklist for formalization items and documented next split-ready follow-up work.


### T49 — Greenbox integration runway decomposition (directional priority)
- status: `done`
- updated_at: `2026-03-17T00:00:00Z`
- owner: `codex`
- notes: Провёл разбор требований для greenbox integration, оформил новый directional пакет задач GBX-R1..GBX-R6 с фокусом на безопасные границы, матрицу интеграций и порядок рефакторинга на ходу.
- next_step: Заклаимить первую задачу GBX-R1 в SupaPlan и зафиксировать контракт плагинов v0.1 перед реализацией UI/симулятора.
- risks: Без фиксации контракта и очереди записи есть риск гонок симулятора и расползания архитектуры по маршрутам.
- dependencies: T48
- deliverables:
  - `docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md`

### 2026-03-17 — T49 completion (Greenbox integration runway decomposition)
- Added G8 section in `docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md` with six ordered tasks (GBX-R1..GBX-R6) oriented around integration hardening and refactor-on-the-fly execution.
- Documented concrete blockers: missing manifest validation, missing loader-time ownership gates, undefined sim alert lifecycle contract, and missing cross-route readiness visibility.
- Prepared SupaPlan task creation scope so execution can start from contract freeze and move sequentially.
