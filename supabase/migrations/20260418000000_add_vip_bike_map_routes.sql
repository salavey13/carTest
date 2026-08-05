-- MapRiders default route POIs for vip-bike:
-- Adds scenic/interesting riding routes around HQ:
-- 1) City Cruise — downtown loop through Nizhny Novgorod center (~3km, easy)
-- 2) Riverfront Sprint — straight shot along the Oka embankment (~1.5km, fast)
-- 3) Bridge Crossing Loop — HQ → Metro Bridge → far side → back via Molitovsky (~6km, scenic)
-- 4) Offroad Between Bridges — Meshchersky Park trail loop (~2km, offroad)
--
-- All routes use type='path' (open polyline) or type='loop' (closed polyline).
-- The RacingMap component renders these as <Polyline> with the given color + weight.
-- roadHighlight.dashArray controls the line style (dashed for offroad, solid for paved).

with target_map as (
  select id
  from public.maps
  order by
    case
      when lower(coalesce(metadata->>'crew_slug', metadata->>'crewSlug', metadata->>'slug', '')) = 'vip-bike' then 0
      when is_default then 1
      else 2
    end,
    created_at desc
  limit 1
),
existing_non_routes as (
  select m.id,
         coalesce(
           jsonb_agg(poi) filter (where coalesce(poi->>'id', '') !~ '^vip-route-'),
           '[]'::jsonb
         ) as keep_pois
  from public.maps m
  join target_map t on t.id = m.id
  left join lateral jsonb_array_elements(coalesce(m.points_of_interest, '[]'::jsonb)) poi on true
  group by m.id
),
default_routes as (
  select jsonb_build_array(
    -- 1) City Cruise — downtown loop, paved, green
    jsonb_build_object(
      'id', 'vip-route-city-cruise',
      'name', 'Городской круиз • центр',
      'type', 'loop',
      'icon', '::FaRoute::',
      'color', '#22c55e',
      'coords', jsonb_build_array(
        jsonb_build_array(56.296444, 43.946389),
        jsonb_build_array(56.299565, 43.949636),
        jsonb_build_array(56.300048, 43.957637),
        jsonb_build_array(56.296444, 43.965872),
        jsonb_build_array(56.289543, 43.956825),
        jsonb_build_array(56.291365, 43.943057),
        jsonb_build_array(56.296444, 43.946389)
      ),
      'roadHighlight', jsonb_build_object('weight', 5, 'glow', true)
    ),
    -- 2) Riverfront Sprint — Oka embankment straight shot, paved, blue
    jsonb_build_object(
      'id', 'vip-route-river-sprint',
      'name', 'Набережный спринт • Ока',
      'type', 'path',
      'icon', '::FaRoute::',
      'color', '#3b82f6',
      'coords', jsonb_build_array(
        jsonb_build_array(56.294670, 43.945825),
        jsonb_build_array(56.291223, 43.943868),
        jsonb_build_array(56.287978, 43.940836),
        jsonb_build_array(56.285013, 43.936783)
      ),
      'roadHighlight', jsonb_build_object('weight', 6, 'glow', true)
    ),
    -- 3) Bridge Crossing Loop — Metro Bridge + Molitovsky Bridge, scenic, amber
    jsonb_build_object(
      'id', 'vip-route-bridge-loop',
      'name', 'Мостовой кольцевой • Метромост + Молитовский',
      'type', 'loop',
      'icon', '::FaBridge::',
      'color', '#f59e0b',
      'coords', jsonb_build_array(
        jsonb_build_array(56.296444, 43.946389),
        jsonb_build_array(56.290518, 43.950276),
        jsonb_build_array(56.284592, 43.954163),
        jsonb_build_array(56.277813, 43.952309),
        jsonb_build_array(56.277819, 43.934173),
        jsonb_build_array(56.280840, 43.930154),
        jsonb_build_array(56.287472, 43.932822),
        jsonb_build_array(56.301125, 43.951260),
        jsonb_build_array(56.296444, 43.946389)
      ),
      'roadHighlight', jsonb_build_object('weight', 5, 'glow', true)
    ),
    -- 4) Offroad Between Bridges — Meshchersky Park trail, dashed, orange/red
    jsonb_build_object(
      'id', 'vip-route-offroad-between-bridges',
      'name', 'Оффроуд между мостами • Мещерский парк',
      'type', 'loop',
      'icon', '::FaMountain::',
      'color', '#ef4444',
      'coords', jsonb_build_array(
        jsonb_build_array(56.289671, 43.941947),
        jsonb_build_array(56.285797, 43.943006),
        jsonb_build_array(56.282030, 43.946389),
        jsonb_build_array(56.280780, 43.953953),
        jsonb_build_array(56.284741, 43.958566),
        jsonb_build_array(56.286685, 43.943288),
        jsonb_build_array(56.289671, 43.941947)
      ),
      'roadHighlight', jsonb_build_object('weight', 4, 'dashArray', '8, 6', 'glow', false)
    )
  ) as routes
)
-- Idempotent: only run if vip-route-city-cruise is not already present
update public.maps m
set points_of_interest = enrp.keep_pois || dr.routes
from target_map tm
join existing_non_routes enrp on enrp.id = tm.id
cross join default_routes dr
where m.id = tm.id
  and not (coalesce(m.points_of_interest, '[]'::jsonb) @> '[{"id":"vip-route-city-cruise"}]'::jsonb);
