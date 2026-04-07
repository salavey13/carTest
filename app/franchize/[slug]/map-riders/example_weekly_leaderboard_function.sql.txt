-- Weekly leaderboard function for MapRiders
-- Returns aggregated stats for completed sessions in the last 7 days

CREATE OR REPLACE FUNCTION get_weekly_leaderboard(p_crew_slug TEXT)
RETURNS TABLE (
  user_id TEXT,
  rider_name TEXT,
  distance_km NUMERIC,
  session_count BIGINT,
  avg_speed_kmh NUMERIC,
  max_speed_kmh NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    COALESCE(u.full_name, u.username, s.user_id) AS rider_name,
    ROUND(SUM(s.total_distance_km)::NUMERIC, 2) AS distance_km,
    COUNT(*) AS session_count,
    ROUND(AVG(s.avg_speed_kmh)::NUMERIC, 1) AS avg_speed_kmh,
    ROUND(MAX(s.max_speed_kmh)::NUMERIC, 1) AS max_speed_kmh
  FROM map_rider_sessions s
  LEFT JOIN users u ON u.user_id = s.user_id
  WHERE s.crew_slug = p_crew_slug
    AND s.status = 'completed'
    AND s.ended_at >= NOW() - INTERVAL '7 days'
  GROUP BY s.user_id, COALESCE(u.full_name, u.username, s.user_id)
  ORDER BY SUM(s.total_distance_km) DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_weekly_leaderboard(TEXT) IS 
'Returns weekly leaderboard for MapRiders: total distance, session count, avg/max speed per rider';
