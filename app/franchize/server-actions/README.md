# Franchize server-action boundaries

This folder is the focused server-action surface for the franchize plugin.

## Import rules

- New route/server code should import the smallest module it needs:
  - `catalog.ts` — storefront loaders and crew bike availability maintenance.
  - `config.ts` — franchize metadata load/save actions.
  - `promotions.ts` — promo-code validation.
  - `orders.ts` — order notification, checkout, invoice, and retry actions.
  - `reviews.ts` — rental review context, submission, moderation.
  - `rentals.ts` — rental contract reconciliation, availability checks, rental card loader.
- Existing code may keep importing from `app/franchize/actions.ts`; that file is now a compatibility facade.
- Client components may import server actions only through `"use server"` modules. Never import `app/franchize/actions-runtime.ts` directly from client code.

## Runtime note

`app/franchize/actions-runtime.ts` intentionally keeps the prior implementation intact during the boundary split. The files in this folder are the stable seams for the next extraction slices; move implementation detail behind these seams only when a focused slice has tests.
