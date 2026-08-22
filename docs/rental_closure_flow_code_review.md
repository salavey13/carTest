# Rental Closure Flow — Code Review

## File Inventory (21 files reviewed)

| # | Path | Role |
|---|------|------|
| 01 | `app/franchize/[slug]/rental/[id]/page.tsx` (555 lines) | Dedicated rental detail page (server component) |
| 02 | `boss-commands/evening-summary.sh` (126 lines) | Daily 21:00 MSK digest with KPIs |
| 03 | `boss-commands/returns-reminder.sh` (85 lines) | Hourly check for returns due in next 3h |
| 04 | `app/franchize/server-actions/rentals.ts` (721 lines) | `getRentalReturnTodos` (fetch only) |
| 05 | `app/franchize/server-actions/rentals-dashboard.ts` (2846 lines) | `updateRentalStatus` (full version with odometer) |
| 06b | `app/franchize/[slug]/rentals-analytics/analytics-components/RentalStatusChangeModal.tsx` (125 lines) | Status picker (no odometer/notes inputs) |
| 07 | `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx` (1482 lines) | Analytics client with `handleMarkComplete` |
| 08 | `app/franchize/[slug]/rentals-analytics/RentalHandoffModal.tsx` (664 lines) | Full handout/return checklist (odometer, fuel, damage, deposit) |
| 09 | `app/franchize/server-actions/rental-activation.ts` (372 lines) | 2-step activation (odometer_before) |
| 10 | `app/franchize/server-actions/rental-handoffs.ts` (429 lines) | Persist handout/return checklist data |
| 11 | `app/franchize/server-actions/rental-verification-todos.ts` (341 lines) | Creates 5 START verification todos (no closure todos) |
| 12 | `app/franchize/server-actions/checklist.ts` (320 lines) | Checklist state mgmt |
| 13 | `app/franchize/[slug]/rentals-analytics/analytics-components/ChecklistPanel.tsx` (141 lines) | Verification checklist UI |
| 14 | `app/franchize/[slug]/rentals-analytics/analytics-components/RentalRowActions.tsx` (319 lines) | Per-row actions (mark complete, handoff, etc.) |
| 15 | `app/franchize/components/FranchizeRentalLifecycleActions.tsx` (244 lines) | Lifecycle buttons on `/rental/[id]` page |
| 16 | `app/franchize/components/RentalReturnChecklist.tsx` (113 lines) | Read-only return checklist on `/rental/[id]` |
| 17 | `app/franchize/components/RentalChecklistPanel.tsx` (333 lines) | Verification checklist UI on `/rental/[id]` |
| 18 | `app/rentals/actions.ts` (1099 lines) | `confirmVehicleReturn` (USED BY DEDICATED PAGE) |
| 19 | `boss-commands/_lib.sh` (414 lines) | `rental_link()` → `tg_deep_link "rental_${id}"` |
| 20 | `hooks/useStartParamRouter.ts` (679 lines) | `rental_<id>` → analytics page (NOT `/rental/[id]`) |
| 21 | `app/franchize/server-actions/rental-secrets-claim.ts` | QR claim flow |

## Bugs Found

### BUG A (CRITICAL): Deep links go to analytics, not the dedicated rental page

**`hooks/useStartParamRouter.ts:538-546`** routes `rental_<id>` deep links to `/franchize/<slug>/rentals-analytics?ui=v2&rentalId=<id>` (analytics drawer), **NOT** to `/franchize/<slug>/rental/<id>` (the dedicated page with full closure UI).

```typescript
// Current (line 538-546):
} else if (paramToProcess.startsWith("rental_")) {
  const parsed = parseRentalDetailDeepLink(paramToProcess);
  if (parsed) {
    const crewSlug = userCrewInfo?.slug || "vip-bike";
    targetPath = `/franchize/${crewSlug}/rentals-analytics?ui=v2&rentalId=${parsed.rentalId}`;
    // ^^^^^^^^^ WRONG — should go to /rental/{id} where the closure UI lives
  }
}
```

**Impact:** `boss-commands/returns-reminder.sh:48` calls `rental_link "$rid"` which produces `tg_deep_link "rental_${rid}"` → user taps → opens analytics drawer → no "Close rental" button there. Users can't close rentals from notifications.

**Fix:** Route `rental_<id>` (single segment, no slug) to `/franchize/<slug>/rental/<id>`. The analytics variant should require an explicit `analytics_rental_<id>` prefix (which already exists at line 547-559).

---

### BUG B (CRITICAL): `confirmVehicleReturn` skips essential closure steps

**`app/rentals/actions.ts:1025-1064`** is what the dedicated rental page calls when the operator taps "Подтвердить возврат". It only:
1. Sets `status = 'completed'`
2. Sets `payment_status = 'fully_paid'`
3. Sets `metadata.return_confirmed_at`
4. Creates an event row
5. Calls `notifyRentalLifecycle`

