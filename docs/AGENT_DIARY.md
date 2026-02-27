# AGENT_DIARY — CyberTutor runtime memory

Purpose: keep compact, reusable operational memory for bridge/homework tasks so agent behavior improves across runs.

## 2026-02-15 — Telegram Markdown parse failures in callback/ack
- **Symptom:** Telegram send errors: `Bad Request: can't parse entities`.
- **Root cause:** Markdown formatting in dynamic text/captions (unescaped symbols from user/task content).
- **Fix/workaround:** prefer plain-safe text for callback/ack messages and photo captions; avoid forced Markdown parse mode unless strictly needed.
- **Verification:** `node scripts/codex-notify.mjs callback ...` and inspect successful Telegram delivery in response JSON.

## 2026-02-15 — Slack `files.upload` missing_scope for forwarded TG photos
- **Symptom:** `/codex` photo forwarding logs show `Failed to upload Telegram photo to Slack ... missing_scope`.
- **Root cause:** Slack app lacks file scopes while message posting is allowed.
- **Fix/workaround:** upload photo bytes to Supabase public storage and post URL fallback into Slack thread.
- **Verification:** trigger `/codex` photo path; ensure thread contains `📎 TG photo ...` link and forwarding status >0.

## 2026-02-15 — Playwright Chromium crash in browser container
- **Symptom:** `TargetClosedError` with Chromium SIGSEGV.
- **Root cause:** runner/browser-container instability for chromium headless shell.
- **Fix/workaround:** retry screenshot with fallback order: Chromium -> Firefox -> WebKit -> thum.io (`scripts/page-screenshot-skill.mjs`).
- **Verification:** successful image artifact path or successful thum.io output file.

## 2026-02-15 — Homework completion should include deep links
- **Symptom:** screenshot/text delivered but operator still lacks one-click app-open link.
- **Root cause:** callback text had preview/prod URLs only.
- **Fix/workaround:** include Telegram WebApp deep link `https://t.me/oneBikePlsBot/app?startapp=homework/solution/<jobId>` plus production web URL.
- **Verification:** callback response includes `homeworkDeepLink` and outgoing message contains `Open in bot app:` line.

## 2026-02-15 — Stale Supabase row vs rich UI fallback mismatch
- **Symptom:** Screenshot shows detailed solution, but `homework_daily_solutions` contains shorter stale markdown.
- **Root cause:** UI rendered from richer local fallback while DB row had older payload from earlier save script.
- **Fix/workaround:** add weak-row detection and auto upsert of local fallback into Supabase on hydration for known fallback job IDs.
- **Verification:** open `/homework/solution/16-02-schedule`, then check row `solution_markdown/full_solution_rich` length and `updated_at` changed.

## 2026-02-15 — Response verbosity policy for bridge callbacks
- **Symptom:** Final responses kept repeating full callback curl block even when callback was already sent automatically.
- **Root cause:** legacy habit from earlier fragile callback stage.
- **Fix/workaround:** default to concise final response without curl block; provide curl fallback only on explicit user request or callback failure.
- **Verification:** check final response template against AGENTS 9.4.9 policy.

## 2026-02-15 — Browser tool artifact path not readable by local callback uploader
- **Symptom:** `node scripts/codex-notify.mjs callback --imagePath <browser-artifact>` fails with `ENOENT`.
- **Root cause:** `mcp__browser_tools__run_playwright_script` returns `browser:/...` artifact reference that is not mounted as a regular file path for local Node scripts.
- **Fix/workaround:** for callback image delivery, generate a local screenshot file (`artifacts/...`) via `scripts/page-screenshot-skill.mjs` (thum.io fallback) and pass that path to `--imagePath`.
- **Verification:** callback response JSON shows `imageDelivery.telegram[].ok=true` and `imageDelivery.slack.ok=true`.

## 2026-02-18 — Operator preference: progress screenshots in bridge updates
- **Symptom:** operator asked for more visual/"cyberpunk" progress feel in Telegram updates.
- **Root cause:** callback-auto often sends text-only updates unless `imageUrl` is attached.
- **Fix/workaround:** when feasible, include screenshot URL in callback payload (public URL or service-accessible image URL) and favor periodic visual updates for visible UI tasks.
- **Verification:** `node scripts/codex-notify.mjs callback-auto --summary "..." --imageUrl <public-image-url>` returns `imageDelivery` with sent image count > 0.

