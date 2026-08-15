-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260815000001_unify_equipment_rentals.sql
-- Purpose:   Unify equipment rentals into main rentals table
-- Reason:    Equipment rentals duplicate bike rental functionality (damage tracking,
--            handoff/return flow). Bike rentals already have comprehensive equipment
--            and damage tracking via rental_handoffs + metadata.damage_reports.
-- ═══════════════════════════════════════════════════════════════════════════
-- Approach:   Use metadata JSONB for all equipment-specific data (no new columns)
-- Architecture:
--   - rentals.metadata->>'item_type': 'bike' | 'equipment' (NULL = legacy bike rentals)
--   - rentals.metadata->'equipment_size': 'S' | 'M' | 'L' | 'XL' | 'XXL'
--   - rentals.metadata->'equipment_condition': 'Норм' | 'Грязно' | 'Есть царапины' | 'Есть повреждения'
--   - rentals.metadata->'damage_reports': array of {phase, severity, notes, timestamp}
--   - rentals.metadata->'crew_id': crew_id from equipment_rentals (for reporting/RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Migrate existing equipment_rentals to rentals (using metadata for everything)
INSERT INTO public.rentals (
  rental_id,
  user_id,
  vehicle_id,
  owner_id,
  status,
  payment_status,
  interest_amount,
  total_cost,
  requested_start_date,
  requested_end_date,
  agreed_start_date,
  agreed_end_date,
  delivery_address,
  metadata,
  created_at,
  updated_at
)
SELECT
  er.id,
  COALESCE(er.renter_user_id, er.issued_by) as user_id,
  er.equipment_id as vehicle_id,
  -- Map issued_by to owner_id (equipment rentals don't have separate owner)
  er.issued_by as owner_id,
  -- Map equipment status to rental status
  CASE er.status
    WHEN 'active' THEN 'active'
    WHEN 'returned' THEN 'completed'
    WHEN 'lost' THEN 'disputed'
    WHEN 'damaged' THEN 'disputed'
    WHEN 'overdue' THEN 'active'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE er.status
  END as status,
  -- Equipment rentals are typically prepaid, no payment tracking needed
  'fully_paid' as payment_status,
  -- Store daily_price as interest_amount (equipment-specific pricing)
  er.daily_price as interest_amount,
  er.total_cost,
  -- Use start_date for both requested and agreed dates
  er.start_date as requested_start_date,
  er.expected_return_date as requested_end_date,
  er.start_date as agreed_start_date,
  COALESCE(er.end_date, er.expected_return_date, er.start_date + INTERVAL '7 days') as agreed_end_date,
  -- Equipment rentals are pickup-only (no delivery)
  NULL as delivery_address,
  jsonb_build_object(
    'item_type', 'equipment',
    'crew_id', er.crew_id::TEXT, -- Store crew_id for reporting/RLS compatibility
    'daily_price', er.daily_price::NUMERIC,
    'damage_reports', CASE
      WHEN er.condition_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object(
        'phase', 'return',
        'severity', CASE
          WHEN er.status = 'lost' THEN 'major'
          WHEN er.status = 'damaged' THEN 'major'
          ELSE 'minor'
        END,
        'notes', er.condition_notes,
        'created_at', er.returned_at,
        'created_by', er.received_by
      ))
      ELSE jsonb_build_array()
    END,
    'equipment_condition', CASE
      WHEN er.status = 'returned' THEN 'Норм'
      WHEN er.status = 'damaged' THEN 'Есть повреждения'
      WHEN er.status = 'lost' THEN 'Утерян'
      WHEN er.status = 'active' THEN 'Выдан'
      ELSE NULL
    END,
    'equipment_rental_id', er.id, -- Keep reference for rollback
    'primary_rental_id', er.primary_rental_id,
    'issued_by', er.issued_by,
    'received_by', er.received_by,
    'issued_at', er.issued_at,
    'returned_at', er.returned_at,
    -- Try to extract size from equipment specs (stored in cars table)
    'equipment_size', (
      SELECT jsonb_array_elements(specs->'sizes')->>0
      FROM public.cars c
      WHERE c.id = er.equipment_id
      AND c.type = 'equipment'
      AND jsonb_typeof(specs->'sizes') = 'array'
      AND jsonb_array_length(specs->'sizes') > 0
      LIMIT 1
    )
  ) as metadata,
  er.created_at,
  er.updated_at
FROM public.equipment_rentals er
WHERE er.crew_id IS NOT NULL
ON CONFLICT (rental_id) DO UPDATE SET
  status = EXCLUDED.status,
  payment_status = EXCLUDED.payment_status,
  total_cost = EXCLUDED.total_cost,
  agreed_end_date = EXCLUDED.agreed_end_date,
  metadata = EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at;

-- Step 2: Update cash_transactions to point to unified rentals
UPDATE public.cash_transactions ct
SET rental_id = r.rental_id
FROM public.rentals r
WHERE ct.equipment_rental_id IS NOT NULL
AND r.metadata->>'equipment_rental_id' = ct.equipment_rental_id::TEXT;

-- Step 3: Create GIN index on metadata for efficient equipment queries
CREATE INDEX IF NOT EXISTS idx_rentals_metadata_gin
  ON public.rentals USING GIN (metadata jsonb_path_ops);

-- Step 4: Create partial index for equipment rentals only
CREATE INDEX IF NOT EXISTS idx_rentals_equipment
  ON public.rentals(vehicle_id)
  WHERE metadata->>'item_type' = 'equipment';

-- Step 5: Create index for crew_id in metadata (for equipment queries by crew)
CREATE INDEX IF NOT EXISTS idx_rentals_metadata_crew_id
  ON public.rentals((metadata->>'crew_id'))
  WHERE metadata->>'crew_id' IS NOT NULL;

COMMENT ON COLUMN public.rentals.metadata IS
'Extended rental data. For equipment: item_type=equipment, crew_id, equipment_size, equipment_condition, damage_reports, primary_rental_id, issued_by, received_by.';

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Run these queries to verify:
--
-- 1. Check migrated count:
--    SELECT metadata->>'item_type', COUNT(*) FROM rentals GROUP BY metadata->>'item_type';
--
-- 2. Verify equipment rentals have all fields:
--    SELECT
--      rental_id,
--      metadata->>'equipment_condition' as condition,
--      metadata->>'equipment_size' as size,
--      metadata->>'crew_id' as crew_id,
--      (metadata->>'daily_price')::NUMERIC as daily_price,
--      metadata->'primary_rental_id' as primary_rental
--    FROM rentals
--    WHERE metadata->>'item_type' = 'equipment';
--
-- 3. Verify cash transactions updated:
--    SELECT COUNT(*) FROM cash_transactions WHERE equipment_rental_id IS NOT NULL;
--    -- Should be 0 after successful migration
--
-- 4. Verify primary_rental_id links are preserved:
--    SELECT COUNT(*) FROM rentals r1
--    JOIN rentals r2 ON r1.metadata->>'primary_rental_id' = r2.rental_id::TEXT
--    WHERE r1.metadata->>'item_type' = 'equipment';
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTE: After verification, can drop equipment_rentals table:
-- DROP TABLE IF EXISTS public.equipment_rentals CASCADE;
-- DROP INDEX IF EXISTS idx_equipment_rentals_*;
