-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260826000001_create_salary_coefficients.sql
-- Purpose:   Configurable salary coefficients — official bonus scheme
--            (fixed bonuses per equipment category + overprice percent).
-- PRD:       docs/PRD_SALARY_COEFFICIENTS.md
-- Source:    official bonus document provided by business 2026-08-26
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two tables:
--   salary_coefficients   — ₽ bonuses per category (rentals, sales, equipment
--                           sales) + overprice percent. Seeded with official
--                           defaults for every crew.
--   bike_salary_categories — per-crew bike → category mapping (rental and
--                           sale categories independently). Seeded with the
--                           default mapping from the official document.
--
-- Code-level defaults live in lib/salary-coefficients.ts and mirror this seed,
-- so the feature degrades gracefully when the migration is not yet applied.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.salary_coefficients (
  crew_id     UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN (
    'rental',           -- categories: budget | regular | partner_regular | premium | partner_premium | equipment
    'sale',             -- categories: enduro_moped | regular | premium
    'equipment_sale',   -- categories: helmet | balaclava | jacket | pants | gloves
    'overprice'         -- categories: percentage
  )),
  category    TEXT NOT NULL,
  amount      NUMERIC NOT NULL CHECK (amount >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, kind, category)
);

CREATE INDEX IF NOT EXISTS idx_salary_coefficients_crew
  ON public.salary_coefficients(crew_id) WHERE is_active = TRUE;

COMMENT ON TABLE public.salary_coefficients IS
'Salary coefficients: fixed bonuses per category (official scheme 2026-08-26) + overprice percent. kind=rental categories: budget/regular/partner_regular/premium/partner_premium/equipment (equipment = per unit). kind=sale: enduro_moped/regular/premium. kind=equipment_sale: helmet/balaclava/jacket/pants/gloves. kind=overprice: percentage.';

CREATE TABLE IF NOT EXISTS public.bike_salary_categories (
  crew_id          UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  bike_id          TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  rental_category  TEXT NOT NULL CHECK (rental_category IN (
    'budget', 'regular', 'partner_regular', 'premium', 'partner_premium'
  )),
  sale_category    TEXT NOT NULL CHECK (sale_category IN (
    'enduro_moped', 'regular', 'premium'
  )),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, bike_id)
);

CREATE INDEX IF NOT EXISTS idx_bike_salary_categories_bike
  ON public.bike_salary_categories(bike_id);

COMMENT ON TABLE public.bike_salary_categories IS
'Per-crew bike → salary category mapping. rental_category drives the rental bonus, sale_category the sale bonus. Defaults seeded from the official document; unmapped bikes fall back to regular/regular in code.';

-- RLS: crew members can read; writes go through server actions using the
-- service-role client with verifyCrewAccess (owner / co_owner / admin).
ALTER TABLE public.salary_coefficients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_salary_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read salary coefficients" ON public.salary_coefficients;
CREATE POLICY "Crew members can read salary coefficients"
  ON public.salary_coefficients FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = salary_coefficients.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

