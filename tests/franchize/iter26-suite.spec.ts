// tests/franchize/iter26-suite.spec.ts
//
// iter26 — four client requests (2026-08-31):
//   1. Build fix: RentalDetailDrawer imported rental-price-split with a wrong
//      relative depth → webpack "Module not found" → iter25 never deployed.
//   2. Profile «Моя работа»: date picker + REAL rentals (was mislabeled
//      shifts) — salary now matches the analytics table view 1:1.
//   3. «Отменить» in the analytics drawer works in ANY state (was a dead
//      button — fell through the action chain).
//   4. Table view: Σ Партнёрам tile + money-cell parser fixes (the live app
//      predates iter25, so «Партнеру» was empty — this suite locks the wiring).

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { toNumber } from "@/app/franchize/[slug]/rentals-analytics/components/lib/csv-money";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// ── 1. Build fix ─────────────────────────────────────────────────────────────

describe("iter26: build fix — rental-price-split import paths", () => {
  it("RentalDetailDrawer imports the split lib via the @/ alias (no ../ counting)", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(src).toContain('from "@/app/franchize/lib/rental-price-split"');
    // The exact bug that broke the Vercel build: 5× ../ resolved to the repo
    // root where franchize/lib does not exist.
    expect(src).not.toContain('"../../../../../franchize/lib/rental-price-split"');
  });

  it("analytics-utils imports the split + economics libs via the @/ alias", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts");
    expect(src).toContain('from "@/app/franchize/lib/rental-price-split"');
    expect(src).toContain('from "@/app/franchize/lib/subrenter-economics"');
  });

  it("the @/ alias target actually exists (rental-price-split + subrenter-economics)", () => {
    expect(fs.existsSync("app/franchize/lib/rental-price-split.ts")).toBe(true);
    expect(fs.existsSync("app/franchize/lib/subrenter-economics.ts")).toBe(true);
  });
});

// ── 2. Profile My Work — date picker + real rentals ─────────────────────────

describe("iter26: profile «Моя работа» date picker + real rental salary", () => {
  it("ProfileClient calls getMyWorkDayAction with the picked date and renders a date input", () => {
    // iter31: «Моя работа» moved into its own self-contained panel component.
    const src = read("app/franchize/[slug]/profile/components/MyWorkPanel.tsx");
    expect(src).toContain("getMyWorkDayAction({ slug, date: workDate })");
    expect(src).toContain('type="date"');
    expect(src).toContain("shiftWorkDate");
    expect(src).toContain("todayMskIso()");
    // The dedicated refetch effect (no full profile reload on date change).
    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]*?workDate === myWork\?\.date/);
    // iter31: the parent mounts the panel.
    const parentSrc = read("app/franchize/[slug]/profile/ProfileClient.tsx");
    expect(parentSrc).toContain("MyWorkPanel");
  });

  it("the cards are correctly labeled: Аренды (ЗП) + Смены as separate cards + Итого за день", () => {
    const src = read("app/franchize/[slug]/profile/components/MyWorkPanel.tsx");
    expect(src).toContain("Аренды (ЗП)");
    expect(src).toContain("myWork.shifts.count");
    expect(src).toContain("Итого за день");
    expect(src).toContain("myWork.rentalDetails");
  });

  it("my-work action computes rental salary with the SAME engine as the analytics CSV", () => {
    const src = read("app/franchize/server-actions/my-work.ts");
    expect(src).toContain("computeRentalSalary");
    expect(src).toContain("resolveRentalOperator");
    expect(src).toContain("standardRentalPrice");
    // Cancelled rentals excluded (same as buildRentalsCsv + calculateSalaryForPeriod).
    expect(src).toContain('.neq("status", "cancelled")');
    // Rentals scoped by START date within the MSK day (same as the sheet).
    expect(src).toContain('.gte("requested_start_date", startOfDay)');
  });

  it("getMyWorkTodayAction remains exported for backward compat", () => {
    const src = read("app/franchize/server-actions/my-work.ts");
    expect(src).toContain("export const getMyWorkTodayAction");
  });
});

// ── 3. Abort rental in any state ─────────────────────────────────────────────

describe("iter26: «Отменить» works from the analytics drawer in ANY state", () => {
  it("AnalyticsClient wires cancel to updateRentalStatus (was a dead fall-through)", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(src).toMatch(/action === "cancel"/);
    expect(src).toContain("cancelSelectedRental");
    expect(src).toMatch(/status: "cancelled"/);
    expect(src).toContain("updateRentalStatus");
    // Confirm before the destructive flip.
    expect(src).toContain("window.confirm");
    // Toast feedback + refresh after success.
    expect(src).toContain("toast.error");
    expect(src).toContain("router.refresh()");
    // Actor identity comes from the parent (V2 passes dbUser / password owner).
    expect(src).toContain("actorUserId");
  });

  it("activate/complete deep-link to the rental page instead of staying dead", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(src).toMatch(/action === "cancel" \|\| action === "activate" \|\| action === "complete"/);
  });

  it("V2 passes the actor identity down", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(src).toContain("actorUserId={dbUser?.user_id ?? passwordAuthOwnerId ?? null}");
  });

  it("updateRentalStatus supports silent mode (data-correction cancels don't spam the renter)", () => {
    const src = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toContain("silent?: boolean");
    // The renter TG notification is gated on !silent.
    expect(src).toContain("if (rental?.user_id && !silent) {");
    expect(src).toContain('msgParts.push("без уведомления арендатору")');
  });

  it("silent data-correction cancels are the default for completed/active rentals in the drawer", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(src).toContain('rental.status === "completed" || rental.status === "active"');
    expect(src).toContain("silent: dataCorrection");
  });
});

// ── 4. Table view — Σ Партнёрам + money-cell parsing ─────────────────────────

describe("iter26: table view partner payouts + money-cell parsing", () => {
  it("Σ Партнёрам tile sums the «Партнеру» column (col 2)", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
    expect(src).toContain("Σ Партнёрам");
    expect(src).toContain('const partnerCol = variant === "rentals" ? 2 : -1;');
    expect(src).toContain("const sumPartner = sumOf(partnerCol, dataRows);");
  });

  describe("toNumber parses the real finance-sheet cell shapes", () => {
    it("plain numbers (ЗП, Цена, Партнеру)", () => {
      expect(toNumber("1600")).toBe(1600);
      expect(toNumber("8000")).toBe(8000);
      expect(toNumber("37 825")).toBe(37825);
    });

    it("deposit cells with a method suffix («15000нал» / «20000ТБанк»)", () => {
      expect(toNumber("15000 нал")).toBe(15000);
      expect(toNumber("20000 ТБанк")).toBe(20000);
    });

    it("equipment cells with qty + parenthesised cost («2шл+перч (800~)»)", () => {
      expect(toNumber("2шл+перч (800~)")).toBe(800);
      expect(toNumber("1шл (1000)")).toBe(1000);
    });

    it("garbage / empty cells → 0", () => {
      expect(toNumber("")).toBe(0);
      expect(toNumber("заряд↔")).toBe(0);
      expect(toNumber("3+2")).toBe(0);
    });
  });
});
