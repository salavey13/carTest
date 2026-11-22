-- /docs/crewDocs/task200-green-leads-hydration-2026-11-22.sql
-- Task 200: 4 green leads from rental-leads-nn-msk — recreated landings + crews.
-- Green = пересобираем витрину на платформе + экипаж (boss marks 2026-11-22).
-- Sections mirror sly13-franchize-hydration.sql / vip-bike-franchize-hydration.sql:
--   1) crews upsert (on conflict slug)  2) franchize metadata (jsonb_set)
--   3) legacy top-level metadata         4) crew_members (owner)
--   5) catalog cars (public.cars, type='bike', tier prices in specs)
-- Safe to re-run: ON CONFLICT upserts everywhere. Owner: salavey13 (413553377).

begin;

-- ────────────────────────────────────────────────  renta-car
insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
values (
  'Рента-Кар НН',
  'Аренда автомобилей в Нижнем Новгороде без водителя: эконом и комфорт класс, посуточно и на месяц. Подача по адресу бесплатно, круглосуточно.',
  '',
  '413553377',
  'renta-car',
  'Нижний Новгород',
  '{}'::jsonb,
  now(), now()
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  owner_id = excluded.owner_id, hq_location = excluded.hq_location, updated_at = now();

update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}',
    '{"version": "2026-11-22-v1 (task200, recreated landing of renta-car)", "enabled": true, "slug": "renta-car", "ui": {"showCreateButton": false}, "branding": {"name": "Рента-Кар НН", "shortName": "Рента-Кар НН", "tagline": "Аренда авто в Нижнем без водителя — подача бесплатно, круглосуточно", "logoUrl": "", "centerLogoInHeader": true}, "theme": {"mode": "auto", "displayName": "Рента-Кар НН — #2F6FED on dark", "palette": {"bgBase": "#0B1220", "bgCard": "#121A2A", "accentMain": "#2F6FED", "accentMainHover": "#4C82F2", "textPrimary": "#E7ECF5", "textSecondary": "#93A1B8", "borderSoft": "#22304A"}, "palettes": {"dark": {"bgBase": "#0B1220", "bgCard": "#121A2A", "accentMain": "#2F6FED", "accentMainHover": "#4C82F2", "textPrimary": "#E7ECF5", "textSecondary": "#93A1B8", "borderSoft": "#22304A"}, "light": {"bgBase": "#F6F8FB", "bgCard": "#FFFFFF", "accentMain": "#1D4ED8", "accentMainHover": "#1E40AF", "textPrimary": "#0F172A", "textSecondary": "#475569", "borderSoft": "#DBE4EF"}}, "radius": {"card": 16, "button": 14, "pill": 999, "sm": 10, "md": 14, "lg": 18, "hero": 28}, "spacing": {"section": 24, "card": 14, "stackSm": 12, "stackMd": 16, "stackLg": 24}, "effects": {"accentGlow": true, "cardLift": true}}, "header": {"showBackButton": false, "title": "Рента-Кар НН", "subtitle": "Аренда авто в Нижнем без водителя — подача бесплатно, круглосуточно", "logoHref": "/", "menuLinks": [{"label": "Каталог", "href": "/franchize/{slug}"}, {"label": "О нас", "href": "/franchize/{slug}/about"}, {"label": "Контакты", "href": "/franchize/{slug}/contacts"}, {"label": "Партнёрам", "href": "/franchize/{slug}/onboarding"}]}, "footer": {"textColor": "#0F172A", "columns": [{"title": "Рента-Кар НН", "items": [{"type": "text", "value": "Аренда автомобилей в Нижнем Новгороде без водителя: эконом и комфорт класс, посуточно и на месяц. Подача по адресу бесплатно, круглосуточно."}]}, {"title": "СВЯЗЬ", "items": [{"type": "phone", "label": "+7 903 053-60-00", "href": "tel:+7903053-60-00", "icon": "FaPhone"}, {"type": "text", "label": "Нижний Новгород", "icon": "FaMapLocationDot"}]}], "copyrightTemplate": "© {{year}} Рента-Кар НН", "poweredBy": {"label": "oneSitePls", "href": "https://t.me/oneSitePlsBot", "signature": "@SALAVEY13"}}, "about": {"heroTitle": "Рента-Кар НН", "heroSubtitle": "Аренда авто в Нижнем без водителя — подача бесплатно, круглосуточно", "features": ["Подача авто по адресу бесплатно", "Круглосуточный приём брони", "Тарифы: 1–3 дня, 4–7 дней, 8–30 дней, уикэнд", "Эконом и комфорт класс"], "faq": [{"q": "Как подаётся автомобиль?", "a": "Подача по адресу в Нижнем Новгороде — бесплатно. Возврат по договорённости в точке выдачи."}, {"q": "Какие тарифы?", "a": "Суточная аренда со ступенями: 1–3 дня, 4–7 дней, 8–30 дней и отдельный тариф «Уикэнд» (пт 15:00 — пн 12:00)."}, {"q": "Какой залог?", "a": "Стандартный залог — 5 000 ₽ (зависит от модели). Превышение лимита пробега тарифицируется отдельно."}]}, "contacts": {"address": "Нижний Новгород", "phone": "+7 903 053-60-00", "email": "", "telegram": "", "telegramBotUsername": "oneBikePlsBot", "workingHours": "Круглосуточно, без выходных", "map": {"imageUrl": "", "gps": "", "bounds": {}}}, "cta": {"title": "Выбрать и забронировать", "description": "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа.", "buttonLabel": "Открыть каталог", "buttonHref": "/franchize/renta-car"}, "contentBlocks": {"onboardingChecklist": [{"title": "Выберите позицию", "text": "Каталог с группами, ценами и описанием — выбор без звонков.", "icon": "clipboard-check"}, {"title": "Оставьте бронь", "text": "Даты и детали собираются в боте, оператор подтверждает.", "icon": "message-circle"}, {"title": "Документы за минуту", "text": "Договор и залог генерируются автоматически, выдача по QR с фотоотчётом.", "icon": "file-text"}], "onboardingReadinessRows": [{"label": "Брендинг", "text": "лого, цвета, оффер"}, {"label": "Каталог", "text": "позиции с тарифами"}, {"label": "Контакты", "text": "телефон + Telegram-бот"}]}, "catalog": {"groupOrder": ["Эконом", "Комфорт"], "floatingCart": {"showOn": ["catalog"], "showScrollTopButton": true}}, "order": {"allowPromo": true, "paymentOptions": ["cash", "card", "sbp"], "deliveryModes": ["pickup", "delivery"], "defaultMode": "delivery", "consentText": "Я согласен с условиями аренды и обработкой персональных данных."}}'::jsonb),
  updated_at = now()
