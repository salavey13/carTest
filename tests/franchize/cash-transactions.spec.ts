// tests/franchize/cash-transactions.spec.ts
//
// I5 — Cash transactions server actions tests
// Plan: docs/superpowers/plans/2026-08-12-i5-cash-ledger.md (Task 4)

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock BEFORE importing server actions
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => new Map()),
}));

vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "telegram_actor",
  verifyTelegramActorCookieValue: vi.fn(() => "mock-user-id"),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        maybeSingle: vi.fn(() => ({ data: null, error: null })),
        single: vi.fn(() => ({ data: null, error: null })),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
      };
      return chain;
    }),
  },
}));

// Now import after mocks
import {
  getCashTransactions,
  createManualCashTransaction,
  getDailyCashReport,
} from "@/app/franchize/server-actions/cash-transactions";
import { supabaseAdmin } from "@/lib/supabase-server";

describe("cash-transactions actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCashTransactions", () => {
    it("returns transactions with summary", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      // User lookup chain (for admin check)
      const userChain: any = {
        select: vi.fn(() => userChain),
        eq: vi.fn(() => userChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { metadata: { role: "admin" } },
          error: null,
        }),
      };

      // Crew lookup chain
      const crewChain: any = {
        select: vi.fn(() => crewChain),
        eq: vi.fn(() => crewChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      };

      // Transactions query chain
      const txChain: any = {
        select: vi.fn(() => txChain),
        eq: vi.fn(() => txChain),
        gte: vi.fn(() => txChain),
        lte: vi.fn(() => txChain),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "tx1", crew_id: "crew-1", transaction_type: "income_rental", flow_direction: "in", amount: "1000" },
            { id: "tx2", crew_id: "crew-1", transaction_type: "expense_commission", flow_direction: "out", amount: "100" },
          ],
          error: null,
        }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return userChain;
        if (table === "crews") return crewChain;
        if (table === "cash_transactions") return txChain;
        return { select: vi.fn(), eq: vi.fn() };
      });

      const res = await getCashTransactions({ slug: "vip-bike", actorUserId: "mock-user-id" });

      expect(res.success).toBe(true);
      expect(res.summary?.totalIn).toBe(1000);
      expect(res.summary?.totalOut).toBe(100);
      expect(res.summary?.net).toBe(900);
    });
  });

  describe("createManualCashTransaction", () => {
    it("rejects amount <= 0", async () => {
      const res = await createManualCashTransaction({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        transactionType: "income_other",
        amount: 0,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("больше нуля");
    });

    it("creates transaction for owner", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain: any = {
        select: vi.fn(() => crewChain),
        eq: vi.fn(() => crewChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      };

      const userChain: any = {
        select: vi.fn(() => userChain),
        eq: vi.fn(() => userChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { metadata: { role: "owner" } },
          error: null,
        }),
      };

      const insertChain: any = {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "tx-new" },
              error: null,
            }),
          }),
        }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "users") return userChain;
        if (table === "cash_transactions") return insertChain;
        return { select: vi.fn(), eq: vi.fn() };
      });

      const res = await createManualCashTransaction({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        transactionType: "income_other",
        amount: 5000,
        category: "Прочее",
        description: "Ручная запись",
      });

      expect(res.success).toBe(true);
      expect(res.data?.id).toBe("tx-new");
    });
  });

  describe("getDailyCashReport", () => {
    it("returns daily summary and transactions", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const userChain: any = {
        select: vi.fn(() => userChain),
        eq: vi.fn(() => userChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { metadata: { role: "admin" } },
          error: null,
        }),
      };

      const crewChain: any = {
        select: vi.fn(() => crewChain),
        eq: vi.fn(() => crewChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      };

      const viewChain: any = {
        select: vi.fn(() => viewChain),
        eq: vi.fn(() => viewChain),
        eq: vi.fn(() => viewChain),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { total_in: "5000", total_out: "1000", net_flow: "4000" },
          error: null,
        }),
      };

      const txChain: any = {
        select: vi.fn(() => txChain),
        eq: vi.fn(() => txChain),
        gte: vi.fn(() => txChain),
        lte: vi.fn(() => txChain),
        order: vi.fn().mockResolvedValue({
          data: [{ id: "tx1", crew_id: "crew-1", transaction_type: "income_rental", flow_direction: "in", amount: "5000" }],
          error: null,
        }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return userChain;
        if (table === "crews") return crewChain;
        if (table === "daily_cash_flow") return viewChain;
        if (table === "cash_transactions") return txChain;
        return { select: vi.fn(), eq: vi.fn() };
      });

      const res = await getDailyCashReport({ slug: "vip-bike", actorUserId: "mock-user-id", date: "2026-08-12" });

      // The function now returns success with data from transactions
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.totalIn).toBeGreaterThan(0);
    });
  });
});
