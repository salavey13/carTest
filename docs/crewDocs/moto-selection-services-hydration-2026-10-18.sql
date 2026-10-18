-- /docs/crewDocs/moto-selection-services-hydration-2026-10-18.sql
-- Task (boss 2026-10-18) — moto-selection becomes a REAL franchize crew:
--
--   1) contacts: telegram = @romani14 (the owner's own TG from moto-selection.ru);
--   2) winter storage ENABLED for moto-selection, parallel to vip-bike —
--      resolveStorageConfig gates per-crew (storage_bikes rows are keyed by
--      crew_slug, wall/checkout/notify all resolve the crew by slug), so the
--      two crews' seasons never touch; explicit block (no legacy-slug ride);
--   3) contentBlocks: moto-flavored aboutCapabilities + aboutWorkSteps — the
--      app's DEFAULT blocks are now vip-bike-gated (content-blocks.ts), so a
--      crew without its own copy shows NO generic «Выберите байк» sections;
--   4) about.heroTitle tail without the brand (the about page composes
--      «BRAND: <heroTitle>» — the old value would read «MOTO SELECTION:
--      Moto Selection — …»);
--   5) catalog services as public.cars rows type='service' — the SAME shape
--      vip-bike uses (specs.service=true, subtype='service') so the
--      «Услуги» rail pill, the service display mode, the cart and the
--      service-order checkout all work with zero code changes. Titles keep
--      make='' so the card reads «Обучение вождению с нуля», not
--      «MOTO_SELECTION Обучение вождению с нуля».
--
-- Idempotent (jsonb_set + ON CONFLICT), safe to re-run. Follows the
-- canonical crewDocs pattern (network-services-hydration-2026-10-14.sql).
--
-- v4 (2026-10-18 review hardening; v3 values were applied live the same day):
--   • crew_id resolved via (select id from crews where slug=…) — no uuid
--     literals that break on a fresh environment;
--   • storage block set KEY-BY-KEY (jsonb_set per path) instead of replacing
--     the whole '{franchize,storage}' object — a re-run can no longer wipe
--     keys added later via the owner config editor (address, careDuties, …);
--   • version stamp bumped to 2026-10-18-v4.

begin;

-- ── 1) metadata enrichment ──────────────────────────────────────────────────
update public.crews c
set metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                coalesce(c.metadata, '{}'::jsonb),
                '{franchize,version}',
                '"2026-10-18-v4"'::jsonb
              ),
              '{franchize,contacts,telegram}',
              '"@romani14"'::jsonb
            ),
            '{franchize,about,heroTitle}',
            '"высокое искусство мотосервиса"'::jsonb
          ),
          -- v4: storage set KEY-BY-KEY (jsonb_set creates missing parents) so
          -- a re-run never wipes keys added later via the config editor.
          '{franchize,storage,enabled}',
          'true'::jsonb
        ),
        '{franchize,storage,defaultMonthlyPriceRub}',
        '2000'::jsonb
      ),
      '{franchize,storage,seasonStart}',
      '"10-15"'::jsonb
    ),
    '{franchize,storage,seasonEnd}',
    '"06-01"'::jsonb
  ),
  jsonb_build_object(
    'aboutCapabilities', jsonb_build_array(
      jsonb_build_object('title', 'Обучение вождению с нуля', 'icon', 'bike',
        'text', 'Мото-академия: базовые и контраварийные курсы, эндуро, спорт — практика до уверенной езды в городе.'),
      jsonb_build_object('title', 'Подбор и покупка под ключ', 'icon', 'shopping-bag',
        'text', 'Проверка VIN, мониторинг рынка, осмотр любого количества вариантов и полное сопровождение сделки.'),
      jsonb_build_object('title', 'Эвакуация и перевозка 24/7', 'icon', 'map',
        'text', 'Своя оборудованная техника: сервис, ГИБДД, покупка — по городу и области в любое время.'),
      jsonb_build_object('title', 'Сервис, хранение и детейлинг', 'icon', 'wrench',
        'text', 'ТО и ремонт, тёплое зимнее хранение, полировка и защита — байк готов к каждому сезону.')
    ),
    'aboutWorkSteps', jsonb_build_array(
      jsonb_build_object('title', 'Выберите услугу',
        'text', 'Откройте каталог услуг, сравните форматы и добавьте нужную в заявку.'),
      jsonb_build_object('title', 'Подтвердите детали',
        'text', 'Оператор согласует время, место и стоимость — по телефону или в Telegram.'),
      jsonb_build_object('title', 'Приезжайте — или мы приедем',
        'text', 'Эвакуация работает 24/7: заберём мотоцикл от дома, сервиса или места сделки.'),
      jsonb_build_object('title', 'Заберите результат',
        'text', 'Закрываем работу, показываем результат и остаёмся на связи до следующего сезона.')
    )
  )
),
updated_at = now()
where c.slug = 'moto-selection';

