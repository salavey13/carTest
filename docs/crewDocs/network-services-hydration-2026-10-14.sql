-- /docs/crewDocs/network-services-hydration-2026-10-14.sql
-- Task 94 (boss 2026-10-14) — services hydration for the network's provider
-- crews + map-riders promo in the vip-bike catalog ads. Follows the canonical
-- crewDocs pattern (see vip-bike-franchize-hydration.sql): metadata-first,
-- idempotent (ON CONFLICT / jsonb_set), safe to re-run.
--
-- 1) moto-selection — NEW prefab provider crew (partner moto-selection.ru,
--    services scraped from the site 2026-10-14; owner = I_O_S_NN by default
--    until a final owner is assigned via the network-tab role manager);
-- 2) georg-electro — services for Georgiy (electro systems diagnostics,
--    controller reflashing/custom tuning, extra equipment install);
-- 3) vip-bike — catalog adCards/promoBanners/ticker: map-riders «Сеть» promo
--    + direct community wall link («прожарка» контента).
--
-- NOTE: same payload was applied live via service-role REST on 2026-10-14
-- (audit: crews.metadata.specs.owner_fix_20261014_network_services).

begin;

-- ── 1) moto-selection: crew row ─────────────────────────────────────────────
insert into public.crews (
  id, name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at
)
values (
  'ddc2eae6-f11f-420b-859b-a1cb755d777f',
  'Moto Selection',
  'Moto Selection — мото-сервис и школа Нижнего Новгорода: обучение вождению с нуля, подбор и покупка мотоцикла, эвакуация 24/7, аренда (80–1000сс), ТО и ремонт, зимнее хранение, детейлинг и кастомизация. moto-selection.ru',
  'https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png',
  '356282674', -- I_O_S_NN: prefab default owner, см. network-tab role manager
  'moto-selection',
  null,
  '{}'::jsonb,
  now(), now()
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    logo_url = excluded.logo_url,
    slug = excluded.slug,
    updated_at = now();

-- ── 1b) moto-selection: provider metadata (services with the site) ─────────
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{services}',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'ms-training', 'name', 'Обучение вождению с нуля', 'min_players', 1, 'image_url', '',
      'description', 'Мото-академия: индивидуальные занятия, базовый и контраварийный курсы, эндуро, спортивный курс, стантрадинг. Практика торможений, руления и управления в разных условиях.',
      'priceFrom', 'по записи',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-training-base', 'name', 'Базовый курс', 'includes', 'с нуля до уверенной езды в городе'),
        jsonb_build_object('id', 'ms-training-advanced', 'name', 'Контраварийный / эндуро / спорт', 'includes', 'отработка препятствий и продвинутых навыков')
      )
    ),
    jsonb_build_object(
      'id', 'ms-selection', 'name', 'Подбор и покупка мотоцикла', 'min_players', 1, 'image_url', '',
      'description', 'Комплексный подбор: проверка юридической чистоты VIN, мониторинг предложений по Нижнему и области, осмотр любого количества вариантов, полное сопровождение сделки и договор купли-продажи.',
      'priceFrom', 'от 25 000 ₽',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-selection-full', 'name', 'Комплексный подбор', 'includes', 'VIN + мониторинг + осмотры + сопровождение сделки', 'price', 25000)
      )
    ),
    jsonb_build_object(
      'id', 'ms-evacuation', 'name', 'Эвакуация и перевозка', 'min_players', 1, 'image_url', '',
      'description', 'Перевозим на своей оборудованной технике. Сопровождение в сервис / ГИБДД / при покупке. Работаем 24/7.',
      'priceFrom', 'от 3 500 ₽',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-evac-std', 'name', 'Эвакуация', 'includes', 'подача, погрузка, доставка по городу/области', 'price', 3500)
      )
    ),
    jsonb_build_object(
      'id', 'ms-inspection', 'name', 'Выездной осмотр перед покупкой', 'min_players', 1, 'image_url', '',
      'description', 'Проверяем визуальную и техническую составляющую мотоцикла, документы и юридическую чистоту, даём рекомендации по техническому обслуживанию.',
      'priceFrom', 'от 3 500 ₽',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-insp-std', 'name', 'Выездной осмотр', 'includes', 'осмотр + документы + рекомендации по ТО', 'price', 3500)
      )
    ),
    jsonb_build_object(
      'id', 'ms-rent', 'name', 'Аренда мототехники', 'min_players', 1, 'image_url', '',
      'description', 'Большой выбор мототехники от 80 до 1000сс, залог от 5 000 ₽, можно арендовать экипировку, возможна долгосрочная аренда. Есть кожаный мопед :)',
      'priceFrom', 'от 4 000 ₽',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-rent-day', 'name', 'Сутки', 'includes', 'мотоцикл 80–1000сс по выбору', 'price', 4000)
      )
    ),
    jsonb_build_object(
      'id', 'ms-storage', 'name', 'Зимнее хранение мототехники', 'min_players', 1, 'image_url', '',
      'description', 'Тёплое хранение по всем байкерским канонам: консервация, контроль состояния, подготовка к сезону. Как байк проведёт зиму — так он поедет летом.',
      'priceFrom', 'от 2 000 ₽/мес',
      'packages', jsonb_build_array(
        jsonb_build_object('id', 'ms-storage-warm', 'name', 'Тёплое хранение', 'includes', 'консервация + контроль + предсезонная подготовка', 'price', 2000)
      )
    ),
    jsonb_build_object(
      'id', 'ms-detailing', 'name', 'Детейлинг и кастомизация', 'min_players', 1, 'image_url', '',
      'description', 'Предварительная мойка, очистка от битума/колодочной пыли/смазки цепи, полировка, оклейка плёнкой зон риска, защитные составы.',
      'priceFrom', 'по запросу'
    ),
    jsonb_build_object(
      'id', 'ms-service', 'name', 'Техническое обслуживание и ремонт', 'min_players', 1, 'image_url', '',
      'description', 'ТО и ремонт мототехники: регламентные работы, расходники, электрика, ходовая. Готовим байк к сезону и закрываем неисправности.',
      'priceFrom', 'по запросу'
    )
  )
),
updated_at = now()
where c.slug = 'moto-selection';

