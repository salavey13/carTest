# Cartest — Full Backup & Restore (fresh Supabase)

> Актуально на 2026-10-14 · project `inmctohsodgdohamhzag` · backup stamp `202610131850`
> Backup made by `scripts/task84-backup.mjs`, restore by `scripts/restore.mjs`.
> **Пошаговая инструкция «клонировать проект другу» (Vercel + GitHub fork + Supabase + бот):**
> `docs/CLONE_PROJECT_GUIDE.html` — развёрнуто, с псевдо-скриншотами каждого меню.

## 0. Where the latest backup lives

Public parts (each < 50 MB — the free-plan upload cap), joined by `cat` / `copy /b`:

```
https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/backup-clone-2026-10/
  MANIFEST.json                                ← passport: counts, sha256, join commands
  cartest-super-backup-20261013.zip.part0..3.bin   ← 4 × 40 MB + 6.5 MB
  full-schema-2026-10-13.sql                   ← all 185 migrations combined for a FRESH project
```

- zip: 132 649 008 bytes · sha256 `ef26b9ddedf80528155531648d6d7cc4e0ce0067bc51d90d1636d6a2849ca87d`
- Snapshot: **117 tables (109 public + 8 private), 11 716 rows, 19 buckets, 240 MB storage**
- ⚠️ The backup itself lives ONLY in storage (carpix), never in the repo — it carries user PII.

## 1. What the backup contains

| Path | Content |
|------|---------|
| `data/*.json` | EVERY PostgREST-visible table: 109 public + 8 **private**-schema tables (`private-*.json`), full rows, 11 716 rows total |
| `data/*.sql`, `data.sql` | best-effort INSERTs (`ON CONFLICT DO NOTHING`), jsonb-aware; psql/SQL-editor restore path |
| `storage/<bucket>/…` | all downloadable objects from all 21 buckets (~1 115 objects, 240 MB: carpix marketing/catalogues, about, tutorial media, contracts, doc-verifier) |
| `schema/openapi.json`, `schema/openapi-private.json` | exact tables/columns/PKs at backup time |
| `schema/full-schema-*.sql` | all `supabase/migrations` (185 files) concatenated in filename order — paste-once schema init |
| `schema/storage-buckets.json` | bucket settings (public / size limits / mime types) |
| `schema/storage-orphaned-*.json` | metadata rows whose bytes the backend confirms missing (`NoSuchKey`) — unrecoverable, listed for audit |
| `schema/dbkeys-failed-*.json` | keys probed and confirmed absent |
| `MANIFEST.json` | row/object counts, commit, checksums of scope |

**Orphaned objects (bytes confirmed gone server-side as of 2026-10-13):**
`rental-contracts` 266/266, `doc-verifier` 287/288, `svarprofi` 4/12. Not a data loss: contract
contents live in `private.rental_contract_artifacts` and DOCX regenerate from the deal template
on demand. `rental-photos` / `wallpix` / `storagepix` contain only empty folder trees.

**NOT capturable via the service key (recreate manually):**
- `auth.users` — passwords/MFA/sessions. Riders re-login via Telegram bot; admin passwords must be re-granted.
- Edge function secrets and Vercel env vars (see §4).
- `storage` schema internals — recreated by Supabase automatically.

⚠️ **The zip contains user PII, passports/ driving licences (`private.user_rental_secrets`), crew secrets and contract archives. Keep it offline, share by hand only.**

## 2. Restore schema (fresh Supabase project)

Two ways — pick one:

```bash
# A) CLI (186 numbered migration files)
git clone https://github.com/salavey13/cartest.git && cd cartest
bun install
supabase link --project-ref <NEW-PROJECT-REF>
supabase db push          # applies supabase/migrations in order

# B) One-file paste: schema/full-schema-2026-10-13.sql into the SQL Editor
```

## 3. Restore data + storage

```bash
node scripts/restore.mjs \
  --url https://<NEW-REF>.supabase.co \
  --key <NEW-SERVICE-ROLE-KEY> \
  --dir /path/to/cartest-backup-202610131850
```

- Parents (`users`, `crews`, `cars`, `crew_members`…) are inserted first,
  private artifact tables last. The script is **re-runnable**: rows are
  upserted (`merge-duplicates` on known PKs), objects uploaded with `x-upsert`.
- If a table fails on FK, insert its parent first, then re-run with `--only <table>`.
- Storage buckets are recreated with their original public/size/mime settings;
  every backed-up object is re-uploaded under its original key.

## 4. Environment variables (Vercel → new project)

Variable NAMES only — no values in the repo, ever (values live in Vercel/Supabase dashboards):