## 2026-02-19 — Franchize visual QA screenshot fallback still needed
- **Symptom:** Chromium in browser container crashed with SIGSEGV during `/franchize/vip-bike` screenshot capture.
- **Root cause:** intermittent Chromium headless instability in current runner session.
- **Fix/workaround:** immediately retried with Playwright Firefox and captured artifact successfully.
- **Verification:** `mcp__browser_tools__run_playwright_script` using Firefox saved `artifacts/franchize-vip-bike-shell-v2.png`.

## 2026-02-21 — Franchize QA slug test matrix for polish tasks
- **Symptom:** regressions slipped when validating only one slug/fallback dataset.
- **Root cause:** visual/typing groups differ per crew slug; `wbitem` and `gear` distributions were not stress-tested.
- **Fix/workaround:** run smoke checks and visual passes on `vip-bike` (baseline), `sly13` (wbitem ordering), and `antanta52.ru` (gear-heavy mix) for each catalog/header refactor.
- **Verification:** `FRANCHIZE_QA_SLUG=vip-bike npm run qa:franchize && FRANCHIZE_QA_SLUG=sly13 npm run qa:franchize && FRANCHIZE_QA_SLUG=antanta52.ru npm run qa:franchize`.

## 2026-02-21 — `codex-notify telegram` default text trap (`--message` vs `--text`)
- **Symptom:** heartbeat command looked successful but operator received generic "Codex task update" instead of custom progress text.
- **Root cause:** script accepted only `--text`; teammate/agent command used `--message`, so fallback default text was sent.
- **Fix/workaround:** add `--message` alias support in `scripts/codex-notify.mjs` (`getArgAlias`) and keep backward compatibility with `--text`.
- **Verification:** `node scripts/codex-notify.mjs telegram --message "T14 done" --chat-id "$ADMIN_CHAT_ID" --mirror-chat-id 417553377`.

## 2026-02-21 — TG rental photo flow can fail when `awaiting_rental_photo` state expires
- **Symptom:** user sends rental photo in Telegram and gets stuck/no-progress (`no active rental` context in adjacent action flow).
- **Root cause:** photo webhook required `user_states.awaiting_rental_photo`; when state expired/lost, photo was ignored and no completed photo event was recorded.
- **Fix/workaround:** add webhook fallback that auto-resolves likely renter rental + expected photo type from `rentals` + `events`; persist photo events with `status=completed` in both webhook and `addRentalPhoto` action.
- **Verification:** `npx eslint app/api/telegramWebhook/route.ts app/rentals/actions.ts --max-warnings=0` and manual Telegram photo upload after clearing `user_states` still routes to inferred rental step.

## 2026-02-21 — Franchize rental page build import path gotcha
- **Symptom:** Next.js production build failed for `/franchize/[slug]/rental/[id]` with “Attempted import error … not exported from '../../../../actions'”.
- **Root cause:** incorrect relative path depth after nesting under `[slug]/rental/[id]`; importer pointed one level too high.
- **Fix/workaround:** use `../../../actions` from rental page and keep franchize rental surface inside crew-themed shell components.
- **Verification:** `npm run build` completes and route `/franchize/[slug]/rental/[id]` is listed in build output.

## 2026-02-21 — Franchize header can leak global theme tokens
- **Symptom:** Header looked light while crew page used dark palette; title/body contrast looked broken on rental page screenshots.
- **Root cause:** `CrewHeader` (and profile shell) still used Tailwind global tokens like `bg-background`, `bg-card`, `text-foreground` instead of crew metadata palette.
- **Fix/workaround:** drive header/ticker/chips/menu/profile surfaces from `crew.theme.palette` inline styles for background/text/border colors.
- **Verification:** open `/franchize/vip-bike/rental/demo-order` and confirm header + content contrast stay consistent with crew palette.

## 2026-02-21 — Franchize header avatar should not be a dead-end link
- **Symptom:** avatar in franchize header only navigated to `/profile`, hiding fast access to settings/admin/branding from operator flow.
- **Root cause:** reused generic profile widget behavior not aligned with franchize operator UX expectations.
- **Fix/workaround:** replace with dropdown menu exposing `Профиль`, `Настройки`, `Branding`, optional `Мой экипаж`, plus `Admin` only when `isAdmin()` is true.
- **Verification:** open `/franchize/vip-bike` and confirm dropdown items render by role/context.

