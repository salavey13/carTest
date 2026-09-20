-- supabase/migrations/20260921000000_seed_nn_moto_spot_crews.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Мототочки НН → dummy-экипажи (interlink map-riders ↔ community wall).
--
-- Каждой мототочке из lib/map-riders-spots.ts соответствует crew с slug =
-- spot.slug. Попап точки на карте ссылается на /franchize/<slug>/community и
-- /franchize/<slug>/map-riders — поэтому экипажи должны существовать в БД.
--
-- Идемпотентно: ON CONFLICT (slug) DO UPDATE — можно перезапускать.
-- owner_id наследуется от vip-bike (NOT NULL constraint): у dummy-экипажей
-- нет своих владельцев. Стены точек читаются всеми, постят только staff/админ.
--
-- ⚠️ Применять вручную в SQL editor (Supabase dashboard), как обычно.
-- Синхронизировано с lib/map-riders-spots.ts (тест map-wall-interlink.spec.ts
-- сверяет список slug в обе стороны).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

with data as (
  select
    v.slug,
    v.spot_id,
    v.name,
    v.kind,
    v.address,
    v.hq_location,
    v.palette,
    v.name || ' — мототочка Нижнего Новгорода на карте райдеров OnlyBike. ' || case v.kind
      when 'club'     then 'Мотоклуб: своя атмосфера, свои традиции.'
      when 'rental'   then 'Прокат кроссовой техники и площадка для катания.'
      when 'shop'     then 'Мотосалон: техника, запчасти и экипировка.'
      when 'service'  then 'Мотосервис: обслуживание и ремонт мототехники.'
      when 'school'   then 'Обучение и первые поездки под присмотром.'
      else 'Место силы нижегородского мотодвижения.'
    end as description
  from (values
    -- slug,                   spot_id,                name,                          kind,       address,                              hq_location,          palette (7 токенов resolvePaletteByMode)
    ('nn-motomesto',        'nn-motomesto',        'Мотоместо НН',                  'club',     'Комсомольская ул., 1',               '56.2958, 43.9478',   jsonb_build_object('bgBase','#140a0c','bgCard','#1e1114','accentMain','#ef4444','accentMainHover','#f87171','textPrimary','#f5e8ea','textSecondary','#b79aa0','borderSoft','#4a2328')),
    ('nn-motoclub-cross',   'nn-motoclub-cross',   'MOTOCLUB НН • кросс',           'rental',   'ул. Придорожная, 31 (Сормово)',      '56.3272, 43.8595',   jsonb_build_object('bgBase','#071417','bgCard','#0c1e22','accentMain','#06b6d4','accentMainHover','#22d3ee','textPrimary','#e5f6f9','textSecondary','#93b8c0','borderSoft','#1a3d44')),
    ('nn-bikeland',         'nn-bikeland',         'Байк Ленд Нижний Новгород',     'shop',     'ул. Ошарская, 14',                   '56.32124, 44.00945', jsonb_build_object('bgBase','#0a0f1a','bgCard','#111a2b','accentMain','#3b82f6','accentMainHover','#60a5fa','textPrimary','#e8eef9','textSecondary','#9db1cd','borderSoft','#22334f')),
    ('nn-rolling-moto',     'nn-rolling-moto',     'Роллинг Мото',                  'shop',     'Московское шоссе, 137а',             '56.2652, 43.8560',   jsonb_build_object('bgBase','#0a0f1a','bgCard','#111a2b','accentMain','#3b82f6','accentMainHover','#60a5fa','textPrimary','#e8eef9','textSecondary','#9db1cd','borderSoft','#22334f')),
    ('nn-mototeh-nn',       'nn-mototeh-nn',       'Мототех НН',                    'shop',     'ул. Артельная, 15б',                 '56.2755, 43.9160',   jsonb_build_object('bgBase','#0a0f1a','bgCard','#111a2b','accentMain','#3b82f6','accentMainHover','#60a5fa','textPrimary','#e8eef9','textSecondary','#9db1cd','borderSoft','#22334f')),
    ('nn-motogor',          'nn-motogor',          'Мотогор',                       'shop',     'ул. Коминтерна, 35а (Автозавод)',    '56.2362, 43.8407',   jsonb_build_object('bgBase','#0a0f1a','bgCard','#111a2b','accentMain','#3b82f6','accentMainHover','#60a5fa','textPrimary','#e8eef9','textSecondary','#9db1cd','borderSoft','#22334f')),
    ('nn-motoservice-nn',   'nn-motoservice-nn',   'Мотосервис-НН',                 'service',  'Мотальный пер., 11А',                '56.2881, 43.9085',   jsonb_build_object('bgBase','#081309','bgCard','#0f1e12','accentMain','#22c55e','accentMainHover','#4ade80','textPrimary','#e8f6ea','textSecondary','#a0c2a7','borderSoft','#1e3d25')),
    ('nn-krossmoto',        'nn-krossmoto',        'КроссМото НН',                  'school',   'ул. Мунина, 40к20',                  '56.2895, 43.9020',   jsonb_build_object('bgBase','#0f0a1a','bgCard','#181027','accentMain','#8b5cf6','accentMainHover','#a78bfa','textPrimary','#f0eaf9','textSecondary','#b3a4cd','borderSoft','#322651')),
    ('nn-mototehnika52',    'nn-mototehnika52',    'Мототехника 52',                'service',  'Магистральная ул., 136Е (Афонино)',  '56.2447, 44.0292',   jsonb_build_object('bgBase','#081309','bgCard','#0f1e12','accentMain','#22c55e','accentMainHover','#4ade80','textPrimary','#e8f6ea','textSecondary','#a0c2a7','borderSoft','#1e3d25')),
    ('nn-minin-square',     'nn-minin-square',     'пл. Минина и Пожарского',       'landmark', 'Верхняя часть города',               '56.3122, 44.0059',   jsonb_build_object('bgBase','#170e06','bgCard','#221509','accentMain','#f97316','accentMainHover','#fb923c','textPrimary','#f8ede2','textSecondary','#c4a88e','borderSoft','#4a2f18')),
    ('nn-nizhnevolzhskaya', 'nn-nizhnevolzhskaya', 'Нижневолжская набережная',      'landmark', 'У Стрелки',                          '56.3103, 44.0002',   jsonb_build_object('bgBase','#170e06','bgCard','#221509','accentMain','#f97316','accentMainHover','#fb923c','textPrimary','#f8ede2','textSecondary','#c4a88e','borderSoft','#4a2f18'))
  ) as v(slug, spot_id, name, kind, address, hq_location, palette)
)