DROP POLICY IF EXISTS "Crew members can read bike salary categories" ON public.bike_salary_categories;
CREATE POLICY "Crew members can read bike salary categories"
  ON public.bike_salary_categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = bike_salary_categories.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED 1: official bonus defaults for every existing crew
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.salary_coefficients (crew_id, kind, category, amount)
SELECT c.id, v.kind, v.category, v.amount
FROM public.crews c
CROSS JOIN (VALUES
  -- Аренда (₽ за закрытую аренду, по категории техники)
  ('rental', 'budget',           750),
  ('rental', 'regular',          1000),
  ('rental', 'partner_regular',  500),
  ('rental', 'premium',          1500),
  ('rental', 'partner_premium',  750),
  ('rental', 'equipment',        200),   -- за единицу экипа
  -- Продажа техники (₽ за продажу)
  ('sale',   'enduro_moped',     5000),
  ('sale',   'regular',          10000),
  ('sale',   'premium',          15000),
  -- Продажа экипировки (₽ за единицу)
  ('equipment_sale', 'helmet',     500),
  ('equipment_sale', 'balaclava',  100),
  ('equipment_sale', 'jacket',     500),
  ('equipment_sale', 'pants',      500),
  ('equipment_sale', 'gloves',     200),
  -- Овер Прайс: % от наценки
  ('overprice', 'percentage',     10)
) AS v(kind, category, amount)
ON CONFLICT (crew_id, kind, category) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED 2: default bike → category mapping (official document, catalog IDs)
-- ═══════════════════════════════════════════════════════════════════════════
-- Rental categories:
--   budget: U2, Брейкаут 300, Ниблер 300, Скутер (+ питбайк Kayo, HMD M02)
--   regular: БМВ, Дукати Зубик (1199), Эндуро
--   partner_regular: Ямаха, Кава, Дукати Берюзовый/электро-реплики, Априли
--   premium: Сиквенс, Харлей (LiveWire ONE)
--   partner_premium: Сузуки
-- Sale categories: эндуро/мопеды 5000, обычные 10000, премиум 15000.
INSERT INTO public.bike_salary_categories (crew_id, bike_id, rental_category, sale_category)
SELECT cm.crew_id, v.bike_id, v.rental_category, v.sale_category
FROM (SELECT DISTINCT crew_id FROM public.cars WHERE crew_id IS NOT NULL) cm
CROSS JOIN (VALUES
  -- budget (750 ₽) — мопеды/скутеры/бюджетная техника
  ('wenbox-u2-pro',                          'budget',          'enduro_moped'),
  ('motoland-breakout',                      'budget',          'enduro_moped'),
  ('nibbler-regumoto-4v',                    'budget',          'enduro_moped'),
  ('jilang-max-pro',                         'budget',          'enduro_moped'),
  ('leopard-asaka',                          'budget',          'enduro_moped'),
  ('kayo-tsd110',                            'budget',          'enduro_moped'),
  ('hmd-m02',                                'budget',          'enduro_moped'),
  -- regular (1000 ₽) — БМВ, Дукати Зубик, Эндуро
  ('bmw-f800r',                              'regular',         'regular'),
  ('bmw-s1000rr-electro-silver',             'regular',         'regular'),
  ('ducati-1199-panigale-2012',              'regular',         'regular'),
  ('falcon-gt-2026',                         'regular',         'enduro_moped'),
  ('falcon-pro-2026',                        'regular',         'enduro_moped'),
  ('rerode-r1-plus',                         'regular',         'enduro_moped'),
  ('y-volt-surge-v',                         'regular',         'enduro_moped'),
  -- partner_regular (500 ₽) — Ямаха, Кава, Априли, электро-реплики Дукати
  ('yamaha-r7',                              'partner_regular', 'regular'),
  ('kawasaki-ex650k',                        'partner_regular', 'regular'),
  ('aprilia-shiver',                         'partner_regular', 'regular'),
  ('ducati-panigale-s-electro-black',        'partner_regular', 'regular'),
  ('ducati-panigale-s-electro-black-aero',   'partner_regular', 'regular'),
  ('ducati-panigale-s-electro-black-chain',  'partner_regular', 'regular'),
  ('ducati-panigale-s-electro-gold',         'partner_regular', 'regular'),
  ('ducati-panigale-s-electro-green',        'partner_regular', 'regular'),
  -- premium (1500 ₽) — Сиквенс, Харлей
  ('sequence-zero',                          'premium',         'premium'),
  ('livewire-one',                           'premium',         'premium'),
  -- partner_premium (750 ₽) — Сузуки
  ('suzuki-gsx-s1000f',                      'partner_premium', 'premium')
) AS v(bike_id, rental_category, sale_category)
JOIN public.cars c ON c.id = v.bike_id AND c.crew_id = cm.crew_id
ON CONFLICT (crew_id, bike_id) DO NOTHING;
