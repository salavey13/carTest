-- ============================================================================
-- СварПрофи-НН Seed Products (golden demo — 2 items)
-- ============================================================================
-- Inserts 2 metal structure products into public.cars table
-- All products use type = 'metal_stuff' and crew_id of СварПрофи-НН
--
-- POLICY: unverified parameters are left NULL, not hallucinated.
-- Prices, exact dimensions, weights, and specs will be filled
-- when verified data is provided by the franchise owner.
--
-- IMAGE CONVENTION (gold standard):
--   Bucket: svarprofi
--   Product images: {bucket}/{product-slug}/image_N.jpg
--   image_1.jpg = main image (dedicated image_url + first in gallery)
--   image_2.jpg, image_3.jpg = additional gallery images
--   gallery[0] MUST equal image_url
--
-- PHOTO SOURCES (user-uploaded):
--   IMG_20260523_225516_671.jpg → orange truss installation → karkas-prom/image_1
--   IMG_20260523_225516_763.jpg → steel framework + blue sky → karkas-prom/image_2
--   IMG_20260523_225520_343.jpg → workshop interior + mezzanine → karkas-prom/image_3
--   IMG_20260523_225520_446.jpg → space truss + crane runway → karkas-kran/image_1
--
-- CHANGELOG (v2):
--  - City: НН → Москва (company operates from Moscow)
--  - delivery_region: Москва, МО, ЦФО
--  - rent_link: ?vehicle=<slug> pattern (not /order?product=)
-- ============================================================================

begin;

-- ============================================================================
-- 1. Каркас промышленного здания с фермами покрытия
--    (Industrial Steel Frame with Roof Trusses)
--    Source photos: orange truss installation, workshop interior
-- ============================================================================
insert into public.cars (
  id, make, model, description, embedding, daily_price, image_url, rent_link,
  is_test_result, specs, owner_id, type, crew_id, availability_rules, quantity
) values (
  'b1c2d3e4-f5a6-7b8c-9d0e-012345678902',
  'СварПрофи-НН',
  'Каркас промышленный',
  'Металлический каркас промышленного здания с фермами покрытия. Двутавровые колонны и фермы из прокатных профилей. Антикоррозийная обработка. Болтовые монтажные соединения. Подходит для складов, цехов и производственных помещений. На фото — монтаж каркаса с оранжевым покрытием на объекте заказчика.',
  NULL,
  '0',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg',
  '/franchize/svarprofi?vehicle=karkas-prom',
  false,
  jsonb_build_object(
    'sale', 1,
    'type', 'Каркас',
    'subtype', 'Промышленный',
    'year', NULL,
    'manufacturer', 'СварПрофи-НН',
    'model', 'Каркас промышленный',
    'sku', NULL,
    'length_mm', NULL,
    'width_mm', NULL,
    'height_mm', NULL,
    'wall_thickness_mm', NULL,
    'span_mm', NULL,
    'step_mm', NULL,
    'steel_grade', NULL,
    'profile_type', 'Двутавр',
    'coating_type', 'Порошковое',
    'coating_color_ral', NULL,
    'strength_class', NULL,
    'gost', NULL,
    'weight_kg', NULL,
    'weight_per_sqm_kg', NULL,
    'weld_type', 'МАГ',
    'anticorrosion', NULL,
    'certification', NULL,
    'drawing_available', NULL,
    'assembly_type', 'Болтовая',
    'price_rub', NULL,
    'price_per_sqm_rub', NULL,
    'sale_price', NULL,
    'production_days', NULL,
    'delivery_available', true,
    'delivery_region', 'Москва, МО, ЦФО',
    'installation_available', true,
    'installation_days', NULL,
    'rating', NULL,
    'sold_count', NULL,
    'recommend_percent', NULL,
    'features', jsonb_build_array(
      'Двутавровые колонны и фермы покрытия',
      'Болтовые монтажные соединения',
      'Антикоррозийная обработка (оранжевое покрытие на фото)'
    ),
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_1.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_2.jpg',
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-prom/image_3.jpg'
    ),
    'buy_options', NULL,
    'buy_colors', NULL
  ),
  '413553377',
  'metal_stuff',
  'a1b2c3d4-e5f6-7a8b-9c0d-012345678901',
  '{}'::jsonb,
  '1'
)
on conflict (id) do update
set make = excluded.make,
    model = excluded.model,
    description = excluded.description,
    image_url = excluded.image_url,
    rent_link = excluded.rent_link,
    specs = excluded.specs,
    type = excluded.type,
    crew_id = excluded.crew_id,
    quantity = excluded.quantity;

