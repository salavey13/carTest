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
  'Tibet Sauna',
  'Деревянная финская сауна с паром, ароматами эвкалипта и видом на закат. Расслабление без компромиссов.',
  500,
  'https://placehold.co/1200x800?text=Sauna+Placeholder', -- replace with your real image
  '/sauna-rent', -- or '/rent/sauna-001' depending on your routing
  false,
  'sauna',
  jsonb_build_object(
    'capacity_room', 15,
    'capacity_parilka', 6,
    'min_rental_hours', 2,
    'heat_source', 'wood',
    'water_source', 'natural_spring',
    'includes', array['веник','полотенца','ароматерапия'],
    'max_people', 15,
    'extras', jsonb_build_object(
      'cinema_flat', 3000,
      'jacuzzi_flat', 800,
      'cleaning_flat', 500
    ),
    'base_pricing', jsonb_build_object(
      'weekdayDay', 1500,
      'weekdayEvening', 2000,
      'weekendDay', 2200,
      'weekendEvening', 2700,
      'fridayExtendedMultiplier', 1.15
    ),
    'special_notes', 'Доступно вечернее освещение и музыка; макс 15 чел; пятница — удлинённый режим'
  ),
  '413553377'
)
ON CONFLICT (id) DO NOTHING;