It does NOT:
- ❌ Capture `odometer_after` (final odometer) → bike's `last_known_odometer` never updates
- ❌ Capture `return_notes` / `damage_notes` (no condition record)
- ❌ Compute overage charges (mileage overage, late return penalty)
- ❌ Update `cars.specs.last_known_odometer` (the dashboard version does this — line 2076-2096 of `rentals-dashboard.ts` — but `confirmVehicleReturn` does NOT)
- ❌ Create closure todos (e.g., "Inspect bike for damage", "Process deposit refund", "Send review request")
- ❌ Send summary notification to renter (just lifecycle event, no receipt)
- ❌ Check for `RentalHandoffModal` return-phase completion (operator can close without filling the return checklist)

**Impact:** "Never closed previously" — when operators click "Подтвердить возврат" on the dedicated page, the rental IS marked completed but with no final odometer, no damage record, no deposit refund tracking. The next renter starts with stale odometer info.

**Fix:** Update `confirmVehicleReturn` to accept `odometerAfter`, `returnNotes`, `damageNotes` and:
1. Save them to `rentals.metadata`
2. Update `cars.specs.last_known_odometer` (mirror what `updateRentalStatus` does)
3. Create closure todos (`createRentalClosureTodos` — new function, mirrors `createRentalVerificationTodos`)

---

### BUG C (HIGH): No closure todos are ever created

**`app/franchize/server-actions/rental-verification-todos.ts`** creates 5 START verification todos (passport, license, odometer, dates) when a rental is created.

There is NO equivalent function for closure. When a rental becomes `active` (or as the return date approaches), the system should create closure-prompting todos like:
- "Inspect bike for damage on return"
- "Process deposit refund"
- "Send review request to renter"
- "Update bike's last_known_odometer"
- "Mark rental as completed in dashboard"

**Impact:** Operators get reminders for rental START (verification todos + boss-command notifications) but NOTHING for rental END. Returns are forgotten, rentals stay "active" forever, deposits are not refunded, bikes aren't inspected.

**Fix:** Add `createRentalClosureTodos(rentalId, crewId, leadId?)` that creates 5 closure todos. Call it from `confirmVehiclePickup` (when rental becomes active) so the closure todos appear in the operator's todo list throughout the rental period.

---

### BUG D (HIGH): `returns-reminder.sh` has dead code + broken notification format

**`boss-commands/returns-reminder.sh:42-52`** builds `NEW_RETURNS` with deep links:
```bash
NEW_RETURNS=$(echo "$RETURNS_DATA" | jq -r '
  .[] |
  "RENTAL:\(.rental_id):\(.vehicle_id):\(.user_id[0:8]):\(.agreed_end_date[11:16]):\(.total_cost // 0)"
' | while IFS=: read -r prefix rid vid uid time cost; do
  if ! already_alerted "returns" "$rid" 43200; then
    local rlink
    rlink=$(rental_link "$rid")
    echo "• $vid → клиент ${uid}… | до $time UTC | ${cost} ₽\n  📋 <a href=\"${rlink}\">Открыть</a>"
    record_alert "returns" "$rid"
  fi
done)
```

Then **line 64-68 OVERWRITES `RETURNS_LIST` with a different format that has NO deep links:**
```bash
RETURNS_LIST=$(echo "$RETURNS_DATA" | jq -r '
  map(
    "• \(.vehicle_id) → клиент \(.user_id[0:8])… | до \(.agreed_end_date[11:16]) UTC | \(.total_cost // 0) ₽"
  ) | join("\n")
')
```

**Impact:** The deep links built in lines 42-52 are silently discarded. The actual notification (line 73) uses `RETURNS_LIST` from the overwrite (line 64-68), which has NO "📋 Открыть" links. Users can't tap to open the rental.

**Fix:** Remove the overwrite on lines 64-68. Use the `NEW_RETURNS` variable (which has the deep links) directly in the message.

---

### BUG E (HIGH): `evening-summary.sh` lists rentals but no per-rental deep links

**`boss-commands/evening-summary.sh:104-118`** sends a daily digest with KPIs and links to the analytics dashboard, but does NOT list individual open rentals with tappable "Open" links.

The rentals data (line 28-29) includes `rental_id`, but the jq filter (line 31-39) only computes KPIs — it never builds a per-rental list.

**Impact:** Operator gets "Активных: 3" but no way to tap into any of those 3 active rentals. They have to manually open the dashboard, find the rentals tab, find the row, and click.

**Fix:** Add a "📋 Активные аренды:" section with up to 5 active rentals, each with a "Открыть" deep link to the rental detail page.

---

### BUG F (MEDIUM): `RentalReturnChecklist` is read-only — operators can't check items off

**`app/franchize/components/RentalReturnChecklist.tsx`** fetches `getRentalReturnTodos` and DISPLAYS them with ✓/○ markers based on `todo.status === "done"`. But there's NO UI to toggle a todo's status — it's purely a display.

