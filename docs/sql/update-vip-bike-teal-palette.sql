-- Update vip-bike franchize theme to Stormy Teal palette
-- Colors: Stormy Teal, Pine Teal, Azure Mist, Cool Steel, Light Sea Green, Muted Teal, Carbon Black

begin;

update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,palettes}',
  jsonb_build_object(
    'dark', jsonb_build_object(
      'bgBase', '#1A4741',        -- Pine Teal
      'bgCard', '#3A6460',        -- Stormy Teal
      'accentMain', '#76A39E',    -- Muted Teal
      'accentMainHover', '#3CB6A9', -- Light Sea Green
      'textPrimary', '#E9F7F6',   -- Azure Mist
      'textSecondary', '#8D9B9B', -- Cool Steel
      'borderSoft', '#2A5A56'     -- darker teal for borders
    ),
    'light', jsonb_build_object(
      'bgBase', '#E9F7F6',        -- Azure Mist
      'bgCard', '#D5EFE9',        -- lighter variant of Azure Mist for cards
      'accentMain', '#3CB6A9',    -- Light Sea Green
      'accentMainHover', '#3A6460', -- Stormy Teal
      'textPrimary', '#101E1E',   -- Carbon Black
      'textSecondary', '#1A4741', -- Pine Teal
      'borderSoft', '#B8DED8'     -- light teal border
    )
  ),
  true
)
where c.slug = 'vip-bike';

-- Also update the flat palette fallback (dark mode default)
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,palette}',
  jsonb_build_object(
    'bgBase', '#1A4741',
    'bgCard', '#3A6460',
    'accentMain', '#76A39E',
    'accentMainHover', '#3CB6A9',
    'textPrimary', '#E9F7F6',
    'textSecondary', '#8D9B9B',
    'borderSoft', '#2A5A56'
  ),
  true
)
where c.slug = 'vip-bike';

-- Update display name to reflect new theme
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,displayName}',
  '"VIP BIKE ELECTRO - Stormy Teal"',
  true
)
where c.slug = 'vip-bike';

commit;

-- Verification queries:
-- select slug, metadata->'franchize'->'theme'->>'displayName' as theme_name from public.crews where slug='vip-bike';
-- select jsonb_pretty(metadata->'franchize'->'theme'->'palettes') from public.crews where slug='vip-bike';
