-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000008_backfill_cash_transactions.sql
-- Purpose:   I5 — backfill cash transactions for existing rentals and sales
-- Plan:      docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 3)
-- Contract:  PLAN-I5-SERVICE-OPERATIONS.md п.5 (backfill sales: JOIN crews ON slug)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Backfills income_rental for completed/active rentals and income_sale for
-- existing sale_contract_artifacts. Uses same NOT EXISTS guards as triggers
-- for idempotency (can re-run migration safely).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Backfill rentals ───────────────────────────────────────────────────────
INSERT INTO public.cash_transactions (
  crew_id, rental_id, transaction_type, amount, flow_direction,
  payment_method, category, description, transaction_date, created_by
)
SELECT
  r.crew_id,
  r.rental_id,
  'income_rental',
  COALESCE(r.total_cost, 0),
  'in',
  COALESCE(r.metadata->>'payment_method', 'cash'),
  'Аренда',
  'Аренда ' || COALESCE((SELECT model FROM public.cars WHERE id = r.vehicle_id), ''),
  COALESCE(r.created_at, now()),
  COALESCE(r.created_by_operator_chat_id, r.owner_id, 'system')
FROM public.rentals r
WHERE r.status IN ('completed', 'active')
  AND r.crew_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_transactions ct
    WHERE ct.rental_id = r.rental_id AND ct.transaction_type = 'income_rental'
  );

-- ── Backfill sales (contract p.5: JOIN crews ON slug) ───────────────────────
INSERT INTO public.cash_transactions (
  crew_id, sale_contract_id, transaction_type, amount, flow_direction,
  payment_method, category, description, transaction_date, created_by
)
SELECT
  c.id,
  s.id,
  'income_sale',
  COALESCE(s.total_sum, NULLIF(REPLACE(s.sale_price, ' ', ''), '')::NUMERIC, 0),
  'in',
  'cash',
  'Продажа',
  'Продажа ' || COALESCE((SELECT model FROM public.cars WHERE id = s.resolved_bike_id), ''),
  s.created_at,
  COALESCE(s.created_by_operator_chat_id, 'system')
FROM private.sale_contract_artifacts s
JOIN public.crews c ON c.slug = s.crew_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_transactions ct
  WHERE ct.sale_contract_id = s.id AND ct.transaction_type = 'income_sale'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Note: Commissions are NOT backfilled (no guarantee when rates were configured;
-- operators can calculate manually for historical periods if needed).
-- ═══════════════════════════════════════════════════════════════════════════
