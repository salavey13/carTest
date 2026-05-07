Purpose
Franchize provides a reusable storefront plugin for motorbike crew pages under `/franchize/*`.

Public Interface

The module exposes:

- `getFranchizeBySlug(slug)` server loader returning `{ crew, items }`.
- Focused server-action modules under `app/franchize/server-actions/*` for catalog, config, promotions, orders, reviews, and rentals.
- `app/franchize/actions.ts` as the backward-compatible facade for existing imports.
- Route surfaces for slug-based catalog/cart/order/about/contacts/rentals/admin.
- Reusable UI shell components (`CrewHeader`, `CrewFooter`, floating cart variants).

Stable APIs

- `getFranchizeBySlug(slug: string)`
- `markCrewBikesAvailable(slug: string)`
- `loadFranchizeConfigBySlug(slug, actorUserId?)`
- `saveFranchizeConfig(input, actorUserId?)`
- `validateFranchizePromoCode(input)`
- `createFranchizeOrderCheckout(input)`
- `createFranchizeOrderInvoice(input)`
- `submitFranchizeOrderNotification(input)`
- `retryFranchizeOrderNotification(input)`
- `getFranchizeOrderNotificationFailures(input)`
- `getRentalReviewContext(input)`
- `submitRentalReview(input)`
- `getFranchizeRentalReviewsForModeration(input)`
- `moderateRentalReview(input)`
- `checkFranchizeCarsAvailability(input)`
- `getFranchizeRentalCard(slug, rentalId)`
- `reconcileRentalContractVerifierAttachment(input)`

Constraints

- Privileged DB writes stay server-side in `app/franchize/actions.ts`, `app/franchize/server-actions/*`, or server-only runtime utilities.
- Client modules may consume typed VMs and server-action facades only, never service-role clients or `actions-runtime.ts` directly.
- Internal route navigation remains SPA (`Link`) for same-origin pages.

Allowed Changes

Agents may:

- improve storefront UX composition and card/modals layouts
- extend metadata hydration with backward-compatible fallbacks
- add scoped pages/components under `/app/franchize`

Agents must NOT:

- break slug route contracts already linked from operators/Telegram
- remove fallback behavior for incomplete crew metadata
- move privileged operations into client bundles
