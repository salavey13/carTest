-- 20260922000000_crew_post_geotags.sql
-- Wall × map interlink: optional geotag on crew posts.
--
-- A post may carry one geographic point (lat/lng, WGS-84) plus an optional
-- human-readable label («Байк Ленд», «пл. Комсомольская 2», «56.29, 43.94»).
-- The map-riders page renders every geotagged post of the crew as a map
-- marker (feed-in-sheet merge); tapping a post's geo chip flies the map to
-- the marker and vice versa (map popup → open post in the feed).
--
-- Design notes:
--   · All three columns are NULLable — existing posts keep rendering, and
--     the action layer treats geo as fully optional (posts never require it).
--   · No FK / RLS changes: geotag rides on crew_posts and inherits the exact
--     same visibility as the post body itself (public wall read).
--   · Partial index covers the only new read path — "latest geotagged posts
--     of one crew" (map layer, cap 200). Feed reads stay on the plain index.

alter table public.crew_posts
  add column if not exists geo_lat double precision,
  add column if not exists geo_lng double precision,
  add column if not exists geo_label text;

-- Guard against garbage (e.g. hand-edited rows): valid WGS-84 ranges only.
alter table public.crew_posts
  add constraint crew_posts_geo_lat_range check (geo_lat is null or (geo_lat >= -90 and geo_lat <= 90)),
  add constraint crew_posts_geo_lng_range check (geo_lng is null or (geo_lng >= -180 and geo_lng <= 180));

-- Lat/lng are only meaningful together; label is free-form.
alter table public.crew_posts
  add constraint crew_posts_geo_pair check (
    (geo_lat is null and geo_lng is null) or (geo_lat is not null and geo_lng is not null)
  );

create index if not exists crew_posts_geo_feed_idx
  on public.crew_posts (crew_id, created_at desc)
  where geo_lat is not null and is_hidden = false;

comment on column public.crew_posts.geo_lat is 'Optional geotag latitude (WGS-84, -90..90). Null = post is not geotagged.';
comment on column public.crew_posts.geo_lng is 'Optional geotag longitude (WGS-84, -180..180). Null = post is not geotagged.';
comment on column public.crew_posts.geo_label is 'Optional human-readable geotag label (<= 80 chars, e.g. spot name or formatted coords).';
