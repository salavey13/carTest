// tests/franchize/my-work.spec.ts
//
// 2026-08-19 review: specs for my-work.ts — lock in the IDOR fix (cookie-derived
// secureUserId) and the clock_in_time column fix (was previously querying the
// non-existent shift_start column).

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

const mockHolder: { from: (table: string) => any } = { from: () => buildChain() };
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: (table: string) => mockHolder.from(table) },
}));

import { getMyWorkTodayAction } from "@/app/franchize/server-actions/my-work";

function setMockImpl(fn: (table: string) => any) {
  mockHolder.from = fn;
}

function buildChain(result: { data?: any; error?: any } = {}) {
  const chain: any = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => ({ data: result.data ?? null, error: result.error ?? null })),
    like: vi.fn(() => chain),
    or: vi.fn(() => chain),
  };
  chain.then = (resolve: (v: any) => any) => resolve({ data: chain.data, error: chain.error });
  return chain;
}

const CREW_ID = "crew-uuid-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMyWorkTodayAction", () => {
  it("ignores client-supplied userId and uses cookie-derived secureUserId (IDOR fix)", async () => {
    // Track every .eq("member_id", ...) call to assert it uses
    // "mock-user-id" (cookie-derived), NOT "attacker-supplied-id".
    const eqCalls: Array<{ column: string; value: any }> = [];
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? []
        : []; // cash_transactions
      const chain = buildChain({ data });
      const origEq = chain.eq;
      chain.eq = vi.fn((column: string, value: any) => {
        eqCalls.push({ column, value });
        return chain;
      });
      return chain;
    });
    // Pass an "attacker-supplied" userId — should be ignored.
    const res = await getMyWorkTodayAction({
      slug: "vip-bike",
      userId: "attacker-supplied-id",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      // Verify that every member_id filter used the cookie-derived id, NOT
      // the client-supplied "attacker-supplied-id".
      const memberIdFilters = eqCalls.filter(c => c.column === "member_id");
      expect(memberIdFilters.length).toBeGreaterThan(0);
      expect(memberIdFilters.every(c => c.value === "mock-user-id")).toBe(true);
    }
  });

  it("queries crew_member_shifts by clock_in_time (not the non-existent shift_start)", async () => {
    // Track gte/lte columns to assert clock_in_time is the filter column.
    const filterCalls: Array<{ column: string; op: string }> = [];
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? [{
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
            salary_amount: 676,
          }]
        : [];
      const chain = buildChain({ data });
      chain.eq = vi.fn(() => chain);
      chain.gte = vi.fn((col: string) => { filterCalls.push({ column: col, op: "gte" }); return chain; });
      chain.lte = vi.fn((col: string) => { filterCalls.push({ column: col, op: "lte" }); return chain; });
      return chain;
    });
    const res = await getMyWorkTodayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    // Assert clock_in_time is the filter column (NOT shift_start).
    const clockInFilters = filterCalls.filter(f => f.column === "clock_in_time");
    expect(clockInFilters.length).toBeGreaterThan(0);
    const shiftStartFilters = filterCalls.filter(f => f.column === "shift_start");
    expect(shiftStartFilters.length).toBe(0);
  });

  it("computes rentals total from salary_amount when present", async () => {
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? [{
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
            salary_amount: 676,
          }]
        : [];
      return buildChain({ data });
    });
    const res = await getMyWorkTodayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.rentals.count).toBe(1);
      expect(res.data.rentals.total).toBe(676);
    }
  });

  it("computes rentals total from duration × hourly_rate when salary_amount is null (active shift)", async () => {
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? [{
            clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
            clock_out_time: null, // active
            hourly_rate: 169,
            salary_amount: null,
          }]
        : [];
      return buildChain({ data });
    });
    const res = await getMyWorkTodayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.rentals.count).toBe(1);
      // 4h × 169 = 676, allow some leeway for test runtime.
      expect(res.data.rentals.total).toBeGreaterThanOrEqual(676);
    }
  });
});
