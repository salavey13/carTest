-- ─────────────────────────────────────────────────────────────────────────────
-- 20260929100000_crew_posts_metadata.sql
--
-- crew_posts.metadata (jsonb): server-side bookkeeping that must never leak
-- into the wall feed payloads. First consumer: the staff-only «разослать
-- прошлым арендаторам» fanout (app/franchize/lib/wall-renter-notify.ts):
--   metadata.notify_job = {
--     status: 'queued' | 'running' | 'done' | 'failed',
--     audience: 'recent' | 'past' | 'all',
--     requested_by: <users.user_id>,
--     created_at, finished_at: timestamptz ISO strings,
--     sent_user_ids: text[],   -- exactly-once ledger (chat ids are NOT stored)
--     sent: int, failed: int,
--     error: text | null
--   }
-- Idempotent; no data backfill needed (older posts simply have NULL metadata).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crew_posts
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.crew_posts.metadata IS
  'Server-only bookkeeping (never shipped to wall clients): notify_job fanout state for the renter-audience broadcast.';
