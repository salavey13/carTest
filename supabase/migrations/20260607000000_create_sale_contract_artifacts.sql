-- /supabase/migrations/20260607000000_create_sale_contract_artifacts.sql
-- Create sale_contract_artifacts table in PRIVATE schema
-- Mirrors rental_contract_artifacts structure but with sale-specific fields
-- Used by /doc sale flow and make-deal-contract-skill.mjs --dealType sale
--
-- PRIVATE SCHEMA: sale contract data contains PII (buyer name, passport,
-- registration address) and must NOT be accessible to anon or authenticated roles.
-- Only service_role (backend) can read/write.
-- Pattern follows private.user_rental_secrets and private.crew_secrets.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.sale_contract_artifacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key          TEXT NOT NULL UNIQUE,
  requested_bike_id     TEXT,
  resolved_bike_id      TEXT,
  telegram_chat_id      TEXT,                   -- nullable: skill script may create without Telegram context
  telegram_message_id   BIGINT,
  buyer_full_name       TEXT,
  buyer_passport_number TEXT,
  buyer_passport_issued_by    TEXT,             -- кем выдан паспорт
  buyer_passport_issue_date   TEXT,             -- дата выдачи DD.MM.YYYY
  buyer_registration    TEXT,                   -- адрес регистрации (прописка)
  buyer_email           TEXT,
  sale_price            TEXT,                   -- formatted price digits (e.g. "390 000")
  price_words           TEXT,                   -- price in Russian words (e.g. "Триста девяносто тысяч")
  warranty_months       TEXT DEFAULT '12',
  original_sha256       TEXT,
  template_version      INTEGER,                -- contract template version for re-sign tracking
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_key
  ON private.sale_contract_artifacts(contract_key);

CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_sha256
  ON private.sale_contract_artifacts(original_sha256);

-- Lookup by user: partial index on chat_id (only where claimed)
CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_chat
  ON private.sale_contract_artifacts(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Revoke access from anon and authenticated (private schema pattern)
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.sale_contract_artifacts FROM anon;
REVOKE ALL ON private.sale_contract_artifacts FROM authenticated;

-- Grant access only to service_role
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.sale_contract_artifacts TO service_role;
