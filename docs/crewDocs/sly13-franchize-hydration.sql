-- /docs/sql/sly13-franchize-hydration.sql
-- SLY13 CYBERVIBE Franchize hydration — meta-crew for crew creation
-- Purpose: seed data for sly13 — the "meta-crew" that creates other crews,
--          teaches local admins, and digitizes old-fashioned businesses
-- Safe to re-run: ON CONFLICT + jsonb_set + private upsert
-- Updated: 2026-07-17 v6-crew — toxic olive theme, crew creation + education focus

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
  '6be3846b-f350-4558-a6c3-44b43b6760de',
  'SLY13 CYBERVIBE',
  'Создаю экипажи с нуля. Цифровые витрины, AI-операторы, обучение локальных админов. Превращаю бумажный бизнес в онлайн-систему.',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/a7f27e4d-81ba-464a-a8e5-7a75cd0f6c00-ac3bac18-2adc-4c94-bada-2c2f0805fde4.jpg',
  '356282674',
  'sly13',
  '56.3269,44.0059',
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

-- 2) Full franchize metadata payload
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2026-07-v6-crew',
        'enabled', true,
        'slug', 'sly13',
        'branding', jsonb_build_object(
          'name', 'SLY13 CYBERVIBE',
          'shortName', 'SLY13',
          'tagline', 'Создаю экипажи. Учу админов. Цифровизирую бизнес.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif',
          'heroImageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg',
          'centerLogoInHeader', true,
          'fonts', jsonb_build_object(
            'headings', 'Space Grotesk, sans-serif',
            'body', 'Onest, sans-serif',
            'technical', 'JetBrains Mono, monospace',
            'accent', 'Space Grotesk, sans-serif'
          )
        ),
        'theme', jsonb_build_object(
          'mode', 'auto',
          'displayName', 'SLY13 — Toxic Olive',
          'palette', jsonb_build_object(
            'bgBase', '#0D1117',
            'bgCard', '#161B22',
            'accentMain', '#E1FF01',
            'accentMainHover', '#F0FF66',
            'textPrimary', '#F0F6FC',
            'textSecondary', '#8B949E',
            'borderSoft', '#21262D'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0D1117',
              'bgCard', '#161B22',
              'accentMain', '#E1FF01',
              'accentMainHover', '#F0FF66',
              'textPrimary', '#F0F6FC',
              'textSecondary', '#8B949E',
              'borderSoft', '#21262D'
            ),
            'light', jsonb_build_object(
              'bgBase', '#FAFAFA',
              'bgCard', '#FFFFFF',
              'accentMain', '#6B8E00',
              'accentMainHover', '#5A7800',
              'textPrimary', '#1A1A1A',
              'textSecondary', '#4A4A4A',
              'borderSoft', '#E5E5E5'
            )
          ),
          'radius', jsonb_build_object('card', 16, 'button', 12, 'pill', 999, 'sm', 8, 'md', 12, 'lg', 16),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'SLY13 CYBERVIBE',
          'subtitle', 'Создание экипажей · Цифровизация · Обучение',
          'logoHref', '/franchize/sly13',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои сессии', 'href', '/franchize/{slug}/rentals')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Vibe session', 'href', '/franchize/{slug}#test-drive', 'icon', 'FaBolt')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#F0F6FC',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'SLY13 CYBERVIBE',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Создаю экипажи с нуля. Цифровые витрины, AI-операторы, обучение локальных админов.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Каталог', 'href', '/franchize/{slug}', 'icon', 'FaBolt'),
                jsonb_build_object('type', 'link', 'label', 'О нас', 'href', '/franchize/{slug}/about', 'icon', 'FaCircleInfo'),
                jsonb_build_object('type', 'link', 'label', 'Витрины', 'href', '/franchize/{slug}/onboarding', 'icon', 'FaHandshake')
              )
            ),
            jsonb_build_object(
              'title', 'СВЯЗЬ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', '@SALAVEY13', 'href', 'https://t.me/SALAVEY13', 'icon', 'FaTelegram')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} SLY13 CyberVibe',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'SLY13 — твой AI-инженер по запуску',
          'heroSubtitle', 'Создаю экипажи с нуля. Цифровые витрины, AI-операторы, обучение локальных админов. Превращаю бумажный бизнес в онлайн-систему.',
          'features', jsonb_build_array(
            'Создание экипажа за 1 день: витрина, каталог, корзина, админка',
            'Обучение локальных админов: никакого кода, только Telegram + веб',
            'Forward-deployed engineering: приезжаю, настраиваю, внедряю',
            'AI-сопровождение: бот помогает вести сделки, документы, аналитику'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Кому это нужно?', 'a', 'Предпринимателям, у которых «всё в тетрадке» и Excel-таблица — единственная учётная система.'),
            jsonb_build_object('q', 'Как быстро запускается экипаж?', 'a', 'Базовый запуск — 1-2 дня: заливаем каталог, настраиваем брендинг, подключаем Telegram-бота, обучаем админа.'),
            jsonb_build_object('q', 'Что такое «vibe session»?', 'a', 'Глубокая онлайн-встреча на 1-2 часа: аудит текущих процессов, проектирование первого цифрового шага, ответы на вопросы.')
          )
        ),
        'aboutCapabilities', jsonb_build_array(
          jsonb_build_object('title', 'Создание экипажа под ключ', 'text', 'От брендинга до боевой витрины за 1-2 дня. Каталог, корзина, админка, Telegram-бот, аналитика.', 'icon', 'zap'),
          jsonb_build_object('title', 'Обучение локальных админов', 'text', 'Провожу сессии для сотрудников: как добавлять товары, управлять заказами, смотреть аналитику. Без кода и нервов.', 'icon', 'graduation-cap'),
          jsonb_build_object('title', 'Forward-deployed engineering', 'text', 'Приезжаю на точку, настраиваю всё вживую, решаю проблемы на месте.', 'icon', 'map-pin'),
          jsonb_build_object('title', 'AI-сопровождение бизнеса', 'text', 'Бот обрабатывает заказы, напоминает о возвратах, ведёт документы и отвечает клиентам 24/7.', 'icon', 'bot')
        ),
        'aboutWorkSteps', jsonb_build_array(
          jsonb_build_object('title', 'Аудит', 'text', 'Созваниваемся, смотрим текущие процессы, определяем scope работ.'),
          jsonb_build_object('title', 'Запуск', 'text', 'Собираю экипаж: витрина, каталог, корзина, админка, бот, аналитика.'),
          jsonb_build_object('title', 'Обучение', 'text', 'Провожу сессию с локальной командой, передаю управление.'),
          jsonb_build_object('title', 'Сопровождение', 'text', 'Остаюсь на подстраховке, добавляю фичи, помогаю с сложными случаями.')
        ),
        'contacts', jsonb_build_object(
          'address', 'Онлайн / Нижний Новгород',
          'phone', '',
          'email', '',
          'telegram', '@SALAVEY13',
          'telegramBotUsername', '',
          'workingHours', 'По договорённости',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.3269,44.0059',
            'publicTransport', 'Основной формат — онлайн',
            'carDirections', 'Оффлайн встречи по договорённости'
          )
        ),
        'cta', jsonb_build_object(
          'title', 'Vibe-сессия',
          'description', 'Разберём твой бизнес за одну встречу. Аудит процессов, цифровой план, первые шаги — онлайн или лично.',
          'buttonLabel', 'Записаться на vibe-сессию',
          'buttonHref', 'https://t.me/SALAVEY13'
        ),
        'contentBlocks', jsonb_build_object(
          'communityEvents', jsonb_build_array(
            jsonb_build_object('title', 'Vibe-сессия: разбор бизнеса', 'time', 'Пн–Пт • по записи', 'place', 'Telegram / Zoom', 'text', 'Индивидуальный разбор текущих процессов и план цифровизации.'),
            jsonb_build_object('title', 'Админ-скоростной', 'time', 'Сб • 11:00', 'place', 'Онлайн', 'text', 'Двухчасовая группа: как управлять экипажем через админку, добавлять товары, смотреть аналитику.'),
            jsonb_build_object('title', 'Экспресс-запуск экипажа', 'time', 'По запросу', 'place', 'Оффлайн / Нижний Новгород', 'text', 'Приезжаю на точку, поднимаю витрину за день, обучаю локального админа.')
          ),
          'partnerCards', jsonb_build_array(
            jsonb_build_object('name', 'oneSitePls', 'role', 'платформа', 'perk', 'Telegram-first веб-инструменты для экипажей'),
            jsonb_build_object('name', 'Supabase', 'role', 'бэкенд', 'perk', 'Postgres + Auth + Storage — всё в одном'),
            jsonb_build_object('name', 'Vercel', 'role', 'хостинг', 'perk', 'Быстрый деплой витрины без DevOps')
          ),
          'cityRiderTips', jsonb_build_array(
            'Главное — начать с одного продукта, а не с идеальной системы.',
            'Локальный админ решает 80% задач. Твоя работа — научить, а не сделать за него.',
            'Telegram — лучший интерфейс для бизнеса, который никогда не открывает CRM.',
            'После запуска экипажа переводи его на самостоятельное ведение за 2-3 недели.'
          ),
          'salesVerticals', jsonb_build_array(
            jsonb_build_object('id', 'new-crew', 'title', 'Создание экипажа', 'pitch', 'С нуля: брендинг, каталог, корзина, админка, бот, аналитика.', 'cta', 'Запустить'),
            jsonb_build_object('id', 'education', 'title', 'Обучение админа', 'pitch', 'Сессия 1-2 часа: научу управлять экипажем без кода.', 'cta', 'Записаться'),
            jsonb_build_object('id', 'vibe-session', 'title', 'Vibe-сессия', 'pitch', 'Аудит бизнеса, цифровой план, ответы на вопросы.', 'cta', 'Разобрать'),
            jsonb_build_object('id', 'maintenance', 'title', 'Сопровождение', 'pitch', 'Регулярная подстройка, апдейты, новые фичи.', 'cta', 'Подписаться')
          ),
          'onboardingChecklist', jsonb_build_array(
            jsonb_build_object('title', 'Знакомство и аудит', 'text', 'Рассказываешь про бизнес, показываешь текущие процессы, боли и желаемый результат.', 'icon', 'message-circle'),
            jsonb_build_object('title', 'Проектирование', 'text', 'Рисуем структуру экипажа: каталог, роли, документы, цены.', 'icon', 'clipboard-check'),
            jsonb_build_object('title', 'Запуск', 'text', 'Поднимаю витрину, добавляю товары, настраиваю брендинг, подключаю админа.', 'icon', 'rocket'),
            jsonb_build_object('title', 'Обучение и передача', 'text', 'Провожу сессию с локальным админом, передаю управление.', 'icon', 'shield-check')
          ),
          'onboardingReadinessRows', jsonb_build_array(
            jsonb_build_object('label', 'Продукт', 'text', 'Что продаёте / сдаёте / предлагаете'),
            jsonb_build_object('label', 'Процессы', 'text', 'Как сейчас принимаете заказы и ведёте учёт'),
            jsonb_build_object('label', 'Команда', 'text', 'Кто будет админом экипажа'),
            jsonb_build_object('label', 'Готовность', 'text', 'Насколько срочно нужен запуск')
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Vibe Sessions', 'Crew Setup', 'Education'),
          'quickLinks', jsonb_build_array('Создать экипаж', 'Vibe-сессия', 'Обучение админа', 'Сопровождение'),
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', 'vibe-2026', 'text', 'Vibe-сессия: разберём твой бизнес за 1-2 часа онлайн. Аудит, план, первые шаги.', 'href', '/franchize/sly13#category-vibe-sessions'),
            jsonb_build_object('id', 'crew-setup', 'text', 'Создание экипажа под ключ: витрина, каталог, админка, бот, аналитика за 1-2 дня.', 'href', '/franchize/sly13#category-crew-setup')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object(
              'id', 'focus13-2026',
              'title', 'FOCUS13',
              'subtitle', 'Скидка на первый запуск экипажа',
              'code', 'FOCUS13',
              'activeFrom', '2026-01-01',
              'activeTo', '2026-12-31',
              'priority', 90,
              'ctaLabel', 'Забрать'
            )
          ),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', true,
          'promoPlaceholder', 'Введите промокод',
          'deliveryModes', jsonb_build_array('online', 'hybrid'),
          'defaultMode', 'online',
          'paymentOptions', jsonb_build_array('telegram_xtr', 'card', 'sbp'),
          'consentText', 'Согласен на обработку данных и условия предоставления услуг.'
        ),
        'contractDefaults', jsonb_build_object(
          'issuerName', 'SLY13 CYBERVIBE',
          'issuerRepresentative', '@SALAVEY13',
          'returnAddress', 'Онлайн / Telegram @SALAVEY13',
          'contractType', 'service',
          'templateFields', jsonb_build_object(
            'renter_passport', jsonb_build_object('description', 'Паспорт', 'source', 'renter_profile.passport', 'required', false),
            'issuer_representative', jsonb_build_object('description', 'Представитель', 'source', 'contractDefaults.issuerRepresentative', 'required', true, 'default', '@SALAVEY13')
          ),
          'defaults', jsonb_build_object(
            'issuer_representative', '@SALAVEY13'
          )
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
    || jsonb_build_object('is_provider', true)
    || jsonb_build_object('provider_type', 'crew_creator')
    || jsonb_build_object('rating', 5)
    || jsonb_build_object('forceDarkMode', true)
where c.slug = 'sly13';

-- 4) Private crew secrets
insert into private.crew_secrets (
  crew_slug,
  contract_defaults,
  updated_at
)
select
  'sly13',
  (metadata->'franchize'->'contractDefaults')::text,
  now()