where c.slug = 'renta-car';

update public.crews c set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || '{"slug": "renta-car", "is_provider": true, "provider_type": "vehicle_rental", "rating": 5, "contacts": {"primary_phone": "+7 903 053-60-00", "working_hours": "Круглосуточно, без выходных", "manager_sales": "@salavey13", "manager_support": "@salavey13"}}'::jsonb,
  updated_at = now()
where c.slug = 'renta-car';

insert into public.crew_members (crew_id, user_id, role, membership_status, live_status)
select c.id, '413553377', 'owner', 'active', 'offline' from public.crews c
where c.slug = 'renta-car'
on conflict (crew_id, user_id) do update set role = 'owner', membership_status = 'active';

-- 5) catalog (public.cars; type='bike' = vehicle representation on the platform)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-solaris', 'Hyundai', 'Solaris', 'Hyundai Solaris, 4 двери, механика. Тарифы: 1–3 дня 2 500 ₽/сут, 4–7 дней 2 400 ₽/сут, 8–30 дней 2 300 ₽/сут, уикэнд 6 900 ₽. Залог 5 000 ₽. Лимит 300 км/сут, превышение 5 ₽/км.', 2500, '', '', false,
  '{"category": "econom", "deposit": "5000 ₽", "doors": "4", "gearbox": "Механика", "tiers": {"1-3 дня": 2500, "4-7 дней": 2400, "8-30 дней": 2300, "Уикэнд": 6900}, "overage": "300 км/сут включено, далее 5 ₽/км"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-priora-wagon', 'Лада', 'Приора (Универсал)', 'Лада Приора универсал, 5 дверей, механика. Тарифы: 1–3 дня 2 000 ₽/сут, 4–7 дней 1 900 ₽/сут, 8–30 дней 1 800 ₽/сут, уикэнд 5 400 ₽. Залог 5 000 ₽.', 2000, '', '', false,
  '{"category": "econom", "deposit": "5000 ₽", "doors": "5", "gearbox": "Механика", "tiers": {"1-3 дня": 2000, "4-7 дней": 1900, "8-30 дней": 1800, "Уикэнд": 5400}}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-granta', 'Лада', 'Гранта', 'Лада Гранта. Цены — по тарифной сетке экипажа: 1–3 дня, 4–7 дней, 8–30 дней, уикэнд. Уточняются при бронировании.', null, '', '', false,
  '{"category": "econom", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-solaris-at', 'Hyundai', 'Solaris AT', 'Hyundai Solaris на автомате. Цены — по тарифной сетке экипажа, уточняются при бронировании.', null, '', '', false,
  '{"category": "econom", "gearbox": "Автомат", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-rapid', 'Skoda', 'Rapid', 'Skoda Rapid. Цены — по тарифной сетке экипажа, уточняются при бронировании.', null, '', '', false,
  '{"category": "econom", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-creta', 'Hyundai', 'Creta', 'Hyundai Creta — компактный кроссовер. Цены — по тарифной сетке экипажа, уточняются при бронировании.', null, '', '', false,
  '{"category": "comfort", "class": "Кроссовер", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-duster', 'Renault', 'Duster', 'Renault Duster — внедорожник для загородных поездок. Цены — по тарифной сетке экипажа.', null, '', '', false,
  '{"category": "comfort", "class": "Внедорожник", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-octavia', 'Skoda', 'Octavia', 'Skoda Octavia — просторный лифтбек для дальних маршрутов. Цены — по тарифной сетке экипажа.', null, '', '', false,
  '{"category": "comfort", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-camry', 'Toyota', 'Camry', 'Toyota Camry — бизнес-седан. Цены — по тарифной сетке экипажа, уточняются при бронировании.', null, '', '', false,
  '{"category": "comfort", "class": "Бизнес", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-k5', 'KIA', 'К5', 'KIA К5. Цены — по тарифной сетке экипажа, уточняются при бронировании.', null, '', '', false,
  '{"category": "comfort", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-rav4', 'Toyota', 'RAV4', 'Toyota RAV4 — кроссовер для города и трассы. Цены — по тарифной сетке экипажа.', null, '', '', false,
  '{"category": "comfort", "class": "Кроссовер", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'renta-car-h1', 'Hyundai', 'H1', 'Hyundai H1, 7 мест — для поездок командой. Цены — по тарифной сетке экипажа.', null, '', '', false,
  '{"category": "comfort", "seats": "7", "price_note": "Цена по тарифной сетке"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'renta-car'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;


