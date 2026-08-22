-- Add crew_slug to sale_contract_artifacts for crew-scoped queries
-- Pattern follows private.user_rental_secrets.crew_slug

ALTER TABLE private.sale_contract_artifacts ADD COLUMN IF NOT EXISTS crew_slug TEXT;

-- Backfill: derive crew_slug from resolved_bike_id → cars.crew_id → crews.slug
-- Only works for artifacts that have a resolved bike
UPDATE private.sale_contract_artifacts a
SET crew_slug = cr.slug
FROM public.cars c
JOIN public.crews cr ON cr.id = c.crew_id
WHERE a.resolved_bike_id = c.id
  AND a.crew_slug IS NULL;

-- Fallback: derive from requested_bike_id → cars.crew_id → crews.slug
UPDATE private.sale_contract_artifacts a
SET crew_slug = cr.slug
FROM public.cars c
JOIN public.crews cr ON cr.id = c.crew_id
WHERE a.requested_bike_id = c.id
  AND a.crew_slug IS NULL
  AND a.resolved_bike_id IS NULL;

-- Fallback: derive from telegram_chat_id → crew_members → crews
UPDATE private.sale_contract_artifacts a
SET crew_slug = cr.slug
FROM public.crew_members cm
JOIN public.crews cr ON cr.id = cm.crew_id
WHERE a.telegram_chat_id = cm.user_id
  AND a.crew_slug IS NULL;

-- Any remaining NULL crew_slug — mark as 'unknown'
UPDATE private.sale_contract_artifacts
SET crew_slug = 'unknown'
WHERE crew_slug IS NULL;

ALTER TABLE private.sale_contract_artifacts ALTER COLUMN crew_slug SET NOT NULL;

-- Index for crew-scoped queries
CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_crew_slug
  ON private.sale_contract_artifacts(crew_slug);

COMMENT ON COLUMN private.sale_contract_artifacts.crew_slug IS 'Crew scope for lead/analytics isolation. Populated on insert by the creating script/bot.';