-- 1c) moto-selection: franchize surface (branding + contacts + about, minimal)
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{franchize}',
  jsonb_build_object(
    'version', '2026-10-14-v1',
    'enabled', true,
    'slug', 'moto-selection',
    'ui', jsonb_build_object('showCreateButton', false),
    'branding', jsonb_build_object(
      'name', 'MOTO SELECTION',
      'shortName', 'Moto Selection',
      'tagline', 'Высокое искусство мотосервиса: школа, подбор, аренда, ТО, хранение, детейлинг.',
      'logoUrl', 'https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png',
      'centerLogoInHeader', true
    ),
    'theme', jsonb_build_object('mode', 'auto'),
    'contacts', jsonb_build_object(
      'address', 'Нижний Новгород',
      'phone', '+7 (987) 557-04-44',
      'email', 'moto-selection@yandex.ru',
      'workingHours', 'Ежедневно, заявки 24/7',
      'map', jsonb_build_object('gps', '')
    ),
    'about', jsonb_build_object(
      'heroTitle', 'Moto Selection — высокое искусство мотосервиса',
      'heroSubtitle', 'Начни свой путь в мир мотоциклов вместе с нами: обучение, подбор, аренда, сервис, хранение. Нижний Новгород.',
      'features', jsonb_build_array(
        'Обучение вождению с нуля (академия)',
        'Подбор и покупка под ключ, выездной осмотр',
        'Эвакуация и перевозка 24/7',
        'Аренда мототехники 80–1000сс',
        'Зимнее хранение',
        'Детейлинг и кастомизация',
        'ТО и ремонт'
      ),
      'faq', jsonb_build_array(
        jsonb_build_object('q', 'Вы только в Нижнем Новгороде?', 'a', 'Основная площадка — Нижний Новгород; также работали с клиентами из Москвы, Санкт-Петербурга, Владимира, Иваново, Краснодара и Севастополя.'),
        jsonb_build_object('q', 'Нужен ли залог для аренды?', 'a', 'Да, залог от 5 000 ₽. Экипировку можно арендовать вместе с мотоциклом, есть долгосрочная аренда.'),
        jsonb_build_object('q', 'Поможете с выбором мотоцикла?', 'a', 'Да: комплексный подбор включает проверку VIN, мониторинг рынка, осмотры и полное сопровождение сделки.')
      )
    )
  )
),
updated_at = now()
where c.slug = 'moto-selection';