-- ────────────────────────────────────────────────  motoprokat1
insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
values (
  'МотоПрокат №1 СПб',
  'Аренда и прокат мотоциклов в Санкт-Петербурге без ограничения по пробегу: нейкеды, спортбайки, туреры и нео-ретро. Плюс ремонт мототехники.',
  '',
  '413553377',
  'motoprokat1',
  'Санкт-Петербург',
  '{}'::jsonb,
  now(), now()
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  owner_id = excluded.owner_id, hq_location = excluded.hq_location, updated_at = now();

update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}',
    '{"version": "2026-11-22-v1 (task200, recreated landing of motoprokat1)", "enabled": true, "slug": "motoprokat1", "ui": {"showCreateButton": false}, "branding": {"name": "МотоПрокат №1 СПб", "shortName": "МотоПрокат №1 СПб", "tagline": "Прокат мотоциклов в СПб без ограничения по пробегу", "logoUrl": "", "centerLogoInHeader": true}, "theme": {"mode": "auto", "displayName": "МотоПрокат №1 СПб — #F97316 on dark", "palette": {"bgBase": "#131110", "bgCard": "#1C1917", "accentMain": "#F97316", "accentMainHover": "#FB923C", "textPrimary": "#F5F0EA", "textSecondary": "#A8A29E", "borderSoft": "#2E2926"}, "palettes": {"dark": {"bgBase": "#131110", "bgCard": "#1C1917", "accentMain": "#F97316", "accentMainHover": "#FB923C", "textPrimary": "#F5F0EA", "textSecondary": "#A8A29E", "borderSoft": "#2E2926"}, "light": {"bgBase": "#FAF9F7", "bgCard": "#FFFFFF", "accentMain": "#EA580C", "accentMainHover": "#C2410C", "textPrimary": "#1C1917", "textSecondary": "#57534E", "borderSoft": "#F0DFD3"}}, "radius": {"card": 16, "button": 14, "pill": 999, "sm": 10, "md": 14, "lg": 18, "hero": 28}, "spacing": {"section": 24, "card": 14, "stackSm": 12, "stackMd": 16, "stackLg": 24}, "effects": {"accentGlow": true, "cardLift": true}}, "header": {"showBackButton": false, "title": "МотоПрокат №1 СПб", "subtitle": "Прокат мотоциклов в СПб без ограничения по пробегу", "logoHref": "/", "menuLinks": [{"label": "Каталог", "href": "/franchize/{slug}"}, {"label": "О нас", "href": "/franchize/{slug}/about"}, {"label": "Контакты", "href": "/franchize/{slug}/contacts"}, {"label": "Партнёрам", "href": "/franchize/{slug}/onboarding"}]}, "footer": {"textColor": "#0F172A", "columns": [{"title": "МотоПрокат №1 СПб", "items": [{"type": "text", "value": "Аренда и прокат мотоциклов в Санкт-Петербурге без ограничения по пробегу: нейкеды, спортбайки, туреры и нео-ретро. Плюс ремонт мототехники."}]}, {"title": "СВЯЗЬ", "items": [{"type": "phone", "label": "+7 (921) 884-66-60", "href": "tel:+7921884-66-60", "icon": "FaPhone"}, {"type": "text", "label": "Санкт-Петербург", "icon": "FaMapLocationDot"}]}], "copyrightTemplate": "© {{year}} МотоПрокат №1 СПб", "poweredBy": {"label": "oneSitePls", "href": "https://t.me/oneSitePlsBot", "signature": "@SALAVEY13"}}, "about": {"heroTitle": "МотоПрокат №1 СПб", "heroSubtitle": "Прокат мотоциклов в СПб без ограничения по пробегу", "features": ["Без ограничения по пробегу", "Полный бак и чистый байк на выдаче", "Сезонная скидка 20% на поездки", "Профессиональный сервис и ремонт мотоциклов"], "faq": [{"q": "Есть ли ограничение по пробегу?", "a": "Нет — аренда мотоциклов без ограничения по пробегу."}, {"q": "Что на выдаче?", "a": "Байк выдаётся с полным баком и чистым. Возврат грязного байка — 500 ₽, неполного бака — 1 000 ₽."}, {"q": "Как забронировать?", "a": "Выберите модель и дату в каталоге — оператор подтвердит бронь и подготовит документы."}]}, "contacts": {"address": "Санкт-Петербург", "phone": "+7 (921) 884-66-60", "email": "", "telegram": "", "telegramBotUsername": "oneBikePlsBot", "workingHours": "Ежедневно, бронирование онлайн", "map": {"imageUrl": "", "gps": "", "bounds": {}}}, "cta": {"title": "Выбрать и забронировать", "description": "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа.", "buttonLabel": "Открыть каталог", "buttonHref": "/franchize/motoprokat1"}, "contentBlocks": {"onboardingChecklist": [{"title": "Выберите позицию", "text": "Каталог с группами, ценами и описанием — выбор без звонков.", "icon": "clipboard-check"}, {"title": "Оставьте бронь", "text": "Даты и детали собираются в боте, оператор подтверждает.", "icon": "message-circle"}, {"title": "Документы за минуту", "text": "Договор и залог генерируются автоматически, выдача по QR с фотоотчётом.", "icon": "file-text"}], "onboardingReadinessRows": [{"label": "Брендинг", "text": "лого, цвета, оффер"}, {"label": "Каталог", "text": "позиции с тарифами"}, {"label": "Контакты", "text": "телефон + Telegram-бот"}]}, "catalog": {"groupOrder": ["Нейкед", "Спорт", "Тур", "Нео-ретро", "Круизер"], "floatingCart": {"showOn": ["catalog"], "showScrollTopButton": true}}, "order": {"allowPromo": true, "paymentOptions": ["cash", "card", "sbp"], "deliveryModes": ["pickup"], "defaultMode": "pickup", "consentText": "Я согласен с условиями аренды и обработкой персональных данных."}}'::jsonb),
  updated_at = now()