from public.crews
where slug = 'sly13'
on conflict (crew_slug) do update
set
  contract_defaults = excluded.contract_defaults,
  updated_at = now();

-- 5) Stage 3: enrich contract_defaults with organization/bank details
--    Demo values for sly13 (service/consulting crew) — replace with real data when going live
update private.crew_secrets
set
  contract_defaults = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        coalesce(contract_defaults::jsonb, '{}'::jsonb),
                        '{organizationName}', '"SLY13 CYBERVIBE"'
                      ),
                      '{organizationShort}', '"SLY13"'
                    ),
                    '{organizationRepresentative}', '"@SALAVEY13"'
                  ),
                  '{ogrnip}', '"318527500042178"' -- demo OGRNIP (ИП Салавев)
                ),
                '{inn}', '"525813643088"' -- demo INN
              ),
              '{bankAccount}', '"40802810555510012345"' -- demo расчётный счёт
            ),
            '{bankName}', '"АО Т-Банк"' -- demo банк
          ),
          '{bankCorrAccount}', '"30101810545250000974"' -- demo кор. счёт
        ),
        '{bankCity}', '"г. Москва"'
      ),
      '{email}', '"salavey13@yandex.ru"'
    ),
    '{legalAddress}', '"г. Москва, ул. Ленина, д. 1, офис 42 (демо)"'
  ),
  updated_at = now()
where crew_slug = 'sly13';

commit;

-- Verification helpers
-- select slug, metadata->'franchize'->'theme'->>'displayName' as theme from public.crews where slug='sly13';
-- select jsonb_pretty(metadata->'franchize'->'branding') from public.crews where slug='sly13';
-- select jsonb_pretty(metadata->'franchize'->'contentBlocks'->'salesVerticals') from public.crews where slug='sly13';
-- select jsonb_pretty((select contract_defaults::jsonb from private.crew_secrets where crew_slug='sly13'));
