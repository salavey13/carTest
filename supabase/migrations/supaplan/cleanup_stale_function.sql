-- Release stale SupaPlan claims and reopen tasks.
-- Uses existing schema fields from init.sql:
--   supaplan_claims.last_heartbeat, supaplan_claims.ttl_seconds,
--   supaplan_tasks.status in (open, claimed, running, ready_for_pr, done)

CREATE OR REPLACE FUNCTION supaplan_cleanup_stale()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  released_count integer;
BEGIN
  WITH stale_claims AS (
    SELECT c.id, c.task_id
    FROM supaplan_claims c
    JOIN supaplan_tasks t ON t.id = c.task_id
    WHERE c.status = 'claimed'
      AND t.status IN ('claimed', 'running')
      AND c.last_heartbeat < now() - make_interval(secs => COALESCE(c.ttl_seconds, 300))
    FOR UPDATE
  ),
  claim_update AS (
    UPDATE supaplan_claims c
    SET status = 'expired'
    FROM stale_claims s
    WHERE c.id = s.id
    RETURNING c.task_id
  ),
  task_update AS (
    UPDATE supaplan_tasks t
    SET status = 'open',
        updated_at = now()
    WHERE t.id IN (SELECT task_id FROM claim_update)
    RETURNING t.id
  )
  SELECT COUNT(*)::integer INTO released_count FROM task_update;

  RETURN COALESCE(released_count, 0);
END;
$$;
