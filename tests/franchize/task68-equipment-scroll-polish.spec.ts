// tests/franchize/task68-equipment-scroll-polish.spec.ts
//
// 2026-10-03 boss polish round:
//   1. Equipment ⇄ subrenter money — the duration-aware gear estimate window
//      must reach EVERY partner-cut surface (computePartnerSplit window param
//      + callers: bike-wall KPI/feed, subrenter-notify, analytics KPI, CSV,
//      drawer). Legacy rows under 24h used to be flat-estimated (helmet
//      1000₽ instead of 500₽) → the partner's 50% was silently underpaid.
//   2. Owner payout sheet — same contract pct as the partner's own panel
//      (was hardcoded default 50).
//   3. Cancel cascade — cancelling a bike rental auto-CANCELS its open gear
//      mirrors (the honda-phantom class), instead of leaving them «Выдан».
//   4. Web-checkout todos — ONE perk-string parser for metadata.equipment AND
//      the return-todo list; pants tracked + pants return todo.
//   5. Map-riders sheet scroll — body capped to the active snap + per-segment
//      scroll restore.
//
// Run: npx vitest run tests/franchize/task68-equipment-scroll-polish.spec.ts

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Thenable chain (same pattern as rental-ops-fixes.spec.ts). */
function chain(result: { data: any; error: any } = { data: null, error: null }) {
  const c: any = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    is: vi.fn(() => c),
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

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(() => chain()),
  rpc: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseAdmin: supabaseMock }));

import { cancelLinkedEquipmentRentals } from "@/app/rentals/rental-cascade";
import { supabaseAdmin } from "@/lib/supabase-server";
import { parsePerkEquipmentFlags } from "@/app/franchize/lib/equipment-shared";
import { computePartnerSplit, splitRentalPrice } from "@/app/franchize/lib/rental-price-split";

const readRepo = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cancel cascade for linked gear mirrors
// ─────────────────────────────────────────────────────────────────────────────

