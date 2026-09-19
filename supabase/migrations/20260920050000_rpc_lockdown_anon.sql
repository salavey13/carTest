-- ─────────────────────────────────────────────────────────────────────────────
-- Security lockdown: deny anon/authenticated EXECUTE on service-only RPCs.
--
-- Found in the wall v5 security review (codereview round, 2026-09-20):
-- Postgres grants EXECUTE ON FUNCTIONS TO PUBLIC by default, and Supabase
-- exposes every such function through PostgREST. That means anyone holding
-- the PUBLIC anon key (embedded in the client bundle by design) could call
-- these functions DIRECTLY, bypassing every server-action identity check:
--
--   · toggle_post_reaction(p_post_id, p_user_id, p_emoji)
--       → forge reactions AS ANY EXISTING USER (p_user_id is caller-chosen),
--         bypass the server's assertReactionRate brake, and farm reaction-
--         milestone DMs at authors. The "verified actor" contract lived only
--         in the server action — the DB enforced nothing.
--
--   · get_user_rentals_dashboard_new(p_user_id, p_minimal)
--       → SECURITY DEFINER dump of ANY user's rentals: costs, statuses,
--         delivery address, metadata. /api/my/bookings used to be the only
--         intended door and it had NO auth check either (fixed in the same
--         round; this migration closes the direct-PostgREST door too).
--
--   · get_user_crew_command_deck(p_user_id)
--       → crew fleet photo-completeness stats for any user id (info leak).
--
-- All three are called exclusively by the Next.js server (service_role) after
-- server-side identity verification, so restricting EXECUTE to service_role
-- changes nothing legitimate. Other anon-facing RPCs (search_cars,
-- similar_cars, get_top_fleets, createBooking, create_invoice,
-- update_invoice_status, grant_protocard_access, get_vehicle_calendar) are
-- DESIGNED for anon access and are deliberately NOT touched here.
--
-- Idempotent: REVOKE/GRANT are idempotent by nature; safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Wall reactions toggle (wall v3/v4) ────────────────────────────────────
-- The service-role connection keeps working: service_role privileges come from
-- the explicit GRANT below (revoking from PUBLIC does not affect the function
-- owner, and PostgREST authenticates the admin key as service_role).
REVOKE EXECUTE ON FUNCTION public.toggle_post_reaction(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction(uuid, text, text)
  TO service_role;

COMMENT ON FUNCTION public.toggle_post_reaction(uuid, text, text) IS
  'OnlyBike wall: atomic VK toggle; SERVER-ONLY (service_role) since 20260920050000 — p_user_id must never be caller-chosen.';

-- ── 2. Rentals dashboard dump (the /api/my/bookings backend) ─────────────────
REVOKE EXECUTE ON FUNCTION public.get_user_rentals_dashboard_new(text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rentals_dashboard_new(text, boolean)
  TO service_role;

-- ── 3. Crew command deck (fleet stats by user id) ────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_user_crew_command_deck(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_crew_command_deck(text)
  TO service_role;
