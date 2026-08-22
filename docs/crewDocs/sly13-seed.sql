-- ============================================================
-- SLY13 Crew — Catalog Items Seed
-- Crew ID: 6be3846b-f350-4558-a6c3-44b43b6760de
-- Type: service (educational/consulting items)
-- ============================================================

-- 1. Vibe-сессия «Аудит»
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-vibe-001',
  'SLY13',
  'Vibe-сессия «Аудит»',
  'Разбор текущих процессов бизнеса. Онлайн 1.5 часа. План цифровизации и первые шаги. В конце — готовый roadmap.',
  5000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 5000, "subtype": "vibe-session"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 2. Vibe-сессия «Проектирование»
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-vibe-002',
  'SLY13',
  'Vibe-сессия «Проектирование»',
  'Проектируем структуру экипажа: каталог, роли, процессы, документы. Онлайн 2 часа.',
  7000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 7000, "subtype": "vibe-session"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 3. Запуск экипажа «Базовый»
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-setup-001',
  'SLY13',
  'Запуск экипажа «Базовый»',
  'Полный запуск витрины: брендинг, каталог, корзина, админка, Telegram-бот. 2 дня работы.',
  25000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 25000, "subtype": "crew-setup"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 4. Запуск экипажа «Под ключ»
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-setup-002',
  'SLY13',
  'Запуск экипажа «Под ключ»',
  'Всё из Базового + аналитика, документооборот, обучение 2х админов, неделя сопровождения.',
  60000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 60000, "subtype": "crew-setup"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 5. Обучение админа (1 час)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-edu-001',
  'SLY13',
  'Обучение админа (1 час)',
  'Индивидуальная сессия для локального администратора: добавление товаров, управление заказами, базовые настройки.',
  3000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 3000, "subtype": "education"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 6. Обучение админа (5 часов)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-edu-002',
  'SLY13',
  'Обучение админа (5 часов)',
  'Полный курс: администрирование экипажа, работа с аналитикой, управление пользователями, типовые сценарии.',
  12000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 12000, "subtype": "education"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;

-- 7. Сопровождение (месяц)
insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'sly13-mnt-001',
  'SLY13',
  'Сопровождение (месяц)',
  'Регулярная поддержка: апдейты, новые фичи, помощь админу, Telegram-саппорт в рабочее время.',
  15000,
  '',
  'https://t.me/SALAVEY13',
  'service',
  '{"service": true, "dailyPrice": 15000, "subtype": "maintenance", "rent_price_label": "15 000 ₽ / месяц"}'::jsonb,
  '6be3846b-f350-4558-a6c3-44b43b6760de'
)
on conflict (id) do update set
  make = excluded.make,
  model = excluded.model,
  description = excluded.description,
  daily_price = excluded.daily_price,
  image_url = excluded.image_url,
  rent_link = excluded.rent_link,
  type = excluded.type,
  specs = excluded.specs,
  crew_id = excluded.crew_id;
