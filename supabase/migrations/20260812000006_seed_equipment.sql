-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260812000006_seed_equipment.sql
-- Purpose:   I5 — seed equipment catalog (helmets, jackets, gloves, boots)
-- Plan:      docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Этап 2, backend-core)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Seed equipment items into cars table (type='equipment').
-- PRD §2.7 lists 4 base positions; expandable via INSERT.
-- Uses ON CONFLICT for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════

-- Note: These IDs (equip-helmet-l, etc.) are used by doc-manual integration for
-- mapping equipment selections to catalog items. Change IDs requires updating
-- EQUIPMENT_FLAG_TO_CAR_ID mapping in equipment-rentals.ts.

INSERT INTO public.cars (id, crew_id, make, model, type, status, daily_price, created_at)
VALUES
  -- Helmets (S, M, L sizes)
  ('equip-helmet-s', (SELECT id FROM crews LIMIT 1), 'MT', 'Helmet S', 'equipment', 'available', 200, now()),
  ('equip-helmet-m', (SELECT id FROM crews LIMIT 1), 'MT', 'Helmet M', 'equipment', 'available', 200, now()),
  ('equip-helmet-l', (SELECT id FROM crews LIMIT 1), 'MT', 'Helmet L', 'equipment', 'available', 200, now()),

  -- Jackets (S, M, L sizes)
  ('equip-jacket-s', (SELECT id FROM crews LIMIT 1), 'MT', 'Jacket S', 'equipment', 'available', 300, now()),
  ('equip-jacket-m', (SELECT id FROM crews LIMIT 1), 'MT', 'Jacket M', 'equipment', 'available', 300, now()),
  ('equip-jacket-l', (SELECT id FROM crews LIMIT 1), 'MT', 'Jacket L', 'equipment', 'available', 300, now()),

  -- Gloves (S, M, L sizes)
  ('equip-gloves-s', (SELECT id FROM crews LIMIT 1), 'MT', 'Gloves S', 'equipment', 'available', 100, now()),
  ('equip-gloves-m', (SELECT id FROM crews LIMIT 1), 'MT', 'Gloves M', 'equipment', 'available', 100, now()),
  ('equip-gloves-l', (SELECT id FROM crews LIMIT 1), 'MT', 'Gloves L', 'equipment', 'available', 100, now()),

  -- Boots (S, M, L sizes)
  ('equip-boots-s', (SELECT id FROM crews LIMIT 1), 'MT', 'Boots S', 'equipment', 'available', 150, now()),
  ('equip-boots-m', (SELECT id FROM crews LIMIT 1), 'MT', 'Boots M', 'equipment', 'available', 150, now()),
  ('equip-boots-l', (SELECT id FROM crews LIMIT 1), 'MT', 'Boots L', 'equipment', 'available', 150, now())
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.cars IS
'Vehicles and equipment catalog. Equipment items have type=''equipment''. Seed: helmets/jackets/gloves/boots in S/M/L sizes (200-300₽/day). IDs (equip-helmet-l, etc.) are referenced in doc-manual integration.';

COMMENT ON TABLE public.equipment_rentals IS
'I5: standalone equipment rentals. Equipment = cars rows with type=''equipment''. Equipment seed IDs: equip-helmet-{s,m,l}, equip-jacket-{s,m,l}, equip-gloves-{s,m,l}, equip-boots-{s,m,l}.';
