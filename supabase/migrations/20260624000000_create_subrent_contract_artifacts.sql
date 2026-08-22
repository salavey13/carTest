-- /supabase/migrations/20260624000000_create_subrent_contract_artifacts.sql
-- Create subrent_contract_artifacts table in PRIVATE schema
-- Mirrors rental/sale_contract_artifacts structure but with subrent-specific fields
-- Used by /subrent command and make-deal-contract-skill.mjs --dealType subrent
--
-- PRIVATE SCHEMA: subrent contract data contains PII (owner name, passport,
-- registration address, phone, email) and must NOT be accessible to anon or authenticated roles.
-- Only service_role (backend) can read/write.
-- Pattern follows private.user_rental_secrets, private.crew_secrets, and private.sale_contract_artifacts.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.subrent_contract_artifacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key                TEXT NOT NULL UNIQUE,
  requested_bike_id           TEXT,
  resolved_bike_id            TEXT,
  telegram_chat_id            TEXT,                   -- nullable: skill script may create without Telegram context
  telegram_message_id         BIGINT,

  -- Owner details (PII)
  owner_full_name             TEXT,
  owner_birth_date            TEXT,                   -- DD.MM.YYYY
  owner_passport_series       TEXT,
  owner_passport_number       TEXT,
  owner_passport_issued_by    TEXT,                   -- кем выдан паспорт
  owner_passport_issue_date   TEXT,                   -- дата выдачи DD.MM.YYYY
  owner_registration          TEXT,                   -- адрес регистрации (прописка)
  owner_phone                 TEXT,
  owner_email                 TEXT,

  -- Bike details
  bike_make                   TEXT,
  bike_model                  TEXT,
  bike_vin                    TEXT,
  bike_plate                  TEXT,
  bike_year                   TEXT,
  bike_value_rub              TEXT,
  bike_registration_cert      TEXT,
  bike_insurance_policy       TEXT,

  -- Payment terms
  owner_percentage            TEXT,                   -- e.g. "50" for 50%
  owner_percentage_text       TEXT,                   -- e.g. "пятьдесят"
  min_daily_price_rub         TEXT,
  min_daily_price_text        TEXT,
  hourly_3h_price_rub         TEXT,
  hourly_6h_price_rub         TEXT,
  hourly_12h_price_rub        TEXT,
  weekday_daily_price_rub     TEXT,                   -- seasonal weekday price
  weekend_daily_price_rub     TEXT,                   -- seasonal weekend price
  reporting_period            TEXT DEFAULT 'неделя',
  payment_deadline_days       TEXT DEFAULT '2',

  -- Contract duration
  contract_start_date         TEXT,                   -- DD.MM.YYYY
  contract_start_time         TEXT,                   -- HH:MM
  contract_end_date           TEXT,                   -- DD.MM.YYYY
  contract_end_time           TEXT,                   -- HH:MM

  -- Deposits and terms
  regular_client_deposit_rub  TEXT DEFAULT '10000',
  new_client_deposit_rub      TEXT DEFAULT '20000',
  daily_km_allowance          TEXT DEFAULT '200',
  extra_km_fee_rub            TEXT DEFAULT '30',
  downtime_compensation_rub   TEXT DEFAULT '4000',

  -- Crew context
  crew_id                     TEXT,                   -- crew_slug for multi-tenant parks

  -- Metadata
  original_sha256             TEXT,
  template_version            INTEGER,                -- contract template version for re-sign tracking
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_key
  ON private.subrent_contract_artifacts(contract_key);

CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_sha256
  ON private.subrent_contract_artifacts(original_sha256);

-- Lookup by user: partial index on chat_id (only where claimed)
CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_chat
  ON private.subrent_contract_artifacts(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Lookup by bike owner
CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_owner
  ON private.subrent_contract_artifacts(owner_full_name)
  WHERE owner_full_name IS NOT NULL;

-- Lookup by crew
CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_crew
  ON private.subrent_contract_artifacts(crew_id)
  WHERE crew_id IS NOT NULL;

-- Revoke access from anon and authenticated (private schema pattern)
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.subrent_contract_artifacts FROM anon;
REVOKE ALL ON private.subrent_contract_artifacts FROM authenticated;

-- Grant access only to service_role
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.subrent_contract_artifacts TO service_role;

COMMENT ON TABLE private.subrent_contract_artifacts IS 'Stores subrental contract artifacts with owner PII in private schema';