-- ── 2) catalog services → public.cars type='service' ────────────────────────
insert into public.cars (id, crew_id, make, model, description, image_url, daily_price, type, specs, availability_rules, is_test_result)
values
  ('moto-selection-svc-01', (select id from public.crews where slug = 'moto-selection'), '',
   'Обучение вождению с нуля',
   'Мото-академия: индивидуальные занятия, базовый и контраварийный курсы, эндуро, спортивный курс, стантрадинг. Практика торможений, руления и управления в разных условиях.',
   '', null, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'rent_price_label', 'по записи'),
   '{}'::jsonb, false),
  ('moto-selection-svc-02', (select id from public.crews where slug = 'moto-selection'), '',
   'Подбор и покупка мотоцикла',
   'Комплексный подбор: проверка юридической чистоты VIN, мониторинг предложений по Нижнему и области, осмотр любого количества вариантов, полное сопровождение сделки и договор купли-продажи.',
   '', 25000, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'dailyPrice', 25000),
   '{}'::jsonb, false),
  ('moto-selection-svc-03', (select id from public.crews where slug = 'moto-selection'), '',
   'Эвакуация и перевозка',
   'Перевозим на своей оборудованной технике. Сопровождение в сервис / ГИБДД / при покупке. Работаем 24/7.',
   '', 3500, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'dailyPrice', 3500),
   '{}'::jsonb, false),
  ('moto-selection-svc-04', (select id from public.crews where slug = 'moto-selection'), '',
   'Выездной осмотр перед покупкой',
   'Проверяем визуальную и техническую составляющую мотоцикла, документы и юридическую чистоту, даём рекомендации по техническому обслуживанию.',
   '', 3500, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'dailyPrice', 3500),
   '{}'::jsonb, false),
  ('moto-selection-svc-05', (select id from public.crews where slug = 'moto-selection'), '',
   'Аренда мототехники',
   'Большой выбор мототехники от 80 до 1000сс, залог от 5 000 ₽, можно арендовать экипировку, возможна долгосрочная аренда. Есть кожаный мопед :)',
   '', 4000, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'dailyPrice', 4000),
   '{}'::jsonb, false),
  ('moto-selection-svc-06', (select id from public.crews where slug = 'moto-selection'), '',
   'Зимнее хранение мототехники',
   'Тёплое хранение по всем байкерским канонам: консервация, контроль состояния, подготовка к сезону. Как байк проведёт зиму — так он поедет летом.',
   '', 2000, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'dailyPrice', 2000, 'rent_price_label', '2 000 ₽/мес'),
   '{}'::jsonb, false),
  ('moto-selection-svc-07', (select id from public.crews where slug = 'moto-selection'), '',
   'Детейлинг и кастомизация',
   'Предварительная мойка, очистка от битума/колодочной пыли/смазки цепи, полировка, оклейка плёнкой зон риска, защитные составы.',
   '', null, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'rent_price_label', 'по запросу'),
   '{}'::jsonb, false),
  ('moto-selection-svc-08', (select id from public.crews where slug = 'moto-selection'), '',
   'Техническое обслуживание и ремонт',
   'ТО и ремонт мототехники: регламентные работы, расходники, электрика, ходовая. Готовим байк к сезону и закрываем неисправности.',
   '', null, 'service',
   jsonb_build_object('service', true, 'subtype', 'service', 'rent_price_label', 'по запросу'),
   '{}'::jsonb, false)
on conflict (id) do update set
  crew_id = excluded.crew_id,
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  image_url = excluded.image_url,
  daily_price = excluded.daily_price,
  type = excluded.type,
  specs = excluded.specs,
  availability_rules = excluded.availability_rules,
  is_test_result = excluded.is_test_result;

commit;
