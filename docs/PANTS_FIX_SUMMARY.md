# Pants (Штаны) Equipment Fix Summary

## Issues Found & Fixed

### ❌ Issues Before Fix:
1. **Missing in startapp-state.ts**: No `extrasPants?: boolean` field
2. **Missing in URL params**: Nowhere set `extrasPants` in startapp URLs
3. **Missing in template**: Contract showed "Куртка/черепаха __" but NO pants field
4. **Missing in contract vars**: rental-contract-vars.ts didn't include pants

### ✅ Issues Fixed:
1. ✅ Added `extrasPants?: boolean` to `lib/startapp-state.ts`
2. ✅ Added URL param handling in `app/lib/startapp-handler.ts`
3. ✅ Added URL param parsing in `app/franchize/components/CatalogClient.tsx`
4. ✅ Added URL param setting in `hooks/useStartParamRouter.ts`
5. ✅ Added pants to `app/franchize/modals/Item.tsx` startapp state building
6. ✅ Updated contract template to show pants: `Штаны — {{equipment_pants}}`
7. ✅ Added pants to equipment cost calculation in `app/lib/rental-contract-vars.ts`
8. ✅ Added pants to equipment variables (`equipment_pants`, `equipment_jacket`, `equipment_boots`)
9. ✅ Added pants to equipment_summary display

## Pants Equipment in Supabase

✅ **Already exists** from migration `20260812000006_seed_equipment.sql`:
- ID: `equip-pants-trail-adv-{crew_slug}`
- Make: `MT`
- Model: `Trail Adv`
- Type: `equipment`
- Daily Price: `500 ₽`
- Specs: "Штаны для эндуро и туризма. Влагостойкие, с защитой коленей."

### Equipment Catalog Verified:
```
boots: MT Tour Adv
communicator: MT Communicator BT
disc: MT Disc Lock Pro
gloves: MT Summer X
helmet: MT Street Pro
jacket: MT Trail Guard
pants: MT Trail Adv  ✅
```

## Contract Template Fix

**Before:**
```html
Куртка/черепаха __; второй шлем __; сумка — {{equipment_bag}}; ...
```

**After:**
```html
Куртка — {{equipment_jacket}}; штаны — {{equipment_pants}}; ботинки — {{equipment_boots}}; ...
```

## Equipment Summary in Contract

**Before:** "Шлем ×1, Перчатки, Сетка, Рюкзак"

**After:** "Шлем ×1, Перчатки, Куртка, Штаны, Ботинки, Сетка, Рюкзак"

## Files Modified

1. `lib/startapp-state.ts` - Added extrasPants field
2. `app/lib/startapp-handler.ts` - Added extrasPants URL param
3. `app/franchize/components/CatalogClient.tsx` - Added extrasPants parsing
4. `app/franchize/modals/Item.tsx` - Added extrasPants to state building
5. `hooks/useStartParamRouter.ts` - Added extrasPants URL param
6. `app/lib/rental-contract-vars.ts` - Added pants to equipment type, cost calculation, and variables
7. `docs/crewDocs/vip-bike_RENTAL_DEAL_TEMPLATE.html` - Added pants to contract template

## Testing

To verify pants work correctly:
1. Select pants in the web app rental flow
2. Verify "Штаны" appears in equipment summary
3. Check contract shows "Штаны — да" in the equipment section
4. Verify 500₽ is added to equipment cost

## Next Steps

The pants equipment flow is now complete:
- ✅ Web UI selection (already worked)
- ✅ URL parameter passing (now fixed)
- ✅ Contract template display (now fixed)
- ✅ Equipment cost calculation (now fixed)
- ✅ Supabase equipment record (already existed)

All changes preserve backward compatibility - rentals without pants selection will continue to work as before.
