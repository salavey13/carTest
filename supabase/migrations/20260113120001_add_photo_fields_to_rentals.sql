-- Migration: Add photo path fields to rentals table
-- Purpose: Store temporary paths to document photos in docpix bucket
-- Note: These paths are cleared after document verification (operator confirms photos match OCR data)
-- Structure: 3 separate columns for different document types to simplify OCR processing

-- Add passport main page photo path
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS passport_mainpage_photo text;

-- Add passport registration page photo path
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS passport_registration_photo text;

-- Add driver's license frontal photo path
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS drivers_licence_frontal_photo text;

-- Add comments for documentation
COMMENT ON COLUMN public.rentals.passport_mainpage_photo IS 'Temporary path to passport main page photo in docpix bucket (deleted after verification)';
COMMENT ON COLUMN public.rentals.passport_registration_photo IS 'Temporary path to passport registration page photo in docpix bucket (deleted after verification)';
COMMENT ON COLUMN public.rentals.drivers_licence_frontal_photo IS 'Temporary path to driver license frontal photo in docpix bucket (deleted after verification)';
