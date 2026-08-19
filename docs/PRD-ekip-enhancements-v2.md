# PRD: /ekip Equipment Rental Enhancements + Equipment Template Fixes

**Document Version:** 2.0
**Date:** 2026-08-20
**Status:** Ready for implementation
**Author:** Previous AI agent (session 2026-08-19 → 2026-08-20)
**Target:** Next AI agent / iteration

---

## 0. Context & Session Summary (What Was Done)

The previous session (2026-08-19 → 2026-08-20) accomplished the following:

### Commits pushed to main:

1. `22a3a755` — hotfix: /ekip handler was intercepting /doc's `eq_done` callback (added `_ekip` marker check)
2. `0248aad1` — fix(admin): bike list showed only 11 items (`getEditableVehiclesForUser` `.single()` bug for multi-membership users)
3. `4972f392` — feat(shift): show earned amount on /shift close + per-member digest note
4. `b2166c92` — fix(doc): price override now reflected in contract + deposit payment method shown
5. `be1533fc` — fix(shift+doc): shift money closure timing bug + /doc missing `crew_id` in rental insert
6. `68057434` — feat(skill): jacket/pants/boots + priceOverride + depositMethod flags
7. `65fb5729` — docs(ekip): Appendix B — 5 future enhancements documented
8. `d9cf0b7b` — fix(skill): equipment bike resolution + crew HTML template + no deposit for equipment

### Key data created in Supabase (live):

- Rental `b5707303` (bike: Ducati Panigale S Electro Black Z, renter: Шонов Дмитрий Николаевич, 12000₽ override, 20000₽ cash deposit, status=active, hotswapped with Aero)
- Equipment rental `b938ba57` (1 helmet XL Бело-синий Текстиль 1000₽ + 1 jacket L Текстиль gift 0₽, no deposit)
- Meta helmet `the-meta-helmet` (sizes XS-XXL, 4 colors, 2 materials, qty=20)
- All 4 active shifts closed (including 1 zombie from Aug 2025)

### Template wording fix (this commit):

- `damage_notes_at_return` was hardcoded "от даты возврата **ТС**" (vehicle) — for equipment rentals it should say "от даты возврата **экипировки**"
- Fixed in both `scripts/make-rental-contract-skill.mjs` and `app/lib/rental-contract-vars.ts`

---

## 1. Problem Statement

### Current State
- `/ekip` command works for basic equipment rental flow (category → items → name → passport → schedule → payment → confirm)
- Equipment items are stored in `cars` table with `type='equipment'`
- Contract generation uses crew-specific HTML templates
- Price override + deposit payment method + jacket/pants/boots flags were added to the skill script
- No deposit for equipment rentals (user confirmed: "there is no such thing as deposit for equipment")

### What's Missing
1. **Subcategory preselection** — operators scroll through pages of jackets to find leather vs textile
2. **Photo preview** — operators can't verify they selected the right item (hard to ID by name alone)
3. **Size display** — multi-variant items (like `the-meta-helmet` with `specs.sizes` array) show no size in the button
4. **Color/material selection** — multi-variant items need variant picker (size + color + material)
5. **Admin photo upload** — no "items without photos" section (mirrors bikes-without-VIN pattern)
6. **Equipment template wording** — some template vars use "ТС" (vehicle) wording for equipment contracts

---

## 2. Key Files to Review Before Starting

The next AI agent MUST read these files before writing any code:

### Core /ekip flow:
- `app/webhook-handlers/commands/ekip-manual.ts` — the /ekip command handler (1762 lines). Contains: state machine, callback routing (`handleEkipCallback`), text input (`handleEkipText`), keyboard builders, equipment catalog queries.
- `app/webhook-handlers/commands/command-handler.ts` — callback routing whitelist (lines 70-120). The `/ekip` handler is called for ALL callback_query events BEFORE `/doc`. The `_ekip` marker check (added in commit `22a3a755`) prevents `/ekip` from intercepting `/doc` callbacks.

