-- Add rental_id FK to private.rental_contract_artifacts
-- This links bot-generated contracts to the rentals table for unified tracking
-- Migration: 20260618000001
-- Author: Rental system alignment implementation

-- Add the FK column (nullable initially for backward compatibility)
ALTER TABLE private.rental_contract_artifacts
ADD COLUMN rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL;

-- Create a partial index for efficient lookups
-- Only indexes rows where rental_id IS NOT NULL (most rows after this migration)
CREATE INDEX idx_rental_contract_artifacts_rental_id
ON private.rental_contract_artifacts(rental_id)
WHERE rental_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN private.rental_contract_artifacts.rental_id IS 'FK to public.rentals, links bot contract to unified rental tracking';
