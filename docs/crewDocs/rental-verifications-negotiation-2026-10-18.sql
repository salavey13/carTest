-- ═══════════════════════════════════════════════════════════════════════════
-- RENTAL VERIFICATIONS — NEGOTIATION («дил») COLUMN — task106, 2026-10-18
-- ═══════════════════════════════════════════════════════════════════════════
-- RUNNER: Paul (manual, as always). Idempotent: ADD COLUMN IF NOT EXISTS.
--
-- WHY: «⚠️ Оспорить» used to be a dead end (manual reconciliation, then the
-- owner re-verifies by hand in the analytics). Now the disputant gets a live
-- split editor right in the Telegram chat:
--   1. Tap ⚠️ Оспорить → the bot opens the editor (bike, price, the three
--      commission parts: техника / экипировка / наценка);
--   2. Tap a part → ±50 / ±100 buttons with a live «было → стало» preview;
--   3. ✍️ Комментарий → the next message becomes the proposal comment;
--   4. 📤 Отправить → the OTHER party receives the proposal with
--      [✅ Согласиться] [⚠️ Предложить своё] [❌ Отклонить];
--   5. Согласиться → rental VERIFIED with the CORRECTED numbers (they flow
--      into the profile earnings, CSV and analytics chips automatically).
-- The whole negotiation state (draft / open proposal / agreed split / round
-- history, capped at 20) lives in THIS one jsonb column — one trivially
-- idempotent statement, no schema churn.
--
-- DEGRADES GRACEFULLY: the app is deployed BEFORE this file. Until the column
-- exists, every negotiation write/select fails with PGRST204 and the code
-- falls back to the task-101 plain dispute (editor simply never opens; the
-- ✅/⚠️ confirm flow is untouched). After applying — the editor appears on
-- the next ⚠️ Оспорить tap. Order-agnostic, nothing breaks either way.
--
-- WRITE PATHS (service-role only; RLS unchanged — see the 2026-10-17 file):
--   • app/franchize/lib/rental-verify.ts — vrfp_* callbacks + comment capture
--   • app/webhook-handlers/commands/command-handler.ts — routing (vrfp_, text)
-- READ PATHS: getVerificationStatusMap (analytics chips, CSV, profile badges).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rental_verifications
  ADD COLUMN IF NOT EXISTS negotiation jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Shape (informational — the app is the only writer):
--   { "draft":  { "by", "role", "split": {base, equipment, overprice}, "comment" } }
--   { "open":   { "by", "role", "at", "split": {...}, "comment" } }
--   { "agreed": { "split": {...}, "proposedBy", "acceptedBy", "at" } }
--   { "rounds": [ { "action": propose|counter|accept|decline, "by", "role", "at", "split", "comment" } ] }

-- ── AUDIT (repo convention) ──────────────────────────────────────────────────
COMMENT ON COLUMN public.rental_verifications.negotiation IS
  'task106 (2026-10-18, applied by Paul): negotiation state for the dispute editor — draft / open proposal / agreed split / capped rounds history. Accepted proposal verifies the rental with the corrected split (flows into profile earnings, CSV «Верификация · скорректировано», analytics chips). App degrades to the plain dispute when the column is absent.';

-- ── POST-CHECK (run after; expect: exists=true, rows=0 or unchanged) ─────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'rental_verifications'
    AND column_name = 'negotiation'
) AS exists_column,
COUNT(*) AS total_rows
FROM public.rental_verifications;
