-- In your SupaPlan skill, before pick_task():
CREATE OR REPLACE FUNCTION supaplan_cleanup_stale()
RETURNS void AS $$ BEGIN
  UPDATE supaplan_tasks 
  SET status = 'pending', claimed_by = NULL 
  WHERE status = 'in_progress' 
    AND heartbeat < NOW() - INTERVAL '30 minutes';
END;
 $$ LANGUAGE plpgsql;
