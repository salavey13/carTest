-- Move rental_contract_artifacts from public to private schema
-- Add all columns needed by doc-manual.ts insert code
-- Pattern follows private.sale_contract_artifacts and private.user_rental_secrets

-- 1. Drop the old public table (CAUTION: backup data first if needed!)
-- If you have existing data, migrate it before dropping:
--   INSERT INTO private.rental_contract_artifacts (contract_key, requested_bike_id, resolved_bike_id, telegram_chat_id, telegram_message_id, renter_full_name, rent_start_date, rent_end_date, original_sha256, total_sum, doc_verifier_id, created_at)
--   SELECT contract_key, requested_bike_id, resolved_bike_id, telegram_chat_id, telegram_message_id, renter_full_name, rent_start_date, rent_end_date, original_sha256, total_sum, doc_verifier_id, created_at
--   FROM public.rental_contract_artifacts;
DROP TABLE IF EXISTS public.rental_contract_artifacts CASCADE;

-- 2. Create new private table with all columns the code actually inserts
CREATE TABLE private.rental_contract_artifacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key            TEXT NOT NULL,
  requested_bike_id       TEXT,
  resolved_bike_id        TEXT,
  telegram_chat_id        TEXT,
  telegram_message_id     BIGINT,
  -- Renter identity (from passport)
  renter_full_name        TEXT,
  renter_passport         TEXT,               -- "серия номер" e.g. "4509 123456"
  renter_passport_issued_by TEXT,             -- кем выдан
  renter_passport_issue_date TEXT,            -- дата выдачи паспорта
  renter_registration     TEXT,               -- адрес регистрации (прописка)
  -- Driver license
  renter_driver_license   TEXT,               -- "серия номер" e.g. "99 76 123456"
  renter_birth_date       TEXT,
  license_categories      TEXT,               -- comma-separated, e.g. "A, B"
  -- Rental terms
  rent_start_date         TEXT,
  rent_end_date           TEXT,
  daily_price             TEXT,
  deposit_rub             TEXT,
  total_sum               NUMERIC,
  -- Document integrity
  original_sha256         TEXT,
  doc_verifier_id         UUID REFERENCES doc_verifier_records(id),
  template_version        INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(contract_key)
);

-- Indexes
CREATE INDEX idx_rental_contract_artifacts_key
  ON private.rental_contract_artifacts USING btree (contract_key);
CREATE INDEX idx_rental_contract_artifacts_sha256
  ON private.rental_contract_artifacts USING btree (original_sha256);
CREATE INDEX idx_rental_contract_artifacts_chat
  ON private.rental_contract_artifacts USING btree (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Revoke public access (private schema pattern)
REVOKE ALL ON private.rental_contract_artifacts FROM anon, authenticated;
GRANT ALL ON private.rental_contract_artifacts TO service_role;