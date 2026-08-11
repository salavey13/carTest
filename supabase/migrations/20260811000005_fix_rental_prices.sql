-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260811000005_fix_rental_prices.sql
-- Purpose:   Fix incorrect total_cost for 3 rentals created with string
--             concatenation bug. Also update rental_contract_artefacts.total_sum.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Root cause: pricing-calculator.ts returned string prices from JSONB specs
-- (e.g. '6000' instead of 6000). doc-manual.ts then did string concatenation
-- instead of numeric addition for total_cost. Fixed in code, but 3 active
-- rentals still have wrong prices in the DB.
--
-- Corrections (user-specified):
--   5c135994 (Nibbler):   6000 → 7000  (6000 rent + 1000 helmet)
--   c14e9f79 (BMW F800R): 12000 → 13000 (12000 rent + 1000 helmet)
--   7fb45254 (Falcon GT): 1200 → 7000  (6000 rent + 1000 helmet, price was
--                                        wrongly calculated as 1-hour rate)
--
-- Also update rental_contract_artefacts.total_sum (private schema).
-- total_sum = total_cost + deposit_rub (the artefact includes deposit).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Fix rentals.total_cost ─────────────────────────────────────────────

-- 5c135994 (Nibbler): 6000 → 7000
UPDATE public.rentals
SET total_cost = 7000,
    metadata = metadata || '{"price_corrected": true, "price_corrected_from": 6000, "price_corrected_to": 7000, "price_correction_reason": "string concatenation bug — equipment cost not included"}'::jsonb,
    updated_at = NOW()
WHERE rental_id = '5c135994-c47a-4792-a6c6-73be814fa708';

-- c14e9f79 (BMW F800R): 12000 → 13000
UPDATE public.rentals
SET total_cost = 13000,
    metadata = metadata || '{"price_corrected": true, "price_corrected_from": 12000, "price_corrected_to": 13000, "price_correction_reason": "string concatenation bug — equipment cost not included"}'::jsonb,
    updated_at = NOW()
WHERE rental_id = 'c14e9f79-150d-475b-a6db-441392b22d09';

-- 7fb45254 (Falcon GT): 1200 → 7000
UPDATE public.rentals
SET total_cost = 7000,
    metadata = metadata || '{"price_corrected": true, "price_corrected_from": 1200, "price_corrected_to": 7000, "price_correction_reason": "string concatenation bug — equipment cost not included + wrong tier calculation"}'::jsonb,
    updated_at = NOW()
WHERE rental_id = '7fb45254-5082-449f-82f8-23801bd7d5fd';


-- ─── 2. Fix rental_contract_artefacts.total_sum (private schema) ──────────
-- total_sum = total_cost (rent + equipment) + deposit_rub
-- Deposits: 5c135994=15000, c14e9f79=20000, 7fb45254=20000

-- 5c135994: 7000 + 15000 = 22000 (was 22500 — old: 6000+1500 equip+15000 deposit)
UPDATE private.rental_contract_artifacts
SET total_sum = 22000,
    daily_price = 6000
WHERE rental_id = '5c135994-c47a-4792-a6c6-73be814fa708';

-- c14e9f79: 13000 + 20000 = 33000 (was 33500 — old: 12000+1500 equip+20000 deposit)
UPDATE private.rental_contract_artifacts
SET total_sum = 33000,
    daily_price = 12000
WHERE rental_id = 'c14e9f79-150d-475b-a6db-441392b22d09';

-- 7fb45254: 7000 + 20000 = 27000 (was 21700 — old: 1200+500 equip+20000 deposit)
UPDATE private.rental_contract_artifacts
SET total_sum = 27000,
    daily_price = 6000
WHERE rental_id = '7fb45254-5082-449f-82f8-23801bd7d5fd';


-- ─── 3. Verify ─────────────────────────────────────────────────────────────
-- Run these manually to verify:
--
-- SELECT rental_id, vehicle_id, total_cost, status
-- FROM public.rentals
-- WHERE rental_id IN (
--   '5c135994-c47a-4792-a6c6-73be814fa708',
--   'c14e9f79-150d-475b-a6db-441392b22d09',
--   '7fb45254-5082-449f-82f8-23801bd7d5fd'
-- );
-- -- Expect: 7000, 13000, 7000
--
-- SELECT rental_id, total_sum, daily_price, deposit_rub
-- FROM private.rental_contract_artifacts
-- WHERE rental_id IN (
--   '5c135994-c47a-4792-a6c6-73be814fa708',
--   'c14e9f79-150d-475b-a6db-441392b22d09',
--   '7fb45254-5082-449f-82f8-23801bd7d5fd'
-- );
-- -- Expect: 22000/6000/15000, 33000/12000/20000, 27000/6000/20000
-- ═══════════════════════════════════════════════════════════════════════════