where c.slug = 'motoprokat1';

update public.crews c set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || '{"slug": "motoprokat1", "is_provider": true, "provider_type": "vehicle_rental", "rating": 5, "contacts": {"primary_phone": "+7 (921) 884-66-60", "working_hours": "Ежедневно, бронирование онлайн", "manager_sales": "@salavey13", "manager_support": "@salavey13"}}'::jsonb,
  updated_at = now()
where c.slug = 'motoprokat1';

insert into public.crew_members (crew_id, user_id, role, membership_status, live_status)
select c.id, '413553377', 'owner', 'active', 'offline' from public.crews c
where c.slug = 'motoprokat1'
on conflict (crew_id, user_id) do update set role = 'owner', membership_status = 'active';

-- 5) catalog (public.cars; type='bike' = vehicle representation on the platform)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-bmw-r1200gs', 'BMW', 'R1200GS', 'BMW R1200GS — легендарный турэндуро для дальних маршрутов. Цена по запросу при бронировании.', null, '', '', false,
  '{"category": "tour", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-bmw-s1000xr', 'BMW', 'S1000XR', 'BMW S1000XR — спорт-тур для быстрых путешествий. Цена по запросу при бронировании.', null, '', '', false,
  '{"category": "tour", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-bmw-s1000r', 'BMW', 'S1000R', 'BMW S1000R — стритфайтер с характером. Цена по запросу при бронировании.', null, '', '', false,
  '{"category": "naked", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-bmw-g310r', 'BMW', 'G310R', 'BMW G310R — лёгкий нейкед для города, дружелюбен к новичкам. Цена по запросу.', null, '', '', false,
  '{"category": "naked", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-yamaha-mt07', 'Yamaha', 'MT-07', 'Yamaha MT-07 — популярный городской нейкед с параллельной двойкой. Цена по запросу.', null, '', '', false,
  '{"category": "naked", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-yamaha-mt09', 'Yamaha', 'MT-09', 'Yamaha MT-09 — резкий нейкед с тройкой CP3. Цена по запросу.', null, '', '', false,
  '{"category": "naked", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-yamaha-xsr700', 'Yamaha', 'XSR 700', 'Yamaha XSR 700 — нео-ретро со спортивным характером. Цена по запросу.', null, '', '', false,
  '{"category": "neo-retro", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-yamaha-r6', 'Yamaha', 'ZF R6', 'Yamaha ZF R6 — трековый спортбайк. Цена по запросу при бронировании.', null, '', '', false,
  '{"category": "sport", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-kawasaki-ninja', 'Kawasaki', 'Ninja', 'Kawasaki Ninja — спортивный мотоцикл для трассы. Цена по запросу.', null, '', '', false,
  '{"category": "sport", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'motoprokat1-ducati-diavel', 'Ducati', 'Diavel', 'Ducati Diavel — пауэр-круизер с итальянским характером. Цена по запросу.', null, '', '', false,
  '{"category": "cruiser", "price_note": "Цена по запросу"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'motoprokat1'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;


