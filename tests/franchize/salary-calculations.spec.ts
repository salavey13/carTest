// tests/franchize/salary-calculations.spec.ts
//
// 2026-08-19 review: added specs for the salary server actions to lock in
// the IDOR fixes, owner-or-self auth, and the active-shift cache-skip
// behavior. Mirrors the mocking pattern of cash-transactions.spec.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => new Map()),
}));

vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "telegram_actor",
  verifyTelegramActorCookieValue: vi.fn(() => "mock-user-id"),
}));

// Mock holder so vi.mock factory (which is hoisted) can still let tests
// override behavior at runtime.
const mockHolder: { from: (table: string) => any; rpc: (name: string, args: any) => any } = {
  from: () => buildChain(),
  rpc: () => ({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => mockHolder.from(table),
    rpc: (name: string, args: any) => mockHolder.rpc(name, args),
  },
}));

import {
  calculateSalaryForPeriod,
  getMyEarnings,
  recordPayoutForPeriod,
} from "@/app/franchize/server-actions/salary-calculations";

function setMockImpl(fn: (table: string) => any) {
  mockHolder.from = fn;
}
function setMockRpc(fn: (name: string, args: any) => any) {
  mockHolder.rpc = fn;
}

/**
 * Build a query chain. The chain is "thenable" (Promise.resolve-like) so
 * `await supabaseAdmin.from(...).select(...).eq(...)` resolves to the chain
 * itself, where `.data` and `.error` can be read.
 *
 * Pass `result` to control the destructured `{ data, error }` shape returned
 * at the END of the chain.
 */
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
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    count: result.data?.length ?? 0,
  };
  // Make the chain itself awaitable: `await chain` resolves to a plain
  // `{ data, error }` object (NOT the chain — that would re-trigger the
  // thenable protocol and recurse).
  chain.then = (resolve: (v: any) => any) => resolve({ data: chain.data, error: chain.error });
  return chain;
}

const CREW_ID = "crew-uuid-1";
const OWNER_ID = "mock-user-id";
const OTHER_MEMBER_ID = "other-member-id";

// verifyCrewAccess queries: users → crews → crew_members.
function setAuthMocks({
  allowed = true,
  isOwner = true,
  cookieUserId = OWNER_ID,
}: { allowed?: boolean; isOwner?: boolean; cookieUserId?: string } = {}) {
  setMockImpl((table: string) => {
    if (table === "users") return buildChain({ data: allowed ? { metadata: isOwner ? { role: "admin" } : null } : null });
    if (table === "crews") return buildChain({ data: allowed ? { id: CREW_ID, owner_id: isOwner ? cookieUserId : "someone-else" } : null });
    if (table === "crew_members") return buildChain({ data: allowed ? { role: isOwner ? "admin" : "member", membership_status: "active" } : null });
    return buildChain();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setMockRpc(() => ({ data: null, error: null }));
});

describe("calculateSalaryForPeriod", () => {
  it("rejects non-owner querying another member's salary (IDOR fix)", async () => {
    setAuthMocks({ isOwner: false });
    const res = await calculateSalaryForPeriod({
      slug: "vip-bike",
      actorUserId: OWNER_ID,
      memberId: OTHER_MEMBER_ID,
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Недостаточно прав");
  });

  it("allows non-owner querying their own salary and computes shift income", async () => {
    // Non-owner (member), but querying self.
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
            salary_amount: 676,
          },
        ],
      });
      if (table === "cash_transactions") return buildChain({ data: [] });
      if (table === "commission_rates") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await calculateSalaryForPeriod({
      slug: "vip-bike",
      actorUserId: OWNER_ID,
      memberId: OWNER_ID, // self
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.shiftIncome).toBeGreaterThan(0);
    }
  });

  it("computes active-shift income on the fly when salary_amount is null", async () => {
    setAuthMocks({ isOwner: true });
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: OWNER_ID } });
      if (table === "crew_members") return buildChain({ data: { role: "admin", membership_status: "active" } });
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
            clock_out_time: null, // active shift
            hourly_rate: 169,
            salary_amount: null,
          },
        ],
      });
      if (table === "cash_transactions") return buildChain({ data: [] });
      if (table === "commission_rates") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await calculateSalaryForPeriod({
      slug: "vip-bike",
      actorUserId: OWNER_ID,
      memberId: OTHER_MEMBER_ID, // owner can query anyone
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      // 4h × 169 RUB/h = 676 RUB. The active shift should be computed.
      expect(res.data.shiftIncome).toBeGreaterThanOrEqual(676);
    }
  });
});

