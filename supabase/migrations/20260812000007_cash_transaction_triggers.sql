-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000007_cash_transaction_triggers.sql
-- Purpose:   I5 — auto-create cash transactions on status changes
-- Plan:      docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 2)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.2 (idempotency: transition guard + NOT EXISTS)
--           п.3 (commission branching: percentage vs fixed_amount)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Triggers automatically create cash_transactions entries when operations complete:
-- - Rental completed → income_rental + expense_commission (if rate configured)
-- - Sale created → income_sale + expense_commission
-- - Equipment returned → income_equipment
--
-- IDEMPOTENCY (I1 pattern):
-- 1. Transition guard: OLD.status IS DISTINCT FROM NEW.status
-- 2. NOT EXISTS guard: no duplicate entries for (source_id, transaction_type)
-- Re-completing a rental/sale creates NO new cash entries.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Rental trigger (income + commission) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_create_rental_transaction()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_crew_id UUID;
  v_manager_id TEXT;
  v_comm_type TEXT;
  v_comm_value NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Only on transition to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    v_crew_id := NEW.crew_id;
    IF v_crew_id IS NULL THEN RETURN NEW; END IF;

    -- Idempotency: no duplicate income_rental for this rental
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_transactions
      WHERE rental_id = NEW.rental_id AND transaction_type = 'income_rental'
    ) THEN
      INSERT INTO public.cash_transactions (
        crew_id, rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date, created_by
      ) VALUES (
        v_crew_id, NEW.rental_id, 'income_rental', COALESCE(NEW.total_cost, 0), 'in',
        COALESCE(NEW.metadata->>'payment_method', 'cash'), 'Аренда',
        'Аренда ' || COALESCE((SELECT model FROM public.cars WHERE id = NEW.vehicle_id), ''),
        now(), COALESCE(NEW.created_by_operator_chat_id, NEW.owner_id, 'system')
      );
    END IF;

    -- Commission: branch by type (contract p.3)
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
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_rental_transaction ON public.rentals;
CREATE TRIGGER trg_auto_rental_transaction
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_rental_transaction();

-- ── Sale trigger (income + commission) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_create_sale_transaction()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_crew_id UUID;
  v_manager_id TEXT;
  v_comm_type TEXT;
  v_comm_value NUMERIC;
  v_commission NUMERIC;
BEGIN
  -- Resolve crew_id from crew_slug (contract p.5: JOIN crews ON slug)
  SELECT id INTO v_crew_id FROM public.crews WHERE slug = NEW.crew_slug;
  IF v_crew_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency: no duplicate income_sale for this contract
  IF NOT EXISTS (
    SELECT 1 FROM public.cash_transactions
    WHERE sale_contract_id = NEW.id AND transaction_type = 'income_sale'
  ) THEN
    INSERT INTO public.cash_transactions (
      crew_id, sale_contract_id, transaction_type, amount, flow_direction,
      payment_method, category, description, transaction_date, created_by
    ) VALUES (
      v_crew_id, NEW.id, 'income_sale',
      COALESCE(NEW.total_sum, NULLIF(REPLACE(NEW.sale_price, ' ', ''), '')::NUMERIC, 0), 'in',
      'cash', 'Продажа',
      'Продажа ' || COALESCE((SELECT model FROM public.cars WHERE id = NEW.resolved_bike_id), ''),
      NEW.created_at, COALESCE(NEW.created_by_operator_chat_id, 'system')
    );
  END IF;

  -- Commission for sale
  SELECT commission_type, commission_value INTO v_comm_type, v_comm_value
  FROM public.commission_rates
  WHERE crew_id = v_crew_id AND operation_type = 'sale' AND is_active = true
  ORDER BY priority DESC LIMIT 1;

  IF v_comm_type IS NOT NULL THEN
    DECLARE v_sale_amount NUMERIC;
    BEGIN
      v_sale_amount := COALESCE(NEW.total_sum, NULLIF(REPLACE(NEW.sale_price, ' ', ''), '')::NUMERIC, 0);

      v_commission := CASE v_comm_type
        WHEN 'percentage'   THEN v_sale_amount * v_comm_value / 100
        WHEN 'fixed_amount' THEN v_comm_value
      END;

      SELECT owner_id INTO v_manager_id FROM public.crews WHERE id = v_crew_id;

      IF v_manager_id IS NOT NULL AND v_commission > 0
         AND NOT EXISTS (
           SELECT 1 FROM public.cash_transactions
           WHERE sale_contract_id = NEW.id AND transaction_type = 'expense_commission'
         ) THEN
        INSERT INTO public.cash_transactions (
          crew_id, sale_contract_id, transaction_type, amount, flow_direction,
          payment_method, category, description, transaction_date,
          to_user_id, created_by
        ) VALUES (
          v_crew_id, NEW.id, 'expense_commission', v_commission, 'out',
          'cash', 'Комиссия',
          'Комиссия за продажу ' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8),
          NEW.created_at, v_manager_id,
          COALESCE(NEW.created_by_operator_chat_id, 'system')
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_sale_transaction ON private.sale_contract_artifacts;
CREATE TRIGGER trg_auto_sale_transaction
  AFTER INSERT ON private.sale_contract_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_sale_transaction();

-- ── Equipment rental trigger (income on return) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_create_equipment_transaction()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  -- Only on transition to 'returned', 'damaged', or 'lost'
  IF NEW.status IN ('returned', 'damaged', 'lost')
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM ALL (ARRAY['returned', 'damaged', 'lost'])) THEN

    -- Idempotency: no duplicate income_equipment for this equipment rental
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_transactions
      WHERE equipment_rental_id = NEW.id AND transaction_type = 'income_equipment'
    ) THEN
      INSERT INTO public.cash_transactions (
        crew_id, equipment_rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date, created_by
      ) VALUES (
        NEW.crew_id, NEW.id, 'income_equipment', NEW.total_cost, 'in',
        'cash', 'Аренда экипировки',
        'Экип ' || (SELECT make || ' ' || model FROM public.cars WHERE id = NEW.equipment_id),
        NEW.returned_at, NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_equipment_transaction ON public.equipment_rentals;
CREATE TRIGGER trg_auto_equipment_transaction
  AFTER UPDATE OF status ON public.equipment_rentals
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_equipment_transaction();

-- ═══════════════════════════════════════════════════════════════════════════
-- Grant execute permissions
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.auto_create_rental_transaction() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_create_sale_transaction() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_create_equipment_transaction() TO service_role;

COMMENT ON FUNCTION public.auto_create_rental_transaction() IS
'I5: auto-create income_rental + expense_commission on rental completion. Idempotent: NOT EXISTS guards prevent duplicates on re-completion.';
COMMENT ON FUNCTION public.auto_create_sale_transaction() IS
'I5: auto-create income_sale + expense_commission on sale artifact creation. Resolves crew_id via crews.slug (cross-schema JOIN).';
COMMENT ON FUNCTION public.auto_create_equipment_transaction() IS
'I5: auto-create income_equipment on equipment rental return (returned/damaged/lost status transition).';
