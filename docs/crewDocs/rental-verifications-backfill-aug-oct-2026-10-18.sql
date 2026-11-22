-- /docs/crewDocs/rental-verifications-backfill-aug-oct-2026-10-18.sql
-- VERIFICATION BACKFILL — AUGUST + SEPTEMBER + OCTOBER 2026 (task: «verify all»)
--
-- RUNNER: Paul (manual, as always). Idempotent: INSERT ... ON CONFLICT
-- (rental_id) DO NOTHING — re-running changes nothing, live rows are never
-- touched or overwritten.
--
-- WHAT: every CLOSED (completed/confirmed), non-test, non-mirror rental with
-- requested_start_date in Aug/Sep/Oct 2026 that has NO verification row yet
-- (168 rows). Each gets a PENDING verification whose snapshot is the
-- CANONICAL commission math (computeRentalVerificationSnapshot — the exact
-- functions the salary pays with) frozen at generation time, PLUS:
--   snapshot.audit = { grade: 'fine'|'almost'|'sus', notes[], checked_at }
-- from the audit script (scripts/vf-b-audit.mjs, 2026-10-18):
--   • fine   — money coherent (books vs contract vs split, deposit-aware)
--   • almost — bookkeeping gaps (no odometer_after / return stamps on legacy
--              closures, deposit carried in split.cash, retro paperwork) —
--              confirm after a quick look
--   • sus    — real inconsistencies (paper vs books rent mismatch, split vs
--              total mismatch, missing contract artifact, reversed dates)
--              — resolve BY HAND, never bulk-confirm these
--
-- WORKFLOW after applying:
--   1. Аналитика аренд → «🤝 Сверка» strip → button «✅ fine за ГГГГ-ММ»
--      (owner only): dry-run preview → confirm → all FINE rows of the month
--      become verified (boss-confirms-for-the-pair, optimistic-locked).
--   2. ALMOST/SUS: open the drawer (chip «⏳ сверка»), fix numbers via
--      «⚠️ Оспорить»/manual, or confirm individually.
--   3. /payouts hub: verified rows appear in the payout buckets as usual.
--
-- NOT TOUCHED: existing verification rows (incl. disputed R6/suzuki), active/
-- pending rentals (they enter the game automatically on closure — the
-- trigger now runs BEFORE the TG tail, vf-fix 2026-10-18), test rides
-- (69₽/100₽ is_test_result rows), linked equipment mirrors.

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9c0ba304-0a95-4534-88e9-9ecb18c7cacb', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Wenbox U2 Pro","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":6000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:14.659Z","audit":{"grade":"sus","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","договор на бумаге 17000 ₽ против книг 6000 ₽ (депозит 10000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:16.064Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f44fe33e-c994-4fee-affd-e8a329adecb3', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":6000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:16.064Z","audit":{"grade":"sus","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","договор на бумаге 17000 ₽ против книг 6000 ₽ (депозит 10000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:16.871Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('955bd31a-487e-4dcb-a6be-028d91987cf0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:16.871Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:17.676Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7b5c12ed-9d13-4c31-80d9-8f67c1d0979e', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":5400,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:17.676Z","audit":{"grade":"sus","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","договор на бумаге 27400 ₽ против книг 5400 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:18.117Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('eb8f9728-fe29-4038-8efe-593a3cab9f2f', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Sequence Zero","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":9000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:18.117Z","audit":{"grade":"sus","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","договор на бумаге 29500 ₽ против книг 9000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:18.955Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a2b8acde-74da-4ce9-a3ba-01abce104ecf', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена тормозных колодок (комплект)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:18.955Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:19.579Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('ecfa174f-bc0c-4241-99f4-8bfde80d61a9', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ремонт и покраска накладки","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":750,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:19.579Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:20.002Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('fc927114-6878-4131-86d1-a4a50b321817', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Прокачка тормозов","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:20.002Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:20.432Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('94b5b41d-e435-4e28-9773-483f0cf59c7c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Gold","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:20.432Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)"],"checked_at":"2026-10-18T18:04:20.859Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('72ba2b09-d537-41de-9f57-19179037b12b', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Покраска, снятие и установка боковины","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:20.860Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:21.286Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('932985a4-75e8-4296-a106-34aec77c438b', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Чистка и смазка цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":625,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:21.286Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:21.740Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b3e9b4a1-796a-46df-80a9-77b39cba3fd8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Gold","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:21.740Z","audit":{"grade":"sus","notes":["договор на бумаге 28500 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:22.160Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('60d3defb-0e73-4b16-828d-707e28af9d68', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Regulmoto Nibbler 300 4V","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":6000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:22.160Z","audit":{"grade":"sus","notes":["договор на бумаге 25000 ₽ против книг 6000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:23.382Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('fc7be22b-caed-4010-acfb-db47dca50087', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Снятие и установка переднего колеса с суппортом","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":350,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:23.382Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:23.800Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b100a570-14a1-4d0d-919b-533ffafa7837', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка байка","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:23.800Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:24.224Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('ed3ebad0-612d-4eee-bd05-6f1435ecfd42', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ослабление цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":400,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:24.224Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:25.023Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('cb2dfa38-fa01-4054-91fe-6048c58b10b1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:25.023Z","audit":{"grade":"sus","notes":["договор на бумаге 32500 ₽ против книг 10000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:26.240Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d8de0b35-9ac4-4458-80ca-a683775f21ac', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка байка","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":2500,"base":750,"equipment":0,"overprice":125,"total":875,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:26.240Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:27.026Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('73f05d0f-7132-4916-8b6c-44345d7536e4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена концевиков","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:27.026Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:27.822Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('97f44178-2edc-4fe6-8887-b68802a775bf', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Проверка датчиков подножки / снятие нижних кожухов","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:27.822Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:28.243Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('1980d400-70c1-4ee9-88f4-789422cf587d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:28.243Z","audit":{"grade":"sus","notes":["completed без odometer_after","договор на бумаге 27500 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:29.070Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('5c135994-c47a-4792-a6c6-73be814fa708', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Regulmoto Nibbler 300 4V","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":7000,"base":750,"equipment":0,"overprice":100,"total":850,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":"[Лёгкие повреждения] правеа диска и номерная рамка","returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:29.070Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:29.689Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('c14e9f79-150d-475b-a6db-441392b22d09', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":13000,"base":1000,"equipment":0,"overprice":300,"total":1300,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:29.689Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:30.678Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7fb45254-5082-449f-82f8-23801bd7d5fd', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon GT","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":0,"overprice":400,"total":1400,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:30.678Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:04:31.099Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('745bc221-5ec3-4c9b-a924-e54a0b8d93fe', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена правой водительской подножки","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":200,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:31.099Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:31.709Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('886ff577-938f-4607-84f4-beb27217fcab', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена ручки газа (с разбором) + замена фишки (электрика)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:31.709Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:32.130Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e57a8ffc-47b8-4aea-a80d-89710aa39e33', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon GT","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":4000,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:04:32.130Z","audit":{"grade":"sus","notes":["договор на бумаге 16700 ₽ против книг 4000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:32.555Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a0089e42-6155-49e9-bcb6-7142b01496b0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ремонт крепления плуга","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:32.556Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:32.980Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('59b77194-57ee-4b3d-9040-ed5d35e18d26', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Установка грипсов","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:32.980Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:33.603Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7fde74ac-4424-4755-85f8-5358f3a63014', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Крепление сиденья, покраска ручки с разбором пульта","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":200,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:33.603Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:34.416Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f8a98f10-0ef5-4052-8fc4-b891739f5f9d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Чистка, смазка и натяжка цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:34.416Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:35.203Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d6187779-49ef-4b51-8b19-6fa108a755cf', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Regulmoto Nibbler 300 4V","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":4000,"base":750,"equipment":600,"overprice":0,"total":1350,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:04:35.203Z","audit":{"grade":"sus","notes":["договор на бумаге 25000 ₽ против книг 4000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:36.004Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('24406a2d-8374-4ac2-a993-cb6d3c5a6909', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":4000,"base":1000,"equipment":600,"overprice":0,"total":1600,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:04:36.004Z","audit":{"grade":"sus","notes":["doc_command: нет rental_contract_artifacts (договор не записан)"],"checked_at":"2026-10-18T18:04:36.435Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('4a3fe1a7-c6b9-4564-95ff-544297cde663', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":9000,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:36.435Z","audit":{"grade":"sus","notes":["договор на бумаге 30200 ₽ против книг 9000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:37.228Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('bdd9f40e-e101-4c0f-98e4-e6e164071669', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ремонт подножки и датчика","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":750,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:37.228Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:37.661Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('59dc6799-1b2b-488d-b9ef-8a8ac0a5440d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Чистка маятника и диска","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:37.661Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:38.456Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('899139d9-b895-4d19-9771-dfda94b56547', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ремонт колеса (устранение задевания суппорта)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:38.456Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:38.880Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b5707303-c104-47a3-a797-71ede05ac0d3', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":12000,"base":1000,"equipment":400,"overprice":50,"total":1450,"equipmentUnits":2,"equipmentFlags":"1шл+курт","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:38.880Z","audit":{"grade":"sus","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","doc_command: нет rental_contract_artifacts (договор не записан)"],"checked_at":"2026-10-18T18:04:39.689Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b938ba57-d786-46ef-8323-4c318f3b710c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Meta Universal Helmet (All Sizes)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:39.689Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:40.485Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('bfa273de-d67e-464e-8794-b94cc86fbad4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка, замена втулок, установка зеркал","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":2250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:40.485Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:41.306Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":10000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:41.306Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:42.116Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7b2bab65-5327-42f2-aa46-9a1cd3fcac53', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati 1199 Panigale","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":0,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":"[Лёгкие повреждения] открутилось доыига болтов: подножка, кпп, зеркало","returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:42.117Z","audit":{"grade":"almost","notes":["total_cost = 0 без явной отметки ручной цены"],"checked_at":"2026-10-18T18:04:43.124Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('38d38ec1-f6fb-4b98-a346-969f344da191', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Jilang Max Pro","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":5500,"base":750,"equipment":400,"overprice":50,"total":1200,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:43.125Z","audit":{"grade":"sus","notes":["договор на бумаге 20000 ₽ против книг 5500 ₽ (депозит 15000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:43.927Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('0d16c505-30f1-4f56-a887-2c55944c6bdb', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Подтяжка цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":650,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:43.927Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:44.365Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('0b18a045-b55f-4dc1-91cc-2fc7dca0eac0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Смазка ручки переднего тормоза","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":50,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:44.365Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:44.968Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('3e572c0d-848b-4c1b-9f88-ff06c3d1eab7', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":4000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"куча болтов открутилось: подножка, лапка кпп, зеркало","penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:44.968Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:45.393Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('0aebaf91-2b74-4b68-9cbc-05c567bf7a74', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Leopard Asaka","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":4000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:45.393Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:46.203Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('78759a77-43de-4cd2-8890-a887ca578e8a', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Honda CBR600RR","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":0,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"аккум перегревается и вырубается, нужно ждать пока остынет","penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:46.203Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:46.823Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('76fd1ef8-e2a5-4025-9091-4bac508a24d5', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '413553377', '413553377',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Meta Universal Helmet (All Sizes)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"413553377","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:04:46.823Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:04:47.245Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('231970f8-b90b-4098-a38f-bd33a7fed7d6', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":12000,"base":500,"equipment":400,"overprice":0,"total":900,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:47.245Z","audit":{"grade":"sus","notes":["payment_split (bank 13500 ₽ + cash 0 ₽) не сходится с total_cost 12000 ₽ (депозит 20000 ₽) — цену правили вручную?","договор на бумаге 33500 ₽ против книг 12000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:48.050Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d2f83da7-e0ec-4cc2-adc5-9d5d5485f8d4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:48.050Z","audit":{"grade":"sus","notes":["payment_split (bank 13000 ₽ + cash 0 ₽) не сходится с total_cost 11500 ₽ (депозит 20000 ₽) — цену правили вручную?","договор на бумаге 33000 ₽ против книг 11500 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:49.068Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e3e4e1a3-e6dc-413f-b276-791228c62771', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":13000,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:49.068Z","audit":{"grade":"sus","notes":["payment_split (bank 0 ₽ + cash 16000 ₽) не сходится с total_cost 13000 ₽ (депозит 20000 ₽) — цену правили вручную?","договор на бумаге 36000 ₽ против книг 13000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:04:49.856Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d23a39b5-a5a6-4dd4-b0f6-0f772bdb7aae', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Правка руля с колесом","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":600,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:49.856Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:50.278Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('82bd4189-5683-4183-9ae0-01dff18ee928', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Диагностика проводки","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:50.278Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:51.088Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d674be86-137e-48d4-87ab-be1b47115ff1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Снятие и установка накладки, крепление автомата","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":300,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:51.088Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:51.710Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('cec5daab-aac6-4e1f-b2e8-ab69a1f9f93c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11000,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл+заряд↔","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:51.710Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:52.505Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9fc0d73c-56c3-4a26-9470-1d247a732f39', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":10000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:52.505Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:04:53.517Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('31229193-786d-470b-b4fe-b98be07d71bb', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:53.518Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:54.335Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e4791134-de27-4ca0-a782-9408137599dc', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":12000,"base":1000,"equipment":800,"overprice":0,"total":1800,"equipmentUnits":4,"equipmentFlags":"2шл+1перч+курт+заряд↔","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:54.335Z","audit":{"grade":"sus","notes":["payment_split (bank 10000 ₽ + cash 0 ₽) не сходится с total_cost 12000 ₽ (депозит 20000 ₽) — цену правили вручную?"],"checked_at":"2026-10-18T18:04:55.125Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('38d0af71-f723-4dad-988f-e274823d73ec', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":8000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:55.125Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:56.123Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('df24a470-3774-47ee-9dd7-f3901e5b49dd', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Honda CBR600RR","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:56.123Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:04:56.730Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('c01cb3b3-ee8c-4a2d-a852-ab8003c940b5', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:56.730Z","audit":{"grade":"almost","notes":["депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0"],"checked_at":"2026-10-18T18:04:57.726Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d7e130f4-98f0-4e19-a92b-928738e45c20', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:57.726Z","audit":{"grade":"almost","notes":["депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0"],"checked_at":"2026-10-18T18:04:58.555Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7bb1b3cc-d960-4ce9-84ae-14ab7910eb96', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:04:58.555Z","audit":{"grade":"sus","notes":["депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0","payment_split (bank 3500 ₽ + cash 20000 ₽) не сходится с total_cost 3500 ₽ (депозит —) — цену правили вручную?"],"checked_at":"2026-10-18T18:04:59.347Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('0c484a4d-4058-4d92-9c00-a5a9202ba573', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Снятие лапки КПП, ремонт подножки (установка болта), подкручивание пластика и плуга","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":300,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:04:59.347Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:00.577Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('6ba4cb61-4ce7-474b-b9c1-290ecb2bd7d7', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Ремонт правого зеркала","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":300,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:00.577Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:01.361Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('5029b66c-7032-4029-b5d7-87055485be43', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Правка переднего колеса со снятием боковых накладок","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":700,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:01.361Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:02.175Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7ced14e6-0423-4bd9-9f3d-570cec1e78b1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Green Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7800,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:02.175Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:02.619Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('63d243f1-fc1b-4953-aea0-a39d43408029', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R6","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3500,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:02.619Z","audit":{"grade":"almost","notes":["депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0"],"checked_at":"2026-10-18T18:05:03.614Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('08d80058-8f44-43f9-9088-785e9f956a75', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3750,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:03.614Z","audit":{"grade":"sus","notes":["договор на бумаге 3500 ₽ против книг 3750 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:05:04.423Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a963fda9-485e-4a77-b322-53a2fb96c57b', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":12000,"base":500,"equipment":200,"overprice":0,"total":700,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:04.423Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:05.243Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f61715a0-3208-4a10-a3eb-74c2f7ae7dfa', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Regulmoto Nibbler 300 4V","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":6003,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:05.243Z","audit":{"grade":"almost","notes":["депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0"],"checked_at":"2026-10-18T18:05:06.071Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('654b3855-ee2e-4b38-ab62-437241df1005', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":17000,"base":1000,"equipment":600,"overprice":0,"total":1600,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+бот","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:06.071Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:06.526Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('29724478-0492-4cb0-9a1b-f00b927b7e6a', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена переднего тормоза","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:06.526Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:07.537Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a4d761b4-0d9f-4b96-82e6-638bbfcb1845', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Снятие заднего колеса, замена колодок, снятие суппорта, смазка направляющих, прокачка заднего тормоза","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":900,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:07.537Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:08.337Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('18e8a405-6a85-465a-8878-16d509230421', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена автомата","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:08.337Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:09.137Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7027a3ce-44e4-4bbb-beee-eea6c799e4e3', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":5200,"base":750,"equipment":400,"overprice":0,"total":1150,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"пару соток удержали за бенз:)","penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:09.137Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:09.957Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f7c38961-a93f-4d2d-a06d-bf283a13e239', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Установка аккумулятора и сидения","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:09.957Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:10.588Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d8729c0d-5f02-46aa-ba1a-a9027a8396f7', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка байка","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1250,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:10.588Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:11.592Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b1511be7-4c84-405b-8967-7cb2fe2c716d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:11.592Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:12.414Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d9dea17f-2bf6-4bd0-9a5a-9fbc0b3d855a', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":800,"overprice":0,"total":1800,"equipmentUnits":4,"equipmentFlags":"2шл+2перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:12.414Z","audit":{"grade":"sus","notes":["договор на бумаге 28000 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:05:13.453Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('08f15c1a-dd93-40da-b57d-c5e0f7739ebb', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка боковины и плуга, покраска зеркал и щёчек, покраска плуга (правая сторона) — подарок","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":0,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:13.453Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","total_cost = 0 без явной отметки ручной цены"],"checked_at":"2026-10-18T18:05:14.243Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('84c8344f-c43c-4b66-a1d5-42df8c06444c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Подтяжка цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1250,"base":750,"equipment":0,"overprice":60,"total":810,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:14.243Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:15.256Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('1c9ca971-5ecd-481c-9992-466fe6274a56', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":10000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:15.256Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:16.081Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('aea9e510-f73f-478b-804c-688651daf266', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Green Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":600,"overprice":0,"total":1600,"equipmentUnits":3,"equipmentFlags":"2шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"Сделали скидку за опоздание 1000 ₽","penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:16.081Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:17.080Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('71c61518-9f1c-4374-81c3-b5bc3fb49f6a', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Разборка приборной панели со снятием руля","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:17.080Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:17.517Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('24caedff-58fd-4e3a-a973-806f81826f2b', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Опись мотоциклов","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":0,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:17.517Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after","total_cost = 0 без явной отметки ручной цены"],"checked_at":"2026-10-18T18:05:18.368Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('cfe24c5f-deb3-4156-be53-f217d1f21fd1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"Грязненький забирал в дождь с парка победы. Сдала чистый.","penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:18.368Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:18.979Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b50ca7fb-7b1a-402d-8cc0-917591894d68', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:18.979Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:19.791Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('c3d885f6-d19b-4501-b94b-88e4f55986d8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Правка руля с колесом","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":700,"base":750,"equipment":0,"overprice":10,"total":760,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:19.791Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:20.222Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('afb6e3aa-6a40-44ae-8b09-72af6cc442c0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Установка защиты","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":200,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:20.222Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:20.678Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('8c2e83ad-1354-45d7-bcd0-0c0e8b1fe42a', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati 1199 Panigale","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":13000,"base":1500,"equipment":600,"overprice":67,"total":2167,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:20.678Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:21.105Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('87e80ac0-4afc-410c-b739-b9542e663603', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Сборка байка","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:21.105Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:21.711Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e736951c-8ff3-4c47-97ad-03aa103a2891', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Установка задней звезды, установка переднего и заднего тормозных дисков","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":500,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:21.711Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:22.147Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f627b17f-0005-4552-9d01-f2941d5bb692', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"VIP_BIKE Замена переднего и заднего колеса на мотарде, с натяжкой цепи","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":1000,"base":750,"equipment":0,"overprice":0,"total":750,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:22.147Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:22.769Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a5908ba2-2da3-43ac-ba31-9ca689a73340', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Honda CBR600RR","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":8000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:22.770Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:23.193Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('c99687c7-2f28-4cb6-beda-cdad5cd738ae', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:23.193Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:24.003Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('abd9cf5f-3bff-4aee-9c6e-36b3f2cfb490', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R6","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11500,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:24.003Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:24.621Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('8bad98ff-f14c-4e19-a9c4-436ea647dcf9', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Honda CBR600RR","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":27500,"base":1000,"equipment":400,"overprice":800,"total":2200,"equipmentUnits":2,"equipmentFlags":"1шл+сет","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:24.621Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:25.612Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('4c01d23b-db8e-4544-9771-36c6c218f0b4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":9000,"base":1000,"equipment":200,"overprice":150,"total":1350,"equipmentUnits":1,"equipmentFlags":"курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:25.612Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:26.603Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7641ee62-6bb5-4f61-9b37-c12333d9c119', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":100,"base":1000,"equipment":600,"overprice":0,"total":1600,"equipmentUnits":3,"equipmentFlags":"2шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:26.604Z","audit":{"grade":"sus","notes":["metadata: bike_price+equipment (1250 ₽) ≠ total_cost (100 ₽)"],"checked_at":"2026-10-18T18:05:27.434Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('693eacd0-10f6-404f-8f8d-6891720867b0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":100,"base":1000,"equipment":800,"overprice":0,"total":1800,"equipmentUnits":4,"equipmentFlags":"1шл+1перч+курт+шт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:27.434Z","audit":{"grade":"sus","notes":["metadata: bike_price+equipment (1250 ₽) ≠ total_cost (100 ₽)"],"checked_at":"2026-10-18T18:05:27.856Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('1ab2d8d4-2363-47f2-afd3-bd7b9ffd5430', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati 1199 Panigale","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":25000,"base":1500,"equipment":600,"overprice":300,"total":2400,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:27.856Z","audit":{"grade":"sus","notes":["договор на бумаге 23500 ₽ против книг 25000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:05:28.287Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('ade49e6c-62ae-42bf-b39f-a33f81617ed7', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":12500,"base":500,"equipment":600,"overprice":0,"total":1100,"equipmentUnits":3,"equipmentFlags":"2шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:28.287Z","audit":{"grade":"sus","notes":["payment_split (bank 0 ₽ + cash 14000 ₽) не сходится с total_cost 12500 ₽ (депозит 20000 ₽) — цену правили вручную?","договор на бумаге 34000 ₽ против книг 12500 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:05:29.286Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('2c70f6d3-3906-4064-976b-47188d0d541d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11500,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:29.286Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:29.709Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('4ff7ce21-16fe-40de-af54-be0bd97b16c8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Leopard Asaka","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":9500,"base":750,"equipment":400,"overprice":0,"total":1150,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"5219192922","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:29.710Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:30.345Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('142d6e4a-276f-43d7-ad8b-ec45d3af235c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon GT","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3750,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:30.345Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:30.920Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('734e63c5-9a8b-439a-91c3-3272292b684c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:30.920Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:31.345Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('910a54c9-f3d0-4b6a-b171-c4a5da730ef5', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:31.345Z","audit":{"grade":"sus","notes":["договор на бумаге 15000 ₽ против книг 10000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:05:32.346Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('674cbee1-d968-4b4c-925f-2c6df97aeab3', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":12000,"base":500,"equipment":600,"overprice":0,"total":1100,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:32.346Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:33.153Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e8ef6a84-4e58-4830-bdf2-244de18e0562', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":69,"base":750,"equipment":400,"overprice":0,"total":1150,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:33.153Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:33.590Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a78ebd3c-d95a-4b0c-a8a5-a648597c7438', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":16000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":false,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:33.590Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:34.200Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('041aa9ce-b008-4987-9e33-095a54a0d2e4', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon Lynx Purple","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":2500,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:34.201Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:34.635Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9636e2e9-e58e-4f3b-bc6b-b611b01bc054', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":69,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:34.635Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:35.245Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('73b36329-10ec-4160-a2c0-34842110aca1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Leopard Asaka","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":3250,"base":750,"equipment":200,"overprice":0,"total":950,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:35.245Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:35.872Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('2df61ae5-e405-4a36-bbd9-99546ca89cf6', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":13000,"base":1000,"equipment":800,"overprice":0,"total":1800,"equipmentUnits":4,"equipmentFlags":"2шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:35.872Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:36.293Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('38043660-cf0c-4089-a170-10a110651ebd', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":14000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:36.293Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:36.905Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d7e91c86-753a-4c20-a4ad-ecf53992a96e', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":21000,"base":1000,"equipment":400,"overprice":100,"total":1500,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:36.905Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:37.528Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('3908a052-8004-48bd-96a5-3556565db004', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati 1199 Panigale","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":20000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:37.528Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:38.131Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('45a22663-4bea-44bc-b226-877da3f558a0', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":5000,"base":1000,"equipment":0,"overprice":25,"total":1025,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:38.131Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:38.565Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f773d365-2e4b-4c19-9833-a36d69d624ac', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:38.565Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:39.377Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('801a2e9d-0975-4793-ac6a-b0c5f53ebd0e', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:39.377Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:39.819Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('3b1e7657-32be-408b-800a-624655ca7a55', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":8000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:39.820Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:40.609Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('8d06a3ca-7527-48b2-b384-2d30bc32659e', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":8000,"base":500,"equipment":400,"overprice":0,"total":900,"equipmentUnits":2,"equipmentFlags":"1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:40.609Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:41.039Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('1f29df90-f96c-48b3-9f0b-b1337f26d3cf', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":8000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:41.039Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:41.864Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d49446f2-fe1f-4fb3-a78a-17778d521762', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":4000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:41.864Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:42.473Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('af589d59-b5c5-4987-8452-20f6718ce628', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Leopard Asaka","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":3250,"base":750,"equipment":200,"overprice":0,"total":950,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:42.473Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:43.277Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9f9de3d8-00b3-4640-80f0-1c99e841a07e', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Sequence Zero","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":9000,"base":1500,"equipment":600,"overprice":0,"total":2100,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:43.277Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:44.290Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('0d2cad9d-3ca7-4d5c-846c-b6ca3bf08009', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3300,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл+заряд↔","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:44.290Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:44.729Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('49ffbe7a-c6b8-4ba0-87a6-173ba278672d', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":4750,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:44.729Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:45.755Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b31c7281-eaff-48fb-82a0-661927abc1f1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Aero","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":4750,"base":500,"equipment":400,"overprice":0,"total":900,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:45.756Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:46.363Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('50f4c815-aa90-4cc7-a74c-fd2fc3d857b5', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6400,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:46.363Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:05:47.150Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('c23afd5c-e3b9-490a-971f-9f23062a3f33', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":11000,"base":500,"equipment":200,"overprice":0,"total":700,"equipmentUnits":1,"equipmentFlags":"курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:47.150Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:47.573Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a5f4aa2d-4545-487e-a150-d826eb6ede74', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R6","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:47.573Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:48.414Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('a2658887-ad89-45f2-a4a2-9a74a7d50bab', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BENDA LFC700","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":53000,"base":1500,"equipment":600,"overprice":300,"total":2400,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:05:48.414Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:05:49.020Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('05f28d51-a5ec-43c5-b7b5-d0f6f74b24e5', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon GT","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:49.020Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:49.829Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('2eaf59f8-8dcd-4223-8a48-a5533afab7fc', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Rerode R1+","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:49.829Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:50.255Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('243aece4-9dff-4ff5-9b1a-270981cf56fe', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:50.255Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:51.083Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('ff6dbfee-4964-4794-a337-3d9eafc6bb0f', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"7813830016","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:51.084Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:52.070Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('b1f3f659-7235-45cc-a909-c7911969f3db', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":600,"overprice":0,"total":1600,"equipmentUnits":3,"equipmentFlags":"2шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:52.070Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:52.557Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f727711c-c4b0-4dca-ae8a-9a960e40d88c', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BENDA LFC700","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":84000,"base":1500,"equipment":600,"overprice":0,"total":2100,"equipmentUnits":3,"equipmentFlags":"1шл+1перч+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:52.557Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:52.985Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('55bf172b-ae6c-4c85-90d3-8915522ec919', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Black Z","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":8000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+курт","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:52.985Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:53.591Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('743d2cd9-d9ad-43fd-af0c-fcc067306446', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Regulmoto Nibbler 300 4V","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":8500,"base":750,"equipment":0,"overprice":50,"total":800,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:53.591Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:54.408Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('ed44441f-c8c0-492e-a3a7-1c4e1c5a67bf', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":8500,"base":750,"equipment":800,"overprice":0,"total":1550,"equipmentUnits":4,"equipmentFlags":"2шл+2перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:54.408Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:54.830Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e653cc52-f31e-4207-a791-27c37003ae72', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":6300,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:54.831Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:55.249Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('7b1f597d-2ef1-4f3a-bcf3-16ef2b23666b', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R6","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6000,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:55.249Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:56.043Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('35cf59c8-d805-488c-a055-8824c74c3cc8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Ducati Panigale S Electro Gold","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":13500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"2шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:05:56.043Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:56.861Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('477248e4-2d6a-4cc9-bad1-7b63cdcfef20', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '120749229', '413553377',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":0,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"120749229","handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:56.861Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:57.487Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('32251b81-6177-45f7-930e-f137a9cebe00', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:57.487Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:58.271Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('e4a07644-eb73-41cb-b6b1-786fb2342f07', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', null, '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":null,"handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:05:58.271Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:59.087Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('2bfceacc-cc28-4628-b432-2ff37bf89c98', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":10000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":"413553377","returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:59.087Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:05:59.879Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('645e5f9d-74dd-4dfc-a920-c3279cb00fe8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R6","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":12500,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:05:59.879Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:00.703Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('d0a4748a-0908-4e8c-aee7-dd8878921e84', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Honda CBR600RR","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":5750,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":"Мотоцикл возвращён раньше срока: клиент в тот же вечер пересел на Yamaha R7 (аренда add63811). Цена пересчитана владельцем: 5 000 ₽ мото (полдня от ставки 10 000) + 750 ₽ экипировка (шлем 500 + перчатки 250, полдня). Итого 5 750 ₽ вместо 11 500 ₽.","penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:00.703Z","audit":{"grade":"almost","notes":["completed без odometer_after"],"checked_at":"2026-10-18T18:06:01.528Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('add63811-8067-4c13-9e5a-292308c089c9', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":7750,"base":500,"equipment":400,"overprice":0,"total":900,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:01.528Z","audit":{"grade":"sus","notes":["payment_split (bank 8500 ₽ + cash 0 ₽) не сходится с total_cost 7750 ₽ (депозит 20000 ₽) — цену правили вручную?","договор на бумаге 8500 ₽ против книг 7750 ₽ (депозит 20000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:06:02.340Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('de2de03c-e071-4796-89bd-e0effcc614f8', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Sequence Zero","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":21000,"base":1500,"equipment":200,"overprice":0,"total":1700,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:06:02.340Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:02.758Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('f335428d-ada2-4564-9fba-c52e07397536', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":8500,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":"413553377","returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:06:02.758Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:03.184Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9d7582e5-dfa6-469d-bfad-5c47d3f51129', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":3500,"base":750,"equipment":200,"overprice":0,"total":950,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:03.184Z","audit":{"grade":"sus","notes":["metadata: bike_price+equipment (4450 ₽) ≠ total_cost (3500 ₽)","договор на бумаге 14450 ₽ против книг 3500 ₽ (депозит 10000 ₽) — расхождение бумага/учёт"],"checked_at":"2026-10-18T18:06:03.607Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('50c71a29-93e6-4bae-8743-1f45b10efae9', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11000,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1шл+заряд↔","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:03.607Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:04.427Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('15db0028-ece6-4e62-9c50-a891bcd32fe7', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":7500,"base":1000,"equipment":400,"overprice":0,"total":1400,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:04.427Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:05.027Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('41ab8468-1110-4b02-a452-8accd159a1fc', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Aprilia Shiver 750","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":11000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:05.027Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:05.839Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('33ec1f38-65de-4b1e-9bec-a587e44cd451', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Yamaha R7","rentalCategory":"partner_regular","rentalCategoryLabel":"Партнерские обычные","totalCost":12000,"base":500,"equipment":0,"overprice":0,"total":500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":"413553377","returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:05.839Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:06.651Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('685a9152-a0f4-4026-985a-793c816e4e55', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Kawasaki EX650K (Ninja 650)","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":18750,"base":1000,"equipment":200,"overprice":25,"total":1225,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":"413553377","returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:06:06.651Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:07.453Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('03e18650-74a8-439a-b2ba-efddbea0af96', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Motoland Breakout 300","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":7500,"base":750,"equipment":400,"overprice":0,"total":1150,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":"[Лёгкие повреждения] ","returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"5219192922"},"requestedAtIso":"2026-10-18T18:06:07.453Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:08.454Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('24277629-cf4f-4953-9e21-ac24234d56e1', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"— VIP_BIKE Уборка шланга (за метр)","rentalCategory":"budget","rentalCategoryLabel":"Бюджетные","totalCost":10.35,"base":750,"equipment":0,"overprice":1,"total":751,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:06:08.454Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:06:09.263Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('28702ae4-21a2-45bb-9dd2-e770223ff933', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":13800,"base":1000,"equipment":400,"overprice":230,"total":1630,"equipmentUnits":2,"equipmentFlags":"1шл+1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":"жалоба на стук в передней подвеске (подтянуть подшипник?) и на ручку газа, типа как будто сама закрывает газ, возможно что-то с тросиком","penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"413553377"},"requestedAtIso":"2026-10-18T18:06:09.263Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:10.087Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('bd948bd0-e9db-44ef-8955-97933cee066f', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"BMW F800R","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":6500,"base":1000,"equipment":200,"overprice":0,"total":1200,"equipmentUnits":1,"equipmentFlags":"1перч","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"356282674"},"requestedAtIso":"2026-10-18T18:06:10.087Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:10.886Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('9991969f-2650-4f8c-8332-eb98212b4314', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '413553377',
   'backfill_audit', 'pending',
   $snap${"bikeName":"Suzuki M109R 1800 Boulevard","rentalCategory":"premium","rentalCategoryLabel":"Премиум","totalCost":3000,"base":1500,"equipment":0,"overprice":0,"total":1500,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":null,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":null},"requestedAtIso":"2026-10-18T18:06:10.886Z","audit":{"grade":"almost","notes":["completed без return_confirmed_by/at (закрыт вне страницы возврата?)","completed без odometer_after"],"checked_at":"2026-10-18T18:06:11.703Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

insert into public.rental_verifications
  (rental_id, crew_id, crew_slug, operator_chat_id, owner_chat_id, requested_by, status, snapshot, source)
values
  ('221cbd97-bdff-467a-8890-8c681a2ac640', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746', 'vip-bike', '7813830016', '356282674',
   'backfill_audit', 'pending',
   $snap${"bikeName":"79BIKE Falcon GT","rentalCategory":"regular","rentalCategoryLabel":"Обычные","totalCost":3000,"base":1000,"equipment":0,"overprice":0,"total":1000,"equipmentUnits":0,"equipmentFlags":"","overpricePercent":10,"depositReturned":true,"damageNotes":null,"returnNotes":null,"penalty":null,"attribution":{"source":"request","createdByChatId":"7813830016","handedByChatId":null,"returnedByChatId":"7813830016"},"requestedAtIso":"2026-10-18T18:06:11.703Z","audit":{"grade":"fine","notes":[],"checked_at":"2026-10-18T18:06:12.705Z","checker":"vf-audit-2026-10-18"}}$snap$,
   'backfill_audit')
on conflict (rental_id) do nothing;

-- ── POST-CHECK ───────────────────────────────────────────────────────────────
-- expect: total=168, zero of each grade=null
select source, snapshot->'audit'->>'grade' as grade, count(*)
from public.rental_verifications
where source = 'backfill_audit'
group by 1, 2
order by 2;

-- grades the boss will bulk-confirm (expect the fine count from the report)
select count(*) as fine_pending
from public.rental_verifications
where source = 'backfill_audit'
  and status = 'pending'
  and snapshot->'audit'->>'grade' = 'fine';
