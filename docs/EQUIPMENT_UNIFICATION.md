# Equipment Rental Unification

## Problem
Equipment rentals were implemented in a separate `equipment_rentals` table, duplicating bike rental functionality. This created:
- Code duplication (separate server actions, UI components)
- Inconsistent reporting (need union queries)
- Missing features (equipment didn't get bike rental gold standard features)

## Solution
Unify equipment into the main `rentals` table using `metadata` JSONB for equipment-specific fields.

## Architecture

### Storage (all in `metadata` JSONB)
```sql
metadata->>'item_type' = 'equipment' | 'bike' | NULL
metadata->'equipment_size' = 'S' | 'M' | 'L' | 'XL' | 'XXL'  
metadata->'equipment_condition' = 'Норм' | 'Грязно' | 'Есть царапины' | 'Есть повреждения'
metadata->'damage_reports' = array of {phase, severity, notes, timestamp}
metadata->'primary_rental_id' = links equipment to bike rental (optional)
```

### Indexes
```sql
CREATE INDEX idx_rentals_metadata_gin ON rentals USING GIN (metadata jsonb_path_ops);
CREATE INDEX idx_rentals_equipment ON rentals(vehicle_id) 
  WHERE metadata->>'item_type' = 'equipment';
```

## Migration
- `20260815000001_unify_equipment_rentals.sql` migrates all `equipment_rentals` → `rentals`
- Preserves damage tracking, conditions, and links to bike rentals
- Updates `cash_transactions.equipment_rental_id` → `rental_id`

## UI/UX Changes

### Equipment in Catalog
- Equipment items filtered via `displayMode === "equipment"` (same as rent/sale/service)
- `hasEquipmentType()` helper identifies equipment in `cars` table
- Header rail pill unified (equipment uses same displayMode state machine)

### Equipment in Item Modal
- `EquipmentSizeSelector` component for size selection (S/M/L/XL/XXL)
- Size stored in cart options: `equipmentSize: string`
- Cart line IDs include size (different sizes = different cart lines)

### Damage Tracking (reuses bike infrastructure)
- Same `RentalHandoffModal` for both bikes and equipment
- `metadata.damage_reports` array (phase, severity, notes, timestamp)
- `metadata.equipment_condition` (Норм/Грязно/царапины/повреждения)
- Same CONDITION_OPTIONS from bike handoff

## Benefits
✅ Single `rentals` table = unified reporting, simpler queries  
✅ Shared UI components = less code duplication  
✅ Consistent damage tracking across all rentals  
✅ Equipment gets all bike rental features (photos, handoff, return flow)  
✅ No schema changes to `rentals` table (all in metadata)  
✅ Flexible for future equipment categories  

## Post-Migration Cleanup
After verifying migration success:
```sql
DROP TABLE IF EXISTS public.equipment_rentals CASCADE;
DROP INDEX IF EXISTS idx_equipment_rentals_*;
```

## Files Changed
- `supabase/migrations/20260815000001_unify_equipment_rentals.sql` - Main migration
- `app/franchize/lib/catalog-utils.ts` - Added `hasEquipmentType()`, `getEquipmentSizes()`, `getEquipmentCategory()`
- `app/franchize/modals/Item.tsx` - Added equipment size selector
- `app/franchize/hooks/useFranchizeCart.ts` - Added `equipmentSize` to cart options
- `app/franchize/components/CrewHeader.tsx` - Unified equipment pill
- `app/franchize/components/DisplayModeContext.tsx` - Added "equipment" mode
- `app/franchize/components/CatalogClient.tsx` - Equipment filtering
