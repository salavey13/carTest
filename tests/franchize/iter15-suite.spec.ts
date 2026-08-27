// tests/franchize/iter15-suite.spec.ts
//
// iter15 regression tests:
//   1. RentalDepositTracker: pending rentals show «не получен» (awaiting),
//      not the misleading «получен при выдаче»
//   2. Web-order artifact inserts carry crew_slug (NOT NULL!) + phones
//   3. Order notification links are t.me Mini App deep links
//   4. getFranchizeRentalCard: metadata/specs fallbacks for phone/odometer/deposit
//   5. Sales dashboard exposes buyer_phone + storage context
//   6. Pickup-freeze form prefills the odometer from bike specs
//   7. Sale notes are stored in lead_notes under the "sale:" namespace

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

vi.mock("@/app/rentals/actions", () => ({
  saveRentalPickupFreeze: vi.fn(async () => ({ success: true })),
  addRentalDamageReport: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/contexts/AppContext", () => ({
  useAppContext: () => ({ dbUser: null, userCrewMemberships: [] }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const RUNTIME_SRC = readFileSync(join(process.cwd(), "app/franchize/actions-runtime.ts"), "utf8");

// ── 1. Deposit tracker states ─────────────────────────────────────────────────

import { getDepositState, DEPOSIT_STATE_CONFIG } from "@/app/franchize/lib/deposit-state";

describe("iter15: RentalDepositTracker deposit states (pure getDepositState)", () => {

  it("pending_confirmation → awaiting («не получен»), NOT the misleading «получен при выдаче»", () => {
    expect(getDepositState("pending_confirmation", null)).toBe("awaiting");
    expect(getDepositState("confirmed", undefined)).toBe("awaiting");
  });

  it("active → active («получен при выдаче»)", () => {
    expect(getDepositState("active", null)).toBe("active");
  });

  it("completed splits into returned / withheld / unknown", () => {
    expect(getDepositState("completed", true)).toBe("returned");
    expect(getDepositState("completed", false)).toBe("withheld");
    expect(getDepositState("completed", null)).toBe("unknown");
  });

  it("DEPOSIT_STATE_CONFIG carries the awaiting label", () => {
    expect(DEPOSIT_STATE_CONFIG.awaiting.label).toBe("не получен — внесите при выдаче");
    expect(DEPOSIT_STATE_CONFIG.active.label).toBe("получен при выдаче");
    expect(DEPOSIT_STATE_CONFIG.returned.label).toContain("возвращён");
  });

  it("renders nothing without a deposit amount (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/components/RentalDepositTracker.tsx"), "utf8");
    expect(src).toContain("if (!depositRub || depositRub <= 0) return null;");
  });
});

// ── 2. Artifact insert columns (source invariants) ────────────────────────────

describe("iter15: web-order artifact inserts (crew_slug NOT NULL + phones)", () => {
  it("rental artifact insert includes crew_slug + renter_phone", () => {
    const block = RUNTIME_SRC.slice(
      RUNTIME_SRC.indexOf('.from("rental_contract_artifacts")\n            .insert({'),
      RUNTIME_SRC.indexOf(".from(\"rental_contract_artifacts\")\n            .insert({") + 2400,
    );
    expect(block).toContain("crew_slug: payload.slug");
    expect(block).toContain("renter_phone: payload.phone");
  });

  it("sale artifact insert includes crew_slug + buyer_phone", () => {
    const block = RUNTIME_SRC.slice(
      RUNTIME_SRC.indexOf('.from("sale_contract_artifacts")\n            .insert({'),
      RUNTIME_SRC.indexOf(".from(\"sale_contract_artifacts\")\n            .insert({") + 2400,
    );
    expect(block).toContain("crew_slug: payload.slug");
    expect(block).toContain("buyer_phone: payload.phone");
  });

  it("rental row metadata stores the REAL deposit from bike specs (not the hold)", () => {
    const block = RUNTIME_SRC.slice(
      RUNTIME_SRC.indexOf("── iter15: real deposit + payment split for the rental row"),
      RUNTIME_SRC.indexOf("── iter15: real deposit + payment split for the rental row") + 3000,
    );
    expect(block).toContain("specs.deposit_rub");
    expect(block).toContain("payload.depositAmount is the CREW RESERVATION HOLD");
  });
});

// ── 3. Notification deep links ────────────────────────────────────────────────

describe("iter15: order notification uses Mini App deep links", () => {
  it("rentals link → t.me/<bot>/app?startapp=analytics_rentals_<date>", () => {
    expect(RUNTIME_SRC).toContain("analytics_rentals_${deepLinkDate}");
    expect(RUNTIME_SRC).toContain("https://t.me/${botUsername}/app?startapp=");
  });

  it("no raw site-url rental links remain in the notification builder", () => {
    expect(RUNTIME_SRC).not.toContain("${siteUrl}/franchize/${payload.slug}/rentals");
    expect(RUNTIME_SRC).not.toContain("${siteUrl}/franchize/${payload.slug}/leads");
  });
});

// ── 4. Rental card fallbacks ──────────────────────────────────────────────────

describe("iter15: getFranchizeRentalCard fallbacks (no-artifact web orders)", () => {
  it("phone + name fall back to rentals.metadata", () => {
    const block = RUNTIME_SRC.slice(
      RUNTIME_SRC.indexOf("── iter15 fallbacks for web-order rentals WITHOUT an artifact row"),
      RUNTIME_SRC.indexOf("── iter15 fallbacks for web-order rentals WITHOUT an artifact row") + 1800,
    );
    expect(block).toContain("metadata?.renter_phone");
    expect(block).toContain("metadata?.renter_name");
    expect(block).toContain("specsOdometer");
    expect(block).toContain("specsDepositRub");
  });
});

// ── 5. Sales dashboard columns ────────────────────────────────────────────────

describe("iter15: sales dashboard exposes phone + doc storage context", () => {
  const dashSrc = readFileSync(join(process.cwd(), "app/franchize/server-actions/rentals-dashboard.ts"), "utf8");

  it("getSalesDashboard selects buyer_phone + delivery + storage_path", () => {
    const block = dashSrc.slice(dashSrc.indexOf('from("sale_contract_artifacts")'), dashSrc.indexOf('from("sale_contract_artifacts")') + 700);
    expect(block).toContain("buyer_phone");
    expect(block).toContain("storage_path");
    expect(block).toContain("delivery_method");
  });

  it("SaleDashboardItem type carries the new fields", () => {
    const block = dashSrc.slice(dashSrc.indexOf("export interface SaleDashboardItem"), dashSrc.indexOf("export interface SaleDashboardSummary"));
    expect(block).toContain("buyer_phone: string | null");
    expect(block).toContain("storage_path: string | null");
  });
});

// ── 6. Pickup-freeze odometer prefill from specs ──────────────────────────────

describe("iter15: pickup-freeze odometer prefill (source invariants)", () => {
  it("FranchizeRentalDocumentsPanel accepts specsOdometerKm as the terminal prefill fallback", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/components/FranchizeRentalDocumentsPanel.tsx"), "utf8");
    expect(src).toContain("specsOdometerKm?: number | null;");
    expect(src).toContain("спецификация байка (каталог)");
    expect(src).toContain("Пробег подставлен автоматически");
    // the prefill chain: freeze → last_known/hint → specs
    const freeze = src.indexOf("const freezeOdo = Number(");
    const lastKnown = src.indexOf("const lastKnown = Number(metadata?.last_known_odometer");
    const specs = src.indexOf("if (specsOdometerKm != null");
    expect(freeze).toBeGreaterThan(-1);
    expect(lastKnown).toBeGreaterThan(freeze);
    expect(specs).toBeGreaterThan(lastKnown);
  });

  it("the rental page wires specsOdometer/specsDepositRub into odometer + deposit chains", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/[slug]/rental/[id]/page.tsx"), "utf8");
    expect(src).toContain("?? rental.specsOdometer");
    expect(src).toContain("?? rental.artifactDepositRub");
    expect(src).toContain("?? rental.specsDepositRub");
    expect(src).toContain("specsOdometerKm={rental.specsOdometer}");
  });
});

// ── 7. Sale notes namespace ───────────────────────────────────────────────────

describe("iter15: sale notes live in lead_notes under the sale: namespace", () => {
  it("getSaleDetails + addSaleNote key notes by contract", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/server-actions/sale-details.ts"), "utf8");
    expect(src.match(/sale:\$\{/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain(".from(\"lead_notes\")");
    // never queries real lead ids — only the prefixed namespace
    expect(src).not.toContain(".eq(\"lead_id\", saleId)");
  });
});
