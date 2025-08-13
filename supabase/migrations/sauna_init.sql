-- Insert sauna as a "car" entry but with type='sauna'
-- Insert sauna as a vehicle (type = 'sauna')
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
  owner_id
) VALUES (
  'sauna-001',
  'OneSaunaPls',
  'САУНА-ВОЛНА',
  'Финская древесная сауна: горячая парная, джакузи, прохладный бассейн и уютная гостиная — идеальное место до 12 гостей.',
  500,
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/IMG_20250812_205713_766.jpg',
  '/sauna-rent',
  false,
  'sauna',
  jsonb_build_object(
    'title', 'САУНА-ВОЛНА',
    'capacity_total', 12,
    'capacity_parilka', 6,
    'capacity_jacuzzi', 2,
    'number_of_jacuzzi', 1,
    'table_seats', 8,
    'min_rental_hours', 2,
    'heat_source', 'wood',
    'water_source', 'natural_spring',
    'includes', array['веник', 'полотенца', 'ароматерапия'],
    'shop_items', jsonb_build_object(
      'venik', jsonb_build_object('price', 300, 'note', 'Берёзовый/дубовый'),
      'slippers', jsonb_build_object('price', 400, 'note', 'одноразовые/текстильные'),
      'towels', jsonb_build_object('price', 700, 'note', 'большие банные'),
      'bathrobe', jsonb_build_object('price', 1500, 'note', 'микрофибра'),
      'oils', jsonb_build_object('price', 200, 'note', 'эфирные масла по вкусу')
    ),
    'extras', jsonb_build_object(
      'cinema_flat', 3000,
      'parilshchik_flat', 1200,
      'shop_flat', 0
    ),
    'base_pricing', jsonb_build_object(
      'weekday_morning_hrs', '09:00-15:00',
      'weekday_morning_price_per_hour', 1500,
      'weekday_evening_hrs', '15:00-02:00',
      'weekday_evening_price_per_hour', 2000,
      'weekend_day_hrs', '09:00-15:00',
      'weekend_day_price_per_hour', 2000,
      'weekend_night_hrs', '15:00-05:00',
      'weekend_night_price_per_hour', 2500,
      'friday_extended_multiplier', 1.15
    ),
    'special_notes', 'Макс 12 чел; минимальная аренда 2 часа; гостям отеля Волна — скидки 20-30% (в зависимости от occupancy и частоты посещений).'
  ),
  '413553377'
)
ON CONFLICT (id) DO NOTHING;