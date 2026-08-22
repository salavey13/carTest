# AGENTS.md — MapRiders Operator Cell

Scope: `app/franchize/[slug]/map-riders/*`

This is the execution playbook for agents working on MapRiders production surfaces (not the raw `goldmine` dump).

## 1) Mission in one line

Keep `/franchize/[slug]/map-riders` stable for real riders in Telegram WebApp while we port the strongest goldmine ideas in controlled slices.

## 2) Startup ritual (mandatory)

Before coding in this scope:

1. Read `app/franchize/[slug]/map-riders/todo.md` (source of truth for current port stage).
2. Read latest context from `todo.md` + `MapRiders_FixBook.md` for active extraction notes (goldmine dump files were retired).
3. Open `app/franchize/[slug]/map-riders/IDENTITY.md` and `USER.md` (operator intent + UX tone).
4. Cross-check active SupaPlan seeds listed in `todo.md` and avoid inventing duplicate work.

## 3) Core integration map (what must stay unbroken)

### 3.1 User surface
- Route: `/franchize/[slug]/map-riders`
- Entry file: `app/franchize/[slug]/map-riders/page.tsx`
- Parent wrappers: `CrewHeader`, `CrewFooter`, crew theme surface.

### 3.2 Live data + APIs
- Legacy endpoint compatibility: `/api/map-riders` (do not kill abruptly).
- Split endpoints: `/api/map-riders/overview`, `/leaderboard`, `/health`, `/batch-points`.
- Realtime packets must be monotonic by `updated_at`; stale packets are dropped.

### 3.3 Platform constraints
- Telegram-first mobile UX: keep taps reliable, avoid transparent overlays stealing clicks.
- SPA oath: do not regress to hard reload for internal links.
- Supabase security: service-role usage server-only.

## 4) Porting discipline (goldmine -> production)

1. **Contract first**: DB/API compatibility before UI replacement.
2. **Additive SQL only**: idempotent migrations in `supabase/migrations/*`.
3. **Local-first interactions**: queue writes, flush deterministically.
4. **Performance realism**: reduce overfetch and marker noise; validate with QA script.
5. **Reversible moves**: each slice should be easy to roll back.

## 5) What to prioritize now (from merged + planned work)

Use this order unless operator overrides:

1. I5/I6 QA evidence for `vip-bike` slug (two-phone, stale/offline, meetup persistence, screenshots).
2. Privacy controls (visibility mode, home blur, auto-expire presets).
3. Replay UX hardening (fullscreen scrubber + speed-gradient route).

If task is broad/ambiguous, start from these three in sequence.

## 6) Definition of done for this scope

A change is done only when:
- map route loads for `vip-bike` without regressions,
- QA command(s) are run or failure reason is explicit,
- docs/tracker updated when behavior changes,
- screenshots attached for visible UI changes.

## 7) Guardrails

- Never paste secrets into markdown/docs.
- Never remove backward compatibility without explicit operator approval.
- Never treat archival notes as production-ready truth; use runtime contracts (`page.tsx`, API routes, migrations) as source of truth.