```
# — core, без этого не заведётся —
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # секрет
TELEGRAM_BOT_TOKEN               # секрет, own bot via @BotFather
TELEGRAM_BOT_USERNAME            # bot без @
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
NEXT_PUBLIC_TELEGRAM_BOT_LINK    # https://t.me/<bot>
NEXT_PUBLIC_SITE_URL             # https://<new-deploy>.vercel.app
ADMIN_CHAT_ID                    # owner tg id
CRON_SECRET                      # openssl rand -hex 24

# — strongly recommended (иначе транспорт шлёт через ОРИГИНАЛЬНЫЙ v0-car-test) —
TELEGRAM_SEND_MODE=direct
ALLOWED_FORWARD_ORIGINS          # https://<new-deploy>.vercel.app
FORWARD_TELEGRAM_URL             # https://<new-deploy>.vercel.app/api/forward-telegram
TELEGRAM_WEBAPP_ALLOWED_ORIGINS  # https://<new-deploy>.vercel.app

# — optional by feature —
NEXT_PUBLIC_MAP_TILE_URL / NEXT_PUBLIC_MAP_TILE_DARK / NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
SMTP_YANDEX_HOST / SMTP_YANDEX_PORT / SMTP_YANDEX_USER / SMTP_YANDEX_PASS / EMAIL_FROM
AVITO_CLIENT_ID / AVITO_CLIENT_SECRET / AVITO_USER_ID / AVITO_WEBHOOK_SECRET
WB_API_TOKEN / WB_WAREHOUSE_ID / YM_API_TOKEN / OZON_CLIENT_ID / OZON_API_KEY
GITHUB_TOKEN / UNSPLASH_ACCESS_KEY
```

⚠️ `NEXT_PUBLIC_*` вшивается при BUILD: поменял → Deployments → Redeploy.
⚠️ Hobby-план Vercel: **max 2 cron jobs** — в `vercel.json` их три; перед первым деплоем
убрать `cleanup-wallpix-staging` (иначе деплой может не пройти).

## 5. Telegram bot re-wiring

1. Own bot via @BotFather (`/newbot` → token → `TELEGRAM_BOT_TOKEN` env).
2. Webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<NEW-DEPLOY>/api/telegramWebhook`
3. Menu button = webapp: BotFather → /mybots → Bot Settings → Menu Button → new deploy URL.
4. Crew invite links embed the bot username from crew metadata — set own bot username in env.
5. Deeplink grammar (`rent_<bikeId>` / `rental_<rentalId>`, `startapp=…`) unchanged —
   authoritative source: `useStartParamRouter`.

## 6. Verification checklist

- [ ] `/franchize/vip-bike` renders, prices/images present
- [ ] Profile page: tabs switch, earnings visible for crew roles
- [ ] map-riders: riders/маршруты render, game-map skin follows the theme toggle
- [ ] map-riders «Сеть»: graph renders WITHOUT the I_O_S_NN spider-web
      (display filter) and operators see the «⚙️ Роли экипажей» manager
- [ ] Rentals: create → contract docx generated → stored → visible in аренды table
- [ ] Sales: artifact created, cash transaction row appears
- [ ] Crew management: roles editable, invite deeplink opens the bot
- [ ] Salary report TG file delivery to ADMIN_CHAT_ID works
- [ ] cron routes answer with `CRON_SECRET`
- [ ] Global admin: `UPDATE users SET role='admin' WHERE user_id=<tg id>;` after first login

## 6b. Owners/admins for prefabricated crews (2026-10-14+)

Prefab crews ship with **I_O_S_NN as the default owner** and zero admins. Two ways to fix:

1. **UI (recommended)** — hardcoded network role operators (`356282674` I_O_S_NN,
   `413553377` salavey13, see `app/franchize/lib/network-role-operators.ts`) get the
   **«⚙️ Роли экипажей»** card on the map-riders **«Сеть»** tab: pick a crew → assign
   Владелец/Совладелец/Админ (👑/🤝/🛡) or add a person by **@username / Telegram ID**
   — the membership row is created on the fly; owner transfer demotes the previous
   owner to co_owner. Server actions: `app/franchize/server-actions/network-role-manager.ts`.
2. **SQL fallback** — `UPDATE crew_members SET role=…` / `crews.owner_id` via SQL Editor
   (see `docs/CLONE_PROJECT_GUIDE.html`, step 8).

Note: the network VIEW also hides I_O_S_NN's memberships until crews get real admins
(`NETWORK_DISPLAY_EXCLUDED_USER_IDS` in `app/franchize/discovery/load-network-model.ts`)
— otherwise every prefab crew links through one person and the graph reads as a star.

## 7. Making a NEW backup

```bash
node --env-file=.env.local scripts/task84-backup.mjs            # all phases
# resumable phases: --phase tables|sql|storage|dbkeys|manifest, --bucket <name>
node --env-file=.env.local scripts/task93-storage-audit.mjs     # per-bucket usage report
```

Then zip `cartest-backup-<stamp>/` (STAMP file keeps re-runs inside one dir);
if > 50 MB — split into parts (`split -b 40m`) and upload with a MANIFEST
(see `scripts/task93-upload-backup.mjs` for the exact convention).

## 8. Storage headroom (free Hobby plan: 1 GB files / 500 MB db / 5 GB egress)

Audit 2026-10-13 (`task93-storage-audit.mjs`, recursive):

```
carpix 123.4 MB · about 46.8 MB · tutorial-1-img-swap 20.8 MB · vprtests 13.1 MB
doc-verifier 5.8 MB · rental-contracts 5.5 MB · прочее < 20 MB
TOTAL: 1 115 objects, 240.3 MB → занято 23.5%, свободно ≈ 784 MB
```

DB data payload ≈ 20 MB JSON (11 716 rows) — в Postgres с индексами ~30–50 MB, план 500 MB влезает.
