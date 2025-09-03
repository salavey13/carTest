-- Добавление демо-данных для WB товаров в public.cars
-- Type: 'wb_item', specs: {size, color, description}, image_url, warehouse_location JSONB

INSERT INTO public.cars (id, make, model, description, type, specs, image_url)
VALUES
('leto-odeyalo-120', 'Летнее', 'Одеяло 120x180', 'Маленькая, светло-зеленая упаковка', 'wb_item', 
 '{"size": "small", "color": "light-green", "warehouse_location": {"voxel_id": "A1"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/leto-odeyalo-120.jpg'),
 
('leto-odeyalo-150', 'Летнее', 'Одеяло 150x200', 'Средняя, зеленая упаковка', 'wb_item', 
 '{"size": "medium", "color": "green", "warehouse_location": {"voxel_id": "A2"}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/leto-odeyalo-150.jpg'),
 
-- Добавь остальные аналогично: leto-odeyalo-180,220; zima-odeyalo все размеры; podot аналогично; navolochka
('navolochka', 'Наволочка', 'Для подушки', 'Стандартная упаковка', 'wb_item', 
 '{"size": "standard", "color": "white", "warehouse_location": {"voxel_id": null}}',
 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/navolochka.jpg')
ON CONFLICT (id) DO NOTHING;