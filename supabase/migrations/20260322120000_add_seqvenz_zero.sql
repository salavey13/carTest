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
VALUES (
  'seqvenz-zero',
  'Seqvenz',
  'Zero',
  'Мощный крутой электробайк с дерзким силуэтом и уверенной тягой. Мощность двигателя 15–30 кВт, запас хода до 300 километров. Базовую карточку уже добавили, расширенное описание и детали дополним следующим апдейтом.',
  15000,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_1.jpg',
  '/rent/seqvenz-zero',
  false,
  'bike',
  jsonb_build_object(
    'type', 'Electric',
    'engine', 'Электро',
    'subtitle', 'Мощный крутой электробайк',
    'power_kw', '15-30',
    'range_km', 300,
    'bike_subtype', 'Electric',
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_1.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_2.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_3.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_4.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_5.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_6.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_7.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/seqvenz-zero/image_8.jpg'
    )
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
