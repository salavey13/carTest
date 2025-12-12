INSERT INTO public.cars 
(id, make, model, description, daily_price, image_url, type, owner_id, rent_link, quantity, is_test_result, specs)
VALUES 
(
  'gear-grenade-01', 
  'Taginn', 
  'R2B Evo', 
  'Pyrotechnic hand grenade. Loud bang + peas.', 
  450, 
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sball/77_0.jpg', 
  'consumable', 
  '413553377', 
  '', 
  50,
  false,
  '{
    "fuse_delay": "3.5 sec", 
    "radius": "8-10m", 
    "noise_level": "130dB", 
    "filler": "Dried Peas", 
    "safety": "Active Lever System"
  }'::jsonb
),
(
  'gear-gun-01', 
  'Cyma', 
  'M4A1', 
  'Reliable AEG. Comes with 2 mags and battery.', 
  1500, 
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sball/images13.jpeg', 
  'weapon', 
  '413553377', 
  '', 
  5,
  false,
  '{
    "fps": "380-400", 
    "power_source": "LiPo 11.1V", 
    "fire_modes": "Safe / Semi / Auto", 
    "mag_capacity": "120 rds (Mid-Cap)", 
    "weight": "2.8 kg", 
    "hop_up": "Adjustable Rotary"
  }'::jsonb
),
(
  'gear-mask-01', 
  'Dye', 
  'i5 Thermal Mask', 
  'Anti-fog lens, pro strap. Essential protection.', 
  500, 
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sball/714wAHpMXRL._AC_UF1000,1000_QL80_FMwebp_.webp', 
  'gear', 
  '413553377', 
  '', 
  10,
  false,
  '{
    "lens": "Thermal Dual Pane", 
    "anti_fog": "GSR Pro Coating", 
    "strap": "GSR Ratchet System", 
    "fov": "290 Degrees", 
    "ventilation": "Multi-Directional"
  }'::jsonb
),
(
  'gear-vest-01', 
  'Wartech', 
  'Plate Carrier', 
  'Molle system, dump pouch included. No plates.', 
  300, 
  'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sball/71RUvpDgRcL._AC_UY1000_.jpg', 
  'gear', 
  '413553377', 
  '', 
  10,
  false,
  '{
    "material": "Cordura 1000D", 
    "molle_system": "Laser Cut", 
    "size": "Adjustable (S-XL)", 
    "quick_release": "ROC Buckles", 
    "pouches": "3x Mag, 1x Admin"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
  image_url = EXCLUDED.image_url,
  specs = EXCLUDED.specs,
  daily_price = EXCLUDED.daily_price,
  description = EXCLUDED.description;
