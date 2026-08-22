# Franchize changelog / archive

## 2026-05-07 — Server-action boundary cleanup
- Split the public `app/franchize/actions.ts` compatibility surface into focused server-only modules under `app/franchize/server-actions/*`.
- Kept existing imports stable through wrappers/re-exports in `app/franchize/actions.ts`.
- Added mocked Supabase validation tests for franchize server actions.

## 2026-05-06 — SupaPlan execution archive
- `RENT-P3.1` (`a58aea2f-b6ff-43f1-ad0e-a946ac359d9a`): storefront a11y pass added explicit search labels/live result status, pressed/current states, focus-visible affordances, dialog/menu semantics, focus containment/return for overlays, and clearer cart/gallery/modal labels.
- `FIX-ORPHAN-INVOICE` (`d1a6f7d0-1234-4a1e-bcde-11110001abcd`): `createFranchizeOrderInvoiceInternal` deletes a just-created pending invoice when Telegram XTR invoice sending fails, guarded by invoice id/status/rental metadata.
