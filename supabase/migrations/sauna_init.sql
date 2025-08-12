-- Insert sauna as a vehicle (type = 'sauna') for "САУНА-ВОЛНА"
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
  'SaunaVolna',
  'САУНА-ВОЛНА',
  'Финская деревянная парная с видом, джакузи на двоих, прохладный бассейн и гостиная — до 12 человек. Всё для комфортной частной сессии и вечеринки.',
  500,
  'https://placehold.co/1200x800?text=Sauna+Volna+Placeholder', -- замените на реальную картинку
  '/sauna-rent',
  false,
  'sauna',
  jsonb_build_object(
    'capacity_room', 12,
    'capacity_parilka', 6,
    'min_rental_hours', 2,
    'heat_source', 'wood',
    'water_source', 'natural_spring',
    'includes', array['веник','полотенца','ароматерапия'],
    'max_people', 12,
    'table_seats', 8,
    'jacuzzi', jsonb_build_object('count', 1, 'seats', 2),
    'extras', jsonb_build_object(
      'cinema_flat', 3000,
      'parilshik_flat', 1200,
      'shop_example_item_price', 200
    ),
    'base_pricing', jsonb_build_object(
      'weekdayHour', 1500,
      'weekendHour', 2000,
      'friday_to_monday_hour', 2000,
      'friday_start_hour', 15,
      'friday_end_hour_mon', 9
    ),
    'special_notes', 'Макс 12 чел; парилка — 6 мест; джакузи — 1 шт (2 перс.); стол на 8; минимальная аренда 2 часа'
  ),
  '413553377'
)
ON CONFLICT (id) DO NOTHING;