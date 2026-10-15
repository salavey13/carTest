-- /docs/crewDocs/operator-attribution-october-sweep-2026-10-16.sql
-- Task 96 — OPTIONAL follow-up to operator-attribution-fix-2026-10-15.sql.
--
-- BOSS POLICY (2026-10-15/16): djorudjov (7813830016) is the ONLY operator of
-- vip-bike right now, so ALL October rental bonuses are his — even rentals
-- created by Paul (413553377), by the crew owner (356282674) or by renters
-- through the web self-service flow (created_by_operator_chat_id IS NULL).
--
-- CURRENT STATE (verified 2026-10-16, scripts/task96-verify-djorudjov-fix.mjs
-- + task95-salary-audit.ts): the 2026-10-15 fix landed (5/5 /doc rentals now
-- say 7813830016; djorudjov October = 62 880 ₽). But 8 more October rentals
-- still attribute to OTHER people via the action-based fallback chain
-- (pickup_freeze.frozen_by / return_confirmed_by / doc sender):
--
--   rental_id                              op was        why                bonus
--   2bfceacc-cc28-4628-b432-2ff37bf89c98   NULL          выдача (Paul)       ~1000 ₽
--   86234acc-a2bb-46ec-a123-e90b3df565da   413553377     /doc (Paul)          ~750 ₽
--   f335428d-ada2-4564-9fba-c52e07397536   NULL          выдача (Paul)       ~1000 ₽
--   33ec1f38-65de-4b1e-9bec-a587e44cd451   NULL          выдача (Paul)       ~1000 ₽
--   41ab8468-1110-4b02-a452-8accd159a1fc   NULL          возврат (Paul)      ~1000 ₽
--   50c71a29-93e6-4bae-8743-1f45b10efae9   NULL          выдача (Paul)       ~1000 ₽
--   685a9152-a0f4-4026-985a-793c816e4e55   NULL          выдача (Paul)       ~1000 ₽
--   24277629-cf4f-4953-9e21-ac24234d56e1   356282674     тест 10,35 ₽        ~751 ₽
--
-- Sum of those bonuses ≈ 7 626 ₽ (24 506 ₽ total for all 22 October rentals
-- minus the 16 880 ₽ already djorudjov's). After this sweep:
--   djorudjov October = 36 000 (смены) + 24 506 (все 22 аренды) + 10 000
--   (продажа Falcon Pro) = 70 506 ₽, выплачено 0.
--
-- HOW ATTRIBUTION WORKS (app/franchize/lib/operator-attribution.ts):
--   created_by_operator_chat_id (doc_command) has the HIGHEST priority —
--   setting it to 7813830016 overrides the handout/return fallbacks. That is
--   the single column this file touches.
--
-- ⚠️ KNOWN, DELIBERATE SIDE EFFECT: 41ab8468 has
-- private.rental_contract_artifacts.created_by_operator_chat_id = 413553377
-- (Paul really did run /doc for it). After the sweep the artifact↔rentals
-- cross-check reports 1 mismatch — that mismatch IS this policy override,
-- documented here, NOT the historical doc-manual bug (that one is fixed).
--
-- SAFE BY CONSTRUCTION:
--   • explicit rental_id list (8 rows, audit-verified above) — no broad UPDATE;
--   • idempotent: re-running changes nothing (`is distinct from` guard);
--   • touches ONLY created_by_operator_chat_id — money/user/status columns
--     stay untouched; cancelled rentals are not in the list (bc8f9342 stays);
--   • code side needs NO change: the attribution chain already prefers this
--     column, and the /doc writer is fixed since 2026-10-15 (doc-manual.ts).
--
-- Run in Supabase SQL Editor (service role / owner) — only if you accept the
-- boss's "all rental bonuses → djorudjov" policy for October.

begin;

-- sanity: show what will change (expected: 8 rows, all vip-bike, not cancelled)
select r.rental_id,
       r.created_by_operator_chat_id as rentals_row_says,
       r.status,
       r.total_cost
from public.rentals r
where r.rental_id in (
  '2bfceacc-cc28-4628-b432-2ff37bf89c98',
  '86234acc-a2bb-46ec-a123-e90b3df565da',
  'f335428d-ada2-4564-9fba-c52e07397536',
  '33ec1f38-65de-4b1e-9bec-a587e44cd451',
  '41ab8468-1110-4b02-a452-8accd159a1fc',
  '50c71a29-93e6-4bae-8743-1f45b10efae9',
  '685a9152-a0f4-4026-985a-793c816e4e55',
  '24277629-cf4f-4953-9e21-ac24234d56e1'
)
for update;

update public.rentals r
set created_by_operator_chat_id = '7813830016' -- DJORUDJOV — boss policy: sole operator owns all October rental bonuses
where r.rental_id in (
  '2bfceacc-cc28-4628-b432-2ff37bf89c98',
  '86234acc-a2bb-46ec-a123-e90b3df565da',
  'f335428d-ada2-4564-9fba-c52e07397536',
  '33ec1f38-65de-4b1e-9bec-a587e44cd451',
  '41ab8468-1110-4b02-a452-8accd159a1fc',
  '50c71a29-93e6-4bae-8743-1f45b10efae9',
  '685a9152-a0f4-4026-985a-793c816e4e55',
  '24277629-cf4f-4953-9e21-ac24234d56e1'
)
and r.created_by_operator_chat_id is distinct from '7813830016';

-- audit block (project convention: metadata.specs.owner_fix_*)
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{specs,owner_fix_20261016_operator_sweep}',
  jsonb_build_object(
    'at', to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS'),
    'what', 'October 2026 vip-bike rentals re-attributed to djorudjov (7813830016) per boss policy «sole operator owns all rental bonuses»',
    'policy', 'operator-attribution-october-sweep-2026-10-16.sql',
    'rental_ids', jsonb_build_array(
      '2bfceacc-cc28-4628-b432-2ff37bf89c98',
      '86234acc-a2bb-46ec-a123-e90b3df565da',
      'f335428d-ada2-4564-9fba-c52e07397536',
      '33ec1f38-65de-4b1e-9bec-a587e44cd451',
      '41ab8468-1110-4b02-a452-8accd159a1fc',
      '50c71a29-93e6-4bae-8743-1f45b10efae9',
      '685a9152-a0f4-4026-985a-793c816e4e55',
      '24277629-cf4f-4953-9e21-ac24234d56e1'
    ),
    'expected_effect', 'djorudjov October: 54 950 → 62 880 (after 2026-10-15 fix) → 70 506 ₽ (all 22 rentals); known artifact mismatch: 41ab8468 (sender 413553377) is deliberate',
    'prior_fix', 'owner_fix_20261015_operator_attribution'
  ),
  true
)
where c.slug = 'vip-bike';

commit;
