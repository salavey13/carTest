-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260617000000_rental_sts_pledge.sql
-- СТС-as-deposit feature: allow a renter to pledge the СТС
-- (Свидетельство о регистрации ТС) of their OWN vehicle instead of paying
-- a cash security deposit.
--
-- Affects two tables, BOTH in the private schema:
--   1. private.rental_contract_artifacts  — created by migration
--      20260612000000_fix_rental_contract_artifacts.sql
--   2. private.user_rental_secrets        — created by migration
--      20260601000000_user_rental_secrets.sql
--
-- All new columns are nullable / have defaults, so existing rows and existing
-- code paths (cash-deposit flow) continue to work unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. private.rental_contract_artifacts
-- ───────────────────────────────────────────────────────────────────────────
-- The base table lives in the PRIVATE schema (see migration
-- 20260612000000_fix_rental_contract_artifacts.sql — it explicitly dropped
-- the public version and recreated it as private.rental_contract_artifacts).
-- This ALTER is idempotent (IF NOT EXISTS on every column).

ALTER TABLE private.rental_contract_artifacts
  ADD COLUMN IF NOT EXISTS sts_pledge_used         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sts_series              TEXT,
  ADD COLUMN IF NOT EXISTS sts_number              TEXT,
  ADD COLUMN IF NOT EXISTS sts_issue_date          TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_plate       TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_vin         TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_model       TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_year        TEXT,
  ADD COLUMN IF NOT EXISTS sts_owner_full_name     TEXT,
  ADD COLUMN IF NOT EXISTS sts_owner_registration  TEXT,
  ADD COLUMN IF NOT EXISTS sts_owner_relation      TEXT,    -- e.g. "сам арендатор" | "жена" | "отец" — used when СТС owner ≠ renter
  ADD COLUMN IF NOT EXISTS sts_pledge_return_days  INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS deposit_amount_skipped  TEXT;    -- cash deposit that was replaced by СТС, kept for analytics/refund audit

-- Index for filtering "rentals that used СТС pledge" (analytics, disputes)
CREATE INDEX IF NOT EXISTS idx_rental_contract_artifacts_sts_pledge
  ON private.rental_contract_artifacts(sts_pledge_used)
  WHERE sts_pledge_used = TRUE;

COMMENT ON COLUMN private.rental_contract_artifacts.sts_pledge_used IS
  'TRUE when renter pledged their own vehicle СТС instead of paying cash deposit. FALSE (default) = classic cash deposit flow.';

COMMENT ON COLUMN private.rental_contract_artifacts.deposit_amount_skipped IS
  'When sts_pledge_used=TRUE, stores the cash deposit amount that was skipped (e.g. "20000"). Kept for analytics and dispute audit.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. private.user_rental_secrets
-- ───────────────────────────────────────────────────────────────────────────
-- Adding the renter's СТС fields here means the "1-click next rent" flow can
-- pre-fill the СТС pledge form on subsequent rentals — same pattern as the
-- existing passport/license fields.

ALTER TABLE private.user_rental_secrets
  ADD COLUMN IF NOT EXISTS sts_series              TEXT,
  ADD COLUMN IF NOT EXISTS sts_number              TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_plate       TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_vin         TEXT,
  ADD COLUMN IF NOT EXISTS sts_vehicle_model       TEXT,
  ADD COLUMN IF NOT EXISTS sts_owner_full_name     TEXT,
  ADD COLUMN IF NOT EXISTS sts_pledge_return_days  INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN private.user_rental_secrets.sts_series IS
  'Cached СТС series of the renter''s own vehicle — used to pre-fill the СТС-pledge form on next rental.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS / grants
-- ───────────────────────────────────────────────────────────────────────────
-- Both tables are already locked to service_role only (see
-- 20260601000000_user_rental_secrets.sql and
-- 20260612000000_fix_rental_contract_artifacts.sql). ALTER TABLE does not
-- change RLS or GRANTs, so no further privilege work is needed here.
-- ═══════════════════════════════════════════════════════════════════════════
