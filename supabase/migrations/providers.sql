-- Add metadata column to crews if not exists
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add a check to differentiate providers in indexes
CREATE INDEX IF NOT EXISTS idx_crews_is_provider ON public.crews ((metadata->>'is_provider')) WHERE (metadata->>'is_provider' = 'true');