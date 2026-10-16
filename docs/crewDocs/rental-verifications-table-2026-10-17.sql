-- ═══════════════════════════════════════════════════════════════════════════
-- RENTAL VERIFICATIONS TABLE — «verified» salary state (task101, 2026-10-17)
-- ═══════════════════════════════════════════════════════════════════════════
-- RUNNER: Paul (manual, as always). Idempotent: CREATE TABLE IF NOT EXISTS.
--
-- WHY: salary discussions are sensitive — until now every month-end meant
-- hand-auditing ALL rentals of the period. From now on, when a rental is
-- CLOSED the bot sends the calculated commission (техника + экип + наценка,
-- damage/penalty, deposit, comments) to BOTH the attributed operator and the
-- crew owner with an inline keyboard. When both press «✅ Подтверждаю», the
-- rental becomes VERIFIED — marked in lists/CSV, so month-end only needs to
-- review the small ⏳/⚠️ remainder.
--
-- APP DEGRADES GRACEFULLY: every code path that touches this table catches
-- "table missing" errors and continues (badges just don't render) — so the
-- deploy can go out BEFORE this SQL is applied. Nothing breaks either way.
--
-- WRITE PATHS (all service-role server code; RLS blocks everyone else):
--   • app/franchize/lib/rental-verify.ts  — request / confirm / dispute
--   • app/webhook-handlers/commands/rental-verify.ts — Telegram buttons
--   • app/franchize/server-actions/rental-verify-actions.ts — web admin verify
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rental_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL UNIQUE REFERENCES rentals (rental_id) ON DELETE CASCADE,
  crew_id uuid,
  crew_slug text,
  -- Telegram chat ids (users.user_id) of the two verification parties.
  -- operator_chat_id may be NULL when attribution found nobody — then only
  -- the owner's confirmation is required (single-party verify).
  operator_chat_id text,
  owner_chat_id text,
  -- Which party is the actor whose action created the request (informational).
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  -- 'pending' → 'operator_confirmed' | 'owner_confirmed' → 'verified'
  --            ↘ 'disputed' (terminal for the period; owner resolves offline
  --              and re-verifies via the admin ✅ in the profile list)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'operator_confirmed', 'owner_confirmed', 'verified', 'disputed')),
  operator_confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  verified_at timestamptz,
  disputed_by text,
  dispute_reason text,
  -- Frozen commission math at request time: { base, equipment, overprice,
  -- total, equipmentUnits, equipmentFlags, rentalCategory, totalCost,
  -- standardPrice, bikeName, depositReturned, damageNotes, returnNotes,
  -- penalty: {amount, destination, reason} | null, attribution: {...} }
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Month-end queries: «unverified rentals of crew X in October».
CREATE INDEX IF NOT EXISTS rental_verifications_crew_status_idx
  ON public.rental_verifications (crew_id, status);
CREATE INDEX IF NOT EXISTS rental_verifications_operator_idx
  ON public.rental_verifications (operator_chat_id) WHERE operator_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rental_verifications_owner_idx
  ON public.rental_verifications (owner_chat_id) WHERE owner_chat_id IS NOT NULL;

-- ── RLS: transparent reads for authenticated crew members (same philosophy
-- as salaries — «View: любой участник экипажа»), writes ONLY via service role
-- (the app's supabaseAdmin bypasses RLS; no client ever writes here).
ALTER TABLE public.rental_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rental_verifications'
      AND policyname = 'rental_verifications_select_authenticated'
  ) THEN
    CREATE POLICY rental_verifications_select_authenticated
      ON public.rental_verifications
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT (repo convention: specs.owner_fix_YYYYMMDD_* in the touched row's
-- jsonb — a NEW table has no such row, so the audit lives in the table
-- COMMENT + this file. The verify/confirm handlers additionally store the
-- full commission snapshot per rental, so every money decision stays
-- reconstructible: who confirmed, when, and against which numbers.)
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE public.rental_verifications IS
  'task101 (2026-10-17, applied by Paul): verified-salary state — operator+owner dual confirmation of the calculated commission after rental closure. Request/confirm/dispute: app/franchize/lib/rental-verify.ts; Telegram buttons: vrf_* callbacks; per-rental snapshot jsonb keeps the exact numbers both parties agreed to.';

-- ── POST-CHECK (run after; expect: exists=true, rls=true) ───────────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'rental_verifications'
) AS exists_table,
(
  SELECT c.relrowsecurity FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'rental_verifications'
) AS rls_enabled;
