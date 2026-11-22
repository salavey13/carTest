-- /docs/crewDocs/moto-selection-owner-romani14-2026-10-18.sql
-- Task (boss 2026-10-18) — moto-selection gets its REAL owner.
--
-- The crew shipped as a prefab provider (network-services-hydration-2026-10-14.sql)
-- with I_O_S_NN as the placeholder owner «until a final owner is assigned via
-- the network-tab role manager». That final owner is now assigned: @romani14
-- (Роман Лосев, TG id 5659185161). This file mirrors the exact semantics of
-- assignNetworkCrewRoleAction (app/franchize/server-actions/network-role-manager.ts):
--   1) crews.owner_id — the effective ownership source;
--   2) crew_members row for the new owner (role='owner', active) — created on
--      the fly, no invite round-trip needed;
--   3) the previous owner keeps seniority as co_owner (critical for prefab
--      crews where that previous owner is I_O_S_NN himself);
--   4) metadata: franchize.version bump + specs audit marker.
--
-- Logo note (boss 2026-10-18): the crew logo is the tildacdn asset linked from
-- the landing partners section (app/page.tsx #partners → moto-selection.ru) —
-- identical URL already lives in crews.logo_url and
-- metadata.franchize.branding.logoUrl; re-asserted below so the «Сеть» tab on
-- map-riders (CrewDiscoveryGraph node + selected-crew panel) and the franchize
-- header keep rendering the round logo, not initials.
--
-- Idempotent (ON CONFLICT / jsonb_set / NOT EXISTS), safe to re-run.
-- Applied live via service-role REST on 2026-10-18
-- (audit: crews.metadata.specs.owner_transfer_20261018).

begin;

-- ── 1) ownership transfer ───────────────────────────────────────────────────
update public.crews c
set owner_id = '5659185161', -- @romani14 (Роман Лосев) — real owner per boss 2026-10-18
    updated_at = now()
where c.slug = 'moto-selection';

-- ── 2) membership row for the new owner (create when missing) ───────────────
insert into public.crew_members (crew_id, user_id, role, membership_status)
values ('ddc2eae6-f11f-420b-859b-a1cb755d777f', '5659185161', 'owner', 'active')
on conflict (crew_id, user_id) do update
set role = 'owner',
    membership_status = 'active';

-- ── 3) previous owner keeps seniority as co_owner (I_O_S_NN) ────────────────
insert into public.crew_members (crew_id, user_id, role, membership_status)
values ('ddc2eae6-f11f-420b-859b-a1cb755d777f', '356282674', 'co_owner', 'active')
on conflict (crew_id, user_id) do update
set role = 'co_owner',
    membership_status = 'active';

-- ── 4) metadata: version bump + audit + logo re-assert ──────────────────────
update public.crews c
set metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      coalesce(c.metadata, '{}'::jsonb),
      '{franchize,version}',
      '"2026-10-18-v2"'::jsonb
    ),
    '{specs,owner_transfer_20261018}',
    jsonb_build_object(
      'from', '356282674',
      'to', '5659185161',
      'to_username', 'romani14',
      'to_name', 'Роман Лосев',
      'note', 'boss 2026-10-18: @romani14 — owner of moto-selection; I_O_S_NN keeps co_owner seniority (network-role-manager semantics)'
    )
  ),
  '{franchize,branding,logoUrl}',
  '"https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png"'::jsonb
),
logo_url = 'https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png',
updated_at = now()
where c.slug = 'moto-selection';

commit;
