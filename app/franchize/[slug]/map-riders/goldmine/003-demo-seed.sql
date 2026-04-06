-- /sql/003-demo-seed.sql
-- Idempotent demo rider seed for smoke testing.
-- Creates 5 synthetic sessions around Strigininsky Boulevard, Nizhny Novgorod.

BEGIN;

-- Ensure demo user exists (skip if already there)
INSERT INTO public.users (user_id, username, full_name)
VALUES
  ('demo-rider-alpha', 'demo_alpha', 'Demo Alpha'),
  ('demo-rider-beta', 'demo_beta', 'Demo Beta'),
  ('demo-rider-gamma', 'demo_gamma', 'Demo Gamma'),
  ('demo-rider-delta', 'demo_delta', 'Demo Delta'),
  ('demo-rider-epsilon', 'demo_epsilon', 'Demo Epsilon')
ON CONFLICT (user_id) DO NOTHING;

-- Seed active sessions
INSERT INTO public.map_rider_sessions (
  id, crew_slug, user_id, ride_name, vehicle_label, ride_mode, visibility,
  status, sharing_enabled, started_at, last_ping_at,
  latest_lat, latest_lon, latest_speed_kmh, total_distance_km, avg_speed_kmh, max_speed_kmh
) VALUES
  (gen_random_uuid(), 'vip-bike', 'demo-rider-alpha', 'Утренний заезд', 'Yamaha MT-07', 'rental', 'crew',
   'active', true, NOW() - INTERVAL '25 minutes', NOW(),
   56.1864, 43.7851, 32.5, 4.2, 28.3, 52.1),
  (gen_random_uuid(), 'vip-bike', 'demo-rider-beta', 'Речной круг', 'Honda CB650R', 'personal', 'crew',
   'active', true, NOW() - INTERVAL '18 minutes', NOW(),
   56.1891, 43.7896, 45.8, 3.1, 38.2, 61.4),
  (gen_random_uuid(), 'vip-bike', 'demo-rider-gamma', 'Ночной дрифт', 'Kawasaki Z900', 'rental', 'crew',
   'active', true, NOW() - INTERVAL '12 minutes', NOW(),
   56.1832, 43.7920, 18.0, 1.8, 22.1, 44.8),
  (gen_random_uuid(), 'vip-bike', 'demo-rider-delta', 'Круз по городу', 'BMW R1250R', 'personal', 'crew',
   'active', true, NOW() - INTERVAL '45 minutes', NOW(),
   56.1878, 43.7865, 0.0, 7.5, 31.6, 68.2),
  (gen_random_uuid(), 'vip-bike', 'demo-rider-epsilon', 'Спринт', 'Ducati Monster', 'rental', 'crew',
   'active', true, NOW() - INTERVAL '5 minutes', NOW(),
   56.1855, 43.7838, 55.2, 0.9, 48.7, 72.3)
ON CONFLICT (id) DO NOTHING;

-- Seed live_locations
INSERT INTO public.live_locations (user_id, crew_slug, lat, lng, speed_kmh, heading, is_riding, updated_at)
VALUES
  ('demo-rider-alpha', 'vip-bike', 56.1864, 43.7851, 32.5, 45, true, NOW()),
  ('demo-rider-beta', 'vip-bike', 56.1891, 43.7896, 45.8, 120, true, NOW()),
  ('demo-rider-gamma', 'vip-bike', 56.1832, 43.7920, 18.0, 270, true, NOW()),
  ('demo-rider-delta', 'vip-bike', 56.1878, 43.7865, 0.0, 0, true, NOW()),
  ('demo-rider-epsilon', 'vip-bike', 56.1855, 43.7838, 55.2, 90, true, NOW())
ON CONFLICT (user_id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  speed_kmh = EXCLUDED.speed_kmh,
  heading = EXCLUDED.heading,
  updated_at = EXCLUDED.updated_at;

-- Seed a meetup
INSERT INTO public.map_rider_meetups (crew_slug, created_by_user_id, title, comment, lat, lon)
VALUES
  ('vip-bike', 'demo-rider-alpha', 'Точка сбора', 'Возле заправки на Стригинском', 56.1870, 43.7870)
ON CONFLICT DO NOTHING;

COMMIT;
