-- Extend server-only franchize intent ledger with operator closer dashboard stages.
-- Actions append metadata history and move stage without deleting previous row context.

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
      'configured',
      'offer_sent',
      'manual_reserved',
      'alternative_offered',
      'closed'
    )
  );
