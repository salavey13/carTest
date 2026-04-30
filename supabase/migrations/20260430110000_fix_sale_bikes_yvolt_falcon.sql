-- Correct sale bikes set: 3 Y-VOLT variants + 1 Falcon GT (source-corrected)
DELETE FROM public.cars WHERE id IN (
  'yvolt-surge-v-pro',
  'falcon-gt-2025',
  'yvolt-surge-v-core',
  'yvolt-surge-v-street',
  'yvolt-surge-v-trail'
);

INSERT INTO public.cars (
  id, make, model, description, daily_price, image_url, rent_link, is_test_result, type, specs, owner_id, crew_id
)
VALUES
(
  'yvolt-surge-v-core', 'Y-VOLT', 'Surge V Core',
  'Электромотоцикл Y-VOLT Surge V из официальной линейки. Подходит для города и легкого бездорожья.',
  4200,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-core/image_1.png',
  '/rent/yvolt-surge-v-core', false, 'bike',
  jsonb_build_object(
    'type','Electric','subtitle','Y-VOLT Surge V Core','bike_subtype','Electric Enduro','sale',1,'price_rub',420000,
    'power_kw','15','motor_peak_kw','35','battery','97.2V 45Ah (4.3 kWh, Samsung)','range_km','120-150','top_speed_kmh','110',
    'torque_nm','900+','weight_kg','92','charge_time_h','3','seat_height_mm','900','drive','Chain',
    'brand_type','official','year','2025','source','https://www.yvolt.com/products/surge-v',
    'gallery',jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-core/image_1.png')
  ),
  '356282674','2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'yvolt-surge-v-street', 'Y-VOLT', 'Surge V Street',
  'Электромотоцикл Y-VOLT Surge V из официальной линейки. Подходит для города и легкого бездорожья.',
  4500,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-street/image_1.png',
  '/rent/yvolt-surge-v-street', false, 'bike',
  jsonb_build_object(
    'type','Electric','subtitle','Y-VOLT Surge V Street','bike_subtype','Electric Enduro','sale',1,'price_rub',450000,
    'power_kw','15','motor_peak_kw','35','battery','97.2V 45Ah (4.3 kWh, Samsung)','range_km','120-150','top_speed_kmh','110',
    'torque_nm','900+','weight_kg','92','charge_time_h','3','seat_height_mm','900','drive','Chain',
    'brand_type','official','year','2025','source','https://www.yvolt.com/products/surge-v',
    'gallery',jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-street/image_1.png')
  ),
  '356282674','2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'yvolt-surge-v-trail', 'Y-VOLT', 'Surge V Trail',
  'Электромотоцикл Y-VOLT Surge V из официальной линейки. Подходит для города и легкого бездорожья.',
  4700,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-trail/image_1.png',
  '/rent/yvolt-surge-v-trail', false, 'bike',
  jsonb_build_object(
    'type','Electric','subtitle','Y-VOLT Surge V Trail','bike_subtype','Electric Enduro','sale',1,'price_rub',470000,
    'power_kw','15','motor_peak_kw','35','battery','97.2V 45Ah (4.3 kWh, Samsung)','range_km','120-150','top_speed_kmh','110',
    'torque_nm','900+','weight_kg','92','charge_time_h','3','seat_height_mm','900','drive','Chain',
    'brand_type','official','year','2025','source','https://www.yvolt.com/products/surge-v',
    'gallery',jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-trail/image_1.png')
  ),
  '356282674','2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'falcon-gt-2025', '79BIKE', 'Falcon GT',
  'Мощный электрический эндуро-байк для бездорожья. Высокая динамика, легкий вес и адаптивная электроника.',
  0,
  'https://falcon-bike.ru/assets/images/falcon-gt.jpg',
  '/rent/falcon-gt-2025', false, 'bike',
  jsonb_build_object(
    'type','Electric','subtitle','Falcon GT 2025','bike_subtype','Electric Enduro','sale',1,'price_rub',420000,
    'power_kw','16-17','motor_peak_kw','17','battery','72V 40Ah (Samsung 50S)','range_km','120','top_speed_kmh','100',
    'torque_nm','610','weight_kg','69','charge_time_h','3-4','seat_height_mm','820','drive','Chain',
    'brand_type','official_reseller','year','2025',
    'features',jsonb_build_array('NFC старт','FOC контроллер','FASTACE подвеска'),
    'source','https://falcon-bike.ru/falcongt',
    'gallery',jsonb_build_array('https://falcon-bike.ru/assets/images/falcon-gt.jpg')
  ),
  '356282674','2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
)
ON CONFLICT (id) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  description = EXCLUDED.description,
  daily_price = EXCLUDED.daily_price,
  image_url = EXCLUDED.image_url,
  rent_link = EXCLUDED.rent_link,
  is_test_result = EXCLUDED.is_test_result,
  type = EXCLUDED.type,
  specs = EXCLUDED.specs,
  owner_id = EXCLUDED.owner_id,
  crew_id = EXCLUDED.crew_id;
