---
name: franchize
description: Marketplace-grade franchize runtime for bike crew storefronts and operator flows.
---

# Franchize Domain Hydration

Use this domain for customer-facing `/franchize/*` experiences where one crew slug should hydrate a complete storefront runtime.

## Goal
1. Present catalog data as a real marketplace surface (not plain list UX).
2. Keep Telegram-first operator flow compatible with fast PR execution loops.
3. Reuse crew metadata hydration for themes, promos, menu links, and checkout states.

## Public surface
- `/franchize/create` — crew bootstrap and metadata authoring
- `/franchize/[slug]` — catalog surface
- `/franchize/[slug]/cart` — cart review
- `/franchize/[slug]/order/[id]` — checkout/order flow
- `/franchize/[slug]/about` and `/contacts` — content + trust pages
- `/franchize/[slug]/rentals` and `/admin` — operator-side scoped surfaces

## Boundaries
- Keep legacy bike routes operational (`/rent-bike`, `/rentals`, `/vipbikerental`).
- Avoid exposing any service-role logic in client components.
- Prefer metadata-first hydration and additive UI changes over destructive route rewrites.

## Data contract notes
- Runtime reads crews + cars and derives storefront view models in `app/franchize/actions.ts`.
- Crew metadata remains primary source for branding/theme/navigation blocks.
- Missing metadata must degrade gracefully with defaults (no crash, no blank viewport).
