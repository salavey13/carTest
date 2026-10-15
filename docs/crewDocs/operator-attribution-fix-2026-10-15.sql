-- /docs/crewDocs/operator-attribution-fix-2026-10-15.sql
-- Task 95 — fix rentals.created_by_operator_chat_id for October /doc rentals.
--
-- BACKGROUND (salary audit 2026-10-15):
--   doc-manual.ts used to write `created_by_operator_chat_id = crewOwnerChatId`
--   (the CREW OWNER) instead of the command sender. The salary attribution
--   chain (app/franchize/lib/operator-attribution.ts) trusts this column as
--   the /doc operator, so 6 October rentals of vip-bike were credited to the
--   crew owner (356282674) instead of the operator who actually ran /doc.
--   The TRUE sender is preserved forever in
--   private.rental_contract_artifacts.created_by_operator_chat_id — the fix
--   copies it back onto the rentals rows.
--
--   Code side is already fixed (doc-manual.ts now writes String(userId));
--   this file repairs the HISTORY. After running it, djorudjov's «Мои доходы»
--   for October gains +7 930 ₽ of rental bonuses (8 950 → 16 880 ₽; profile
--   total 54 950 → 62 880 ₽).
--
-- SAFE BY CONSTRUCTION:
--   • explicit rental_id list (audit-verified: artifact sender = 7813830016,
--     rentals row = 356282674) — no broad UPDATE;
--   • idempotent: re-running changes nothing (guard `is distinct from`);
--   • touches ONLY created_by_operator_chat_id — user_id / owner_id / money
--     columns stay untouched.
--
-- Verified against production 2026-10-15 (scripts/task95-salary-audit.ts).
-- Run in Supabase SQL Editor (service role / owner).

begin;

-- sanity: show what will change (expected: 5 rows)
select r.rental_id,
       r.created_by_operator_chat_id as rentals_row_says,
       a.created_by_operator_chat_id as artifact_says,
       r.total_cost
from public.rentals r
join private.rental_contract_artifacts a on a.rental_id = r.rental_id
where r.rental_id in (
  '9d7582e5-dfa6-469d-bfad-5c47d3f51129', -- 2026-10-09 Motoland Breakout 300      950 ₽
  '15db0028-ece6-4e62-9c50-a891bcd32fe7', -- 2026-10-09 Kawasaki EX650K          1 400 ₽
  '03e18650-74a8-439a-b2ba-efddbea0af96', -- 2026-10-10 Motoland Breakout 300    1 150 ₽
  '9f6c55fb-6c9a-4cf4-945b-544330f4aea6', -- 2026-10-12 Yamaha R6                2 800 ₽
  '28702ae4-21a2-45bb-9dd2-e770223ff933'  -- 2026-10-14 BMW F800R                1 630 ₽
);

update public.rentals r
set created_by_operator_chat_id = '7813830016' -- DJORUDJOV (7813830016) — confirmed by artifact sender
where r.rental_id in (
  '9d7582e5-dfa6-469d-bfad-5c47d3f51129',
  '15db0028-ece6-4e62-9c50-a891bcd32fe7',
  '03e18650-74a8-439a-b2ba-efddbea0af96',
  '9f6c55fb-6c9a-4cf4-945b-544330f4aea6',
  '28702ae4-21a2-45bb-9dd2-e770223ff933'
)
and r.created_by_operator_chat_id is distinct from '7813830016';

-- audit block (project convention: metadata.specs.owner_fix_*)
update public.crews c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{specs,owner_fix_20261015_operator_attribution}',
  '{"what":"rentals.created_by_operator_chat_id -> 7813830016 for 5 /doc rentals of Oct 2026 (doc-manual crewOwnerChatId bug; true sender from private.rental_contract_artifacts)","bonus_delta":"+7930 RUB rental bonuses for djorudjov","code_fix":"doc-manual.ts writes String(userId) since 2026-10-15"}'::jsonb,
  true
)
where c.slug = 'vip-bike';

commit;
