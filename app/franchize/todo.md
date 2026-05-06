# /app/franchize — convert to extension (OpenClaw style)

Purpose
Turn current proto-franchize into formal extension living under /app/franchize with manifest.

Tasks
- [x] Create /app/franchize/plugin.ts (manifest: id, capabilities, uses)
- [x] Add /app/franchize/hydration.md (context, public surface)
- [x] Add /app/franchize/CONTRACT.md (what API it guarantees)
- [ ] Extract business logic into cores where duplicated (refer to /app/core/todo.md)
- [ ] Add todo.md entries for leftover features (payments, items sync)
- [ ] Minimal UI wrapper: /app/franchize/layout.tsx & page.tsx to register route

Notes
- Do not move files out of /app — keep plugin in place, formalize with manifest.

## SupaPlan execution — 2026-05-06

- [x] `RENT-P3.1` (`a58aea2f-b6ff-43f1-ad0e-a946ac359d9a`): storefront a11y pass added explicit search labels/live result status, pressed/current states, focus-visible affordances, dialog/menu semantics, focus containment/return for overlays, and clearer cart/gallery/modal labels.
- [x] `FIX-ORPHAN-INVOICE` (`d1a6f7d0-1234-4a1e-bcde-11110001abcd`): `createFranchizeOrderInvoiceInternal` now deletes the just-created pending invoice when Telegram XTR invoice sending fails, guarded by invoice id/status/rental metadata.
