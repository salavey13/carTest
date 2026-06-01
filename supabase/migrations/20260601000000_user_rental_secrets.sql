-- /supabase/migrations/20260601000000_user_rental_secrets.sql
-- Create user_rental_secrets table in private schema
-- Stores rental-contextual identity data with doc_sha256 provenance
-- Pattern follows private.crew_secrets and private.user_secrets
--
-- KEY DESIGN: chat_id is NULLABLE on purpose.
--   - Skill script / bot creates a secret row with chat_id=NULL (no Telegram auth context)
--   - When the renter scans their QR code and opens the Telegram WebApp,
--     the claimRentalSecretsByDocSha() server action fills chat_id with their real id.
--   - This is the "1-click next rent" flow: QR → claim → auto-fill checkout form.
--   - If chat_id is already set and ≠ current user, the claim is DENIED (one-user-per-secret).

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.user_rental_secrets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id               TEXT,                   -- NULL until renter scans QR & claims; then set to their telegram user_id (one-time link)
  crew_slug             TEXT NOT NULL,          -- franchise scope (crew isolation intentional)
  doc_sha256            TEXT NOT NULL,          -- links to rental_contract_artifacts.original_sha256
  renter_full_name      TEXT,
  renter_passport       TEXT,
  renter_passport_issue_date TEXT,              -- date passport was issued (e.g. "15.03.2019"), needed by HTML template §13 and App4 ФЗ-152 consent
  renter_registration   TEXT,                   -- registration address (propiska), needed by HTML template §13 and App4 ФЗ-152 consent
  renter_driver_license TEXT,
  renter_birth_date     TEXT,
  renter_phone          TEXT,
  renter_email          TEXT,
  renter_address        TEXT,
  source_doc_key        TEXT,                   -- contract_key of the source document
  source_rental_id      TEXT,                   -- rental_id if available
  verification_status   TEXT NOT NULL DEFAULT 'verified',  -- 'verified' | 'pending' | 'revoked'
  template_version      INTEGER,                -- contract template version (re-sign if template changes)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_sha256)                             -- each document hash is globally unique; replaces old (chat_id, crew_slug, doc_sha256)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_doc_sha
  ON private.user_rental_secrets(doc_sha256);

-- Lookup by user: "what verified secrets does this user have?" (post-claim)
CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_user_crew
  ON private.user_rental_secrets(chat_id, crew_slug, verification_status)
  WHERE chat_id IS NOT NULL;                     -- partial index: only rows where user has claimed

-- Revoke access from anon and authenticated (private schema pattern)
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.user_rental_secrets FROM anon;
REVOKE ALL ON private.user_rental_secrets FROM authenticated;

-- Grant access only to service_role
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.user_rental_secrets TO service_role;
