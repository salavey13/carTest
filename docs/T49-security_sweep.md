# T49 — Software-engineering hardening sweep (security/SPA/state/CSS/cart-write load)

**Status:** `in_progress`  
**Updated_at:** `2026-02-27T23:45:00Z`  
**Owner:** `codex`  
**Dependencies:** `T48`  
**Parent Plan:** [THE_FRANCHEEZEPLAN.md](./THE_FRANCHEEZEPLAN.md)

---

## Objective
Finish architecture-grade hardening after visual parity work. Keep the full engineering depth explicit (security boundaries, SPA tap reliability root-cause fixes, write-queue guarantees, style-token migration, context decomposition, theme bootstrap, AI JSON safety).

## Latest execution update (2026-02-27)
- Reapplied smooth `CrewHeader` compact transition via transform-based animation (`scaleY + translateY`) and compact-state `pointerEvents` guard.
- Added dedicated server-only admin module `lib/supabase-server.ts` with `server-only` boundary and moved privileged exports out of `hooks/supabase.ts`.
- Updated dropdown interaction layering (`FranchizeProfileButton` isolation + dropdown pointer-events/z-index tweaks) to stabilize tap behavior in sticky-header contexts.
- Continued SPA oath hardening in rental lifecycle controls: same-origin deep links now route through Next.js `router.push`, external Telegram links keep browser navigation.
- Added defensive deep-link gate in lifecycle actions to reject unsafe/malformed URLs with explicit toast feedback instead of blind hard navigation fallback.
- Replaced franchize cart internal `<a href>` navigation with Next.js `Link` components to keep same-origin transitions SPA-safe.
- Added leave-franchize-scope flush checkpoint in `useFranchizeCart` so pending cart state is persisted when user navigates away from `/franchize/{slug}*` within SPA.
- Added `freeze` lifecycle flush hook to cover mobile WebView/background tab suspension where `beforeunload` may not fire reliably.
- Migrated lifecycle action panel colors to CSS variables + Tailwind utilities (reduced inline color dominance, preserved hover/focus visibility).
- Migrated cart page accent/border controls to CSS-variable Tailwind utilities and aligned focus-visible outline styles to var-driven classes.
- Extended T49.4 style-token migration into `CatalogClient` + `ItemModal`: added scoped CSS vars (`--catalog-*`, `--item-*`) and replaced multiple inline accent/muted text/focus color blocks with Tailwind var utilities for chips, promo cards, price/CTA labels, and modal controls.
- Extended T49.4 style-token migration into shell surfaces (`CrewFooter`, `FloatingCartIconLink`, `HeaderMenu`): moved footer/menu/floating-cart accent-border-text styling to scoped CSS vars and Tailwind var classes while keeping navigation behavior unchanged.
- Continued T49.4 on `OrderPageClient`: removed residual internal `<a href>` fallback (migrated to `Link`) and introduced scoped `--order-*` vars for key accent/border typography and CTA states to reduce inline style hotspots without changing checkout flow.
- Extended `OrderPageClient` token migration: delivery/payment/promo/extras/copilot border+muted accents now reuse `--order-*` vars instead of repeated direct palette color wiring.
- Completed `OrderPageClient` token pass #3: milestone badge on-color/background fallback, step status colors, and progress track/gradient endpoint now also consume `--order-*` vars.
- Final polish pass: replaced remaining class-compatible inline var styles in `OrderPageClient` with Tailwind var utilities (`border-[var(--...)]`, `bg-[var(--...)]`, `text-[var(--...)]`) to reduce style-object churn before T49.5 handoff.

## Subtask queue (dependency-ordered)

### T49.0 — continue as FRANCHEEZEPLAN_EXECUTIONER: unbloat planning ledger by moving legacy diary archive
- **Goal:** reduce planning noise in `docs/THE_FRANCHEEZEPLAN.md` by relocating oversized history into `docs/AGENT_DIARY.md`.
- **Technical details:**
  - move only historical section-7 narrative block;
  - keep section 7 as pointer (do not remove diary contract);
  - preserve wording chronology to avoid history drift.
- **Files:** `docs/THE_FRANCHEEZEPLAN.md`, `docs/AGENT_DIARY.md`
- **Acceptance check:** THE plan is compact; AGENT_DIARY keeps migrated history with migration marker.

### T49.1 — continue as FRANCHEEZEPLAN_EXECUTIONER: security boundary hardening (server-only admin paths)
- **Goal:** guarantee no client-reachable path can touch `SUPABASE_SERVICE_ROLE_KEY`.
- **Technical details:**
  1. Keep Telegram DB sync behind server actions (`fetchDbUserAction`, `upsertTelegramUserAction`) and route handlers only.
  2. Ensure `hooks/supabase.ts` contains no service-role fallback literals.
  3. Confirm client trees (`"use client"`) import only anon/RLS-safe clients.
  4. Keep admin client initialization in server-only modules (or explicit server boundaries).
- **Primary files/anchors:** `hooks/useTelegram.ts`, `hooks/supabase.ts`, `app/*/actions.ts`, `app/api/*`
- **Verification commands:**
  - `rg -n "SUPABASE_SERVICE_ROLE_KEY|service_role" hooks app lib`
  - `rg -n "use client" -g"*.tsx" app components contexts`
