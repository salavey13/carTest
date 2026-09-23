-- 2026-09-23 Task 45: explicit specs.condition for confirmed new/used bikes.
--
-- Why: specs.condition was not filled for ANY bike (Task 44 diagnostic), so
-- the CSV exporter's new/used split fell back to a model-year heuristic and
-- over-classified Jilang Max Pro, Leopard Asaka, LiveWire ONE, Motoland
-- Breakout 300, Regulmoto Nibbler 300 4V, Sotion EM01 as NEW. Per the owner
-- (2026-09-23): those six are NOT new (secondary market units). Confirmed
-- NEW: 4x 79BIKE Falcon, Sequence Zero, Y-VOLT Surge V.
--
-- Explicit condition pins these 12 bikes regardless of the exporter's year
-- threshold (year >= current_year - 1), which stays as fallback only for
-- bikes without an explicit condition.
--
-- IDEMPOTENT: re-running produces the same state (guarded by a
-- condition-value comparison). cars has NO updated_at column — do not add.
--
-- Apply manually in Supabase SQL editor (project inmctohsodgdohamhzag).

with cond(id, value) as (values
  -- confirmed NEW (2026-09-23, owner-confirmed)
  ('falcon-lite-2026',      'new'),
  ('falcon-lynx-purple',    'new'),
  ('falcon-gt-2026',        'new'),
  ('falcon-pro-2026',       'new'),
  ('sequence-zero',         'new'),
  ('y-volt-surge-v',        'new'),
  -- confirmed USED (owner: "these are not new ;)")
  ('jilang-max-pro',        'used'),
  ('leopard-asaka',         'used'),
  ('livewire-one',          'used'),
  ('motoland-breakout',     'used'),
  ('nibbler-regumoto-4v',   'used'),
  ('sotion-em01',           'used')
)
update public.cars c
set specs = jsonb_set(
      coalesce(c.specs, '{}'::jsonb),
      '{condition}',
      to_jsonb(cond.value),
      true
    )
from cond
where c.id = cond.id
  and coalesce(c.specs ->> 'condition', '') <> cond.value;

-- Report what remains without an explicit condition (should be the bikes
-- intentionally left to the exporter's year heuristic: HMD M02, Ducati
-- Panigale S Electro customs, BENDA LFC700, BMW F800R, Ducati 1199, ...).
select c.id,
       c.make,
       c.model,
       c.specs ->> 'condition' as condition
from public.cars c
where c.type = 'bike'
  and c.crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  and c.make <> 'VipBike'
order by coalesce(c.specs ->> 'condition', '') desc, c.make, c.model;
