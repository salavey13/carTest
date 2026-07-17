-- ============================================================
-- VIP-BIKE Service Items (prices x2 from original pricelist)
-- Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746
-- Type: service
-- ============================================================

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-001',
  'VIP_BIKE',
  'Нормо-час',
  'Нормо-час — единица времени для сложных работ и ремонта мотоциклов.',
  2000,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 2000, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-002',
  'VIP_BIKE',
  'Обслуживание и регулировка цепи',
  'Чистка, смазка и натяжение цепи. Проверка износа звёзд.',
  3000,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 3000, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-003',
  'VIP_BIKE',
  'Замена масла в двигателе',
  'Слив старого масла, замена масляного фильтра, заливка свежего масла.',
  2000,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 2000, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-004',
  'VIP_BIKE',
  'Замена масляного фильтра',
  'Замена фильтрующего элемента системы смазки двигателя.',
  1200,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 1200, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-005',
  'VIP_BIKE',
  'Замена свечей зажигания (за цилиндр)',
  'Диагностика и замена свечей зажигания. Цена за цилиндр.',
  1200,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 1200, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-006',
  'VIP_BIKE',
  'Компьютерная диагностика',
  'Подключение к ЭБУ, чтение ошибок, сброс, расшифровка кодов.',
  2400,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 2400, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-007',
  'VIP_BIKE',
  'Шиномонтаж переднего колеса',
  'Демонтаж, замена покрышки/камеры, монтаж, накачка.',
  3600,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 3600, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-008',
  'VIP_BIKE',
  'Замена тормозных колодок (комплект)',
  'Замена передних или задних колодок, проверка состояния диска.',
  2000,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 2000, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-009',
  'VIP_BIKE',
  'Регулировка подвески',
  'Настройка предварительной нагрузки и отбоя под вес и стиль вождения.',
  2000,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 2000, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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

insert into public.cars (id, make, model, description, daily_price, image_url, rent_link, type, specs, crew_id)
values (
  'vip-bike-svc-010',
  'VIP_BIKE',
  'Замена воздушного фильтра',
  'Замена фильтрующего элемента воздушной системы двигателя.',
  1200,
  '',
  'https://t.me/I_O_S_NN',
  'service',
  '{"service": true, "dailyPrice": 1200, "subtype": "service"}'::jsonb,
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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
