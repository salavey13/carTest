// tests/franchize/my-work.spec.ts
//
// 2026-08-19 review: specs for my-work.ts — lock in the IDOR fix (cookie-derived
// secureUserId) and the clock_in_time column fix (was previously querying the
// non-existent shift_start column).
//
// iter26: reworked for getMyWorkDayAction — the «Аренды» card now counts REAL
// rentals attributed to the operator (same computeRentalSalary math as the
// analytics CSV «ЗП Аренда»), shifts live in their own card, a date picker
// scopes the day. These specs lock that contract.

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

import { getMyWorkDayAction, getMyWorkTodayAction } from "@/app/franchize/server-actions/my-work";

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
    neq: vi.fn(() => chain),
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

describe("getMyWorkDayAction", () => {
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
        : []; // cash_transactions / rentals / cars
      const chain = buildChain({ data });
      const origEq = chain.eq;
      chain.eq = vi.fn((column: string, value: any) => {
        eqCalls.push({ column, value });
        return chain;
      });
      return chain;
    });
    // Pass an "attacker-supplied" userId — should be ignored.
    const res = await getMyWorkDayAction({
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
    const res = await getMyWorkDayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    // Assert clock_in_time is the filter column (NOT shift_start).
    const clockInFilters = filterCalls.filter(f => f.column === "clock_in_time");
    expect(clockInFilters.length).toBeGreaterThan(0);
    const shiftStartFilters = filterCalls.filter(f => f.column === "shift_start");
    expect(shiftStartFilters.length).toBe(0);
  });

  it("counts SHIFTS in the shifts card (not mislabeled as rentals anymore)", async () => {
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
    const res = await getMyWorkDayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.shifts.count).toBe(1);
      expect(res.data.shifts.total).toBe(676);
      // The rental card must NOT count the shift anymore.
      expect(res.data.rentals.count).toBe(0);
      expect(res.data.rentals.salary).toBe(0);
      expect(res.data.totalDay).toBe(676);
    }
  });

  it("computes shift income from duration × hourly_rate when salary_amount is null (active shift)", async () => {
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
    const res = await getMyWorkDayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.shifts.count).toBe(1);
      // 4h × 169 = 676, allow some leeway for test runtime.
      expect(res.data.shifts.total).toBeGreaterThanOrEqual(676);
    }
  });

  it("counts rentals attributed to me via created_by_operator_chat_id and pays the SAME salary as the analytics CSV", async () => {
    // One rental created by the cookie user (op chat id = mock-user-id),
    // regular category (default fallback), no equipment, no markup.
    // computeRentalSalary → base 1000 + 0 + 0 = 1000.
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? []
        : table === "rentals" ? [{
            rental_id: "11111111-1111-4111-8111-111111111111",
            status: "completed",
            total_cost: 12000,
            metadata: {},
            created_at: "2026-08-30T10:00:00.000Z",
            created_by_operator_chat_id: "mock-user-id",
            requested_start_date: null,
            requested_end_date: null,
            agreed_start_date: null,
            agreed_end_date: null,
            vehicle: { id: "bike-1", make: "Yamaha", model: "R7", crew_id: CREW_ID, specs: {}, daily_price: null },
          }]
        : [];
      return buildChain({ data });
    });
    const res = await getMyWorkDayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.rentals.count).toBe(1);
      expect(res.data.rentals.revenue).toBe(12000);
      expect(res.data.rentals.salary).toBe(1000);
      expect(res.data.rentalDetails).toHaveLength(1);
      expect(res.data.rentalDetails[0].bikeLabel).toBe("Yamaha R7");
      expect(res.data.rentalDetails[0].sourceLabel).toBe("/doc");
      expect(res.data.totalDay).toBe(1000);
    }
  });

  it("does NOT count rentals attributed to another operator", async () => {
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : table === "crew_member_shifts" ? []
        : table === "rentals" ? [{
            rental_id: "22222222-2222-4222-8222-222222222222",
            status: "completed",
            total_cost: 8000,
            metadata: {},
            created_at: "2026-08-30T10:00:00.000Z",
            created_by_operator_chat_id: "356282674", // someone else
            requested_start_date: null,
            requested_end_date: null,
            agreed_start_date: null,
            agreed_end_date: null,
            vehicle: { id: "bike-2", make: "Ducati", model: "Panigale", crew_id: CREW_ID, specs: {}, daily_price: null },
          }]
        : [];
      return buildChain({ data });
    });
    const res = await getMyWorkDayAction({ slug: "vip-bike", userId: "mock-user-id" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.rentals.count).toBe(0);
      expect(res.data.rentals.salary).toBe(0);
    }
  });

  it("scopes the day window to the requested date (MSK) and reports it back", async () => {
    const gteCalls: Array<{ column: string; value: any }> = [];
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : [];
      const chain = buildChain({ data });
      chain.gte = vi.fn((col: string, value: any) => {
        if (table === "rentals") gteCalls.push({ column: col, value });
        return chain;
      });
      return chain;
    });
    const res = await getMyWorkDayAction({ slug: "vip-bike", date: "2026-08-29" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.date).toBe("2026-08-29");
      expect(res.data.isToday).toBe(false);
    }
    // Rentals are scoped by requested_start_date within the MSK day window
    // (2026-08-29 00:00 MSK = 2026-08-28T21:00:00Z).
    const startFilter = gteCalls.find(c => c.column === "requested_start_date");
    expect(startFilter).toBeTruthy();
    expect(startFilter!.value).toBe("2026-08-28T21:00:00.000Z");
  });

  it("falls back to today for garbage dates", async () => {
    setMockImpl((table: string) => {
      const data =
        table === "users" ? { metadata: null }
        : table === "crews" ? { id: CREW_ID, owner_id: "someone-else" }
        : table === "crew_members" ? { role: "member", membership_status: "active" }
        : [];
      return buildChain({ data });
    });
    const res = await getMyWorkDayAction({ slug: "vip-bike", date: "2026-02-31" });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.isToday).toBe(true);
    }
  });

  it("getMyWorkTodayAction remains exported as a compatible alias", async () => {
    expect(typeof getMyWorkTodayAction).toBe("function");
    expect(getMyWorkTodayAction).toBe(getMyWorkDayAction);
  });
});
