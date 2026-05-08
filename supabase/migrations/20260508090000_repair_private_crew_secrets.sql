-- Repair/bootstrap guard for rental checkout document defaults.
-- Keeps private.crew_secrets available for service-role reads/writes even when
-- an older environment missed 20260304_private_scheme.sql or has a partial table.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.crew_secrets (
  crew_slug            TEXT PRIMARY KEY,
  contract_defaults    TEXT,
  doc_templates        TEXT,
  price_lists          TEXT,
  sensitive_metadata   JSONB DEFAULT '{}'::jsonb,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE private.crew_secrets
  ADD COLUMN IF NOT EXISTS contract_defaults TEXT,
  ADD COLUMN IF NOT EXISTS doc_templates TEXT,
  ADD COLUMN IF NOT EXISTS price_lists TEXT,
  ADD COLUMN IF NOT EXISTS sensitive_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON TABLE private.crew_secrets TO service_role;
