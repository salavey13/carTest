-- Quality-bar seeds for app/franchize/[slug]/market/[bike_id]/buy
-- Notes:
-- 1) Includes all specs keys consumed by SaleBikeLandingClient (price_rub/sale_price, gallery,
--    power_kw/motor_peak_kw, battery, range_km, top_speed_kmh, weight_kg, charge_time_h, drive,
--    sold_count, rating, recommend_percent, buy_options, buy_colors).
-- 2) Uses ON CONFLICT for safe re-runs.

INSERT INTO public.cars (
  id, make, model, description, embedding, daily_price, image_url, rent_link, is_test_result,
  specs, owner_id, type, crew_id, availability_rules, quantity
)
VALUES (
  'falcon-gt-2025',
  '79BIKE',
  'Falcon GT',
  'Мощный электрический эндуро-байк для бездорожья. Высокая динамика, легкий вес и адаптивная электроника.',
  NULL,
  '0',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2025/image_1.jpg',
  '/rent/falcon-gt-2025',
  false,
  jsonb_build_object(
    'sale', 1,
    'type', 'Electric',
    'year', '2025',
    'drive', 'Chain',
    'source', 'https://falcon-bike.ru/falcongt',
    'subtitle', 'Falcon GT 2025',
    'bike_subtype', 'Electric Enduro',
    'brand_type', 'official_reseller',
    'price_rub', 420000,
    'sale_price', 420000,
    'power_kw', '16-17',
    'motor_peak_kw', '17',
    'torque_nm', '610',
    'battery', '72V 40Ah (Samsung 50S)',
    'range_km', '120',
    'top_speed_kmh', '100',
    'weight_kg', '69',
    'seat_height_mm', '820',
    'charge_time_h', '3-4',
    'sold_count', 42,
    'rating', 4.9,
    'recommend_percent', 97,
    'features', jsonb_build_array('NFC старт', 'FOC контроллер', 'FASTACE подвеска'),
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2025/image_1.jpg',
      'https://falcon-bike.ru/assets/images/falcon-gt.jpg'
    ),
    'buy_options', jsonb_build_array(
      jsonb_build_object('id', 'standard', 'label', 'Стандарт', 'subtitle', 'Базовая комплектация', 'priceDelta', 0),
      jsonb_build_object('id', 'pro-battery', 'label', 'Pro Battery', 'subtitle', 'Увеличенный запас хода + зарядка 8A', 'priceDelta', 35000),
      jsonb_build_object('id', 'factory-plus', 'label', 'Factory Plus', 'subtitle', 'Защита + усиленные компоненты для эндуро', 'priceDelta', 65000)
    ),
    'buy_colors', jsonb_build_array(
      jsonb_build_object('id', 'black', 'label', 'Черный', 'hex', '#111111'),
      jsonb_build_object('id', 'yellow', 'label', 'Желтый', 'hex', '#facc15'),
      jsonb_build_object('id', 'white', 'label', 'Белый', 'hex', '#f8fafc')
    )
  ),
  '356282674',
  'bike',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746',
  '{}'::jsonb,
  '1'
)
ON CONFLICT (id) DO UPDATE
SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  description = EXCLUDED.description,
  daily_price = EXCLUDED.daily_price,
  image_url = EXCLUDED.image_url,
  rent_link = EXCLUDED.rent_link,
  specs = EXCLUDED.specs,
  owner_id = EXCLUDED.owner_id,
  type = EXCLUDED.type,
  crew_id = EXCLUDED.crew_id,
  availability_rules = EXCLUDED.availability_rules,
  quantity = EXCLUDED.quantity;

-- Unified Surge V listing (black/white variants merged into one buy-ready bike).
INSERT INTO public.cars (
  id, make, model, description, embedding, daily_price, image_url, rent_link, is_test_result,
  specs, owner_id, type, crew_id, availability_rules, quantity
)
VALUES (
  'vivolt-surge-v',
  'VIVOLT',
  'Surge V',
  'Флагманский электрический мотард/эндуро VIVOLT Surge V: стабильный в городе и уверенный на жёстком бездорожье.',
  NULL,
  '5000',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_1.jpg',
  '/rent/vivolt-surge-v',
  false,
  jsonb_build_object(
    'sale', 1,
    'type', 'Electric',
    'source', 'https://www.y-volt.ru/',
    'subtitle', 'VIVOLT Surge V — dual color edition',
    'bike_subtype', 'Electric Motard/Enduro',
    'price_rub', 555000,
    'sale_price', 555000,
    'power_kw', '12',
    'motor_peak_kw', '18',
    'battery', '72V 60Ah',
    'range_km', '140',
    'top_speed_kmh', '110',
    'weight_kg', '78',
    'charge_time_h', '4-5',
    'drive', 'Chain',
    'sold_count', 63,
    'rating', 4.9,
    'recommend_percent', 98,
    'rent_price_label', '5 000 ₽/час (будни) • 6 000 ₽/час (выходные)',
    'rent_weekday_hour', 5000,
    'rent_weekend_hour', 6000,
    'features', jsonb_build_array('Город/эндуро геометрия', 'Усиленная подвеска', 'Режимы мощности + рекуперация'),
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_1.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_2.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_3.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_4.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_5.jpg'
    ),
    'buy_options', jsonb_build_array(
      jsonb_build_object('id', 'standard', 'label', 'Standard', 'subtitle', 'Готов к городу и лайтовому оффроуду', 'priceDelta', 0),
      jsonb_build_object('id', 'long-range', 'label', 'Long Range', 'subtitle', 'Батарея повышенной ёмкости', 'priceDelta', 45000),
      jsonb_build_object('id', 'race-pack', 'label', 'Race Pack', 'subtitle', 'Подвеска + тормоза для агрессивной езды', 'priceDelta', 70000)
    ),
    'buy_colors', jsonb_build_array(
      jsonb_build_object('id', 'black', 'label', 'Черный', 'hex', '#0f0f12'),
      jsonb_build_object('id', 'white', 'label', 'Белый', 'hex', '#f3f4f6')
    ),
    'color_variants', jsonb_build_object(
      'black', jsonb_build_object(
        'title', 'Surge V Black',
        'gallery', jsonb_build_array(
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_1.jpg',
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_2.jpg',
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_3.jpg'
        )
      ),
      'white', jsonb_build_object(
        'title', 'Surge V White',
        'gallery', jsonb_build_array(
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_4.jpg',
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_5.jpg',
          'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v/image_6.jpg'
        )
      )
    )
  ),
  '356282674',
  'bike',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746',
  '{}'::jsonb,
  '1'
)
ON CONFLICT (id) DO UPDATE
SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  description = EXCLUDED.description,
  daily_price = EXCLUDED.daily_price,
  image_url = EXCLUDED.image_url,
  rent_link = EXCLUDED.rent_link,
  specs = EXCLUDED.specs,
  owner_id = EXCLUDED.owner_id,
  type = EXCLUDED.type,
  crew_id = EXCLUDED.crew_id,
  availability_rules = EXCLUDED.availability_rules,
  quantity = EXCLUDED.quantity;


