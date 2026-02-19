-- SLY13 Franchize hydration test payload
-- Purpose: test metadata profile close to current /franchize components + operator vibe (AI studio + sport + coaching).
-- Assumption: crew with slug='sly13' already exists (manual apply by operator).

begin;

update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-02-19-sly13-v1',
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
          'mode', 'cyberdawn_dark',
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
            'gps', '56.3269,44.0059',
            'publicTransport', 'Основной формат — онлайн',
            'carDirections', 'Оффлайн встречи согласовываются заранее'
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('CyberVIBE', 'Snowboard', 'Dota2', 'Labs'),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object('id', 'sly13-focus', 'title', 'Код FOCUS13', 'subtitle', 'Скидка на первый разбор', 'code', 'FOCUS13')
          ),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'promoPlaceholder', 'Введите код/реф',
          'deliveryModes', jsonb_build_array('online', 'hybrid'),
          'defaultMode', 'online',
          'paymentOptions', jsonb_build_array('xtr', 'card_online', 'sbp'),
          'consentText', 'Подтверждаю согласие на обработку данных и условия предоставления услуги.'
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
-- select jsonb_pretty(metadata->'franchize') from public.crews where slug='sly13';
