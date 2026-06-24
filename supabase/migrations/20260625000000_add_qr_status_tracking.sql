-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260625000000_add_qr_status_tracking.sql
-- Add QR status tracking to user_rental_secrets
--
-- Tracks QR lifecycle and regeneration.
-- Flow:
--   1. chat_id initially set to crew_owner_id (where contract was sent)
--   2. When renter scans QR, chat_id changes to renter's user_id
--   3. qr_first_viewed_at set when renter first opens the link
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns to track QR status on the user-rental relationship
ALTER TABLE private.user_rental_secrets
  ADD COLUMN IF NOT EXISTS is_web_app_flow BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_claimed_at TIMESTAMPTZ,  -- Set when renter claims the secret (chat_id changes to their user_id)
  ADD COLUMN IF NOT EXISTS qr_regeneration_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_doc_sha256 TEXT;  -- Tracks original if regenerated

-- Comments for documentation
COMMENT ON COLUMN private.user_rental_secrets.is_web_app_flow IS
  'Whether the rental was created via web app with automatic user assignment (no QR needed)';

COMMENT ON COLUMN private.user_rental_secrets.qr_generated_at IS
  'Timestamp when the QR code was generated for this rental';

COMMENT ON COLUMN private.user_rental_secrets.qr_first_viewed_at IS
  'Timestamp when renter first viewed the rental link';

COMMENT ON COLUMN private.user_rental_secrets.qr_claimed_at IS
  'Timestamp when renter claimed the secret (chat_id was updated from crew_owner to renter_user_id)';

COMMENT ON COLUMN private.user_rental_secrets.qr_regeneration_count IS
  'Number of times QR has been regenerated (for tracking document updates)';

COMMENT ON COLUMN private.user_rental_secrets.original_doc_sha256 IS
  'If QR was regenerated, tracks the original document SHA256 for audit trail';

-- Note on QR claimed status:
--   - qr_claimed_at IS NOT NULL: Renter has claimed (chat_id = renter_user_id)
--   - qr_claimed_at IS NULL: Not yet claimed (chat_id still = crew_owner_id)
--   - is_web_app_flow = TRUE: Created via web app, no QR involved

