// Task 137 — table view modal, round three (boss: "Table is so wide that by
// the time you sidescroll to the right you forget what the beginning was"):
//   1. Sticky LEFT rail = Дата + Марка — the bike id column moves to display
//      position 2 and pins with the date. Row context («when + which bike»)
//      never scrolls away.
//   2. Sticky RIGHT rail = Оператор выдал / Оператор принял / Верификация —
//      the activation/finalization columns move to the END, right before the
//      owner-tier quick-verify column; all three pin to the right edge.
//      Only the middle of the table scrolls.
//   3. The modal goes FULLSCREEN on PC (the old max-w-7xl + 88vh + p-4 box
//      wasted screen real estate) and the table font drops 13px → 12px
//      (text-xs) for density.
//
// Layers pinned here:
//   • RENTALS_DISPLAY_ORDER — the remap is a permutation of 0..24 with the
//     rails at the edges (unit-tested directly).
//   • computeRailOffsets — measured rail geometry (prefix/suffix sums,
//     clamped) (unit-tested directly).
//   • Wiring: cfg.order/stickyLeft/stickyRight → SectionTable render loops
//     (display order vs DATA-space cfg lookups), ResizeObserver measurement,
//     opaque composite rail backgrounds, mirror shadows.
//   • Fullscreen shell + compact font.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeRailOffsets,
  RENTALS_DISPLAY_ORDER,
} from "../../app/franchize/[slug]/rentals-analytics/components/lib/table-rails";

const src = (p: string) => readFileSync(p, "utf8");
const modal = src(
  "app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx",
);

describe("task137 · АРЕНДЫ display-order remap (bike id + operator tail)", () => {
  it("remap is a permutation of all 25 data indexes — nothing lost, nothing duplicated", () => {
    expect(RENTALS_DISPLAY_ORDER).toHaveLength(25);
    expect([...RENTALS_DISPLAY_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i),
    );
  });

  it("LEFT rail: Дата (0) first, Марка (bike id, 6) second", () => {
    expect(RENTALS_DISPLAY_ORDER[0]).toBe(0);
    expect(RENTALS_DISPLAY_ORDER[1]).toBe(6);
  });

  it("RIGHT rail: Оператор выдал (20) / принял (21) at the tail, right before Верификация (24, last)", () => {
    const tail = RENTALS_DISPLAY_ORDER.slice(-3);
    expect(tail).toEqual([20, 21, 24]);
  });

  it("the remap is DISPLAY-ONLY — op split / quick verify / notes / photos cfg lookups stay in data space", () => {
    // SECTION_COLS.rentals keeps the RAW data indexes...
    expect(modal).toContain("verification: 24,");
    expect(modal).toContain("opCol: 22,");
    expect(modal).toContain("notes: 11,");
    expect(modal).toContain("photos: 13,");
    // ...and the render loops compare cfg against dataIdx, not the display position
    expect(modal).toContain("dataIdx === cfg.verification");
    expect(modal).toContain("dataIdx === cfg.opCol");
    expect(modal).toContain("dataIdx === cfg.notes");
    expect(modal).toContain("dataIdx === cfg.photos");
  });
});

