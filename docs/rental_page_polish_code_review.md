# Rental Page Polish — Code Review Addendum

## Issue 1: Renter identity source — `rentals.user_id` vs `private.rental_contract_artefacts.telegram_chat_id`

### Current state

`getFranchizeRentalCard()` (actions-runtime.ts:4810-4814) fetches the renter identity from:
```sql
SELECT rental_id, status, ..., user_id, owner_id, ...
FROM rentals WHERE rental_id = ?
```

So `renterId = rentals.user_id`. This works for rentals created via the **web app order flow** (user is authenticated via Telegram WebApp → `user_id` is set).

### Gap

For rentals created via the **bot/QR claim flow**, the contract is generated from passport data and stored in `private.rental_contract_artefacts` with:
- `telegram_chat_id` (renter's Telegram chat ID — known from bot interaction)
- `renter_full_name`, `renter_passport`, `renter_driver_license` (from OCR)
- `rental_id` FK to `public.rentals` (added in migration 20260618000001)

But the `rentals.user_id` column may be NULL or set to the bot's chat ID (not the renter's) for these flows. The `private.rental_contract_artefacts.telegram_chat_id` is the actual renter's chat ID.

### Impact

- `confirmVehicleReturn` line 1160: `if (rental.user_id)` — sends closure receipt to NULL → receipt silently skipped
- `confirmVehiclePickup` line 868: `notifyRentalLifecycle` fetches `user_id` for notification → bot-flow renters never get pickup confirmation
- `FranchizeRentalLifecycleActions` line 51: `if (dbUser.user_id === renterId)` — renter can't see "renter" role because `renterId` is empty → sees "guest" instead → can't upload photos

### Fix

`getFranchizeRentalCard` should ALSO query `private.rental_contract_artefacts` by `rental_id` and use `telegram_chat_id` as a fallback for `renterId` when `rentals.user_id` is null. Also surface `renter_full_name` so the page can display "Арендатор: Иван Иванович" instead of just an opaque ID.

## Issue 2: Rental page shows operator-only UI to everyone

### Current state

`/franchize/[slug]/rental/[id]/page.tsx` is a server component that renders the same UI for all visitors:
- `RentalChecklistPanel` (verification todos — operator-only concern)
- `RentalReturnChecklist` (return checklist — operator-only concern, but renter can see "what to return")
- `FranchizeRentalDocumentsPanel` (contract DOCX, photos — operator + renter)
- `FranchizeRentalLifecycleActions` (pickup/return/photo buttons — uses role internally, but renders for everyone)
- `RentalMessageInput` (send message to crew — renter-only)

### Gap

A renter viewing their own rental sees the operator's verification checklist (passport, license, odometer verification) — confusing because the renter doesn't need to verify their own documents. The renter should see:
- Their rental status
- Their contract (DOCX download)
- Their photos (start/end)
- "Message crew" input
- "Confirm pickup" / "Upload photos" buttons (renter-side actions)

An operator (crew owner/admin) sees:
- All of the above PLUS
- Verification checklist (todos)
- Return checklist (with toggle UI from BUG F fix)
- Pickup/return confirmation buttons
- Documents panel with admin actions

A visitor (not renter, not crew) should see minimal info: status, vehicle, dates — no actions, no checklists, no documents.

### Fix

Pass `renterId`, `ownerId`, `crewId` to the page (already done via `rental` prop), and use a server-side role check to conditionally render sections. Since the page is a server component, we can use the `dbUser` from cookies via `getCurrentUser()` or similar.

Actually, the cleanest approach: keep the page as a server component that fetches data, but move the role-gating into the existing client components (`FranchizeRentalLifecycleActions` already does this internally). For the other panels, wrap them in a new `<RentalRoleGuard role="operator">` that hides children from non-operators.

## Issue 3: `confirmVehicleReturn` receipt silently skipped when `user_id` is null

### Current state

In my BUG B fix (analytics-37), `confirmVehicleReturn` line 1160:
```ts
if (rental.user_id) {
  // send closure receipt via forward-telegram
}
```

If `rental.user_id` is null (bot-flow rental), the entire receipt block is skipped. No error, no warning — the operator thinks the renter was notified but they weren't.

### Fix

Fall back to `rental_contract_artefacts.telegram_chat_id` when `rentals.user_id` is null. Add a `logger.warn` when BOTH are null so the operator sees the receipt was skipped.

## Issue 4: `confirmVehiclePickup` notification uses `notifyRentalLifecycle` which also depends on `user_id`

Same issue as #3 but for pickup confirmation. The `notifyRentalLifecycle` function (line 30-62 of rentals/actions.ts) fetches `rentals.user_id` and uses it to look up `profiles.telegram_id`. If `user_id` is null, no notification is sent.

### Fix

Same as #3 — fall back to `rental_contract_artefacts.telegram_chat_id`.

## Summary of Polish Fixes

1. **`getFranchizeRentalCard`**: join `private.rental_contract_artefacts` by `rental_id`, expose `renterTelegramChatId` + `renterFullName` as fallbacks
2. **Rental page**: add role-based visibility for checklist panels (operator-only), keep documents + actions visible to renter
3. **`confirmVehicleReturn`**: use `renterTelegramChatId` fallback for receipt, log warning if both null
4. **`confirmVehiclePickup`**: same fallback for `notifyRentalLifecycle`
5. **`FranchizeRentalLifecycleActions`**: use `renterTelegramChatId` for renter role check when `renterId` is empty
