INSERT INTO public.cars (
  id,
  make,
  model,
  description,
  daily_price,
  image_url,
  rent_link,
  is_test_result,
  type,
  specs,
  owner_id,
  crew_id
)
VALUES
  (
    'yvolt-surge-v-core',
    'Y-VOLT',
    'Surge V Core',
    'Электромотоцикл Y-VOLT Surge V из официальной линейки y-volt.ru. Подходит для города и легкого бездорожья.',
    4200,
    'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-core/image_1.png',
    '/rent/yvolt-surge-v-core',
    false,
    'bike',
    jsonb_build_object(
      'type', 'Electric',
      'subtitle', 'Y-VOLT Surge V',
      'bike_subtype', 'Electric Enduro',
      'power_kw', '15+',
      'sale', 1,
      'source', 'https://www.y-volt.ru/',
      'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-core/image_1.png')
    ),
    '356282674',
    '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  ),
  (
    'yvolt-surge-v-street',
    'Y-VOLT',
    'Surge V Street',
    'Электромотоцикл Y-VOLT Surge V из официальной линейки y-volt.ru. Подходит для города и легкого бездорожья.',
    4500,
    'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-street/image_1.png',
    '/rent/yvolt-surge-v-street',
    false,
    'bike',
    jsonb_build_object(
      'type', 'Electric',
      'subtitle', 'Y-VOLT Surge V',
      'bike_subtype', 'Electric Enduro',
      'power_kw', '15+',
      'sale', 1,
      'source', 'https://www.y-volt.ru/',
      'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-street/image_1.png')
    ),
    '356282674',
    '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  ),
  (
    'yvolt-surge-v-trail',
    'Y-VOLT',
    'Surge V Trail',
    'Электромотоцикл Y-VOLT Surge V из официальной линейки y-volt.ru. Подходит для города и легкого бездорожья.',
    4700,
    'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-trail/image_1.png',
    '/rent/yvolt-surge-v-trail',
    false,
    'bike',
    jsonb_build_object(
      'type', 'Electric',
      'subtitle', 'Y-VOLT Surge V',
      'bike_subtype', 'Electric Enduro',
      'power_kw', '15+',
      'sale', 1,
      'source', 'https://www.y-volt.ru/',
      'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-trail/image_1.png')
    ),
    '356282674',
    '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  ),
  (
    'yvolt-surge-v-pro',
    'Y-VOLT',
    'Surge V Pro',
    'Электромотоцикл Y-VOLT Surge V из официальной линейки y-volt.ru. Подходит для города и легкого бездорожья.',
    5200,
    'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-pro/image_1.png',
    '/rent/yvolt-surge-v-pro',
    false,
    'bike',
    jsonb_build_object(
      'type', 'Electric',
      'subtitle', 'Y-VOLT Surge V',
      'bike_subtype', 'Electric Enduro',
      'power_kw', '15+',
      'sale', 1,
      'source', 'https://www.y-volt.ru/',
      'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/yvolt-surge-v-pro/image_1.png')
    ),
    '356282674',
    '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  )
ON CONFLICT (id) DO UPDATE
SET
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
