-- Update sly13 crew to include snowboarding instructor service
UPDATE public.crews
SET metadata = jsonb_set(
    metadata,
    '{services}',
    COALESCE(
        (metadata->'services') || 
        jsonb_build_object(
            'id', 'snowboard_instructor',
            'name', 'Сноуборд-инструктор',
            'tags', jsonb_build_array('Сноуборд', 'Спорт', 'Обучение', 'Инструктор', 'Новинки'),
            'notes', 'Индивидуальное и групповое обучение катанию на сноуборде. Все уровни - от новичков до продвинутых райдеров.',
            'benefits', jsonb_build_array(
                'Персональный подход к каждому ученику',
                'Безопасное освоение основ катания',
                'Техника правильного падения и контроля',
                'Обучение трюкам и продвинутым техникам',
                'Помощь в выборе и настройке оборудования'
            ),
            'packages', jsonb_build_array(
                jsonb_build_object(
                    'id', 'snow_1h_basic',
                    'name', 'Базовый курс - 1 час',
                    'price', 1500,
                    'currency', 'RUB',
                    'duration', 60,
                    'includes', 'Индивидуальное обучение 1 час; Основы стойки и движения; Техника торможения; Помощь с оборудованием'
                ),
                jsonb_build_object(
                    'id', 'snow_3h_full',
                    'name', 'Полное погружение - 3 часа',
                    'price', 4000,
                    'currency', 'RUB',
                    'duration', 180,
                    'includes', 'Индивидуальное обучение 3 часа; Полный курс для новичков; Основы и базовые трюки; Видеоанализ техники; Горячий напиток'
                ),
                jsonb_build_object(
                    'id', 'snow_group_2h',
                    'name', 'Групповое занятие - 2 часа',
                    'price', 2500,
                    'currency', 'RUB',
                    'duration', 120,
                    'includes', 'Обучение в группе до 5 человек; Основы катания; Игровые элементы; Совместное катание по трассе'
                )
            ),
            'age_limit', 10,
            'gear_info', 'Сноуборд и ботинки можно арендовать на месте (оплачивается отдельно). Рекомендуется наличие шлема.',
            'image_url', 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/snowboard_instructor.jpg',
            'description', 'Профессиональный инструктор по сноуборду для индивидуальных и групповых занятий. Помогу освоить основы или улучшить технику катания. Работаю на склонах Новинок.',
            'how_to_book', jsonb_build_object(
                'method', 'Через форму на странице или Telegram бот',
                'payment', 'Наличными или переводом',
                'telegram', '@SALAVEY13'
            ),
            'min_players', 1,
            'location_details', jsonb_build_object(
                'gps', '56.0250, 43.8750',
                'address', 'Горнолыжный комплекс "Новинки", Нижний Новгород',
                'car_directions', 'Следуйте по указателям на горнолыжный комплекс "Новинки"',
                'public_transport', 'Автобус № 11 до остановки "Новинки"'
            )
        ),
        '[]'::jsonb
    )
)
WHERE slug = 'sly13';

-- Update amenities to include snowboard gear
UPDATE public.crews
SET metadata = jsonb_set(
    metadata,
    '{amenities}',
    COALESCE(
        (metadata->'amenities') || 
        jsonb_build_array(
            jsonb_build_object(
                'id', 'snowboard_gear',
                'icon', 'FaPersonSkiing',
                'name', 'Сноубордическое оборудование'
            )
        ),
        '[]'::jsonb
    )
)
WHERE slug = 'sly13' AND NOT (
    metadata->'amenities' @> '[{"id": "snowboard_gear"}]'
);

-- Update provider type to multi-activity provider
UPDATE public.crews
SET metadata = jsonb_set(
    metadata,
    '{provider_type}',
    '"multi_activity_provider"'::jsonb
)
WHERE slug = 'sly13' AND metadata->>'provider_type' = 'consulting_studio';