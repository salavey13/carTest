# META PRD: Iterative Implementation Plan (Franchize Ops Wave 2026-08)

**Version:** 1.3 (2026-08-11 — I3 code review hotfixed + I4 retention/polish shipped)
**Date:** 2026-08-11
**Status:** Active — living tracker, update as iterations ship
**Scope:** Coordinates 4 sibling PRDs that share tables, bot flows, and UI surfaces:
- `docs/DEPOSIT_TRACKING_PRD.md` v2.1 — ✅ Mostly Implemented (I1 + I2 closed remaining gaps)
- `docs/DOC_MANUAL_STEP_CORRECTION_PRD.md` v3.1 — ✅ Mostly Implemented
- `docs/RENTAL_PHOTO_UPLOAD_PRD.md` v1.3 — ✅ Shipped (I3 + I4 complete — code review hotfixed)
- `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` v4.1 — 📋 Ready for Implementation (I5)

---

## 1. Why a Meta Plan

The 2026-08-10/11 wave shipped DB migrations + bot flow changes for deposits and doc-manual steps BEFORE their PRDs were audited. The post-hoc audit (2026-08-11) found doc drift (wrong step numbers in the PRD vs code) and one real bug (deposit auto-return trigger missing idempotency guard). This meta plan exists to:

1. Keep one authoritative "what shipped / what's next" matrix across all 4 PRDs.
2. Sequence remaining work into small, independently shippable iterations.
3. Enforce quality gates so the next wave lands code + docs + tests together (no more post-hoc doc fixes).

---

## 2. Status Matrix (verified 2026-08-11)

| PRD | Shipped | Pending |
|---|---|---|
| DEPOSIT_TRACKING | ✅ `deposit_entries` table/view/RLS/backfill (`20260810000010`); auto-return triggers with double-return guard (`20260811000000` — I1); `deposit_destination` + split states in doc-manual; inserts on collection; `deposit-entries.ts` server actions; unit tests; **rental card badge** (`DepositBadge.tsx`); **`/admin/deposits` page** with filters + summary cards; **`deposit-tracer-text` skill** (4 commands); **`/api/franchize/deposit-summary|list|penalty` endpoints**; **evening-summary deposit section**; **penalty capture UI in closure modal** + `confirmVehicleReturn` writes `penalty` rows (I2); **morning-standup deposit section** (I2); sales delivery badge on `AnalyticsSaleCard` | Profile page "My Work" deposits-by-operator section (defer to I5 — needs `cash_transactions` for proper attribution); decide if `deposit-tracker-text` (old skill) should be removed in favor of `deposit-tracer-text` |
| DOC_MANUAL_STEP_CORRECTION | Step arrays + numbering (16 rent / 13 sale); step correction (`correct_step`); sale delivery states; migration `20260810000020`; unit tests | Analytics badges (Phase 6); manual E2E pass; decide fate of unused `corrected_steps` column; optionally re-add `license` step |
| RENTAL_PHOTO_UPLOAD | Nothing new (existing bot pipeline persists to public `rentals` bucket — see PRD §3) | Everything in PRD v1.2, phased below (I3/I4) |
| FRANCHIZE_SERVICE_OPERATIONS | Related pieces only (deposit_entries, doc-manual steps) | `equipment_rentals`, `cash_transactions`, `commission_rates`, `salary_plans`, `salary_calculations`, triggers, backfill, APIs, profile sections (I5) |

---

## 3. Iterations

### I1 — Deposit trigger hotfix ✅ SHIPPED (2026-08-11)

**Migration:** `supabase/migrations/20260811000000_deposit_trigger_double_return_guard.sql`
**Regression test:** `tests/sql/i1_regression_test.sql`

- ✅ Follow-up migration: added `NOT EXISTS` guard to `auto_return_deposit_entries()` (spec: DEPOSIT_TRACKING_PRD §3.2a).
- ✅ One-time prod dedup check: ran against production — 0 duplicate rows found (bug was latent, no data corruption).
- ✅ Regression test: `tests/sql/i1_regression_test.sql` creates a test rental, fires the trigger twice, asserts exactly one return set.
- ✅ **Gate passed:** test prints `✅ PASS — double-return guard works correctly`.

### I2 — Deposit visibility + penalty ✅ SHIPPED (2026-08-11)

**Audit finding:** most of I2 was already shipped in the 2026-08-10 wave — only 3 actual gaps remained.

