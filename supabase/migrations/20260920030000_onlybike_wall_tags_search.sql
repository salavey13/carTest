-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike wall v3, step 3: discovery — hashtags, full-text search.
--
--   • crew_post_tags — normalized hashtags (#ВечернийЗаезд → «вечернийзаезд»)
--     extracted from post bodies AT WRITE TIME by the server action. Backfilled
--     here from existing bodies so the filter works on day one. Powers the
--     tag filter and the 7-day trending strip.
--   • crew_posts.search_tsv — generated tsvector over the body ('simple'
--     config: predictable for mixed RU/translit/latin crew slang), GIN-indexed.
--     PostgREST textSearch (websearch) runs the wall search without an RPC.
--
-- RLS stance unchanged: both serve the PUBLIC read path (the feed is public),
-- writes only through verified service-role server actions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tags ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_post_tags (
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  -- lowercased hashtag body, no '#', 2–40 chars of letters/digits/_
  tag text NOT NULL,
  -- Denormalized crew_id (same pattern as crew_post_comments) for crew-scoped
  -- trending/filter queries without a join.
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  -- = the post's creation time (tags are immutable after publish)
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag)
);

COMMENT ON TABLE public.crew_post_tags IS
  'OnlyBike wall: normalized hashtags per post; powers the tag filter and the 7-day trending strip.';

CREATE INDEX IF NOT EXISTS idx_crew_post_tags_crew_tag
  ON public.crew_post_tags (crew_id, tag, created_at DESC);

-- ── 2. Backfill from existing post bodies ────────────────────────────────────
-- Same normalization contract as lib hashtagKey(): lowercase, no '#'.
-- URLs are stripped FIRST so anchors («x.com/#top») never become junk tags,
-- matching the write-time extractHashtags() behavior; the charset is spelled
-- out explicitly (Cyrillic + latin + digits) — [[:alnum:]] would degrade to
-- ASCII on a C-locale database.

INSERT INTO public.crew_post_tags (post_id, tag, crew_id, created_at)
SELECT p.id, lower(m[1]), p.crew_id, p.created_at
  FROM public.crew_posts p
 CROSS JOIN LATERAL regexp_matches(
        regexp_replace(p.body, 'https?://\S+', '', 'g'),
        '#([a-zA-Zа-яёА-ЯЁ0-9_]{2,40})', 'g') AS m
ON CONFLICT (post_id, tag) DO NOTHING;

-- ── 3. Full-text search column (generated) + GIN ─────────────────────────────
-- Bilingual vector: 'simple' keeps translit/model names («kawasaki»,
-- «ex650k») searchable as-is, 'russian' adds morphology for the dominant
-- language («поездки» now matches «поездка»). websearch_to_tsquery on the
-- query side stays forgiving (no syntax errors from raw user input).

ALTER TABLE public.crew_posts
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(body, '')) || to_tsvector('russian', coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_crew_posts_search
  ON public.crew_posts USING gin (search_tsv);

-- Seed nothing else: tags/тsv arrive with the posts.
