-- /docs/crewDocs/task207-renta-flat-demo-crew-2026-11-23.sql
-- Task 207 (босс: «add more cars to renta-car crew, and create demo crew
-- with 5 item catalogue set for "аренда квартир" theme»).
-- Sections:
--   1) renta-car +4 позиции (Vesta SW Cross, Rio X-Line, Logan Stepway,
--      Camry 2.5 AT бизнес) — tier-прайсы как у существующих; фото уже
--      в carpix/{id}.jpg (scripts/task207/upload_photos.py).
--   2) renta-flat — ДЕМО-экипаж вертикали «аренда квартир»: crews upsert +
--      franchize metadata (emerald-палитра) + 5 позиций (студия/1к/2к/2к
--      евро/пентхаус-лофт) + лого about/renta-flat-logo.png.
-- Safe to re-run: on conflict upserts. Owner: salavey13 (413553377).
-- Отличие от зелёных (task200): вертикаль flat_rental, хранение НЕ услуга,
-- телефон демо +7 900 000-00-00 с пометкой «(демо)».

begin;

-- ────────────────────────────────────────────────  renta-car +4 позиции
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-vesta', 'Лада', 'Веста SW Cross',
  'Лада Веста SW Cross, универсал, вариатор. Тарифы: 1–3 дня 3 000 ₽/сут, 4–7 дней 2 900 ₽/сут, 8–30 дней 2 800 ₽/сут, уикэнд 8 400 ₽. Залог 5 000 ₽.',
  3000, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-vesta.jpg', '', false,
  '{"category": "econom", "deposit": "5000 ₽", "doors": "5", "gearbox": "Вариатор", "tiers": {"1-3 дня": 3000, "4-7 дней": 2900, "8-30 дней": 2800, "Уикэнд": 8400}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-rio', 'KIA', 'Rio X-Line',
  'KIA Rio X-Line, кросс-хэтч, автомат. Тарифы: 1–3 дня 2 800 ₽/сут, 4–7 дней 2 700 ₽/сут, 8–30 дней 2 600 ₽/сут, уикэнд 7 800 ₽. Залог 5 000 ₽.',
  2800, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rio.jpg', '', false,
  '{"category": "econom", "deposit": "5000 ₽", "doors": "5", "gearbox": "Автомат", "tiers": {"1-3 дня": 2800, "4-7 дней": 2700, "8-30 дней": 2600, "Уикэнд": 7800}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-logan', 'Renault', 'Logan Stepway',
  'Renault Logan Stepway City, седан с клиренсом кросса, механика. Тарифы: 1–3 дня 2 400 ₽/сут, 4–7 дней 2 300 ₽/сут, 8–30 дней 2 200 ₽/сут, уикэнд 6 600 ₽. Залог 5 000 ₽.',
  2400, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-logan.jpg', '', false,
  '{"category": "econom", "deposit": "5000 ₽", "doors": "4", "gearbox": "Механика", "tiers": {"1-3 дня": 2400, "4-7 дней": 2300, "8-30 дней": 2200, "Уикэнд": 6600}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-camry70', 'Toyota', 'Camry 2.5 AT (бизнес)',
  'Toyota Camry 2.5 AT, бизнес-класс, кожа, климат-контроль. Тарифы: 1–3 дня 5 500 ₽/сут, 4–7 дней 5 200 ₽/сут, 8–30 дней 4 800 ₽/сут, уикэнд 14 500 ₽. Залог 10 000 ₽.',
  5500, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-camry70.jpg', '', false,
  '{"category": "comfort", "deposit": "10000 ₽", "doors": "4", "gearbox": "Автомат", "tiers": {"1-3 дня": 5500, "4-7 дней": 5200, "8-30 дней": 4800, "Уикэнд": 14500}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

