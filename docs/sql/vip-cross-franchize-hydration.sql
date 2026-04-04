-- VIP_CROSS Franchize hydration reference payload
-- Purpose: provide a production-like, metadata-first seed for /franchize/* runtime.
-- Branch: Cross/Enduro motorcycle rental focused (sister brand of VIP_BIKE)
-- Safe to re-run: uses jsonb_set merge update scoped to slug = 'vip-cross'.
-- Created: 2026-03-26

begin;

-- 1) Ensure crew exists. If row already exists, only minimal fields are refreshed.
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
  '3e6fef81-2ee4-5a1e-9e83-77dd07998557',
  'VIP_CROSS',
  'Вип Кросс — сервис проката кроссовых и эндуро мотоциклов для бездорожья и оффроуд приключений.',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/vip-cross-logo-placeholder.jpg',
  '356282674',
  'vip-cross',
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
--    Based on VIP_BIKE structure, adapted for Cross/Enduro focus.
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-03-26-v1',
        'enabled', true,
        'slug', 'vip-cross',
        'branding', jsonb_build_object(
          'name', 'VIP CROSS RENTAL',
          'shortName', 'VIP_CROSS',
          'tagline', 'Твой эндуро и кроссач: от трассы до полного оффроуда.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vip-cross-hero-placeholder.jpg',
          'heroImageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vip-cross-bg-placeholder.jpg',
          'centerLogoInHeader', true
        ),
        'theme', jsonb_build_object(
          'mode', 'cross_earth_dark',
          'palette', jsonb_build_object(
            'bgBase', '#0A0D0B',
            'bgCard', '#111816',
            'bgElevated', '#161F1A',
            'borderSoft', '#243028',
            'borderCard', '#2A3832',
            'accentMain', '#8BC34A',
            'accentMainHover', '#9CCC65',
            'accentDeep', '#689F38',
            'accentTextOn', '#0A120C',
            'textPrimary', '#F2F5F3',
            'textSecondary', '#A7B8AD',
            'textMuted', '#7D9083',
            'textAccent', '#8BC34A',
            'success', '#66BB6A',
            'warning', '#FFA726',
            'error', '#EF5350'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0A0D0B',
              'bgCard', '#111816',
              'accentMain', '#8BC34A',
              'accentMainHover', '#9CCC65',
              'textPrimary', '#F2F5F3',
              'textSecondary', '#A7B8AD',
              'borderSoft', '#243028'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F5F7F5',
              'bgCard', '#FFFFFF',
              'accentMain', '#558B2F',
              'accentMainHover', '#689F38',
              'textPrimary', '#1B201C',
              'textSecondary', '#4A5B50',
              'borderSoft', '#C8D4CC'
            )
          ),
          'radius', jsonb_build_object('card', 18, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'VIP CROSS RENTAL',
          'subtitle', 'Нижний Новгород',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои аренды', 'href', '/franchize/{slug}/rentals')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Эндуро парк', 'href', '/franchize/{slug}', 'icon', 'FaMotorcycle'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about', 'icon', 'FaCircleInfo')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#0A120C',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'VIP CROSS RENTAL',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Аренда кроссовых и эндуро мотоциклов в Нижнем Новгороде. Покоряй бездорожье с комфортом.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Эндуро парк', 'href', '/franchize/{slug}', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Зал Славы', 'href', '/leaderboard', 'icon', 'FaTrophy'),
                jsonb_build_object('type', 'link', 'label', 'Экипажи', 'href', '/crews', 'icon', 'FaUsers'),
                jsonb_build_object('type', 'link', 'label', 'О Нас', 'href', '/franchize/{slug}/about', 'icon', 'FaCircleInfo')
              )
            ),
            jsonb_build_object(
              'title', 'СОЦСЕТИ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', 'VK Group', 'href', 'https://vk.com/vip_cross', 'icon', 'FaVk'),
                jsonb_build_object('type', 'external', 'label', 'Instagram', 'href', 'https://www.instagram.com/vipcross_nn', 'icon', 'FaInstagram'),
                jsonb_build_object('type', 'external', 'label', 'Telegram Бот', 'href', 'https://t.me/oneCrossPlsBot', 'icon', 'FaTelegram')
              )
            ),
            jsonb_build_object(
              'title', 'СВЯЗЬ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', '@VIP_CROSS_NN', 'href', 'https://t.me/VIP_CROSS_NN', 'icon', 'FaTelegram'),
                jsonb_build_object('type', 'phone', 'label', '+7 9200-789-999', 'href', 'tel:+79200789999', 'icon', 'FaPhone'),
                jsonb_build_object('type', 'text', 'label', 'Н. Н. Стригинский переулок 13Б', 'icon', 'FaMapLocationDot')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} Vip Cross Rental NN',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'VIPCROSS — лидеры проката эндуро и кроссовых мотоциклов в Нижнем Новгороде',
          'heroSubtitle', 'От лёгких питбайков до профи эндуро. Онлайн-бронь, полная защита и инструктор на маршруте.',
          'features', jsonb_build_array(
            'Быстрая онлайн-бронь',
            'Полная защитная экипировка включена',
            'Инструктор и поддержка на маршруте',
            'Трассы для любого уровня подготовки'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Какой минимальный возраст?', 'a', 'Базовый минимум — 18 лет для эндуро, 23 года для кроссовых мотоциклов.'),
            jsonb_build_object('q', 'Нужны ли права?', 'a', 'Для эндуро по пересечённой местности права не обязательны. Для выездов на дороги общего пользования — категории А.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Стригинский переулок 13Б, Нижний Новгород',
          'phone', '+7 9200-789-999',
          'email', 'hello@vipcross-rental.example',
          'telegram', '@VIP_CROSS_NN',
          'workingHours', '09:00 - 21:00 (ежедневно, сезон апрель-октябрь)',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.20420451632873, 43.798582127051695',
            'publicTransport', 'Ближайшие остановки и маршруты уточняйте по телефону',
            'carDirections', 'Подъезд к локации — см. указатели на месте'
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Enduro', 'Cross', 'Pitbike', 'Trial', 'Kids'),
          'quickLinks', jsonb_build_array('Эндуро выходного дня', 'Все по 449', 'Выгодное комбо', 'Trial week'),
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', 'vip-cross-weekend', 'text', '🔥 Weekend enduro: -15% на эндуро пакеты', 'href', '/franchize/vip-cross#category-enduro'),
            jsonb_build_object('id', 'vip-cross-trial', 'text', '⚡ Trial day: полное снаряжение + инструктор бонусом', 'href', '/franchize/vip-cross#category-trial'),
            jsonb_build_object('id', 'vip-cross-telegram', 'text', '📣 Быстрый выкуп слотов через Telegram @VIP_CROSS_NN', 'href', '/franchize/vip-cross/contacts')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object('id', 'summer-2026', 'title', 'Промокод ЭНДУРО2026 для оффроуд маршрута по лесным тропам и карьеру', 'subtitle', '-10% на первую аренду', 'code', 'ЭНДУРО2026', 'activeFrom', '2026-04-01', 'activeTo', '2026-10-31', 'priority', 90, 'ctaLabel', 'Забрать скидку')
          ),
          'adCards', jsonb_build_array(
            jsonb_build_object('id', 'cross-equipment', 'title', 'PRO эндуро экипировка', 'subtitle', 'Добавь комплект защиты к аренде', 'href', '', 'imageUrl', '', 'badge', 'Safety', 'activeFrom', '2026-04-01', 'activeTo', '2026-10-31', 'priority', 70, 'ctaLabel', 'Смотреть детали'),
            jsonb_build_object('id', 'instructor-ride', 'title', 'Инструктор add-on', 'subtitle', 'Гид + обучение на маршруте', 'href', '/franchize/{slug}/contacts', 'imageUrl', '', 'badge', 'Pro', 'activeFrom', '2026-04-01', 'activeTo', '2026-10-31', 'priority', 60, 'ctaLabel', 'Открыть')
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
        -- Contract defaults for document generation (cross/enduro focused)
        'contractDefaults', jsonb_build_object(
          'issuerName', 'Рысан Григорий Константинович',
          'issuerRepresentative', 'Сидоров Илья Олегович',
          'returnAddress', 'г. Нижний Новгород, ул. Стригинский переулок, дом 13б',
          'includedMileage', 100,  -- Less mileage for off-road
          'overageRate', 25,       -- Lower rate for cross/enduro
          'lateReturnPenaltyRub', 5000,
          'contractType', 'vehicle_rental_cross',
          -- Template field mappings for docx generation
          'templateFields', jsonb_build_object(
            'renter_driver_license', jsonb_build_object(
              'description', 'Водительское удостоверение',
              'source', 'renter_profile.driver_license',
              'required', false,  -- Not required for off-road
              'placeholder', '5223 198296'
            ),
            'renter_passport', jsonb_build_object(
              'description', 'Паспорт (серия/номер)',
              'source', 'renter_profile.passport',
              'required', true,
              'placeholder', '2209 384865'
            ),
            'included_mileage', jsonb_build_object(
              'description', 'Включённый пробег (км)',
              'source', 'contractDefaults.includedMileage',
              'required', true,
              'default', 100
            ),
            'overage_rate', jsonb_build_object(
              'description', 'Тариф за превышение пробега (руб/км)',
              'source', 'contractDefaults.overageRate',
              'required', true,
              'default', 25
            ),
            'bike_value_rub', jsonb_build_object(
              'description', 'Полная стоимость мотоцикла (руб)',
              'source', 'bike.estimated_value_rub',
              'required', true,
              'placeholder', '500000'
            ),
            'bike_value_words', jsonb_build_object(
              'description', 'Сумма прописью',
              'source', 'computed_from_bike_value',
              'required', true,
              'computed', true,
              'placeholder', 'Пятьсот тысяч'
            ),
            'late_return_penalty_rub', jsonb_build_object(
              'description', 'Неустойка за просрочку (руб/день)',
              'source', 'contractDefaults.lateReturnPenaltyRub',
              'required', true,
              'default', 5000
            ),
            'return_address', jsonb_build_object(
              'description', 'Адрес возврата мотоцикла',
              'source', 'contractDefaults.returnAddress',
              'required', true,
              'default', 'г. Нижний Новгород, ул. Сиреневый бульвар, дом 136'
            ),
            'issuer_representative', jsonb_build_object(
              'description', 'Представитель арендодателя',
              'source', 'contractDefaults.issuerRepresentative',
              'required', true,
              'default', 'Сидоров Илья Олегович'
            )
          ),
          -- Default values for contract generation
          'defaults', jsonb_build_object(
            'renter_driver_license', '',
            'renter_passport', '',
            'included_mileage', 100,
            'overage_rate', 25,
            'bike_value_rub', 500000,
            'bike_value_words', 'Пятьсот тысяч',
            'late_return_penalty_rub', 5000,
            'return_address', 'г. Нижний Новгород, ул. Стригинский переулок, дом 13б',
            'issuer_representative', 'Сидоров Илья Олегович'
          )
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'vip-cross';

-- 3) Keep important legacy top-level metadata keys available for old routes/components.
update public.crews c
set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object('slug', 'vip-cross')
    || jsonb_build_object('is_provider', true)
    || jsonb_build_object('provider_type', 'vehicle_rental_cross')
    || jsonb_build_object('rating', 5)
    || jsonb_build_object(
      'contacts',
      jsonb_build_object(
        'primary_phone', '+7 9200-789-999',
        'working_hours', '09:00 - 21:00 (ежедневно, сезон апрель-октябрь)',
        'manager_sales', '@VIP_CROSS_NN',
        'manager_support', '@VIP_CROSS_NN'
      )
    )
where c.slug = 'vip-cross';

insert into private.crew_secrets (
  crew_slug,
  contract_defaults,
  updated_at
)
select
  'vip-cross',
  (metadata->'franchize'->'contractDefaults')::text,
  now()
from public.crews
where slug = 'vip-cross'
on conflict (crew_slug) do update
set
  contract_defaults = excluded.contract_defaults,
  updated_at = now();

commit;

-- Verification helpers:
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='vip-cross';
-- select jsonb_pretty(metadata->'franchize'->'contractDefaults') from public.crews where slug='vip-cross';
-- select jsonb_pretty(metadata->'franchize'->'contractDefaults'->'templateFields') from public.crews where slug='vip-cross';


-- 4) Editor parity note:
--    /franchize/create currently edits structured slices (branding/theme/contacts/catalog/order/header.menuLinks)
--    and should preserve richer blocks from this payload (about/footer/promo/quickActions/contractDefaults).

-- 5) Contract defaults usage:
--    When generating a contract document, merge:
--    - contractDefaults.defaults (fallback values)
--    - contractDefaults.templateFields (field definitions + source hints)
--    - Runtime data from rental order (renter info, bike info, dates, prices)
--
--    Example hydration flow:
--    1. Fetch crew metadata by slug
--    2. Extract contractDefaults.templateFields for field definitions
--    3. For each field, resolve 'source' path (e.g., 'renter_profile.driver_license')
--    4. Fall back to contractDefaults.defaults if source is empty
--    5. Generate docx with all {{placeholder}} values populated

-- 6) VIP_CROSS specific notes:
--    - Focus on Enduro/Cross/Pitbike/Trial/Kids categories
--    - Green/earth tones theme (off-road vibe)
--    - Seasonal operation: April-October
--    - Lower included mileage (100 km) - off-road usage
--    - Driver license optional for pure off-road riding
--    - Instructor/guide services available as add-on
