-- /docs/sql/nnvolt-hydration.sql
-- NN Volt hydration reference payload
-- Purpose: production-like seed for an electrical contractor crew
-- Safe to re-run: uses ON CONFLICT + jsonb_set + private upsert
-- Updated: 2024-05-20 — Black/Yellow (Dark) / Blue/White (Light) palette for electricians

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
  'a1b2c3d4-e5f6-7890-1234-567890abcdef', -- Сгенерированный UUID для NN Volt
  'NN Volt',
  'Профессиональный электромонтаж в новостройках, соцобъектах и на промышленных объектах. Работаем с высоким напряжением.',
  '', -- URL логотипа пока пустой
  '6216799537',
  'nnvolt',
  null, -- Координат нет, так как выездная бригада
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

-- 2) Canonical metadata payload
update public.crews c
set
  metadata = jsonb_set(
    coalesce(c.metadata, '{}'::jsonb),
    '{franchize}',
    (
      jsonb_build_object(
        'version', '2024-05-20-v1',
        'enabled', true,
        'slug', 'nnvolt',
        'branding', jsonb_build_object(
          'name', 'NN VOLT',
          'shortName', 'NN Volt',
          'tagline', 'Электромонтаж под ключ. Безопасно. Надежно. По ГОСТу.',
          'logoUrl', '',
          'heroImageUrl', '',
          'centerLogoInHeader', true,
          'fonts', jsonb_build_object(
            'headings', 'Archivo Black, sans-serif',
            'body', 'Onest, sans-serif',
            'technical', 'Orbitron, sans-serif',
            'accent', 'Comic Neue, cursive'
          )
        ),
        'theme', jsonb_build_object(
          'mode', 'auto',
          'displayName', 'NN VOLT - Electric Yellow / Blue',
          'palette', jsonb_build_object(
            'bgBase', '#0A0A0A',
            'bgCard', '#1A1A1A',
            'accentMain', '#FACC15', -- Электрический желтый
            'accentMainHover', '#EAB308',
            'textPrimary', '#FFFAF0',
            'textSecondary', '#A1A1AA',
            'borderSoft', '#2A2A2A'
          ),
          'palettes', jsonb_build_object(
            'dark', jsonb_build_object(
              'bgBase', '#0A0A0A',
              'bgCard', '#1A1A1A',
              'accentMain', '#FACC15',
              'accentMainHover', '#EAB308',
              'textPrimary', '#FFFAF0',
              'textSecondary', '#A1A1AA',
              'borderSoft', '#2A2A2A'
            ),
            'light', jsonb_build_object(
              'bgBase', '#FAFAFA',
              'bgCard', '#FFFFFF',
              'accentMain', '#2563EB', -- Электрический синий для светлой темы
              'accentMainHover', '#1D4ED8',
              'textPrimary', '#1A1A1A',
              'textSecondary', '#4A4A4A',
              'borderSoft', '#E5E7EB'
            )
          ),
          'radius', jsonb_build_object('card', 16, 'button', 14, 'pill', 999, 'sm', 10, 'md', 14, 'lg', 18, 'hero', 28),
          'spacing', jsonb_build_object('section', 24, 'card', 14, 'stackSm', 12, 'stackMd', 16, 'stackLg', 24),
          'effects', jsonb_build_object('accentGlow', true, 'cardLift', true)
        ),
        'header', jsonb_build_object(
          'showBackButton', false,
          'title', 'NN VOLT',
          'subtitle', 'Профессиональная электромонтажная бригада',
          'logoHref', '/',
          'menuLinks', jsonb_build_array(
            jsonb_build_object('label', 'Услуги', 'href', '/franchize/{slug}#services'),
            jsonb_build_object('label', 'Портфолио', 'href', '/franchize/{slug}#portfolio'),
            jsonb_build_object('label', 'Наша бригада', 'href', '/franchize/{slug}#team'),
            jsonb_build_object('label', 'Этапы работ', 'href', '/franchize/{slug}#steps'),
            jsonb_build_object('label', 'FAQ', 'href', '/franchize/{slug}#faq'),
            jsonb_build_object('label', 'Контакты', 'href', '/franchize/{slug}#contacts')
          ),
          'quickActions', jsonb_build_array(
            jsonb_build_object('label', 'Вызвать электрика', 'href', '/franchize/{slug}#contacts', 'icon', 'FaBolt')
          )
        ),
        'footer', jsonb_build_object(
          'textColor', '#16130A',
          'columns', jsonb_build_array(
            jsonb_build_object(
              'title', 'NN VOLT',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'text', 'value', 'Профессиональный электромонтаж в новостройках, соцобъектах и на промышленных объектах. Работаем с высоким напряжением.')
              )
            ),
            jsonb_build_object(
              'title', 'РАЗДЕЛЫ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'link', 'label', 'Услуги', 'href', '/franchize/{slug}#services', 'icon', 'FaBolt'),
                jsonb_build_object('type', 'link', 'label', 'Портфолио', 'href', '/franchize/{slug}#portfolio', 'icon', 'FaImages'),
                jsonb_build_object('type', 'link', 'label', 'Бригада', 'href', '/franchize/{slug}#team', 'icon', 'FaUsersViewfinder'),
                jsonb_build_object('type', 'link', 'label', 'Контакты', 'href', '/franchize/{slug}#contacts', 'icon', 'FaPhone')
              )
            ),
            jsonb_build_object(
              'title', 'СОЦСЕТИ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', 'Telegram', 'href', 'https://t.me/nnvolt', 'icon', 'FaTelegram'),
                jsonb_build_object('type', 'external', 'label', 'WhatsApp', 'href', 'https://wa.me/79990000000', 'icon', 'FaWhatsapp')
              )
            ),
            jsonb_build_object(
              'title', 'СВЯЗЬ',
              'items', jsonb_build_array(
                jsonb_build_object('type', 'external', 'label', '@nnvolt', 'href', 'https://t.me/nnvolt', 'icon', 'FaTelegram'),
                jsonb_build_object('type', 'phone', 'label', '+7 929 042 04-20', 'href', 'tel:+79290420420', 'icon', 'FaPhone'),
                jsonb_build_object('type', 'text', 'label', 'Выезд по всему городу и области', 'icon', 'FaMapLocationDot')
              )
            )
          ),
          'copyrightTemplate', '© {{year}} NN VOLT',
          'poweredBy', jsonb_build_object('label', 'oneSitePls', 'href', 'https://t.me/oneSitePlsBot', 'signature', '@SALAVEY13')
        ),
        'about', jsonb_build_object(
          'heroTitle', 'NN VOLT — Профессиональный электромонтаж любой сложности',
          'heroSubtitle', 'Новостройки, школы, больницы, промышленные объекты. Гарантия качества.',
          'features', jsonb_build_array(
            'Опыт работы с ВН до 10кВ',
            'Соблюдение ПУЭ и СНиП',
            'Бригада из 5 сертифицированных специалистов'
          ),
          'faq', jsonb_build_array(
            jsonb_build_object('q', 'Вы работаете с юридическими лицами?', 'a', 'Да, мы заключаем договор подряда с организациями и предоставляем все закрывающие документы.'),
            jsonb_build_object('q', 'Делаете ли вы электромонтаж в новостройках под ключ?', 'a', 'Да, мы выполняем полный цикл работ от проектирования до сборки щитка и розеток в новостройках.'),
            jsonb_build_object('q', 'Какие гарантии вы даете?', 'a', 'Мы предоставляем гарантию 3 года на все выполненные монтажные работы.'),
            jsonb_build_object('q', 'Вы работаете с высоким напряжением?', 'a', 'Да, у нас есть соответствующие допуски для работы с кабелями высокого напряжения на промышленных и социальных объектах.')
          )
        ),
        'contacts', jsonb_build_object(
          'address', 'Выезд по всему городу и области',
          'phone', '+7 929 042-04-20',
          'email', 'info@nnvolt.ru',
          'telegram', '@nnvolt',
          'workingHours', '08:00 - 20:00 (Пн-Сб)'
        ),
        'contentBlocks', jsonb_build_object(
          'serviceVerticals', jsonb_build_array(
            jsonb_build_object('id', 'new-buildings', 'title', 'Новостройки и квартиры', 'pitch', 'Полный электромонтаж в новостройках под ключ: от щитка до розеток.', 'cta', 'Заказать'),
            jsonb_build_object('id', 'social', 'title', 'Школы и садики', 'pitch', 'Безопасный электромонтаж для социальных объектов с соблюдением всех норм.', 'cta', 'Обсудить'),
            jsonb_build_object('id', 'medical', 'title', 'Больницы', 'pitch', 'Надежные электрические сети для медицинских учреждений, включая резервные источники.', 'cta', 'Запросить смету'),
            jsonb_build_object('id', 'high-voltage', 'title', 'Высокое напряжение', 'pitch', 'Работа с кабелем высокого напряжения на промышленных объектах.', 'cta', 'Связаться')
          ),
          'teamMembers', jsonb_build_array(
            jsonb_build_object('name', 'Электрик 1', 'role', 'Бригадир, электромонтажник 5 разряда', 'perk', 'Допуск к работам до 1000В', 'photoUrl', ''),
            jsonb_build_object('name', 'Электрик 2', 'role', 'Электромонтажник 4 разряда', 'perk', 'Слаботочные сети', 'photoUrl', ''),
            jsonb_build_object('name', 'Электрик 3', 'role', 'Электромонтажник 4 разряда', 'perk', 'Сборка электрощитов', 'photoUrl', ''),
            jsonb_build_object('name', 'Электрик 4', 'role', 'Электромонтажник 3 разряда', 'perk', 'Штробление и прокладка', 'photoUrl', ''),
            jsonb_build_object('name', 'Электрик 5', 'role', 'Помощник бригадира', 'perk', 'Контроль качества', 'photoUrl', '')
          ),
          'aboutWorkSteps', jsonb_build_array(
            jsonb_build_object('title', 'Заявка и выезд', 'text', 'Свяжитесь с нами. Бригадир выезжает на объект для замеров и составления точной сметы.'),
            jsonb_build_object('title', 'Договор и закупка', 'text', 'Заключаем договор подряда, согласовываем материалы и закупаем оборудование у проверенных поставщиков.'),
            jsonb_build_object('title', 'Монтажные работы', 'text', 'Прокладка кабеля, установка щитков, розеток, освещения. Строгое соблюдение техники безопасности.'),
            jsonb_build_object('title', 'Сдача и гарантия', 'text', 'Проверка работы всех систем, инструктаж заказчика и подписание акта сдачи-приемки с гарантией.')
          )
        ),
        'catalog', jsonb_build_object(
          'groupOrder', jsonb_build_array('Новостройки', 'Социальные объекты', 'Промышленность', 'Высокое напряжение'),
          'quickLinks', jsonb_build_array('Новостройки', 'Школы', 'Высоковольтные линии'),
          'tickerItems', jsonb_build_array(),
          'showTwoColumnsMobile', true,
          'useModalDetails', true,
          'promoBanners', jsonb_build_array(),
          'adCards', jsonb_build_array(),
          'floatingCart', jsonb_build_object('showOn', jsonb_build_array('catalog', 'about', 'contacts', 'order'), 'showScrollTopButton', true)
        ),
        'order', jsonb_build_object(
          'allowPromo', false,
          'deliveryModes', jsonb_build_array('pickup', 'delivery'),
          'defaultMode', 'pickup',
          'paymentOptions', jsonb_build_array('card', 'sbp', 'cash', 'invoice'),
          'consentText', 'Я согласен с условиями обработки персональных данных.'
        ),
        'contractDefaults', jsonb_build_object(
          'issuerName', '',
          'issuerRepresentative', '',
          'returnAddress', '',
          'templateFields', jsonb_build_object(),
          'defaults', jsonb_build_object()
        )
      )
    ),
    true
  ),
  updated_at = now()
