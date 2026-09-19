-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike wall v3, step 1: VK-style emoji reactions.
--
-- Replaces the plain like (crew_post_likes) with a proper reaction bar:
--   • crew_post_reactions(post_id, user_id, emoji) — ONE reaction per
--     (post, user); the PK enforces it. Tapping the same emoji again removes
--     it (server deletes the row), tapping a different one switches it
--     (server updates the row) — exactly VK/Telegram behaviour.
--   • crew_posts.reaction_counts — jsonb {emoji: count}, maintained by
--     trigger, so the feed never recomputes per-emoji aggregates.
--   • crew_posts.like_count — now the TOTAL reaction count. The legacy name
--     stays (feed render + types keep meaning «how much applause the post
--     got»), no churn for existing readers.
--
-- Migration is idempotent: legacy likes are backfilled as ❤️ (the VK default
-- reaction), counters are then RECONCILED from the reactions table (so the
-- trigger being disabled during backfill cannot drift them), and the legacy
-- crew_post_likes table is retired together with its counter trigger — no
-- second writer can desync the totals afterwards.
--
-- Privacy stance unchanged from v1: NO anon SELECT policy on reactions —
-- anonymous visitors must not be able to enumerate who reacted with what.
-- The feed reads counts + the viewer's own row through service-role server
-- actions after identity verification.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Per-emoji counter slot on posts ───────────────────────────────────────

ALTER TABLE public.crew_posts ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.crew_posts.like_count IS
  'TOTAL reaction count across all emoji (legacy column name kept; maintained by crew_post_reactions_sync_counts).';
COMMENT ON COLUMN public.crew_posts.reaction_counts IS
  'Per-emoji reaction counts {emoji: count}, maintained by trigger; zero-count keys are removed.';

-- ── 2. Reactions table (one row per post+user, emoji switchable) ─────────────

