-- SLY13 Franchize hydration test payload
-- Purpose: test metadata profile close to current /franchize components + operator vibe (AI studio + sport + coaching).
-- Assumption: crew with slug='sly13' already exists (manual apply by operator).
-- Updated: 2026-03-26 - added contractDefaults for document generation

begin;

update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-03-26-sly13-v2',
        'enabled', true,
        'slug', 'sly13',
        'branding', jsonb_build_object(
          'name', 'SLY13 CYBERVIBE',
          'shortName', 'SLY13',
          'tagline', 'AI + спорт + продакт-эксперименты: от идеи до боевого рантайма.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/a7f27e4d-81ba-464a-a8e5-7a75cd0f6c00-ac3bac18-2adc-4c94-bada-2c2f0805fde4.jpg',
          'centerLogoInHeader', true
        ),
        'theme', jsonb_build_object(
          'mode', 'cyberdawn_light',
          'palette', jsonb_build_object(
            'bgBase', '#090B12',
            'bgCard', '#101726',
            'bgElevated', '#162136',
            'borderSoft', '#26354F',
            'borderCard', '#324664',
            'accentMain', '#7CFFB2',
            'accentMainHover', '#9CFFD0',
            'accentDeep', '#4DD48F',
            'accentTextOn', '#07140F',
            'textPrimary', '#EAF2FF',
            'textSecondary', '#9EB2D1',
            'textMuted', '#7E92B1',
            'textAccent', '#7CFFB2',
            'success', '#62D88A',
            'warning', '#F2C14E',
            'error', '#FF6B7A'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#090B12',
              'bgCard', '#101726',
              'accentMain', '#7CFFB2',
              'accentMainHover', '#9CFFD0',
              'textPrimary', '#EAF2FF',
              'textSecondary', '#9EB2D1',
              'borderSoft', '#26354F'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F4F9FF',
              'bgCard', '#FFFFFF',
              'accentMain', '#168A5C',
              'accentMainHover', '#1FA46E',
              'textPrimary', '#0D1B2A',
              'textSecondary', '#36506E',
              'borderSoft', '#C4D7EA'
            )
          ),
          'radius', jsonb_build_object('card', 18, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'SLY13 CYBERVIBE',
          'subtitle', 'Онлайн / Telegram / Нижний Новгород',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Vibe Studio', 'href', '/repo-xml', 'icon', 'FaBrain'),
            jsonb_build_object('label', 'Сервисы', 'href', '/franchize/{slug}', 'icon', 'FaBolt'),
            jsonb_build_object('label', 'Связаться', 'href', '/franchize/{slug}/contacts', 'icon', 'FaTelegram')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#16130A',
          'phone', '+7 9200-789-888',
          'email', 'sly13@cybervibe.local',
          'address', 'Онлайн / Telegram @SALAVEY13',
          'columns', jsonb_build_array(
            jsonb_build_object('title', 'SLY13', 'items', jsonb_build_array(jsonb_build_object('type', 'text', 'value', 'AI-assisted студия и прокачка продуктового мышления.'))),
            jsonb_build_object('title', 'НАПРАВЛЕНИЯ', 'items', jsonb_build_array(
              jsonb_build_object('type', 'text', 'value', 'CyberVIBE сессии'),
              jsonb_build_object('type', 'text', 'value', 'Сноуборд-инструктор'),
              jsonb_build_object('type', 'text', 'value', 'Dota2 coaching')
            ))
          ),
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'SLY13 — CyberVIBE оператор и практик сервисного продакта',
          'heroSubtitle', 'Собираю флоу от Telegram-first идеи до рабочего интерфейса, тестов и PR-цикла.',
          'features', jsonb_build_array(
            'AI как ко-пилот для контента и MVP',
            'Сервисные продукты: от валидации до релиза',
            'Гибрид онлайн-наставничества и офлайн-активностей'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Что такое CyberVIBE?', 'a', 'Практическая сессия по идее, упаковке и запуску с AI-инструментами.'),
            jsonb_build_object('q', 'Какой формат работы?', 'a', 'Онлайн через Telegram/веб и персональные разборы по задачам.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Онлайн / Telegram @SALAVEY13',
          'phone', '+7 9200-789-888',
          'email', 'sly13@cybervibe.local',
          'telegram', '@SALAVEY13',
          'workingHours', 'Гибкий график по договорённости',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.3269,44.0059',
            'publicTransport', 'Основной формат — онлайн',
            'carDirections', 'Оффлайн встречи согласовываются заранее'
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('CyberVIBE', 'Snowboard', 'Dota2', 'Labs'),
          'quickLinks', jsonb_build_array('CyberVIBE', 'Snowboard', 'Dota2', 'Labs'),
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', 'sly13-cyber-sprint', 'text', '🚀 Auction sprint: 3 места на CyberVIBE разбор', 'href', '/franchize/sly13#category-cybervibe'),
            jsonb_build_object('id', 'sly13-snow-drop', 'text', '🏂 Snow drop: пакет инструктор + видеоразбор', 'href', '/franchize/sly13#category-snowboard'),
            jsonb_build_object('id', 'sly13-labs-open', 'text', '🧪 Labs open call: тест гипотез в мини-группе', 'href', '/franchize/sly13#category-labs')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object('id', 'sly13-focus', 'title', 'Код FOCUS13 на длинный deep-dive разбор в стиле cybervibe roadmap session', 'subtitle', 'Скидка на первый разбор', 'code', 'FOCUS13', 'activeFrom', '2026-02-01', 'activeTo', '2026-12-31', 'priority', 85, 'ctaLabel', 'Забрать бонус')
          ),
          'adCards', jsonb_build_array(
            jsonb_build_object('id', 'helmet-upgrade', 'title', 'PRO экипировка', 'subtitle', 'Добавь комплект защиты к аренде', 'href', '', 'imageUrl', '', 'badge', 'Safety', 'activeFrom', '2026-02-01', 'activeTo', '2026-12-31', 'priority', 70, 'ctaLabel', 'Смотреть детали'),
            jsonb_build_object('id', 'photo-ride', 'title', 'Photo ride add-on', 'subtitle', 'Контент-съёмка + маршрут от куратора', 'href', '/franchize/{slug}/contacts', 'imageUrl', '', 'badge', 'Boost', 'activeFrom', '2026-02-01', 'activeTo', '2026-12-31', 'priority', 60, 'ctaLabel', 'Открыть')
          ),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'promoPlaceholder', 'Введите код/реф',
          'deliveryModes', jsonb_build_array('online', 'hybrid'),
          'defaultMode', 'online',
          'paymentOptions', jsonb_build_array('telegram_xtr', 'card', 'sbp', 'cash'),
          'consentText', 'Подтверждаю согласие на обработку данных и условия предоставления услуги.'
        ),
        -- NEW: Contract defaults for document generation (service-based, not vehicle rental)
        'contractDefaults', jsonb_build_object(
          'issuerName', 'SLY13 CYBERVIBE',
          'issuerRepresentative', '@SALAVEY13',
          'returnAddress', 'Онлайн / Telegram @SALAVEY13',
          'includedMileage', 0,
          'overageRate', 0,
          'lateReturnPenaltyRub', 0,
          'contractType', 'service',
          -- Template field mappings for docx generation
          'templateFields', jsonb_build_object(
            'renter_driver_license', jsonb_build_object(
              'description', 'Водительское удостоверение (опционально для некоторых услуг)',
              'source', 'renter_profile.driver_license',
              'required', false,
              'placeholder', ''
            ),
            'renter_passport', jsonb_build_object(
              'description', 'Паспорт (серия/номер)',
              'source', 'renter_profile.passport',
              'required', false,
              'placeholder', ''
            ),
            'included_mileage', jsonb_build_object(
              'description', 'Включённый пробег (км) — не применимо для услуг',
              'source', 'contractDefaults.includedMileage',
              'required', false,
              'default', 0
            ),
            'overage_rate', jsonb_build_object(
              'description', 'Тариф за превышение пробега — не применимо для услуг',
              'source', 'contractDefaults.overageRate',
              'required', false,
              'default', 0
            ),
            'bike_value_rub', jsonb_build_object(
              'description', 'Стоимость оборудования/материалов (руб)',
              'source', 'service.equipment_value_rub',
              'required', false,
              'placeholder', '0'
            ),
            'bike_value_words', jsonb_build_object(
              'description', 'Сумма прописью',
              'source', 'computed_from_equipment_value',
              'required', false,
              'computed', true,
              'placeholder', ''
            ),
            'late_return_penalty_rub', jsonb_build_object(
              'description', 'Неустойка за просрочку (руб/день)',
              'source', 'contractDefaults.lateReturnPenaltyRub',
              'required', false,
              'default', 0
            ),
            'return_address', jsonb_build_object(
              'description', 'Адрес/контакты для связи',
              'source', 'contractDefaults.returnAddress',
              'required', true,
              'default', 'Онлайн / Telegram @SALAVEY13'
            ),
            'issuer_representative', jsonb_build_object(
              'description', 'Представитель исполнителя',
              'source', 'contractDefaults.issuerRepresentative',
              'required', true,
              'default', '@SALAVEY13'
            )
          ),
          -- Default values for contract generation
          'defaults', jsonb_build_object(
            'renter_driver_license', '',
            'renter_passport', '',
            'included_mileage', 69,
            'overage_rate', 13,
            'bike_value_rub', 200000,
            'bike_value_words', '',
            'late_return_penalty_rub', 0,
            'return_address', 'Онлайн / Telegram @SALAVEY13',
            'issuer_representative', '@SALAVEY13'
          )
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'sly13';

update public.crews c
set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object('slug', 'sly13')
    || jsonb_build_object('is_provider', true)
    || jsonb_build_object('provider_type', 'multi_activity_provider')
    || jsonb_build_object('rating', 5)
where c.slug = 'sly13';

commit;

-- Verification helpers:
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='sly13';
-- select jsonb_pretty(metadata->'franchize'->'contractDefaults') from public.crews where slug='sly13';