describe("rental-cascade.cancelLinkedEquipmentRentals", () => {
  it("auto-CANCELS (not completes) open gear mirrors of a cancelled bike rental", async () => {
    const updatePayloads: any[] = [];
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "rentals") {
        const c = chain({
          data: [
            { rental_id: "gear-1", status: "active", metadata: { item_type: "equipment", equipment_condition: "Выдан" } },
            { rental_id: "gear-2", status: "confirmed", metadata: { item_type: "equipment" } },
          ],
          error: null,
        });
        const origUpdate = c.update;
        c.update = vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return origUpdate(payload);
        });
        return c;
      }
      return chain();
    });

    const res = await cancelLinkedEquipmentRentals("bike-1", "op-777", { reason: "primary_rental_cancelled" });

    expect(res.closed).toBe(2);
    expect(res.rentalIds).toEqual(["gear-1", "gear-2"]);
    expect(res.error).toBeUndefined();

    for (const p of updatePayloads) {
      // CANCELLED — a trip that never happened must not read as a return.
      expect(p.status).toBe("cancelled");
      expect(p.metadata.auto_closed.reason).toBe("primary_rental_cancelled");
      expect(p.metadata.auto_closed.primary_rental_id).toBe("bike-1");
      expect(p.metadata.auto_closed.by).toBe("op-777");
      expect(p.metadata.item_type).toBe("equipment");
      // No fake «Норм» condition and no fake returned_at on a cancel.
      expect(p.metadata.returned_at).toBeUndefined();
    }
    // Operator-written condition survives; absent condition stays absent.
    expect(updatePayloads[0].metadata.equipment_condition).toBe("Выдан");
    expect(updatePayloads[1].metadata.equipment_condition).toBeUndefined();

    // Pending todos bound to the mirrors are closed.
    expect(supabaseMock.from).toHaveBeenCalledWith("crew_todos");
  });

  it("is a no-op when nothing is linked", async () => {
    supabaseMock.from.mockImplementation(() => chain({ data: [], error: null }));
    const res = await cancelLinkedEquipmentRentals("bike-without-gear", "op-777");
    expect(res.closed).toBe(0);
    expect(res.rentalIds).toEqual([]);
  });

  it("is wired into BOTH cancellation paths (abort + analytics status flip)", () => {
    const abortSrc = readRepo("app/rentals/actions.ts");
    expect(abortSrc).toContain("cancelLinkedEquipmentRentals");
    expect(abortSrc).toContain("primary_rental_cancelled");

    const dashSrc = readRepo("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dashSrc).toContain("cancelLinkedEquipmentRentals");
    expect(dashSrc).toContain('reason: "primary_rental_cancelled"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ONE perk-string parser (metadata.equipment === return todos)
// ─────────────────────────────────────────────────────────────────────────────

describe("parsePerkEquipmentFlags (shared by rental row + todo block)", () => {
  it("parses the multiplication glyph AND latin/cyrillic x", () => {
    expect(parsePerkEquipmentFlags("Шлем × 2, Перчатки").helmets).toBe(2);
    expect(parsePerkEquipmentFlags("Шлем x 3").helmets).toBe(3); // latin x — old todo regex missed it
    expect(parsePerkEquipmentFlags("шлем х 2").helmets).toBe(2); // cyrillic х
  });

  it("falls back to 1 helmet on a bare «шлем» (old todo regex produced 0)", () => {
    expect(parsePerkEquipmentFlags("Со своим шлемом").helmets).toBe(1);
  });

  it("tracks pants (were invisible to the whole web flow)", () => {
    expect(parsePerkEquipmentFlags("Шлем, штаны, перчатки").pants).toBe(true);
    expect(parsePerkEquipmentFlags("Шлем, перчатки").pants).toBe(false);
  });

  it("parses every flag the price table carries", () => {
    const all = parsePerkEquipmentFlags("шлем × 1 перчатки куртка штаны боты сетка рюкзак сумка зарядка");
    expect(all).toEqual({
      helmets: 1,
      gloves: 1,
      jacket: true,
      pants: true,
      boots: true,
      net: true,
      backpack: true,
      bag: true,
      charger: true,
    });
  });

  it("empty/garbage perk → all zero", () => {
    expect(parsePerkEquipmentFlags("")).toEqual({
      helmets: 0, gloves: 0, jacket: false, pants: false, boots: false,
      net: false, backpack: false, bag: false, charger: false,
    });
    expect(parsePerkEquipmentFlags(null).helmets).toBe(0);
  });

  it("actions-runtime uses the shared parser in BOTH sites", () => {
    const src = readRepo("app/franchize/actions-runtime.ts");
    // import + contract builder + rental row + todo block
    const uses = src.split("parsePerkEquipmentFlags").length - 1;
    expect(uses).toBeGreaterThanOrEqual(4);
    // the old divergent inline regexes are gone from the whole flow
    expect(src).not.toContain("шлем\\s*×");
    expect(src).toContain("Принять штаны");
  });

  it("doc-manual creates the pants return todo", () => {
    const src = readRepo("app/webhook-handlers/commands/doc-manual.ts");
    expect(src).toContain("Принять штаны");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Duration-aware window reaches the partner cut everywhere
// ─────────────────────────────────────────────────────────────────────────────

describe("computePartnerSplit duration-aware window", () => {
  const legacyRow = { equipment: { gloves: 1 } }; // no stored equipment_price → estimate path

  it("under 24h estimates gear at HALF price (partner not underpaid)", () => {
    // 10 000 total, gloves only: half-day gear = 250 → bike part 9 750 → cut 4 875.
    const split = computePartnerSplit({
      totalCost: 10000,
      metadata: legacyRow,
      subrenterChatId: "425137783",
      ownerPct: 50,
      window: { startIso: "2026-10-02T12:00:00Z", endIso: "2026-10-02T20:00:00Z" },
    });
    expect(split.equipmentPartRub).toBe(250);
    expect(split.bikePartRub).toBe(9750);
    expect(split.partnerRub).toBe(4875);
  });

  it("flat estimate (no window) stays the backward-compatible default", () => {
    const split = computePartnerSplit({
      totalCost: 10000,
      metadata: legacyRow,
      subrenterChatId: "425137783",
      ownerPct: 50,
    });
    expect(split.equipmentPartRub).toBe(500);
    expect(split.partnerRub).toBe(4750);
  });

  it("stored split wins regardless of the window (exact amounts are the truth)", () => {
    const split = computePartnerSplit({
      totalCost: 7750,
      metadata: { bike_price: 7000, equipment_price: 750, subrenter_chat_id: "425137783" },
      subrenterChatId: "425137783",
      ownerPct: 50,
      window: { startIso: "2026-10-02T12:00:00Z", endIso: "2026-10-03T00:00:00Z" },
    });
    expect(split.equipmentPartRub).toBe(750);
    expect(split.bikePartRub).toBe(7000);
    expect(split.partnerRub).toBe(3500);
  });

  it("standalone gear rows give the partner ZERO even with a window", () => {
    const split = computePartnerSplit({
      totalCost: 3000,
      metadata: { item_type: "equipment" },
      subrenterChatId: "425137783",
      ownerPct: 50,
      window: { startIso: "2026-10-02T12:00:00Z", endIso: "2026-10-03T12:00:00Z" },
    });
    expect(split.bikePartRub).toBe(0);
    expect(split.partnerRub).toBe(0);
    expect(split.equipmentPartRub).toBe(3000);
  });

  it("every money surface passes the window (source pins)", () => {
    const wall = readRepo("app/franchize/server-actions/bike-wall.ts");
    expect(wall.match(/window: \{/g)?.length).toBeGreaterThanOrEqual(2);

    const notify = readRepo("app/franchize/lib/subrenter-notify.ts");
    expect(notify.match(/getEquipmentCostPart\(md, totalCost, \{/g)?.length).toBe(2);

    const drawer = readRepo("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(drawer).toContain("window: {");

    const csv = readRepo("lib/csv-builders/rentals-csv.ts");
    expect(csv).toContain("getEquipmentCostPart(meta, price, {");

    const analytics = readRepo("app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts");
    expect(analytics).toContain("estimateWindow(r)");
  });

  it("owner payout sheet resolves the CONTRACT pct, not a hardcoded 50", () => {
    const src = readRepo("app/franchize/server-actions/subrenter-monitoring.ts");
    expect(src).toContain("const sheetPct = await resolveSubrenterSharePct(crew.id);");
    expect(src).toContain("pct: sheetPct,");
    // The partner panel already resolved the artifact pct — stays green.
    expect(src).toContain("const sharePct = await resolveSubrenterSharePct(crew.id);");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Map-riders sheet scroll fix
// ─────────────────────────────────────────────────────────────────────────────

describe("map-riders sliding sheet scroll", () => {
  const src = () => readRepo("components/map-riders/MapRidersClientRefactored.tsx");

  it("caps the sheet body to the active snap (no dead zone below the screen edge)", () => {
    expect(src()).toContain('maxHeight: `min(82dvh, max(8rem, calc(');
    expect(src()).not.toContain("max-h-[82dvh]"); // the snap-blind cap is gone
  });

  it("restores per-segment scroll positions (wall hidden-toggle no longer leaks scrollTop)", () => {
    expect(src()).toContain("segmentScrollTopRef");
    expect(src()).toContain("ref={sheetBodyRef}");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Split invariants the round must not break
// ─────────────────────────────────────────────────────────────────────────────

describe("split invariants", () => {
  it("bike + gear = total on the stored-split path", () => {
    const s = splitRentalPrice(5750, { bike_price: 5000, equipment_price: 750 });
    expect(s.bikePartRub + s.equipmentPartRub).toBe(5750);
    expect(s.source).toBe("stored");
  });

  it("linked gear mirrors carry zero money in every surface", () => {
    const s = splitRentalPrice(999, { item_type: "equipment", primary_rental_id: "abc" });
    expect(s.totalRub).toBe(0);
    expect(s.bikePartRub).toBe(0);
    expect(s.equipmentPartRub).toBe(0);
    expect(s.source).toBe("linked_inventory");
  });
});
