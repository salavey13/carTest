-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260708000000_add_license_fields_to_rental_secrets.sql
-- Add license_expiry_date + license_categories to user_rental_secrets
-- and license_expiry_date to rental_contract_artifacts
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add missing columns to private.user_rental_secrets
ALTER TABLE private.user_rental_secrets
  ADD COLUMN IF NOT EXISTS license_categories TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry_date TEXT;

COMMENT ON COLUMN private.user_rental_secrets.license_categories IS
  'Водительские категории (A, A1, B, B1, etc.), comma-separated';

COMMENT ON COLUMN private.user_rental_secrets.license_expiry_date IS
  'Срок действия ВУ (e.g. 2030-12-31)';

-- 2. Add license_expiry_date to private.rental_contract_artifacts (license_categories already exists)
ALTER TABLE private.rental_contract_artifacts
  ADD COLUMN IF NOT EXISTS license_expiry_date TEXT;

COMMENT ON COLUMN private.rental_contract_artifacts.license_expiry_date IS
  'Срок действия ВУ (e.g. 2030-12-31)';