### Equipment catalog:
- `app/franchize/server-actions/get-crew-vehicles.ts` — fetches crew vehicles by slug
- The `cars` table has equipment items with `type='equipment'`. Key `specs` fields:
  - `specs.size` (string, singular) — for single-size items (e.g., "L")
  - `specs.sizes` (array) — for multi-variant items (e.g., ["XS", "S", "M", "L", "XL", "XXL"])
  - `specs.colors` (array) — for multi-color items (e.g., ["Чёрный", "Бело-синий", "Красный", "Белый"])
  - `specs.materials` (array) — for multi-material items (e.g., ["Текстиль", "Кожа"])
  - `specs.subtype` (string) — for subcategory filtering (e.g., "leather" or "textile")
  - `specs.quantity` (number) — available quantity
  - `image_url` (string) — photo URL (may be empty/null for items without photos)

### Contract generation:
- `scripts/make-rental-contract-skill.mjs` — the skill script that generates rental + equipment contract DOCX files. Has `--type equipment` flag, `--priceOverride`, `--jacket`, `--depositMethod` flags. Uses crew-specific HTML templates.
- `app/lib/rental-contract-vars.ts` — canonical variable builder for rental contracts. Has `isEquipmentMode` flag, `priceOverridden` flag, `depositPaymentMethod` var.
- `docs/crewDocs/vip-bike_RENTAL_DEAL_TEMPLATE.html` — bike rental template (has quick table)
- `docs/crewDocs/vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html` — equipment rental template (has quick table, but section 4.3 mentions deposit — should be conditional/zero for equipment)

### Admin panel:
- `app/franchize/components/FranchizeAdminClient.tsx` — admin page. Has VIN audit section (bikes without VIN → click → scroll to edit form). Needs a parallel "equipment without photos" section.
- `app/franchize/components/CarSubmissionForm.tsx` (if exists) — the form for adding/editing vehicles, including photo upload

### Callback prefixes (CRITICAL — do NOT collide with /doc):
- `/doc` uses: `eq_*`, `ecat_*`, `epg_*`, `eq_done`, `cancel`, `restart`, `ok`, `correct_step`
- `/ekip` uses: `eq_*`, `ecat_*`, `epg_*`, `eq_done` (shared with /doc — but the `_ekip` marker check prevents collisions)
- **NEW prefixes for /ekip enhancements** (must be UNIQUE — not shared with /doc):
  - `eksub_*` — subcategory selection (e.g., `eksub_leather`, `eksub_textile`, `eksub_all`)
  - `ekvar_*` — variant selection (e.g., `ekvar_size_XL`, `ekvar_color_Чёрный`, `ekvar_material_Кожа`)
  - `ekphoto_*` — photo preview (e.g., `ekphoto_<item_id>`)

### Tests:
- `tests/franchize/salary-calculations.spec.ts` — 8 tests for salary actions
- `tests/franchize/team-earnings.spec.ts` — 7 tests for team earnings
- `tests/franchize/my-work.spec.ts` — 4 tests for my-work actions
- `tests/franchize/cash-transactions.spec.ts` — 4 tests (has `fallbackChain` helper for mock chains)
- No existing tests for /ekip flow — consider adding

### Skill descriptions:
- `docs/PLAN-ekip-command.md` — the /ekip PRD (has Appendix B with 5 planned enhancements)
- `skills/shift-tracker-text/SKILL.md` — shift skill (has per-member earnings note)
- `skills/rental-ops-text/SKILL.md` — rental ops skill (has skill-author warning about status='pending_confirmation')

---

## 3. Requirements

### B.1: Subcategory preselection (leather/textile) for jackets, pants, suits

**User story**: After selecting "Куртки" category, show subcategory buttons:
```
📦 Куртки — выберите тип:
[🟤 Кожа] [🔵 Текстиль] [📦 Все]
```

**Implementation**:
- New callback prefix: `eksub_` (e.g., `eksub_leather`, `eksub_textile`, `eksub_all`)
- New state: `equipment_subcategory` in `EkipFlowContext`
- New keyboard builder: `buildSubcategoryKeyboard(category, items)` — shows buttons for each `subtype` found in the category's items + "Все"
- In `handleEkipCallback`: add `if (callbackData.startsWith("eksub_"))` handler
- Filter items by `item.specs?.subtype === context.equipmentSubcategory` when subcategory is set
- Reset subcategory when going back to category list (`ecat_back`)
- The `_ekip` marker check already prevents /doc from intercepting these callbacks

**Edge cases**:
- Items without `specs.subtype` → show in "Все" only
- Category with only one subtype → skip subcategory step, go straight to items
- Category with no items matching the selected subtype → show "Нет товаров" message

