-- supabase/migrations/20260922000000_add_app_open_intent_type.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- franchize_intents.intent_type_allowed: add 'app_open'.
--
-- Code reality vs DB contract, part 2 (same story as
-- 20260722010000_fix_callback_lead_check_constraints.sql):
-- useTelegramAuth tracks every /franchize/<slug> open as
-- intentType='app_open', and the leads UI already renders it
-- («Открыл приложение», SourceBadge / Avatar / lead-priority) — but the
-- zod enum AND the DB CHECK constraint never learned the value, so those
-- intent rows silently failed validation and app-open leads never landed.
--
-- ⚠️ Применять вручную в SQL editor (Supabase dashboard), как обычно.
-- Идемпотентно: drop-if-exists + re-add.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.franchize_intents
  drop constraint if exists franchize_intents_intent_type_allowed;

alter table public.franchize_intents
  add constraint franchize_intents_intent_type_allowed check (
    intent_type in (
      'app_open',
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