-- ────────────────────────────────────────────────  snowmobile-nn
insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
values (
  'Snowmobile-NN',
  'Прокат снегоходов в Нижнем Новгороде: мощная техника, красивые маршруты, катаемся каждый день в 15 минутах от центра, пока лежит устойчивый снежный покров.',
  '',
  '413553377',
  'snowmobile-nn',
  'Нижний Новгород',
  '{}'::jsonb,
  now(), now()
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  owner_id = excluded.owner_id, hq_location = excluded.hq_location, updated_at = now();

update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}',
    '{"version": "2026-11-22-v1 (task200, recreated landing of snowmobile-nn)", "enabled": true, "slug": "snowmobile-nn", "ui": {"showCreateButton": false}, "branding": {"name": "Snowmobile-NN", "shortName": "Snowmobile-NN", "tagline": "Мощные снегоходы и красивые маршруты в 15 минутах от центра Нижнего", "logoUrl": "", "centerLogoInHeader": true}, "theme": {"mode": "auto", "displayName": "Snowmobile-NN — #0EA5E9 on dark", "palette": {"bgBase": "#0A1220", "bgCard": "#111C2E", "accentMain": "#0EA5E9", "accentMainHover": "#38BDF8", "textPrimary": "#E6F1F9", "textSecondary": "#8FA6BC", "borderSoft": "#1B2A40"}, "palettes": {"dark": {"bgBase": "#0A1220", "bgCard": "#111C2E", "accentMain": "#0EA5E9", "accentMainHover": "#38BDF8", "textPrimary": "#E6F1F9", "textSecondary": "#8FA6BC", "borderSoft": "#1B2A40"}, "light": {"bgBase": "#F5FAFE", "bgCard": "#FFFFFF", "accentMain": "#0284C7", "accentMainHover": "#0369A1", "textPrimary": "#0C1B2A", "textSecondary": "#475569", "borderSoft": "#D8ECF8"}}, "radius": {"card": 16, "button": 14, "pill": 999, "sm": 10, "md": 14, "lg": 18, "hero": 28}, "spacing": {"section": 24, "card": 14, "stackSm": 12, "stackMd": 16, "stackLg": 24}, "effects": {"accentGlow": true, "cardLift": true}}, "header": {"showBackButton": false, "title": "Snowmobile-NN", "subtitle": "Мощные снегоходы и красивые маршруты в 15 минутах от центра Нижнего", "logoHref": "/", "menuLinks": [{"label": "Каталог", "href": "/franchize/{slug}"}, {"label": "О нас", "href": "/franchize/{slug}/about"}, {"label": "Контакты", "href": "/franchize/{slug}/contacts"}, {"label": "Партнёрам", "href": "/franchize/{slug}/onboarding"}]}, "footer": {"textColor": "#0F172A", "columns": [{"title": "Snowmobile-NN", "items": [{"type": "text", "value": "Прокат снегоходов в Нижнем Новгороде: мощная техника, красивые маршруты, катаемся каждый день в 15 минутах от центра, пока лежит устойчивый снежный покров."}]}, {"title": "СВЯЗЬ", "items": [{"type": "phone", "label": "+7 910 876-28-58", "href": "tel:+7910876-28-58", "icon": "FaPhone"}, {"type": "text", "label": "Нижний Новгород", "icon": "FaMapLocationDot"}]}], "copyrightTemplate": "© {{year}} Snowmobile-NN", "poweredBy": {"label": "oneSitePls", "href": "https://t.me/oneSitePlsBot", "signature": "@SALAVEY13"}}, "about": {"heroTitle": "Snowmobile-NN", "heroSubtitle": "Мощные снегоходы и красивые маршруты в 15 минутах от центра Нижнего", "features": ["Катания каждый день, пока лежит снег", "15 минут от центра Нижнего Новгорода", "Мощные снегоходы и красивые маршруты", "Электронные подарочные сертификаты"], "faq": [{"q": "Когда можно кататься?", "a": "Каждый день, пока лежит устойчивый снежный покров. Локация — 15 минут от центра Нижнего."}, {"q": "Есть ли подарочные сертификаты?", "a": "Да, электронные сертификаты — зимой действуют на прокат снегоходов."}, {"q": "Как забронировать катание?", "a": "Выберите длительность в каталоге: 1 час, 1,5 часа или 2 часа — и забронируйте онлайн."}]}, "contacts": {"address": "Нижний Новгород", "phone": "+7 910 876-28-58", "email": "", "telegram": "", "telegramBotUsername": "oneBikePlsBot", "workingHours": "Каждый день при устойчивом снежном покрове", "map": {"imageUrl": "", "gps": "", "bounds": {}}}, "cta": {"title": "Выбрать и забронировать", "description": "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа.", "buttonLabel": "Открыть каталог", "buttonHref": "/franchize/snowmobile-nn"}, "contentBlocks": {"onboardingChecklist": [{"title": "Выберите позицию", "text": "Каталог с группами, ценами и описанием — выбор без звонков.", "icon": "clipboard-check"}, {"title": "Оставьте бронь", "text": "Даты и детали собираются в боте, оператор подтверждает.", "icon": "message-circle"}, {"title": "Документы за минуту", "text": "Договор и залог генерируются автоматически, выдача по QR с фотоотчётом.", "icon": "file-text"}], "onboardingReadinessRows": [{"label": "Брендинг", "text": "лого, цвета, оффер"}, {"label": "Каталог", "text": "позиции с тарифами"}, {"label": "Контакты", "text": "телефон + Telegram-бот"}]}, "catalog": {"groupOrder": ["Катания"], "floatingCart": {"showOn": ["catalog"], "showScrollTopButton": true}}, "order": {"allowPromo": true, "paymentOptions": ["cash", "card", "sbp"], "deliveryModes": ["pickup"], "defaultMode": "pickup", "consentText": "Я согласен с условиями аренды и обработкой персональных данных."}}'::jsonb),
  updated_at = now()
