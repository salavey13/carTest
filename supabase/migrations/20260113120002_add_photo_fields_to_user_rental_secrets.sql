-- Migration: Add photo path fields to user_rental_secrets (private schema)
-- Purpose: Store temporary paths to passport/license photos in docpix bucket
-- Note: These paths are kept for audit purposes even after photos are deleted from storage

-- Add passport_photo_path column
ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS passport_photo_path text;

-- Add license_photo_path column
ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS license_photo_path text;

-- Add comments for documentation
COMMENT ON COLUMN private.user_rental_secrets.passport_photo_path IS 'Path to passport photo in docpix bucket (photo deleted after OCR, path kept for audit)';
COMMENT ON COLUMN private.user_rental_secrets.license_photo_path IS 'Path to license photo in docpix bucket (photo deleted after OCR, path kept for audit)';
