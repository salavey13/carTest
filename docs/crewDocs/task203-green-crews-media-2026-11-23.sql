-- task203 (2026-11-23) — медиа для 4 зелёных экипажей: фото 29 позиций каталога + 4 логотипа.
-- Применялся PostgREST-пейлоад (scripts/task203/process_upload.py), здесь SQL-зеркало для документации
-- и восстановления. Источники: motoprokat1.ru (страница брони, Tilda), snowmobile-nn.ru (Tilda),
-- nn.snegoprokat.ru (media/pic_folder), renta-car.ru недоступен → image-search по моделям
-- (логотип — сгенерированная монограмма РК на фирменном синем).
-- Сжатие: JPEG q80 max-w 1280 (фото), PNG 512×512 contain (лого). Bucket: carpix/{carId}/image_1.jpg, about/{slug}-logo.png.

UPDATE public.crews SET logo_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/renta-car-logo.png' WHERE slug = 'renta-car';
UPDATE public.crews SET logo_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/motoprokat1-logo.png' WHERE slug = 'motoprokat1';
UPDATE public.crews SET logo_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/snowmobile-nn-logo.png' WHERE slug = 'snowmobile-nn';
UPDATE public.crews SET logo_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/snegoprokat-nn-logo.png' WHERE slug = 'snegoprokat-nn';

UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-g310r/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-g310r/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-g310r/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-bmw-g310r';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-r1200gs/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-r1200gs/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-r1200gs/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-bmw-r1200gs';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000r/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000r/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000r/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-bmw-s1000r';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000xr/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000xr/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-bmw-s1000xr/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-bmw-s1000xr';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-ducati-diavel/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-ducati-diavel/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-ducati-diavel/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-ducati-diavel';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-kawasaki-ninja/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-kawasaki-ninja/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-kawasaki-ninja/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-kawasaki-ninja';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt07/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt07/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt07/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-yamaha-mt07';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt09/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt09/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-mt09/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-yamaha-mt09';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-r6/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-r6/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-r6/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-yamaha-r6';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-xsr700/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-xsr700/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/motoprokat1-yamaha-xsr700/image_1.jpg"]'::jsonb, true)
 WHERE id = 'motoprokat1-yamaha-xsr700';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-camry/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-camry/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-camry/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-camry';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-creta/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-creta/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-creta/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-creta';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-duster/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-duster/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-duster/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-duster';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-granta/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-granta/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-granta/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-granta';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-h1/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-h1/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-h1/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-h1';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-k5/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-k5/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-k5/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-k5';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-octavia/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-octavia/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-octavia/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-octavia';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-priora-wagon/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-priora-wagon/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-priora-wagon/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-priora-wagon';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rapid/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rapid/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rapid/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-rapid';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rav4/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rav4/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-rav4/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-rav4';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-solaris';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris-at/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris-at/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/renta-car-solaris-at/image_1.jpg"]'::jsonb, true)
 WHERE id = 'renta-car-solaris-at';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-1h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-1h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-1h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snegoprokat-nn-ride-1h';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-2h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-2h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-ride-2h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snegoprokat-nn-ride-2h';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-1h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-1h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-1h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snegoprokat-nn-tandem-1h';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-2h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-2h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snegoprokat-nn-tandem-2h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snegoprokat-nn-tandem-2h';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snowmobile-nn-ride-1h';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h30/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h30/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-1h30/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snowmobile-nn-ride-1h30';
UPDATE public.cars SET image_url = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-2h/image_1.jpg'
  , specs = jsonb_set(jsonb_set(specs, '{gallery}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-2h/image_1.jpg"]'::jsonb, true), '{image_urls}', '["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowmobile-nn-ride-2h/image_1.jpg"]'::jsonb, true)
 WHERE id = 'snowmobile-nn-ride-2h';
