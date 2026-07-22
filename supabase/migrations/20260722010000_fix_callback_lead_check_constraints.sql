-- ═══════════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE FIX: franchize_intents CHECK constraints vs code reality
--
-- Discovered: 2026-07-22
-- Root cause: the DB CHECK constraints (intent_type_allowed / stage_allowed)
-- were narrower than the values actually sent by application code.
-- Silent INSERT failures across 6+ code paths — leads lost.
--
-- Fix: align both constraints with ALL values code may send.
-- See also: app/franchize/server-actions/intents.ts (Zod schema) — kept in sync.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Franchize intent_type_allowed ──────────────────────────────────────
-- Code-sent values added:
--   callback_request  (callback-lead route)
--   test_drive        (testdrive-manual, Zod schema)
--   service           (actions-runtime service flow)
alter table public.franchize_intents
  drop constraint if exists franchize_intents_intent_type_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_intent_type_allowed check (
    intent_type in (
      'callback_request',
      'checkout_start',
      'contact_click',
      'finance',
      'hold_created',
      'map_click',
      'payment_failure',
      'payment_success',
      'prebuy',
      'rent',
      'sale',
      'service',
      'test_drive',
      'test_ride',
      'test_ride_click',
      'trade_in'
    )
  );

-- ── 2. Franchize stage_allowed ────────────────────────────────────────────
-- Code-sent values added:
--   lead_captured     (callback-lead route)
--   dismissed         (leads-dismiss, lead-todo route)
alter table public.franchize_intents
  drop constraint if exists franchize_intents_stage_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_stage_allowed check (
    stage in (
      'alternative_offered',
      'checkout_started',
      'clicked',
      'closed',
      'configured',
      'contacted',
      'contract_generated',
      'discovered',
      'dismissed',
      'finance_requested',
      'hold_created',
      'lead_captured',
      'manual_reserved',
      'offer_sent',
      'payment_confirmed',
      'payment_failed',
      'prebuy_started',
      'test_ride_requested',
      'trade_in_requested',
      'viewed'
    )
  );
