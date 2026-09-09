// tests/franchize/update-crew-member-role.spec.ts
// Crew role management: pure hierarchy matrix + server action flows.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    sendTelegramMessage: vi.fn(async () => {}),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mocks.single,
          eq: () => ({
            maybeSingle: mocks.maybeSingle,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        mocks.update(patch);
        return {
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
    }),
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

import {
  updateCrewMemberRole,
} from "@/app/franchize/server-actions/update-crew-member-role";
import {
  roleRank,
  roleLabel,
  effectiveActorRole,
  canManageRole,
  assignableRolesFor,
} from "@/app/franchize/lib/crew-roles";

// ─────────────────────────── pure matrix ───────────────────────────

describe("crew-roles pure matrix", () => {
  it("ranks roles in strict hierarchy order", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("co_owner"));
    expect(roleRank("co_owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("mechanic"));
    expect(roleRank("mechanic")).toBeGreaterThan(roleRank("member"));
  });

  it("labels roles in Russian with fallback for unknown", () => {
    expect(roleLabel("owner")).toBe("Владелец");
    expect(roleLabel("admin")).toBe("Администратор");
    expect(roleLabel("mechanic")).toBe("Механик");
    expect(roleLabel("custom-role")).toBe("custom-role");
  });

  it("crews.owner_id wins over membership role", () => {
    expect(
      effectiveActorRole({ isCrewOwner: true, membershipRole: "member" }),
    ).toBe("owner");
    expect(
      effectiveActorRole({ isCrewOwner: false, membershipRole: "admin" }),
    ).toBe("admin");
    expect(effectiveActorRole({ isCrewOwner: false, membershipRole: null })).toBeNull();
  });

  it("owner manages everyone below, but never other owners", () => {
    expect(canManageRole("owner", "co_owner")).toBe(true);
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("owner", "member")).toBe(true);
    expect(canManageRole("owner", "owner")).toBe(false);
  });

  it("co_owner manages admin/mechanic/member only", () => {
    expect(canManageRole("co_owner", "admin")).toBe(true);
    expect(canManageRole("co_owner", "mechanic")).toBe(true);
    expect(canManageRole("co_owner", "member")).toBe(true);
    expect(canManageRole("co_owner", "co_owner")).toBe(false);
    expect(canManageRole("co_owner", "owner")).toBe(false);
  });

  it("admin manages mechanic/member only", () => {
    expect(canManageRole("admin", "mechanic")).toBe(true);
    expect(canManageRole("admin", "member")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("admin", "co_owner")).toBe(false);
    expect(canManageRole("admin", "owner")).toBe(false);
  });

  it("plain member manages nobody", () => {
    expect(canManageRole("member", "member")).toBe(false);
    expect(canManageRole("member", "mechanic")).toBe(false);
  });

  it("assignable roles stop one rank below the actor", () => {
    expect(assignableRolesFor("owner")).toEqual(["co_owner", "admin", "mechanic", "member"]);
    expect(assignableRolesFor("co_owner")).toEqual(["admin", "mechanic", "member"]);
    expect(assignableRolesFor("admin")).toEqual(["mechanic", "member"]);
    expect(assignableRolesFor("member")).toEqual([]);
  });
});

// ─────────────────────────── action flows ───────────────────────────

const CREW = { id: "crew-1", name: "VIP Bike", owner_id: "111" };

describe("updateCrewMemberRole action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: CREW, error: null });
    mocks.update.mockResolvedValue(undefined);
  });

  function queueMemberships(actor: Record<string, unknown> | null, target: Record<string, unknown> | null) {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: actor, error: null })
      .mockResolvedValueOnce({ data: target, error: null });
  }

  it("admin can promote member → mechanic", async () => {
    queueMemberships({ user_id: "222", role: "admin" }, { user_id: "333", role: "member" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "mechanic",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ role: "mechanic" });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("admin cannot appoint another admin", async () => {
    queueMemberships({ user_id: "222", role: "admin" }, { user_id: "333", role: "member" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "admin",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("недоступно");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("co_owner can demote admin → member", async () => {
    queueMemberships({ user_id: "222", role: "co_owner" }, { user_id: "333", role: "admin" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ role: "member" });
  });

  it("co_owner cannot touch a co_owner peer", async () => {
    queueMemberships({ user_id: "222", role: "co_owner" }, { user_id: "333", role: "co_owner" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("Недостаточно прав");
  });

  it("owner via crews.owner_id works even without a membership row", async () => {
    queueMemberships(null, { user_id: "333", role: "member" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "co_owner",
      actorTelegramUserId: "111", // === CREW.owner_id
    });
    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ role: "co_owner" });
  });

  it("cannot change the role of an owner", async () => {
    queueMemberships({ user_id: "222", role: "co_owner" }, { user_id: "333", role: "owner" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(false);
  });

  it("blocks self-role change", async () => {
    queueMemberships({ user_id: "222", role: "admin" }, { user_id: "222", role: "admin" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "222",
      newRole: "mechanic",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("собственную");
  });

  it("rejects a no-op (member already has the role)", async () => {
    queueMemberships({ user_id: "222", role: "owner" }, { user_id: "333", role: "mechanic" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "mechanic",
      actorTelegramUserId: "111",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("уже имеет");
  });

  it("outsider (no membership, not owner) is rejected", async () => {
    queueMemberships(null, { user_id: "333", role: "member" });
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "999",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("не участник");
  });

  it("missing target membership is reported", async () => {
    queueMemberships({ user_id: "222", role: "owner" }, null);
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "111",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("не найден");
  });

  it("telegram notification failure never blocks the update", async () => {
    queueMemberships({ user_id: "222", role: "admin" }, { user_id: "333", role: "member" });
    mocks.sendTelegramMessage.mockRejectedValueOnce(new Error("tg down"));
    const res = await updateCrewMemberRole({
      crewSlug: "vip-bike",
      targetUserId: "333",
      newRole: "mechanic",
      actorTelegramUserId: "222",
    });
    expect(res.success).toBe(true);
  });

  it("unknown crew slug is rejected", async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: null });
    const res = await updateCrewMemberRole({
      crewSlug: "ghost",
      targetUserId: "333",
      newRole: "member",
      actorTelegramUserId: "111",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("не найден");
  });
});
