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
  '56.297654,43.947218',
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
          'name', 'VIP BIKE ELECTRO',
          'shortName', 'VIP_BIKE',
          'tagline', 'Электромотоциклы без категории А. Законно, по правам категории B.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-electro-neon.png',
          'heroImageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg',
          'centerLogoInHeader', true,
          'fonts', jsonb_build_object(
            'headings', 'Archivo Black, sans-serif',
            'body', 'Onest, sans-serif',
            'technical', 'Orbitron, sans-serif',
            'accent', 'Comic Neue, cursive'
          )
        ),
        'theme', jsonb_build_object(
          'mode', 'cyber_electro_dark',
          'displayName', 'VIP BIKE ELECTRO Dark',
          'palette', jsonb_build_object(
            'bgBase', '#121520',
            'bgCard', '#1B2132',
            'bgElevated', '#1E2538',
            'borderSoft', '#2A2E3E',
            'borderCard', '#313648',
            'accentMain', '#F4BD55',
            'accentMainHover', '#FFCA60',
            'accentDeep', '#D4A540',
            'accentTextOn', '#121520',
            'textPrimary', '#E6D8C4',
            'textSecondary', '#A7ABB4',
            'textMuted', '#7D828C',
            'textAccent', '#F4BD55',
            'success', '#44CC77',
            'warning', '#F4BD55',
            'error', '#E35B5B'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#121520',
              'bgCard', '#1B2132',
              'accentMain', '#F4BD55',
              'accentMainHover', '#FFCA60',
              'textPrimary', '#E6D8C4',
              'textSecondary', '#A7ABB4',
              'borderSoft', '#2A2E3E'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F5F5F5',
              'bgCard', '#FFFFFF',
              'accentMain', '#C78900',
              'accentMainHover', '#F4BD55',
              'textPrimary', '#1A1A1A',
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
          'title', 'VIP BIKE ELECTRO',
          'subtitle', 'Премиальный прокат в Нижнем Новгороде',
          'logoHref', '/',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'Подбор', 'href', '/franchize/{slug}/podbor'),
            jsonb_build_object('label', 'Аренда', 'href', '/franchize/{slug}/arenda'),
            jsonb_build_object('label', 'Тест-драйв', 'href', '/franchize/{slug}#test-drive'),
            jsonb_build_object('label', 'Покатушки', 'href', '/franchize/{slug}/map-riders'),
            jsonb_build_object('label', 'Каталог-electro', 'href', '/franchize/{slug}/electro-enduro'),
            jsonb_build_object('label', 'Конфигуратор', 'href', '/franchize/{slug}/configurator'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои аренды', 'href', '/franchize/{slug}/rentals'),
            jsonb_build_object('label', 'Сообщество', 'href', '/franchize/{slug}/community'),
            jsonb_build_object('label', 'Партнёрам', 'href', '/franchize/{slug}/onboarding'),
            jsonb_build_object('label', 'Продажи', 'href', '/franchize/{slug}/sales')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Тест-драйв', 'href', '/franchize/{slug}#test-drive', 'icon', 'FaMotorcycle'),
            jsonb_build_object('label', 'Подбор', 'href', '/franchize/{slug}/podbor', 'icon', 'FaWrench')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#16130A',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'VIP BIKE ELECTRO',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Электромотоциклы в Нижнем Новгороде. 79bike: мощно, быстро, законно, без ОСАГО.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Покатушки', 'href', '/franchize/{slug}/map-riders', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Каталог', 'href', '/franchize/{slug}', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Каталог-electro', 'href', '/franchize/{slug}/electro-enduro', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Конфигуратор-electro', 'href', '/franchize/{slug}/configurator', 'icon', 'FaMotorcycle'),
                jsonb_build_object('type', 'link', 'label', 'Зал Славы', 'href', '/franchize/{slug}/leaderboard', 'icon', 'FaTrophy'),
                jsonb_build_object('type', 'link', 'label', 'Сообщество', 'href', '/franchize/{slug}/community', 'icon', 'FaUsersViewfinder'),
                jsonb_build_object('type', 'link', 'label', 'Партнёрам', 'href', '/franchize/{slug}/onboarding', 'icon', 'FaHandshake'),
                jsonb_build_object('type', 'link', 'label', 'Продажи', 'href', '/franchize/{slug}/sales', 'icon', 'FaTags'),
                jsonb_build_object('type', 'link', 'label', 'Главная', 'href', '/vipbikerental', 'icon', 'FaCircleInfo')
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
                jsonb_build_object('type', 'text', 'label', 'Н. Н. пл. Комсомольская 2', 'icon', 'FaMapLocationDot')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} VIP BIKE ELECTRO',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'VIP BIKE ELECTRO — Электромотоциклы без категории А',
          'heroSubtitle', '79bike Falcon PRO от 310 000 ₽. Законно по правам категории B. Без ОСАГО и ПТС.',
          'features', jsonb_build_array(
            'Быстрая онлайн-бронь',
            'Электро без категории А',
            'ОСАГО не требуется',
            'Новая локация сервиса: пл. Комсомольская 2'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Нужна ли категория А для электромотоцикла?', 'a', 'Нет! Электромотоциклы категории B можно ездить законно по правам категории B. ОСАГО и ПТС не требуются.'),
            jsonb_build_object('q', 'Какой минимальный возраст?', 'a', 'Базовый минимум — 18 лет для аренды электромотоциклов.'),
            jsonb_build_object('q', 'Сколько стоит 79bike Falcon PRO?', 'a', 'От 310 000 ₽. Вы можете сначала протестировать в шоуруме Нижнего Новгорода.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'пл. Комсомольская 2, Нижний Новгород',
          'phone', '+7 9200-789-888',
          'email', 'hello@vipbike-rental.example',
          'telegram', '@I_O_S_NN',
          'telegramBotUsername', 'oneBikePlsBot',
          'workingHours', '10:00 - 22:00 (ежедневно)',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.297654,43.947218',
            'publicTransport', 'Ближайшие остановки и маршруты уточняйте по телефону',
            'carDirections', 'Подъезд к новой локации — см. указатели на месте'
          )
        ),
        'contentBlocks', jsonb_build_object(
          'communityEvents', jsonb_build_array(
            jsonb_build_object('title', 'Вечерний электро-заезд', 'time', 'Пт • 19:30', 'place', 'База на Комсомольской 2', 'text', 'Тихий городской круг на электробайках, проверка зарядки, объяснение правил колонны.'),
            jsonb_build_object('title', 'MapRiders city loop', 'time', 'Сб • 12:00', 'place', 'Набережная + тихие улицы Нижнего', 'text', 'Открываем live-карту, ставим meetup-пины и едем в темпе самого спокойного райдера.'),
            jsonb_build_object('title', 'Тест-драйв в шоуруме', 'time', 'Вс • 11:00', 'place', 'VIP BIKE шоурум', 'text', 'Протестируйте 79bike Falcon PRO и другие электромотоциклы перед покупкой.')
          ),
          'partnerCards', jsonb_build_array(
            jsonb_build_object('name', 'VIP BIKE ELECTRO сервис', 'role', 'осмотр и подготовка', 'perk', 'Экспресс-чек перед выездом для электробайков'),
            jsonb_build_object('name', 'Зарядная станция', 'role', 'место встречи', 'perk', 'Тёплый старт, зарядка батареи, быстрый брифинг'),
            jsonb_build_object('name', 'Тест-драйв зона', 'role', 'пробная поездка', 'perk', 'Протестируйте 79bike Falcon PRO перед покупкой')
          ),
          'cityRiderTips', jsonb_build_array(
            'Не стартуй один, если это первый выезд на незнакомом байке.',
            'Включай MapRiders до старта: экипаж увидит скорость, stale-статус и точку встречи.',
            'Для новичков держим видимость «только экипаж» и автостоп геошеринга.',
            'Meetup-пин ставим long-press на карте или тапом по точке + кнопка «+».'
          ),
          'salesVerticals', jsonb_build_array(
            jsonb_build_object('id', 'electric', 'title', '79bike Электро', 'pitch', '79bike Falcon PRO от 310 000 ₽. Законно по правам категории B без ОСАГО и ПТС.', 'cta', 'Собрать электро'),
            jsonb_build_object('id', 'test-drive', 'title', 'Тест-драйв', 'pitch', 'Протестируйте электромотоцикл в шоуруме Нижнего Новгорода перед покупкой.', 'cta', 'Записаться'),
            jsonb_build_object('id', 'rental', 'title', 'Аренда', 'pitch', 'Премиальный прокат электромотоциклов с полной экипировкой и поддержкой.', 'cta', 'Выбрать байк'),
            jsonb_build_object('id', 'trade-in', 'title', 'Trade-in', 'pitch', 'Обменяйте свой байк на электро со скидкой. Быстрая оценка и выгодные условия.', 'cta', 'Оценить байк')
          ),
          'onboardingChecklist', jsonb_build_array(
            jsonb_build_object('title', 'Заявка и контакт', 'text', 'Фиксируем Telegram/телефон, город, формат партнёрства и ожидаемый объём байков.', 'icon', 'message-circle'),
            jsonb_build_object('title', 'Парк и роли', 'text', 'Описываем модели, статусы аренды/продажи, ответственных за выдачу, сервис и контент.', 'icon', 'clipboard-check'),
            jsonb_build_object('title', 'Документы и правила', 'text', 'Согласуем договор, депозит, чеклист выдачи, ограничения по району и страховочные сценарии.', 'icon', 'file-text'),
            jsonb_build_object('title', 'Пилотный запуск', 'text', 'Включаем витрину, тестовый заказ, MapRiders-сценарий и короткий smoke-check в Telegram WebApp.', 'icon', 'shield-check')
          ),
          'onboardingReadinessRows', jsonb_build_array(
            jsonb_build_object('label', 'Брендинг', 'text', 'лого, цвета, оффер, адрес и рабочие часы'),
            jsonb_build_object('label', 'Каталог', 'text', 'аренда, продажа, электробайки, аксессуары'),
            jsonb_build_object('label', 'Операции', 'text', 'выдача, возврат, сервис, админ-доступы'),
            jsonb_build_object('label', 'Продажи', 'text', 'новые/электро/б/у/trade-in лиды и тест-драйв'),
            jsonb_build_object('label', 'Комьюнити', 'text', 'MapRiders, события, партнёры и Telegram-канал')
          ),
          'aboutCapabilities', jsonb_build_array(
            jsonb_build_object('title', 'Аренды без лишнего трения', 'text', 'Быстрый выбор байка, даты и формата поездки с операторским сопровождением.', 'icon', 'bike'),
            jsonb_build_object('title', 'Продажи и конфигуратор', 'text', 'Покупка, custom/electric сценарии, trade-in и прозрачный следующий шаг.', 'icon', 'shopping-bag'),
            jsonb_build_object('title', 'MapRiders и комьюнити', 'text', 'Живые meetup-точки и маршруты вместо хаотичных договорённостей.', 'icon', 'map'),
            jsonb_build_object('title', 'Сервис и помощь', 'text', 'Выдача, возврат, рекомендации по эксплуатации и поддержка после поездки.', 'icon', 'wrench')
          ),
          'aboutWorkSteps', jsonb_build_array(
            jsonb_build_object('title', 'Выберите байк', 'text', 'Откройте каталог и добавьте подходящую позицию в заявку.'),
            jsonb_build_object('title', 'Подтвердите в Telegram', 'text', 'Оператор уточнит время, документы и оплату без лишних шагов.'),
            jsonb_build_object('title', 'Заберите и катайтесь', 'text', 'На точке выдачи фиксируем состояние и передаём экипировку.'),
            jsonb_build_object('title', 'Верните и оставьте отзыв', 'text', 'Закрываем поездку и улучшаем сервис на базе обратной связи.')
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Electro', 'Enduro', 'Naked', 'Supersport', 'Cruiser'),
          'quickLinks', jsonb_build_array('79bike Falcon PRO', 'Электро-тест', 'Выгодное комбо', 'Аренда выходного дня'),
          -- VIP BIKE ELECTRO ticker
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', 'electro-main', 'text', '⚡ 79bike Falcon PRO: электромотоцикл без категории А от 310 000 ₽', 'href', '/franchize/vip-bike#catalog'),
            jsonb_build_object('id', 'test-drive', 'text', '🏍 Тест-драйв в шоуруме: протестируйте электро перед покупкой', 'href', '/franchize/vip-bike#test-drive'),
            jsonb_build_object('id', 'no-osago', 'text', '✅ Законно без ОСАГО и ПТС по правам категории B', 'href', '/franchize/vip-bike/electro-enduro')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          -- VIP BIKE ELECTRO promo banner
          'promoBanners', jsonb_build_array(
            jsonb_build_object(
              'id', 'electro-2026',
              'title', '79bike Falcon PRO - Электро без категории А',
              'subtitle', 'Законно по правам B. Запас хода до 120 км. Разгон 0-50 км/ч за 3.5 с.',
              'code', 'ELECTRO2026',
              'activeFrom', '2026-01-01',
              'activeTo', '2026-12-31',
              'priority', 95,
              'ctaLabel', 'Протестировать'
            )
          ),
          -- Electro ad cards
          'adCards', jsonb_build_array(
            jsonb_build_object('id', 'falcon-pro', 'title', '79bike Falcon PRO', 'subtitle', '310 000 ₽ - Электромотоцикл премиум класса', 'href', '/franchize/vip-bike/configurator', 'imageUrl', '', 'badge', 'Bestseller', 'activeFrom', '2026-01-01', 'activeTo', '2026-12-31', 'priority', 90, 'ctaLabel', 'Подробнее'),
            jsonb_build_object('id', 'test-drive-shuffle', 'title', 'Тест-драйв', 'subtitle', 'Протестируйте электромотоцикл в шоуруме Нижнего Новгорода', 'href', '/franchize/vip-bike#test-drive', 'imageUrl', '', 'badge', 'Popular', 'activeFrom', '2026-01-01', 'activeTo', '2026-12-31', 'priority', 85, 'ctaLabel', 'Записаться')
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
          'returnAddress', 'Н. Н. пл. Комсомольская 2',
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
            'return_address', jsonb_build_object('description', 'Адрес возврата мотоцикла', 'source', 'contractDefaults.returnAddress', 'required', true, 'default', 'Н. Н. пл. Комсомольская 2'),
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
            'return_address', 'Н. Н. пл. Комсомольская 2',
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
