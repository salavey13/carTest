-- 20260927140000_winter_storage_v3.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Winter storage v3 — фотофиксация приёма/возврата в таймлайне событий
-- (boss: «photos — acceptance/return фотофиксация into the event timeline»).
--
-- Adds:
--   · storage_bike_events.photo_paths jsonb NOT NULL DEFAULT '[]'
--     Paths INSIDE the public `storagepix` bucket, e.g.
--     `bikes/<bikeId>/<32hex>.jpg`. Attached to any event kind — primarily
--     status_changed (Принять на хранение / Вернул владельцу, contract Акт
--     приёма-передачи photo fixation) and the new standalone 'photo' event.
--   · storage_bike_events.type += 'photo'
--     Standalone «📸 Фотофиксация» — condition shots mid-season from staff
--     OR the bike's owner (same gate as notes).
--   · PUBLIC storage bucket `storagepix` (the wallpix recipe):
--     5 MB / jpeg-png-webp, public read, writes ONLY through the service-role
--     upload route (/api/franchize/storage-photo-upload) — no anon policies.
--     Files: bikes/<bikeId>/<32hex>.jpg; a failed action leaves a harmless
--     orphan (nothing references it), same trade-off the wall accepted.
--
-- RUNBOOK: run AFTER 20260927130000_winter_storage_v2.sql. Idempotent — safe
-- to re-run (bucket ON CONFLICT re-asserts public/limits/mimes on purpose).
-- NO new table RLS: events SELECT policies from v1 already cover the new
-- column; writes stay service-role only.
-- MANUAL MIGRATION (run in Supabase SQL Editor) — Paul.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. photo_paths on the event row: [] = no photos; array of bucket paths.
alter table public.storage_bike_events
  add column if not exists photo_paths jsonb not null default '[]';

comment on column public.storage_bike_events.photo_paths is
  'Фотофиксация: paths in the public storagepix bucket (bikes/<bikeId>/<32hex>.jpg), server-sanitized against cross-bike paths. Attachable to any event kind.';

-- 2. Widen the event-type CHECK with 'photo'. The constraint name is stable
-- since v2 re-created it explicitly (storage_bike_events_type_check); the
-- drop-if-exists + re-add keeps this step re-runnable.
alter table public.storage_bike_events
  drop constraint if exists storage_bike_events_type_check;

alter table public.storage_bike_events
  add constraint storage_bike_events_type_check
  check (type in ('created', 'status_changed', 'note', 'doc', 'payment', 'owner_linked', 'photo'));

-- 3. Public `storagepix` bucket (mirror of the wallpix declaration —
-- ON CONFLICT DO UPDATE re-asserts settings so a dashboard toggle cannot
-- silently break the timeline thumbnails).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'storagepix',
  'storagepix',
  true,
  5242880, -- 5 MB post-compression guard (client compresses first; server re-compresses)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public read policy for the bucket's objects (idempotent). Uploads never
-- touch anon credentials: the route authenticates the Telegram actor
-- server-side and writes with the service role key.
drop policy if exists "Public read storagepix objects" on storage.objects;
create policy "Public read storagepix objects"
on storage.objects
for select
using (bucket_id = 'storagepix');

-- No storage INSERT/UPDATE/DELETE policies for anon/authenticated: only the
-- service role (upload route / server actions) writes into storagepix.
