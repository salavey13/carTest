DELETE FROM public.cars WHERE id LIKE 'yvolt-surge-v-%';

INSERT INTO public.cars (
  id, make, model, description, daily_price, image_url, rent_link, is_test_result, type, specs, owner_id, crew_id
) VALUES
(
  'vivolt-surge-v-black',
  'VIVOLT',
  'Surge V Black',
  'Флагманский электрический мотард/эндуро VIVOLT Surge V в черном цвете: уверенно едет по городу на мотард-колесах и держит жёсткое бездорожье с большим запасом тяги и прочной подвеской.',
  5000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_1.png',
  '/rent/vivolt-surge-v-black',
  false,
  'bike',
  jsonb_build_object(
    'sale', 1,
    'sale_price', 555000,
    'rent_weekday_hour', 5000,
    'rent_weekend_hour', 6000,
    'rent_price_label', '5 000 ₽/час (будни) • 6 000 ₽/час (выходные)',
    'type', 'Electric',
    'subtitle', 'VIVOLT Surge V — black edition',
    'bike_subtype', 'Electric',
    'source', 'https://www.y-volt.ru/',
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_1.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_2.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_3.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_4.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-black/image_5.png'
    )
  ),
  '356282674',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'vivolt-surge-v-white',
  'VIVOLT',
  'Surge V White',
  'Флагманский электрический мотард/эндуро VIVOLT Surge V в белом цвете: комфортен в городе, стабилен на высоком темпе и создан для сильного и жёсткого бездорожья.',
  5000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_1.png',
  '/rent/vivolt-surge-v-white',
  false,
  'bike',
  jsonb_build_object(
    'sale', 1,
    'sale_price', 555000,
    'rent_weekday_hour', 5000,
    'rent_weekend_hour', 6000,
    'rent_price_label', '5 000 ₽/час (будни) • 6 000 ₽/час (выходные)',
    'type', 'Electric',
    'subtitle', 'VIVOLT Surge V — white edition',
    'bike_subtype', 'Electric',
    'source', 'https://www.y-volt.ru/',
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_1.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_2.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_3.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_4.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-surge-v-white/image_5.png'
    )
  ),
  '356282674',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'vivolt-motard-wheels',
  'VIVOLT',
  'Мотард колёса (город)',
  'Комплект городских мотард-колёс для VIVOLT Surge V: точная управляемость и стабильность на асфальте.',
  65000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-motard-wheels/image_1.png',
  '/rent/vivolt-motard-wheels',
  false,
  'accessories',
  jsonb_build_object(
    'sale', 1,
    'sale_price', 65000,
    'type', 'Accessories',
    'subtitle', 'Городские мотард колёса',
    'source', 'https://www.y-volt.ru/',
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-motard-wheels/image_1.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-motard-wheels/image_2.png',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-motard-wheels/image_3.png'
    )
  ),
  '356282674',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'vivolt-helmet-black',
  'VIVOLT',
  'Шлем Black Edition',
  'Черный шлем под VIVOLT Surge V Black.',
  15000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-helmet-black/image_1.png',
  '/rent/vivolt-helmet-black',
  false,
  'accessories',
  jsonb_build_object(
    'sale', 1,
    'sale_price', 15000,
    'type', 'Accessories',
    'subtitle', 'Шлем (черный)',
    'source', 'https://www.y-volt.ru/',
    'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-helmet-black/image_1.png')
  ),
  '356282674',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
),
(
  'vivolt-helmet-white',
  'VIVOLT',
  'Шлем White Edition',
  'Белый шлем под VIVOLT Surge V White.',
  15000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-helmet-white/image_1.png',
  '/rent/vivolt-helmet-white',
  false,
  'accessories',
  jsonb_build_object(
    'sale', 1,
    'sale_price', 15000,
    'type', 'Accessories',
    'subtitle', 'Шлем (белый)',
    'source', 'https://www.y-volt.ru/',
    'gallery', jsonb_build_array('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vivolt-helmet-white/image_1.png')
  ),
  '356282674',
  '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
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
