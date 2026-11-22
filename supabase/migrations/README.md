# Migrations — the clean apply path

This directory is the **product apply path**: `supabase db push` (or a linked
Supabase project) applies these ~160 files in filename order to build a
working VIP Bike franchise database.

## Fresh clone → fresh database

```bash
supabase link --project-ref <your-project-ref>   # or: supabase init + local db
supabase db push                                  # applies this folder in order
```

What you get: users, crews & crew members, cars (bikes/equipment/service
items), rentals + rental photos, franchize intents, leads, salary plans &
calculations, commissions, cash transactions, deposit entries, contract
artifacts (rental/sale/testdrive/subrent/commercial proposal), crew todos,
analytics passwords, shifts, maps & rider layers, message templates, and the
RPC surface the Telegram bot and the Mini App call.

Everything else (sandbox experiments, education seeds, pg_cron jobs, junk
files) lives in **`../legacy-migrations/`** — see its README before touching
anything there.

## Conventions (keep it clean)

1. **Filename = `YYYYMMDDHHMMSS_snake_case_description.sql`** (UTC timestamp
   prefix drives the order).
2. **Idempotent where possible**: prefer `IF EXISTS` / `IF NOT EXISTS`, and
   guard `ADD COLUMN` with `IF NOT EXISTS` — several legacy files don't, so
   early migrations may fail when re-run; that's expected, `db push` runs each
   file once.
3. **No secrets in SQL.** No bot tokens, no API keys — inject via env/secret
   manager at runtime. (See the warning in `../legacy-migrations/README.md`
   for the one that slipped through historically.)
4. **No pg_cron jobs.** Scheduled work runs as Vercel cron hitting protected
   app routes — visible, testable, and it dies with the app if unused.
5. **One concern per file** — a migration does one schema change or one
   backfill, never both when avoidable.
6. Historical quirk to know: `20240719000000_refactorNOTAPPLIED…` was never
   applied to the live DB and now lives in legacy — if you ever diff a fresh
   clone's schema against production, that file is why they *would* have
   diverged.