where c.slug = 'snowmobile-nn';

update public.crews c set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || '{"slug": "snowmobile-nn", "is_provider": true, "provider_type": "vehicle_rental", "rating": 5, "contacts": {"primary_phone": "+7 910 876-28-58", "working_hours": "Каждый день при устойчивом снежном покрове", "manager_sales": "@salavey13", "manager_support": "@salavey13"}}'::jsonb,
  updated_at = now()
where c.slug = 'snowmobile-nn';

insert into public.crew_members (crew_id, user_id, role, membership_status, live_status)
select c.id, '413553377', 'owner', 'active', 'offline' from public.crews c
where c.slug = 'snowmobile-nn'
on conflict (crew_id, user_id) do update set role = 'owner', membership_status = 'active';

-- 5) catalog (public.cars; type='bike' = vehicle representation on the platform)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snowmobile-nn-ride-1h', 'Snowmobile-NN', 'Катание на снегоходе — 1 час', 'Часовое катание на мощном снегоходе по подготовленному маршруту в 15 минутах от центра Нижнего.', 6000, '', '', false,
  '{"category": "ride", "duration": "1 час"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snowmobile-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snowmobile-nn-ride-1h30', 'Snowmobile-NN', 'Катание на снегоходе — 1,5 часа', 'Полтора часа катания: длиннее маршрут, больше красоты. Пока лежит устойчивый снег.', 8000, '', '', false,
  '{"category": "ride", "duration": "1,5 часа"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snowmobile-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snowmobile-nn-ride-2h', 'Snowmobile-NN', 'Катание на снегоходе — 2 часа', 'Двухчасовое катание — большая прогулка по красивым маршрутам вокруг Нижнего.', 10000, '', '', false,
  '{"category": "ride", "duration": "2 часа"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snowmobile-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;