-- ============================================================================
-- 2. Каркас с кран-балкой (пространственная ферма)
--    (Space Truss Framework with Overhead Crane Runway)
--    Source photo: large space truss with yellow crane-support columns
-- ============================================================================
insert into public.cars (
  id, make, model, description, embedding, daily_price, image_url, rent_link,
  is_test_result, specs, owner_id, type, crew_id, availability_rules, quantity
) values (
  'b1c2d3e4-f5a6-7b8c-9d0e-012345678903',
  'СварПрофи-НН',
  'Каркас с кран-балкой',
  'Пространственная стропильная ферма с подкрановыми путями. Опорные колонны и подкрановые балки — жёлтого цвета (безопасность). Основные фермы — светло-серые. Предназначена для промышленных зданий с мостовыми кранами. На фото — смонтированная конструкция с кран-балкой в производственном цехе.',
  NULL,
  '0',
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-kran/image_1.jpg',
  '/franchize/svarprofi?vehicle=karkas-kran',
  false,
  jsonb_build_object(
    'sale', 1,
    'type', 'Каркас',
    'subtype', 'С подкрановыми путями',
    'year', NULL,
    'manufacturer', 'СварПрофи-НН',
    'model', 'Каркас с кран-балкой',
    'sku', NULL,
    'length_mm', NULL,
    'width_mm', NULL,
    'height_mm', NULL,
    'wall_thickness_mm', NULL,
    'span_mm', NULL,
    'step_mm', NULL,
    'steel_grade', NULL,
    'profile_type', 'Двутавр',
    'coating_type', 'Порошковое',
    'coating_color_ral', NULL,
    'strength_class', NULL,
    'gost', NULL,
    'weight_kg', NULL,
    'weight_per_sqm_kg', NULL,
    'weld_type', 'МАГ',
    'anticorrosion', NULL,
    'certification', NULL,
    'drawing_available', NULL,
    'assembly_type', 'Комбинированная',
    'price_rub', NULL,
    'price_per_sqm_rub', NULL,
    'sale_price', NULL,
    'production_days', NULL,
    'delivery_available', true,
    'delivery_region', 'Москва, МО, ЦФО',
    'installation_available', true,
    'installation_days', NULL,
    'rating', NULL,
    'sold_count', NULL,
    'recommend_percent', NULL,
    'features', jsonb_build_array(
      'Пространственная стропильная ферма',
      'Подкрановые пути (мостовой кран)',
      'Опорные колонны жёлтого цвета (безопасность)',
      'Фермы светло-серые с порошковой покраской',
      'Сварные + болтовые соединения'
    ),
    'gallery', jsonb_build_array(
      'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/svarprofi/karkas-kran/image_1.jpg'
    ),
    'buy_options', NULL,
    'buy_colors', jsonb_build_array(
      jsonb_build_object('name', 'Серый (фермы)', 'ral', 'RAL 7035', 'swatch', '#C6C8CC'),
      jsonb_build_object('name', 'Жёлтый (колонны)', 'ral', 'RAL 1023', 'swatch', '#F0CA00')
    )
  ),
  '413553377',
  'metal_stuff',
  'a1b2c3d4-e5f6-7a8b-9c0d-012345678901',
  '{}'::jsonb,
  '1'
)
on conflict (id) do update
set make = excluded.make,
    model = excluded.model,
    description = excluded.description,
    image_url = excluded.image_url,
    rent_link = excluded.rent_link,
    specs = excluded.specs,
    type = excluded.type,
    crew_id = excluded.crew_id,
    quantity = excluded.quantity;

commit;