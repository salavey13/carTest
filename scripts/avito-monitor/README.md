# Avito lead monitor (production: `/opt/vip-bike-avito/scripts/`)

GLM-powered poller for Avito Messenger → Telegram team alerts + rental CRM
webhook. **Production deployment is authoritative** — this folder mirrors it.

## Files
- `avito_monitor.py` — entrypoint: scan gate (2 min 10:00–20:00 MSK / 5 min off-hours),
  lead pipeline (chats v2 → messages v3 → GLM-5.2 analysis), Telegram outbox
  with per-target quarantine, CRM webhook-outbox, reminders, self-test.
- `lead_store.py` — SQLite storage (WAL, 0600): `leads`, `messages`,
  `reminders`, `deliveries`, `delivery_outbox`, `target_health`,
  `webhook_outbox`. Run `python3 lead_store.py` for storage self-test.
- `config.json` — profile user_ids + team chat ids only. **No secrets** —
  everything sensitive lives in `/opt/vip-bike-avito/secrets.env` (0600):
  `AVITO_CLIENT_ID/SECRET` (rental), `AVITO_SALE_CLIENT_ID/SECRET`,
  `TELEGRAM_BOT_TOKEN`, `AVITO_TELEGRAM_CHAT_IDS`, `Z_AI_API_KEY`,
  `Z_AI_BASE_URL`, `AVITO_LEADS_WEBHOOK_URL/SECRET`.

## Token economy (B1, plan 2026-09-05)
- Avito access token cached in `state.json` for 23h (~2 token calls/day).
- GLM called **exactly once per new inbound buyer message**; stored
  `analyzed_message_at` guarantees zero re-analysis on retries.
- Scan-gate: cron ticks every 2 min, script skips Avito polling outside its
  interval; queues (Telegram / CRM webhook / reminders) drain every tick.

## Cron (root)
```
*/2 * * * * cd /opt/vip-bike-avito && /usr/bin/python3 scripts/avito_monitor.py >> scripts/cron.log 2>&1
```

## Checks
```
python3 avito_monitor.py --self-test    # store + filters
python3 avito_monitor.py --agent-health # GLM availability
python3 avito_monitor.py --init-db      # schema + stats
```

Receiver side (CRM): `app/api/webhooks/avito/route.ts` in this repo —
always-200 for the official Avito webhook, 503 for `monitor:*` events when
lead persistence fails (the outbox here retries those).
