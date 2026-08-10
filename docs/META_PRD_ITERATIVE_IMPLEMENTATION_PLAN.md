# META PRD: Iterative Implementation Plan (Franchize Ops Wave 2026-08)

**Version:** 1.0
**Date:** 2026-08-11
**Status:** Active — living tracker, update as iterations ship
**Scope:** Coordinates 4 sibling PRDs that share tables, bot flows, and UI surfaces:
- `docs/DEPOSIT_TRACKING_PRD.md` v2.1 — ⚠️ Partially Implemented
- `docs/DOC_MANUAL_STEP_CORRECTION_PRD.md` v3.1 — ✅ Mostly Implemented
- `docs/RENTAL_PHOTO_UPLOAD_PRD.md` v1.2 — 📋 Draft (not started)
- `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` v4.1 — 📋 Ready for Implementation

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
| DEPOSIT_TRACKING | `deposit_entries` table/view/RLS/backfill (`20260810000010`); auto-return triggers (`20260810000011`); `deposit_destination` + split states in doc-manual; inserts on collection; `deposit-entries.ts` server actions; unit tests | 🔴 Trigger double-return guard (§3.2a); penalty capture flow; rental card badge; `/admin/deposits` page; `deposit-tracer-text` skill; digest/standup/profile sections |
| DOC_MANUAL_STEP_CORRECTION | Step arrays + numbering (16 rent / 13 sale); step correction (`correct_step`); sale delivery states; migration `20260810000020`; unit tests | Analytics badges (Phase 6); manual E2E pass; decide fate of unused `corrected_steps` column; optionally re-add `license` step |
| RENTAL_PHOTO_UPLOAD | Nothing new (existing bot pipeline persists to public `rentals` bucket — see PRD §3) | Everything in PRD v1.2, phased below (I3/I4) |
| FRANCHIZE_SERVICE_OPERATIONS | Related pieces only (deposit_entries, doc-manual steps) | `equipment_rentals`, `cash_transactions`, `commission_rates`, `salary_plans`, `salary_calculations`, triggers, backfill, APIs, profile sections (I5) |

---

## 3. Iterations

### I1 — Deposit trigger hotfix (0.5 day, do first) 🔴

**Why first:** data-integrity bug in production — every re-completed rental duplicates `deposit_returned` rows.

- Follow-up migration: add `NOT EXISTS` guard to `auto_return_deposit_entries()` (spec: DEPOSIT_TRACKING_PRD §3.2a).
- One-time prod dedup check: any rental completed twice since 2026-08-10 → remove duplicate returns.
- Regression test: trigger fires twice for same rental → exactly one return set.
- **Gate:** `deposit-entries.spec.ts` green + new trigger test green.

### I2 — Deposit visibility + penalty (2-3 days)

- Rental card deposit badge (`AnalyticsRentalCard.tsx`) using `getDepositSummary` — PRD §4.1 markup is ready.
- `/franchize/[slug]/admin/deposits` page (filters + summary cards — PRD §5).
- Penalty capture: extend closure flow (`confirmVehicleReturn` path or doc-manual) to write `penalty` + reduced `deposit_returned` rows (PRD §3.3).
- `deposit-tracer-text` skill (PRD §6 commands 1-4).
- Evening digest / morning standup deposit sections.
- Sales analytics delivery badge + rental card delivery info (DOC_MANUAL PRD Phase 6).
- **Gate:** badge renders on staging rental card; penalty E2E (collect 20k split → return 17k + 3k penalty) balances to 0.

### I3 — Rental photos MVP (1 week, per RENTAL_PHOTO_UPLOAD_PRD v1.2)

- Migration `20260811000000_create_rental_photos.sql` (private bucket + table + RLS + counters on `rentals`).
- `app/rentals/photo-actions.ts`: `uploadRentalPhoto` (sharp compress ≤500 KB, SHA-256 dedup — pattern from `doc-verifier`), `listRentalPhotos` (signed URLs), `getRentalPhotoStats`, `deleteRentalPhoto` (soft).
- Extract `reduceImageResolution` from `PhotoUploadButton.tsx` → shared util.
- Bot: switch `handlePhotoMessage` to smallest photo variant + call `uploadRentalPhoto` (private bucket) + multi-rental disambiguation keyboard.
- UI: `RentalPhotoGallery` on rental detail; photo steps in pickup/closure modals with **non-blocking** `photoWarning` (v1 decision).
- **Gate:** unit tests (RLS, dedup, compression limit); one real rental with ДО+ПОСЛЕ photos end-to-end.

### I4 — Photos retention & polish (2-3 days, can overlap I3)

- Nightly cron → `rental-photos-archive` after 12 months; trash hard-delete after 30 days.
- Weekly storage-growth report (>100 MB/week alert).
- EXIF GPS opt-in (WebApp path only), `metadata.damage_note`, watermark spike.
- **Gate:** storage report runs; archive dry-run on staging.

### I5 — Franchize service operations (2 weeks, per FRANCHIZE_SERVICE_OPERATIONS_PRD v4.1)

Follow its Phase 1-7 plan as-is, with two additions:
- Apply lessons from this audit: write triggers with idempotency guards from day one (`auto_create_rental_transaction` needs the same NOT EXISTS pattern).
- Reconcile §0 table inventory against prod BEFORE writing migrations (two tables listed as "never applied" may have landed since).
- **Gate:** each phase ships with migration + tests + PRD status flip in the same PR.

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
