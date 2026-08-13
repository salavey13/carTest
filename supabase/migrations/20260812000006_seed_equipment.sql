-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000006_seed_equipment.sql
-- Purpose:   I5 — seed premium equipment catalog (helmets, jackets, pants, gloves, boots)
-- Plan:      docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Этап 2)
-- Quality:  Fly catalog matching rentals/sales/services standards
-- Language:  Russian specs for all equipment
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
  -- ШЛЕМЫ — Премиальные шлемы MT с визорами, вентиляцией, сертификатами
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
        "materials": "ABS-пластик, вспененный EPS",
        "features": ["Встроенный солнцезащитный визор", "Съёмный подшлемник", "Быстросъёмная застёжка", "Мультипортовая вентиляция"],
        "safety": ["Сертификат ECE 22.05", "Одобрен DOT"],
        "sizes": ["S (54-55см)", "M (56-57см)", "L (58-59см)", "XL (60-61см)"],
        "colors": ["Матовый чёрный", "Белый", "Серебристый"],
        "weight": "1450г ±50г",
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
        "materials": "Стеклокомпозит, многослойный EPS",
        "features": ["Аэродинамика для гонок", "Улучшенные вентиляционные каналы", "Анти-туманный визор", "Аварийный quick-release щёк"],
        "safety": ["ECE 22.06", "DOT", "Испытание на проникновение Sharp"],
        "sizes": ["S (54-55см)", "M (56-57см)", "L (58-59см)", "XL (60-61см)"],
        "colors": ["Металлик чёрный", "Металлик красный", "Металлик синий", "Матовый серый"],
        "weight": "1400г ±50г",
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
        "materials": "Ударопрочный ABS, лёгкий EPS",
        "features": ["Открытый фасон", "Визор UV400", "Вентилируемый подбородочный бампер", "Городской стиль"],
        "safety": ["Сертификат ECE 22.05"],
        "sizes": ["S (54-55см)", "M (56-57см)", "L (58-59см)", "XL (60-61см)"],
        "colors": ["Глянцевый чёрный", "Белый", "Матовый чёрный/золото"],
        "weight": "1200г ±50г",
        "images": [],
        "badge": "lightweight",
        "badge_color": "#22c55e"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- КУРТКИ — Текстиль и кожа с защитой, влагостойкостью
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
        "materials": "Полиэстер 600D, дышащая сетка, мембрана Reissa",
        "protection": ["Защита CE Level 1 плечи/локти", "Карман для защиты спины", "Светоотражающие панели"],
        "features": ["Влагостойкая и дышащая", "Съёмная тёплая подкладка", "Регулируемые манжеты/талия", "Множество карманов"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Чёрный", "Серый", "Чёрный/оранжевый"],
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
        "materials": "Кожа 1.2-1.4мм, эластичные панели баллистического типа",
        "protection": ["Защита CE Level 2 плечи/локти", "Карман для защиты груди", "Внешние слайдеры плечей", "Защита спины в комплекте"],
        "features": ["Предизогнутые рукава для гонок", "Система вентиляции", "Застёжка для соединения со штанами", "Аэродинамический горб"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Чёрный/красный", "Чёрный/синий", "Чёрный/белый"],
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
        "materials": "Сеточный внешний слой, дышащая подкладка, зоны 600D",
        "protection": ["Защита CE Level 1", "Съёмная защита спины"],
        "features": ["Полная сеточная конструкция", "Эластичные панели", "Лёгкий дизайн", "Городской фасон"],
        "season": ["Лето"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Чёрный", "Белый", "Чёрный/неоновый жёлтый"],
        "images": [],
        "badge": "summer",
        "badge_color": "#f59e0b"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ШТАНЫ — Текстиль и кожа для эндуро, туризма, гонок
  -- ═══════════════════════════════════════════════════════════════════════════

    (
      'equip-pants-trail-adv',
      v_crew_id,
      'MT',
      'Trail Adv',
      'Штаны для эндуро и туризма. Влагостойкие, с защитой коленей.',
      'equipment',
      450,
      '{
        "category": "pants",
        "brand": "MT",
        "collection": "Adventure",
        "materials": "Полиэстер 600D, мембрана Reissa",
        "protection": ["Защита CE Level 1 колени", "Карман для защиты бёдер", "Светоотражающие элементы"],
        "features": ["Влагостойкие", "Дышащая мембрана", "Регулируемая талия", "Множество карманов"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Чёрный", "Серый"],
        "images": [],
        "badge": "versatile",
        "badge_color": "#3b82f6"
      }'::jsonb,
      now()
    ),
    (
      'equip-pants-leather-pro',
      v_crew_id,
      'MT',
      'Leather Pro',
      'Кожаные гоночные штаны. Максимальная защита, агрессивный стиль.',
      'equipment',
      600,
      '{
        "category": "pants",
        "brand": "MT",
        "collection": "Race",
        "materials": "Кожа 1.2-1.4мм, эластичные панели",
        "protection": ["Защита CE Level 2 колени/бёдра", "Внешние слайдеры коленей", "Защита бёдер в комплекте"],
        "features": ["Предизогнутые для посадки на мотоцикл", "Система вентиляции", "Застёжка для соединения с курткой", "Аэродинамический силуэт"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (48)", "M (50)", "L (52)", "XL (54)", "XXL (56)"],
        "colors": ["Чёрный/красный", "Чёрный/синий", "Чёрный/белый"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),
    (
      'equip-pants-denim-urban',
      v_crew_id,
      'MT',
      'Denim Urban',
      'Джинсовые штаны для города. Скрытая защита, повседневный стиль.',
      'equipment',
      350,
      '{
        "category": "pants",
        "brand": "MT",
        "collection": "Urban",
        "materials": "Джинсовая ткань, арамидные волокна, Кевлар в зонах риска",
        "protection": ["Скрытая защита колен Level 1", "Усиление швов арамидом"],
        "features": ["Повседневный стиль", "Съёмная защита", "Карманы", "Дышащие"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (28-30)", "M (32-34)", "L (36-38)", "XL (40-42)"],
        "colors": ["Синий", "Чёрный", "Серый"],
        "images": [],
        "badge": "urban",
        "badge_color": "#8b5cf6"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ПЕРЧАТКИ — Летние, зимние, гоночные варианты
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
        "materials": "Сеточный внешний слой, Clarino ладонь, защита костяшек TPR",
        "protection": ["Жёсткая защита костяшек", "Слайдеры ладони", "Защита пальцев"],
        "features": ["Предизогнутые пальцы", "Совместимость с сенсорными экранами", "Регулируемый ремень запястья", "Дышащие"],
        "season": ["Лето"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Чёрный", "Чёрный/красный", "Чёрный/синий"],
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
        "materials": "Мембрана Gore-Tex, утеплитель Thinsulate, ладонь Clarino",
        "protection": ["Жёсткая защита костяшек", "Усиление ладони", "Защита запястья"],
        "features": ["100% влагостойкость", "Утепление для холодной погоды", "Длинный манжет", "Противоскользящая ладонь"],
        "season": ["Осень", "Зима", "Весна"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Чёрный", "Чёрный/оранжевый"],
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
        "materials": "Кожаная ладонь, усиление Kevlar, карбоновые костяшки",
        "protection": ["Карбоновая защита костяшек", "Слайдеры ладони", "Мост между пальцами", "Внешняя защита мизинца"],
        "features": ["Предизогнутый гоночный фасон", "Воздуховоды", "Длинный краг", "Застёжка-молния"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["S (7-8)", "M (8-9)", "L (9-10)", "XL (10-11)"],
        "colors": ["Чёрный/красный", "Чёрный/белый", "Чёрный/синий"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- БОТИНКИ — Туристические, гоночные, городские варианты
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
        "materials": "Грубая кожа, влагостойкая мембрана, резиновая подошва",
        "protection": ["Защита лодыжек", "Защита голени", "Слайдеры носка", "Усиление пятки"],
        "features": ["Влагостойкость", "Дышащая мембрана", "Множественные застёжки", "Стелька Ortholite"],
        "season": ["Всесезон"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Чёрный", "Чёрный/серый"],
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
        "materials": "Кожаный верх, сеточные панели, резиновая подошва",
        "protection": ["Защита лодыжек", "Усиление пятки/носка", "Шift pad для переключения"],
        "features": ["Комфорт при ходьбе", "Система быстрой шнуровки", "Дышащие", "Городской стиль"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Чёрный", "Чёрный/красный", "Чёрный/белый"],
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
        "materials": "Грубая кожа, противоскользящая подошва",
        "protection": ["Внешние фиксаторы лодыжек", "Броня голени/стопы", "Слайдеры носка", "Защита пятки"],
        "features": ["Предизогнутый гоночный фасон", "Быстросъёмные пряжки", "Воздухозаборники", "Заменяемые части"],
        "season": ["Весна", "Лето", "Осень"],
        "sizes": ["EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        "colors": ["Чёрный/белый", "Чёрный/красный", "Чёрный/синий"],
        "images": [],
        "badge": "premium",
        "badge_color": "#ef4444"
      }'::jsonb,
      now()
    ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- АКСЕССУАРЫ — Замки, коммуникация, защита
  -- ═══════════════════════════════════════════════════════════════════════════

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
        "materials": "Закалённая сталь, сплав",
        "features": ["Сигнализация 120дБ", "Сумка для переноски в комплекте", "Напоминающий трос", "Влагостойкость"],
        "compatibility": "Подходит большинству дисковых тормозов (3-6мм толщина)",
        "colors": ["Чёрный", "Красный", "Оранжевый"],
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
        "features": ["Bluetooth 5.0", "Интерком Mesh (до 8 райдеров)", "Hi-Fi динамики", "FM радио", "Голосовые команды"],
        "battery": "До 20 часов разговора",
        "compatibility": "Универсальное подходит к большинству шлемов",
        "water_resistance": "IP67",
        "images": [],
        "badge": "tech",
        "badge_color": "#8b5cf6"
      }'::jsonb,
      now()
    ),
    (
      'equip-chain-lock',
      v_crew_id,
      'MT',
      'Chain Lock',
      'Цепной замок с чехлом. Надёжная защита от угона.',
      'equipment',
      200,
      '{
        "category": "security",
        "brand": "MT",
        "collection": "Security",
        "materials": "Закалённая сталь 10мм, чехол",
        "features": ["Длина 120см", "Чехол для защиты", "Ключевой механизм", "Влагостойкость"],
        "colors": ["Чёрный", "Чёрный/жёлтый"],
        "images": [],
        "badge": "security",
        "badge_color": "#f59e0b"
      }'::jsonb,
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Equipment catalog seeded: % items', 17;
END $$;

COMMENT ON TABLE public.cars IS
'Vehicles and equipment catalog. Equipment items have type=''equipment'' with rich specs jsonb. Premium MT brand products: helmets, jackets, pants, gloves, boots, accessories.';

COMMENT ON TABLE public.equipment_rentals IS
'I5: standalone equipment rentals. Equipment = cars rows with type=''equipment''. Seed IDs: equip-helmet-*, equip-jacket-*, equip-pants-*, equip-gloves-*, equip-boots-*, equip-*-*, with sizes/features in specs jsonb.';