## 2026-02-21 — Outstanding iteration performance baseline (operator feedback)
- **Symptom:** Operator highlighted this iteration as exceptionally strong and asked to preserve the execution quality pattern.
- **Root cause:** tight feedback loop (small scoped UX hotfixes + visible screenshots + immediate telemetry) increased trust and momentum.
- **Fix/workaround:** keep this rhythm as default: clarify CTA intent in UI copy, ship one polished visual delta per beat, always close with concise heartbeat and next beat.
- **Verification:** operator engagement remains high across consecutive T16 micro-iterations and merge readiness improves.

## 2026-02-21 — CTA hierarchy rule for franchize rental cards
- **Symptom:** fallback-labeled button looked as prominent as main next-step action, creating choice ambiguity.
- **Root cause:** equal visual weight between progress CTA and context-recovery fallback CTA.
- **Fix/workaround:** keep next-step action as primary filled button, move Telegram deep-link to low-emphasis fallback row with info-icon tooltip, remove legacy shortcut from primary action set.
- **Verification:** `/franchize/vip-bike/rental/demo-order` shows one dominant continuation CTA and fallback link at bottom.

## 2026-02-21 — Post-payment delight notification beats plain invoice follow-up
- **Symptom:** invoice confirmation felt dry; users lacked emotional "deal is real" moment after payment.
- **Root cause:** webhook success message was short/system-like and did not surface full order context.
- **Fix/workaround:** send rich "You are in" notification on `franchize_order` success with order snapshot, totals, deeplinks, and image query; keep continuation CTA as first button.
- **Verification:** trigger `franchize_order` webhook and confirm Telegram user message includes details + 3-button flow (`Продолжить оформление`, WebApp, каталог).


## 2026-02-21 — Franchize webview tap reliability (Link vs direct navigation)
- **Symptom:** in Telegram/mobile runtime, franchize internal links in modal/footer/dropdown/cart looked tappable but did not navigate.
- **Root cause:** client-side `next/link` interaction got dropped in some portal/dropdown/webview event paths (especially after close/select handlers).
- **Fix/workaround:** prefer deterministic navigation for these controls (`<a href>` or explicit `window.location.assign`) instead of relying on SPA link interception.
- **Verification:** mobile Playwright flow covering header menu, footer menu, profile dropdown, and floating cart all navigates to expected routes.


## 2026-02-21 — Back-to-catalog links need the same webview hardening
- **Symptom:** `Вернуться в каталог` / `К каталогу` on cart/order/rental subpages could fail similarly to header/footer taps.
- **Root cause:** same `next/link` interception fragility in webview/subpage interaction contexts.
- **Fix/workaround:** standardize subpage recovery/back links to plain anchors for deterministic navigation.
- **Verification:** Playwright mobile checks for cart->catalog, order->catalog, rental->catalog transitions.


## 2026-02-21 — Default franchize QA slug must be `vip-bike` (not demo)
- **Symptom:** repeated regressions/feedback because validation screenshots used fallback `demo` slug instead of real operator baseline.
- **Root cause:** old smoke habit from empty/fallback shell testing persisted across iterations.
- **Fix/workaround:** use `vip-bike` as default slug for franchize screenshots/smoke unless operator asks otherwise; mirror this in AGENTS + FRANCHEEZEPLAN notes.
- **Verification:** Playwright screenshots and manual navigation checks executed against `/franchize/vip-bike/...` routes.

## 2026-02-22 — Franchize focus states can disappear after token cleanup
- **Symptom:** after replacing global token classes with crew palette styles, catalog controls had weak/absent keyboard focus visibility.
- **Root cause:** removed Tailwind default focus ring utilities without replacing them by palette-aware interaction styles.
- **Fix/workaround:** add shared `interactionRingStyle(theme)` helper and apply it to search input/CTA and catalog card trigger buttons.
- **Verification:** `npm run lint -- app/franchize/components/CatalogClient.tsx app/franchize/lib/theme.ts`

