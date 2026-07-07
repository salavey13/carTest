-- Migration: Increase analytics password TTL from 24 hours to 7 days
-- Also update comments and email display logic

-- Update generate function: 7-day TTL instead of 24 hours
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

  -- Set expiration to 7 days from now
  v_expires_at := NOW() + INTERVAL '7 days';

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

-- Update comments
COMMENT ON TABLE public.analytics_passwords IS 'Stores time-based passwords for analytics access. Passwords expire after 7 days.';
COMMENT ON FUNCTION public.generate_analytics_password IS 'Generates a new analytics password for a crew. Format: YYYYMMDD + 6 random chars. Valid for 7 days.';
