UPDATE public.crews 
SET metadata = '{
  "is_provider": true,
  "type": "facility",
  "contact": {
    "manager_primary": "Анастасия",
    "phone": "8-952-775-68-80",
    "working_hours": "10:00 - 22:00"
  },
  "features": ["warm_gazebo", "grill", "lighting", "volleyball", "parking"],
  "services": [
    {
      "id": "paintball",
      "name": "Пейнтбол",
      "min_players": 10,
      "age_limit": 13,
      "packages": [
        { "name": "Тариф 400", "price": 1600, "duration": 120, "includes": "400 шаров, беседка 1ч" },
        { "name": "Безлимит", "price": 2200, "duration": 120, "includes": "Безлимит шаров, беседка 2ч" }
      ]
    },
    {
      "id": "strikeball",
      "name": "Страйкбол",
      "min_players": 1,
      "age_limit": 14,
      "packages": [
        { "name": "Стандарт", "price": 1800, "duration": 120, "includes": "Безлимит шаров, камуфляж, беседка 2ч" }
      ]
    },
    {
      "id": "lazertag",
      "name": "Лазертаг",
      "min_players": 1,
      "age_limit": 7,
      "packages": [
        { "name": "Стандарт", "price": 1200, "duration": 120, "includes": "Камуфляж, инструктор, беседка 1ч" }
      ]
    },
    {
      "id": "hydroball",
      "name": "Гидробол",
      "min_players": 1,
      "age_limit": 10,
      "packages": [
        { "name": "Стандарт", "price": 1400, "duration": 120, "includes": "Безлимит шаров, камуфляж, беседка 1ч" }
      ]
    }
  ]
}'::jsonb,
logo_url = 'https://www.antanta52.ru/images/cms/thumbs/a5b0aeaa3fa7d6e58d75710c18673bd7ec6d5f6d/logo_novyj-min_150_auto.png',
hq_location = '56.226950,43.812079',
description = 'Клуб активного отдыха: Пейнтбол, Страйкбол, Гидробол, Лазертаг в Нижнем Новгороде.'
WHERE slug = 'antanta52.ru';