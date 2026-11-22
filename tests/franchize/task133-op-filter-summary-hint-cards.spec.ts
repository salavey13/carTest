// Task 133 — four PC-testing follow-ups on rentals-analytics + the catalog:
//
//   1. Sticky section banner was NARROWER than its table (banner lived at
//      scroll-container width, the table at minWidth:max-content) → scrolling
//      right exposed a bare gap between the pinned banner strip and the thead.
//      Fix: SectionTable stretches (min-w-fit) so the banner covers the table
//      edge-to-edge while pinned.
//   2. Operator pill filter "did nothing" for the boss — the СВОДКА block
//      (and its full-period sums) stayed on screen next to the filtered
//      АРЕНДЫ/ПРОДАЖИ tables. The block has no operator column, so it can't
//      be filtered honestly → it is now HIDDEN while a filter is active.
//   3. Quick-verify ✓ "disappeared after the sticky deploy" — the PC password
//      session (passwordAuthOwnerId) was memory-only; the reload that picked
//      up a fresh deploy wiped it and owner-tier UI vanished. The owner id is
//      now persisted in sessionStorage (per tab; server still re-gates).
//   4. Commission card: «экип 200» on a 2-hour rental with 1 шлем + 1
//      перчатки read as «шлем 200 вместо 100». The lump was CORRECT (2 ед. ×
//      100 ₽/ед, <24h halving) — the card now spells the per-unit math out.
//   5. Catalog PC: the accent hover fill self-rounded (rounded-b-2xl) inside
//      the clipped card → dark corner bites made the highlighted card read
//      narrower; grid cards also got smaller on xl/2xl.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCommissionLines } from "../../app/franchize/lib/commission-card-core";
import type { VerificationCommissionBrief } from "../../app/franchize/[slug]/rentals-analytics/components/types";

const src = (p: string) => readFileSync(p, "utf8");

describe("task133 · SectionTable sticky banner width", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("section stretches to the table width (min-w-fit) — banner covers the table edge-to-edge", () => {
    expect(modal).toContain('<section className="min-w-fit">');
  });

  it("СВОДКА is hidden while an operator filter is active (full-period sums would contradict the filtered tables)", () => {
    expect(modal).toContain(
      'if (s.key === "summary") return { ...s, data: [], totals: null };',
    );
    // inside applyOpFilter, i.e. only when effectiveOpFilter is set
    const fn = modal.slice(
      modal.indexOf("const applyOpFilter ="),
      modal.indexOf("const visibleSections ="),
    );
    expect(fn).toContain('s.key === "summary"');
  });
});

describe("task133 · password-auth session survives reloads (sessionStorage)", () => {
  const v2 = src("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");

  it("owner id is restored from sessionStorage on mount (post-hydration)", () => {
    expect(v2).toContain("analytics-pw-owner:");
    expect(v2).toContain("window.sessionStorage.getItem(analyticsPwStoreKey)");
  });

  it("onAuthenticated writes/clears the stored id — same value the password flow returned", () => {
    expect(v2).toContain("window.sessionStorage.setItem(analyticsPwStoreKey, ownerId)");
    expect(v2).toContain("window.sessionStorage.removeItem(analyticsPwStoreKey)");
    expect(v2).toContain("onAuthenticated={handlePasswordAuthenticated}");
  });
});

describe("task133 · commission card spells the per-unit equipment math", () => {
  const brief = (over: Partial<VerificationCommissionBrief>): VerificationCommissionBrief => ({
    base: 500,
    equipment: 200,
    overprice: 0,
    total: 700,
    totalCost: 5500,
    equipmentUnits: 2,
    ...over,
  });

  it("falcon-gt case: «экип 200» = 2 ед. × 100 ₽/ед + the <24h halving note", () => {
    const lines = buildCommissionLines(
      brief({ formula: { shortRental: true, gearStandard: 750, bikeStandard: 5700, standardTotal: 6450, clientTotal: 5500 } }),
    );
    const commission = lines.find((l) => l.label === "Комиссия оператора");
    expect(commission).toBeTruthy();
    expect(commission!.hint).toContain("2 ед. × 100");
    expect(commission!.hint).toContain("пополам");
    // the lump itself is unchanged — only the explanation is added
    expect(commission!.value).toContain("500");
    expect(commission!.value).toContain("200");
    expect(commission!.value).toContain("700");
  });

  it("multi-day rental: per-unit hint without the halving note", () => {
    const lines = buildCommissionLines(
      brief({ formula: { shortRental: false, standardTotal: 6450, clientTotal: 5500 } }),
    );
    const commission = lines.find((l) => l.label === "Комиссия оператора");
    expect(commission!.hint).toContain("2 ед. × 100");
    expect(commission!.hint).not.toContain("пополам");
  });

  it("no gear / no units → no hint (the line stays as before)", () => {
    const noGear = buildCommissionLines(brief({ equipmentUnits: 0, equipment: 0, total: 500 }));
    expect(noGear.find((l) => l.label === "Комиссия оператора")!.hint).toBeUndefined();
    const noUnits = buildCommissionLines(brief({ equipmentUnits: null }));
    expect(noUnits.find((l) => l.label === "Комиссия оператора")!.hint).toBeUndefined();
  });
});

describe("task133 · catalog cards: hover fill hugs the card silhouette + smaller PC grid", () => {
  const catalog = src("app/franchize/components/CatalogClient.tsx");

  it("no inner rounded-b-2xl on the accent hover fill (grid + carousel cards)", () => {
    expect(catalog).not.toContain('rounded-b-2xl bg-[var(--catalog-card-bg)]');
  });

  it("grid is denser on PC: xl:6 / 2xl:7 columns (was 5/6)", () => {
    expect(catalog).toContain(
      "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7",
    );
    // skeleton grid matches the real one
    expect(catalog).toContain(
      "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7",
    );
  });
});
