-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike wall v4: engagement notifications + 300 KB photo budget.
--
-- Three independent, idempotent pieces:
--
--   1. wallpix bucket: file_size_limit 5 MB → 300 KB. The client compresses
--      (canvas) and the upload route re-compresses with sharp (quality ladder
--      + dimension step-down), so every STORED wall photo is < 300 KB — the
--      5 MB bucket cap was a leftover guard, not a target. 307200 bytes is
--      intentionally exactly 300 KB: the route refuses anything bigger.
--
--   2. toggle_post_reaction: returns `added boolean` in the jsonb now —
--      true ONLY when a NEW reaction row was inserted (not on switch/remove).
--      The server action uses it to notify the post author without pinging
--      on emoji switches or re-taps. Same signature + same jsonb return type,
--      so CREATE OR REPLACE is safe for callers that ignore the new key.
--
--   3. crew_post_notify_log — exactly-once notification ledger per post.
--      The reaction milestone notify does INSERT .. ON CONFLICT DO NOTHING
--      and only sends when a row was actually inserted: re-toggling the
--      reaction that hit «5 реакций» never re-pings the author. Rows cascade
--      away with the post. Service-role writes only (no RLS policies, same
--      model as the rest of the wall tables).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. wallpix: 300 KB storage budget ────────────────────────────────────────
-- ON CONFLICT DO UPDATE re-asserts on every re-run (same policy as the v2
-- migration: the bucket cannot silently drift back to a fat limit).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallpix',
  'wallpix',
  true,
  307200, -- 300 KB: photos are canonically compressed to < 300 KB before upload
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. toggle_post_reaction: add `added` to the result jsonb ─────────────────
CREATE OR REPLACE FUNCTION public.toggle_post_reaction(p_post_id uuid, p_user_id text, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_post uuid;
  v_existing text;
  v_final text;
  v_added boolean := false;
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
    -- switch: counts stay the same, nobody got "a new reaction"
    UPDATE public.crew_post_reactions SET emoji = p_emoji
     WHERE post_id = p_post_id AND user_id = p_user_id;
    v_final := p_emoji;
  ELSE
    BEGIN
      INSERT INTO public.crew_post_reactions (post_id, user_id, emoji)
      VALUES (p_post_id, p_user_id, p_emoji);
      v_final := p_emoji;
      v_added := true;
    EXCEPTION WHEN unique_violation THEN
      -- concurrent first tap from another device: absorb, last write wins
      UPDATE public.crew_post_reactions SET emoji = p_emoji
       WHERE post_id = p_post_id AND user_id = p_user_id;
      v_final := p_emoji;
    END;
  END IF;

  SELECT like_count, reaction_counts INTO v_total, v_counts
    FROM public.crew_posts WHERE id = p_post_id;
  RETURN jsonb_build_object(
    'reaction', v_final,
    'like_count', v_total,
    'reaction_counts', v_counts,
    'added', v_added
  );
END;
$$;

COMMENT ON FUNCTION public.toggle_post_reaction(uuid, text, text) IS
  'OnlyBike wall: atomic VK toggle for one viewer''s reaction on a post; returns the fresh trigger-fed aggregate plus `added` (true only when a NEW reaction row was inserted).';

-- ── 3. crew_post_notify_log: exactly-once engagement notifications ───────────

CREATE TABLE IF NOT EXISTS public.crew_post_notify_log (
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  -- 'reaction_milestone' today; 'comment' etc. may join later.
  kind text NOT NULL,
  -- Milestone number for reactions ('1','3','5',…), commentId:userId for
  -- comment fanout — anything that must fire at most once per post.
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, kind, key)
);

COMMENT ON TABLE public.crew_post_notify_log IS
  'OnlyBike wall: exactly-once ledger for engagement notifications (reaction milestones etc.). Insert wins the right to notify; conflicts stay silent.';

ALTER TABLE public.crew_post_notify_log ENABLE ROW LEVEL SECURITY;

-- No policies at all: rows are written by the service-role server actions
-- only (identity verified server-side), reads never needed client-side.

-- Seed nothing: the ledger fills as reactions land.