**Impact:** Operators see the checklist on the dedicated rental page but can't act on it. They'd have to go to a separate todo-management page (which doesn't seem to exist on the dedicated `/rental/[id]` page) to mark items done.

**Fix:** Add a "Отметить выполненным" button next to each todo that calls a new `toggleRentalReturnTodo` server action.

---

### BUG G (MEDIUM): `FranchizeRentalLifecycleActions.confirmVehicleReturn` doesn't prompt for closure data

**`app/franchize/components/FranchizeRentalLifecycleActions.tsx:163-185`** has a "Подтвердить возврат" button that calls `confirmVehicleReturn(rentalId, dbUser.user_id)` with NO arguments for odometer, notes, damage.

```tsx
const result = await confirmVehicleReturn(rentalId, dbUser.user_id);
```

**Impact:** Even if we fix `confirmVehicleReturn` to accept closure data (BUG B), the UI never sends it.

**Fix:** Replace the simple button click with a modal that prompts for:
- Odometer reading (number input, prefilled with `cars.specs.last_known_odometer` + `rentals.metadata.odometer_before`)
- Damage notes (textarea)
- Deposit returned? (checkbox)
- Then call `confirmVehicleReturn(rentalId, userId, { odometerAfter, damageNotes, depositReturned })`

---

### BUG H (LOW): `useStartParamRouter.ts` has two competing `rental_` handlers

**Line 538-546** handles `rental_<id>` (single segment).
**Line 608-618** also handles `rental_` and `rentals_` (with optional slug in middle: `rental_<slug>_<id>`).

The line 538 handler wins (it's earlier in the if-else chain), so the slug-aware variant at line 608 is dead code for `rental_<id>` payloads. The line 608 variant would correctly route `rental_<slug>_<id>` to `/franchize/<slug>/rental/<id>` but it never runs because line 538 catches `rental_<id>` first.

**Fix:** Remove the line 538-546 handler (or make it explicit about analytics: change to `analytics_rental_<id>` which is already handled at line 547-559). Then line 608-618 handles `rental_<id>` correctly.

---

### BUG I (LOW): `confirmVehicleReturn` doesn't verify handoff return-phase completion

**`app/rentals/actions.ts:1028`** fetches `rentals` row but doesn't check if `rental_handoffs.return` was filled (operator could close rental without doing the return checklist). Should warn or block.

**Fix:** Optional check — fetch `rental_handoffs` row, warn if `return.odometer_end` is null but proceed anyway (don't hard-block, in case operator is doing emergency close).

---

### BUG J (LOW): `confirmVehicleReturn` doesn't verify actor is crew member (only `owner_id`)

**`app/rentals/actions.ts:1030`** checks `rental.owner_id !== userId`. But the `updateRentalStatus` function in `rentals-dashboard.ts:1968-1988` allows owners, admins, orudjov, and crew members.

**Impact:** Crew members can close rentals via the analytics dashboard (which calls `updateRentalStatus`) but NOT via the dedicated rental page (which calls `confirmVehicleReturn`).

**Fix:** Mirror the auth check from `updateRentalStatus`: also allow admins + crew_members with role owner/admin/co_owner.

---

## Summary

| Bug | Severity | Component | Status |
|-----|----------|-----------|--------|
| A | CRITICAL | useStartParamRouter | Deep links go to analytics, not /rental/[id] |
| B | CRITICAL | confirmVehicleReturn | Skips odometer/notes/overage/closure todos |
| C | HIGH | rental-verification-todos | No closure todos ever created |
| D | HIGH | returns-reminder.sh | Deep links built then silently overwritten |
| E | HIGH | evening-summary.sh | No per-rental deep links in digest |
| F | MEDIUM | RentalReturnChecklist | Read-only — can't toggle items |
| G | MEDIUM | FranchizeRentalLifecycleActions | No closure-data prompt before confirm |
| H | LOW | useStartParamRouter | Two competing rental_ handlers (dead code) |
| I | LOW | confirmVehicleReturn | No handoff return-phase verification |
| J | LOW | confirmVehicleReturn | Auth too strict (owner-only, no crew members) |

## Recommended Fix Order

1. **BUG A + BUG H**: Fix deep link routing → rentals go to `/rental/[id]`
2. **BUG D**: Fix returns-reminder.sh deep link overwrite
3. **BUG E**: Add per-rental links to evening-summary.sh
4. **BUG B + BUG J**: Upgrade `confirmVehicleReturn` to accept closure data + relax auth
5. **BUG C**: Create `createRentalClosureTodos` function + call from `confirmVehiclePickup`
6. **BUG G**: Add closure-data modal to `FranchizeRentalLifecycleActions`
7. **BUG F**: Add toggle UI to `RentalReturnChecklist`
8. **BUG I**: Add handoff verification warning (non-blocking)