CREATE TABLE IF NOT EXISTS public.crew_post_reactions (
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- Same set the composer UI offers (lib/community-wall.ts WALL_REACTIONS).
  emoji text NOT NULL CHECK (emoji IN ('❤️', '🔥', '😂', '😮', '👍', '🏍')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

COMMENT ON TABLE public.crew_post_reactions IS
  'OnlyBike wall: one emoji reaction per (post, user); switching emoji updates the row, re-tapping removes it.';

CREATE INDEX IF NOT EXISTS idx_crew_post_reactions_user
  ON public.crew_post_reactions (user_id, created_at DESC);

-- ── 3. Counter maintenance trigger ───────────────────────────────────────────

-- Bump one emoji key by delta, dropping the key when it reaches 0 (keeps the
-- jsonb clean so the UI never renders «🔥 0»).
CREATE OR REPLACE FUNCTION public.crew_reaction_bump(counts jsonb, emoji text, delta integer)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN emoji IS NULL THEN counts
    WHEN COALESCE((counts ->> emoji)::integer, 0) + delta <= 0 THEN counts - emoji
    ELSE jsonb_set(counts, ARRAY[emoji], to_jsonb(COALESCE((counts ->> emoji)::integer, 0) + delta))
  END;
$$;

CREATE OR REPLACE FUNCTION public.crew_posts_sync_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.crew_posts
       SET reaction_counts = public.crew_reaction_bump(reaction_counts, NEW.emoji, 1),
           like_count = GREATEST(like_count + 1, 0)
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.emoji IS NOT DISTINCT FROM OLD.emoji THEN RETURN NEW; END IF;
    UPDATE public.crew_posts
       SET reaction_counts = public.crew_reaction_bump(
             public.crew_reaction_bump(reaction_counts, OLD.emoji, -1), NEW.emoji, 1)
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSE -- DELETE
    UPDATE public.crew_posts
       SET reaction_counts = public.crew_reaction_bump(reaction_counts, OLD.emoji, -1),
           like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS crew_post_reactions_sync_counts ON public.crew_post_reactions;
CREATE TRIGGER crew_post_reactions_sync_counts
AFTER INSERT OR UPDATE OR DELETE ON public.crew_post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.crew_posts_sync_reaction_counts();

-- ── 4. Backfill: existing likes become ❤️ reactions ──────────────────────────
-- Trigger is disabled during the copy; counters are reconciled from the
-- reactions table right after, so they end EXACT regardless. The enable is
-- EXCEPTION-safe (autocommit runners like psql -f): a failed backfill
-- re-enables the trigger before re-raising, and the precondition check in
-- step 5 then REFUSES to retire the legacy table on an incomplete copy.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'crew_post_likes') THEN
    BEGIN
      ALTER TABLE public.crew_post_reactions DISABLE TRIGGER crew_post_reactions_sync_counts;
      INSERT INTO public.crew_post_reactions (post_id, user_id, emoji, created_at)
      SELECT post_id, user_id, '❤️', created_at
        FROM public.crew_post_likes
       WHERE EXISTS (SELECT 1 FROM public.crew_posts p WHERE p.id = crew_post_likes.post_id)
      ON CONFLICT (post_id, user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.crew_post_reactions ENABLE TRIGGER crew_post_reactions_sync_counts;
      RAISE;
    END;
    ALTER TABLE public.crew_post_reactions ENABLE TRIGGER crew_post_reactions_sync_counts;
  END IF;
END $$;

-- Reconcile BOTH counters from the reactions table (single source of truth).
UPDATE public.crew_posts p
   SET like_count     = COALESCE(r.total, 0),
       reaction_counts = COALESCE(r.per_emoji, '{}'::jsonb)
  FROM (
    SELECT post_id,
           count(*)::integer AS total,
           jsonb_object_agg(emoji, cnt) AS per_emoji
      FROM public.crew_post_reactions
     GROUP BY post_id
  ) r
 WHERE r.post_id = p.id;

UPDATE public.crew_posts p
   SET like_count = 0,
       reaction_counts = '{}'::jsonb
 WHERE NOT EXISTS (SELECT 1 FROM public.crew_post_reactions r WHERE r.post_id = p.id)
   AND (p.like_count <> 0 OR p.reaction_counts <> '{}'::jsonb);

-- ── 5. Retire the legacy likes table ─────────────────────────────────────────
-- Its trigger would fight the new counter if anything ever wrote there again.
-- GUARDED: the drop only happens when every like has a backfilled reaction
-- row — an incomplete backfill above aborts here instead of losing counts.

DO $$
DECLARE
  v_unmatched bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'crew_post_likes') THEN
    SELECT count(*) INTO v_unmatched
      FROM public.crew_post_likes l
     WHERE NOT EXISTS (
       SELECT 1 FROM public.crew_post_reactions r
        WHERE r.post_id = l.post_id AND r.user_id = l.user_id
     );
    IF v_unmatched > 0 THEN
      RAISE EXCEPTION 'backfill incomplete: % like rows without a reaction — crew_post_likes kept', v_unmatched;
    END IF;
    DROP TRIGGER IF EXISTS crew_post_likes_sync_count ON public.crew_post_likes;
    DROP TABLE public.crew_post_likes;
  END IF;
END $$;

-- NOTE for re-runs of 20260919000000_onlybike_community_wall.sql: it would
-- recreate an EMPTY crew_post_likes + trigger — harmless (nothing writes
-- there anymore), the wall keeps counting through crew_post_reactions.

-- ── 6. Single-roundtrip toggle RPC ───────────────────────────────────────────
-- The server action used to do rate-check + read-post + read-existing +
-- write + re-read-aggregate (≈5 sequential roundtrips) with a racy
-- read-before-write window. This RPC does the whole VK toggle atomically:
--   tap = insert, re-tap = delete, different emoji = update (switch),
--   PK race on insert is absorbed by an UPDATE (last write wins).
-- Returns the trigger-fed aggregate so the client NEVER guesses counts.
-- Called only by the service-role server actions after identity check;
-- p_user_id is the verified actor, never a client-supplied guess.

CREATE OR REPLACE FUNCTION public.toggle_post_reaction(p_post_id uuid, p_user_id text, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_post uuid;
  v_existing text;
  v_final text;
  v_counts jsonb;
  v_total integer;
BEGIN
  IF p_emoji NOT IN ('❤️', '🔥', '😂', '😮', '👍', '🏍') THEN
    RETURN jsonb_build_object('error', 'bad_emoji');
  END IF;

  SELECT id INTO v_post FROM public.crew_posts WHERE id = p_post_id AND is_hidden = false;
  IF v_post IS NULL THEN
    RETURN jsonb_build_object('error', 'post_unavailable');
  END IF;

  SELECT emoji INTO v_existing
    FROM public.crew_post_reactions
   WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_existing IS NOT DISTINCT FROM p_emoji THEN
    -- re-tap of the current emoji (or a stale duplicate) → remove
    DELETE FROM public.crew_post_reactions WHERE post_id = p_post_id AND user_id = p_user_id;
    v_final := NULL;
  ELSIF v_existing IS NOT NULL THEN
    UPDATE public.crew_post_reactions SET emoji = p_emoji
     WHERE post_id = p_post_id AND user_id = p_user_id;
    v_final := p_emoji;
  ELSE
    BEGIN
      INSERT INTO public.crew_post_reactions (post_id, user_id, emoji)
      VALUES (p_post_id, p_user_id, p_emoji);
      v_final := p_emoji;
    EXCEPTION WHEN unique_violation THEN
      -- concurrent first tap from another device: absorb, last write wins
      UPDATE public.crew_post_reactions SET emoji = p_emoji
       WHERE post_id = p_post_id AND user_id = p_user_id;
      v_final := p_emoji;
    END;
  END IF;

  SELECT like_count, reaction_counts INTO v_total, v_counts
    FROM public.crew_posts WHERE id = p_post_id;
  RETURN jsonb_build_object('reaction', v_final, 'like_count', v_total, 'reaction_counts', v_counts);
END;
$$;

COMMENT ON FUNCTION public.toggle_post_reaction(uuid, text, text) IS
  'OnlyBike wall: atomic VK toggle for one viewer''s reaction on a post; returns the fresh trigger-fed aggregate.';

-- ── 7. RLS: no anon policies at all (privacy parity with old likes) ─────────

ALTER TABLE public.crew_post_reactions ENABLE ROW LEVEL SECURITY;

-- Deliberately NO SELECT policy: anonymous visitors must not be able to
-- enumerate who reacted with what. The feed ships aggregate counts and the
-- VERIFIED viewer's own reaction via service-role server actions only; no
-- INSERT/UPDATE/DELETE policies either — writes flow through the same
-- verified server actions using the service role key (bypasses RLS).

-- Seed nothing: reactions appear organically.
