-- Add crew_slug to rental_contract_artifacts for crew-scoped queries
-- Pattern follows private.user_rental_secrets.crew_slug

ALTER TABLE private.rental_contract_artifacts ADD COLUMN IF NOT EXISTS crew_slug TEXT;

-- Backfill: derive crew_slug from user_rental_secrets via doc_sha256 linkage
-- This covers the common case: artifact was created from a user_rental_secret
UPDATE private.rental_contract_artifacts a
SET crew_slug = s.crew_slug
FROM private.user_rental_secrets s
WHERE a.original_sha256 = s.doc_sha256
  AND a.crew_slug IS NULL;

-- Fallback backfill: derive crew_slug from rentals → cars → crews
-- rental_id in rental_contract_artifacts is UUID, rentals.rental_id is UUID
UPDATE private.rental_contract_artifacts a
SET crew_slug = cr.slug
FROM public.rentals r
JOIN public.cars c ON c.id = r.vehicle_id
JOIN public.crews cr ON cr.id = c.crew_id
WHERE a.rental_id = r.rental_id
  AND a.crew_slug IS NULL;

-- Any remaining NULL crew_slug — mark as 'unknown' (should not happen in practice)
-- This prevents the NOT NULL constraint from failing on legacy data
UPDATE private.rental_contract_artifacts
SET crew_slug = 'unknown'
WHERE crew_slug IS NULL;

ALTER TABLE private.rental_contract_artifacts ALTER COLUMN crew_slug SET NOT NULL;

-- Index for crew-scoped queries
CREATE INDEX IF NOT EXISTS idx_rental_contract_artifacts_crew_slug
  ON private.rental_contract_artifacts(crew_slug);
