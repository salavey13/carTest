-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000006_seed_equipment.sql
-- Purpose:   I5 — seed premium equipment catalog (helmets, jackets, gloves, boots)
-- Plan:      docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Этап 2)
-- Quality:  Fly catalog matching rentals/sales/services standards
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Premium equipment catalog using specs jsonb for rich details.
-- Each item is a product line with sizes/features in specs, not separate rows.
-- ON CONFLICT for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

-- Get first crew_id for seed (fallback for local dev)
DO $$
DECLARE
  v_crew_id UUID;
BEGIN
  SELECT id INTO v_crew_id FROM public.crews LIMIT 1;

  IF v_crew_id IS NULL THEN
    RAISE NOTICE 'No crew found for equipment seed — skipping';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- HELMETS — Premium MT Helmets with visors, ventilation, safety certs
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO public.cars (id, crew_id, make, model, description, type, daily_price, specs, created_at)
  VALUES
    (
      'equip-helmet-street-pro',
      v_crew_id,
      'MT',
      'Street Pro',
      'Полицейский шлем с визором и солнцезащитной кассетой. ABS-пластик, съёмный чехол.',
      'equipment',
      350,
      '{
        "category": "helmet",
        "brand": "MT",
        "collection": "Street",
        "materials": "ABS plastic shell, EPS foam",
        "features": ["Built-in sun visor", "Removable neck curtain", "Quick-release buckle", "Multi-port ventilation"],
        "safety": ["ECE 22.05 certified", "DOT approved"],
        "sizes": ["S (54-55cm)", "M (56-57cm)", "L (58-59cm)", "XL (60-61cm)"],
        "colors": ["Matt Black", "White", "Silver"],
        "weight": "1450g ±50g",
        "images": [],
        "badge": "bestseller",
        "badge_color": "#D99A00"
      }'::jsonb,
      now()
    ),
    (
      'equip-helmet-thunder-4',
      v_crew_id,
      'MT',
      'Thunder 4',
      'Спортивный шлем-интеграл. Агрессивный дизайн, отличная вентиляция.',
      'equipment',
      400,
      '{
        "category": "helmet",
        "brand": "MT",
        "collection": "Thunder",
        "materials": "Fiberglass composite, Multi-density EPS",
        "features": ["Race-ready aerodynamics", "Improved ventilation channels", "Anti-fog visor", "Emergency quick-release cheek pads"],
        "safety": ["ECE 22.06", "DOT", "Sharp penetration tested"],
        "sizes": ["S (54-55cm)", "M (56-57cm)", "L (58-59cm)", "XL (60-61cm)"],
        "colors": ["Metallic Black", "Metallic Red", "Metallic Blue", "Matt Grey"],
        "weight": "1400g ±50g",
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),
    (
      'equip-helmet-kre-plus',
      v_crew_id,
      'MT',
      'KRE+',
      'Лёгкий открытый шлем для города. Отличная видимость, минимальный вес.',
      'equipment',
      300,
      '{
        "category": "helmet",
        "brand": "MT",
        "collection": "Urban",
        "materials": "High-impact ABS, lightweight EPS",
        "features": ["Open-face design", "UV400 visor", "Ventilated chin guard", "City-style graphics"],
        "safety": ["ECE 22.05 certified"],
        "sizes": ["S (54-55cm)", "M (56-57cm)", "L (58-59cm)", "XL (60-61cm)"],
        "colors": ["Gloss Black", "White", "Matt Black/Gold"],
        "weight": "1200g ±50g",
        "images": [],
        "badge": "lightweight",
        "badge_color": "#22c55e"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- JACKETS — Textile & leather with protection, weather resistance
  -- ═══════════════════════════════════════════════════════════════════════════

    (
      'equip-jacket-trail-guard',
      v_crew_id,
      'MT',
      'Trail Guard',
      'Текстильная куртка для эндуро и туризма. Влагостойкая, с защитой.',
      'equipment',
      450,
      '{
        "category": "jacket",
        "brand": "MT",
        "collection": "Adventure",
        "materials": "600D polyester, breathable mesh, Reissa waterproof membrane",
        "protection": ["CE Level 1 armor shoulders/elbows", "Spine protector pocket", "Reflective panels"],
        "features": ["Waterproof & breathable", "Removable thermal liner", "Adjustable cuffs/waist", "Multiple pockets"],
        "season": ["Spring", "Summer", "Fall"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Black", "Grey", "Black/Orange"],
        "images": [],
        "badge": "versatile",
        "badge_color": "#3b82f6"
      }'::jsonb,
      now()
    ),
    (
      'equip-jacket-leather-pro',
      v_crew_id,
      'MT',
      'Leather Pro',
      'Кожаная гоночная куртка. Максимальная защита, агрессивный стиль.',
      'equipment',
      600,
      '{
        "category": "jacket",
        "brand": "MT",
        "collection": "Race",
        "materials": "1.2-1.4mm cowhide leather, ballistic stretch panels",
        "protection": ["CE Level 2 armor shoulders/elbows", "Chest protector pocket", "External shoulder sliders", "Spine protector included"],
        "features": ["Race-fit pre-curved sleeves", "Air vent system", "Zipper for pant connection", "Aerodynamic hump"],
        "season": ["Spring", "Summer", "Fall"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Black/Red", "Black/Blue", "Black/White"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),
    (
      'equip-jacket-summer-vent',
      v_crew_id,
      'MT',
      'Summer Vent',
      'Лёгкая сетчатая куртка для жарких дней. Максимальная вентиляция.',
      'equipment',
      350,
      '{
        "category": "jacket",
        "brand": "MT",
        "collection": "Urban",
        "materials": "Air-mesh outer, breathable lining, 600D high-impact zones",
        "protection": ["CE Level 1 armor", "Removable back protector"],
        "features": ["Full mesh construction", "Stretch panels", "Lightweight design", "Urban cut"],
        "season": ["Summer"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Black", "White", "Black/Neon Yellow"],
        "images": [],
        "badge": "summer",
        "badge_color": "#f59e0b"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- GLOVES — Summer, winter, racing options
  -- ═══════════════════════════════════════════════════════════════════════════

    (
      'equip-gloves-summer-x',
      v_crew_id,
      'MT',
      'Summer X',
      'Лёгкие летние перчатки. Вентиляция, защита костяшек.',
      'equipment',
      150,
      '{
        "category": "gloves",
        "brand": "MT",
        "collection": "Summer",
        "materials": "Mesh outer, clarino palm, TPR knuckle protection",
        "protection": ["Hard knuckle guards", "Palm sliders", "Finger armor"],
        "features": ["Pre-curved fingers", "Touch-screen compatible", "Adjustable wrist strap", "Breathable"],
        "season": ["Summer"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Black", "Black/Red", "Black/Blue"],
        "images": [],
        "badge": "essential",
        "badge_color": "#22c55e"
      }'::jsonb,
      now()
    ),
    (
      'equip-gloves-winter-gtx',
      v_crew_id,
      'MT',
      'Winter GTX',
      'Зимние перчатки с мембраной Gore-Tex. Тёплые, влагостойкие.',
      'equipment',
      250,
      '{
        "category": "gloves",
        "brand": "MT",
        "collection": "Winter",
        "materials": "Gore-Tex membrane, Thinsulate insulation, Clarino palm",
        "protection": ["Hard knuckle protection", "Palm reinforcement", "Wrist guards"],
        "features": ["100% waterproof", "Insulated for cold weather", "Long cuff", "Grip palm"],
        "season": ["Fall", "Winter", "Spring"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Black", "Black/Orange"],
        "images": [],
        "badge": "winter",
        "badge_color": "#3b82f6"
      }'::jsonb,
      now()
    ),
    (
      'equip-gloves-race-pro',
      v_crew_id,
      'MT',
      'Race Pro',
      'Гоночные перчатки. Максимальная защита, предизогнутые пальцы.',
      'equipment',
      300,
      '{
        "category": "gloves",
        "brand": "MT",
        "collection": "Race",
        "materials": "Leather palm, Kevlar reinforcement, Carbon fiber knuckles",
        "protection": ["Carbon fiber knuckle guards", "Palm sliders", "Finger bridge", "External pinky guards"],
        "features": ["Pre-curved race fit", "Air vents", "Gauntlet style", "Zipper closure"],
        "season": ["Spring", "Summer", "Fall"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Black/Red", "Black/White", "Black/Blue"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- BOOTS — Touring, racing, urban options
  -- ═══════════════════════════════════════════════════════════════════════════

    (
      'equip-boots-tour-adv',
      v_crew_id,
      'MT',
      'Tour Adv',
      'Туристические ботинки. Защита, комфорт, водостойкость.',
      'equipment',
      400,
      '{
        "category": "boots",
        "brand": "MT",
        "collection": "Adventure",
        "materials": "Full-grain leather, waterproof membrane, rubber sole",
        "protection": ["Ankle armor", "Shin guards", "Toe sliders", "Heel reinforcement"],
        "features": ["Waterproof", "Breathable membrane", "Multiple closures", "Ortholite footbed"],
        "season": ["All-season"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Black", "Black/Grey"],
        "images": [],
        "badge": "versatile",
        "badge_color": "#3b82f6"
      }'::jsonb,
      now()
    ),
    (
      'equip-boots-street-sport',
      v_crew_id,
      'MT',
      'Street Sport',
      'Спортивные ботинки для города. Стиль, защита, комфорт.',
      'equipment',
      350,
      '{
        "category": "boots",
        "brand": "MT",
        "collection": "Urban",
        "materials": "Leather upper, mesh panels, rubber sole",
        "protection": ["Ankle protection", "Reinforced heel/toe", "Shift pad"],
        "features": ["Walking comfort", "Quick lacing system", "Breathable", "Urban style"],
        "season": ["Spring", "Summer", "Fall"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Black", "Black/Red", "Black/White"],
        "images": [],
        "badge": "urban",
        "badge_color": "#8b5cf6"
      }'::jsonb,
      now()
    ),
    (
      'equip-boots-race-s',
      v_crew_id,
      'MT',
      'Race S',
      'Гоночные ботинки. Максимальная защита, предизогнутая подошва.',
      'equipment',
      500,
      '{
        "category": "boots",
        "brand": "MT",
        "collection": "Race",
        "materials": "Full-grain leather, anti-slip sole",
        "protection": ["External ankle braces", "Shin/foot armor", "Toe sliders", "Heel guards"],
        "features": ["Race-fit pre-curved", "Quick-release buckles", "Air intake vents", "Replaceable parts"],
        "season": ["Spring", "Summer", "Fall"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Black/White", "Black/Red", "Black/Blue"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ACCESSORIES — Rain gear, locks, communication
  -- ═══════════════════════════════════════════════════════════════════════════

    (
      'equip-rain-suit-elite',
      v_crew_id,
      'MT',
      'Rain Suit Elite',
      'Элитный дождевик. Полная защита от дождя, дыхательная мембрана.',
      'equipment',
      400,
      '{
        "category": "rainwear",
        "brand": "MT",
        "collection": "Protection",
        "materials": "2-layer waterproof fabric, sealed seams, mesh lining",
        "features": ["100% waterproof", "Breathable membrane", "Reflective panels", "Packable into pouch", "One-piece design"],
        "sizes": ["S/M", "L/XL", "XXL/XXXL"],
        "colors": ["Black", "Black/Neon Yellow"],
        "images": [],
        "badge": "essential",
        "badge_color": "#3b82f6"
      }'::jsonb,
      now()
    ),
    (
      'equip-disc-lock-pro',
      v_crew_id,
      'MT',
      'Disc Lock Pro',
      'Дисковый замок с сигнализацией. Надёжная защита мотоцикла.',
      'equipment',
      150,
      '{
        "category": "security",
        "brand": "MT",
        "collection": "Security",
        "materials": "Hardened steel, alloy body",
        "features": ["120dB alarm", "Carry pouch included", "Disc-lock reminder cable", "Weather-resistant"],
        "compatibility": "Fits most disc brakes (3-6mm thickness)",
        "colors": ["Black", "Red", "Orange"],
        "images": [],
        "badge": "security",
        "badge_color": "#f59e0b"
      }'::jsonb,
      now()
    ),
    (
      'equip-communicator-bt',
      v_crew_id,
      'MT',
      'Communicator BT',
      'Bluetooth гарнитура для шлема. Связь, музыка, навигация.',
      'equipment',
      300,
      '{
        "category": "electronics",
        "brand": "MT",
        "collection": "Tech",
        "features": ["Bluetooth 5.0", "Mesh intercom (up to 8 riders)", "Hi-Fi speakers", "FM radio", "Voice commands"],
        "battery": "Up to 20 hours talk time",
        "compatibility": "Universal fit for most helmets",
        "water_resistance": "IP67",
        "images": [],
        "badge": "tech",
        "badge_color": "#8b5cf6"
      }'::jsonb,
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Equipment catalog seeded: % items', 14;
END $$;

COMMENT ON TABLE public.cars IS
'Vehicles and equipment catalog. Equipment items have type=''equipment'' with rich specs jsonb. Premium MT brand products: helmets, jackets, gloves, boots, accessories.';

COMMENT ON TABLE public.equipment_rentals IS
'I5: standalone equipment rentals. Equipment = cars rows with type=''equipment''. Seed IDs: equip-helmet-*, equip-jacket-*, equip-gloves-*, equip-boots-*, equip-*-*, with sizes/features in specs jsonb.';
