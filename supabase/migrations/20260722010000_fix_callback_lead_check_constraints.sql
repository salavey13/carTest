-- Hotfix: callback-lead route sends intent_type='callback_request' and stage='lead_captured',
-- but neither value is present in the CHECK constraints (franchize_intents_intent_type_allowed
-- and franchize_intents_stage_allowed). The INSERT silently fails with a warn log.
--
-- Impact: web-site callback leads NEVER actually persisted in franchize_intents.
-- Telegram notification still fires (separate fetch), so operators saw the message
-- but the lead was invisible in /leads UI, analytics, and follow-up pipelines.
--
-- Fix: add both missing values to the respective CHECK constraint lists.

alter table public.franchize_intents
  drop constraint if exists franchize_intents_intent_type_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_intent_type_allowed check (
    intent_type in (
      'callback_request',
      'checkout_start',
      'payment_failure',
      'payment_success',
      'hold_created',
      'map_click',
      'contact_click',
      'test_ride_click',
      'test_ride',
      'prebuy',
      'trade_in',
      'finance',
      'rent',
      'sale'
    )
  );

alter table public.franchize_intents
  drop constraint if exists franchize_intents_stage_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_stage_allowed check (
    stage in (
      'lead_captured',
      'discovered',
      'clicked',
      'prebuy_started',
      'checkout_started',
      'hold_created',
      'payment_failed',
      'payment_confirmed',
      'contacted',
      'test_ride_requested',
      'trade_in_requested',
      'finance_requested',
      'viewed',
      'configured',
      'offer_sent',
      'manual_reserved',
      'alternative_offered',
      'closed',
      'contract_generated'
    )
  );
