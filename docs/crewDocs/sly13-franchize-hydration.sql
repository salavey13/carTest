-- /docs/crewDocs/sly13-franchize-hydration.sql
-- SLY13 (SALAVEY13) Franchize hydration reference payload
-- Purpose: seed a personal crew for the repo owner (salavey13) where the
--          "Создать франшизу" button is intentionally ENABLED — opposite of
--          vip-bike which has it disabled. This is the demo / dev / personal
--          tenant where new franchize creation is encouraged.
-- Safe to re-run: uses ON CONFLICT (slug) + jsonb_set + ON CONFLICT (crew_id, user_id)
-- Updated: 2026-07-30 — fix duplicate-key crash on re-run, set owner_id=413553377, email=salavey13@gmail.com

begin;

-- 1) Ensure crew exists
-- FIX: previously used ON CONFLICT (id) with a hardcoded UUID, which crashed
-- with `duplicate key value violates unique constraint "crews_slug_key"`
-- when an existing sly13 crew row had a different UUID. Now we use
-- ON CONFLICT (slug) so the upsert matches by slug (the natural key users
-- actually care about), and we don't pin a specific UUID — let Postgres
-- generate one for new rows, keep the existing one for existing rows.
insert into public.crews (
  name,
  description,
  logo_url,
  owner_id,
  slug,
  hq_location,
  metadata,
  created_at,
  updated_at
)
values (
  'SLY13',
  'Личная витрина salavey13 — разработка, демо, песочница для новых франшиз.',
  '',
  '413553377',
  'sly13',
  '56.296444, 43.946389',
  '{}'::jsonb,
  now(),
  now()
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  logo_url = excluded.logo_url,
  owner_id = excluded.owner_id,
  hq_location = excluded.hq_location,
  updated_at = now();


-- 2) Canonical franchize metadata payload
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-07-30-v1',
        'enabled', true,
        'slug', 'sly13',
        -- UI feature flags consumed by FranchizeProfileButton.
        -- showCreateButton=true: this crew's header DOES advertise the
        -- "Создать франшизу" entry in the profile dropdown. This is the
        -- inverse of vip-bike (which sets it false). SLY13 is the
        -- personal/dev tenant where new crew creation is encouraged.
        'ui', jsonb_build_object(
          'showCreateButton', true
        ),
        'branding', jsonb_build_object(
          'name', 'SLY13',
          'shortName', 'SLY13',
          'tagline', 'Витрина разработчика — франшизы, демо, прототипы.',
          'logoUrl', '',
          'centerLogoInHeader', true
        ),
        'theme', jsonb_build_object(
          'mode', 'auto',
          'displayName', 'SLY13 — Cyan on Graphite',
          'palette', jsonb_build_object(
            'bgBase', '#0F1419',
            'bgCard', '#1A1F26',
            'accentMain', '#06B6D4',
            'accentMainHover', '#22D3EE',
            'textPrimary', '#E5E7EB',
            'textSecondary', '#9CA3AF',
            'borderSoft', '#2A2F36'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0F1419',
              'bgCard', '#1A1F26',
              'accentMain', '#06B6D4',
              'accentMainHover', '#22D3EE',
              'textPrimary', '#E5E7EB',
              'textSecondary', '#9CA3AF',
              'borderSoft', '#2A2F36'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F8FAFC',
              'bgCard', '#FFFFFF',
              'accentMain', '#0891B2',
              'accentMainHover', '#0E7490',
              'textPrimary', '#0F172A',
              'textSecondary', '#475569',
              'borderSoft', '#CBD5E1'
            )
          ),
          'radius', jsonb_build_object('card', 16, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18, 'hero', 28),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'SLY13',
          'subtitle', 'Витрина разработчика',
          'logoHref', '/',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Партнёрам', 'href', '/franchize/{slug}/onboarding')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#0F172A',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'SLY13',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Личная витрина salavey13 — эксперименты с франшизами, прототипы фич.')
              )
            ),
            jsonb_build_object(
              'title', 'СВЯЗЬ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', '@salavey13', 'href', 'https://t.me/salavey13', 'icon', 'FaTelegram'),
                jsonb_build_object('type', 'external', 'label', 'GitHub', 'href', 'https://github.com/salavey13', 'icon', 'FaGithub')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} SLY13',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'SLY13 — витрина разработчика',
          'heroSubtitle', 'Здесь рождаются новые франшизы. Создай свою за 30 секунд.',
          'features', jsonb_build_array(
            'Демо-режим для новых фич',
            'Песочница для franchize-формата',
            'Открытое создание новых экипажей'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Можно ли тут создать свою франшизу?', 'a', 'Да! Нажми «Создать франшизу» в профиле — откроется форма создания экипажа.'),
            jsonb_build_object('q', 'Это production?', 'a', 'Нет, это витрина разработчика. Продакшн-экипажи живут на своих слагах (например, /franchize/vip-bike).')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Нижний Новгород',
          'phone', '+7 900 000 00 00',
          'email', 'salavey13@gmail.com',
          'telegram', '@salavey13',
          'telegramBotUsername', 'oneBikePlsBot',
          'workingHours', '09:00 - 23:00 (ежедневно)',
          'map', jsonb_build_object(
            'imageUrl', '',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.296444, 43.946389'
          )
        ),
        'cta', jsonb_build_object(
          'title', 'Создать франшизу',
          'description', 'Открой профиль (иконка справа сверху) → «Создать франшизу». Заполни название и slug — экипаж сразу появится, и ты сможешь настроить оформление.',
          'buttonLabel', 'Открыть профиль',
          'buttonHref', '/franchize/sly13/profile'
        ),
        'contentBlocks', jsonb_build_object(
          'onboardingChecklist', jsonb_build_array(
            jsonb_build_object('title', 'Создай экипаж', 'text', 'Нажми «Создать франшизу» в профиле, заполни название и slug.', 'icon', 'message-circle'),
            jsonb_build_object('title', 'Настрой оформление', 'text', 'Подбери цвета, загрузи лого, пропиши контакты и слоган.', 'icon', 'clipboard-check'),
            jsonb_build_object('title', 'Добавь байки', 'text', 'Зайди в админку экипажа и добавь позиции каталога.', 'icon', 'file-text'),
            jsonb_build_object('title', 'Поделись ссылкой', 'text', 'Сгенерируй QR-код для своего экипажа и поделись с друзьями.', 'icon', 'shield-check')
          ),
          'onboardingReadinessRows', jsonb_build_array(
            jsonb_build_object('label', 'Брендинг', 'text', 'лого, цвета, оффер'),
            jsonb_build_object('label', 'Каталог', 'text', 'минимум одна позиция'),
            jsonb_build_object('label', 'Контакты', 'text', 'телефон + telegram'),
            jsonb_build_object('label', 'QR-код', 'text', 'сгенерируй через qr-deeplink-on-demand skill')
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Демо', 'Прототипы'),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'deliveryModes', jsonb_build_array('pickup', 'delivery'),
          'defaultMode', 'pickup',
          'paymentOptions', jsonb_build_array('telegram_xtr', 'card', 'sbp', 'cash'),
          'consentText', 'Я согласен с условиями и обработкой персональных данных.'
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'sly13';

-- 3) Legacy top-level metadata
update public.crews c
set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object('slug', 'sly13')
    || jsonb_build_object('is_provider', false)
    || jsonb_build_object('provider_type', 'vehicle_rental')
    || jsonb_build_object('rating', 5)
    || jsonb_build_object(
      'contacts',
      jsonb_build_object(
        'primary_phone', '+7 900 000 00 00',
        'working_hours', '09:00 - 23:00',
        'manager_sales', '@salavey13',
        'manager_support', '@salavey13'
      )
    )
where c.slug = 'sly13';

-- 4) Ensure owner is in crew_members
-- FIX: updated user_id from '356282674' (wrong — that was vip-bike's owner)
-- to '413553377' (salavey13's actual Telegram user ID).
insert into public.crew_members (crew_id, user_id, role, membership_status)
select
  c.id,
  '413553377',
  'owner',
  'active'
from public.crews c
where c.slug = 'sly13'
on conflict (crew_id, user_id) do update
set
  role = 'owner',
  membership_status = 'active';

commit;

-- Verification helpers
-- select slug, metadata->'franchize'->'ui'->'showCreateButton' as show_create_btn from public.crews where slug='sly13';
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='sly13';
