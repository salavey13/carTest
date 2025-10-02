-- Batch update specs.size for 1.5 items
UPDATE "public"."cars"
SET specs = jsonb_set(specs, '{size}', '"145x205"')
WHERE id LIKE '1.5%' AND type = 'wb_item';

-- Batch update specs.size for 2 items
UPDATE "public"."cars"
SET specs = jsonb_set(specs, '{size}', '"172x205"')
WHERE id LIKE '2 %' AND type = 'wb_item';

-- Batch update specs.size for евро (not макси)
UPDATE "public"."cars"
SET specs = jsonb_set(specs, '{size}', '"200x220"')
WHERE id LIKE 'евро %' AND id NOT LIKE '%макси%' AND type = 'wb_item';

-- Batch update specs.size for евро макси
UPDATE "public"."cars"
SET specs = jsonb_set(specs, '{size}', '"220x240"')
WHERE id LIKE 'евро макси%' AND type = 'wb_item';

-- Add new wb_item: наволочка 50x70 кружева
INSERT INTO "public"."cars" ("id", "make", "model", "description", "embedding", "daily_price", "image_url", "rent_link", "is_test_result", "specs", "owner_id", "type", "crew_id", "availability_rules", "quantity")
VALUES ('наволочка 50x70 кружева', 'Наволочка Кружева', '50x70', 'Серая, кружева', null, null, 'https://inmctohsodgdohamhzag.inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wb/navolochka-50x70-kruzheva.jpg', null, 'false',
  '{"size": "50x70", "color": "gray", "season": null, "wb_sku": "", "pattern": "кружева", "ozon_sku": "наволочка 50x70 кружева", "wb_barcodes": [], "wb_warehouse_id": "226960", "ozon_warehouse_id": "23147251093000", "warehouse_locations": []}',
  null, 'wb_item', null, '{}', '1');