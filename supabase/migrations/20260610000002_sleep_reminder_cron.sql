-- Sleep Reminder Cron Job Test
-- Sends "Go to sleep!" reminder at 4:20 AM GMT+3 (1:20 AM UTC)
-- Calls Telegram API directly (no origin check issues)

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store Telegram bot token in app.settings (if not exists)
INSERT INTO app.settings (key, value)
VALUES ('telegram_bot_token', '8037950842:AAFpaavB_M_zQtOFFN3kDmg44-EcApLHw9w')
ON CONFLICT (key) DO NOTHING;

-- Schedule sleep reminder at 1:20 AM UTC (4:20 AM GMT+3)
SELECT cron.schedule(
  'sleep-reminder',
  '20 1 * * *',  -- 1:20 AM UTC = 4:20 AM GMT+3
  $$
  SELECT
    net.http_post(
      url := 'https://api.telegram.org/bot' || (SELECT value FROM app.settings WHERE key = 'telegram_bot_token' LIMIT 1) || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', '413553377',
        'text', '😴 Пора спать! 4:20 - время отдыхать. Спокойной ночи! 🌙',
        'parse_mode', 'HTML'
      ),
      timeout := 30
    );
  $$
);

-- Verify job was scheduled
SELECT * FROM cron.job WHERE jobname = 'sleep-reminder';

-- To test manually (send immediately):
-- INSERT INTO app.settings (key, value) VALUES ('telegram_bot_token', '8037950842:AAFpaavB_M_zQtOFFN3kDmg44-EcApLHw9w')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- SELECT net.http_post(
--   'https://api.telegram.org/bot' || (SELECT value FROM app.settings WHERE key = 'telegram_bot_token' LIMIT 1) || '/sendMessage',
--   jsonb_build_object('Content-Type', 'application/json'),
--   jsonb_build_object(
--     'chat_id', '413553377',
--     'text', '😴 Тест: Пора спать!',
--     'parse_mode', 'HTML'
--   )
-- );
