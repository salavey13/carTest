-- Create testdrive_contract_artifacts table
-- Mirrors rental_contract_artifacts but for testdrive flow (free 10-minute ride).
-- A testdrive has no rental period, no deposit, no STS pledge — so those
-- columns are omitted. The table exists so testdrive artifacts don't pollute
-- rental_contract_artifacts and so the QR claim flow can distinguish them.
--
-- Also creates the claim_testdrive_by_qr RPC — a lightweight 3-table update
-- (testdrive_contract_artifacts + user_rental_secrets + franchize_intents)
-- vs the rental claim_rental_by_qr RPC which updates 6 tables.
--
-- Pattern follows:
--   20260612000000_fix_rental_contract_artifacts.sql (table structure)
--   20260607000000_create_sale_contract_artifacts.sql (separate flow table)

-- ─── 1. Create table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.testdrive_contract_artifacts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key              TEXT NOT NULL,
  requested_bike_id         TEXT,
  resolved_bike_id          TEXT,
  telegram_chat_id          TEXT,
  telegram_message_id       BIGINT,
  -- Customer identity (from passport — "customer_" not "renter_" to match
  -- the template variable naming in TESTDRIVE_DEAL_TEMPLATE.html)
  customer_full_name        TEXT,
  customer_passport         TEXT,               -- "серия номер" e.g. "4509 123456"
  customer_passport_issued_by TEXT,             -- кем выдан
  customer_passport_issue_date TEXT,            -- дата выдачи паспорта
  customer_registration     TEXT,               -- адрес регистрации (прописка)
  -- Driver license
  customer_driver_license   TEXT,               -- "серия номер" e.g. "99 76 123456"
  customer_birth_date       TEXT,
  license_categories        TEXT,               -- e.g. "B, A, M"
  -- Testdrive terms
  testdrive_date            TEXT,               -- ISO date when testdrive happened
  total_sum                 NUMERIC,            -- always 0 (testdrive is free)
  -- Document integrity
  original_sha256           TEXT NOT NULL,
  doc_verifier_id           UUID REFERENCES doc_verifier_records(id),
  template_version          INTEGER,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Storage
  storage_path              TEXT,
  -- Crew context
  crew_slug                 TEXT NOT NULL,
  customer_phone            TEXT,
  created_by_operator_chat_id TEXT,

  UNIQUE(contract_key)
);

-- ─── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_key
  ON private.testdrive_contract_artifacts USING btree (contract_key);

CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_sha256
  ON private.testdrive_contract_artifacts USING btree (original_sha256);

CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_chat
  ON private.testdrive_contract_artifacts USING btree (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_storage_path
  ON private.testdrive_contract_artifacts USING btree (storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_crew_slug
  ON private.testdrive_contract_artifacts USING btree (crew_slug);

CREATE INDEX IF NOT EXISTS idx_testdrive_artifacts_created_at
  ON private.testdrive_contract_artifacts USING btree (created_at);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE private.testdrive_contract_artifacts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by server actions + RPC)
CREATE POLICY "Service role can read testdrive artifacts"
  ON private.testdrive_contract_artifacts FOR SELECT
  TO service_role USING (true);

CREATE POLICY "Service role can insert testdrive artifacts"
  ON private.testdrive_contract_artifacts FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update testdrive artifacts"
  ON private.testdrive_contract_artifacts FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);

-- Revoke public/authenticated access (private schema pattern)
REVOKE ALL ON private.testdrive_contract_artifacts FROM anon, authenticated;
GRANT ALL ON private.testdrive_contract_artifacts TO service_role;

