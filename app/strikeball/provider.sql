-- 1. Убеждаемся, что структура таблицы готова (если не была создана ранее)
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_crews_is_provider ON public.crews ((metadata->>'is_provider')) WHERE (metadata->>'is_provider' = 'true');

-- 2. Выполняем UPSERT данных клуба Антанта
INSERT INTO public.crews (
  name, 
  slug, 
  description, 
  logo_url, 
  owner_id, 
  hq_location, 
  metadata
) 
VALUES (
  'АНТАНТА (Клуб активного отдыха)', 
  'antanta52.ru', 
  'Ведущий клуб активного отдыха в Нижнем Новгороде: Пейнтбол, Страйкбол, Лазертаг и Гидробол на профессиональных полигонах.', 
  'https://www.antanta52.ru/images/cms/thumbs/a5b0aeaa3fa7d6e58d75710c18673bd7ec6d5f6d/logo_novyj-min_150_auto.png', 
  '413553377', -- Замените на реальный ID пользователя-владельца
  '56.226950,43.812079', 
  jsonb_build_object(
    'is_provider', true,
    'provider_type', 'multi_activity_facility',
    'rating', 5.0,
    'contacts', jsonb_build_object(
      'primary_phone', '8-952-775-68-80',
      'manager_sales', 'Анастасия',
      'manager_support', 'Игорь (8-952-762-04-25)',
      'working_hours', '10:00 - 22:00 (ежедневно)'
    ),
    'location_details', jsonb_build_object(
      'address', 'г. Нижний Новгород, ул. Зеленхозовская, 4а к3',
      'public_transport', 'До остановки "магазин Автозаводец" (ул. Космическая), далее 15 мин пешком в сторону клуба Аллюр.',
      'car_directions', 'Поворот на поселок Парышево напротив 13-й больницы, далее 5 минут по указателям.',
      'gps', '56.226950, 43.812079'
    ),
    'amenities', jsonb_build_array(
      jsonb_build_object('id', 'warm_gazebo', 'name', 'Теплые беседки', 'icon', 'FaHouseFire'),
      jsonb_build_object('id', 'grill', 'name', 'Мангальные зоны', 'icon', 'FaFireBurner'),
      jsonb_build_object('id', 'night_lights', 'name', 'Искусственное освещение', 'icon', 'FaLightbulb'),
      jsonb_build_object('id', 'fields', 'name', 'Поля для волейбола/футбола', 'icon', 'FaFutbol')
    ),
    'services', jsonb_build_array(
      -- ПЕЙНТБОЛ
      jsonb_build_object(
        'id', 'paintball',
        'name', 'Пейнтбол',
        'image_url', 'https://www.antanta52.ru/images/cms/data/pejntbol_nn.jpg',
        'description', 'Тактическая игра на профессиональном надувном или лесном поле.',
        'min_players', 10,
        'age_limit', 13,
        'gear_info', 'Маркер Tippman 98, термальная маска, костюм х/б, защитный жилет.',
        'packages', jsonb_build_array(
          jsonb_build_object('id', 'p_400', 'name', 'Тариф 400', 'price', 1600, 'duration', 120, 'includes', '2 часа игры, 400 шаров, 1 час в беседке'),
          jsonb_build_object('id', 'p_unlim', 'name', 'Безлимит', 'price', 2200, 'duration', 120, 'includes', '2 часа игры, Безлимит шаров, 2 часа в беседке')
        )
      ),
      -- СТРАЙКБОЛ
      jsonb_build_object(
        'id', 'strikeball',
        'name', 'Страйкбол',
        'image_url', 'https://www.antanta52.ru/images/cms/data/strajkbol_nn.jpg',
        'description', 'Мильсим-ориентированная игра с реалистичными копиями оружия.',
        'min_players', 1,
        'age_limit', 14,
        'gear_info', 'Страйкбольный привод (АК/М серия), безлимит шаров, защитная маска, камуфляж.',
        'packages', jsonb_build_array(
          jsonb_build_object('id', 's_std', 'name', 'Стандарт', 'price', 1800, 'duration', 120, 'includes', '2 часа игры, Безлимит шаров, 2 часа в беседке, Инструктор')
        )
      ),
      -- ЛАЗЕРТАГ
      jsonb_build_object(
        'id', 'lazertag',
        'name', 'Лазертаг',
        'image_url', 'https://www.antanta52.ru/images/cms/data/lazertag_nn.jpg',
        'description', 'Высокотехнологичный бесконтактный бой. Идеально для детей и корпоративов.',
        'min_players', 1,
        'age_limit', 7,
        'gear_info', 'Профессиональные тагеры с виброотдачей, датчики поражения, камуфляж.',
        'packages', jsonb_build_array(
          jsonb_build_object('id', 'l_std', 'name', 'Стандарт', 'price', 1200, 'duration', 120, 'includes', '2 часа игры, 1 час в беседке, Инструктор, Камуфляж')
        )
      ),
      -- ГИДРОБОЛ
      jsonb_build_object(
        'id', 'hydroball',
        'name', 'Гидробол',
        'image_url', 'https://www.antanta52.ru/images/cms/data/gidrobol_nn.jpg',
        'description', 'Игра мягкими гидрогелевыми шариками. Не оставляет синяков.',
        'min_players', 1,
        'age_limit', 10,
        'gear_info', 'Бластер M-серии, безлимит гидрогеля, защитная маска, камуфляж.',
        'packages', jsonb_build_array(
          jsonb_build_object('id', 'h_std', 'name', 'Стандарт', 'price', 1400, 'duration', 120, 'includes', '2 часа игры, Безлимит шаров, 1 час в беседке, Инструктор')
        )
      )
    ),
    'addons', jsonb_build_array(
      jsonb_build_object('name', 'Доп. шары (пейнтбол)', 'price', 2, 'unit', 'шт'),
      jsonb_build_object('name', 'Имитационная граната', 'price', 250, 'unit', 'шт'),
      jsonb_build_object('name', 'Доп. час беседки', 'price', 1000, 'unit', 'час')
    )
  )
)
ON CONFLICT (slug) DO UPDATE 
SET 
  metadata = EXCLUDED.metadata,
  logo_url = EXCLUDED.logo_url,
  hq_location = EXCLUDED.hq_location,
  description = EXCLUDED.description,
  updated_at = now();