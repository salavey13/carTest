-- Extend server-only franchize intent ledger for prebuy/test-ride/trade-in/finance marketplace leads.

alter table public.franchize_intents
  drop constraint if exists franchize_intents_intent_type_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_intent_type_allowed check (
    intent_type in (
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
      'rent'
    )
  );

alter table public.franchize_intents
  drop constraint if exists franchize_intents_stage_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_stage_allowed check (
    stage in (
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
      'configured'
    )
  );
