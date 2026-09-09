// tests/franchize/equipment-rentals.spec.ts
//
// I5 — Unit tests for equipment rentals server actions (2026-09-10 UNIFIED
// STORAGE edition): equipment rentals live in the `rentals` table with
// metadata.item_type='equipment' — same pipeline, money ledger and analytics
// as primary bike rents. The legacy `equipment_rentals` table is an archive.
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

/**
 * Thenable mock chain: every builder returns the chain itself; awaiting the
 * chain resolves with the configured result. Terminal overrides still win.
 */
function chain(result: { data: any; error: any } = { data: null, error: null }) {
  const c: any = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    in: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => c),
    update: vi.fn(() => c),
    insert: vi.fn(() => c),
    delete: vi.fn(() => c),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return c;
}

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => chain()),
    schema: vi.fn(() => ({ from: vi.fn(() => chain()) })),
  },
}));

// Import after mocks
import {
  createEquipmentRental,
  returnEquipmentRental,
  listEquipmentRentals,
  createEquipmentRowsForRental,
} from "@/app/franchize/server-actions/equipment-rentals";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Crew lookup used by verifyCrewAccess (users + crews). */
const CREW_OK = { id: "crew-1", owner_id: "mock-user-id" };

describe("equipment-rentals actions (unified storage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEquipmentRental", () => {
    it("rejects non-equipment item", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "cars")
          return chain({
            data: { id: "bike-123", type: "bike", make: "Yamaha", model: "XMAX" },
            error: null,
          });
        return chain();
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

    it("creates a unified rentals row (metadata.item_type='equipment') and returns its id", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      let capturedInsert: any = null;
      const rentalsChain = chain({ data: { rental_id: "rental-123" }, error: null });
      const originalInsert = rentalsChain.insert;
      rentalsChain.insert = vi.fn((payload: any) => {
        capturedInsert = payload;
        return rentalsChain;
      });
      void originalInsert;

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "cars")
          return chain({
            data: { id: "equip-helmet", type: "equipment", make: "MT", model: "Helmet" },
            error: null,
          });
        if (table === "crew_members") return chain({ data: null, error: null }); // owner resolver falls back
        if (table === "rentals") return rentalsChain;
        return chain();
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
      // Unified storage assertions
      expect(capturedInsert).toBeTruthy();
      expect(capturedInsert.metadata.item_type).toBe("equipment");
      expect(capturedInsert.crew_id).toBe("crew-1");
      expect(capturedInsert.status).toBe("active");
      expect(capturedInsert.total_cost).toBe(1500); // 500 × 3 days
    });

    it("defaults to 1 day without expectedReturnDate", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      let capturedInsert: any = null;
      const rentalsChain = chain({ data: { rental_id: "rental-456" }, error: null });
      rentalsChain.insert = vi.fn((payload: any) => {
        capturedInsert = payload;
        return rentalsChain;
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "cars")
          return chain({
            data: { id: "equip-jacket", type: "equipment", make: "MT", model: "Jacket" },
            error: null,
          });
        if (table === "crew_members") return chain({ data: null, error: null });
        if (table === "rentals") return rentalsChain;
        return chain();
      });

      const res = await createEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        equipmentId: "equip-jacket",
        dailyPrice: 300,
      });

      expect(res.success).toBe(true);
      expect(capturedInsert.total_cost).toBe(300);
    });
  });

  describe("returnEquipmentRental", () => {
    it("maps returned → completed, patches metadata and closes return todos", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      let capturedUpdate: any = null;
      const rentalsChain = chain({
        data: {
          rental_id: "rental-123",
          status: "active",
          metadata: { item_type: "equipment", damage_reports: [] },
        },
        error: null,
      });
      rentalsChain.update = vi.fn((payload: any) => {
        capturedUpdate = payload;
        return rentalsChain;
      });

      const todosChain = chain({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "rentals") return rentalsChain;
        if (table === "crew_todos") return todosChain;
        return chain();
      });

      const res = await returnEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        id: "rental-123",
        condition: "returned",
        conditionNotes: "Good condition",
      });

      expect(res.success).toBe(true);
      expect(capturedUpdate.status).toBe("completed");
      expect(capturedUpdate.metadata.equipment_condition).toBe("Норм");
      expect(capturedUpdate.metadata.damage_reports).toHaveLength(1);
      expect(capturedUpdate.metadata.damage_reports[0].phase).toBe("return");
      expect(todosChain.update).toHaveBeenCalled();
    });

    it("maps damaged → disputed with a major damage report", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      let capturedUpdate: any = null;
      const rentalsChain = chain({
        data: { rental_id: "rental-9", status: "active", metadata: { item_type: "equipment" } },
        error: null,
      });
      rentalsChain.update = vi.fn((payload: any) => {
        capturedUpdate = payload;
        return rentalsChain;
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "rentals") return rentalsChain;
        if (table === "crew_todos") return chain({ data: null, error: null });
        return chain();
      });

      const res = await returnEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        id: "rental-9",
        condition: "damaged",
        conditionNotes: "Cracked visor",
      });

      expect(res.success).toBe(true);
      expect(capturedUpdate.status).toBe("disputed");
      expect(capturedUpdate.metadata.equipment_condition).toBe("Есть повреждения");
      expect(capturedUpdate.metadata.damage_reports[0].severity).toBe("major");
    });

    it("rejects when the row is already closed", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "rentals")
          return chain({
            data: { rental_id: "rental-9", status: "completed", metadata: { item_type: "equipment" } },
            error: null,
          });
        return chain();
      });

      const res = await returnEquipmentRental({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
        id: "rental-9",
        condition: "returned",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("не найдена или уже закрыта");
    });
  });

  describe("listEquipmentRentals", () => {
    it("maps unified rows back to the legacy API shape", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const rentalsChain = chain({
        data: [
          {
            rental_id: "rental-1",
            vehicle_id: "equip-helmet",
            status: "active",
            total_cost: 600,
            requested_start_date: "2026-08-12T10:00:00Z",
            agreed_end_date: "2026-08-15T10:00:00Z",
            updated_at: "2026-08-12T10:00:00Z",
            user_id: "user-1",
            metadata: { item_type: "equipment", daily_price: 200, issued_at: "2026-08-12T10:00:00Z" },
            equipment: { id: "equip-helmet", make: "MT", model: "Helmet Pro" },
          },
          {
            rental_id: "rental-2",
            vehicle_id: "equip-gloves",
            status: "completed",
            total_cost: 500,
            requested_start_date: "2026-08-01T10:00:00Z",
            updated_at: "2026-08-05T10:00:00Z",
            user_id: "user-2",
            metadata: {
              item_type: "equipment",
              daily_price: 500,
              returned_at: "2026-08-05T10:00:00Z",
            },
            equipment: { id: "equip-gloves", make: "MT", model: "Summer X" },
          },
        ],
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "users") return chain({ data: { metadata: null }, error: null });
        if (table === "crews") return chain({ data: CREW_OK, error: null });
        if (table === "rentals") return rentalsChain;
        return chain();
      });

      const res = await listEquipmentRentals({
        slug: "vip-bike",
        actorUserId: "mock-user-id",
      });

      expect(res.success).toBe(true);
      const rows = res.data as any[];
      expect(rows).toHaveLength(2);

      expect(rows[0].equipmentLabel).toBe("MT Helmet Pro");
      expect(rows[0].status).toBe("active");
      expect(rows[0].dailyPrice).toBe(200);
      expect(rows[0].totalCost).toBe(600);

      // completed → legacy "returned"
      expect(rows[1].status).toBe("returned");
      expect(rows[1].returnedAt).toBe("2026-08-05T10:00:00Z");
    });
  });

  describe("createEquipmentRowsForRental", () => {
    it("resolves REAL per-crew catalog ids by category (no phantom seed ids)", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      const insertedRows: any[] = [];
      const rentalsChain = chain({ data: [{ rental_id: "eq-1" }, { rental_id: "eq-2" }], error: null });
      rentalsChain.insert = vi.fn((payload: any) => {
        if (Array.isArray(payload)) insertedRows.push(...payload);
        else insertedRows.push(payload);
        return rentalsChain;
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "rentals") return rentalsChain;
        if (table === "cars")
          return chain({
            data: [
              // seeded ids are slug-suffixed; price lives in cars.daily_price
              { id: "equip-helmet-street-pro-vip-bike", make: "MT", model: "Street Pro", daily_price: 1000, specs: { category: "helmet" } },
              { id: "equip-gloves-summer-x-vip-bike", make: "MT", model: "Summer X", daily_price: 500, specs: { category: "gloves" } },
              { id: "equip-boots-tour-adv-vip-bike", make: "MT", model: "Tour Adv", daily_price: 500, specs: { category: "boots" } },
            ],
            error: null,
          });
        return chain();
      });

      const res = await createEquipmentRowsForRental({
        rentalId: "primary-rental",
        context: { helmets: 2, gloves: true },
        operatorChatId: "op-1",
        crewId: "crew-1",
      });

      expect(res.success).toBe(true);
      expect(res.data?.created).toBeGreaterThanOrEqual(2);
      // helmets×2 + gloves×1 = 3 rows
      expect(insertedRows).toHaveLength(3);
      expect(insertedRows.every((r) => r.vehicle_id.startsWith("equip-"))).toBe(true);
      expect(insertedRows.every((r) => r.metadata.item_type === "equipment")).toBe(true);
      expect(insertedRows.every((r) => r.metadata.primary_rental_id === "primary-rental")).toBe(true);
      // helmet price from cars.daily_price (1000₽), NOT the legacy 200₽ constant
      const helmetRows = insertedRows.filter((r) => r.vehicle_id.includes("helmet"));
      expect(helmetRows).toHaveLength(2);
      expect(helmetRows[0].total_cost).toBe(1000);
    });

    it("returns created:0 when the crew has no equipment catalog", async () => {
      const mockFrom = vi.mocked(supabaseAdmin.from);

      mockFrom.mockImplementation((table: string) => {
        if (table === "rentals")
          return chain({
            data: { rental_id: "primary-rental", agreed_start_date: null, agreed_end_date: null },
            error: null,
          });
        if (table === "cars") return chain({ data: [], error: null });
        return chain();
      });

      const res = await createEquipmentRowsForRental({
        rentalId: "primary-rental",
        context: { helmets: 1 },
        operatorChatId: "op-1",
        crewId: "crew-1",
      });

      expect(res.success).toBe(true);
      expect(res.data?.created).toBe(0);
    });
  });
});
