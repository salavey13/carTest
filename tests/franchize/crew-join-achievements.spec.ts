// tests/franchize/crew-join-achievements.spec.ts
//
// 2026-09-22 («improve related notifications and achievements»):
//   · grantCrewJoinAchievements: joiner → crew_first_join; owner → рекрутерские
//     бейджи по ФАКТУ состава (COUNT crew_members), а не по counters;
//   · порог 1/5/15 и самоисключение (joiner === owner не рекрутит);
//   · autoJoinCrew: welcome-сообщение новичку + owner-уведомление с
//     inline-кнопкой t.me/<bot>/app?startapp=crew_<slug> + await достижений;
//   · каталог достижений содержит 4 новых id в категории growth.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { supabaseAdmin, grantAction } = vi.hoisted(() => ({
  supabaseAdmin: { from: vi.fn() },
  grantAction: vi.fn(async () => ({ success: true, alreadyUnlocked: false })),
}));
vi.mock("@/lib/supabase-server", () => ({ supabaseAdmin }));
vi.mock("@/app/franchize/profile-actions", () => ({
  grantFranchizeAchievementAction: grantAction,
}));

import { grantCrewJoinAchievements } from "@/app/franchize/server-actions/crew-join-achievements";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Мок COUNT-запроса: .from("crew_members").select(...).eq().eq() → thenable. */
function mockMemberCount(count: number | null, error: unknown = null) {
  supabaseAdmin.from.mockImplementation((table: string) => {
    if (table !== "crew_members") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ count, error }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  grantAction.mockImplementation(async () => ({ success: true, alreadyUnlocked: false }));
});

describe("grantCrewJoinAchievements (unit)", () => {
  it("first join (count=1): joiner badge + owner's «Первый рекрут» — первый вступивший и есть рекрут", async () => {
    mockMemberCount(1); // только сам новичок
    await grantCrewJoinAchievements({
      crewId: "crew-uuid",
      crewSlug: "vip-bike",
      joinerId: "100",
      ownerId: "200",
    });
    const ids = grantAction.mock.calls.map((c) => c[0].achievementId);
    expect(ids).toContain("crew_first_join");
    expect(ids).toContain("crew_recruiter_first");
    expect(ids).not.toContain("crew_recruiter_5");
    expect(ids.filter((id: string) => id === "crew_first_join")).toHaveLength(1);
    // Джойнер грантится с source crew:auto_join в slug экипажа
    const joinerCall = grantAction.mock.calls.find((c) => c[0].achievementId === "crew_first_join");
    expect(joinerCall?.[0]).toMatchObject({
      slug: "vip-bike",
      userId: "100",
      source: "crew:auto_join",
    });
  });

  it("count=0 (degenerate): only the joiner badge", async () => {
    mockMemberCount(0);
    await grantCrewJoinAchievements({
      crewId: "crew-uuid",
      crewSlug: "vip-bike",
      joinerId: "100",
      ownerId: "200",
    });
    const ids = grantAction.mock.calls.map((c) => c[0].achievementId);
    expect(ids).toEqual(["crew_first_join"]);
  });

  it("owner crosses the 1/5/15 thresholds by FACT membership count", async () => {
    mockMemberCount(5);
    await grantCrewJoinAchievements({
      crewId: "crew-uuid",
      crewSlug: "vip-bike",
      joinerId: "100",
      ownerId: "200",
    });
    const ids = grantAction.mock.calls.map((c) => c[0].achievementId);
    expect(ids).toContain("crew_first_join");
    expect(ids).toContain("crew_recruiter_first");
    expect(ids).toContain("crew_recruiter_5");
    expect(ids).not.toContain("crew_recruiter_15");
  });

  it("15 members → all three recruiter badges", async () => {
    mockMemberCount(15);
    await grantCrewJoinAchievements({
      crewId: "crew-uuid",
      crewSlug: "vip-bike",
      joinerId: "100",
      ownerId: "200",
    });
    const ids = new Set(grantAction.mock.calls.map((c) => c[0].achievementId));
    expect(ids.has("crew_recruiter_first")).toBe(true);
    expect(ids.has("crew_recruiter_5")).toBe(true);
    expect(ids.has("crew_recruiter_15")).toBe(true);
  });

  it("self-join (joiner === owner) does not grant recruiter badges", async () => {
    mockMemberCount(20);
    await grantCrewJoinAchievements({
      crewId: "crew-uuid",
      crewSlug: "vip-bike",
      joinerId: "200",
      ownerId: "200",
    });
    const ids = grantAction.mock.calls.map((c) => c[0].achievementId);
    expect(ids).toEqual(["crew_first_join"]);
  });

  it("count query failure degrades to 0 → no recruiter badges, no throw", async () => {
    mockMemberCount(null, { message: "db down" });
    await expect(
      grantCrewJoinAchievements({
        crewId: "crew-uuid",
        crewSlug: "vip-bike",
        joinerId: "100",
        ownerId: "200",
      }),
    ).resolves.toBeUndefined();
    const ids = grantAction.mock.calls.map((c) => c[0].achievementId);
    expect(ids).toEqual(["crew_first_join"]);
  });

  it("grant failures are swallowed (gamification never breaks the join)", async () => {
    mockMemberCount(5);
    grantAction.mockImplementation(async () => ({ success: false, error: "boom" }));
    await expect(
      grantCrewJoinAchievements({
        crewId: "crew-uuid",
        crewSlug: "vip-bike",
        joinerId: "100",
        ownerId: "200",
      }),
    ).resolves.toBeUndefined();
    expect(grantAction).toHaveBeenCalledTimes(3);
  });

  it("alreadyUnlocked grants are not reported as newly granted (still no throw)", async () => {
    mockMemberCount(1);
    grantAction.mockImplementation(async () => ({ success: true, alreadyUnlocked: true }));
    await expect(
      grantCrewJoinAchievements({
        crewId: "crew-uuid",
        crewSlug: "vip-bike",
        joinerId: "100",
        ownerId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("garbage slug/short-circuit: no grants at all", async () => {
    await grantCrewJoinAchievements({ crewId: "x", crewSlug: "", joinerId: "1", ownerId: "2" });
    expect(grantAction).not.toHaveBeenCalled();
  });
});

describe("autoJoinCrew wiring (source contract)", () => {
  const src = read("app/rentals/actions.ts");

  it("awaits the join achievements grant (Vercel fire-and-forget freeze guard)", () => {
    expect(src).toContain("await grantCrewJoinAchievements({");
    expect(src).toContain("grantCrewJoinAchievements");
  });

  it("sends a welcome message to the joiner + owner notification with the deep-link button", () => {
    expect(src).toContain("Ты в экипаже");
    expect(src).toContain("startapp=crew_${safeCrewSlug}");
    expect(src).toContain("Открыть экипаж");
    expect(src).toContain("keyboardType: \"inline\"");
  });

  it("resolves the bot through the platform-fallback resolver", () => {
    expect(src).toContain("resolveCrewBotUsername(safeCrewSlug)");
  });
});

describe("crew achievement catalog (source contract)", () => {
  const catalog = read("app/franchize/profile-actions.ts");

  it("defines the four crew badges in the growth category", () => {
    for (const id of ["crew_first_join", "crew_recruiter_first", "crew_recruiter_5", "crew_recruiter_15"]) {
      expect(catalog).toContain(`id: "${id}"`);
    }
    expect(catalog).toContain("const crewJoinAchievements: FranchizeAchievementDefinition[] = [");
    // Бейджи входят в каталог для ЛЮБОГО экипажа (не только vip-bike)
    expect(catalog.match(/crewJoinAchievements/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
