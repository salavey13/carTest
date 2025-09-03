-- Добавление демо-данных для WB товаров в public.cars
-- Type: 'wb_item', specs: {size, color, pattern, season, description}, image_url, warehouse_location JSONB

INSERT INTO public.cars (id, make, model, description, type, specs, image_url)
VALUES
-- Евро (бежевый, leto/zima, все узоры)
('evro-leto-kruzheva', 'Евро', 'Лето Кружева', 'Бежевая, полосочка (лето), закрытая пачка (зима)', 'wb_item', 
 '{"size": "180x220", "color": "beige", "pattern": "kruzheva", "season": "leto", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-kruzheva.jpg'),

('evro-zima-kruzheva', 'Евро', 'Зима Кружева', 'Бежевая, полузакрытая', 'wb_item', 
 '{"size": "180x220", "color": "beige", "pattern": "kruzheva", "season": "zima", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-kruzheva.jpg'),

('evro-leto-mirodel', 'Евро', 'Лето Миродель', 'Бежевая, фиолетовый узор', 'wb_item', 
 '{"size": "180x220", "color": "beige", "pattern": "mirodel", "season": "leto", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-mirodel.jpg'),

('evro-zima-mirodel', 'Евро', 'Зима Миродель', 'Бежевая, фиолетовый узор', 'wb_item', 
 '{"size": "180x220", "color": "beige", "pattern": "mirodel", "season": "zima", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-zima-mirodel.jpg'),

('evro-leto-ogurtsy', 'Евро', 'Лето Огурцы', 'Бежевая, фрактальный узор', 'wb_item', 
 '{"size": "180x220", "color": "beige", "pattern": "ogurtsy", "season": "leto", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-leto-ogurtsy.jpg'),

-- ... аналогично для zima-ogurtsy, flora1/2/3 leto/zima (добавить 6+ insert'ов для flora)

-- Двушки (голубой, 200см, все узоры, leto/zima)
('dvushka-leto-kruzheva', 'Двушка', 'Лето Кружева', 'Голубая, полосочка', 'wb_item', 
 '{"size": "200x220", "color": "blue", "pattern": "kruzheva", "season": "leto", "warehouse_location": {"voxel_id": "A2"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/dvushka-leto-kruzheva.jpg'),

-- ... все комбинации (kruzheva, mirodel, ogurtsy, flora1/2/3, leto/zima) ~12 insert'ов

-- Евро Макси (красный, большие, все узоры)
('evro-maksi-leto-kruzheva', 'Евро Макси', 'Лето Кружева', 'Красная, полосочка', 'wb_item', 
 '{"size": "220x240", "color": "red", "pattern": "kruzheva", "season": "leto", "warehouse_location": {"voxel_id": "A3"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/evro-maksi-leto-kruzheva.jpg'),

-- ... все вариации ~12

-- Матрасники (салатовый/темно-зеленый, только кружева, no season)
('matrasnik-90-kruzheva', 'Матрасник', '90 Кружева', 'Салатовый, маленький', 'wb_item', 
 '{"size": "90", "color": "light-green", "pattern": "kruzheva", "season": null, "warehouse_location": {"voxel_id": "A4"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-90-kruzheva.jpg'),

('matrasnik-120-kruzheva', 'Матрасник', '120 Кружева', 'Салатовый, маленький', 'wb_item', 
 '{"size": "120", "color": "light-green", "pattern": "kruzheva", "season": null, "warehouse_location": {"voxel_id": "A4"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-120-kruzheva.jpg'),

('matrasnik-140-kruzheva', 'Матрасник', '140 Кружева', 'Салатовый, маленький', 'wb_item', 
 '{"size": "140", "color": "light-green", "pattern": "kruzheva", "season": null, "warehouse_location": {"voxel_id": "A4"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-140-kruzheva.jpg'),

('matrasnik-160-kruzheva', 'Матрасник', '160 Кружева', 'Темно-зеленый, большой', 'wb_item', 
 '{"size": "160", "color": "dark-green", "pattern": "kruzheva", "season": null, "warehouse_location": {"voxel_id": "A4"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/matrasnik-160-kruzheva.jpg'),

-- 180,200 аналогично

-- Полуторки (серый, 150см, все узоры, leto/zima)
('polutorka-leto-kruzheva', 'Полуторка', 'Лето Кружева', 'Серая, полосочка', 'wb_item', 
 '{"size": "150x200", "color": "gray", "pattern": "kruzheva", "season": "leto", "warehouse_location": {"voxel_id": "B1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/polutorka-leto-kruzheva.jpg'),

-- ... все вариации ~12

ON CONFLICT (id) DO NOTHING;