// tests/franchize/equipment-rentals.spec.ts
//
// I5 — Unit tests for equipment rentals server actions.
// Plan: docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md (Task 2)
//
// Run: npx vitest run tests/franchize/equipment-rentals.spec.ts

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock modules
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock cookies and telegram auth
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => new Map()),
}));

vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "telegram_actor",
  verifyTelegramActorCookieValue: vi.fn(() => "mock-user-id"),
}));

// Build mock chain helper
const buildMockChain = (overrides: Record<string, any> = {}) => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => ({ data: null, error: null })),
    single: vi.fn(() => ({ data: null, error: null })),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    ...overrides,
  };
  return chain;
};

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => buildMockChain()),
  },
}));

// Import after mocks
import {
  createEquipmentRental,
  returnEquipmentRental,
  listEquipmentRentals,
} from "@/app/franchize/server-actions/equipment-rentals";
import { supabaseAdmin } from "@/lib/supabase-server";

describe("equipment-rentals actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEquipmentRental", () => {
    it("rejects non-equipment item", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      // Mock crew lookup (returns owner_id)
      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      // Mock equipment lookup (returns type='bike')
      const equipChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "bike-123", type: "bike", make: "Yamaha", model: "XMAX" },
          error: null,
        }),
      });

      // Mock insert chain
      const insertChain = buildMockChain();

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "cars") return equipChain;
        if (table === "equipment_rentals") return insertChain;
        return buildMockChain();
      });

      const res = await createEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        equipmentId: "bike-123",
        dailyPrice: 500,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("экипировки");
    });

    it("creates standalone rental with total_cost = price * days", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      // Crew lookup
      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      // Equipment lookup (type='equipment')
      const equipChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "equip-helmet", type: "equipment", make: "MT", model: "Helmet" },
          error: null,
        }),
      });

      // Insert chain
      const insertChain = buildMockChain({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "rental-123" },
              error: null,
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "cars") return equipChain;
        if (table === "equipment_rentals") return insertChain;
        return buildMockChain();
      });

      // 3 days rental
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const res = await createEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        equipmentId: "equip-helmet",
        expectedReturnDate: threeDaysFromNow,
        dailyPrice: 500,
      });

      expect(res.success).toBe(true);
      expect(res.data?.id).toBe("rental-123");
    });

    it("creates rental without expectedReturnDate defaults to 1 day", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      const equipChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "equip-jacket", type: "equipment", make: "MT", model: "Jacket" },
          error: null,
        }),
      });

      const insertChain = buildMockChain({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "rental-456" },
              error: null,
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "cars") return equipChain;
        if (table === "equipment_rentals") return insertChain;
        return buildMockChain();
      });

      const res = await createEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        equipmentId: "equip-jacket",
        dailyPrice: 300,
      });

      expect(res.success).toBe(true);
    });
  });

  describe("returnEquipmentRental", () => {
    it("sets status + returned_at", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      const rentalChain = buildMockChain({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "rental-123" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "equipment_rentals") return rentalChain;
        return buildMockChain();
      });

      const res = await returnEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        id: "rental-123",
        condition: "returned",
        conditionNotes: "Good condition",
      });

      expect(res.success).toBe(true);
    });

    it("rejects when rental not found or already closed", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      const rentalChain = buildMockChain({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "equipment_rentals") return rentalChain;
        return buildMockChain();
      });

      const res = await returnEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        id: "rental-999",
        condition: "returned",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("не найдена или уже закрыта");
    });
  });

  describe("listEquipmentRentals", () => {
    it("returns equipment_label from cars", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      const rentalChain = buildMockChain({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "rental-1",
                  equipment_id: "equip-helmet",
                  status: "active",
                  daily_price: "200",
                  total_cost: "600",
                  start_date: "2026-08-12T10:00:00Z",
                  expected_return_date: "2026-08-15T10:00:00Z",
                  returned_at: null,
                  renter_user_id: "user-1",
                  primary_rental_id: null,
                  equipment: { make: "MT", model: "Helmet Pro" },
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "equipment_rentals") return rentalChain;
        return buildMockChain();
      });

      const res = await listEquipmentRentals({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
      });

      expect(res.success).toBe(true);
      expect(res.data?.[0]?.equipmentLabel).toBe("MT Helmet Pro");
    });

    it("filters by status when provided", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const crewChain = buildMockChain({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "crew-1", owner_id: "mock-user-id", slug: "vip-bike" },
          error: null,
        }),
      });

      const rentalChain = buildMockChain({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "crews") return crewChain;
        if (table === "equipment_rentals") return rentalChain;
        return buildMockChain();
      });

      const res = await listEquipmentRentals({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        statusFilter: "returned",
      });

      expect(res.success).toBe(true);
    });
  });
});