- **Acceptance check:** no transitive client import chain references service-role key access.

### T49.2 — continue as FRANCHEEZEPLAN_EXECUTIONER: SPA navigation oath recovery in franchize shell
- **Goal:** keep internal navigation SPA-safe while maintaining reliable mobile/Telegram taps.
- **Technical details:**
  1. Replace internal hard-reload navigation (`window.location.assign`, internal plain `<a href>`) with `Link`/`router.push`.
  2. Fix tap reliability via layer/event root causes: stacking contexts, overlay hitboxes, `pointer-events`, `stopPropagation` side effects.
  3. Re-check menu/profile/cart routes inside dropdown/modal/portal contexts.
- **Primary files/anchors:** `app/franchize/components/CrewHeader.tsx`, `HeaderMenu.tsx`, `FranchizeProfileButton.tsx`, `FloatingCartIconLink.tsx`
- **Verification commands:**
  - `rg -n "window\.location\.assign|href=\"/franchize" app/franchize/components`
- **Acceptance check:** same-origin franchize navigation is SPA-based and stable on mobile WebView interactions.

### T49.3 — continue as FRANCHEEZEPLAN_EXECUTIONER: cart write-pressure control and checkpoint persistence
- **Goal:** avoid DB write spam while preserving cart durability.
- **Technical details:**
  1. Keep local-first cart state for instant quantity updates.
  2. Persist via explicit checkpoints (`/cart`, `/order/*`, pagehide/visibility lifecycle), not each micro-change.
  3. Keep ordered queue + retry-safe `pendingPersist` behavior after failed writes.
  4. Guard against out-of-order responses in mobile latency conditions.
- **Primary files/anchors:** `hooks/useFranchizeCart.ts`
- **Verification commands:**
  - `rg -n "pendingPersist|flush|queue|pagehide|visibilitychange" hooks/useFranchizeCart.ts`
- **Acceptance check:** cart survives reload/navigation with bounded write cadence and no false "persisted" state.

### T49.4 — continue as FRANCHEEZEPLAN_EXECUTIONER: style-system variable migration and interaction-state safety
- **Goal:** reduce inline-style dominance and preserve hover/focus/active behavior.
- **Technical details:**
  1. Move remaining color hotspots to CSS variables consumed by Tailwind utilities (`bg-[var(--...)]`, `text-[var(--...)]`, `focus:ring-[var(--...)]`).
  2. Reuse shared interaction helpers (`interactionRingStyle`, `focusRingOutlineStyle`) rather than ad-hoc per-component styles.
  3. Validate contrast/focus visibility for dark + light crew palettes.
- **Primary files/anchors:** `app/franchize/components/*`, `app/franchize/modals/Item.tsx`, `app/franchize/lib/theme.ts`
- **Verification commands:**
  - `rg -n "style=\{\{[^}]*color|background" app/franchize`
- **Acceptance check:** interaction states stay visible after token migration and crew theming remains flexible.

### T49.5 — continue as FRANCHEEZEPLAN_EXECUTIONER: AppContext decomposition and realtime strategy audit
- **Goal:** reduce unrelated rerenders and avoid timer-only pseudo-realtime architecture.
- **Technical details:**
  1. Inventory `contexts/AppContext.tsx` responsibilities (auth/cart/game/runtime/etc).
  2. Split by concern where low-risk (`AuthContext`, `CartContext`, `RuntimeContext` pattern).
  3. Replace broad interval polling with event/realtime subscriptions where applicable.
  4. Do not add `React.memo` blindly; only where profiling justifies.
- **Primary files/anchors:** `contexts/AppContext.tsx`, `contexts/*`, consumers under `app/*` and `components/*`
- **Verification commands:**
  - `rg -n "setInterval|poll|memo\(" contexts app components`
- **Acceptance check:** narrower provider boundaries and reduced global rerender scope.

### T49.6 — continue as FRANCHEEZEPLAN_EXECUTIONER: theme flash prevention + AI JSON input robustness
- **Goal:** eliminate first-paint palette mismatch and harden AI JSON processing in create flow.
- **Technical details:**
  1. Use server-readable early theme signal (cookie/session/bootstrap) before async profile fetch.
  2. Keep `/franchize/create` Advanced JSON parser with explicit empty-input, root-object, and `franchize` object-shape checks.
  3. Surface actionable parse errors (`JSON.parse` message) without page-level crash.
- **Primary files/anchors:** theme bootstrap hooks/providers, `app/franchize/create/*`
- **Verification commands:**
  - `rg -n "JSON\.parse|Advanced JSON|theme|cookie" app/franchize/create app contexts hooks`
- **Acceptance check:** no white flash before theme sync; malformed AI JSON yields recoverable inline errors.

---

## Exit criteria for T49 completion
- All T49.0–T49.6 subtasks are marked done in the main plan.
- Regression smoke confirms SPA navigation, cart checkpoint persistence, interaction-state visibility, and no theme flash on dark-default paths.
- T49 status sync is reflected in `docs/THE_FRANCHEEZEPLAN_STATUS.MD` with next-step pointer.
