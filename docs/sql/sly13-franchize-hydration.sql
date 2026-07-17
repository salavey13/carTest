-- /docs/sql/sly13-franchize-hydration.sql
-- SLY13 CYBERVIBE Franchize hydration reference payload (2026 edition)
-- Purpose: production-grade sly13 seed for THIS project (carTest): personal/operator brand, codex-first workflows, and franchize-maker playbook metadata
-- Safe to re-run: ON CONFLICT + jsonb_set + private upsert
-- Updated: 2026-05-09 v5 — full polish, dark cyber aesthetic 🕶️

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
  'AI-оператор, практик сервисного продакта и коуч. Помогаю запускать продукты, прокачивать навыки и думать быстрее с помощью AI.',
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
        'version', '2026-05-09-v5-dark',
        'enabled', true,
        'slug', 'sly13',
        'branding', jsonb_build_object(
          'name', 'SLY13 CYBERVIBE',
          'shortName', 'SLY13',
          'tagline', 'AI как ко-пилот. От идеи до боевого продукта за дни, а не месяцы.',
          'logoUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif',
          'heroImageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg',
          'centerLogoInHeader', true
        ),
        'theme', jsonb_build_object(
          'mode', 'cyberdawn_dark',
          'palette', jsonb_build_object(
            'bgBase', '#0A0F1C',
            'bgCard', '#111827',
            'bgElevated', '#1A2338',
            'borderSoft', '#334155',
            'borderCard', '#475569',
            'accentMain', '#22D3EE',
            'accentMainHover', '#67E8F9',
            'accentDeep', '#0891B2',
            'accentTextOn', '#0F172A',
            'textPrimary', '#F1F5F9',
            'textSecondary', '#94A3B8',
            'textMuted', '#64748B',
            'textAccent', '#22D3EE',
            'success', '#4ADE80',
            'warning', '#FACC15',
            'error', '#F87171'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0A0F1C',
              'bgCard', '#111827',
              'accentMain', '#22D3EE',
              'accentMainHover', '#67E8F9',
              'textPrimary', '#F1F5F9',
              'textSecondary', '#94A3B8',
              'borderSoft', '#334155'
            ),
            'light', jsonb_build_object(
              'bgBase', '#F8FAFC',
              'bgCard', '#FFFFFF',
              'accentMain', '#22D3EE',
              'accentMainHover', '#67E8F9',
              'textPrimary', '#0F172A',
              'textSecondary', '#475569',
              'borderSoft', '#E2E8F0'
            )
          ),
          'radius', jsonb_build_object('card', 18, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'SLY13 CYBERVIBE',
          'subtitle', 'AI × Продукт × Прокачка',
          'logoHref', '/sly13',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Каталог', 'href', '/franchize/{slug}'),
            jsonb_build_object('label', 'О нас', 'href', '/franchize/{slug}/about'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}/contacts'),
            jsonb_build_object('label', 'Корзина', 'href', '/franchize/{slug}/cart'),
            jsonb_build_object('label', 'Мои сессии', 'href', '/franchize/{slug}/rentals'),
            jsonb_build_object('label', 'Сообщество', 'href', '/franchize/{slug}/community'),
            jsonb_build_object('label', 'Партнёрам', 'href', '/franchize/{slug}/onboarding')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'CyberVIBE', 'href', '/franchize/{slug}', 'icon', 'FaBolt'),
            jsonb_build_object('label', 'Записаться', 'href', '/franchize/{slug}/contacts', 'icon', 'FaTelegram')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#F1F5F9',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'SLY13 CYBERVIBE',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'AI-оператор и практик сервисного продакта. Делаю запуск проще.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Каталог', 'href', '/franchize/{slug}', 'icon', 'FaBolt'),
                jsonb_build_object('type', 'link', 'label', 'О нас', 'href', '/franchize/{slug}/about', 'icon', 'FaCircleInfo'),
                jsonb_build_object('type', 'link', 'label', 'Сообщество', 'href', '/franchize/{slug}/community', 'icon', 'FaUsers'),
                jsonb_build_object('type', 'link', 'label', 'Партнёрам', 'href', '/franchize/{slug}/onboarding', 'icon', 'FaHandshake')
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
          'heroTitle', 'SLY13 — твой AI-ко-пилот в реальном мире',
          'heroSubtitle', 'Запускаю продукты, прокачиваю навыки и помогаю думать на следующем уровне.',
          'features', jsonb_build_array(
            'AI как настоящий teammate',
            'От идеи до рабочего продукта за дни',
            'Гибрид онлайн + оффлайн форматы',
            'Практика, а не теория'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Для кого это?', 'a', 'Для основателей, продактов, разработчиков и всех, кто хочет быстрее запускать.'),
            jsonb_build_object('q', 'Как проходит работа?', 'a', 'Через Telegram + веб. Максимум контекста, минимум бюрократии.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Онлайн / Нижний Новгород',
          'phone', '',
          'email', '',
          'telegram', '@SALAVEY13',
          'telegramBotUsername', 'oneBikePlsBot',
          'workingHours', 'По договорённости',
          'map', jsonb_build_object(
            'imageUrl', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg',
            'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12),
            'gps', '56.3269,44.0059',
            'publicTransport', 'Основной формат — онлайн',
            'carDirections', 'Оффлайн встречи по договорённости'
          )
        ),
        'contentBlocks', jsonb_build_object(
          'communityEvents', jsonb_build_array(
            jsonb_build_object('title', 'CyberVIBE разбор недели', 'time', 'Ср • 20:00', 'place', 'Telegram', 'text', 'Разбираем идеи, промпты и следующие шаги вживую.'),
            jsonb_build_object('title', 'Snowboard video review', 'time', 'Сб • 11:00', 'place', 'Склон / онлайн', 'text', 'Разбор техники по видео.'),
            jsonb_build_object('title', 'Dota2 micro-coaching', 'time', 'Вс • 18:00', 'place', 'Discord', 'text', 'Разбор реплеев без токсичности.')
          ),
          'partnerCards', jsonb_build_array(
            jsonb_build_object('name', 'oneSitePls', 'role', 'платформа', 'perk', 'Быстрый запуск Telegram-first продуктов'),
            jsonb_build_object('name', 'CyberVIBE Labs', 'role', 'AI практика', 'perk', 'Глубокие рабочие сессии'),
            jsonb_build_object('name', 'SLY13 Coaching', 'role', 'спорт & игры', 'perk', 'Прокачка без выгорания')
          ),
          'cityRiderTips', jsonb_build_array(
            'Собирай контекст перед сессией — AI любит плотный input.',
            'Делай один маленький шаг сразу после разбора.',
            'Фиксируй промпты, которые сработали.',
            'Не бойся показывать "сырое" — лучше быстро и живое.'
          ),
          'salesVerticals', jsonb_build_array(
            jsonb_build_object('id', 'new', 'title', 'CyberVIBE Запуск', 'pitch', 'От идеи до первого работающего продукта.', 'cta', 'Запустить'),
            jsonb_build_object('id', 'electric', 'title', 'AI Workflow Custom', 'pitch', 'Соберём твой личный AI-флоу.', 'cta', 'Собрать'),
            jsonb_build_object('id', 'used', 'title', 'Разбор проекта', 'pitch', 'Диагностика и апгрейд текущего продукта.', 'cta', 'Разобрать'),
            jsonb_build_object('id', 'trade-in', 'title', 'Trade-in Хаоса', 'pitch', 'Наводим порядок в заметках и процессах.', 'cta', 'Почистить')
          ),
          'onboardingChecklist', jsonb_build_array(
            jsonb_build_object('title', 'Цель', 'text', 'Что хочешь запустить или прокачать.', 'icon', 'target'),
            jsonb_build_object('title', 'Материалы', 'text', 'Ссылки, текущий контекст, боли.', 'icon', 'folder'),
            jsonb_build_object('title', 'Формат', 'text', 'Онлайн / гибрид / интенсив.', 'icon', 'calendar'),
            jsonb_build_object('title', 'Первый шаг', 'text', 'Короткий пилот и быстрый фидбек.', 'icon', 'rocket')
          ),
          'onboardingReadinessRows', jsonb_build_array(
            jsonb_build_object('label', 'Оффер', 'text', 'Что продаём и кому'),
            jsonb_build_object('label', 'Контекст', 'text', 'Материалы и текущая ситуация'),
            jsonb_build_object('label', 'Процесс', 'text', 'Как будем работать'),
            jsonb_build_object('label', 'Результат', 'text', 'Что считаем успехом')
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('CyberVIBE', 'Snowboard', 'Dota2', 'Labs'),
          'quickLinks', jsonb_build_array('CyberVIBE', 'Snowboard', 'Dota2', 'Labs'),
          'tickerItems', jsonb_build_array(
            jsonb_build_object('id', 'cyber-sprint-2026', 'text', 'CyberVIBE Sprint 2026 — запуск франшиз-мейкеров через Codex + Supabase + Telegram', 'href', '/franchize/sly13#category-cybervibe'),
            jsonb_build_object('id', 'ai-workflow', 'text', 'Соберём твой личный AI-флоу за одну сессию', 'href', '/franchize/sly13')
          ),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(
            jsonb_build_object(
              'id', 'focus13-2026',
              'title', 'FOCUS13',
              'subtitle', 'Скидка на первый глубокий разбор',
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
    || jsonb_build_object('provider_type', 'ai_product_operator')
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
                  '{ogrnip}', '"318527500042178"' -- demo OGRNIP (ИП Салaвеv)
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
-- select slug, metadata->'franchize'->'theme'->>'mode' as theme_mode from public.crews where slug='sly13';
-- select jsonb_pretty(metadata->'franchize'->'branding') from public.crews where slug='sly13';
-- select jsonb_pretty((select contract_defaults::jsonb from private.crew_secrets where crew_slug='sly13'));
