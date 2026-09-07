-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260907000000_leads_perf_indexes.sql
-- Purpose:   Leads page performance — cover the two hottest lead queries
-- Measured:  getFranchizeLeads (leads page load) runs on EVERY page load:
--            1. franchize_intents: slug=eq + stage!=dismissed
--               ORDER BY last_seen_at DESC LIMIT 800
--               (the existing (slug, urgency_score, updated_at) index cannot
--                serve the last_seen_at ordering → full sort per load)
--            2. crew_todos: crew_id=eq + category IN (3 values)
--               (separate crew_id/category indexes force a bitmap-AND)
-- Both are pure speed (IF NOT EXISTS) — no behavior change.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Serves the canonical leads query ordering without a sort node.
create index if not exists franchize_intents_slug_last_seen_idx
  on public.franchize_intents (slug, last_seen_at desc)
  where stage <> 'dismissed';

-- 2. Serves the crew_todos enrichment batch (lead_followup / rental_verification /
--    lead_handling hydration — «Отработан»/«Перезвонить» state on lead cards).
create index if not exists idx_crew_todos_crew_category
  on public.crew_todos (crew_id, category);