## 2026-02-22 — Shared focus helper keeps interaction polish fast and safe
- **Symptom:** polishing modal/cart/order controls one-by-one caused inconsistent focus visibility and style drift.
- **Root cause:** each surface implemented its own control styles with no shared focus-outline primitive.
- **Fix/workaround:** add `focusRingOutlineStyle(theme)` and reuse across interactive controls; pair with light hover/active transitions for tactile parity.
- **Verification:** `npx eslint app/franchize/modals/Item.tsx app/franchize/components/CartPageClient.tsx app/franchize/components/OrderPageClient.tsx app/franchize/lib/theme.ts`

## 2026-02-22 — Telegram webview link taps: prefer deterministic navigation on franchize shell
- **Symptom:** Header/menu/profile/footer links looked tappable but intermittently failed on mobile Telegram webview.
- **Root cause:** SPA navigation hooks (`router.push` / dropdown `onSelect` timing) could be swallowed around overlays/portals.
- **Fix/workaround:** use plain anchors or `window.location.assign` for franchize shell critical nav paths; keep modal-close handlers side-effect-only.
- **Verification:** mobile smoke flow checks menu/profile/cart/back links navigate correctly.

## 2026-02-22 — Cart state mismatch between floating icon and cart page
- **Symptom:** floating cart indicator increased, but cart page sometimes appeared empty between views.
- **Root cause:** cart state relied solely on localStorage per-client context and lacked account-level persistence/rehydration.
- **Fix/workaround:** persist cart per slug to `users.metadata.settings.franchizeCart` and hydrate local state from metadata when local cart is empty.
- **Verification:** add item, open `/franchize/vip-bike/cart`, reload, and confirm lines persist.


## 2026-02-27 — Migrated historical diary block from THE_FRANCHEEZEPLAN
- Extracted oversized section 7 history from `docs/THE_FRANCHEEZEPLAN.md` to reduce planning noise and merge conflicts.
- Original migrated content is preserved verbatim below for archive continuity.

### Migrated entries

### 2026-02-25 — T49 AI-JSON resilience increment (create-form local apply)
- Hardened `/franchize/create` local `Advanced JSON` apply flow with explicit empty-input guard and top-level/object-shape validation (`root object` + `franchize object` expectations).
- Upgraded parse failure feedback from generic error to precise parser details (`JSON.parse` message), keeping the page stable and operator-recoverable on malformed payloads.
- Kept task status as `in_progress`: security/SPA/cart/style foundations are in place, but broader context/theme-flash architecture scope remains open.

### 2026-02-23 — T49 continuation (style-token discipline + cart save resilience)
- Refined franchize pill styling to use CSS-variable-powered Tailwind utilities (`bg-[var(--...)]`, `text-[var(--...)]`) for category/quick-filter controls, reducing inline color dominance while preserving dynamic crew theming.
- Added retry-safe persistence behavior in franchize cart queue: failed save responses now keep `pendingPersist` true so next checkpoint/page-exit flush can recover instead of falsely marking state persisted.
- Kept T49 as `in_progress` intentionally: remaining scope still includes broader theme-token migration breadth and AppContext split/realtime architecture hardening.

### 2026-02-23 — T49 hardening pass (security + SPA + cart-write discipline)
- Removed the most dangerous client/server boundary leak in Telegram auth flow by replacing direct client import of `hooks/supabase` with server actions (`fetchDbUserAction`, `upsertTelegramUserAction`).
- Deleted hardcoded `SUPABASE_SERVICE_ROLE_KEY` fallback from `hooks/supabase.ts` so service-role access now depends on runtime secret only.
- Reverted franchize navigation back to SPA-safe transitions (`router.push` / `Link`) in header, profile dropdown, and header menu instead of `window.location.assign` / internal `<a>` workaround.
- Reworked franchize cart persistence model: removed 350ms per-change metadata writes, added ordered flush queue with explicit checkpoint sync (`/cart`, `/order/*`) and page-exit/visibility flush handlers.


### 2026-02-23 — T48 completion (Pepperolli parity pass shipped)
- Executed visual parity sweep on `/franchize/vip-bike`: category rail + quick filters now use solid Pepperolli-style pills (active accent, inactive dark solid) without outline-dominant look.
- Promoted catalog section headers to stronger white hierarchy and shifted count chips to muted-solid bubbles for faster scanning.
- Updated product card semantics with accent-highlighted price and iconified `Добавить` CTA while preserving premium `Выбрать` threshold behavior.
- Reworked floating cart to solid accent body with black foreground and overlapping white quantity badge; softened catalog card borders in theme variants for cleaner dark-surface separation.

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