-- ────────────────────────────────────────────────  snegoprokat-nn
insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
values (
  'Snegoprokat NN',
  'Катания на снегоходах в пригороде Нижнего Новгорода: одиночные и на 2-х снегоходах, подарочные сертификаты. Катания от 3 000 ₽.',
  '',
  '413553377',
  'snegoprokat-nn',
  'Нижний Новгород',
  '{}'::jsonb,
  now(), now()
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  owner_id = excluded.owner_id, hq_location = excluded.hq_location, updated_at = now();

update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize}',
    '{"version": "2026-11-22-v1 (task200, recreated landing of snegoprokat-nn)", "enabled": true, "slug": "snegoprokat-nn", "ui": {"showCreateButton": false}, "branding": {"name": "Snegoprokat NN", "shortName": "Snegoprokat NN", "tagline": "Снегоходы в пригороде Нижнего — катания от 3 000 ₽", "logoUrl": "", "centerLogoInHeader": true}, "theme": {"mode": "auto", "displayName": "Snegoprokat NN — #6366F1 on dark", "palette": {"bgBase": "#0C0F24", "bgCard": "#141838", "accentMain": "#6366F1", "accentMainHover": "#818CF8", "textPrimary": "#E9EAF8", "textSecondary": "#9CA0C8", "borderSoft": "#242A55"}, "palettes": {"dark": {"bgBase": "#0C0F24", "bgCard": "#141838", "accentMain": "#6366F1", "accentMainHover": "#818CF8", "textPrimary": "#E9EAF8", "textSecondary": "#9CA0C8", "borderSoft": "#242A55"}, "light": {"bgBase": "#F7F7FE", "bgCard": "#FFFFFF", "accentMain": "#4F46E5", "accentMainHover": "#4338CA", "textPrimary": "#14132B", "textSecondary": "#4B4D6E", "borderSoft": "#E0E2F7"}}, "radius": {"card": 16, "button": 14, "pill": 999, "sm": 10, "md": 14, "lg": 18, "hero": 28}, "spacing": {"section": 24, "card": 14, "stackSm": 12, "stackMd": 16, "stackLg": 24}, "effects": {"accentGlow": true, "cardLift": true}}, "header": {"showBackButton": false, "title": "Snegoprokat NN", "subtitle": "Снегоходы в пригороде Нижнего — катания от 3 000 ₽", "logoHref": "/", "menuLinks": [{"label": "Каталог", "href": "/franchize/{slug}"}, {"label": "О нас", "href": "/franchize/{slug}/about"}, {"label": "Контакты", "href": "/franchize/{slug}/contacts"}, {"label": "Партнёрам", "href": "/franchize/{slug}/onboarding"}]}, "footer": {"textColor": "#0F172A", "columns": [{"title": "Snegoprokat NN", "items": [{"type": "text", "value": "Катания на снегоходах в пригороде Нижнего Новгорода: одиночные и на 2-х снегоходах, подарочные сертификаты. Катания от 3 000 ₽."}]}, {"title": "СВЯЗЬ", "items": [{"type": "phone", "label": "+7 923 433-07-40", "href": "tel:+7923433-07-40", "icon": "FaPhone"}, {"type": "text", "label": "Нижний Новгород", "icon": "FaMapLocationDot"}]}], "copyrightTemplate": "© {{year}} Snegoprokat NN", "poweredBy": {"label": "oneSitePls", "href": "https://t.me/oneSitePlsBot", "signature": "@SALAVEY13"}}, "about": {"heroTitle": "Snegoprokat NN", "heroSubtitle": "Снегоходы в пригороде Нижнего — катания от 3 000 ₽", "features": ["Катания от 3 000 ₽", "Одиночные катания и на 2-х снегоходах", "Подарочные сертификаты", "Пригород Нижнего Новгорода"], "faq": [{"q": "Сколько стоит катание?", "a": "Одиночное катание: 1 час — 3 000 ₽, 2 часа — 6 000 ₽. На 2-х снегоходах: 1 час — 6 000 ₽, 2 часа — 12 000 ₽."}, {"q": "Есть ли сертификаты?", "a": "Да, катания можно подарить — оформляйте сертификат при бронировании."}, {"q": "Где проходит катание?", "a": "В пригороде Нижнего Новгорода, старт по записи."}]}, "contacts": {"address": "Нижний Новгород", "phone": "+7 923 433-07-40", "email": "", "telegram": "", "telegramBotUsername": "oneBikePlsBot", "workingHours": "Сезонные катания, запись онлайн", "map": {"imageUrl": "", "gps": "", "bounds": {}}}, "cta": {"title": "Выбрать и забронировать", "description": "Откройте каталог, выберите позицию, даты и формат — бронь фиксируется в Telegram-боте экипажа.", "buttonLabel": "Открыть каталог", "buttonHref": "/franchize/snegoprokat-nn"}, "contentBlocks": {"onboardingChecklist": [{"title": "Выберите позицию", "text": "Каталог с группами, ценами и описанием — выбор без звонков.", "icon": "clipboard-check"}, {"title": "Оставьте бронь", "text": "Даты и детали собираются в боте, оператор подтверждает.", "icon": "message-circle"}, {"title": "Документы за минуту", "text": "Договор и залог генерируются автоматически, выдача по QR с фотоотчётом.", "icon": "file-text"}], "onboardingReadinessRows": [{"label": "Брендинг", "text": "лого, цвета, оффер"}, {"label": "Каталог", "text": "позиции с тарифами"}, {"label": "Контакты", "text": "телефон + Telegram-бот"}]}, "catalog": {"groupOrder": ["Одиночные", "На двоих"], "floatingCart": {"showOn": ["catalog"], "showScrollTopButton": true}}, "order": {"allowPromo": true, "paymentOptions": ["cash", "card", "sbp"], "deliveryModes": ["pickup"], "defaultMode": "pickup", "consentText": "Я согласен с условиями аренды и обработкой персональных данных."}}'::jsonb),
  updated_at = now()