where c.slug = 'nnvolt';

-- 3) Legacy top-level metadata
update public.crews c
set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object('slug', 'nnvolt')
    || jsonb_build_object('is_provider', true)
    || jsonb_build_object('provider_type', 'electro_service')
    || jsonb_build_object('rating', 5)
    || jsonb_build_object(
      'contacts',
      jsonb_build_object(
        'primary_phone', '+7 999 000-00-00',
        'working_hours', '08:00 - 20:00 (Пн-Сб)',
        'manager_sales', '@nnvolt',
        'manager_support', '@nnvolt'
      )
    )
where c.slug = 'nnvolt';

-- 4) ★ Stage 2 extraction: move contractDefaults into private.crew_secrets
insert into private.crew_secrets (
  crew_slug,
  contract_defaults,
  updated_at
)
select
  'nnvolt',
  (metadata->'franchize'->'contractDefaults')::text,
  now()
from public.crews
where slug = 'nnvolt'
on conflict (crew_slug) do update
set
  contract_defaults = excluded.contract_defaults,
  updated_at = now();

-- 5) ★ Stage 3: enrich contract_defaults with organization/bank details (Left empty)
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
                        '{organizationName}', '""'
                      ),
                      '{organizationShort}', '""'
                    ),
                    '{organizationRepresentative}', '""'
                  ),
                  '{ogrnip}', '""'
                ),
                '{inn}', '""'
              ),
              '{bankAccount}', '""'
            ),
            '{bankName}', '""'
          ),
          '{bankCorrAccount}', '""'
        ),
        '{bankCity}', '""'
      ),
      '{email}', '""'
    ),
    '{legalAddress}', '""'
  ),
  updated_at = now()
where crew_slug = 'nnvolt';

commit;

-- Verification helpers
-- select slug, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug='nnvolt';
-- select jsonb_pretty(metadata->'franchize'->'theme'->'palettes'->'light') from public.crews where slug='nnvolt';
-- select jsonb_pretty((select contract_defaults::jsonb from private.crew_secrets where crew_slug='nnvolt')) as private_contract_defaults;
