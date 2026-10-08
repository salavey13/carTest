# Cartest — Full Backup & Restore (fresh Supabase)

> Актуально на 2026-10-08 · project `inmctohsodgdohamhzag` · commit `0b27371b2`
> Backup made by `scripts/task84-backup.mjs`, restore by `scripts/restore.mjs`.

## 1. What the backup contains

| Path | Content |
|------|---------|
| `data/*.json` | EVERY PostgREST-visible table: 109 public + 8 **private**-schema tables (`private-*.json`), full rows, 11 443 rows total |
| `data/*.sql`, `data.sql` | best-effort INSERTs (`ON CONFLICT DO NOTHING`), jsonb-aware; psql/SQL-editor restore path |
| `storage/<bucket>/…` | all downloadable objects from all 21 buckets (rental contracts, rental photos, doc-verifier docs, site media) |
| `schema/openapi.json`, `schema/openapi-private.json` | exact tables/columns/PKs at backup time |
| `schema/storage-buckets.json` | bucket settings (public / size limits / mime types) |
| `schema/storage-orphaned-*.json` | metadata rows whose bytes the backend confirms missing (`NoSuchKey`) — unrecoverable, listed for audit |
| `schema/dbkeys-failed-*.json` | keys probed and confirmed absent |
| `MANIFEST.json` | row/object counts, commit, checksums of scope |

**NOT capturable via the service key (recreate manually):**
- `auth.users` — passwords/MFA/sessions. Riders re-login via Telegram bot; admin passwords must be re-granted.
- Edge function secrets and Vercel env vars (see §4).
- `storage` schema internals — recreated by Supabase automatically.
- 14 rental-contract + few legacy objects confirmed missing server-side (see `schema/storage-orphaned-*.json`) — includes the deleted fake Y-VOLT sale contract (removed on purpose 2026-10-08).

⚠️ **The zip contains user PII, passports/ driving licences (`private.user_rental_secrets`), crew secrets and contract archives. Keep it offline, share by hand only.**

## 2. Restore schema (fresh Supabase project)

```bash
git clone https://github.com/salavey13/cartest.git && cd cartest
bun install
supabase link --project-ref <NEW-PROJECT-REF>
supabase db push          # applies supabase/migrations in order (186 files)
```

No Supabase CLI? Paste the contents of `supabase/migrations/*.sql` into the
SQL editor **in filename order** (they are numbered).

## 3. Restore data + storage

```bash
node scripts/restore.mjs \
  --url https://<NEW-REF>.supabase.co \
  --key <NEW-SERVICE-ROLE-KEY> \
  --dir /path/to/cartest-backup-XXXX
```

- Parents (`users`, `crews`, `cars`, `crew_members`…) are inserted first,
  private artifact tables last. The script is **re-runnable**: rows are
  upserted (`merge-duplicates` on known PKs), objects uploaded with
  `x-upsert`.
- If a table fails on FK, insert its parent first, then re-run with
  `--only <table>`.
- Alternative for single tables: Supabase Table Editor → import
  `data/<table>.json` (converts to CSV), or run `data.sql` in the SQL editor
  **in two passes**: public tables first, then `private-*` INSERTs prefixed
  with `SET search_path = private;`.

Storage buckets are recreated with their original public/size/mime settings;
every backed-up object is re-uploaded under its original key.

## 4. Environment variables (Vercel → new project)

```
NEXT_PUBLIC_SUPABASE_URL=https://<NEW-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<new-service-key>
TELEGRAM_BOT_TOKEN=<from @BotFather — keep the SAME bot @oneBikePlsBot to preserve deeplinks>
TELEGRAM_ADMIN_CHAT_ID / notify chats  (см. текущие Vercel env)
CRON_SECRET=<новый секрет для cron-роутов>
NEXT_PUBLIC_SITE_URL=https://<домен>
# опционально: NEXT_PUBLIC_MAP_TILE_URL / NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
```

## 5. Telegram bot re-wiring

1. Same bot token ⇒ `startapp` deeplinks keep working; only the webhook needs
   re-pointing if the deployment URL changed:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<NEW-DEPLOY>/api/telegram/webhook`
2. Crew invite links embed the bot username from crew metadata — unchanged for
   the same bot.
3. Salary/TG report delivery uses the forward-API route with the deployment
   Origin header — verify after first deploy.

## 6. Verification checklist

- [ ] `/franchize/vip-bike` renders, prices/images present
- [ ] Profile page: tabs switch, earnings visible for crew roles
- [ ] map-riders: riders/маршруты render, game-map skin follows the theme toggle
- [ ] Rentals: create → contract docx generated → stored → visible in аренды table
- [ ] Sales: artifact created, cash transaction row appears
- [ ] Crew management: roles editable, invite deeplink opens the bot
- [ ] Salary report TG file delivery to 413553377 works
- [ ] cron routes answer with `CRON_SECRET`

## 7. Making a NEW backup

```bash
node --env-file=.env.local scripts/task84-backup.mjs            # all phases
# resumable phases: --phase tables|sql|storage|dbkeys|manifest, --bucket <name>
```

Then zip `cartest-backup-<stamp>/` (STAMP file keeps re-runs inside one dir).