insert into public.crews (name, description, logo_url, owner_id, slug, hq_location, metadata, created_at, updated_at)
select
  d.name,
  d.description,
  null::text,
  coalesce(
    (select c.owner_id from public.crews c where c.slug = 'vip-bike' limit 1),
    (select c.owner_id from public.crews c order by c.created_at asc limit 1)
  ),
  d.slug,
  d.hq_location,
  jsonb_build_object(
    'franchize', jsonb_build_object(
      'version', '2026-09-21-nn-moto-spots',
      'enabled', true,
      'slug', d.slug,
      'ui', jsonb_build_object('showCreateButton', false),
      'branding', jsonb_build_object(
        'name', d.name,
        'shortName', d.slug,
        'tagline', d.description,
        'logoUrl', '',
        'centerLogoInHeader', true
      ),
      'theme', jsonb_build_object('mode', 'dark', 'palette', d.palette),
      'header', jsonb_build_object(
        'menuLinks', jsonb_build_array(
          jsonb_build_object('label', 'Главная', 'href', '/franchize/' || d.slug),
          jsonb_build_object('label', 'Карта', 'href', '/franchize/' || d.slug || '/map-riders'),
          jsonb_build_object('label', 'Сообщество', 'href', '/franchize/' || d.slug || '/community')
        )
      ),
      'contacts', jsonb_build_object(
        'phone', '', 'email', '',
        'address', d.address,
        'telegram', '', 'workingHours', '',
        'map', jsonb_build_object(
          'gps', d.hq_location,
          'bounds', jsonb_build_object('top', 56.42, 'bottom', 56.08, 'left', 43.66, 'right', 44.12)
        )
      ),
      'footer', jsonb_build_object('socialLinks', jsonb_build_array())
    ),
    'motoSpot', jsonb_build_object(
      'spotId', d.spot_id,
      'kind', d.kind,
      'isDummy', true
    )
  ),
  now(),
  now()
from data d
on conflict (slug) do update set
  description = excluded.description,
  hq_location = excluded.hq_location,
  metadata = excluded.metadata,
  updated_at = now();

commit;