-- ── 2) georg-electro: services for Georgiy (boss list, 2026-10-14) ─────────
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{services}',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'ge-diagnostics', 'name', 'Диагностика и ремонт электросистем', 'min_players', 1, 'image_url', '',
      'description', 'Поиск неисправностей и ремонт электро: проводка, контроллеры, BMS, дроссели, свет, приборка. Электрик электробайков — починим любой электромот.',
      'priceFrom', 'по запросу'
    ),
    jsonb_build_object(
      'id', 'ge-flash', 'name', 'Перепрошивка и кастомная настройка контроллеров', 'min_players', 1, 'image_url', '',
      'description', 'Прошивка и тюнинг контроллеров любых типов: кривые тока, разгонные режимы, круиз-контроль, кастомные пресеты под батарею и мотор.',
      'priceFrom', 'по запросу'
    ),
    jsonb_build_object(
      'id', 'ge-equipment', 'name', 'Установка дополнительного оборудования', 'min_players', 1, 'image_url', '',
      'description', 'Свет, сигнализация, зарядки и USB, кофры, ветровики, камеры, подогрев ручек — установим и подключим аккуратно, с гарантией на монтаж.',
      'priceFrom', 'по запросу'
    )
  )
),
updated_at = now()
where c.slug = 'georg-electro';

-- ── 3) vip-bike: catalog ads — map-riders «Сеть» promo + community link ────
update public.crews c
set metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      coalesce(c.metadata, '{}'::jsonb),
      '{franchize,catalog,adCards}',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'map-riders-card',
          'href', '/franchize/vip-bike/map-riders',
          'badge', 'Сообщество · обновлено',
          'title', 'Карта райдеров и Сеть экипажей',
          'activeTo', '2026-12-31',
          'ctaLabel', 'Открыть карту и Сеть',
          'imageUrl', '',
          'priority', 92,
          'subtitle', 'Живая карта маршрутов и вкладка «Сеть»: круги экипажей, связи райдеров и зум с деталями. Находи попутчиков и смотри, кто с кем катает.',
          'activeFrom', '2026-08-01'
        ),
        jsonb_build_object(
          'id', 'community-wall-card',
          'href', '/franchize/vip-bike/community',
          'badge', 'Прожарка',
          'title', 'Стена экипажа',
          'activeTo', '2026-12-31',
          'ctaLabel', 'Читать сообщество',
          'imageUrl', '',
          'priority', 86,
          'subtitle', 'Посты, отчёты о заездах и встречи райдеров — прямая ссылка на сообщество. Публикуй, собирай лайки, подогревай движ.',
          'activeFrom', '2026-10-14'
        ),
        jsonb_build_object(
          'id', 'configurator-card',
          'href', '/franchize/vip-bike/configurator',
          'badge', 'Популярное',
          'title', 'Конфигуратор электробайка',
          'activeTo', '2026-12-31',
          'ctaLabel', 'Собрать байк',
          'imageUrl', '',
          'priority', 90,
          'subtitle', 'Соберите свой VipBike: мотор, батарея, цвет, аксессуары — мгновенный расчёт цены',
          'activeFrom', '2026-08-01'
        )
      )
    ),
    '{franchize,catalog,promoBanners}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'map-riders-network',
        'code', 'NETWORK2026',
        'title', 'Map-Riders: карта, маршруты и Сеть экипажей — всё в одном месте',
        'activeTo', '2026-12-31',
        'ctaLabel', 'Открыть карту',
        'priority', 88,
        'subtitle', 'Живые точки на карте, круги экипажей и связи райдеров во вкладке «Сеть» — приближай и смотри детали. Делись маршрутами и собирай экипаж.',
        'activeFrom', '2026-10-14'
      ),
      jsonb_build_object(
        'id', 'harley-livewire',
        'code', 'LIVEWIRE2026',
        'title', 'Harley-Davidson LiveWire ONE — ноль до сотни за 3 секунды',
        'activeTo', '2026-12-31',
        'ctaLabel', 'Подробнее',
        'priority', 95,
        'subtitle', 'Полностью электрический. Категория А. Запас хода 235 км по городу. Быстрая зарядка DC за 40 минут.',
        'activeFrom', '2026-08-01'
      )
    )
  ),
  '{franchize,catalog,tickerItems}',
  jsonb_build_array(
    jsonb_build_object('id', 'electro-main', 'href', '/franchize/vip-bike#catalog', 'text', '79bike Falcon PRO: электромотоцикл без категории А от 310 000 ₽'),
    jsonb_build_object('id', 'test-drive', 'href', '/franchize/vip-bike#test-drive', 'text', 'Тест-драйв в шоуруме: протестируйте электро перед покупкой'),
    jsonb_build_object('id', 'no-osago', 'href', '/franchize/vip-bike/electro-enduro', 'text', 'Законно без ОСАГО и ПТС по правам категории B'),
    jsonb_build_object('id', 'network-tab', 'href', '/franchize/vip-bike/map-riders', 'text', 'Сеть экипажей на карте: круги команд, связи райдеров и зум до деталей')
  )
),
updated_at = now()
where c.slug = 'vip-bike';

commit;
