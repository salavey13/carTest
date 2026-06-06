-- Migration: create user_states table
-- Used by /doc command (Telegram bot) for multi-step document generation flow
-- Stores per-user state machine context (bike selection, passport/license OCR, schedule)

CREATE TABLE IF NOT EXISTS public.user_states (
  user_id TEXT PRIMARY KEY,              -- Telegram user ID (string)
  state TEXT NOT NULL,                    -- Current state: doc_awaiting_bike | doc_awaiting_passport | doc_awaiting_license | doc_awaiting_schedule | doc_awaiting_deal_type | doc_awaiting_dates
  context JSONB DEFAULT '{}'::jsonb,      -- Flow context: bikeId, passportData, licenseData, dealType, etc.
  expires_at TIMESTAMPTZ NOT NULL,        -- Auto-expiry (30 min from creation)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup + expiry cleanup
CREATE INDEX IF NOT EXISTS idx_user_states_expires ON public.user_states (expires_at);

-- RLS: service-role only (bot backend writes/reads)
ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on user_states"
  ON public.user_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon users cannot access (state is server-side only)
CREATE POLICY "Anon denied on user_states"
  ON public.user_states
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Auto-cleanup function: delete expired states
CREATE OR REPLACE FUNCTION public.cleanup_expired_user_states()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.user_states WHERE expires_at < now();
$$;

-- Comment
COMMENT ON TABLE public.user_states IS 'Multi-step /doc command state machine. Each row is a Telegram user in an active document generation flow. Auto-expires after 30 minutes.';