### B.2: Photo preview for selected equipment items

**User story**: After an operator clicks an equipment item (`eq_<id>`), the bot sends a photo via `sendPhoto` API if `item.image_url` is set. If no photo exists, skip silently.

**Implementation**:
- In the `eq_<id>` handler (line ~1111 of ekip-manual.ts), AFTER toggling the item in `selectedIds` and showing the updated keyboard:
  ```typescript
  // Send photo if available (silent if missing)
  if (equipment.image_url && equipment.image_url.trim()) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto?chat_id=${chatId}&photo=${encodeURIComponent(equipment.image_url)}&caption=${encodeURIComponent(`📷 ${equipment.make} ${equipment.model}`)}`);
    } catch (e) {
      // Silent — don't break the flow if photo URL is broken
    }
  }
  ```
- No new callback prefix needed — photo is sent as a side effect of `eq_<id>` toggle
- Handle missing photo: if `image_url` is empty/null/undefined → skip silently (NO error, NO placeholder)
- Handle broken URL: wrap in try/catch, log warning, continue

### B.3: Size display in equipment item buttons

**User story**: Item buttons should show size info. Single-size items show `(L)`, multi-size items show `(XS, S, M, L, XL, XXL)`.

**Implementation**:
- In `buildCategoryItemsKeyboard` (line ~255 of ekip-manual.ts), change the size extraction:
  ```typescript
  // Before:
  const size = item.specs?.size ? ` (${item.specs.size})` : "";
  
  // After:
  const size = item.specs?.size
    ? ` (${item.specs.size})`
    : item.specs?.sizes?.length
      ? ` (${item.specs.sizes.join(", ")})`
      : "";
  ```

### B.4: Color/material selection for multi-variant items

**User story**: For items like `the-meta-helmet` that have `specs.sizes`, `specs.colors`, `specs.materials`, after selecting the item, show a variant picker.

**Implementation**:
- New callback prefix: `ekvar_` (e.g., `ekvar_size_XL`, `ekvar_color_Бело-синий`, `ekvar_material_Текстиль`)
- New state: `equipmentVariants` in `EkipFlowContext` (array of `{ itemId, size, color, material }`)
- New keyboard builder: `buildVariantKeyboard(item)` — shows size buttons, then color, then material (sequential)
- In `handleEkipCallback`: add `if (callbackData.startsWith("ekvar_"))` handler
- After all 3 selections (size + color + material), show "✅ Готово" button to confirm the variant
- Prevents "Занят" balloon: track quantity per variant, not per item ID

**Edge cases**:
- Item with only `specs.size` (singular) → skip variant picker, use the single size
- Item with no size/color/material → skip variant picker entirely
- Item with `specs.sizes` but no colors/materials → show only size picker

### B.5: Admin equipment photo upload (mirror bikes-without-VIN)

**User story**: Admin page shows "Equipment without photos" section. Click → scroll to bottom where CarSubmissionForm's photo upload field is.

**Implementation**:
- In `FranchizeAdminClient.tsx`, add a `photoAudit` useMemo (parallel to `vinAudit`):
  ```typescript
  const photoAudit = useMemo(() => {
    const target = fleet.filter((item) => item.type === "equipment");
    const missing = target.filter((item) => !item.image_url || item.image_url.trim() === "");
    return { total: target.length, withPhoto: target.length - missing.length, missing };
  }, [fleet]);
  ```
- Render a "Фото экипировки" panel (parallel to the existing VIN audit panel):
  ```
  Фото аудит: X / Y заполнено
  Пустых фото: Z — нажмите на экипировку чтобы загрузить:
  [⚠ TCM Speed Level (equip-jacket-tcm-speed-level) → Загрузить фото →]
  ```
- Click handler: `handleQuickEditMissingPhoto(vehicleId)` — same scroll-to-bottom pattern as `handleQuickEditMissingVin`
- Verify photo compression + storage path: `carpix/<id>/image_1.jpg`

### B.6: Equipment template wording fix (DONE in this commit)

**Issue**: `damage_notes_at_return` was hardcoded "от даты возврата **ТС**" (vehicle) for all contracts. For equipment rentals, should say "от даты возврата **экипировки**".

**Fix** (already applied):
- `scripts/make-rental-contract-skill.mjs` line 726: conditional `isEquipmentRental ? 'от даты возврата экипировки' : 'от даты возврата тс'`
- `app/lib/rental-contract-vars.ts` line 851: conditional `isEquipmentMode ? "от даты возврата экипировки" : "от даты возврата ТС"`

### B.7: Equipment template — section 4.3 deposit wording

**Issue**: The equipment rental template (`vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html`) section 4.3 mentions "Обеспечительный платеж (депозит): {{deposit_rub}} руб." — but equipment rentals have NO deposit (deposit_rub = 0). The section should be conditional or hidden when deposit = 0.

**Proposed fix**:
```html
{{#if deposit_rub}}4.3. Обеспечительный платеж (депозит): {{deposit_rub}} руб., вносится до передачи Экипировки.{{/if}}
```
Or simply show "Обеспечительный платеж не требуется." when deposit_rub = 0.

---

## 4. Implementation Order

Recommended order (smallest → largest scope):

1. **B.3** (size display) — 1-line change in `buildCategoryItemsKeyboard`. Quick win.
2. **B.6** (template wording) — already done ✅
3. **B.7** (deposit section conditional) — 1 template line change
4. **B.2** (photo preview) — ~15 lines in `eq_<id>` handler, no new prefixes
5. **B.5** (admin photo upload) — ~30 lines in `FranchizeAdminClient.tsx`, parallel to VIN audit
6. **B.1** (subcategory preselection) — ~80 lines: new keyboard builder + handler + state field
7. **B.4** (color/material selection) — ~150 lines: new keyboard builder + handler + state field + variant tracking

---

## 5. Testing Checklist

After implementation, verify:

- [ ] `/ekip` → select jacket → see leather/textile subcategory buttons (B.1)
- [ ] `/ekip` → select item → photo sent if `image_url` exists (B.2)
- [ ] `/ekip` → select item without photo → no error, silent skip (B.2)
- [ ] `/ekip` → item button shows size (e.g., `(L)` or `(XS, S, M, L, XL, XXL)`) (B.3)
- [ ] `/ekip` → select `the-meta-helmet` → size/color/material picker appears (B.4)
- [ ] `/ekip` → select variant → "✅ Готово" → variant stored in context (B.4)
- [ ] Admin page → "Equipment without photos" section appears (B.5)
- [ ] Admin page → click item → scrolls to photo upload form (B.5)
- [ ] Equipment rental doc → section 6 says "от даты возврата **экипировки**" not "ТС" (B.6) ✅
- [ ] Equipment rental doc → deposit section shows 0₽ or "не требуется" (B.7)
- [ ] `/doc` → equipment selection → "✅ Готово" with no equipment → still works (no regression)
- [ ] `/doc` → full flow → rental row created with `crew_id` ✅
- [ ] `/shift` → close → shows `💰 Заработано: X ₽ (Y ч × 169 ₽/ч)` ✅

---

## 6. Triple-Check: No /doc Collision

All new callback prefixes (`eksub_*`, `ekvar_*`, `ekphoto_*`) are prefixed with `ek` which is NOT used by /doc. The /doc flow uses:
- `eq_*` (equipment item toggle) — shared with /ekip but protected by `_ekip` marker
- `ecat_*` (category selection) — shared with /ekip but protected by `_ekip` marker
- `epg_*` (pagination) — shared with /ekip but protected by `_ekip` marker

The `_ekip` marker check (commit `22a3a755`) in `handleEkipCallback` and `handleEkipText` ensures that /ekip handlers only process callbacks when the user's state has `context._ekip === true`. /doc's `setState` does NOT add this marker, so /ekip returns `false` for /doc states and the callback falls through to /doc's handler.

**Before merging any new /ekip callback handler**: verify that the new prefix is NOT in the /doc whitelist in `command-handler.ts` (lines 100-120). If it is, the /doc handler would process it before /ekip gets a chance.

---

## 7. Auth & Security Notes

- All /ekip handlers check `verifyCrewAccess(slug)` via the shared auth helper
- The `_ekip` marker check prevents cross-flow interception
- Equipment rental creation should use `crew_id` (was missing in /doc — fixed in commit `be1533fc`)
- No deposit for equipment rentals (enforced in `make-rental-contract-skill.mjs` line 582)
- Price override for equipment: `--priceOverride 1000` → subtotal = 1000 (no deposit added)

---

**Document End**
