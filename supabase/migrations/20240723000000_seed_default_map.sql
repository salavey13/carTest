-- This migration seeds the database with a default map preset for Nizhny Novgorod,
-- including pre-calibrated boundaries and three iconic race loops as points of interest.

INSERT INTO public.maps (name, map_image_url, bounds, is_default, points_of_interest)
VALUES (
    'Карта Нижнего Новгорода',
    'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg',
    '{ "top": 56.3392, "bottom": 56.285, "left": 43.963, "right": 44.052 }',
    true,
    '[
        {
            "id": "big-ring-race",
            "name": "Большое Кольцо",
            "type": "loop",
            "icon": "::FaRoute::",
            "color": "#4D99FF",
            "coords": [
                [56.3300, 44.0180],
                [56.3283, 44.0059],
                [56.3262, 43.9871],
                [56.3150, 43.9875],
                [56.3070, 44.0030],
                [56.3130, 44.0200],
                [56.3250, 44.0270]
            ]
        },
        {
            "id": "embankment-fury",
            "name": "Набережная Фурия",
            "type": "path",
            "icon": "::FaWater::",
            "color": "#FF66B2",
            "coords": [
                [56.3307, 44.0195],
                [56.3302, 44.0298],
                [56.3253, 44.0273],
                [56.3225, 44.0200]
            ]
        },
        {
            "id": "meschera-drift",
            "name": "Мещерский Дрифт",
            "type": "loop",
            "icon": "::FaTire::",
            "color": "#99E64D",
            "coords": [
                [56.3245, 43.9680],
                [56.3295, 43.9740],
                [56.3340, 43.9650],
                [56.3315, 43.9580]
            ]
        }
    ]'::jsonb
)
ON CONFLICT (name) DO NOTHING;