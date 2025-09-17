-- Schedule daily sync at midnight UTC
SELECT cron.schedule(
  'daily-sync-stocks',
  '0 0 * * *',  -- Every day at 00:00 UTC
  'SELECT net.http_post(
    url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-stocks'',
    headers:=''{"Authorization": "Bearer YOUR_CRON_SECRET"}''::jsonb
  );'
);