where c.slug = 'snegoprokat-nn';

update public.crews c set
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || '{"slug": "snegoprokat-nn", "is_provider": true, "provider_type": "vehicle_rental", "rating": 5, "contacts": {"primary_phone": "+7 923 433-07-40", "working_hours": "Сезонные катания, запись онлайн", "manager_sales": "@salavey13", "manager_support": "@salavey13"}}'::jsonb,
  updated_at = now()
where c.slug = 'snegoprokat-nn';

insert into public.crew_members (crew_id, user_id, role, membership_status, live_status)
select c.id, '413553377', 'owner', 'active', 'offline' from public.crews c
where c.slug = 'snegoprokat-nn'
on conflict (crew_id, user_id) do update set role = 'owner', membership_status = 'active';

-- 5) catalog (public.cars; type='bike' = vehicle representation on the platform)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snegoprokat-nn-ride-1h', 'Snegoprokat NN', 'Катание на снегоходе — 1 час', 'Час катания на снегоходе в пригороде Нижнего — идеальный первый выход на снег.', 3000, '', '', false,
  '{"category": "ride", "duration": "1 час"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snegoprokat-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snegoprokat-nn-ride-2h', 'Snegoprokat NN', 'Катание на снегоходе — 2 часа', 'Два часа катания: длинная трасса и полная свобода маршрута.', 6000, '', '', false,
  '{"category": "ride", "duration": "2 часа"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snegoprokat-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snegoprokat-nn-tandem-1h', 'Snegoprokat NN', 'Катание на 2-х снегоходах — 1 час', 'Два снегохода на час — катание вдвоём, каждый на своей технике.', 6000, '', '', false,
  '{"category": "ride-tandem", "duration": "1 час", "snowmobiles": "2"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snegoprokat-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link,
  is_test_result, specs, type, owner_id, crew_id, quantity, availability_rules)
select 'snegoprokat-nn-tandem-2h', 'Snegoprokat NN', 'Катание на 2-х снегоходах — 2 часа', 'Два снегохода на два часа — большой совместный заезд по пригородным маршрутам.', 12000, '', '', false,
  '{"category": "ride-tandem", "duration": "2 часа", "snowmobiles": "2"}'::jsonb, 'bike', '413553377',
  (select id from public.crews where slug = 'snegoprokat-nn'), 1, '{}'::jsonb
on conflict (id) do update set
  make = excluded.make, model = excluded.model, description = excluded.description,
  daily_price = excluded.daily_price, specs = excluded.specs, crew_id = excluded.crew_id;


commit;

-- Verification helpers
-- select slug, name, metadata->'franchize'->'branding'->>'name' as brand from public.crews where slug in ('renta-car','motoprokat1','snowmobile-nn','snegoprokat-nn');
-- select id, make, model, daily_price, specs->>'category' as cat from public.cars where crew_id in (select id from public.crews where slug in ('renta-car','motoprokat1','snowmobile-nn','snegoprokat-nn')) order by id;
-- Deep links: https://t.me/oneBikePlsBot/app?startapp=crew_<slug>  (fast path use-start-param-target.ts: crew_<slug> → /franchize/<slug>)