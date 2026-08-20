-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260819000001_defensive_has_commission_rates_rpc.sql
-- Purpose:  Re-declare the has_commission_rates(p_crew_id UUID) helper as a
--           SECURITY DEFINER STABLE function so the production DB (where
--           migration 20260814000001_fix_salary_commission_flow.sql was not
--           applied) exposes the RPC the salary-calculations server action
--           calls. Idempotent — safe to re-run after the original migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- Some environments (including current production) have the commission_rates
-- table populated but no `has_commission_rates` RPC registered, which makes
-- `supabaseAdmin.rpc('has_commission_rates', ...)` throw PGRST202 and
-- silently break the owner salary breakdown page. Re-declaring here is
-- idempotent (CREATE OR REPLACE) and harmless for environments that already
-- have it.

CREATE OR REPLACE FUNCTION public.has_commission_rates(p_crew_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_rates
    WHERE crew_id = p_crew_id
      AND is_active = true
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.has_commission_rates(UUID) IS
'Returns true when the crew has at least one active commission rate configured. '
'Used by the salary-calculations server action to decide between the calculated '
'(rates-based) and the recorded (expense_commission) commission methods.';

-- Grant execute to anon + authenticated so service-role + RLS-passing
-- clients can both use it.
GRANT EXECUTE ON FUNCTION public.has_commission_rates(UUID) TO anon, authenticated;