-- ────────────────────────────────────────────────  renta-flat: crew
insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
values (
  'Рента-Флэт НН',
  'Демо-витрина аренды квартир на платформе SLY13: посуточно и на месяц, студии и 2-комнатные, онлайн-заявка и договор.',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/renta-flat-logo.png',
  '413553377', 'renta-flat', 'Нижний Новгород', '{}'::jsonb, now(), now()
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  logo_url = excluded.logo_url, owner_id = excluded.owner_id,
  hq_location = excluded.hq_location, updated_at = now();

update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}',
    '{"version": "2026-11-23-v1 (task207, demo flat-rental vertical)", "enabled": true, "slug": "renta-flat", "ui": {"showCreateButton": false}, "branding": {"name": "Рента-Флэт НН", "shortName": "Рента-Флэт", "tagline": "Аренда квартир посуточно и на месяц — студии, 1-2-комнатные, лофт (демо-витрина)", "logoUrl": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/renta-flat-logo.png", "centerLogoInHeader": true}, "theme": {"mode": "auto", "displayName": "Рента-Флэт НН — Emerald on Graphite", "palette": {"bgBase": "#0E1512", "bgCard": "#15201B", "accentMain": "#10B981", "accentMainHover": "#34D399", "textPrimary": "#E8F0EB", "textSecondary": "#93A99C", "borderSoft": "#223429"}, "palettes": {"dark": {"bgBase": "#0E1512", "bgCard": "#15201B", "accentMain": "#10B981", "accentMainHover": "#34D399", "textPrimary": "#E8F0EB", "textSecondary": "#93A99C", "borderSoft": "#223429"}, "light": {"bgBase": "#F2F7F4", "bgCard": "#FFFFFF", "accentMain": "#059669", "accentMainHover": "#047857", "textPrimary": "#0B1510", "textSecondary": "#475651", "borderSoft": "#D8E4DC"}}, "radius": {"card": 16, "button": 14, "pill": 999, "sm": 10, "md": 14, "lg": 18, "hero": 28}}, "header": {"showBackButton": false, "title": "Рента-Флэт НН", "subtitle": "Аренда квартир посуточно и на месяц", "logoHref": "/", "menuLinks": [{"label": "Каталог", "href": "/franchize/renta-flat"}, {"label": "Запчасти", "href": "/franchize/renta-flat/parts"}, {"label": "Об экипаже", "href": "/franchize/renta-flat/about"}, {"label": "Контакты", "href": "/franchize/renta-flat/contacts"}]}, "footer": {"copyrightTemplate": "© {{year}} Рента-Флэт НН", "poweredBy": {"label": "oneSitePls", "href": "https://t.me/oneSitePlsBot", "signature": "@SALAVEY13"}}, "contacts": {"address": "Нижний Новгород", "phone": "+7 900 000-00-00", "workingHours": "Ежедневно 9:00–21:00 (демо)", "telegramBotUsername": "oneBikePlsBot"}, "cta": {"title": "Выбрать и забронировать", "description": "Откройте каталог, выберите квартиру, даты — бронь фиксируется в Telegram-боте.", "buttonLabel": "Открыть каталог", "buttonHref": "/franchize/renta-flat"}, "contentBlocks": {"onboardingChecklist": [{"title": "Выберите квартиру", "text": "Каталог с фото, площадью и ценами — без обзвонов.", "icon": "clipboard-check"}, {"title": "Оставьте бронь", "text": "Даты и детали собираются в боте, менеджер подтверждает.", "icon": "message-circle"}, {"title": "Договор и заезд", "text": "Договор брони генерируется автоматически, заезд по QR.", "icon": "file-text"}]}, "catalog": {"groupOrder": ["Студии", "1-комнатные", "2-комнатные", "Пентхаусы"], "floatingCart": {"showOn": ["catalog"], "showScrollTopButton": true}}, "order": {"allowPromo": true, "paymentOptions": ["cash", "card", "sbp"], "deliveryModes": ["pickup", "delivery"], "defaultMode": "pickup", "consentText": "Я согласен с условиями аренды и обработкой персональных данных."}}'::jsonb),
  updated_at = now()
