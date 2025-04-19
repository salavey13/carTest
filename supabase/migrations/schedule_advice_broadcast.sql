-- Ensure pg_cron extension is enabled in your Supabase project
-- You might need to run this once via the Supabase SQL Editor: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EDGE FUNC FIRST AND UPDATE THE NAME AND SECRET
DO $$
DECLARE
    job_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'hourly-advice-broadcast-job'
    ) INTO job_exists;

    IF NOT job_exists THEN
        -- Schedule the job to run every hour at minute 0
        -- Replace 'hourly-advice-broadcast' with your exact function name if different
        PERFORM cron.schedule(
            'hourly-advice-broadcast-job', 
            -- Unique name for the job
            '0 * * * *', 
            -- Cron syntax for "at minute 0 of every hour"
            'SELECT net.http_post(
                url:=''https://inmctohsodgdohamhzag.supabase.co/functions/v1/smooth-responder'',
                headers:=''{”Content-Type”: ”application/json”, ”Authorization”: ”Bearer SECRET”}’’::jsonb, 
                body:=’’{ "name": "Functions" }''::jsonb,
                timeout_milliseconds:=4200
             );'
        );
        RAISE NOTICE 'Cron job "hourly-advice-broadcast-job" created.';
    ELSE
        RAISE NOTICE 'Cron job "hourly-advice-broadcast-job" already exists. Skipping creation.';
        -- Optionally, unschedule and reschedule if you need to update the command/schedule
        -- SELECT cron.unschedule('hourly-advice-broadcast-job');
        -- SELECT cron.schedule(...); -- Reschedule command here
    END IF;
END $$;

COMMENT ON EXTENSION pg_cron IS 'Scheduler extension for PostgreSQL.';
