CREATE TABLE public.user_states (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '15 minutes',
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_states IS 'Stores temporary, short-lived states for users, like waiting for a photo upload.';
COMMENT ON COLUMN public.user_states.state IS 'The state the user is in, e.g., "awaiting_rental_photo".';
COMMENT ON COLUMN public.user_states.context IS 'Additional data related to the state, e.g., { rental_id: "...", photo_type: "start" }.';

-- Enable RLS
ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own state"
ON public.user_states FOR ALL
USING (auth.jwt()->>'chat_id' = user_id)
WITH CHECK (auth.jwt()->>'chat_id' = user_id);