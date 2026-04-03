-- /supabase/migrations/20260304_private_scheme.sql
-- 1. Create private schema + user_secrets table
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.user_secrets (
  user_id          TEXT PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  driver_license   TEXT,
  passport         TEXT,
  sensitive_metadata JSONB DEFAULT '{}'::jsonb,   -- for any future sensitive fields
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Lock it down — only your backend (service_role) can touch it
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON TABLE private.user_secrets TO service_role;

-- Add crew secrets table (symmetric to user_secrets)
CREATE TABLE IF NOT EXISTS private.crew_secrets (
  crew_slug            TEXT PRIMARY KEY,
  contract_defaults    TEXT,                    -- issuer_name, bike_value_rub, etc.
  doc_templates        TEXT,                    -- future: rental deal templates, etc.
  price_lists          TEXT,                    -- future: custom pricing rules
  sensitive_metadata   JSONB DEFAULT '{}'::jsonb,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Already done in Stage 1, just making sure:
GRANT ALL ON TABLE private.crew_secrets TO service_role;
