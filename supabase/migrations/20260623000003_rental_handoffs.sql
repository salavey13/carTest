-- /supabase/migrations/20260623000003_rental_handoffs.sql
-- RENTAL HANDOFFS SYSTEM
-- ======================
-- Stores detailed handout (выдача) and return (возврат) data for each rental.
-- Replaces the simple checklist_state table which was not tied to rentals.
--
-- This enables:
-- 1. Odometer tracking (start/end)
-- 2. Fuel/charge level tracking (start/end)
-- 3. Damage notes and photos references
-- 4. Proper audit trail per rental
-- 5. Integration with all 3 rental flows (skill, webapp, /doc)

CREATE TABLE IF NOT EXISTS public.rental_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to rental
  rental_id UUID NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('handout', 'return')),

  -- BOOLEAN CHECKLIST ITEMS (from rental contract requirements)
  -- Handout phase
  passport_checked BOOLEAN DEFAULT FALSE,
  license_checked BOOLEAN DEFAULT FALSE,
  deposit_collected BOOLEAN DEFAULT FALSE,
  helmet_issued BOOLEAN DEFAULT FALSE,
  keys_issued BOOLEAN DEFAULT FALSE,
  instructions_given BOOLEAN DEFAULT FALSE,
  photos_taken BOOLEAN DEFAULT FALSE,  -- 8-10 photos per contract

  -- Return phase
  condition_checked BOOLEAN DEFAULT FALSE,
  helmet_returned BOOLEAN DEFAULT FALSE,
  keys_returned BOOLEAN DEFAULT FALSE,
  deposit_returned BOOLEAN DEFAULT FALSE,
  no_damages_confirmed BOOLEAN DEFAULT FALSE,

  -- NUMERIC FIELDS (from rental contract - odometer, fuel, battery)
  odometer_start INTEGER,  -- km at handout
  odometer_end INTEGER,    -- km at return
  fuel_level_start INTEGER,  -- % for EV or liters for ICE
  fuel_level_end INTEGER,
  battery_level_start INTEGER,  -- % for electric bikes
  battery_level_end INTEGER,

  -- TEXT NOTES
  damage_notes TEXT,  -- Damage description if any
  handout_notes TEXT,  -- Any additional notes at handout
  return_notes TEXT,   -- Any additional notes at return

  -- EQUIPMENT / COMPLETENESS (from Appendix 1 of rental contract)
  keys_count INTEGER DEFAULT 1,  -- Number of keys
  charger_included BOOLEAN DEFAULT FALSE,  -- Charger included
  lock_cable_included BOOLEAN DEFAULT FALSE,  -- Lock/cable included
  jacket_issued BOOLEAN DEFAULT FALSE,  -- Jacket/armor issued
  second_helmet_issued BOOLEAN DEFAULT FALSE,  -- Second helmet issued
  bag_issued BOOLEAN DEFAULT FALSE,  -- Bag/backpack issued
  net_issued BOOLEAN DEFAULT FALSE,  -- Net issued
  camera_mount_issued BOOLEAN DEFAULT FALSE,  -- Camera mount issued
  moto_cover_issued BOOLEAN DEFAULT FALSE,  -- Moto cover issued
  ebike_charger_issued BOOLEAN DEFAULT FALSE,  -- E-bike charger issued
  other_equipment TEXT,  -- Other equipment description
  equipment_condition_return TEXT,  -- Equipment condition at return

  -- TRACKING
  completed_at TIMESTAMPTZ,
  completed_by TEXT,   -- user_id of crew member who completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate handouts/returns per rental
  CONSTRAINT unique_phase_per_rental UNIQUE (rental_id, phase)
);

-- Enable RLS
ALTER TABLE public.rental_handoffs ENABLE ROW LEVEL SECURITY;

