-- Update vip-bike franchize theme to Black + Gold / Cyan palette
-- Dark: Deep black with gold accents
-- Light: Crisp white with electric cyan accents

begin;

update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,palettes}',
  jsonb_build_object(
    'dark', jsonb_build_object(
      'bgBase', '#0A0A0A',        -- Deep black
      'bgCard', '#1A1A1A',        -- Soft black for cards
      'accentMain', '#FFD700',    -- Gold
      'accentMainHover', '#FFC125', -- Darker gold for hover
      'textPrimary', '#FFFAF0',   -- Floral white (off-white for readability)
      'textSecondary', '#D4AF37', -- Muted gold
      'borderSoft', '#2A2A2A'     -- Dark gray border
    ),
    'light', jsonb_build_object(
      'bgBase', '#FAFAFA',        -- Off-white
      'bgCard', '#FFFFFF',        -- Pure white for cards
      'accentMain', '#00FFFF',    -- Electric cyan
      'accentMainHover', '#00CED1', -- Dark turquoise for hover
      'textPrimary', '#1A1A1A',   -- Near black for readability
      'textSecondary', '#4A4A4A', -- Dark gray
      'borderSoft', '#E0F7FA'     -- Light cyan border
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
    'bgBase', '#0A0A0A',
    'bgCard', '#1A1A1A',
    'accentMain', '#FFD700',
    'accentMainHover', '#FFC125',
    'textPrimary', '#FFFAF0',
    'textSecondary', '#D4AF37',
    'borderSoft', '#2A2A2A'
  ),
  true
)
where c.slug = 'vip-bike';

-- Update display name to reflect new theme
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize,theme,displayName}',
  '"VIP BIKE - Black Gold / Electric Cyan"',
  true
)
where c.slug = 'vip-bike';

commit;

-- Verification queries:
-- select slug, metadata->'franchize'->'theme'->>'displayName' as theme_name from public.crews where slug='vip-bike';
-- select jsonb_pretty(metadata->'franchize'->'theme'->'palettes') from public.crews where slug='vip-bike';
