-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260910120000_equipment_unify_finish.sql
-- Purpose:   Finish the equipment→rentals unification (20260815000001).
--
--   1. Idempotent re-backfill of legacy `equipment_rentals` → `rentals`
--      (catches rows inserted after the first backfill ran).
--   2. Extend auto_create_rental_transaction(): unified equipment rows
--      (metadata.item_type='equipment') now produce `income_equipment`
--      on completion instead of `income_rental`.
--   3. Drop the dead legacy trigger trg_auto_equipment_transaction —
--      after this migration NOTHING writes to equipment_rentals anymore
--      (bot /ekip, web checkout and server actions all write `rentals`).
--      The legacy table itself is KEPT as a read-only archive.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Step 1: idempotent backfill (same shape as 20260815000001 Step 1) ──────
INSERT INTO public.rentals (
  rental_id, user_id, vehicle_id, owner_id, status, payment_status,
  interest_amount, total_cost,
  requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
  delivery_address, metadata, created_at, updated_at
)
SELECT
  er.id,
  COALESCE(er.renter_user_id, er.issued_by) as user_id,
  er.equipment_id as vehicle_id,
  er.issued_by as owner_id,
  CASE er.status
    WHEN 'active' THEN 'active'
    WHEN 'returned' THEN 'completed'
    WHEN 'lost' THEN 'disputed'
    WHEN 'damaged' THEN 'disputed'
    WHEN 'overdue' THEN 'active'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE er.status
  END as status,
  'fully_paid' as payment_status,
  er.daily_price as interest_amount,
  er.total_cost,
  er.start_date as requested_start_date,
  er.expected_return_date as requested_end_date,
  er.start_date as agreed_start_date,
  COALESCE(er.end_date, er.expected_return_date, er.start_date + INTERVAL '7 days') as agreed_end_date,
  NULL as delivery_address,
  jsonb_build_object(
    'item_type', 'equipment',
    'crew_id', er.crew_id::TEXT,
    'daily_price', er.daily_price::NUMERIC,
    'damage_reports', CASE
      WHEN er.condition_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object(
        'phase', 'return',
        'severity', CASE WHEN er.status IN ('lost','damaged') THEN 'major' ELSE 'minor' END,
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
    'equipment_rental_id', er.id,
    'primary_rental_id', er.primary_rental_id,
    'issued_by', er.issued_by,
    'received_by', er.received_by,
    'issued_at', er.issued_at,
    'returned_at', er.returned_at,
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

-- Re-point any late cash entries to the unified row
UPDATE public.cash_transactions ct
SET rental_id = r.rental_id
FROM public.rentals r
WHERE ct.equipment_rental_id IS NOT NULL
AND r.metadata->>'equipment_rental_id' = ct.equipment_rental_id::TEXT;

-- ── Step 2: money trigger — equipment-aware income on completion ───────────
-- Bike rentals: income_rental + commission (unchanged behavior).
-- Equipment rentals (metadata.item_type='equipment'): income_equipment only,
-- mirroring the legacy auto_create_equipment_transaction semantics
-- (legacy fired on returned/damaged/lost → unified completed/disputed).
CREATE OR REPLACE FUNCTION public.auto_create_rental_transaction()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_crew_id UUID;
  v_manager_id TEXT;
  v_comm_type TEXT;
  v_comm_value NUMERIC;
  v_commission NUMERIC;
  v_is_equipment BOOLEAN;
  v_payment_method TEXT;
BEGIN
  v_is_equipment := COALESCE(NEW.metadata->>'item_type', 'bike') = 'equipment';

  -- Only on transition into a terminal "money happened" status
  IF v_is_equipment THEN
    IF NOT (NEW.status IN ('completed', 'disputed')
            AND (OLD IS NULL OR OLD.status IS DISTINCT FROM NEW.status
                 AND COALESCE(OLD.status, '') NOT IN ('completed', 'disputed'))) THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NOT (NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_crew_id := NEW.crew_id;
  IF v_crew_id IS NULL THEN RETURN NEW; END IF;

  -- Normalize payment method to the cash_transactions CHECK domain
  -- (cash|card|transfer|other). Bot destinations tbank/sber → 'card'.
  v_payment_method := CASE COALESCE(NEW.metadata->>'payment_method', 'cash')
    WHEN 'tbank' THEN 'card'
    WHEN 'sber'  THEN 'card'
    WHEN 'card'  THEN 'card'
    WHEN 'cash'  THEN 'cash'
    ELSE 'cash'
  END;

  IF v_is_equipment THEN
    -- Equipment: income_equipment, idempotent per rental
    IF NEW.total_cost > 0 AND NOT EXISTS (
      SELECT 1 FROM public.cash_transactions
      WHERE rental_id = NEW.rental_id AND transaction_type = 'income_equipment'
    ) THEN
      INSERT INTO public.cash_transactions (
        crew_id, rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date, created_by
      ) VALUES (
        v_crew_id, NEW.rental_id, 'income_equipment', COALESCE(NEW.total_cost, 0), 'in',
        v_payment_method, 'Аренда экипировки',
        'Экип ' || COALESCE((SELECT make || ' ' || model FROM public.cars WHERE id = NEW.vehicle_id), ''),
        now(), COALESCE(NEW.created_by_operator_chat_id, NEW.owner_id, 'system')
      );
    END IF;
    RETURN NEW; -- legacy equipment flow recorded no commission
  END IF;

  -- ── Bike rental: income_rental (unchanged) ──
  IF NEW.total_cost > 0 AND NOT EXISTS (
    SELECT 1 FROM public.cash_transactions
    WHERE rental_id = NEW.rental_id AND transaction_type = 'income_rental'
  ) THEN
    INSERT INTO public.cash_transactions (
      crew_id, rental_id, transaction_type, amount, flow_direction,
      payment_method, category, description, transaction_date, created_by
    ) VALUES (
      v_crew_id, NEW.rental_id, 'income_rental', COALESCE(NEW.total_cost, 0), 'in',
      v_payment_method, 'Аренда',
      'Аренда ' || COALESCE((SELECT model FROM public.cars WHERE id = NEW.vehicle_id), ''),
      now(), COALESCE(NEW.created_by_operator_chat_id, NEW.owner_id, 'system')
    );
  END IF;

  -- Commission: branch by type (unchanged)
  SELECT commission_type, commission_value INTO v_comm_type, v_comm_value
  FROM public.commission_rates
  WHERE crew_id = v_crew_id AND operation_type = 'rental_hourly' AND is_active = true
  ORDER BY priority DESC LIMIT 1;

  IF v_comm_type IS NOT NULL AND NEW.total_cost > 0 THEN
    v_commission := CASE v_comm_type
      WHEN 'percentage'   THEN NEW.total_cost * v_comm_value / 100
      WHEN 'fixed_amount' THEN v_comm_value
    END;

    SELECT owner_id INTO v_manager_id FROM public.crews WHERE id = v_crew_id;

    IF v_manager_id IS NOT NULL AND v_commission > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.cash_transactions
         WHERE rental_id = NEW.rental_id AND transaction_type = 'expense_commission'
       ) THEN
      INSERT INTO public.cash_transactions (
        crew_id, rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date,
        from_user_id, to_user_id, created_by
      ) VALUES (
        v_crew_id, NEW.rental_id, 'expense_commission', v_commission, 'out',
        'cash', 'Комиссия',
        'Комиссия за аренду ' || SUBSTRING(NEW.rental_id::TEXT FROM 1 FOR 8),
        now(), NEW.user_id, v_manager_id,
        COALESCE(NEW.created_by_operator_chat_id, 'system')
      );
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_rental_transaction ON public.rentals;
CREATE TRIGGER trg_auto_rental_transaction
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_rental_transaction();

-- ── Step 3: retire the dead legacy trigger ──────────────────────────────────
-- The legacy table keeps its history, but nothing may write money entries
-- from it anymore — unified rentals rows are the single source of truth.
DROP TRIGGER IF EXISTS trg_auto_equipment_transaction ON public.equipment_rentals;

COMMENT ON TABLE public.equipment_rentals IS
'DEPRECATED archive (2026-09-10): equipment rentals live in rentals.metadata(item_type=equipment). Rows backfilled by 20260815000001 + 20260910120000; trigger removed — do not write.';

COMMENT ON FUNCTION public.auto_create_rental_transaction() IS
'I5 + 20260910: income_rental + commission on bike rental completion; income_equipment on equipment (metadata.item_type=equipment) completion/dispute. Idempotent NOT EXISTS guards.';
