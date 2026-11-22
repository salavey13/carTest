-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260925120000_meetup_photo_url.sql
-- Purpose:   Photo for meetup points on the map-riders page.
--            «there is functionality to add points to map - please allow to
--             add respective photo (to be used for icon on map)» — Lee, 2026-09-25.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- map_rider_meetups.photo_url stores the PUBLIC CDN URL of the meetup photo
-- (wallpix bucket, path meetups/<meetupId>/<uuid>.jpg — final path, no staging
-- lifecycle). The upload route (app/api/map-riders/meetup-photo-upload) is the
-- only writer; the overview API (select *) flows it to the client, where the
-- meetup marker wears the photo as its round picture (photo_url wins over the
-- creator's avatar; no photo → avatar → FaLocationDot badge — the existing
-- fallback chain in MapRidersClientRefactored).
--
-- Idempotent, additive only (map-riders porting discipline).

alter table public.map_rider_meetups
  add column if not exists photo_url text;

comment on column public.map_rider_meetups.photo_url is
  'Public CDN URL of the meetup photo (wallpix bucket, meetups/<id>/<uuid>.jpg). NULL = no photo, marker falls back to creator avatar.';
