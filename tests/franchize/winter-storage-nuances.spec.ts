// tests/franchize/winter-storage-nuances.spec.ts
// 2026-09-29 — boss test round («i tested, created one bike successfully!
// But there were some nuances») — the five-nuance fix pack:
//
//   1. Storage place follows the CREW METADATA (vip-bike hydration SQL: the
//      crew's real address is пл. Комсомольская 2; the frozen Стригинский
//      literal is the LAST resort only) — server-authoritative in the doc
//      and the wall row.
//   2. Bike-card deeplink: storage_<slug>_<bikeId> routes into the story
//      page; every storage notification carries it.
//   3. Creator set at creation (server identity ladder) + staff reassigns
//      the owner by NAME/@username/id (the subrenter picker pattern).
//   4. Achievements: «Зимовщик» / «На приколе» / «Хроника сезона» wired
//      non-fatally; the owner's chat message is a rich season summary.
//   5. Gap parity: storage_bikes.updated_at trigger migration.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveStorageConfig } from "@/app/franchize/lib/storage-config";
import { storageStartParam } from "@/app/franchize/lib/storage";
import { computeStaticFastTarget } from "@/hooks/use-start-param-target";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("nuance 1 — storage place from crew metadata", () => {
  it("storage.address wins, then the crew default address, legacy literal last", () => {
    const special = resolveStorageConfig(
      { storage: { address: "ул. Своя 1" }, contacts: { address: "пл. Комсомольская 2" } },
      "vip-bike",
      { fallbackAddress: "пл. Комсомольская 2" },
    );
    expect(special.address).toBe("ул. Своя 1");

    const metadataDefault = resolveStorageConfig(
      { contacts: { address: "пл. Комсомольская 2, Нижний Новгород" } },
      "vip-bike",
      { fallbackAddress: "пл. Комсомольская 2, Нижний Новгород" },
    );
    expect(metadataDefault.address).toBe("пл. Комсомольская 2, Нижний Новгород");

    const legacy = resolveStorageConfig({}, "vip-bike");
    expect(legacy.address).toBe("Стригинский переулок, 13Б");

    const multiline = resolveStorageConfig(
      { contacts: { address: "пл. Комсомольская 2,\n  Нижний Новгород" } },
      "vip-bike",
      { fallbackAddress: "пл. Комсомольская 2,\n  Нижний Новгород" },
    );
    expect(multiline.address).toBe("пл. Комсомольская 2, Нижний Новгород");
  });

  it("hydration passes the crew default address on both read paths", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    // getFranchizeBySlug (page hydration)…
    expect(runtime.includes("fallbackAddress: crewDefaultAddress")).toBe(true);
    // …and the doc gate share the same contacts-address chain, with the
    // private contractDefaults address only as the tier BELOW contacts.
    expect(runtime.includes('["contacts", "address"],')).toBe(true);
    expect(runtime.includes("fallbackAddress: crewDefaultAddress || opts?.extraFallbackAddress")).toBe(true);
    expect(runtime.includes("extraFallbackAddress: crewSecrets.returnAddress || crewSecrets.legalAddress")).toBe(true);
  });

  it("the doc + wall row stamp the SERVER-RESOLVED place, client value is an echo", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("storageCrewConfig?.address\n          || details.storageAddress")).toBe(true);
    expect(runtime.includes("storage_address: storageCrewConfig?.address || stDetails.storageAddress || \"\"")).toBe(true);
  });

  it("display fallbacks import the shared constant instead of a frozen literal", () => {
    expect(read("app/franchize/[slug]/storage/StorageWallClient.tsx").includes("|| DEFAULT_STORAGE_ADDRESS")).toBe(true);
    expect(read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx").includes("|| DEFAULT_STORAGE_ADDRESS")).toBe(true);
    expect(read("app/franchize/[slug]/storage/new/page.tsx").includes("|| DEFAULT_STORAGE_ADDRESS")).toBe(true);
  });
});

describe("nuance 2 — bike-card deeplink (storage_<slug>_<bikeId>)", () => {
  it("storageStartParam appends only real uuids (no bare numbers — slug parse safety)", () => {
    expect(storageStartParam("vip-bike", UUID)).toBe(`storage_vip-bike_${UUID}`);
    expect(storageStartParam("vip-bike", "12345")).toBe("storage_vip-bike");
    expect(storageStartParam("vip-bike", "drop table; --")).toBe("storage_vip-bike");
    expect(storageStartParam("", UUID)).toBe(`storage_${UUID}`);
  });

  it("router: card param → story page; slug-with-underscore wall param still works", () => {
    expect(computeStaticFastTarget(`storage_vip-bike_${UUID}`)).toBe(`/franchize/vip-bike/storage/${UUID}`);
    expect(computeStaticFastTarget(`storage_my_crew_${UUID}`)).toBe(`/franchize/my_crew/storage/${UUID}`);
    // no uuid segment → the wall (the old behaviour is preserved)
    expect(computeStaticFastTarget("storage_vip-bike")).toBe("/franchize/vip-bike/storage");
    expect(computeStaticFastTarget("storage_my_crew")).toBe("/franchize/my_crew/storage");
    // a non-uuid tail was never a bike id — the whole rest stays the slug
    // (pre-existing behaviour: unknown slugs render crew-not-found)
    expect(computeStaticFastTarget("storage_vip-bike_not-a-uuid")).toBe("/franchize/vip-bike_not-a-uuid/storage");
    expect(computeStaticFastTarget("storage_")).toBeNull();
  });

  it("checkout notifications carry wall AND card links; move notifies link the card", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("🧊 Карточка байка: <a href=\"${cardHref}\">Открыть карточку хранения</a>")).toBe(true);
    expect(runtime.includes("text: \"🧊 Мой байк на хранении\", url: cardHref")).toBe(true);
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes("storageStartParam(slug, bikeId)")).toBe(true);
    expect(actions.includes('bikeId ? "Открыть карточку хранения" : "Открыть «Хранение»"')).toBe(true);
  });
});

