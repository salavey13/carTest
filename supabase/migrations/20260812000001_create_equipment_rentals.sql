-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000001_create_equipment_rentals.sql
-- Purpose:   I5 — standalone equipment rentals (helmets/jackets rented without a bike)
-- Plan:      docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 1)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.1 (migration series 20260812*)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Equipment items are `cars` rows with type='equipment' (catalog reuse — no new
-- item entity). A rental of equipment MAY link to a bike rental via
-- primary_rental_id (NULL = standalone rental).
--
-- IDEMPOTENCY: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS — safe to re-run.
-- RLS: auth.jwt() ->> 'chat_id' (TEXT), NOT auth.uid() — production reality (PRD §0).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.equipment_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  equipment_id    TEXT NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  renter_user_id  TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  primary_rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL, -- NULL = standalone

  -- Rental period
  start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date        TIMESTAMPTZ,
  expected_return_date TIMESTAMPTZ,

  -- Pricing
  daily_price     NUMERIC NOT NULL DEFAULT 0,
  total_cost      NUMERIC NOT NULL DEFAULT 0,

  -- Status
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'returned', 'lost', 'damaged', 'overdue'
  )),

  -- Handoff tracking
  issued_by       TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  received_by     TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  condition_notes TEXT, -- damage notes on return

  -- Metadata
  created_by      TEXT, -- operator chat_id (no FK — matches crew_todos pattern)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_rentals_crew ON public.equipment_rentals(crew_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_equipment ON public.equipment_rentals(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_renter ON public.equipment_rentals(renter_user_id) WHERE renter_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_primary ON public.equipment_rentals(primary_rental_id) WHERE primary_rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_status ON public.equipment_rentals(status) WHERE status = 'active';

-- RLS: crew members can read, crew owners can write
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read equipment rentals" ON public.equipment_rentals;
CREATE POLICY "Crew members can read equipment rentals"
  ON public.equipment_rentals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = equipment_rentals.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

DROP POLICY IF EXISTS "Crew owners can manage equipment rentals" ON public.equipment_rentals;
CREATE POLICY "Crew owners can manage equipment rentals"
  ON public.equipment_rentals FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = equipment_rentals.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );

COMMENT ON TABLE public.equipment_rentals IS
  'I5: standalone equipment rentals. Equipment = cars rows with type=''equipment''. primary_rental_id links to a bike rental when equipment is rented together; NULL = standalone. Cash entry on return is created by trigger (migration 20260812000007).';

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION: tests/sql/i5_equipment_rentals_regression.sql
-- ═══════════════════════════════════════════════════════════════════════════