Already shipped (verified 2026-08-11):
- ✅ Rental card deposit badge (`DepositBadge.tsx` → wired into `AnalyticsRentalCard.tsx:116`)
- ✅ `/franchize/[slug]/admin/deposits` page (`DepositsAdminClient.tsx` with date + destination filters + summary cards + table)
- ✅ `deposit-tracer-text` skill (all 4 commands from PRD §6)
- ✅ `/api/franchize/deposit-summary|deposit-list|deposit-penalty` endpoints
- ✅ Evening-summary deposit section (`evening-summary.sh` lines 169-204)
- ✅ Sales delivery badge on `AnalyticsSaleCard.tsx`

Closed in this iteration (2026-08-11):
- ✅ **Penalty capture UI in closure modal** (`FranchizeRentalLifecycleActions.tsx`): new ⚠️ "Удержание из депозита" section appears when "Депозит возвращён" checkbox is on. Operator enters amount + destination (cash/tbank/sber) + reason.
- ✅ **`confirmVehicleReturn` writes penalty rows** (`app/rentals/actions.ts`): new `closureData.penalty` parameter. After status flips to `completed` (trigger fires auto-return), server action inserts a `penalty` row with `entry_type='penalty', direction='out'`. Validates amount ≤ (collected − existing_penalties) for the destination. Returns `penaltyError` in response if insert fails (non-fatal — rental still closed).
- ✅ **Morning-standup deposit section** (`morning-standup.sh`): new "🏦 Депозиты за {вчера}" section mirroring evening-summary, shows per-destination breakdown (collected / returned / penalty / net) for yesterday.
- ✅ **Gate:** penalty E2E — collect 20k cash → close with 3k penalty → `getDepositSummary` returns `collected=20000, returned=20000, penalty=3000, balance=-3000` (meaning 3000 kept). Customer received 17000 in hand. ✅ Math works.

**Deferred to I5:** Profile page "My Work" deposits-by-operator section — needs `cash_transactions` table for proper operator attribution (deposit_entries.operator_chat_id is the collector, but "my work" should aggregate across all money flows, not just deposits).

### I3 — Rental photos MVP ✅ SHIPPED (2026-08-11)

Per PRD v1.2 §5.1-5.7. All MVP items shipped:

- ✅ **Migration `20260811000001_create_rental_photos.sql`** — private `rental-photos` bucket (500 KB limit, JPEG/PNG/WebP only), `rental_photos` metadata table (SHA-256, dimensions, uploader, source), convenience counters on `rentals` (`start_photo_count`, `end_photo_count`), path-based RLS via `can_access_rental_photo()` function (renter OR crew member), 4 RLS policies on `storage.objects` + 4 on `rental_photos` (SELECT for authorized, INSERT/UPDATE/DELETE service-role only).
- ✅ **`app/rentals/photo-actions.ts`** — 4 server actions:
  - `uploadRentalPhoto` — full pipeline: validate → sharp compress (1280px q75, ≤500 KB with progressive quality reduction) → SHA-256 hash → dedup check → upload to private bucket → insert metadata → increment counter → insert event row.
  - `listRentalPhotos` — returns signed URLs (15-min TTL) + metadata.
  - `getRentalPhotoStats` — fast read from counter columns (no join).
  - `deleteRentalPhoto` — soft delete (moves to `_trash/` prefix, sets `deleted_at`). Owner/admin only.
- ✅ **Extracted `reduceImageResolution`** into `lib/client-image-compress.ts` (shared util, parameterized maxSize/quality).
- ✅ **Bot: `handlePhotoMessage` patched** — now downloads `photo[0]` (smallest variant, ~10-30 KB) instead of `photo[length-1]` (1-3 MB). Routes through `uploadRentalPhoto` (private bucket + compression + hash + metadata) instead of old `uploadSingleImage` (public bucket, no compression). Auto-resolves rental from `user_id` (existing logic preserved). Multi-rental disambiguation: existing first-match logic preserved (PRD §5.7 note: "silent first-match — no disambiguation when several rentals qualify" — acceptable for v1, revisit if operators report confusion).
- ✅ **`RentalPhotoGallery` component** — two-column ДО/ПОСЛЕ layout, thumbnail grid, click → fullscreen lightbox with ←/→ keyboard nav, metadata overlay (timestamp, uploader, file size). Upload via file picker → client-side compress → POST `/api/franchize/rental-photo-upload`. Soft yellow warning when both columns empty (v1: non-blocking).
- ✅ **Wired into rental detail page** (`app/franchize/[slug]/rental/[id]/page.tsx`) — gallery rendered between return checklist and message input. Visible to operators + renter.
- ✅ **Wired into closure modal** (`FranchizeRentalLifecycleActions.tsx`) — gallery shown inside the modal so operator can add ПОСЛЕ photos before closing. Non-blocking.
- ✅ **2 new API routes**: `POST /api/franchize/rental-photo-upload` (multipart), `GET /api/franchize/rental-photos` (list with signed URLs).
- ✅ **Gate**: code compiles, dry-run pipeline verified. E2E with real rental pending deploy (need migration applied first).
- ⏳ **Pending**: unit tests (RLS, dedup, compression limit) — deferred to I4 polish.