-- Policy: Crew members can read/write handoffs for their crew's rentals
CREATE POLICY "Crew can read handoffs for their rentals" ON public.rental_handoffs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rentals r
      JOIN cars c ON c.id = r.vehicle_id
      JOIN crews crew ON crew.id = c.crew_id
      WHERE r.rental_id = rental_handoffs.rental_id
        AND crew.owner_id = (SELECT user_id FROM users WHERE user_id = auth.uid() LIMIT 1)
    )
    OR (SELECT metadata->>'role' FROM users WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Crew can insert handoffs for their rentals" ON public.rental_handoffs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rentals r
      JOIN cars c ON c.id = r.vehicle_id
      JOIN crews crew ON crew.id = c.crew_id
      WHERE r.rental_id = rental_handoffs.rental_id
        AND crew.owner_id = (SELECT user_id FROM users WHERE user_id = auth.uid() LIMIT 1)
    )
    OR (SELECT metadata->>'role' FROM users WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "Crew can update handoffs for their rentals" ON public.rental_handoffs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rentals r
      JOIN cars c ON c.id = r.vehicle_id
      JOIN crews crew ON crew.id = c.crew_id
      WHERE r.rental_id = rental_handoffs.rental_id
        AND crew.owner_id = (SELECT user_id FROM users WHERE user_id = auth.uid() LIMIT 1)
    )
    OR (SELECT metadata->>'role' FROM users WHERE user_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS rental_handoffs_rental_id_idx ON public.rental_handoffs(rental_id);
CREATE INDEX IF NOT EXISTS rental_handoffs_phase_idx ON public.rental_handoffs(phase);
CREATE INDEX IF NOT EXISTS rental_handoffs_completed_at_idx ON public.rental_handoffs(completed_at DESC);

-- Comments
COMMENT ON TABLE public.rental_handoffs IS 'Detailed handout (выдача) and return (возврат) data for each rental. Replaces simple checklist_state.';
COMMENT ON COLUMN public.rental_handoffs.rental_id IS 'Link to the rentals table';
COMMENT ON COLUMN public.rental_handoffs.phase IS 'Phase: handout (выдача) or return (возврат)';
COMMENT ON COLUMN public.rental_handoffs.odometer_start IS 'Odometer reading in km at handout (required per contract)';
COMMENT ON COLUMN public.rental_handoffs.odometer_end IS 'Odometer reading in km at return (required per contract)';
COMMENT ON COLUMN public.rental_handoffs.fuel_level_start IS 'Fuel level (%) or liters at handout';
COMMENT ON COLUMN public.rental_handoffs.fuel_level_end IS 'Fuel level (%) or liters at return';
COMMENT ON COLUMN public.rental_handoffs.battery_level_start IS 'Battery level % for electric bikes at handout';
COMMENT ON COLUMN public.rental_handoffs.battery_level_end IS 'Battery level % for electric bikes at return';
COMMENT ON COLUMN public.rental_handoffs.damage_notes IS 'Description of any damage found at return';
COMMENT ON COLUMN public.rental_handoffs.completed_by IS 'User ID of crew member who completed this phase';

-- Helper function to get handoff summary for analytics
CREATE OR REPLACE FUNCTION public.get_rental_handoff_summary(p_rental_id UUID)
RETURNS JSONB AS $$
DECLARE
  handoff_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'handout', (
      SELECT row_to_json(h) FROM (
        SELECT
          id, completed_at, completed_by,
          passport_checked, license_checked, deposit_collected,
          helmet_issued, keys_issued, instructions_given, photos_taken,
          odometer_start, fuel_level_start, battery_level_start,
          handout_notes
        FROM rental_handoffs WHERE rental_id = p_rental_id AND phase = 'handout'
      ) h
    ),
    'return', (
      SELECT row_to_json(r) FROM (
        SELECT
          id, completed_at, completed_by,
          condition_checked, helmet_returned, keys_returned,
          deposit_returned, no_damages_confirmed,
          odometer_end, fuel_level_end, battery_level_end,
          damage_notes, return_notes
        FROM rental_handoffs WHERE rental_id = p_rental_id AND phase = 'return'
      ) r
    )
  ) INTO handoff_data;

  RETURN handoff_data;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_rental_handoff_summary IS 'Returns handout and return data for a rental in structured JSONB format';
