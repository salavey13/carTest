-- Add lead_id column to crew_todos for linking todos to specific leads/clients
-- lead_id references users.user_id (could be Telegram ID or phone number for callback leads)
ALTER TABLE public.crew_todos ADD COLUMN IF NOT EXISTS lead_id TEXT;

-- Index for efficient lookup of todos by lead
CREATE INDEX IF NOT EXISTS idx_crew_todos_lead_id ON public.crew_todos(lead_id) WHERE lead_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.crew_todos.lead_id IS 'References users.user_id of the lead/client this todo is linked to';
