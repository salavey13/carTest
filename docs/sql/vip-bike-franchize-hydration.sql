-- /docs/sql/vip-bike-franchize-hydration.sql
-- VIP_BIKE Franchize hydration reference payload (2026 edition)
-- Purpose: production-like seed with metadata-first approach + private.crew_secrets extraction
-- Safe to re-run: uses ON CONFLICT + jsonb_set + private upsert
-- Updated: 2026-04-03 — moved contractDefaults to private.crew_secrets + fresh 2026 creative ticker/ads

begin;

-- 1) Ensure crew exists
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

-- 2) Canonical franchize metadata payload (contractDefaults stays in public for backward compatibility)
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-04-03-v3',
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
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0B0C10',
              'bgCard', '#111217',
              'accentMain', '#D99A00',
              'accentMainHover', '#E2A812',
              'textPrimary', '#F2F2F3',
              'textSecondary', '#A7ABB4',
              'borderSoft', '#24262E'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F6F6F7',
              'bgCard', '#FFFFFF',
              'accentMain', '#C78900',
              'accentMainHover', '#D99A00',
              'textPrimary', '#1A1B1F',
              'textSecondary', '#4B5160',
              'borderSoft', '#D4D8E1'
            )
          ),
          'radius', jsonb_build_object('card', 18, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'VIP BIKE RENTAL',
          'subtitle', 'Нижний Новгород',
          'logoHref', '/vipbikerental',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои аренды', 'href', '/franchize/{slug}/rentals'),
            jsonb_build_object('label', 'Конфигуратор', 'href', '/franchize/{slug}/configurator'),
            jsonb_build_object('label', 'Enduro', 'href', '/franchize/{slug}/electro-enduro')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Мотопарк', 'href', '/franchize/{slug}', 'icon', 'FaMotorcycle'),
            jsonb_build_object('label', 'О нас', 'href', '/vipbikerental', 'icon', 'FaCircleInfo')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#16130A',
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
                jsonb_build_object('type', 'link', 'label', 'Мотопарк', 'href', '/franchize/{slug}', 'icon', 'FaMotorcycle'),
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
                jsonb_build_object('type', 'text', 'label', 'Н. Н. ул. Комсомольская 2', 'icon', 'FaMapLocationDot')
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
            'Новая локация сервиса: ул. Комсомольская 2'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Какой минимальный возраст?', 'a', 'Базовый минимум — 23 года для аренды мотоциклов.'),
            jsonb_build_object('q', 'Можно ли забронировать индивидуальный пакет?', 'a', 'Да, доступен пакет "Индивидуальный". Условия уточняются у менеджера.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'ул. Комсомольская 2, Нижний Новгород',
          'phone', '+7 9200-789-888',
          'email', 'hello@vipbike-rental.example',
          'telegram', '@I_O_S_NN',
          'workingHours', '10:00 - 22:00 (ежедневно)',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.20420451632873, 43.798582127051695',
            'publicTransport', 'Ближайшие остановки и маршруты уточняйте по телефону',
            'carDirections', 'Подъезд к новой локации — см. указатели на месте'
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Naked', 'Supersport', 'Enduro', 'Touring', 'Neo-retro', 'Power-cruiser'),
          'quickLinks', jsonb_build_array('23 февраля', 'Все по 549', 'Выгодное комбо', 'Cruiser week'),
          -- 2026 fresh & creative ticker (no more 2025 vibes)
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', '2026-neural-drop', 'text', '🚀 2026 Neural Drop: новые power-cruisers с AI-ассистентом уже в парке!', 'href', '/franchize/vip-bike#category-power-cruiser'),
            jsonb_build_object('id', 'electro-spring', 'text', '⚡ Электро-весна 2026: -25% на e-cruisers + бесплатная зарядка + GoPro в подарок', 'href', '/franchize/vip-bike#catalog-sections'),
            jsonb_build_object('id', 'ai-route-master', 'text', '🧬 AI Route Master 2026: нейросеть строит идеальный маршрут под твой вайб', 'href', '/franchize/vip-bike/contacts')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          -- 2026 creative promo banner
          'promoBanners', jsonb_build_array(
            jsonb_build_object(
              'id', 'spring-2026-blast',
              'title', 'Весенний нейро-бласт 2026',
              'subtitle', '-20% на первую аренду + AI-маршрут в подарок',
              'code', 'NEURO2026',
              'activeFrom', '2026-03-01',
              'activeTo', '2026-05-31',
              'priority', 95,
              'ctaLabel', 'Забрать нейро-скидку'
            )
          ),
          -- 2026 creative ad cards
          'adCards', jsonb_build_array(
            jsonb_build_object('id', 'neural-helmet', 'title', 'Neural Helmet PRO', 'subtitle', 'AR-шлем с проекцией маршрута и музыкой 2026', 'href', '', 'imageUrl', '', 'badge', 'Future', 'activeFrom', '2026-01-01', 'activeTo', '2026-12-31', 'priority', 80, 'ctaLabel', 'Смотреть'),
            jsonb_build_object('id', 'drone-ride', 'title', 'Drone Ride Experience', 'subtitle', 'Профессиональная съёмка с дрона + нейро-монтаж видео', 'href', '/franchize/{slug}/contacts', 'imageUrl', '', 'badge', 'Content', 'activeFrom', '2026-02-01', 'activeTo', '2026-12-31', 'priority', 75, 'ctaLabel', 'Заказать')
          ),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'promoPlaceholder', 'Введите промокод',
          'deliveryModes', jsonb_build_array('pickup', 'delivery'),
          'defaultMode', 'pickup',
          'paymentOptions', jsonb_build_array('telegram_xtr', 'card', 'sbp', 'cash'),
          'consentText', 'Я согласен с условиями аренды и обработкой персональных данных.'
        ),
        -- contractDefaults stays in public metadata for now (backward compatibility)
        'contractDefaults', jsonb_build_object(
          'issuerName', 'Рысан Григорий Константинович',
          'issuerRepresentative', 'Сидоров Илья Олегович',
          'returnAddress', 'Н. Н. ул. Комсомольская 2',
          'includedMileage', 200,
          'overageRate', 30,
          'lateReturnPenaltyRub', 5000,
          'templateFields', jsonb_build_object(
            'renter_driver_license', jsonb_build_object('description', 'Водительское удостоверение', 'source', 'renter_profile.driver_license', 'required', true, 'placeholder', '5223 198296'),
            'renter_passport', jsonb_build_object('description', 'Паспорт (серия/номер)', 'source', 'renter_profile.passport', 'required', true, 'placeholder', '2209 384865'),
            'included_mileage', jsonb_build_object('description', 'Включённый пробег (км)', 'source', 'contractDefaults.includedMileage', 'required', true, 'default', 200),
            'overage_rate', jsonb_build_object('description', 'Тариф за превышение пробега (руб/км)', 'source', 'contractDefaults.overageRate', 'required', true, 'default', 30),
            'bike_value_rub', jsonb_build_object('description', 'Полная стоимость мотоцикла (руб)', 'source', 'bike.estimated_value_rub', 'required', true, 'placeholder', '700000'),
            'bike_value_words', jsonb_build_object('description', 'Сумма прописью', 'source', 'computed_from_bike_value', 'required', true, 'computed', true, 'placeholder', 'Семьсот тысяч'),
            'late_return_penalty_rub', jsonb_build_object('description', 'Неустойка за просрочку (руб/день)', 'source', 'contractDefaults.lateReturnPenaltyRub', 'required', true, 'default', 5000),
            'return_address', jsonb_build_object('description', 'Адрес возврата мотоцикла', 'source', 'contractDefaults.returnAddress', 'required', true, 'default', 'Н. Н. ул. Комсомольская 2'),
            'issuer_representative', jsonb_build_object('description', 'Представитель арендодателя', 'source', 'contractDefaults.issuerRepresentative', 'required', true, 'default', 'Сидоров Илья Олегович')
          ),
          'defaults', jsonb_build_object(
            'renter_driver_license', '',
            'renter_passport', '',
            'included_mileage', 200,
            'overage_rate', 30,
            'bike_value_rub', 700000,
            'bike_value_words', 'Семьсот тысяч',
            'late_return_penalty_rub', 5000,
            'return_address', 'Н. Н. ул. Комсомольская 2',
            'issuer_representative', 'Сидоров Илья Олегович'
          )
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'vip-bike';

-- 3) Legacy top-level metadata (unchanged)
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
        'primary_phone', '+7 9200-789-888',
        'working_hours', '10:00 - 22:00 (ежедневно)',
        'manager_sales', '@I_O_S_NN',
        'manager_support', '@I_O_S_NN'
      )
    )
where c.slug = 'vip-bike';

-- 4) ★ Stage 2 extraction: move contractDefaults into private.crew_secrets
insert into private.crew_secrets (
  crew_slug,
  contract_defaults,
  updated_at
)
select
  'vip-bike',
  (metadata->'franchize'->'contractDefaults')::text,
  now()
from public.crews
where slug = 'vip-bike'
on conflict (crew_slug) do update
set
  contract_defaults = excluded.contract_defaults,
  updated_at = now();

commit;

-- Verification helpers (updated 2026)
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='vip-bike';
-- select jsonb_pretty((select contract_defaults::jsonb from private.crew_secrets where crew_slug='vip-bike')) as private_contract_defaults;
-- select jsonb_pretty(metadata->'franchize'->'contractDefaults') from public.crews where slug='vip-bike';
