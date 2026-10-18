-- /docs/crewDocs/falcon-gt-rent-price-fix-2026-10-18.sql
-- FALCON GT RENT PRICE FIX — 1 500 ₽ → 3 000 ₽ (data fix, 2026-10-18)
--
-- RUNNER: Paul (manual, as always). Idempotent: guarded UPDATEs — re-running
-- changes nothing (each statement only fires while the old values are there).
--
-- WHY: rental 221cbd97-bdff-467a-8890-8c681a2ac640
--   79BIKE Falcon GT · Баукин Алексей Николаевич · 18.10.2026 13:00→14:00
--   (1 hour) · deposit 10 000 ₽ tbank · operator @DJORUDJOV,
--   created via /doc (doc_command) 18.10 13:01.
--   The bike's own /doc daily price IS 3 000 ₽ (metadata.daily_price = 3000),
--   but the operator's manual price override (doc-flow step «Цена») recorded
--   1 500 ₽. Paul: «it was not 1500, actually it was 3k» → the deal was 3 000 ₽.
--
-- CURRENT STATE (verified on prod 2026-10-18, scripts/falcon-fix-audit*.mjs):
--   rentals.total_cost                = 1500
--   metadata.bike_price               = 1500
--   metadata.equipment_price          = 0    (gear not included — unchanged)
--   metadata.daily_price              = 3000 (bike's real price — already right)
--   metadata.price_overridden         = true
--   metadata.price_override_amount    = 1500
--   metadata.payment_split            = { bank: 1500, cash: 0, card_destination: "tbank" }
--   payment_status                    = fully_paid
--   private.rental_contract_artifacts (91fb2fd0-2754-4cb2-bfcc-84b921461438)
--                                     total_sum = 1500
--
-- TOUCHES (2 rows, explicit ids — nothing else):
--   1) public.rentals — total_cost, metadata.bike_price,
--      metadata.payment_split.bank (tbank), metadata.price_override_amount,
--      + in-row audit stamp metadata.price_fix_audit (who/when/why/was);
--   2) private.rental_contract_artifacts — total_sum.
--
-- NOT TOUCHED (checked, no price inside):
--   • private.user_rental_secrets — renter PII only, keyed by doc_sha256;
--   • crew_todos ×11 — handover/return tasks, no money text;
--   • deposit_entries — 10 000 ₽ deposit is a separate deal part;
--   • rental_verifications — 0 rows, сверка for this rental not started;
--   • the stored contract DOCX — rendered before the fix, already sent to the
--     operator chat, still shows 1 500 ₽ on paper. Say the word and it will
--     be re-rendered + re-uploaded from the corrected record.
--
-- AFTER (rentals-analytics, recomputed live from total_cost/metadata):
--   Аренд сегодня 3 · Выручка 26 000 ₽ · Компании 19 000 ₽ ·
--   Партнёрам 7 000 ₽ (suzuki only — falcon is an OWN bike, no subrenter
--   cut) · Экипировка 1 000 ₽ (honda gear, unchanged).
--   The falcon's future сверка/закрытие (✅✅ flow) reads the same fixed
--   fields, so operator commission and profile earnings land on 3 000 ₽.

-- ── 1) rentals row: money fields + audit stamp ──────────────────────────────
update public.rentals
set total_cost = 3000,
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
           'bike_price', 3000,
           'price_override_amount', 3000,
           -- merge INSIDE payment_split: keep cash + card_destination intact
           'payment_split',
             coalesce(metadata #> '{payment_split}', '{}'::jsonb)
               || jsonb_build_object('bank', 3000),
           -- ── AUDIT (repo convention: data fixes carry their own stamp) ───
           'price_fix_audit', jsonb_build_object(
                'fixed_at', now()::timestamptz,
                'fixed_by', 'Paul (salavey13), SQL docs/crewDocs/falcon-gt-rent-price-fix-2026-10-18.sql',
                'reason',   'Actual rent was 3 000 ₽; /doc price override (step «Цена») recorded 1 500 ₽',
                'was', jsonb_build_object(
                     'total_cost', 1500,
                     'bike_price', 1500,
                     'payment_split.bank', 1500,
                     'price_override_amount', 1500)))
where rental_id = '221cbd97-bdff-467a-8890-8c681a2ac640'
  and total_cost = 1500;          -- idempotency guard (rerun ⇒ 0 rows)

-- ── 2) contract artifact: structured total ──────────────────────────────────
update private.rental_contract_artifacts
set total_sum = 3000
where rental_id = '221cbd97-bdff-467a-8890-8c681a2ac640'
  and total_sum = 1500;           -- idempotency guard

-- ── POST-CHECK (run after; expect bike_price=3000, bank=3000, audit set) ────
select rental_id, status, payment_status, total_cost,
       metadata->>'bike_price'          as bike_price,
       metadata#>>'{payment_split,bank}' as bank,
       metadata#>>'{payment_split,cash}' as cash,
       metadata->>'price_override_amount' as override,
       metadata->'price_fix_audit'        as audit
from public.rentals
where rental_id = '221cbd97-bdff-467a-8890-8c681a2ac640';

select id, total_sum, deposit_rub, original_sha256
from private.rental_contract_artifacts
where rental_id = '221cbd97-bdff-467a-8890-8c681a2ac640';

-- Day sanity: expect revenue 26000 over today's 3 started rentals (falcon 3000
-- + honda 9000 + suzuki 14000), gear 1000 (honda). Mirrors computeAnalyticsKpis:
-- real statuses + linked gear mirrors excluded + MSK-day scope.
select coalesce(sum(total_cost), 0) as revenue_started_today,
       count(*) as started_today
from public.rentals
where status in ('active','completed','confirmed','pending_confirmation')
  and coalesce(metadata->>'primary_rental_id','') = ''      -- linked gear mirrors out
  and (requested_start_date at time zone 'Europe/Moscow')::date
    = (now() at time zone 'Europe/Moscow')::date;
