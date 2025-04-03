-- Function to atomically increment the score for a VPR test attempt
CREATE OR REPLACE FUNCTION increment_vpr_score (attempt_uuid uuid, increment_value int)
RETURNS void AS $$
BEGIN
  UPDATE public.vpr_test_attempts
  SET score = COALESCE(score, 0) + increment_value
  WHERE id = attempt_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role (or anon if needed)
-- Replace 'authenticated' if your users use a different role after login
GRANT EXECUTE ON FUNCTION public.increment_vpr_score(uuid, int) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.increment_vpr_score(uuid, int) TO service_role; -- If calling from backend/edge function