where c.slug = 'renta-flat';

update public.crews c set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || '{"slug": "renta-flat", "is_provider": true, "provider_type": "flat_rental", "rating": 5, "contacts": {"primary_phone": "+7 900 000-00-00", "working_hours": "Ежедневно 9:00–21:00 (демо)", "manager_sales": "@salavey13", "manager_support": "@salavey13"}}'::jsonb,
  updated_at = now()
where c.slug = 'renta-flat';

insert into public.crew_members (crew_id, user_id, role, membership_status, live_status)
select c.id, '413553377', 'owner', 'active', 'offline' from public.crews c
where c.slug = 'renta-flat'
on conflict (crew_id, user_id) do update set role = 'owner', membership_status = 'active';

-- ────────────────────────────────────────────────  renta-flat: 5 позиций
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-flat-studio', 'Студия', '28 м², Центр (Большая Покровская)',
  'Студия 28 м² на Большой Покровской: 5 мин до Herzen-сада. Евроремонт, Wi-Fi 300 Мбит/с, стиральная машина. 2 спальных места. Заселение 14:00.',
  2400, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-flat-studio.jpg', '', false,
  '{"category": "Студии", "area": "28 м²", "rooms": "Студия", "sleeps": "2", "deposit": "5000 ₽", "tiers": {"1-3 дня": 2400, "4-7 дней": 2200, "8-30 дней": 1900}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-flat'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-flat-1k', '1-комнатная', '38 м², Автозавод',
  '1к квартира 38 м² у Автозаводской: панельный дом, свежий ремонт, диван + двуспальная кровать. До метро 7 мин пешком. 3 спальных места.',
  2600, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-flat-1k.jpg', '', false,
  '{"category": "1-комнатные", "area": "38 м²", "rooms": "1", "sleeps": "3", "deposit": "5000 ₽", "tiers": {"1-3 дня": 2600, "4-7 дней": 2400, "8-30 дней": 2100}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-flat'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-flat-2k', '2-комнатная', '54 м², Московский вокзал',
  '2к квартира 54 м² у Московского вокзала: две спальни, тёмная кухня-гостиная. Подходит командам и семьям. 4 спальных места. Парковка во дворе.',
  3400, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-flat-2k.jpg', '', false,
  '{"category": "2-комнатные", "area": "54 м²", "rooms": "2", "sleeps": "4", "deposit": "7000 ₽", "tiers": {"1-3 дня": 3400, "4-7 дней": 3200, "8-30 дней": 2900}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-flat'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-flat-2k-euro', '2-комнатная евро', '58 м², Верхняя Волга',
  '2к евро 58 м² на наб. Верхней Волги: панорама на Волгу, дизайн-ремонт 2025, посудомойка, кофемашина. 4 спальных места. Доплата за питомца 500 ₽/сут.',
  4200, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-flat-2k-euro.jpg', '', false,
  '{"category": "2-комнатные", "area": "58 м²", "rooms": "2", "sleeps": "4", "deposit": "10000 ₽", "tiers": {"1-3 дня": 4200, "4-7 дней": 3900, "8-30 дней": 3500}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-flat'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-flat-pent', 'Пентхаус-лофт', '86 м², Чёрный пруд',
  'Лофт-пентхаус 86 м² у Чёрного пруда: потолки 4.2 м, терраса 18 м², винный шкаф. 6 спальных мест. Трансфер из аэропорта Стригино по запросу.',
  7800, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-flat-pent.jpg', '', false,
  '{"category": "Пентхаусы", "area": "86 м²", "rooms": "Лофт", "sleeps": "6", "deposit": "15000 ₽", "tiers": {"1-3 дня": 7800, "4-7 дней": 7400, "8-30 дней": 6900}}'::jsonb,
  'bike', '413553377', (select id from public.crews where slug='renta-flat'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, image_url = excluded.image_url, specs = excluded.specs;

commit;
