# /app/franchize TODO

## Current status
- Status: `in_progress`
- Owner: Codex / franchize integration lane
- Franchize is a formal app plugin with manifest, contract, hydration docs, slug routes, and stable compatibility exports.
- Public server actions now route through focused server-only modules while preserving `app/franchize/actions.ts` imports.
- Archive/changelog: `app/franchize/CHANGELOG.md`.

## Next action
- Continue extracting duplicated business logic into shared cores where it is reused outside franchize.
- Add focused TODO entries for remaining payments/items-sync work only when those scopes become active.
- Add or finish a minimal wrapper route registration if plugin registry wiring requires it.

## Blockers
- Core extraction depends on stable shared contracts in `/app/core`.
- Live payment/items-sync verification requires configured Supabase and Telegram runtime credentials.

## Links
- Plugin manifest: `app/franchize/plugin.ts`
- Public contract: `app/franchize/CONTRACT.md`
- Hydration notes: `app/franchize/hydration.md`
- Core extraction tracker: `app/core/todo.md`

## 2026-05-07 — SupaPlan FRZ-R4 / FRZ-R8 / CQ-01 slice
- Status: `ready_for_pr`
- Owner: `codex`
- Scope:
  - FRZ-R4 added `/franchize/[slug]/onboarding` partner checklist page for VIP-bike onboarding readiness.
  - FRZ-R8 added `/franchize/[slug]/sales` vertical hub for new/electric/used/trade-in flows.
  - CQ-01 extracted MapRiders start/stop session writes into `app/franchize/hooks/useSessionManager.ts` and reused it from the map cockpit + floating FAB.
- Next action: smoke `vip-bike` routes in preview/Telegram WebApp after merge and consider adding the new routes to default crew metadata menu links.

## 2026-05-07 — Self-review polish after FRZ-R4 / FRZ-R8
- Status: `ready_for_pr`
- Owner: `codex`
- Scope: Added the new onboarding and sales pages to `docs/sql/vip-bike-franchize-hydration.sql` header/footer link lists so hydrated VIP-bike crews can discover them from seeded navigation.
- Next action: Re-apply the VIP-bike hydration SQL in staging/production, then smoke header/footer navigation for `/onboarding` and `/sales`.
