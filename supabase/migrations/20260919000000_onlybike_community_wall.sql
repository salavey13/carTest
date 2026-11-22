-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike community wall («стена экипажа», VK-style) for franchize crews.
--
-- What this gives the /community page:
--   • crew_posts           — wall posts; kind='stats' carries an immutable
--                            snapshot of a rider's rental stats (jsonb);
--   • crew_post_comments   — comments, one level, VK-wall style;
--   • crew_post_likes      — one like per (post, user).
--
-- Security model (matches the repo's server-action architecture):
--   The Next.js app talks to Supabase with the SERVICE ROLE key from verified
--   server actions only (identity = Telegram actor cookie or HMAC-verified
--   initData). So: RLS grants PUBLIC READ of non-hidden rows, and NO anon
--   write policies at all — every write path is a server action that has
--   already verified who the actor is.
--
-- Counters: like_count / comment_count are maintained by triggers so the feed
-- never needs per-post COUNT round-trips (the wall renders 25 posts/page).
-- Hidden comments decrement the counter; deleting a comment decrements too.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Wall posts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- 'crew' = author was owner/admin/active member at post time, 'rider' = renter/guest.
  author_scope text NOT NULL DEFAULT 'rider'
    CHECK (author_scope IN ('crew', 'rider')),
  -- 'post' = regular wall post, 'stats' = post sharing the rider's rental stats.
  kind text NOT NULL DEFAULT 'post'
    CHECK (kind IN ('post', 'stats')),
  body text NOT NULL DEFAULT '',
  -- Immutable stats snapshot for kind='stats' (see lib/community-wall.ts shape).
  stats jsonb,
  -- Optional linked rental (e.g. the ride the post is about).
  rental_id uuid REFERENCES public.rentals(rental_id) ON DELETE SET NULL,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_by text REFERENCES public.users(user_id) ON DELETE SET NULL,
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crew_posts IS
  'OnlyBike community wall: crew/rider posts; kind=stats carries a rental-stats snapshot; hidden_at is a soft moderation delete.';

CREATE INDEX IF NOT EXISTS idx_crew_posts_feed
  ON public.crew_posts (crew_id, is_pinned DESC, created_at DESC)
  WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_crew_posts_author
  ON public.crew_posts (author_id, created_at DESC);

-- ── 2. Comments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  -- Denormalized crew_id for crew-scoped moderation queries.
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crew_post_comments IS
  'Comments on crew_posts (one level, VK-wall style); is_hidden is a soft moderation delete.';

CREATE INDEX IF NOT EXISTS idx_crew_post_comments_post
  ON public.crew_post_comments (post_id, created_at)
  WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_crew_post_comments_crew
  ON public.crew_post_comments (crew_id, created_at DESC);

-- ── 3. Likes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_post_likes (
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

COMMENT ON TABLE public.crew_post_likes IS
  'One like per (post, user); primary key enforces uniqueness.';

CREATE INDEX IF NOT EXISTS idx_crew_post_likes_user
  ON public.crew_post_likes (user_id, created_at DESC);

-- ── 4. Counter maintenance triggers ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crew_posts_sync_comment_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  delta integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE WHEN NEW.is_hidden THEN 0 ELSE 1 END;
    UPDATE public.crew_posts SET comment_count = comment_count + delta WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    delta := CASE WHEN NEW.is_hidden THEN -1 ELSE 0 END
           + CASE WHEN OLD.is_hidden AND NOT NEW.is_hidden THEN 1 ELSE 0 END;
    IF delta <> 0 THEN
      UPDATE public.crew_posts
         SET comment_count = GREATEST(comment_count + delta, 0)
       WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    -- A deleted comment only shrinks the counter if it was visible.
    delta := CASE WHEN OLD.is_hidden THEN 0 ELSE -1 END;
    UPDATE public.crew_posts
       SET comment_count = GREATEST(comment_count + delta, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS crew_post_comments_sync_count ON public.crew_post_comments;
CREATE TRIGGER crew_post_comments_sync_count
AFTER INSERT OR UPDATE OR DELETE ON public.crew_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.crew_posts_sync_comment_count();

CREATE OR REPLACE FUNCTION public.crew_posts_sync_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.crew_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSE -- DELETE
    UPDATE public.crew_posts
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS crew_post_likes_sync_count ON public.crew_post_likes;
CREATE TRIGGER crew_post_likes_sync_count
AFTER INSERT OR DELETE ON public.crew_post_likes
FOR EACH ROW
EXECUTE FUNCTION public.crew_posts_sync_like_count();

-- updated_at touch for posts (same pattern as rental_reviews).
CREATE OR REPLACE FUNCTION public.touch_crew_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crew_posts_touch_updated_at ON public.crew_posts;
CREATE TRIGGER crew_posts_touch_updated_at
BEFORE UPDATE ON public.crew_posts
FOR EACH ROW
EXECUTE FUNCTION public.touch_crew_posts_updated_at();

-- ── 5. RLS: public read, service-role-only writes ────────────────────────────

ALTER TABLE public.crew_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read visible crew posts" ON public.crew_posts;
CREATE POLICY "Public can read visible crew posts"
ON public.crew_posts
FOR SELECT
USING (is_hidden = false);

DROP POLICY IF EXISTS "Public can read visible crew post comments" ON public.crew_post_comments;
CREATE POLICY "Public can read visible crew post comments"
ON public.crew_post_comments
FOR SELECT
USING (is_hidden = false);

-- crew_post_likes: NO SELECT policy on purpose → anon cannot enumerate who
-- liked what (nothing public needs it; the feed gets viewer-likes through the
-- service-role actions). No write policies either (see below).

-- No INSERT/UPDATE/DELETE policies: anon/authenticated roles cannot write.
-- All writes flow through server actions using the service role key, which
-- bypasses RLS after server-side identity verification (cookie / initData HMAC).

-- Seed nothing: the wall starts empty per crew and grows organically.