describe("getMyEarnings", () => {
  it("returns dynamic accrued + balanceDue for current month", async () => {
    // salary_plans: no plan (default mock returns null data).
    // crew_member_shifts: one completed shift with salary_amount.
    // cash_transactions: empty (no commissions, no payouts).
    let txCallCount = 0;
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: null } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: "someone-else" } });
      if (table === "crew_members") return buildChain({ data: { role: "member", membership_status: "active" } });
      if (table === "salary_plans") return buildChain(); // maybeSingle returns { data: null, error: null }
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
            salary_amount: 676,
          },
        ],
      });
      if (table === "cash_transactions") {
        txCallCount++;
        // Both commission + payout queries return empty.
        return buildChain({ data: [] });
      }
      return buildChain();
    });
    const res = await getMyEarnings({ slug: "vip-bike", actorUserId: OWNER_ID });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.currentPlan.accrued).toBeGreaterThan(0);
      expect(res.data.currentPlan.balanceDue).toBeGreaterThan(0);
      expect(res.data.currentPlan.nextPayoutDate).toBeTruthy();
    }
  });

  it("falls back to plan-stored values when no shifts/commissions", async () => {
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: OWNER_ID } });
      if (table === "crew_members") return buildChain({ data: { role: "admin", membership_status: "active" } });
      if (table === "salary_plans") {
        const c = buildChain();
        c.maybeSingle = vi.fn(() => ({
          data: {
            id: "plan-1",
            total_accrued: 5000,
            balance_due: 3000,
            payout_schedule: ["10", "25"],
          },
          error: null,
        }));
        return c;
      }
      if (table === "crew_member_shifts") return buildChain({ data: [] });
      if (table === "cash_transactions") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await getMyEarnings({ slug: "vip-bike", actorUserId: OWNER_ID });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      // No shifts/commissions → falls back to plan.total_accrued = 5000.
      expect(res.data.currentPlan.accrued).toBe(5000);
      // balanceDue: plan.balance_due = 3000 (because accrued=0 → not dynamic, use plan value).
      expect(res.data.currentPlan.balanceDue).toBe(3000);
    }
  });
});

describe("recordPayoutForPeriod", () => {
  it("rejects non-owner", async () => {
    setAuthMocks({ isOwner: false });
    const res = await recordPayoutForPeriod({
      slug: "vip-bike",
      memberId: OWNER_ID,
      periodStart: "2026-08-01",
      periodEnd: "2026-09-01",
    });
    expect(res.success).toBe(false);
  });

  it("rejects owner with zero balance (idempotency)", async () => {
    setAuthMocks({ isOwner: true });
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: OWNER_ID } });
      if (table === "crew_members") return buildChain({ data: { role: "admin", membership_status: "active" } });
      if (table === "crew_member_shifts") return buildChain({ data: [] });
      if (table === "cash_transactions") return buildChain({ data: [] });
      return buildChain();
    });
    const res = await recordPayoutForPeriod({
      slug: "vip-bike",
      memberId: OWNER_ID,
      periodStart: "2026-08-01",
      periodEnd: "2026-09-01",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("равен нулю");
  });

  it("creates expense_salary transaction when balanceDue > 0", async () => {
    setAuthMocks({ isOwner: true });
    let txCallCount = 0;
    setMockImpl((table: string) => {
      if (table === "users") return buildChain({ data: { metadata: { role: "admin" } } });
      if (table === "crews") return buildChain({ data: { id: CREW_ID, owner_id: OWNER_ID } });
      if (table === "crew_members") return buildChain({ data: { role: "admin", membership_status: "active" } });
      if (table === "crew_member_shifts") return buildChain({
        data: [
          {
            clock_in_time: "2026-08-19T10:00:00.000Z",
            clock_out_time: "2026-08-19T14:00:00.000Z",
            hourly_rate: 169,
            salary_amount: 676,
          },
        ],
      });
      if (table === "cash_transactions") {
        txCallCount++;
        if (txCallCount <= 2) {
          // commissions + payouts both empty
          return buildChain({ data: [] });
        }
        // Third call: the insert. Build a chain whose final .single() returns
        // { data: { id: "tx-1" }, error: null }.
        const insertChain = buildChain();
        insertChain.insert = vi.fn(() => insertChain);
        insertChain.select = vi.fn(() => insertChain);
        insertChain.single = vi.fn(() => ({ data: { id: "tx-1" }, error: null }));
        return insertChain;
      }
      return buildChain();
    });
    const res = await recordPayoutForPeriod({
      slug: "vip-bike",
      memberId: OWNER_ID,
      periodStart: "2026-08-01",
      periodEnd: "2026-09-01",
    });
    expect(res.success).toBe(true);
    if (res.success && res.data) {
      expect(res.data.paidAmount).toBeGreaterThan(0);
      expect(res.data.transactionId).toBe("tx-1");
    }
  });
});