-- ─── 4. claim_testdrive_by_qr RPC ────────────────────────────────────────────
-- Lightweight RPC: links a testdrive artifact to the renter's Telegram account.
-- Unlike claim_rental_by_qr (which updates 6 tables: rentals, artifacts, secrets,
-- intents, todos, lead_notes), this only updates 3:
--   1. testdrive_contract_artifacts.telegram_chat_id → renter's chat_id
--   2. user_rental_secrets.chat_id → renter's chat_id
--   3. franchize_intents.telegram_user_id → renter's chat_id
-- No rentals table (testdrive has no rental), no crew_todos (todos are tied to
-- lead_id not chat_id), no lead_notes (notes don't store chat_id).
--
-- Returns json with status + customer info for the success toast.
CREATE OR REPLACE FUNCTION private.claim_testdrive_by_qr(
  p_doc_sha256 TEXT,
  p_renter_chat_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_artifact RECORD;
  v_secrets_updated INTEGER;
BEGIN
  -- Find the testdrive artifact by sha256
  SELECT * INTO v_artifact
  FROM private.testdrive_contract_artifacts
  WHERE original_sha256 = p_doc_sha256
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'not_found');
  END IF;

  -- Check if already claimed by a non-crew user
  -- (created_by_operator_chat_id is the operator; telegram_chat_id starts as
  --  the operator's chat_id and is updated to the renter's on claim.
  --  If telegram_chat_id != created_by_operator_chat_id AND != p_renter_chat_id,
  --  someone else already claimed it.)
  IF v_artifact.telegram_chat_id IS NOT NULL
     AND v_artifact.telegram_chat_id != p_renter_chat_id
     AND v_artifact.telegram_chat_id != v_artifact.created_by_operator_chat_id THEN
    RETURN json_build_object('status', 'already_claimed_by_other');
  END IF;

  -- Update artifact: set telegram_chat_id to renter's chat_id
  UPDATE private.testdrive_contract_artifacts
  SET telegram_chat_id = p_renter_chat_id
  WHERE id = v_artifact.id;

  -- Update user_rental_secrets (if a secrets row exists with this doc_sha256)
  -- Only update if chat_id is NULL (unclaimed) or is the operator's chat_id
  -- (created_by_operator_chat_id) — don't overwrite a real renter's claim.
  UPDATE private.user_rental_secrets
  SET chat_id = p_renter_chat_id
  WHERE doc_sha256 = p_doc_sha256
    AND (chat_id IS NULL OR chat_id = v_artifact.created_by_operator_chat_id);

  GET DIAGNOSTICS v_secrets_updated = ROW_COUNT;

  -- Update franchize_intents (link the lead to the renter)
  -- The lead was created with operator's chat_id as telegram_user_id.
  -- We match by crew_slug + doc_sha256 in metadata (testdrive-manual.ts
  -- stores docSha256 in the lead metadata for this exact purpose).
  UPDATE public.franchize_intents
  SET telegram_user_id = p_renter_chat_id
  WHERE crew_slug = v_artifact.crew_slug
    AND metadata->>'docSha256' = p_doc_sha256;

  RETURN json_build_object(
    'status', 'ok',
    'artifact_id', v_artifact.id,
    'secrets_updated', v_secrets_updated,
    'customer_full_name', v_artifact.customer_full_name,
    'customer_phone', v_artifact.customer_phone,
    'crew_slug', v_artifact.crew_slug
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION private.claim_testdrive_by_qr(TEXT, TEXT) TO service_role;

-- ─── 5. Backfill note (NO BACKFILL PERFORMED) ───────────────────────────────
-- The old testdrive-manual.ts wrote to rental_contract_artifacts, but it did
-- NOT store any 'flow_type' or 'metadata' column — the testdrive rows are
-- indistinguishable from rental rows in that table. The rental_contract_artifacts
-- table has NO metadata column (confirmed in 20260612000000_fix_rental_contract_artifacts.sql),
-- so we cannot filter by flow_type='testdrive'.
--
-- Additionally, the old testdrive-manual.ts set total_sum=5000 (TESTDRIVE_PRICE)
-- and left rent_start_date/rent_end_date NULL — but some real rentals might also
-- have NULL dates, so filtering by that is unreliable.
--
-- Decision: do NOT backfill. Old testdrive rows will remain in rental_contract_artifacts
-- and will continue to appear as rental leads on the /leads page. This is acceptable
-- because:
--   1. The number of testdrives done before this migration is small
--   2. They don't break anything — they just show up as rental leads
--   3. New testdrives (after this migration) will correctly go to testdrive_contract_artifacts
--
-- If you want to manually identify and clean up old testdrive rows, you can run:
--   SELECT * FROM private.rental_contract_artifacts
--   WHERE rent_start_date IS NULL AND total_sum = 5000;
-- (Use with caution — verify these are actually testdrives before deleting.)
