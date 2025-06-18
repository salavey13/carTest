-- This job runs every 5 minutes to collect fresh data from exchanges.
-- It calls the 'fetch-market-data' Edge Function.
SELECT
  cron.schedule(
    '5-min-market-data-collector',
    '*/5 * * * *', -- Run every 5 minutes (at minutes 0, 5, 10, etc.)
    $$
    SELECT
      net.http_post(
        url:='https://inmctohsodgdohamhzag.supabase.co/functions/v1/fetch-market-data',
        headers:='{"Authorization": "Bearer Arb!tRaGe_S3cRe7_K3y_F0r_Cr0n"}'::jsonb,
        timeout_milliseconds:=25000
      );
    $$
  );

-- This job runs every 5 minutes (offset by 1 minute) to analyze data and notify users.
-- It calls the 'arbitrage-analyzer-notifier' Edge Function.
SELECT
  cron.schedule(
    '5-min-arbitrage-analyzer',
    '1-59/5 * * * *', -- Run every 5 minutes, starting at minute 1 (1, 6, 11, etc.)
    $$
    SELECT
      net.http_post(
        url:='https://inmctohsodgdohamhzag.supabase.co/functions/v1/arbitrage-analyzer-notifier',
        headers:='{"Authorization": "Bearer Arb!tRaGe_S3cRe7_K3y_F0r_Cr0n"}'::jsonb,
        timeout_milliseconds:=25000
      );
    $$
  );