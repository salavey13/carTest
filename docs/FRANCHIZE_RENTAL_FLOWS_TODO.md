# TODO: franchize rental/order document flow alignment

Generated: 2026-06-18

## Scope checked

This note compares three ways a rental/sale document can be produced:

1. Telegram `/doc` manual command in `app/webhook-handlers/commands/doc-manual.ts`.
2. Rental photo/OCR skill in `scripts/make-rental-contract-skill.mjs` (plus the newer combined `scripts/make-deal-contract-skill.mjs`).
3. Franchize web app cart/order flow in `app/franchize/actions-runtime.ts` via `createFranchizeOrderCheckout` / `submitFranchizeOrderNotification`.

## Immediate UI fix done

- Catalog modal specs now prefer `cars.specs.spec_labels` for labels. The CSV bike dumps in `docs/sql/*bikes*.csv` store Russian translations under the JSONB `spec_labels` object, so modal chips like `power_kw`, `top_speed_kmh`, `weight_kg`, etc. should render as Russian labels when the catalog is hydrated from Supabase.
- If a spec key has no Russian translation, the old underscore-to-space fallback remains.

## Current flow map

### 1. Telegram `/doc` manual command

- Collects renter/buyer details directly in Telegram state: full name, passport, birth date, address, license/categories for rent, dates, deposit or STS pledge.
- Builds DOCX through `buildFranchizeDocxFromTemplate`.
- Sends DOCX + QR media group when QR succeeds; falls back to DOCX only.
- Persists verifier/document artifacts and can attach metadata to rentals.
- Uses QR deep link for quick repeat rental (`startapp=rent_<bike>_<sha>`).

### 2. Rental document skill/script

- Input is operator/OCR driven: passport JSON + license JSON + phrase/bike/date flags.
- Resolves bike from `cars`, derives bike identity and engine lines from `bike.specs`.
- Generates DOCX from rental template and sends to Telegram automatically.
- Also generates QR deep link, sends DOCX + QR when possible, and stores metadata/artifacts.
- Creates/links rental rows for availability tracking when possible.

### 3. Franchize web app cart/order flow

- User selects item(s), cart options, checkout details, and order is processed by `createFranchizeOrderCheckout` / `submitFranchizeOrderNotification`.
- `buildFranchizeOrderDocAndNotify` generates the document through `buildFranchizeDocxFromTemplate` and sends it to admin, user, and crew owner.
- It currently still generates QR for Telegram recipients, but product expectation says web app user should be treated as already creating the document themselves; QR should be considered bot/skill-specific unless deliberately kept for operator repeat-rental handoff.
- It tries to enrich renter fields from verified rental secrets and user-sensitive data, then falls back to placeholders.

## Differences / concerns to investigate later

### P0 — Decide QR policy for web app

- Requirement says QR is specific for `/doc` and skill flows, while web app should use the current user directly.
- Current web app notification path still builds and sends QR media groups.
- Decide whether to remove QR from web app delivery, keep QR only for admin/crew owner, or keep it behind an explicit feature flag.

### P0 — One canonical document variable builder

- `/doc`, skill script, and web app each build overlapping variables independently: renter identity, bike identity, price, deposit, dates, engine lines, verifier metadata.
- This risks different DOCX output for the same bike/renter/dates.
- Extract shared rental variable construction into a reusable module and make all three flows call it.

### P0 — Date/time parity

- `/doc` captures start/end date + time.
- Skill can parse phrase dates/times and has explicit flags in the combined deal script.
- Web cart primarily passes dates, while `buildFranchizeOrderDocAndNotify` currently hardcodes `rent_start_time` and `rent_end_time` as `12:00`.
- Investigate cart UI payload and store exact times or intentionally document all-day rental semantics.

### P1 — Deposit/STS pledge parity

- `/doc` supports deposit confirmation, custom deposit, and STS-instead-of-deposit.
- Skill supports deposit defaults and has STS pledge notes in skill docs, but needs parity confirmation against current script flags and metadata.
- Web cart currently uses crew defaults for deposit and does not expose STS pledge or explicit deposit confirmation.

### P1 — Rental row / artifact linkage parity

- `/doc` and skill paths actively persist document artifacts and verifier hashes.
- Web order path attaches verifier metadata only if it finds a rental row by `metadata->>orderId`.
- Confirm checkout always creates this rental row before document notification, otherwise generated docs can be sent without rental linkage.

### P1 — Identity data completeness

- `/doc` manually collects passport/address/license fields.
- Skill uses OCR JSON and therefore can be richer/more precise.
- Web cart relies on current user, verified rental secrets, sensitive profile data, and placeholders.
- Add a preflight checklist in web checkout that shows which legally required fields are verified vs placeholders before generating final DOCX.

### P2 — Sale vs rental template behavior

- `/doc` supports sale in a shorter 5-step flow.
- Combined deal skill supports sale with passport-only flow.
- Web order uses `flowType` (`rental`, `sale`, `mixed`) but needs verification that cart sale/mixed orders use the same sale template variables and artifact tables as `/doc`/skill.

### P2 — Multi-item cart semantics

- The web flow accepts multiple cart lines but document variables mostly use the first cart line/bike for vehicle identity.
- `/doc` and skill are single-bike flows.
- Decide whether web checkout should block multi-bike rental documents, generate one document per bike, or support an appendix table for multiple bikes.

### P2 — Price parity

- `/doc` can use dynamic bike prices and operator overrides.
- Skill derives hourly/daily/deposit/value from `bike.specs` and CLI fallback.
- Web flow uses cart subtotal/extras plus first-line daily price and crew defaults for deposit/value.
- Create a shared price resolver so DOCX fields match invoice/cart totals and bike specs consistently.

## Suggested next implementation sequence

1. Add a feature flag / delivery option for web QR behavior and align with product decision.
2. Extract a shared `buildRentalContractVariables(...)` module from the strongest current implementation.
3. Make `/doc`, skill script, and web order flow call the shared builder or produce a normalized JSON contract payload first.
4. Add regression tests that snapshot the variable payload for the same bike/renter/date across all three flows.
5. Add web checkout preflight status for passport/license/address/deposit/date completeness.
