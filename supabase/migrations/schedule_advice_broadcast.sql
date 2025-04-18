-- Ensure pg_cron extension is enabled in your Supabase project
-- You might need to run this once via the Supabase SQL Editor: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Check if the job already exists to make the script idempotent
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
        SELECT cron.schedule(
            'hourly-advice-broadcast-job', -- Unique name for the job
            '0 * * * *', -- Cron syntax for "at minute 0 of every hour"
            $$ SELECT net.http_post( -- Supabase Edge Functions are invoked via HTTP request
                url:='YOUR_SUPABASE_FUNCTIONS_URL/hourly-advice-broadcast', -- IMPORTANT: Replace with your actual function invocation URL
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb -- Pass the secret
                -- Use secrets manager for production: pass secret reference instead of hardcoding
            ) $$
        );
        RAISE NOTICE 'Cron job "hourly-advice-broadcast-job" created.';
    ELSE
        RAISE NOTICE 'Cron job "hourly-advice-broadcast-job" already exists. Skipping creation.';
        -- Optionally, unschedule and reschedule if you need to update the command/schedule
        -- SELECT cron.unschedule('hourly-advice-broadcast-job');
        -- SELECT cron.schedule(...); -- Reschedule command here
    END IF;
END $$;

-- Add comments for clarity
COMMENT ON EXTENSION pg_cron IS 'Scheduler extension for PostgreSQL.';
-- Add comment explaining the job if desired
-- COMMENT ON ... (Not directly possible on cron.job entries in older pg_cron versions)

/*
Notes:
1. Replace 'YOUR_SUPABASE_FUNCTIONS_URL/hourly-advice-broadcast' with the actual invocation URL
   provided in your Supabase dashboard (Functions -> select function -> Invocation URL).
2. Replace 'YOUR_CRON_SECRET' with the same secret key you set in the Edge Function's
   environment variables and use in the API route's check.
3. For enhanced security in production, consider using Supabase Vault to store the CRON_SECRET
   and reference it in the `http_post` call instead of hardcoding it here.
4. Ensure the `net.http_post` function (part of the `pg_net` extension) is available and callable
   by the `postgres` role or the user running the cron job. `pg_net` should be enabled by default
   on Supabase projects. Check documentation if issues arise.
*/