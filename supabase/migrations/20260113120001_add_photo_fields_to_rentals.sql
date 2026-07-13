-- Migration: Add photo path fields to rentals table
-- Purpose: Store temporary paths to passport/license photos in docpix bucket
-- Note: These paths are cleared after document verification (operator confirms photos match OCR data)

-- Add passport_photo_path column
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS passport_photo_path text;

-- Add license_photo_path column
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS license_photo_path text;

-- Add comments for documentation
COMMENT ON COLUMN public.rentals.passport_photo_path IS 'Temporary path to passport photo in docpix bucket (deleted after verification)';
COMMENT ON COLUMN public.rentals.license_photo_path IS 'Temporary path to license photo in docpix bucket (deleted after verification)';
