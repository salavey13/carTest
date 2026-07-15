-- Add crew_id to rentals for crew-scoped queries in getFranchizeLeads()
-- Denormalization: crew is already derivable via vehicle_id → cars.crew_id,
-- but adding it directly speeds up crew-scoped queries and simplifies joins.

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

-- Backfill: set crew_id from cars table
UPDATE public.rentals r
SET crew_id = c.crew_id
FROM public.cars c
WHERE r.vehicle_id = c.id
  AND r.crew_id IS NULL;

-- Index for crew-scoped queries
CREATE INDEX IF NOT EXISTS idx_rentals_crew_id
  ON public.rentals(crew_id);

COMMENT ON COLUMN public.rentals.crew_id IS 'Denormalized crew reference for fast crew-scoped queries. Set on insert by trigger or application code.';
