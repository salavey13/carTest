-- /sql/001-live-locations.sql
-- Creates live_locations table with PostGIS + RLS.
-- Run once per Supabase project.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.live_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL REFERENCES public.users(user_id),
  crew_slug text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  is_riding boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  location geography(POINT, 4326) GENERATED ALWAYS AS (
    ST_MakePoint(lng, lat)
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_live_locations_location ON public.live_locations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_live_locations_user_crew ON public.live_locations (user_id, crew_slug);
CREATE INDEX IF NOT EXISTS idx_live_locations_crew ON public.live_locations (crew_slug);
CREATE INDEX IF NOT EXISTS idx_live_locations_updated ON public.live_locations (updated_at);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "riders see only nearby in same crew" ON public.live_locations;
DROP POLICY IF EXISTS "users can insert own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can update own location" ON public.live_locations;
DROP POLICY IF EXISTS "users can delete own location" ON public.live_locations;

-- SELECT: crew members see each other (within 15km)
CREATE POLICY "riders see only nearby in same crew"
ON public.live_locations FOR SELECT
USING (
  crew_slug = (
    SELECT metadata->>'slug' FROM public.crews
    WHERE id = (SELECT crew_id FROM public.crew_members WHERE user_id = (auth.jwt() ->> 'chat_id') LIMIT 1)
  )
  AND (
    user_id = (auth.jwt() ->> 'chat_id')
    OR ST_DWithin(
      location,
      (SELECT location FROM public.live_locations WHERE user_id = (auth.jwt() ->> 'chat_id') ORDER BY updated_at DESC LIMIT 1),
      15000
    )
  )
);

-- INSERT: users insert their own location
CREATE POLICY "users can insert own location"
ON public.live_locations FOR INSERT
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

-- UPDATE: users update their own location
CREATE POLICY "users can update own location"
ON public.live_locations FOR UPDATE
USING (user_id = (auth.jwt() ->> 'chat_id'))
WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));

-- DELETE: users delete their own location
CREATE POLICY "users can delete own location"
ON public.live_locations FOR DELETE
USING (user_id = (auth.jwt() ->> 'chat_id'));

-- AUTO-EXPIRE: delete locations older than 24h (run via pg_cron or manual)
-- SELECT cron.schedule('cleanup-live-locations', '0 * * * *',
--   $$DELETE FROM public.live_locations WHERE updated_at < NOW() - INTERVAL '24 hours'$$);

COMMIT;
