-- Update vip-bike franchize theme mode to 'auto'
-- This enables the franchize pages to respond to the global theme switcher

begin;

update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,mode}',
  '"auto"',
  true
)
where c.slug = 'vip-bike';

commit;

-- Verification
-- select slug, metadata->'franchize'->'theme'->>'mode' as theme_mode from public.crews where slug='vip-bike';
