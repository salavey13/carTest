-- /home/z/my-project/supabase/migrations/20260821180000_link_failed_rentals.sql
-- Link the two failed /doc rentals (created today via manual recovery script)
-- to their rental_contract_artifacts rows, then call claim_rental_by_qr RPC
-- to atomically link them to the renter users.
--
-- Background:
--   On 2026-08-21, two /doc rentals failed because crew_members had 3 owners
--   (resolveCrewOwnerChatId throws on multiple owners via .maybeSingle()).
--   The contract .docx files were generated and uploaded to storage, the
--   rental_contract_artifacts rows were inserted (with rental_id=NULL),
--   the franchize_intents rows were inserted, the crew_todos were created,
--   but the rentals table INSERT failed silently (caught + logged + continued).
--
--   The operator fixed the multi-owner issue (changed 2 to co_owners).
--   The user scanned the QR codes — claim_rental_by_qr failed because
--   artifact.rental_id IS NULL (returns NO_RENTAL_LINKED error).
--
--   A manual recovery script (scripts/recreate-failed-rentals.js) created
--   the missing rentals rows with operator's user_id placeholder:
--     - Яков Головин: rental_id = 7b2bab65-5327-42f2-aa46-9a1cd3fcac53
--     - Ладонежский Олег: rental_id = cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4
--
--   This migration links those rentals to their artifacts and triggers
--   the QR claim RPC to atomically propagate to all linked tables
--   (rentals.user_id, user_rental_secrets.chat_id, crew_todos.rental_id,
--   franchize_intents.metadata.rentalId, lead_notes).

BEGIN;

-- ── Rental 1: Яков Головин + Ducati 1199 Panigale ────────────────────────────
UPDATE private.rental_contract_artifacts
SET rental_id = '7b2bab65-5327-42f2-aa46-9a1cd3fcac53'
WHERE original_sha256 = '8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13'
  AND rental_id IS NULL;  -- guard against double-linking

-- ── Rental 2: Ладонежский Олег + Ducati Panigale S Electro Black Aero ────────
UPDATE private.rental_contract_artifacts
SET rental_id = 'cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4'
WHERE original_sha256 = '0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748'
  AND rental_id IS NULL;  -- guard against double-linking

-- ── Verify the links worked ──────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM private.rental_contract_artifacts
  WHERE original_sha256 IN (
    '8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13',
    '0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748'
  ) AND rental_id IS NOT NULL;

  RAISE NOTICE 'Linked % artifact(s) to their rentals', v_count;
END;
$$;

COMMIT;

-- ── Call claim_rental_by_qr RPC for each renter (separate statements) ────────
-- Each call atomically:
--   - Updates rentals.user_id (operator placeholder → renter chat_id)
--   - Updates private.user_rental_secrets.chat_id + qr_claimed_at
--   - Updates private.rental_contract_artifacts.telegram_chat_id
--   - Updates franchize_intents.telegram_user_id (via propagate_claim RPC)
--   - Updates crew_todos.rental_id (via propagate_claim RPC)
--   - Inserts lead_notes entry (via propagate_claim RPC)

SELECT * FROM public.claim_rental_by_qr(
  '8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13',  -- doc_sha256
  '1317807980'  -- renter_chat_id (Яков Головин @Golovin91)
);

SELECT * FROM public.claim_rental_by_qr(
  '0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748',  -- doc_sha256
  '1440836416'  -- renter_chat_id (Найджел Лоринг @NigelLoring)
);

-- ── Verify the claim worked ──────────────────────────────────────────────────
-- Check that rentals.user_id was updated to the renter chat_ids:
-- SELECT rental_id, user_id, owner_id, created_by_operator_chat_id, status, total_cost
-- FROM public.rentals
-- WHERE rental_id IN (
--   '7b2bab65-5327-42f2-aa46-9a1cd3fcac53',
--   'cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4'
-- );
--
-- Expected: user_id should be the renter's TG chat_id,
--           created_by_operator_chat_id preserved as '413553377' (operator).
