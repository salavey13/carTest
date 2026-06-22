-- Migration: Analytics Passwords
-- Purpose: Store time-based passwords for analytics access
-- Each crew has a password that changes daily, accessible via TG bot command

-- Create analytics_passwords table
CREATE TABLE IF NOT EXISTS public.analytics_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  created_by TEXT NOT NULL, -- user_id (chat_id) of user who generated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Password expires after 24 hours
  crew_owner_id TEXT NOT NULL, -- owner_id of the crew for auth bypass (chat_id, stored as TEXT)
  slug TEXT NOT NULL -- crew slug for routing
);

-- Create index for quick password lookup
CREATE INDEX IF NOT EXISTS idx_analytics_passwords_crew_password ON public.analytics_passwords(crew_id, password);
CREATE INDEX IF NOT EXISTS idx_analytics_passwords_expires_at ON public.analytics_passwords(expires_at);

-- Enable RLS
ALTER TABLE public.analytics_passwords ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Anyone can read passwords only for validation (no user_id restriction needed)
-- 2. Only crew members can insert passwords (via TG bot command)
-- 3. No one can update or delete (let them expire naturally)

CREATE POLICY "Anyone can validate analytics passwords"
  ON public.analytics_passwords
  FOR SELECT
  TO public
  USING (
    expires_at > NOW() -- Only active passwords
  );

CREATE POLICY "Crew members can create analytics passwords"
  ON public.analytics_passwords
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crew_members
      WHERE crew_members.crew_id = analytics_passwords.crew_id
        AND crew_members.user_id = analytics_passwords.created_by
    )
  );

-- Function to generate daily analytics password
CREATE OR REPLACE FUNCTION public.generate_analytics_password(p_crew_id UUID, p_created_by TEXT, p_slug TEXT)
RETURNS TABLE(password TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_password TEXT;
  v_expires_at TIMESTAMPTZ;
  v_crew_owner_id TEXT;
BEGIN
  -- Get crew owner_id
  SELECT owner_id INTO v_crew_owner_id
  FROM public.crews
  WHERE id = p_crew_id;

  IF v_crew_owner_id IS NULL THEN
    RAISE EXCEPTION 'Crew not found';
  END IF;

  -- Generate password: YYYYMMDD + 6 random chars
  v_new_password := TO_CHAR(NOW(), 'YYYYMMDD') || substr(md5(random()::text), 1, 6);

  -- Set expiration to 24 hours from now
  v_expires_at := NOW() + INTERVAL '24 hours';

  -- Insert new password
  INSERT INTO public.analytics_passwords (
    crew_id,
    password,
    created_by,
    expires_at,
    crew_owner_id,
    slug
  ) VALUES (
    p_crew_id,
    v_new_password,
    p_created_by,
    v_expires_at,
    v_crew_owner_id,
    p_slug
  );

  -- Return password and expiry
  RETURN QUERY SELECT v_new_password, v_expires_at;
END;
$$;

-- Function to validate analytics password and return crew info
CREATE OR REPLACE FUNCTION public.validate_analytics_password(p_password TEXT)
RETURNS TABLE(
  crew_id UUID,
  crew_owner_id TEXT,
  slug TEXT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.crew_id,
    ap.crew_owner_id,
    ap.slug,
    (ap.expires_at > NOW())::BOOLEAN AS is_valid
  FROM public.analytics_passwords ap
  WHERE ap.password = p_password
    AND ap.expires_at > NOW()
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_analytics_password(UUID, TEXT, TEXT) TO public;
GRANT EXECUTE ON FUNCTION public.validate_analytics_password(TEXT) TO public;
GRANT SELECT ON TABLE public.analytics_passwords TO public;
GRANT INSERT ON TABLE public.analytics_passwords TO public;

-- Add helpful comment
COMMENT ON TABLE public.analytics_passwords IS 'Stores time-based passwords for analytics access. Passwords expire after 24 hours.';
COMMENT ON FUNCTION public.generate_analytics_password IS 'Generates a new daily analytics password for a crew. Format: YYYYMMDD + 6 random chars.';
COMMENT ON FUNCTION public.validate_analytics_password IS 'Validates an analytics password and returns crew info if valid.';
