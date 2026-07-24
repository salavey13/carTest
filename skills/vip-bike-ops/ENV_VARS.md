# VIP Bike Skills — Environment Variables Reference

> All env vars the skills, boss commands, and .mjs scripts need.
> Copy these into your `.env` file or export them before running.

## Required for ALL skills

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # full key from secrets.txt

# Crew (hardcoded fallbacks exist, but explicit is better)
CREW_SLUG=vip-bike
CREW_ID=2d5fde70-1dd3-4f0d-8d72-66ccf6908746
```

## Required for boss commands (Telegram notifications)

```bash
# Telegram bot
TELEGRAM_BOT_TOKEN=8037950842:AAHfsLxQULmAM2zHJ_HD0RvO0OUYZ12fa-M
ADMIN_CHAT_ID=413553377  # salavey13 (hardcoded for testing)
```

## Aliases (accepted by boss.mjs, execute.mjs, _lib.sh)

These are shorter aliases that the scripts accept alongside the canonical
Next.js names:

```bash
# boss.mjs / execute.mjs accept either:
SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co  # alias for NEXT_PUBLIC_SUPABASE_URL

# _lib.sh (boss-commands) reads from secrets.txt automatically, but if you
# export these explicitly they take precedence:
SUPABASE_SERVICE_ROLE_KEY=...  # same as above
ADMIN_CHAT_ID=...              # same as above
```

## Optional

```bash
# Suppress all Telegram notifications (for testing)
NOTIFY_SILENT=1

# Override the default SupaPlan capability
SUPAPLAN_CAPABILITY=franchize.gamification

# Force a specific Moscow timezone (default: Europe/Moscow)
TZ=Europe/Moscow
```

## Where to put them

### For the assistant bot (Claude on VPS)

The bot reads from `/opt/claudeclaw/vip-bike/.env`. Add the required vars there.

### For cron jobs

Cron doesn't inherit the shell environment. Either:
1. Source the `.env` at the top of each cron-invoked script (already done in `_lib.sh`)
2. Or set them in the crontab itself:
   ```cron
   SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   TELEGRAM_BOT_TOKEN=8037950842:...
   ADMIN_CHAT_ID=413553377
   0 6 * * * /path/to/boss-commands/morning-standup.sh
   ```

### For manual testing

```bash
export $(grep -v '^#' .env | xargs)
./boss-commands/morning-standup.sh --dry-run
```

## Secrets file location

The canonical secrets file is at:
```
/home/z/my-project/upload/secrets.txt
```

Format (key=value, one per line):
```
ADMIN_CHAT_ID=413553377
8037950842:AAHfsLxQULmAM2zHJ_HD0RvO0OUYZ12fa-M   ← bot token on line 3 (bare, no key=)
NEXT_PUBLIC_SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `_lib.sh` library in `boss-commands/` parses this file automatically —
you don't need to export anything if the file is present.

## Troubleshooting

### "Missing NEXT_PUBLIC_SUPABASE_URL" from boss.mjs

**Fixed (2026-07-24):** `boss.mjs` and `execute.mjs` now accept `SUPABASE_URL`
as an alias. Set either one in `.env`.

If you still see the error, check:
```bash
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'NOT SET')"
```

### Telegram notifications not arriving

Check:
1. `TELEGRAM_BOT_TOKEN` is set
2. `ADMIN_CHAT_ID` is set (default: 413553377)
3. `NOTIFY_SILENT` is NOT set to "1"
4. The bot is not blocked by the user
5. Test manually: `curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" -d "chat_id=$ADMIN_CHAT_ID&text=test"`

### Supabase 525 SSL errors

Transient Cloudflare issue. The `AnalyticsClientV2.tsx` now has an 8s timeout
that surfaces the error gracefully instead of hanging. Just retry.
