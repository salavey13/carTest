-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000003_create_commission_rates.sql
-- Purpose:   I5 — commission rates table with seed data
-- Plan:      docs/superpowers/plans/2026-08-12-i5-commissions-salary.md (Task 1)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.3 (commission branching: percentage/fixed)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Commission rates define how crew operators are compensated for operations.
-- Each crew can have multiple rates per operation type; higher priority wins.
-- Types: percentage (stored as number, e.g., 10 = 10%, divided by 100 in trigger)
--        fixed_amount (flat fee)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,

  operation_type  TEXT NOT NULL CHECK (operation_type IN (
    'rental_hourly', 'rental_daily', 'sale', 'service', 'equipment_rental'
  )),

  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed_amount')),
  commission_value NUMERIC NOT NULL CHECK (
    -- percentage: 0-100 allowed (wave contract: stored as number, /100 in trigger)
    -- fixed_amount: no upper limit
    commission_type != 'percentage' OR commission_value BETWEEN 0 AND 100
  ),

  priority        INTEGER NOT NULL DEFAULT 0,  -- higher wins
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(crew_id, operation_type, priority)
);

CREATE INDEX IF NOT EXISTS idx_commission_rates_crew ON public.commission_rates(crew_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_active ON public.commission_rates(crew_id, is_active) WHERE is_active = TRUE;

-- RLS: crew members can read, crew owners can manage
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read commission rates" ON public.commission_rates;
CREATE POLICY "Crew members can read commission rates"
  ON public.commission_rates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = commission_rates.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

DROP POLICY IF EXISTS "Crew owners can manage commission rates" ON public.commission_rates;
CREATE POLICY "Crew owners can manage commission rates"
  ON public.commission_rates FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = commission_rates.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: default 10% rental_hourly commission for all crews (Open Q1)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.commission_rates (crew_id, operation_type, commission_type, commission_value, priority)
SELECT id, 'rental_hourly', 'percentage', 10, 0 FROM public.crews
ON CONFLICT (crew_id, operation_type, priority) DO NOTHING;

COMMENT ON TABLE public.commission_rates IS
'I5: commission rates per crew per operation. percentage: stored as number (10 = 10%), divided by 100 in trigger. fixed_amount: flat fee. Higher priority wins. Seed: every crew gets 10% rental_hourly by default.';