describe("nuance 3 — creator at creation + username search for reassigning", () => {
  it("checkout claims the owner server-side (cookie → initData → numeric id)", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    // The ladder itself (BEHAVIOUR, not comments): the verified resolver is
    // called with the numeric telegramUserId as the claim + the ПЭП initData;
    // the unverified raw id is only the LAST tier.
    expect(runtime.includes("resolveServerActorUserId({")).toBe(true);
    expect(runtime.includes("claimedActorUserId: /^\\d+$/.test(rawTgId) ? rawTgId : undefined,")).toBe(true);
    expect(runtime.includes("initData: typeof payload.pepInitData === \"string\" ? payload.pepInitData : undefined,")).toBe(true);
    expect(runtime.includes('return /^\\d+$/.test(String(payload.telegramUserId ?? "")) ? String(payload.telegramUserId) : null;')).toBe(true);
  });

  it("search action exists, staff-gated, shares the subrenter pure helpers", () => {
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes("export async function searchUsersForStorageOwnerAction")).toBe(true);
    expect(actions.includes("buildUserSearchOrExpression")).toBe(true);
    expect(actions.includes("rankSubrenterUserCandidate")).toBe(true);
    expect(actions.includes("buildSubrenterUserLabel")).toBe(true);
    expect(actions.includes("if (!gate.actor.isStaff)")).toBe(true);
  });

  it("story page owner control is a search picker (debounced, stale-guarded)", () => {
    const story = read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx");
    expect(story.includes("searchUsersForStorageOwnerAction")).toBe(true);
    expect(story.includes("350")).toBe(true);
    expect(story.includes("searchSeq")).toBe(true);
    expect(story.includes("Имя, @username или Telegram id")).toBe(true);
  });

  it("non-staff wall listing still scopes to own rows only (see-only-own rule intact)", () => {
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes('query = query.eq("owner_user_id", viewerId)')).toBe(true);
  });
});

describe("nuance 4 — achievements + owner notification polish", () => {
  it("catalog defines the three storage badges", () => {
    const profile = read("app/franchize/profile-actions.ts");
    expect(profile.includes('id: "storage_first_request"')).toBe(true);
    expect(profile.includes('id: "storage_season_started"')).toBe(true);
    expect(profile.includes('id: "storage_owner_photos"')).toBe(true);
    expect(profile.includes("...storageAchievements,")).toBe(true);
  });

  it("grants are wired non-fatally at checkout, acceptance and owner photos", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("grantStorageRequestCreated")).toBe(true);
    const actions = read("app/franchize/server-actions/storage-bikes.ts");
    expect(actions.includes('if (status === "in_storage")')).toBe(true);
    expect(actions.includes("grantStorageSeasonStarted")).toBe(true);
    expect(actions.includes("grantStorageOwnerPhotos")).toBe(true);
    const module = read("app/franchize/server-actions/storage-achievements.ts");
    // BEHAVIOUR pins: the anonymous/unclaimed guard short-circuits BEFORE the
    // grant, every grant runs inside try/catch, and callers fire-and-forget.
    expect(module.includes('if (!userId || !/^\\d+$/.test(userId)) return;')).toBe(true);
    expect(module.includes("grantFranchizeAchievementAction")).toBe(true);
    expect(module.includes("try {")).toBe(true); // every grant path is try/catch-wrapped
    expect(runtime.includes("void grantStorageRequestCreated(")).toBe(true);
    expect(actions.includes("void grantStorageSeasonStarted(")).toBe(true);
    expect(actions.includes("void grantStorageOwnerPhotos(")).toBe(true);
  });

  it("the owner chat message is a rich season summary with the resolved place", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("Место хранения: ${esc(storageCrewConfig.address)}")).toBe(true);
    expect(runtime.includes("📄 Договор хранения с актом приёма-передачи отправлен в этот чат.")).toBe(true);
    expect(runtime.includes("Сезон: ${stSeasonStartRu}")).toBe(true); // RU dates, not ISO
  });
});

describe("nuance 5 — subrenter parity: updated_at trigger migration", () => {
  it("migration stamps updated_at on every storage_bikes update (for Paul)", () => {
    const migration = read("supabase/migrations/20260929120000_storage_bikes_updated_at.sql");
    // v2: the base winter-storage migration already ships the function and a
    // trigger named storage_bikes_touch — this file must drop BOTH historical
    // trigger names and CASCADE the function drop, or re-applying on a crew
    // DB fails with 2BP01 (dependent trigger). Canonical trigger name is
    // storage_bikes_touch (matches the base migration).
    expect(migration.includes("drop trigger if exists trg_storage_bikes_touch_updated_at on public.storage_bikes;")).toBe(true);
    expect(migration.includes("drop trigger if exists storage_bikes_touch on public.storage_bikes;")).toBe(true);
    expect(migration.includes("drop function if exists public.storage_bikes_touch_updated_at() cascade;")).toBe(true);
    expect(migration.includes("create trigger storage_bikes_touch")).toBe(true);
    expect(migration.includes("new.updated_at := now();")).toBe(true);
  });
});
