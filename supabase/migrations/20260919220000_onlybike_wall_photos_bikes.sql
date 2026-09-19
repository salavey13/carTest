-- ─────────────────────────────────────────────────────────────────────────────
-- OnlyBike community wall v2: photos + bike mentions.
--
-- Extends 20260919000000_onlybike_community_wall.sql:
--   • crew_post_photos — wall post photos (up to 6 per post). Files live in the
--     PUBLIC storage bucket `wallpix`; this table only stores order/metadata and
--     the storage path. Photos upload FIRST into a per-user staging folder
--     (`staging/<userId>/<uuid>.jpg`) via /api/franchize/wall-photo-upload
--     (client compresses, server re-compresses with sharp), then
--     createCommunityPostAction MOVES them to `posts/<postId>/<n>.jpg` and
--     inserts the rows — so a failed publish never leaves phantom photos.
--   • crew_post_bikes  — bikes «mentioned» on a post (max 3): a join table to
--     public.cars so the wall can render a catalogue card (photo + model) and
--     so deleting a car from the catalogue removes dangling mentions cleanly.
--
-- Security model (unchanged from v1): the app writes through SERVICE ROLE
-- server actions after Telegram-identity verification. RLS grants public read
-- of photo/bike rows (the wall feed is public); NO anon write policies.
-- Storage: `wallpix` is a PUBLIC bucket (readable by URL, like the feed
-- itself); uploads happen exclusively through the service-role API route.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Post photos ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_post_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  -- Denormalized crew_id (same pattern as crew_post_comments) for crew-scoped
  -- queries without a join.
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  -- Path INSIDE the `wallpix` bucket, e.g. `posts/<postId>/1-<uuid>.jpg`.
  storage_path text NOT NULL,
  width integer,
  height integer,
  byte_size integer,
  -- Display order (0-based) — matches the order the author attached them.
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crew_post_photos IS
  'OnlyBike wall: photos attached to crew_posts; files live in the public wallpix bucket at storage_path.';

CREATE INDEX IF NOT EXISTS idx_crew_post_photos_post
  ON public.crew_post_photos (post_id, position);

CREATE INDEX IF NOT EXISTS idx_crew_post_photos_crew
  ON public.crew_post_photos (crew_id, created_at DESC);

-- ── 2. Bike mentions («прикрепить байк из каталога») ─────────────────────────

CREATE TABLE IF NOT EXISTS public.crew_post_bikes (
  post_id uuid NOT NULL REFERENCES public.crew_posts(id) ON DELETE CASCADE,
  bike_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  -- Denormalized crew_id: a bike can only be mentioned by posts of its own crew.
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, bike_id)
);

COMMENT ON TABLE public.crew_post_bikes IS
  'OnlyBike wall: catalogue bikes mentioned on a crew post (VK-style attach, max 3 per post enforced server-side).';

CREATE INDEX IF NOT EXISTS idx_crew_post_bikes_bike
  ON public.crew_post_bikes (bike_id);

-- ── 3. RLS: public read, service-role-only writes ────────────────────────────

ALTER TABLE public.crew_post_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_post_bikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read crew post photos" ON public.crew_post_photos;
CREATE POLICY "Public can read crew post photos"
ON public.crew_post_photos
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can read crew post bikes" ON public.crew_post_bikes;
CREATE POLICY "Public can read crew post bikes"
ON public.crew_post_bikes
FOR SELECT
USING (true);

-- No INSERT/UPDATE/DELETE policies: writes flow exclusively through the
-- service-role server actions / upload route (identity verified server-side),
-- which bypass RLS — identical to the v1 wall tables.

-- ── 4. Storage: public `wallpix` bucket ──────────────────────────────────────
-- Public bucket so the feed (and anonymous visitors) can render photo URLs
-- directly: <SUPABASE_URL>/storage/v1/object/public/wallpix/<storage_path>.
-- Uploads never touch anon credentials: the upload route authenticates the
-- Telegram actor server-side and uploads with the service role key.
-- NOTE: ON CONFLICT DO UPDATE intentionally re-asserts public/limits/mimes on
-- every re-run of this file so the wall CANNOT silently break because someone
-- toggled the bucket private in the dashboard. If ops deliberately changes
-- bucket settings, adjust this statement accordingly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallpix',
  'wallpix',
  true,
  5242880, -- 5 MB post-compression guard (client compresses first; server re-compresses)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read policy for the bucket's objects (idempotent).
DROP POLICY IF EXISTS "Public read wallpix objects" ON storage.objects;
CREATE POLICY "Public read wallpix objects"
ON storage.objects
FOR SELECT
USING (bucket_id = 'wallpix');

-- No storage INSERT/UPDATE/DELETE policies for anon/authenticated: only the
-- service role (server route / server actions) writes into wallpix.

-- Seed nothing: photos/mentions appear organically with the first posts.
