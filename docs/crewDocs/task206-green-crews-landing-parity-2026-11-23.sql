-- /docs/crewDocs/task206-green-crews-landing-parity-2026-11-23.sql
-- Task 206: parity лендингов зелёных экипажей с эталоном /moto-selection.
-- 1) franchize.header.menuLinks — фикс битых ссылок task200 (/about,
--    /onboarding — страниц нет) на реальные подстраницы витрины:
--    Каталог /franchize/{slug}, Хранение /franchize/{slug}/storage
--    (мото/снегоходным), Контакты /franchize/{slug}/contacts.
-- 2) franchize.contacts.telegram/whatsapp — реальные каналы
--    (менеджер @salavey13; wa.me механика по primary_phone).
-- 3) version → 2026-11-23-v2 (task206 landing parity: menuLinks fix, socials)
-- Safe to re-run: идемпотентные jsonb-присваивания.
begin;

-- ────────────────────────────────────────────────  renta-car
update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,header,menuLinks}', '[{"label": "Каталог", "href": "/franchize/renta-car"}, {"label": "Контакты", "href": "/franchize/renta-car/contacts"}]'::jsonb, true)
    || jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,contacts}',
    (c.metadata->'franchize'->'contacts') || ''{"telegram": "@salavey13"}'::jsonb'::jsonb, true)
    || '{"franchize": {"version": "2026-11-23-v2 (task206 landing parity: menuLinks fix, socials)"}}'::jsonb,
  updated_at = now()
where c.slug = 'renta-car';

-- ────────────────────────────────────────────────  motoprokat1
update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,header,menuLinks}', '[{"label": "Каталог", "href": "/franchize/motoprokat1"}, {"label": "Хранение", "href": "/franchize/motoprokat1/storage"}, {"label": "Контакты", "href": "/franchize/motoprokat1/contacts"}]'::jsonb, true)
    || jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,contacts}',
    (c.metadata->'franchize'->'contacts') || ''{"telegram": "@salavey13"}'::jsonb'::jsonb, true)
    || '{"franchize": {"version": "2026-11-23-v2 (task206 landing parity: menuLinks fix, socials)"}}'::jsonb,
  updated_at = now()
where c.slug = 'motoprokat1';

-- ────────────────────────────────────────────────  snowmobile-nn
update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,header,menuLinks}', '[{"label": "Каталог", "href": "/franchize/snowmobile-nn"}, {"label": "Хранение", "href": "/franchize/snowmobile-nn/storage"}, {"label": "Контакты", "href": "/franchize/snowmobile-nn/contacts"}]'::jsonb, true)
    || jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,contacts}',
    (c.metadata->'franchize'->'contacts') || ''{"telegram": "@salavey13"}'::jsonb'::jsonb, true)
    || '{"franchize": {"version": "2026-11-23-v2 (task206 landing parity: menuLinks fix, socials)"}}'::jsonb,
  updated_at = now()
where c.slug = 'snowmobile-nn';

-- ────────────────────────────────────────────────  snegoprokat-nn
update public.crews c set
  metadata = jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,header,menuLinks}', '[{"label": "Каталог", "href": "/franchize/snegoprokat-nn"}, {"label": "Хранение", "href": "/franchize/snegoprokat-nn/storage"}, {"label": "Контакты", "href": "/franchize/snegoprokat-nn/contacts"}]'::jsonb, true)
    || jsonb_set(coalesce(c.metadata,'{}'::jsonb),
    '{franchize,contacts}',
    (c.metadata->'franchize'->'contacts') || ''{"telegram": "@salavey13"}'::jsonb'::jsonb, true)
    || '{"franchize": {"version": "2026-11-23-v2 (task206 landing parity: menuLinks fix, socials)"}}'::jsonb,
  updated_at = now()
where c.slug = 'snegoprokat-nn';

commit;
