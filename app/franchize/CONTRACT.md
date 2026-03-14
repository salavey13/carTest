Purpose
Franchize provides a reusable storefront plugin for motorbike crew pages under `/franchize/*`.

Public Interface

The module exposes:

- `getFranchizeBySlug(slug)` server loader returning `{ crew, items }`
- route surfaces for slug-based catalog/cart/order/about/contacts/rentals/admin
- reusable UI shell components (`CrewHeader`, `CrewFooter`, floating cart variants)

Stable APIs

- `getFranchizeBySlug(slug: string)`
- `createFranchizeCrew(input)`
- `saveCrewMetadata(input)`
- `saveFranchizeMetadata(input)`

Constraints

- Privileged DB writes stay server-side in `app/franchize/actions.ts`.
- Client modules may consume typed VMs only, never service-role clients.
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
