-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260617000001_create_commercial_proposal_artifacts.sql
-- Create commercial_proposal_artifacts table in PRIVATE schema.
--
-- Used by /doc proposal flow and scripts/make-commercial-proposal-skill.mjs
-- when --saveMetadata 1 is set.
--
-- PRIVATE SCHEMA: commercial proposal data contains client PII (name, INN,
-- phone, email, address) and must NOT be accessible to anon or authenticated
-- roles. Only service_role (backend) can read/write.
-- Pattern follows private.rental_contract_artifacts and private.sale_contract_artifacts.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.commercial_proposal_artifacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_key          TEXT NOT NULL UNIQUE,
  crew_slug             TEXT NOT NULL DEFAULT 'vip-bike',
  -- Client info (PII)
  client_name           TEXT NOT NULL,
  client_inn            TEXT,
  client_phone          TEXT,
  client_email          TEXT,
  client_address        TEXT,
  client_details        TEXT,
  -- Offer type: 'rent' | 'sale' | 'test-drive' | 'corporate' | 'custom'
  offer_type            TEXT NOT NULL,
  offer_summary         TEXT,
  -- Pricing
  total_price           NUMERIC,
  total_price_words     TEXT,
  pricing_table_html    TEXT,                   -- rendered pricing table HTML
  -- Terms
  validity_days         INTEGER DEFAULT 30,
  warranty_months       TEXT DEFAULT '12',
  payment_terms         TEXT,
  delivery_terms        TEXT,
  special_conditions    TEXT,
  -- Bike catalog snapshot (rent/sale offers)
  bike_filter           TEXT,                   -- e.g. 'electric' | 'gas' | null
  bike_catalog_count    INTEGER DEFAULT 0,
  bike_catalog_html     TEXT,                   -- rendered catalog table HTML
  -- Delivery
  telegram_chat_id      TEXT,
  telegram_message_id   BIGINT,
  qr_deep_link          TEXT,                   -- QR-encoded deep-link for 1-click accept
  qr_included           BOOLEAN DEFAULT FALSE,
  -- Document integrity
  original_sha256       TEXT,
  template_version      INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_key
  ON private.commercial_proposal_artifacts(proposal_key);

CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_sha256
  ON private.commercial_proposal_artifacts(original_sha256);

-- Lookup by crew (analytics: "all proposals by crew X")
CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_crew
  ON private.commercial_proposal_artifacts(crew_slug, created_at DESC);

-- Lookup by client (history: "all proposals for client Y")
CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_client
  ON private.commercial_proposal_artifacts(client_name)
  WHERE client_name IS NOT NULL;

-- Lookup by chat_id (partial index: only rows where chat_id is set)
CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_chat
  ON private.commercial_proposal_artifacts(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Lookup by offer_type (analytics: "all corporate proposals")
CREATE INDEX IF NOT EXISTS idx_commercial_proposal_artifacts_type
  ON private.commercial_proposal_artifacts(offer_type, created_at DESC);

-- Revoke access from anon and authenticated (private schema pattern)
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.commercial_proposal_artifacts FROM anon;
REVOKE ALL ON private.commercial_proposal_artifacts FROM authenticated;

-- Grant access only to service_role
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.commercial_proposal_artifacts TO service_role;

-- Comments for documentation
COMMENT ON TABLE private.commercial_proposal_artifacts IS
  'Stores metadata for each generated commercial proposal (КП). Populated by scripts/make-commercial-proposal-skill.mjs when --saveMetadata 1 is set. RLS: service_role only.';

COMMENT ON COLUMN private.commercial_proposal_artifacts.proposal_key IS
  'Unique proposal identifier (e.g. "proposal-vip-bike-1718600000000"). Used by QR deep-link for 1-click accept.';

COMMENT ON COLUMN private.commercial_proposal_artifacts.qr_deep_link IS
  'Telegram WebApp deep-link encoded in the QR: https://t.me/<bot>/app?startapp=proposal_<key>_<sha256>';

COMMENT ON COLUMN private.commercial_proposal_artifacts.bike_catalog_html IS
  'Rendered HTML of the bike catalog table at the time of proposal generation. Snapshot for audit/dispute purposes.';
-- ═══════════════════════════════════════════════════════════════════════════
