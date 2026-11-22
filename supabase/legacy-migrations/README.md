# Legacy migrations (OUT of the apply path)

Everything in this directory is **not applied** when you set up a fresh database
(`supabase db push` / linked project only reads `supabase/migrations/`).
Moved here with `git mv` — file history is preserved.

## Why this exists

The repo started as a sandbox with many experiments (education tests, gaming
lobbies, crypto arbitrage, cron jobs…). Those migrations lived in the same
apply path as the VIP Bike franchise product, which made a **fresh clone
un-applyable**: junk files, duplicated tables, pg_cron jobs calling
not-yet-deployed edge functions, and one file that drops a column the live
app depends on. Iteration 29 moved everything non-product out of the path.

## Layout

| Folder | What's inside | Why it's out |
|---|---|---|
| `_junk/` | A photo, two CSV exports, a notes txt | Not SQL at all — `supabase db push` chokes on them |
| `_cron/` | 4 pg_cron job migrations (daily insights, sleep reminders, advice broadcast, user backup) | A fresh clone has no edge functions deployed and no `pg_cron` extension configured; cron jobs must be a conscious opt-in, not a side effect of migrating |
| `_sandbox/` | VPR education question seeds (Russian school tests), captcha/market-data/youtube/testimonial experiments, unused provider RPCs, duplicated `arbitrage_settings`, the AI gem table, and `20240719000000_refactorNOTAPPLIED_leaderboards_and_schema.sql` | Sandbox-only, zero code references — or (the NOTAPPLIED file) a refactor that was never applied to the live DB and diverges a fresh clone from the real schema |

## ⚠️ Security note — rotate this token

`_cron/20260610000000_daily_insights_cron.sql` and
`_cron/20260610000002_sleep_reminder_cron.sql` contain a **hard-coded Telegram
bot token** (chat id prefix `80379508`). Even though the files are now out of
the apply path, the token has been in git history — treat it as leaked:

1. Open @BotFather → `/revoke` → generate a new token for that bot.
2. If you still want those cron jobs, re-create them with the token injected
   from a secret at deploy time (never in SQL).

## Want some of it back?

Each file is plain SQL — copy (don't move) what you need back into
`supabase/migrations/` **with a fresh `YYYYMMDDHHMMSS_` prefix** so it lands at
the end of the chain, or paste it into the Supabase SQL editor directly.