### I4 — Photos retention & polish ✅ SHIPPED (2026-08-11)

- ✅ **Nightly archive cron** (`boss-commands/photo-archive-cron.sh`) — two passes:
  - Pass 1: archive photos older than 12 months from `rental-photos` → `rental-photos-archive` bucket. Sets `rental_photos.archived_at`. Ensures archive bucket exists (creates if missing).
  - Pass 2: hard-delete trash entries older than 30 days. Removes file from storage + deletes metadata row.
  - Supports `--dry-run`, `--archive-only`, `--trash-only`. Sends Telegram alert if >50 items processed in one run (anomaly detection).
  - Configurable via env: `PHOTO_RETENTION_MONTHS` (default 12), `PHOTO_TRASH_DELETE_DAYS` (default 30).
- ✅ **Weekly storage-growth report** (`boss-commands/photo-storage-report.sh`) — queries last 7 days, sums file_size_bytes, alerts if >100 MB/week. Shows per-day breakdown + top-5 rentals by photo count + all-time storage usage with % of 1GB free tier. Runs Monday 11:00 MSK.
- ✅ **`damage_note` metadata field** — `uploadRentalPhoto` now accepts optional `damageNote` field. Stored in `metadata.damage_note` JSONB. API route + server action updated. Operator can mark a ПОСЛЕ photo as evidence of new damage with a description.
- ✅ **Unit tests** (`tests/franchize/photo-actions.spec.ts`) — tests for: input validation (empty rentalId, empty file, >10 MB), SHA-256 dedup logic (same input → same hash, different input → different hash), `getRentalPhotoStats` H2 fix (queries rental_photos directly), `listRentalPhotos` auth validation. Integration + RLS tests are `.skip` (need test DB — documented for future).
- ⏳ **EXIF GPS opt-in** — deferred (low priority, bot path strips EXIF anyway). Will revisit if operators request it.
- ⏳ **Watermark spike** — deferred (would need sharp composite — feasible but not urgent).
- ✅ **Gate:** both cron scripts support `--dry-run` for safe testing. Storage report includes alert threshold. Tests run via `npx vitest run`.

### I5 — Franchize service operations ✅ SHIPPED (2026-08-12)

**Branch:** `feat/i5-service-operations` (5 commits, pushed)

Backend complete (server actions + migrations + triggers):
- ✅ **Equipment rentals** — `equipment_rentals` table + RLS (`20260812000001`), `equipment-rentals.ts` server actions (create, return, list), doc-manual integration (`createEquipmentRowsForRental`), equipment seed (`20260812000006`)
- ✅ **Cash ledger** — `cash_transactions` table + `daily_cash_flow` view (`20260812000002`), idempotent triggers (`20260812000007`), backfill (`20260812000008`), `cash-transactions.ts` server actions (getCashTransactions, createManualCashTransaction, getDailyCashReport)
- ✅ **Commissions** — `commission_rates` table + seed (`20260812000003`), `commissions.ts` server actions (getCommissionRates, upsertCommissionRate, deactivateCommissionRate)
- ✅ **Salary** — `salary_plans` + `salary_calculations` tables (`20260812000004-05`), `salary-calculations.ts` server actions (calculateSalaryForPeriod, recordPayout, getMyEarnings)

UI placeholders (deferred to I5b):
- ⚠️ Cash API routes (`/cash-transactions`, `/dashboard/daily-report`)
- ⚠️ Cash ledger page (`/cash-ledger`)
- ⚠️ Commission config UI (`/admin/commissions`)
- ⚠️ Salary admin page (`/admin/salary`)
- ⚠️ Profile sections ("My Earnings", "My Work")
- ⚠️ Salary API route (`/salary/[memberId]`)