### 2026-02-27 — T49 reapply pack (server-only boundary + header/dropdown reliability)
- Reapplied proven T49 snippets into this branch: `CrewHeader` now collapses with transform-based animation (`scaleY/translateY`) to avoid max-height jitter and hidden-hitbox issues.
- Introduced `lib/supabase-server.ts` with `import "server-only"` and proxy-based error messaging; moved admin helpers in `hooks/supabase.ts` to this server module so service-role access stays on server boundaries.
- Hardened profile dropdown taps in sticky header context by adding isolation wrapper on the trigger side and explicit pointer-events/z-index classes in shared dropdown primitives.
- Verification commands: `npm run lint -- --file app/franchize/components/CrewHeader.tsx --file app/franchize/components/FranchizeProfileButton.tsx --file components/ui/dropdown-menu.tsx --file hooks/supabase.ts --file lib/supabase-server.ts` and `npm run build`.

### 2026-02-27 — T49.2 SPA deep-link guard + telegram heartbeat
- Symptom: rental lifecycle actions always used `window.location.assign(result.deepLink)` which could force full reload for same-origin links.
- Root cause: deep-link handler treated all links as external handoff.
- Fix/workaround: added `navigateToDeepLink()` in `FranchizeRentalLifecycleActions` to detect same-origin URLs and use `router.push`, while keeping hard navigation for true external Telegram links.
- Verification command: `npm run lint -- --file app/franchize/components/FranchizeRentalLifecycleActions.tsx && node scripts/codex-notify.mjs telegram --text "..."`.

### 2026-02-27 — T49.2 deep-link safety hardening
- Symptom: fallback branch still attempted blind hard navigation on malformed deep-link strings.
- Root cause: `navigateToDeepLink` catch branch used `window.location.assign(deepLink)` even when URL parse failed.
- Fix/workaround: restricted protocols to `http/https/tg` and replaced malformed/unsafe fallback with explicit toast error.
- Verification command: `npm run lint -- --file app/franchize/components/FranchizeRentalLifecycleActions.tsx && npm run build`.

### 2026-02-27 — T49.2 SPA oath cleanup on cart surface
- Symptom: franchize cart page still used internal `<a href>` links for same-origin paths, causing hard reload transitions.
- Root cause: residual static anchors remained in `CartPageClient` after earlier navigation hardening passes.
- Fix/workaround: replaced those anchors with Next.js `Link` (`/franchize/{slug}` and `/franchize/{slug}/order/demo-order`).
- Verification command: `npm run lint -- --file app/franchize/components/CartPageClient.tsx && npm run build`.

### 2026-02-27 — T49.3 cart checkpoint: leave-franchize-scope flush
- Symptom: pending cart snapshot could remain unsaved when user left franchize routes via SPA without hitting `/cart` or `/order/*` first.
- Root cause: flush checkpoints were limited to checkout paths + page lifecycle events; pure in-app route switch could delay persistence.
- Fix/workaround: added route-scope watcher in `useFranchizeCart` to flush once when leaving `/franchize/{slug}*` scope.
- Verification command: `npm run lint -- --file app/franchize/hooks/useFranchizeCart.ts && npm run build`.

### 2026-02-27 — T49.3 mobile lifecycle add-on (`freeze` flush)
- Symptom: in some mobile WebView/background transitions, `beforeunload` is skipped and persistence timing can lag.
- Root cause: cart flush relied on unload/pagehide/visibility events only.
- Fix/workaround: added `document` `freeze` event listener in `useFranchizeCart` and flush on freeze.
- Verification command: `npm run lint -- --file app/franchize/hooks/useFranchizeCart.ts && npm run build`.

### 2026-02-27 — T49.4 style-token hotspot cleanup (lifecycle actions)
- Symptom: `FranchizeRentalLifecycleActions` still relied on dense inline color styles, weakening consistent hover/focus semantics.
- Root cause: dynamic palette values were applied directly per element rather than through shared CSS-variable utility classes.
- Fix/workaround: moved palette to component-level CSS variables and switched buttons/text/borders to Tailwind var-based utilities with explicit focus-visible outlines.
- Verification command: `npm run lint -- --file app/franchize/components/FranchizeRentalLifecycleActions.tsx && npm run build`.

