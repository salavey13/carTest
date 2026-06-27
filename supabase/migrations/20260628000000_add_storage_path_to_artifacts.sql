-- /supabase/migrations/20260628000000_add_storage_path_to_artifacts.sql
--
-- BACKGROUND:
--   The rental-contracts bucket was created manually in Supabase on 2026-06-18
--   (matches migration 20260618000001_rental_contracts_storage.sql which was
--   written retroactively to document the manual setup).
--   The uploadDocxToStorage() helper in app/franchize/lib/docx-capability.ts
--   uploads DOCX files to this bucket, returning { storagePath, downloadUrl }.
--   However, the artifact tables (rental/sale/subrent_contract_artifacts) have
--   NO column to store the storage_path — so the path was being thrown away
--   after upload. This migration adds the missing column to all three tables.
--
-- WHAT THIS DOES:
--   1. Adds storage_path TEXT column to rental_contract_artifacts
--   2. Adds storage_path TEXT column to sale_contract_artifacts
--   3. Adds storage_path TEXT column to subrent_contract_artifacts
--   All nullable — old rows keep NULL, new rows get the path on insert.

-- rental_contract_artifacts (private schema)
ALTER TABLE private.rental_contract_artifacts
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- sale_contract_artifacts (private schema)
ALTER TABLE private.sale_contract_artifacts
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- subrent_contract_artifacts (private schema)
ALTER TABLE private.subrent_contract_artifacts
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Helpful index for looking up contracts by their stored file
CREATE INDEX IF NOT EXISTS idx_rental_contract_artifacts_storage_path
  ON private.rental_contract_artifacts(storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_storage_path
  ON private.sale_contract_artifacts(storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subrent_contract_artifacts_storage_path
  ON private.subrent_contract_artifacts(storage_path)
  WHERE storage_path IS NOT NULL;

COMMENT ON COLUMN private.rental_contract_artifacts.storage_path IS
  Path in rental-contracts storage bucket, e.g. vip-bike/rental-xxx-123.docx;
COMMENT ON COLUMN private.sale_contract_artifacts.storage_path IS
  Path in rental-contracts storage bucket;
COMMENT ON COLUMN private.subrent_contract_artifacts.storage_path IS
  Path in rental-contracts storage bucket;