describe("task137 · measured sticky rails", () => {
  it("computeRailOffsets: left prefix sums, right suffix sums", () => {
    expect(computeRailOffsets([100, 80, 50, 90], 2, 0)).toEqual({
      left: [0, 100],
      right: [],
    });
    // right[0] = 0 — the RIGHTMOST column hugs the edge; the second-from-
    // right sits left of it by the rightmost column's width (90).
    expect(computeRailOffsets([100, 80, 50, 90], 0, 2)).toEqual({
      left: [],
      right: [0, 90],
    });
    expect(computeRailOffsets([100, 80, 50, 90], 1, 1)).toEqual({
      left: [0],
      right: [0],
    });
    expect(computeRailOffsets([100, 80, 50, 90], 2, 2)).toEqual({
      left: [0, 100],
      right: [0, 90],
    });
  });

  it("computeRailOffsets clamps to the available column count (short/legacy sheets)", () => {
    expect(computeRailOffsets([100, 80], 5, 5)).toEqual({
      left: [0, 100],
      right: [0, 80],
    });
    expect(computeRailOffsets([], 2, 2)).toEqual({ left: [], right: [] });
  });

  it("the modal MEASURES the rendered header row (auto layout can't be guessed)", () => {
    expect(modal).toContain("computeRailOffsets(");
    expect(modal).toContain("getBoundingClientRect().width");
    expect(modal).toContain("new ResizeObserver(measure)");
    // measurement re-runs when the <table> (re)mounts — loading/error swap it out
    expect(modal).toContain(
      "const [tableEl, setTableEl] = useState<HTMLTableElement | null>(null);",
    );
    expect(modal).toContain("ref={setTableEl}");
  });

  it("both rails are wired in SECTION_COLS — rentals only (2 left / 3 right), others default 1/0", () => {
    expect(modal).toContain("order: RENTALS_DISPLAY_ORDER,");
    expect(modal).toContain("stickyLeft: 2,");
    expect(modal).toContain("stickyRight: 3,");
    // defaults keep the classic single sticky date column on ЭКИП/СЕРВИС/ПРОДАЖИ/СВОДКА
    expect(modal).toContain("const stickyLeftRaw = cfg.stickyLeft ?? 1;");
    expect(modal).toContain("const stickyRightRaw = cfg.stickyRight ?? 0;");
  });

  it("display order is guarded — a short/legacy sheet can't render phantom columns", () => {
    expect(modal).toContain(
      "cfg.order.filter((i) => i < section.header.length)",
    );
  });

  it("rail cells are sticky, opaque-composited (dark-theme bleed-proof) with mirrored shadows", () => {
    // sticky on both sides...
    expect(modal).toContain('position: "sticky"');
    expect(modal).toContain("left: rail.left[di]");
    expect(modal).toContain("right: rail.right[ri]");
    // ...left rail shadows right, right rail shadows left
    expect(modal).toContain("boxShadow: `2px 0 4px rgba(0,0,0,${shadowIntensity})`");
    expect(modal).toContain("boxShadow: `-2px 0 4px rgba(0,0,0,${shadowIntensity})`");
    // opaque composite = the tint stacked over the scroll container's own bg
    expect(
      modal.match(
        /linear-gradient\(\$\{bg\}, \$\{bg\}\), linear-gradient\(\$\{T\.bg\}, \$\{T\.bg\}\)/g,
      )?.length,
    ).toBe(2);
  });

  it("all three cell families get the rails — thead, tbody, tfoot", () => {
    expect(modal).toContain("...railCellStyle(di, T.bgElevated, \"0.08\")"); // thead
    expect(modal).toContain("...railCellStyle(di, rowBg, \"0.06\")"); // tbody
    expect(modal.match(/railCellStyle\(di,/g)?.length).toBe(3); // + tfoot
  });

  it("rails are a PC affordance — below lg the table degrades to the sticky date column", () => {
    // on a 390px phone the two rails (~290px + ~600px) would cover the whole table
    expect(modal).toContain("function useMinWidth(px: number): boolean");
    expect(modal).toContain("const railsOn = useMinWidth(1024);");
    expect(modal).toContain("const stickyLeft = railsOn ? stickyLeftRaw : 1;");
    expect(modal).toContain("const stickyRight = railsOn ? stickyRightRaw : 0;");
  });
});

describe("task137 · fullscreen PC modal + compact table", () => {
  it("the panel is truly fullscreen on PC — no max-w-7xl / 88vh / sm padding / rounding", () => {
    expect(modal).toContain(
      "fixed inset-0 z-[70] flex items-stretch justify-center bg-black/60 backdrop-blur-sm",
    );
    expect(modal).toContain(
      "flex h-full w-full flex-col border shadow-2xl overflow-hidden",
    );
    expect(modal).not.toContain("sm:max-h-[88vh]");
    expect(modal).not.toContain("sm:max-w-7xl");
    expect(modal).not.toContain("sm:rounded-2xl");
    // (the header block keeps its own p-3 sm:p-4 padding — that's content
    // padding, not the modal inset)
  });

  it("tables drop to text-xs everywhere (13px → 12px, denser rows)", () => {
    expect(modal).not.toContain("sm:text-[13px]");
    expect(modal.match(/w-full border-collapse text-left text-xs"/g)?.length).toBe(2);
  });
});