### 2026-02-27 — T49.4 style-token hotspot cleanup (cart page)
- Symptom: `CartPageClient` still mixed crew palette via multiple inline color/focus style blocks.
- Root cause: dynamic theme was wired per control rather than through shared component-level CSS vars.
- Fix/workaround: introduced `--cart-accent`/`--cart-border` vars at section level and switched CTA/price/qty/focus visuals to Tailwind var utilities.
- Verification command: `npm run lint -- --file app/franchize/components/CartPageClient.tsx && npm run build`.

### 2026-02-27 — T49.4 style-token hotspot cleanup (catalog + item modal)
- Symptom: `CatalogClient` and `ItemModal` still had multiple inline color/focus style blocks, especially around promo cards, badges, option chips, and CTA text.
- Root cause: palette values were applied ad-hoc at element level instead of being scoped into reusable CSS variables.
- Fix/workaround: added component-scoped `--catalog-*` and `--item-*` vars and migrated affected controls to Tailwind var-based classes (`bg-[var(...)]`, `text-[var(...)]`, `focus-visible:outline-[var(...)]`).
- Verification command: `npm run lint -- --file app/franchize/modals/Item.tsx --file app/franchize/components/CatalogClient.tsx && npm run build`.

### 2026-02-27 — T49.4 style-token hotspot cleanup (footer + floating cart + header menu)
- Symptom: shell-level components still relied on repeated inline colors (`CrewFooter`, `FloatingCartIconLink`, `HeaderMenu`).
- Root cause: these surfaces were left behind while earlier T49.4 passes focused on catalog/cart/lifecycle/modals.
- Fix/workaround: introduced component-scoped CSS vars (`--footer-*`, `--floating-cart-*`, `--header-menu-*`) and switched border/background/text classes to Tailwind var utilities.
- Verification command: `npm run lint -- --file app/franchize/components/CrewFooter.tsx --file app/franchize/components/FloatingCartIconLink.tsx --file app/franchize/modals/HeaderMenu.tsx && npm run build`.

### 2026-02-27 — T49.4 order surface pass (SPA anchor + token vars)
- Symptom: `OrderPageClient` still contained a residual internal `<a href>` and repeated accent/border inline color wiring.
- Root cause: previous T49.4 passes prioritized catalog/cart/shell components, leaving order page partially migrated.
- Fix/workaround: migrated catalog return link to Next.js `Link` and introduced scoped `--order-*` vars for key accent/border states in order summary/callouts/CTA.
- Verification command: `npm run lint -- --file app/franchize/components/OrderPageClient.tsx && npm run build`.

### 2026-02-27 — T49.4 order surface pass #2 (additional border/accent var migration)
- Symptom: after first order-page migration, several controls still used direct `crew.theme.palette.*` border/accent references.
- Root cause: migration was incremental; delivery/payment/promo/extras/copilot states were left as follow-up hotspots.
- Fix/workaround: switched those states to `--order-*` var references while keeping `focusRingOutlineStyle` behavior and checkout logic unchanged.
- Verification command: `npm run lint -- --file app/franchize/components/OrderPageClient.tsx && npm run build`.

### 2026-02-27 — T49.4 order surface pass #3 (milestone/status color vars)
- Symptom: milestone progress block still carried direct palette references for badge on-color, status text, and gradient track endpoint.
- Root cause: earlier passes prioritized form controls; milestone visualization block remained partially unmigrated.
- Fix/workaround: moved milestone-related color states to `--order-*` vars while preserving existing completion logic and readability.
- Verification command: `npm run lint -- --file app/franchize/components/OrderPageClient.tsx && npm run build`.

### 2026-02-27 — T49.4 final polish (inline-var class migration)
- Symptom: several `OrderPageClient` nodes still used style objects for class-compatible var values (`borderColor`, `backgroundColor`, `color`).
- Root cause: prior passes focused on semantic var adoption first; utility-class conversion was left as final cleanup.
- Fix/workaround: switched these nodes to Tailwind var utility classes and kept `focusRingOutlineStyle` only where outline tokens are still dynamic.
- Verification command: `npm run lint -- --file app/franchize/components/OrderPageClient.tsx && npm run build`.
