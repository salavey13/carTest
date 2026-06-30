-- Rerode R1+ seed (Electric Enduro, 2026)
-- Added to public.cars. Idempotent.
-- Source specs: https://rerode.ru/r1plus (+ dealer listings: rerode.bike, rerode.co.nz, epiccycles.ca)
-- Sale price 450 000 RUB. Rental rates mirrored from comparable Falcon GT (17 kW class).
-- NOTE: image_1.jpg pending generation/upload to carpix/rerode-r1-plus/.

INSERT INTO public.cars
  (id, make, model, description, daily_price, image_url, rent_link,
   is_test_result, specs, owner_id, type, crew_id, availability_rules, quantity)
VALUES
  ('rerode-r1-plus', 'Rerode', 'R1+', 'Электрический эндуро-байк Rerode R1+ 2026: пиковая мощность 17 кВт, крутящий момент 500 Н·м (на колесе), батарея Samsung 50S 21700 72V 40Ah, запас хода до 120 км. Алюминиевая рама, подвеска FASTACE (вилка 200 мм), три режима мощности (Eco / Sport / Sport+). Класс М (49 сс) — подойдут автомобильные права, без регистрации и страховки.',
   12000, 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/rerode-r1-plus/image_1.jpg', '/rent/rerode-r1-plus',
   false,
   '{"rent": 1, "sale": true, "type": "Electric", "make": "Rerode", "model": "R1+", "year": "2026", "color": "Cyber Yellow", "drive": "Chain", "rating": 4.9, "source": "https://rerode.ru/r1plus", "battery": "72V 40Ah (Samsung 50S 21700, 2 880 Wh)", "gallery": ["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/rerode-r1-plus/image_1.jpg"], "features": ["FOC-контроллер, 3 режима мощности (Eco / Sport / Sport+)", "FASTACE подвеска — вилка с высоко-/низкоскоростной компрессией 200 мм + задний моноамортизатор 85 мм", "Гидравлические дисковые тормоза 220 мм (перед) / 203 мм (зад)", "Рекуперативное торможение (регенерация)", "2\" TFT-дисплей + мобильное приложение", "USB / Type-C зарядка устройств (5V/2400 mA)", "Защита IP65 (влагозащита)", "Бесшумная езда", "Алюминиевая рама", "Класс М (49 сс) — права категории В, без регистрации"], "power_kw": "17", "range_km": "120", "subtitle": "Rerode R1+", "price_rub": 450000, "torque_nm": "500", "voltage_v": "72", "weight_kg": "68", "brake_type": "Гидравлические дисковые 220/203 мм", "brand_type": "official_reseller", "buy_colors": [{"id": "yellow", "hex": "#FFD500", "label": "Cyber Yellow"}, {"id": "white", "hex": "#f8fafc", "label": "Polar White"}], "dailyPrice": 12000, "frame_type": "Алюминиевый сплав", "sale_price": 450000, "sold_count": 0, "tires_rear": "90/90-18", "access_tier": "entry", "rent_2_4d": 10000, "rent_5_10d": 8000, "rent_11_30d": 7000, "tires_front": "70/100-19", "bike_subtype": "Electric Enduro", "price_per_3h": 10000, "price_per_6h": 12000, "rent_weekday": 12000, "rent_weekend": 14000, "charge_time_h": "4", "license_class": "М (49 сс), подходят права В или А1", "motor_peak_kw": "17", "price_per_12h": 12000, "top_speed_kmh": "95", "price_per_hour": 5000, "seat_height_mm": "845", "suspension_type": "FASTACE — вилка с высоко-/низкоскоростной компрессией (200 мм) + задний моноамортизатор (85 мм)", "recommend_percent": 95, "ground_clearance_mm": "268", "wheelbase_mm": "1280", "dimensions_mm": "1890 × 775 × 1100", "max_load_kg": "100", "bike_engine_spec_line_1": "мощность двигателя (номинальная) 17 кВт", "bike_engine_spec_line_2": "максимальная конструктивная скорость 95 км/ч", "bike_engine_spec_line_3": "аккумулятор: тип/ёмкость 72V 40Ah (Samsung 50S 21700, 2 880 Wh)", "spec_labels": {"type": "Тип", "year": "Год", "make": "Производитель", "model": "Модель", "color": "Цвет", "drive": "Привод", "rating": "Рейтинг", "battery": "Батарея", "power_kw": "Пиковая мощность", "range_km": "Запас хода", "price_rub": "Цена", "torque_nm": "Крутящий момент", "voltage_v": "Напряжение", "weight_kg": "Масса", "brake_type": "Тормоза", "dailyPrice": "Аренда (сутки)", "frame_type": "Рама", "sale_price": "Цена продажи", "sold_count": "Продано", "tires_rear": "Задняя резина", "rent_2_4d": "Аренда (2–4 суток)", "rent_5_10d": "Аренда (5–10 суток)", "rent_11_30d": "Аренда (11–30 суток)", "tires_front": "Передняя резина", "bike_subtype": "Тип мотоцикла", "price_per_3h": "Аренда (3 часа)", "price_per_6h": "Аренда (6 часов)", "rent_weekday": "Аренда (будни)", "rent_weekend": "Аренда (выходные)", "charge_time_h": "Время зарядки", "license_class": "Категория прав", "motor_peak_kw": "Пиковая мощность мотора", "price_per_12h": "Аренда (12 часов)", "top_speed_kmh": "Макс. скорость", "price_per_hour": "Аренда (1 час)", "seat_height_mm": "Высота по седлу", "suspension_type": "Подвеска", "brand_type": "Тип бренда", "recommend_percent": "Рекомендация", "ground_clearance_mm": "Дорожный просвет", "wheelbase_mm": "Колёсная база", "dimensions_mm": "Габариты", "max_load_kg": "Макс. нагрузка"}}'::jsonb,
   356282674, 'bike', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746',
   '{}'::jsonb, 1)
ON CONFLICT (id) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  description = EXCLUDED.description,
  daily_price = EXCLUDED.daily_price,
  image_url = EXCLUDED.image_url,
  rent_link = EXCLUDED.rent_link,
  specs = EXCLUDED.specs,
  type = EXCLUDED.type,
  quantity = EXCLUDED.quantity;
