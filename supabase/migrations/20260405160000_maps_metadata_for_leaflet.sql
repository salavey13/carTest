alter table if exists public.maps
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.maps.metadata is 'Leaflet/UI metadata. Example: {tileLayer, defaultZoom, minZoom, maxZoom, geoMigrationAt}';

-- Keep public readable for map rendering surfaces.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'maps'
      and policyname = 'Public read maps for Leaflet'
  ) then
    create policy "Public read maps for Leaflet"
      on public.maps
      for select
      using (true);
  end if;
end $$;
