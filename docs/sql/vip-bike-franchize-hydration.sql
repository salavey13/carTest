-- VIP_BIKE Franchize hydration reference payload
-- Purpose: provide a production-like, metadata-first seed for /franchize/* runtime.
-- Safe to re-run: uses jsonb_set merge update scoped to slug = 'vip-bike'.

begin;

-- 1) Ensure crew exists (id from operator dataset). If row already exists, only minimal fields are refreshed.
insert into public.crews (
  id,
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
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746',
  'VIP_BIKE',
  'Вип Байк — сервис проката мототехники разных классов: от эндуро и нейкедов до спортбайков и power-cruiser.',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/1000033868-a2e57b7e-5ed8-4440-9304-f3f54f63cc46.jpg',
  '356282674',
  'vip-bike',
  '56.204179, 43.798619',
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  logo_url = excluded.logo_url,
  owner_id = excluded.owner_id,
  slug = excluded.slug,
  hq_location = excluded.hq_location,
  updated_at = now();

-- 2) Canonical franchize metadata payload.
--    We keep legacy keys and inject `metadata.franchize` for new runtime surfaces.
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-02-18-v1',
        'enabled', true,
        'slug', 'vip-bike',
        'branding', jsonb_build_object(
          'name', 'VIP BIKE RENTAL',
          'shortName', 'VIP_BIKE',
          'tagline', 'Твой байк на любой вкус: от дерзких нейкедов до спортбайков.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233953_793-f4d8a590-5d2c-4416-9969-c8f9a4627eb5.jpg',
          'heroImageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg',
          'centerLogoInHeader', true
        ),
        'theme', jsonb_build_object(
          'mode', 'pepperolli_dark',
          'palette', jsonb_build_object(
            'bgBase', '#0B0C10',
            'bgCard', '#111217',
            'bgElevated', '#16181F',
            'borderSoft', '#24262E',
            'borderCard', '#2A2D36',
            'accentMain', '#D99A00',
            'accentMainHover', '#E2A812',
            'accentDeep', '#B57F00',
            'accentTextOn', '#16130A',
            'textPrimary', '#F2F2F3',
            'textSecondary', '#A7ABB4',
            'textMuted', '#7D828C',
            'textAccent', '#D99A00',
            'success', '#52C26D',
            'warning', '#E0A200',
            'error', '#E35B5B'
          ),
          'radius', jsonb_build_object('card', 18, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'VIP BIKE RENTAL',
          'subtitle', 'Нижний Новгород',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои аренды', 'href', '/rentals')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Старт', 'href', '/rent-bike', 'icon', 'FaBolt'),
            jsonb_build_object('label', 'Мотопарк', 'href', '/rent-bike', 'icon', 'FaMotorcycle'),
            jsonb_build_object('label', 'О нас', 'href', '/vipbikerental', 'icon', 'FaCircleInfo')
          )
        ),
        'footer', jsonb_build_object(
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'VIP BIKE RENTAL',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Аренда мотоциклов в Нижнем Новгороде. Выбери свой вайб и покори город.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Мотопарк', 'href', '/rent-bike', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Зал Славы', 'href', '/leaderboard', 'icon', 'FaTrophy'),
                jsonb_build_object('type', 'link', 'label', 'Экипажи', 'href', '/crews', 'icon', 'FaUsers'),
                jsonb_build_object('type', 'link', 'label', 'О Нас', 'href', '/vipbikerental', 'icon', 'FaCircleInfo')
              )
            ),
            jsonb_build_object(
              'title', 'СОЦСЕТИ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', 'VK Group', 'href', 'https://vk.com/vip_bike', 'icon', 'FaVk'),
                jsonb_build_object('type', 'external', 'label', 'Instagram', 'href', 'https://www.instagram.com/vipbikerental_nn', 'icon', 'FaInstagram'),
                jsonb_build_object('type', 'external', 'label', 'Telegram Бот', 'href', 'https://t.me/oneBikePlsBot', 'icon', 'FaTelegram')
              )
            ),
            jsonb_build_object(
              'title', 'СВЯЗЬ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', '@I_O_S_NN', 'href', 'https://t.me/I_O_S_NN', 'icon', 'FaTelegram'),
                jsonb_build_object('type', 'phone', 'label', '+7 9200-789-888', 'href', 'tel:+79200789888', 'icon', 'FaPhone'),
                jsonb_build_object('type', 'text', 'label', 'Н. Н. Стригинский переулок 13Б', 'icon', 'FaMapLocationDot')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} Vip Bike Rental NN',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'VIPBIKE — лидеры проката мотоциклов в Нижнем Новгороде',
          'heroSubtitle', 'От круизеров до спортбайков. Онлайн-бронь, экипировка и поддержка на маршруте.',
          'features', jsonb_build_array(
            'Быстрая онлайн-бронь',
            'ОСАГО + комплект экипировки',
            'Поддержка на маршруте',
            'Новая локация сервиса: Стригинский переулок 13Б'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Какой минимальный возраст?', 'a', 'Базовый минимум — 23 года для аренды мотоциклов.'),
            jsonb_build_object('q', 'Можно ли забронировать индивидуальный пакет?', 'a', 'Да, доступен пакет "Индивидуальный". Условия уточняются у менеджера.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Стригинский переулок 13Б, Нижний Новгород',
          'phone', '+7 9200-789-888',
          'email', 'hello@vipbike-rental.example',
          'telegram', '@I_O_S_NN',
          'workingHours', '10:00 - 22:00 (ежедневно)',
          'map', jsonb_build_object(
            'gps', '56.20420451632873, 43.798582127051695',
            'publicTransport', 'Ближайшие остановки и маршруты уточняйте по телефону',
            'carDirections', 'Подъезд к новой локации — см. указатели на месте'
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Naked', 'Supersport', 'Enduro', 'Touring', 'Neo-retro', 'Power-cruiser'),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object('id', 'summer-2025', 'title', 'Промокод ЛЕТО2025', 'subtitle', '-10% на первую аренду', 'code', 'ЛЕТО2025')
          ),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'promoPlaceholder', 'Введите промокод',
          'deliveryModes', jsonb_build_array('pickup', 'delivery'),
          'defaultMode', 'pickup',
          'paymentOptions', jsonb_build_array('card_online', 'cash_on_pickup', 'sbp'),
          'consentText', 'Я согласен с условиями аренды и обработкой персональных данных.'
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'vip-bike';

-- 3) Keep important legacy top-level metadata keys available for old routes/components.
update public.crews c
set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object('slug', 'vip-bike')
    || jsonb_build_object('is_provider', true)
    || jsonb_build_object('provider_type', 'vehicle_rental')
    || jsonb_build_object('rating', 5)
    || jsonb_build_object(
      'contacts',
      jsonb_build_object(
        'primary_phone', '+7 (XXX) XXX-XX-XX',
        'working_hours', '10:00 - 22:00 (ежедневно)',
        'manager_sales', '—',
        'manager_support', '—'
      )
    )
where c.slug = 'vip-bike';

commit;

-- Verification helpers:
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='vip-bike';
-- select jsonb_pretty(metadata->'franchize') from public.crews where slug='vip-bike';
