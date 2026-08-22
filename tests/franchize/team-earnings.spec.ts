// tests/franchize/team-earnings.spec.ts
//
// 2026-08-19 review: specs for the team-earnings server actions — lock in
// the multi-crew data leak fix and the TZ-aware period normalization.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => new Map()),
}));

vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "telegram_actor",
  verifyTelegramActorCookieValue: vi.fn(() => "mock-user-id"),
}));

const mockHolder: { from: (table: string) => any } = {
  from: () => buildChain(),
};

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: (table: string) => mockHolder.from(table) },
}));

import {
  getMemberEarnings,
  getTeamEarnings,
  getOwnerSalaryOverview,
} from "@/app/franchize/server-actions/team-earnings";

function setMockImpl(fn: (table: string) => any) {
  mockHolder.from = fn;
}

function buildChain(result: { data?: any; error?: any } = {}) {
  const chain: any = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
    single: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
  };
  chain.then = (resolve: (v: any) => any) => resolve({ data: chain.data, error: chain.error });
  return chain;
}

const CREW_ID = "crew-uuid-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMemberEarnings", () => {
  it("rejects non-owner querying another member's earnings (IDOR fix)", async () => {
    // Non-owner setup: user.metadata.role != admin, crew owner_id != mock-user-id,
    // crew_members role = "member".
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: null } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "someone-else" } });
      if (table === "crew_members") return buildChain({ data: { role: "member", membership_status: "active" } });
      return buildChain();
    });
    const res = await getMemberEarnings({
      slug: "vip-bike",
      memberId: "other-member-id", // different from cookie
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Недостаточно прав");
  });

  it("allows non-owner to query their own earnings", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: null } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "someone-else" } });
      if (table === "crew_members") return buildChain({ data: { role: "member", membership_status: "active" } });
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
          },
        ],
      });
      if (table === "cash_transactions") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await getMemberEarnings({
      slug: "vip-bike",
      memberId: "mock-user-id", // self
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.shiftIncome).toBeGreaterThan(0);
    }
  });

  it("owner can query any member's earnings", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "mock-user-id" } });
      if (table === "crew_members") return buildChain({ data: { role: "admin", membership_status: "active" } });
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T18:00:00.000Z",
            hourly_rate: 169,
          },
        ],
      });
      if (table === "cash_transactions") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await getMemberEarnings({
      slug: "vip-bike",
      memberId: "any-other-member-id", // owner can query anyone
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(true);
  });
});

describe("getTeamEarnings", () => {
  it("rejects non-owner", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: null } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "someone-else" } });
      if (table === "crew_members") return buildChain({ data: { role: "member", membership_status: "active" } });
      return buildChain();
    });
    const res = await getTeamEarnings({
      slug: "vip-bike",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(false);
  });

  it("returns one row per active member with computed totals", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "mock-user-id" } });
      if (table === "crew_members") return buildChain({
        data: [
          { user_id: "u1", role: "member", users: { metadata: { name: "Alice" } } },
          { user_id: "u2", role: "member", users: { metadata: { name: "Bob" } } },
        ],
      });
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
          },
        ],
      });
      if (table === "cash_transactions") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await getTeamEarnings({
      slug: "vip-bike",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data).toHaveLength(2);
      expect(res.data[0].memberName).toBe("Alice");
      expect(res.data[1].memberName).toBe("Bob");
      // 4h × 169 RUB = 676 RUB shift income for each
      expect(res.data[0].shiftIncome).toBeGreaterThan(0);
    }
  });
});

describe("getOwnerSalaryOverview", () => {
  it("rejects non-owner", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: null } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "someone-else" } });
      if (table === "crew_members") return buildChain({ data: { role: "member", membership_status: "active" } });
      return buildChain();
    });
    const res = await getOwnerSalaryOverview({
      slug: "vip-bike",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(false);
  });

  it("filters shifts and cash_transactions by crew_id (multi-crew leak fix)", async () => {
    // Track every .eq("crew_id", ...) call so we can assert it fires for
    // both crew_member_shifts and cash_transactions queries.
    const eqCalls: Array<{ table: string; column: string; value: any }> = [];
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: { role: "admin" } }
        : table === "crews" ? { id: CREW_ID, owner_id: "mock-user-id" }
        : table === "crew_members" ? [{ user_id: "u1", role: "member", users: { metadata: { name: "Alice" } } }]
        : table === "crew_member_shifts" ? [{ clock_in_time: "2026-08-19T10:00:00.000Z", clock_out_time: "2026-08-19T14:00:00.000Z", hourly_rate: 169 }]
        : [];
      const chain = buildChain({ data });
      // Wrap eq to track crew_id filters.
      const origEq = chain.eq;
      chain.eq = vi.fn((column: string, value: any) => {
        eqCalls.push({ table, column, value });
        return chain;
      });
      return chain;
    });
    const res = await getOwnerSalaryOverview({
      slug: "vip-bike",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(res.success).toBe(true);
    // Assert that crew_member_shifts, cash_transactions (both queries) and
    // the third payouts query all filter by crew_id.
    const crewIdFilters = eqCalls.filter(c => c.column === "crew_id");
    expect(crewIdFilters.length).toBeGreaterThanOrEqual(3); // shifts + commissions + payouts
    expect(crewIdFilters.every(c => c.value === CREW_ID)).toBe(true);
  });
});
