-- MapRiders default meetup POIs for vip-bike:
-- 1) VIP BIKE base moved to HQ coordinates (пл. Комсомольская 2: 56.297654, 43.947218)
-- 2) second meetup moved near HQ for realistic visualization
-- 3) third meetup at nearby location

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
existing_non_points as (
  select m.id,
         coalesce(
           jsonb_agg(poi) filter (where coalesce(poi->>'type', '') <> 'point'),
           '[]'::jsonb
         ) as routes_and_shapes
  from public.maps m
  join target_map t on t.id = m.id
  left join lateral jsonb_array_elements(coalesce(m.points_of_interest, '[]'::jsonb)) poi on true
  group by m.id
),
default_meet_points as (
  select jsonb_build_array(
    jsonb_build_object(
      'id', 'vip-base-point',
      'name', 'VIP BIKE HQ • пл. Комсомольская 2',
      'type', 'point',
      'icon', '::FaLocationDot::',
      'color', '#f97316',
      'coords', jsonb_build_array(jsonb_build_array(56.297654, 43.947218))
    ),
    jsonb_build_object(
      'id', 'vip-demo-rider-a',
      'name', 'Demo Rider A • 12 км/ч',
      'type', 'point',
      'icon', '::FaLocationDot::',
      'color', '#fb923c',
      'coords', jsonb_build_array(jsonb_build_array(56.301, 43.952))
    ),
    jsonb_build_object(
      'id', 'vip-demo-rider-b',
      'name', 'Demo Rider B • 14 км/ч',
      'type', 'point',
      'icon', '::FaLocationDot::',
      'color', '#fdba74',
      'coords', jsonb_build_array(jsonb_build_array(56.296, 43.935))
    ),
    jsonb_build_object(
      'id', 'vip-demo-rider-c',
      'name', 'Demo Rider C • 16 км/ч',
      'type', 'point',
      'icon', '::FaLocationDot::',
      'color', '#fed7aa',
      'coords', jsonb_build_array(jsonb_build_array(56.294, 43.96))
    )
  ) as points
)
update public.maps m
set points_of_interest = enp.routes_and_shapes || dmp.points,
    metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object('crew_slug', coalesce(m.metadata->>'crew_slug', m.metadata->>'crewSlug', m.metadata->>'slug', 'vip-bike'))
from target_map tm
join existing_non_points enp on enp.id = tm.id
cross join default_meet_points dmp
where m.id = tm.id;
