# PRD: Set Phone Button/Modal on Rental Page

## Problem

When an operator creates a rental via the `/doc` bot command and **skips the phone input step**, the rental page shows "Телефон: —" with no way to add it later. The operator currently has no UI to retroactively set the phone — they must re-run `/doc` or edit the DB directly.

Without a phone, the renter:
- Cannot receive the QR code via Telegram
- Cannot link their personal Telegram account to the rental
- Cannot receive rental notifications

The `/doc` bot command already sends a "Атата!" shaming message when phone is skipped, but there's no **remediation path** — the operator can't fix it from the rental page.

## Solution

Add a **"📞 Указать телефон"** button + modal on the franchize rental page, visible to operators/admins/owners when the phone is missing (or to edit an existing phone). The modal follows the exact same pattern as the existing `RentalExtendModal` (hand-rolled, no Radix/shadcn Dialog).

## User Flow

1. Operator opens `/franchize/{slug}/rental/{id}`
2. Sees the phone display block: "Телефон: —" (or existing phone)
3. Next to it, a small "📞 Указать телефон" button (or "✏️ Изменить" if phone exists)
4. Click → modal opens with:
   - Context card (bike title, renter name, rental ID short)
   - Single `<input type="tel">` field with `+7 999 123-45-67` placeholder
   - "Сохранить" + "Отмена" buttons
5. Operator enters phone → "Сохранить"
6. Modal closes, toast "Телефон сохранён", page refreshes
7. Phone now displays on the page, QR code flow becomes available

## Technical Design

### Server Action: `setRentalPhone` in `app/rentals/actions.ts`

```typescript
interface SetRentalPhoneInput {
  rentalId: string;
  phone: string;  // raw user input
}

interface SetRentalPhoneResult {
  success: boolean;
  error?: string;
}
```

**Logic:**
1. Validate `rentalId` (UUID regex — same as `extendRental`)
2. Normalize phone to E.164 (`+7XXXXXXXXXX`):
   - Strip all non-digits
   - Handle `8XXXXXXXXXX` → `+7XXXXXXXXXX`
   - Handle `7XXXXXXXXXX` → `+7XXXXXXXXXX`
   - Handle `XXXXXXXXXX` → `+7XXXXXXXXXX`
   - Validate: must be 11 digits starting with 7
3. Caller auth: `cookies().get("tg_user_id")`
4. Fetch rental: `rental_id, owner_id, crew_id`
5. Authorization: caller must be owner OR crew operator (crew_members role in `[owner, admin, co_owner]`) OR global admin
6. **UPDATE `private.rental_contract_artifacts` SET `renter_phone = normalizedPhone` WHERE `rental_id = rentalId`** — this is what the rental page reads
7. Best-effort: UPDATE `private.user_rental_secrets` SET `renter_phone = normalizedPhone` WHERE `source_rental_id = rentalId` (keeps next-rent prefill consistent)
8. Best-effort: UPDATE `public.rentals` SET `metadata = metadata || '{"renter_phone": "normalizedPhone"}'::jsonb` WHERE `rental_id = rentalId` (keeps leads/todos pipeline consistent)
9. Return `{ success: true }`

### Component: `RentalSetPhoneModal.tsx`

Clone of `RentalExtendModal.tsx` with:
- Props: `{ rentalId, currentPhone?, accentColor, accentTextOn, borderColor, textPrimary, textSecondary, triggerClassName?, triggerStyle?, bikeTitle, renterName }`
- State: `open`, `phone` (initialized from `currentPhone`), `isPending`
- Trigger: `<button id="set-phone-modal-trigger">📞 Указать телефон</button>` (or "✏️ Изменить" if phone exists)
- Modal body: context card + `<input type="tel">` + Save/Cancel buttons
- On submit: dynamic import `setRentalPhone` → call → toast → close → `router.refresh()`
- Same Escape/scroll-lock/autofocus/click-outside pattern as RentalExtendModal

### Page Integration: `app/franchize/[slug]/rental/[id]/page.tsx`

Replace the read-only phone block (lines 371-385) with:

```tsx
<FranchizeRentalRoleGuard allowedRoles={["operator", "admin", "owner"]} ...>
  <div className="flex items-center gap-2">
    <span>Телефон:</span>
    <span className="font-mono">{rental.renterPhone || "—"}</span>
    <RentalSetPhoneModal
      rentalId={rental.rentalId}
      currentPhone={rental.renterPhone}
      bikeTitle={rental.bikeTitle}
      renterName={rental.renterFullName}
      ...
    />
    {rental.renterPhone && <RentalLink href="...leads?phone=...">→ в лидах</RentalLink>}
  </div>
</FranchizeRentalRoleGuard>
```

For renters/guests: keep the existing read-only display (no edit button).

### Phone Normalization

```typescript
function normalizePhoneToE164(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 10) digits = "7" + digits;
  if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
  return null;
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/rentals/actions.ts` | **Add** `setRentalPhone` server action (after `extendRental`) |
| `app/franchize/components/RentalSetPhoneModal.tsx` | **Create** — clone of RentalExtendModal with tel input |
| `app/franchize/[slug]/rental/[id]/page.tsx` | **Modify** — wrap phone display in RoleGuard, add SetPhoneModal for operators |

## No DB Migration Needed

`renter_phone` columns already exist on:
- `private.rental_contract_artifacts` (what the page reads)
- `private.user_rental_secrets` (canonical store for next-rent prefill)
- `public.rentals.metadata->>renter_phone` (derived pipeline)

## Acceptance Criteria

- [ ] Operator sees "📞 Указать телефон" button when phone is missing
- [ ] Operator sees "✏️ Изменить" button when phone exists
- [ ] Modal opens with tel input, prefilled if phone exists
- [ ] Invalid phone format → toast error, modal stays open
- [ ] Valid phone → toast success, modal closes, page refreshes with new phone
- [ ] Renter/guest sees read-only phone (no button)
- [ ] Phone is normalized to `+7XXXXXXXXXX` format
- [ ] After setting phone, QR code flow becomes available to renter
- [ ] Authorization: only operators/admins/owners can set phone

## Bonus: Fix POI Editor Button

The "POI Editor" button on `/admin` page (`app/admin/page.tsx` line 147) currently points to `/franchize/${crewSlug}/map-riders` (the live map) instead of `/admin/map-routes` (the actual POI/route editor). Fix: change `href` to `/admin/map-routes`.
