-- Update a crew to be a Dota 2 Coach
UPDATE public.crews
SET metadata = jsonb_set(
    metadata,
    '{services}',
    COALESCE(metadata->'services', '[]'::jsonb) || jsonb_build_object(
        'id', 'dota2_coach',
        'name', 'Dota 2 Pro Coach',
        'description', 'Анализ реплеев, постановка макро-игры и тренировка лайнинга. Выйди из 2к помойки.',
        'benefits', jsonb_build_array('Разбор ошибок', 'Контр-пики', 'Тайминги'),
        'packages', jsonb_build_array(
            jsonb_build_object(
                'id', 'dota_1h',
                'name', '1 час разбора',
                'price', 500,
                'duration', 60,
                'includes', 'Live-coaching или разбор реплея'
            )
        ),
        'location_details', jsonb_build_object('address', 'Online / Discord')
    )
)
WHERE slug = 'your-coach-slug';