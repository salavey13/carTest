-- Migration: Add photo path fields to user_rental_secrets (private schema)
-- Purpose: Store temporary paths to document photos in docpix bucket
-- Note: These paths are kept for audit purposes even after photos are deleted from storage
-- Structure: 3 separate columns for different document types to simplify OCR processing

-- Add passport main page photo path
ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS passport_mainpage_photo text;

-- Add passport registration page photo path
ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS passport_registration_photo text;

-- Add driver's license frontal photo path
ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS drivers_licence_frontal_photo text;

-- Add comments for documentation
COMMENT ON COLUMN private.user_rental_secrets.passport_mainpage_photo IS 'Path to passport main page photo in docpix bucket (photo deleted after OCR, path kept for audit)';
COMMENT ON COLUMN private.user_rental_secrets.passport_registration_photo IS 'Path to passport registration page photo in docpix bucket (photo deleted after OCR, path kept for audit)';
COMMENT ON COLUMN private.user_rental_secrets.drivers_licence_frontal_photo IS 'Path to driver license frontal photo in docpix bucket (photo deleted after OCR, path kept for audit)';
