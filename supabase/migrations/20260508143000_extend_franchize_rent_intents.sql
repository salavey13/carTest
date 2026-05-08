-- Extend server-only franchize intent ledger for rental catalog/card signals.

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
      'prebuy',
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
      'viewed',
      'configured'
    )
  );
