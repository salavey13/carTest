-- /docs/crewDocs/task207b-subpages-vehicle-class-2026-11-23.sql
-- Task 207b (босс: «update crew hydrations with links as well — use
-- vip-bike's cre hydration sql as gold standard» + «fix modal by not
-- showing bike equipment for non-bike stuff in other crews like
-- renta-flat»).
--
-- Содержание:
--   1) header.menuLinks → полный набор подстраниц витрины по образцу
--      vip-bike-franchize-hydration.sql (Каталог/О нас/Контакты/Запчасти/
--      Хранение/Комьюнити/Сезонная статистика/Корзина) для 4 зелёных;
--      renta-flat — квартирный набор (без запчастей/хранения техники).
--   2) specs.vehicle_class — маркер вертикали для item-модалки:
--      "car" у 4 новых авто, "flat" у 5 квартир (+ bedding/checkin/
--      checkout у квартир). Модальный гейт в коде: isVehicleItem()
--      скрывает шлемы/куртки/тест-драйв у non-vehicle.
--   3) crews.metadata.provider_type = 'flat_rental' у демо-экипажа.
-- Применено через REST 2026-11-23 (204×9 + menuLinks 204×5). Идемпотентно.

begin;

-- ─────────────────────── 1) header.menuLinks (vip-bike standard)
update public.crews c
set metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize,header,menuLinks}', '[
  {"label": "Каталог",        "href": "/franchize/{slug}"},
  {"label": "О нас",          "href": "/franchize/{slug}/about"},
  {"label": "Контакты",       "href": "/franchize/{slug}/contacts"},
  {"label": "Запчасти",       "href": "/franchize/{slug}/parts"},
  {"label": "Хранение",       "href": "/franchize/{slug}/storage"},
  {"label": "Комьюнити",      "href": "/franchize/{slug}/community"},
  {"label": "Сезонная статистика", "href": "/franchize/{slug}/season-stats"},
  {"label": "Корзина",        "href": "/franchize/{slug}/cart"}
]'::jsonb || jsonb_build_object('label', 'Каталог', 'href', '/franchize/' || c.slug) - 0, false),
    metadata = jsonb_set(metadata, '{franchize,version}', '"2026-11-23-v2 (task207b: subpage menuLinks по vip-bike standard)"'::jsonb, true),
    updated_at = now()
where c.slug in ('renta-car', 'motoprokat1', 'snowmobile-nn', 'snegoprokat-nn');

update public.crews c
set metadata = jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{franchize,header,menuLinks}', '[
  {"label": "Каталог",        "href": "/franchize/renta-flat"},
  {"label": "О нас",          "href": "/franchize/renta-flat/about"},
  {"label": "Контакты",       "href": "/franchize/renta-flat/contacts"},
  {"label": "Комьюнити",      "href": "/franchize/renta-flat/community"},
  {"label": "Сезонная статистика", "href": "/franchize/renta-flat/season-stats"},
  {"label": "Корзина",        "href": "/franchize/renta-flat/cart"}
]'::jsonb, true),
    metadata = coalesce(metadata, '{}'::jsonb) || '{"provider_type": "flat_rental"}'::jsonb,
    updated_at = now()
where c.slug = 'renta-flat';

-- ─────────────────────── 2) specs.vehicle_class (модальный гейт)
update public.cars set specs = specs::jsonb || '{"vehicle_class": "car"}'::jsonb
where id in ('renta-car-vesta', 'renta-car-rio', 'renta-car-logan', 'renta-car-camry70');

update public.cars set specs = specs::jsonb
  || '{"vehicle_class": "flat", "bedding": "включена", "checkin": "14:00", "checkout": "12:00"}'::jsonb
where id in ('renta-flat-studio', 'renta-flat-1k', 'renta-flat-2k', 'renta-flat-2k-euro', 'renta-flat-pent');

commit;
