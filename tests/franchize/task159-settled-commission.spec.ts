// tests/franchize/task159-settled-commission.spec.ts
//
// TASK159 (boss 2026-10-28) — the verification SETTLEMENT is the single
// truth of operator commission money across every surface. Two halves:
//   1. pure math — settledCommissionOf precedence (real prod rows as cases)
//   2. source pins — every money surface actually consults the settlement
//      (CSV/tableview, profile breakdown, my-work day card, accept-flow
//      snapshot rewrite, password-cookie gate on the rental page).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { settledCommissionOf } from "@/app/franchize/lib/rental-verify-core";
import { splitAmountByFractions } from "@/lib/salary-split";

const src = (p: string) => readFileSync(p, "utf8");

// ── 1. settledCommissionOf — precedence rule ────────────────────────────────

describe("task159 · settledCommissionOf precedence", () => {
  it("no frozen numbers at all → null (live recompute stays in charge)", () => {
    expect(settledCommissionOf({ snapshot: {}, negotiation: {} })).toBeNull();
    expect(settledCommissionOf({ snapshot: null, negotiation: null })).toBeNull();
    expect(settledCommissionOf({})).toBeNull();
  });

  it("plain frozen snapshot → source=snapshot, not adjusted", () => {
    const r = settledCommissionOf({
      snapshot: { base: 1000, equipment: 200, overprice: 0, total: 1200 },
      negotiation: {},
    });
    expect(r).not.toBeNull();
    expect(r!.total).toBe(1200);
    expect(r!.base).toBe(1000);
    expect(r!.adjusted).toBe(false);
    expect(r!.source).toBe("snapshot");
  });

  it("stale agreed loses to the newer correction (Boulevard 19.10: fc5bc7fe)", () => {
    // deal settled 1000 ₽ on 19.10, boss corrected the snapshot to 375 on 28.10
    const r = settledCommissionOf({
      snapshot: {
        base: 375, equipment: 0, overprice: 0, total: 375,
        correction: { at: "2026-10-28T14:00:00Z" },
      },
      negotiation: {
        agreed: {
          split: { base: 1000, equipment: 0, overprice: 0 },
          at: "2026-10-19T18:00:00Z",
        },
      },
    });
    expect(r!.total).toBe(375);
    expect(r!.source).toBe("snapshot");
    expect(r!.adjusted).toBe(true);
  });

  it("accepted дил newer than the correction wins (Boulevard 17.10: 9991969f → 0 ₽)", () => {
    const r = settledCommissionOf({
      snapshot: {
        base: 375, equipment: 0, overprice: 0, total: 375,
        correction: { at: "2026-10-28T15:00:00Z" },
      },
      negotiation: {
        agreed: {
          split: { base: 0, equipment: 0, overprice: 0 },
          at: "2026-10-28T17:18:50Z",
          proposedBy: "356282674",
          acceptedBy: "7813830016",
        },
      },
    });
    expect(r!.total).toBe(0);
    expect(r!.source).toBe("agreed");
    expect(r!.adjusted).toBe(true);
  });

  it("snapshot with numbers but a stale/absent total → total recomputed from parts", () => {
    const r = settledCommissionOf({
      snapshot: { base: 500, equipment: 250, overprice: 50 },
      negotiation: {},
    });
    expect(r!.total).toBe(800);
  });

  it("negative agreed parts clamp to 0 (a deal can only reduce to zero, not below)", () => {
    const r = settledCommissionOf({
      snapshot: { base: 900, equipment: 0, overprice: 0, total: 900 },
      negotiation: {
        agreed: { split: { base: -500, equipment: 0, overprice: 0 }, at: "2026-10-28T20:00:00Z" },
      },
    });
    expect(r!.total).toBe(0);
    expect(r!.source).toBe("agreed");
  });
});

// ── 2. splitAmountByFractions on the settled total ───────────────────────────

describe("task159 · settled total × fractions = exact rubles", () => {
  it("2/3+1/3 of a settled 1000 ₽ (short rental halves make odd totals)", () => {
    const amounts = splitAmountByFractions(1001, [{ n: 2, d: 3 }, { n: 1, d: 3 }]);
    expect(amounts[0] + amounts[1]).toBe(1001);
    expect(amounts).toEqual([667, 334]); // remainder to the largest share
  });

  it("1/2+1/2 of 900 ₽ — the CBR600RR correction split two ways", () => {
    expect(splitAmountByFractions(900, [{ n: 1, d: 2 }, { n: 1, d: 2 }])).toEqual([450, 450]);
  });
});

// ── 3. source pins — every money surface consults the settlement ────────────

describe("task159 · money surfaces use the settlement", () => {
  it("CSV/tableview: settled numbers replace the live recompute in the salary cells", () => {
    const s = src("lib/csv-builders/rentals-csv.ts");
    expect(s).toContain('?.settled ?? null');
    expect(s).toContain("base: settled.base");
    expect(s).toContain("blockRentals.salary += salary.total");
    // the «Верификация» column flags corrections with the settled total
    expect(s).toContain("brief.settled?.adjusted");
    expect(s).toContain("скорректировано (");
  });

  it("profile breakdown: settled (or legacy agreed) × the member's fraction", () => {
    const s = src("app/franchize/lib/salary-category-bonuses.ts");
    expect(s).toContain("brief?.settled ?? null");
    expect(s).toContain("splitAmountByFractions(parts.total, allFractions)[shareIndex]");
  });

  it("my-work day card: settled override after the live split", () => {
    const s = src("app/franchize/server-actions/my-work.ts");
    expect(s).toContain("?.settled ?? null");
    expect(s).toContain("rentalsSalary += mySettled - d.salary");
  });

  it("payout hub: commissionOf delegates to settledCommissionOf", () => {
    const s = src("app/franchize/lib/rental-payout-core.ts");
    expect(s).toContain("const settled = settledCommissionOf(row);");
  });

  it("accept flow rewrites the frozen snapshot with the deal (no phantom marker when equal)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("rewrittenSnapshot");
    expect(s).toContain("dealSameAsFrozen");
    expect(s).toMatch(/snapshot: rewrittenSnapshot,/);
  });

  it("status map carries the settlement to every consumer", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("com_corr_at:snapshot->correction->at");
    expect(s).toMatch(/return settled \? \{ settled \} : \{\};/);
  });

  it("analytics drawer badge fires for corrected snapshots too", () => {
    const s = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(s).toContain("settled?.adjusted === true");
  });

  it("password session: signed cookie set on validate + gated render on the rental page", () => {
    expect(src("app/franchize/lib/analytics-owner-cookie.ts")).toContain("timingSafeEqual");
    const dash = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dash).toContain("buildAnalyticsOwnerCookieValue");
    // TASK161 re-baseline: the cookie name is now PER-CREW (a second crew's
    // password used to overwrite the first session — the PC сверка card for
    // the earlier crew silently vanished mid-day).
    expect(dash).toContain("analyticsOwnerCookieName(String(result.slug))");
    const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).toContain("resolveAnalyticsPasswordOwnerForSlug(resolvedSlug)");
    expect(page).toContain("passwordAuthOwnerId={passwordAuthOwnerId}");
  });

  it("subrent canon covers the three bikes found by the audit", () => {
    const s = src("lib/salary-coefficients-shared.ts");
    expect(s).toContain('"yamaha-r6-2007"');
    expect(s).toContain('"ducati-1199-panigale-2012"');
    expect(s).toContain('"ducati-panigale-s-electro-green"');
  });
});
