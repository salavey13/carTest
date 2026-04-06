-- /sql/002-leaderboard-materialized-view.sql
-- Materialized view for weekly leaderboard — refreshes every 60s.
-- Eliminates expensive aggregation on every /leaderboard request.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_weekly_leaderboard AS
SELECT
  s.user_id,
  s.crew_slug,
  u.username,
  u.full_name,
  COUNT(*) AS session_count,
  ROUND(SUM(COALESCE(s.total_distance_km, 0))::numeric, 1) AS total_distance_km,
  ROUND(AVG(COALESCE(s.avg_speed_kmh, 0))::numeric, 1) AS avg_speed_kmh,
  ROUND(MAX(COALESCE(s.max_speed_kmh, 0))::numeric, 1) AS max_speed_kmh,
  RANK() OVER (
    PARTITION BY s.crew_slug
    ORDER BY SUM(COALESCE(s.total_distance_km, 0)) DESC
  ) AS rank
FROM public.map_rider_sessions s
LEFT JOIN public.users u ON u.user_id = s.user_id
WHERE s.started_at >= NOW() - INTERVAL '7 days'
  AND s.status IN ('active', 'completed')
GROUP BY s.user_id, s.crew_slug, u.username, u.full_name;

-- Index for fast crew_slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_crew_user
  ON public.mv_weekly_leaderboard (crew_slug, user_id);
CREATE INDEX IF NOT EXISTS idx_mv_leaderboard_crew_rank
  ON public.mv_weekly_leaderboard (crew_slug, rank);

-- Refresh function (call from cron or after session stop)
CREATE OR REPLACE FUNCTION public.refresh_weekly_leaderboard()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_weekly_leaderboard;
$$;

-- Auto-refresh via pg_cron (every 60s)
-- SELECT cron.schedule('refresh-leaderboard', '* * * * *',
--   $$SELECT public.refresh_weekly_leaderboard()$$);

COMMIT;
