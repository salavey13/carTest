-- MapRiders goldmine port — iteration I1 contract migration (additive, idempotent)
-- Prepared for manual review/apply.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.live_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  crew_slug text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  is_riding boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  location geography(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(lng, lat)) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS live_locations_user_id_key
  ON public.live_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_location
  ON public.live_locations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_live_locations_crew
  ON public.live_locations (crew_slug);
CREATE INDEX IF NOT EXISTS idx_live_locations_updated_at
  ON public.live_locations (updated_at DESC);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_locations'
      AND policyname = 'live_locations_select_same_crew'
  ) THEN
    CREATE POLICY live_locations_select_same_crew
      ON public.live_locations
      FOR SELECT
      USING (
        crew_slug = (
          SELECT c.metadata->>'slug'
          FROM public.crews c
          WHERE c.id = (
            SELECT cm.crew_id
            FROM public.crew_members cm
            WHERE cm.user_id = (auth.jwt() ->> 'chat_id')
            LIMIT 1
          )
          LIMIT 1
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_locations'
      AND policyname = 'live_locations_insert_own'
  ) THEN
    CREATE POLICY live_locations_insert_own
      ON public.live_locations
      FOR INSERT
      WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_locations'
      AND policyname = 'live_locations_update_own'
  ) THEN
    CREATE POLICY live_locations_update_own
      ON public.live_locations
      FOR UPDATE
      USING (user_id = (auth.jwt() ->> 'chat_id'))
      WITH CHECK (user_id = (auth.jwt() ->> 'chat_id'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'live_locations'
      AND policyname = 'live_locations_delete_own'
  ) THEN
    CREATE POLICY live_locations_delete_own
      ON public.live_locations
      FOR DELETE
      USING (user_id = (auth.jwt() ->> 'chat_id'));
  END IF;
END $$;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_map_riders_weekly_leaderboard AS
SELECT
  s.user_id,
  s.crew_slug,
  COALESCE(NULLIF(u.full_name, ''), NULLIF(u.username, ''), s.user_id) AS rider_name,
  COUNT(*)::int AS sessions,
  ROUND(SUM(COALESCE(s.total_distance_km, 0))::numeric, 1) AS distance_km,
  ROUND(AVG(COALESCE(s.avg_speed_kmh, 0))::numeric, 1) AS avg_speed_kmh,
  ROUND(MAX(COALESCE(s.max_speed_kmh, 0))::numeric, 1) AS max_speed_kmh,
  RANK() OVER (
    PARTITION BY s.crew_slug
    ORDER BY SUM(COALESCE(s.total_distance_km, 0)) DESC
  )::int AS rank
FROM public.map_rider_sessions s
LEFT JOIN public.users u ON u.user_id = s.user_id
WHERE s.started_at >= NOW() - INTERVAL '7 days'
GROUP BY s.user_id, s.crew_slug, u.full_name, u.username;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_map_riders_weekly_leaderboard_crew_user
  ON public.mv_map_riders_weekly_leaderboard (crew_slug, user_id);
CREATE INDEX IF NOT EXISTS idx_mv_map_riders_weekly_leaderboard_crew_rank
  ON public.mv_map_riders_weekly_leaderboard (crew_slug, rank);

CREATE OR REPLACE FUNCTION public.refresh_map_riders_weekly_leaderboard()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_map_riders_weekly_leaderboard;
EXCEPTION
  WHEN object_not_in_prerequisite_state THEN
    REFRESH MATERIALIZED VIEW public.mv_map_riders_weekly_leaderboard;
END;
$$;

COMMIT;
