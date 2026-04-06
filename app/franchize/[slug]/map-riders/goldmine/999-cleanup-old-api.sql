-- /sql/999-cleanup-old-api.sql
-- After migration is verified, deprecate old per-tick writes.
-- DO NOT RUN until new batch-points endpoint is confirmed working.

-- Step 1: Check if old location endpoint is still receiving traffic
-- SELECT count(*) FROM public.map_rider_points WHERE captured_at > NOW() - INTERVAL '1 hour';

-- Step 2: After confirming batch-points works, you can optionally:
-- a) Add a deprecation header in /api/map-riders/location/route.ts:
--    response.headers.set('X-Deprecated', 'Use /api/map-riders/batch-points instead');
-- b) Rate-limit old endpoint to 1 req/s per user

-- Step 3: Archive old live_locations (run via pg_cron hourly)
-- DELETE FROM public.live_locations WHERE updated_at < NOW() - INTERVAL '24 hours';

-- Step 4: Vacuum after cleanup
-- VACUUM ANALYZE public.live_locations;
-- VACUUM ANALYZE public.map_rider_points;
