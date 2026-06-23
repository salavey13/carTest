-- /supabase/migrations/20260623000002_add_cars_is_active.sql
-- Add is_active column to cars table for filtering obsolete/hidden bikes
-- This allows hiding old/obsolete bikes from commercial proposals and catalogs
-- while keeping them in the database for historical records.

-- Add is_active column (default TRUE for existing bikes)
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_cars_is_active ON public.cars(is_active)
WHERE is_active = FALSE;  -- Partial index for inactive bikes only

COMMENT ON COLUMN public.cars.is_active IS 'Whether the bike is visible in catalogs and commercial proposals. Set to FALSE to hide obsolete/old bikes.';

-- Set some known obsolete bikes as inactive if needed
-- UPDATE public.cars SET is_active = FALSE WHERE id IN ('obsolete-bike-id-1', 'obsolete-bike-id-2');