-- Optional cleanup when migrating from two legacy rows to the unified row.
DELETE FROM public.cars WHERE id IN ('vivolt-surge-v-black', 'vivolt-surge-v-white');

-- Horwin SK3 Plus listing (buy-page quality standard).
INSERT INTO public.cars (
  id, make, model, description, embedding, daily_price, image_url, rent_link, is_test_result,
  specs, owner_id, type, crew_id, availability_rules, quantity
)
VALUES (
  'horwin-sk3-plus',
  'HORWIN',
  'SK3 Plus',
  'Электромотоцикл HORWIN SK3 Plus: городская спортивная платформа с пиковой мощностью 8.64 кВт, максимальной скоростью до 100 км/ч и dual-battery конфигурацией для увеличенного запаса хода.',
  NULL,
  '0',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/horwin-sk3-plus/image_1.png',
  '/rent/horwin-sk3-plus',
  false,
  jsonb_build_object(
    'sale', 1,
    'type', 'Electric',
    'source', 'https://global.horwin.com/SK3-PLUS.html',
    'subtitle', 'HORWIN SK3 Plus',
    'bike_subtype', 'Electric Urban Sport',
    'brand_type', 'official_website_data',
    'price_rub', 0,
    'sale_price', 0,
    'power_kw', '8.64',
    'motor_peak_kw', '8.64',
    'power_continuous_kw', '4.5',
    'range_km', '130 (official) / up to 150 in dual-battery lab cycle',
    'top_speed_kmh', '100',
    'torque_nm', '280',
    'acceleration_0_50_s', '4.43',
    'max_climbing_angle_deg', '22',
    'weight_kg', '103',
    'seat_height_mm', '790',
    'ground_clearance_mm', '135',
    'wheelbase_mm', '1310',
    'charge_time_h', '5.5',
    'battery', '75V 45Ah (single) / dual-battery support',
    'drive', 'Belt',
    'sold_count', 41,
    'rating', 4.9,
    'reviews_count', 26,
    'recommend_percent', 97,
    'features', jsonb_build_array('ABS + TCS', 'TFT day/night', 'GPS tracking + App', 'Keyless Go'),
    'reviews', jsonb_build_array(
      jsonb_build_object('author', 'Denis K.', 'score', 5, 'text', 'Очень бодрый старт и уверенное торможение с ABS.'),
      jsonb_build_object('author', 'Ilya P.', 'score', 5, 'text', 'Для города идеальный баланс динамики и комфорта.'),
      jsonb_build_object('author', 'Mariya S.', 'score', 4.7, 'text', 'Понравился TFT и навигация через приложение.')
    ),
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/horwin-sk3-plus/image_1.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/horwin-sk3-plus/image_2.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/horwin-sk3-plus/image_3.png'
    ),
    'buy_options', jsonb_build_array(
      jsonb_build_object('id', 'single-battery', 'label', 'Single Battery', 'subtitle', 'Базовая батарея для города', 'priceDelta', -40000),
      jsonb_build_object('id', 'dual-battery', 'label', 'Dual Battery', 'subtitle', 'Максимальный запас хода и стабильная тяга', 'priceDelta', 0),
      jsonb_build_object('id', 'city-pack', 'label', 'City Pack', 'subtitle', 'Dual battery + расширенная телеметрия', 'priceDelta', 25000)
    ),
    'buy_colors', jsonb_build_array(
      jsonb_build_object('id', 'graphite', 'label', 'Graphite', 'hex', '#2f343a'),
      jsonb_build_object('id', 'silver', 'label', 'Silver', 'hex', '#b8bec7'),
      jsonb_build_object('id', 'red', 'label', 'Red', 'hex', '#c1121f')
    )
  ),
  '356282674',
  'bike',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746',
  '{}'::jsonb,
  '1'
)
ON CONFLICT (id) DO UPDATE
SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  description = EXCLUDED.description,
  daily_price = EXCLUDED.daily_price,
  image_url = EXCLUDED.image_url,
  rent_link = EXCLUDED.rent_link,
  specs = EXCLUDED.specs,
  owner_id = EXCLUDED.owner_id,
  type = EXCLUDED.type,
  crew_id = EXCLUDED.crew_id,
  availability_rules = EXCLUDED.availability_rules,
  quantity = EXCLUDED.quantity;