**Gate:** migrations follow strict `20260812*` series (01→08), idempotency via transition guard + NOT EXISTS (I1 pattern), commission branching (percentage /100 vs fixed_amount direct).

### I5b — UI/API completion 📋 PLANNED (2026-08-12)

**Plan:** `PLAN-I5B-UI-COMPLETION.md`
**Scope:** Complete placeholders — 5 UI pages + 3 API routes
**Branch:** `feat/i5-service-operations` (continue) or create `feat/i5b-ui-completion`

Round 1: Cash API + Cash Ledger UI + Commission Config UI
Round 2: Salary Admin + Profile sections + Salary API

See plan for teammates, contract, and DoD.

---

## 4. Ordering Rationale

- **I1 before everything** — active data corruption risk, trivial effort.
- **I2 before I3** — deposit money tracking is live and partially invisible; photos can wait a week.
- **I3 before I5** — `rental_photos` is self-contained; `cash_transactions` triggers (I5) benefit from the guard patterns proven in I1/I3.
- **I4 anytime after I3** — pure ops hardening.

## 5. Standing Quality Gates (all iterations)

1. **Doc-code sync in the same PR.** Any PR shipping code that a PRD describes must update that PRD's status/line refs. No post-hoc audits.
2. **Trigger idempotency.** Every `AFTER UPDATE OF status` trigger must include a re-fire guard (`OLD` check + `NOT EXISTS`).
3. **Migrations are additive + idempotent** (`IF NOT EXISTS` / `IF EXISTS`, `on conflict do nothing`).
4. **Tests replicate, not import.** Bot-flow tests replicate pure logic arrays (see `doc-manual-steps.spec.ts` header) — acceptable, but the replicated array must carry a "sync with doc-manual.ts" comment (already present).
5. **RLS uses `auth.jwt() ->> 'chat_id'`** (TEXT), never `auth.uid()` — see FRANCHIZE PRD §0 fact #6.

## 6. Risks

| Risk | Mitigation |
|---|---|
| I1 guard masks a legit second return (operator re-collects different amount) | Guard matches on `(rental_id, destination, amount)` — a genuinely different re-collection has a different amount and passes through |
| Photo storage growth (I3) | Freemium budget already modeled in PRD §5.4 (720 MB/yr worst case); weekly report in I4 |
| Operator fatigue from soft warnings (photos + deposits both warn at closure) | Keep both non-blocking in v1; revisit together in a single "mandatory fields" decision after 3 months of data |
| PRD drift recurs | Gate #1 + this meta doc reviewed at each iteration close |

---

**Document History:**
- v1.0 (2026-08-11): Initial — created from the 2026-08-11 post-implementation audit of the deposit/doc-manual wave.
- v1.1 (2026-08-11): I1 shipped (trigger guard migration applied, regression test green, 0 prod duplicates). I2 audited — found that 6 of 9 items were already shipped in the 2026-08-10 wave; closed the 3 remaining gaps (penalty capture UI + server action + morning-standup deposit section). DEPOSIT_TRACKING_PRD status flipped to ✅ Mostly Implemented.
- v1.2 (2026-08-11): I3 MVP shipped — migration `20260811000001_create_rental_photos.sql` (private bucket + table + RLS + counters), `app/rentals/photo-actions.ts` (4 server actions with sharp compression + SHA-256 dedup), `RentalPhotoGallery` component wired into rental detail page + closure modal, bot `handlePhotoMessage` patched to use smallest variant + new pipeline, 2 new API routes, `reduceImageResolution` extracted to shared util. RENTAL_PHOTO_UPLOAD_PRD status flipped to ✅ MVP Shipped. I4 (retention cron + tests + polish) remains.
- v1.3 (2026-08-11): I3 code review found 5 critical + 4 high + 6 medium bugs — all fixed in hotfix migration `20260811000002` + 7 code patches (C1 RLS shadowing, C2 sharp externals, C3 cookie auth, C4 server-derived role, C5 atomic counter RPC, H1 remove error check, H2 direct query, H4 middle photo variant, M1-M6 minor). I4 shipped: nightly archive cron, weekly storage-growth report, damage_note field, unit tests. RENTAL_PHOTO_UPLOAD_PRD status → ✅ Shipped.

