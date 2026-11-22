-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike wall v3, step 2: comment replies (VK-style, one level).
--
-- crew_post_comments gets reply_to_id — a self-FK to the comment being
-- answered. Threads stay ONE level by contract: the server action normalizes
-- a reply-to-a-reply to its ROOT comment before insert, so the render model
-- («Имя ответил(а) Имя» prefix chips) can never recurse.
--
-- Writes flow through the same verified server actions as before; RLS
-- unchanged (public read of visible comments, no anon write policies).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.crew_post_comments
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.crew_post_comments(id) ON DELETE CASCADE;

-- Moderation / audit lookups of a comment's replies (who answered this one).
-- The feed's reply-prefix render resolves targets by PK; this index serves
-- staff tooling and future thread-collapse queries.
CREATE INDEX IF NOT EXISTS idx_crew_post_comments_reply
  ON public.crew_post_comments (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

COMMENT ON COLUMN public.crew_post_comments.reply_to_id IS
  'Root comment this comment replies to (server normalizes to root: threads are one level deep).';

-- Seed nothing: replies appear organically.
