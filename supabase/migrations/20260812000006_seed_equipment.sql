-- Migration: 20260812000006_seed_equipment.sql
-- Purpose: I5 — seed premium equipment catalog (MT brand) for all crews
-- Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Этап 2)

DO $$
DECLARE
  v_crew RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Check if any equipment already exists (avoid re-seeding)
  PERFORM 1 FROM public.cars WHERE type = 'equipment' LIMIT 1;
  IF FOUND THEN
    RAISE NOTICE 'Equipment already exists — skipping seed';
    RETURN;
  END IF;

  -- Seed equipment for all active crews
  FOR v_crew IN SELECT id, slug FROM public.crews WHERE id IS NOT NULL LOOP
    -- Шлемы
    INSERT INTO public.cars (id, crew_id, make, model, description, type, daily_price, image_url, rent_link, specs)
    VALUES
      (format('equip-helmet-street-pro-%s', v_crew.slug), v_crew.id, 'MT', 'Street Pro', 'Полицейский шлем с визором и солнцезащитной кассетой. ABS-пластик, съёмный чехол.', 'equipment', 1000, '', '', '{
        "category": "helmet", "brand": "MT", "collection": "Street",
        "materials": "ABS-пластик, вспененный EPS",
        "features": ["Встроенный солнцезащитный визор", "Съёмный подшлемник", "Быстросъёмная застёжка"],
        "safety": ["ECE 22.05", "DOT"],
        "sizes": ["S", "M", "L", "XL"],
        "colors": ["Чёрный", "Белый"],
        "badge": "bestseller", "badge_color": "#D99A00"
      }'::jsonb),

      -- Куртки
      (format('equip-jacket-trail-guard-%s', v_crew.slug), v_crew.id, 'MT', 'Trail Guard', 'Текстильная куртка для эндуро и туризма. Влагостойкая, с защитой.', 'equipment', 500, '', '', '{
        "category": "jacket", "brand": "MT", "collection": "Adventure",
        "materials": "Полиэстер 600D, мембрана Reissa",
        "protection": ["CE Level 1 плечи/локти", "Карман для защиты спины"],
        "features": ["Влагостойкая", "Съёмная подкладка"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Чёрный", "Серый"],
        "badge": "versatile", "badge_color": "#3b82f6"
      }'::jsonb),

      -- Штаны
      (format('equip-pants-trail-adv-%s', v_crew.slug), v_crew.id, 'MT', 'Trail Adv', 'Штаны для эндуро и туризма. Влагостойкие, с защитой коленей.', 'equipment', 500, '', '', '{
        "category": "pants", "brand": "MT", "collection": "Adventure",
        "materials": "Полиэстер 600D, мембрана Reissa",
        "protection": ["CE Level 1 колени", "Карман для защиты бёдер"],
        "features": ["Влагостойкие", "Регулируемая талия"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Чёрный"],
        "badge": "versatile", "badge_color": "#3b82f6"
      }'::jsonb),

      -- Перчатки
      (format('equip-gloves-summer-x-%s', v_crew.slug), v_crew.id, 'MT', 'Summer X', 'Лёгкие летние перчатки. Вентиляция, защита костяшек.', 'equipment', 500, '', '', '{
        "category": "gloves", "brand": "MT", "collection": "Summer",
        "materials": "Сетка, Clarino ладонь, TPR защита",
        "protection": ["Защита костяшек", "Слайдеры ладони"],
        "features": ["Сенсорные экраны", "Регулируемый ремень"],
        "season": ["Лето"],
        "sizes": ["S", "M", "L", "XL"],
        "colors": ["Чёрный"],
        "badge": "essential", "badge_color": "#22c55e"
      }'::jsonb),

      -- Ботинки
      (format('equip-boots-tour-adv-%s', v_crew.slug), v_crew.id, 'MT', 'Tour Adv', 'Туристические ботинки. Защита, комфорт, водостойкость.', 'equipment', 500, '', '', '{
        "category": "boots", "brand": "MT", "collection": "Adventure",
        "materials": "Кожа, влагостойкая мембрана",
        "protection": ["Защита лодыжек", "Защита голени", "Слайдеры"],
        "features": ["Влагостойкость", "Множественные застёжки"],
        "season": ["Всесезон"],
        "sizes": ["EU 40-46"],
        "colors": ["Чёрный"],
        "badge": "versatile", "badge_color": "#3b82f6"
      }'::jsonb),

      -- Замки
      (format('equip-disc-lock-pro-%s', v_crew.slug), v_crew.id, 'MT', 'Disc Lock Pro', 'Дисковый замок с сигнализацией. Надёжная защита мотоцикла.', 'equipment', 500, '', '', '{
        "category": "security", "brand": "MT", "collection": "Security",
        "materials": "Закалённая сталь",
        "features": ["Сигнализация 120дБ", "Сумка в комплекте"],
        "compatibility": "Дисковые тормоза 3-6мм",
        "colors": ["Чёрный", "Красный"],
        "badge": "security", "badge_color": "#f59e0b"
      }'::jsonb),

      -- Электроника
      (format('equip-communicator-bt-%s', v_crew.slug), v_crew.id, 'MT', 'Communicator BT', 'Bluetooth гарнитура для шлема. Связь, музыка, навигация.', 'equipment', 500, '', '', '{
        "category": "electronics", "brand": "MT", "collection": "Tech",
        "features": ["Bluetooth 5.0", "Интерком Mesh (до 8)", "Hi-Fi динамики"],
        "battery": "До 20 часов разговора",
        "compatibility": "Универсальное крепление",
        "water_resistance": "IP67",
        "badge": "tech", "badge_color": "#8b5cf6"
      }'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    v_count := v_count + 7;
  END LOOP;

  RAISE NOTICE 'Equipment seeded: % items across % crews', v_count, (SELECT COUNT(*) FROM public.crews);
END $$;

COMMENT ON TABLE public.cars IS 'Vehicles and equipment. Equipment items have type=''equipment'' with specs jsonb.';
COMMENT ON TABLE public.equipment_rentals IS 'I5: equipment rentals. Equipment = cars rows with type=''equipment''. Seed IDs: equip-helmet-*, equip-jacket-*, equip-pants-*, equip-gloves-*, equip-boots-*, equip-*-*.';
