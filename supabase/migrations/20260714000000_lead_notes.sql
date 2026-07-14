-- Lead notes table for storing operator notes about leads
-- Replaces localStorage-based notes with proper DB storage

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by lead
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);

-- Index for crew-scoped queries
CREATE INDEX IF NOT EXISTS idx_lead_notes_crew_id ON public.lead_notes(crew_id);

-- RLS: only crew members can access notes
-- Note: This project uses Telegram chat_id via auth.jwt() ->> 'chat_id', not Supabase Auth
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's chat_id from JWT
CREATE OR REPLACE FUNCTION get_current_chat_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() ->> 'chat_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Crew members can view lead notes"
  ON public.lead_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crew_members
      WHERE crew_members.crew_id = lead_notes.crew_id
        AND crew_members.user_id = get_current_chat_id()
        AND crew_members.membership_status = 'active'
    )
  );

CREATE POLICY "Crew members can insert lead notes"
  ON public.lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crew_members
      WHERE crew_members.crew_id = lead_notes.crew_id
        AND crew_members.user_id = get_current_chat_id()
        AND crew_members.membership_status = 'active'
    )
  );

CREATE POLICY "Crew members can update lead notes"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crew_members
      WHERE crew_members.crew_id = lead_notes.crew_id
        AND crew_members.user_id = get_current_chat_id()
        AND crew_members.membership_status = 'active'
    )
  );

CREATE POLICY "Crew members can delete lead notes"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crew_members
      WHERE crew_members.crew_id = lead_notes.crew_id
        AND crew_members.user_id = get_current_chat_id()
        AND crew_members.membership_status = 'active'
    )
  );

-- Trigger to auto-update updated_at
-- Note: update_updated_at_column() function should already exist from other migrations
-- If it doesn't exist, create it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_lead_notes_updated_at ON public.lead_notes;
CREATE TRIGGER update_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
