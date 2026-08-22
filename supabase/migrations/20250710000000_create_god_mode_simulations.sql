CREATE TABLE public.god_mode_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    simulation_result JSONB NOT NULL,
    is_viewed BOOLEAN NOT NULL DEFAULT FALSE
);

-- RLS Policies
ALTER TABLE public.god_mode_simulations ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own simulations
CREATE POLICY "Users can view their own simulations"
ON public.god_mode_simulations
FOR SELECT
USING (auth.jwt() ->> 'chat_id' = user_id);

-- This policy assumes inserts are done via a service_role key from the backend (telegram webhook)
-- It's secure because only our trusted backend can perform this action.
CREATE POLICY "Allow service_role to insert simulations"
ON public.god_mode_simulations
FOR INSERT
TO service_role
WITH CHECK (true);

-- Enable Realtime on the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.god_mode_simulations;