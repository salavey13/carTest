// Task 163 — sticky-rail SEAMS in the tableview (boss: «sticky columns have
// no border between them … a transparent vertical line one pixel wide through
// which scrolling columns below are visible looking like shimmering»).
//
// Two stacked causes, both pinned here:
//   1. computeRailOffsets returned FRACTIONAL offsets (raw getBoundingClientRect
//      sums, e.g. 87.375px) — adjacent pinned cells painted with independently
//      snapped sub-pixel edges → a ~1px TRANSPARENT slit between them, the
//      sliding columns shimmer through it. Fix: every offset is FLOORED, so
//      each next pinned cell starts AT or LEFT of the previous cell's true
//      edge → rail cells overlap or tile, never gap (the ≤0.5px error becomes
//      an invisible overlap painted over by the later cell's opaque bg).
//   2. border-collapse: collapse — Chromium paints collapsed cell borders at
//      the cell's NATURAL x; a stuck cell (the right rail, whose natural
//      position is the far right of a 25-column sheet) does not carry its
//      collapsed border-r with it → the pinned columns had NO separators.
//      Fix: every rail cell draws its OWN opaque 1px separator via an inset
//      box-shadow (travels with the cell, independent of border painting),
//      and the boundary cell facing the sliding content adds an opaque 1px
//      strip of its own background beyond the box edge.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeRailOffsets,
} from "../../app/franchize/[slug]/rentals-analytics/components/lib/table-rails";

const src = (p: string) => readFileSync(p, "utf8");
const rails = src(
  "app/franchize/[slug]/rentals-analytics/components/lib/table-rails.ts",
);
const modal = src(
  "app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx",
);

describe("task163 · floored rail offsets — no see-through slits between pinned columns", () => {
  it("fractional widths produce INTEGER offsets (no sub-pixel sticky positions)", () => {
    // raw prefix sums would be 0 / 100.4 / 181 — the .4/.6 fractions are what
    // made adjacent pinned cells snap apart into a 1px hole. The recursive
    // floor trades ≤0.5px/step of leftward drift for guaranteed overlap.
    expect(computeRailOffsets([100.4, 80.6, 50.25], 3, 0)).toEqual({
      left: [0, 100, 180],
      right: [],
    });
    expect(computeRailOffsets([30.5, 20.25, 10.125], 0, 3)).toEqual({
      left: [],
      right: [0, 10, 30],
    });
    expect(computeRailOffsets([100.4, 80.6], 1, 1)).toEqual({
      left: [0],
      right: [0],
    });
  });

  it("integer widths keep the exact task137 geometry (re-baseline guard)", () => {
    expect(computeRailOffsets([100, 80, 50, 90], 2, 2)).toEqual({
      left: [0, 100],
      right: [0, 90],
    });
  });

  it("NO-GAP invariant: every next pinned cell starts at or LEFT of the previous cell's true edge", () => {
    // left rail: offset[i+1] ≤ offset[i] + raw width[i]  → overlap, never gap
    const widths = [87.375, 64.125, 91.875, 45.5];
    const { left } = computeRailOffsets(widths, widths.length, 0);
    for (let i = 1; i < left.length; i++) {
      expect(left[i]).toBeLessThanOrEqual(left[i - 1] + widths[i - 1]);
      expect(Number.isInteger(left[i])).toBe(true);
    }
    // right rail mirrors it: offset[j+1] ≤ offset[j] + raw width of the cell to its right
    const { right } = computeRailOffsets(widths, 0, widths.length);
    for (let j = 1; j < right.length; j++) {
      expect(right[j]).toBeLessThanOrEqual(right[j - 1] + widths[widths.length - j]);
      expect(Number.isInteger(right[j])).toBe(true);
    }
  });
});

describe("task163 · rail cells draw their OWN opaque separators", () => {
  it("inset separator shadows — left rail on its right edge, right rail on its left edge", () => {
    // inset shadows are painted by the cell itself and travel with it — they
    // do not depend on collapsed-border painting (which Chromium pins to the
    // cell's natural x, not the stuck x)
    expect(modal).toContain("`inset -1px 0 0 ${T.border}`");
    expect(modal).toContain("`inset 1px 0 0 ${T.border}`");
    // the shadow list keeps the mirrored depth cues
    expect(modal).toContain("`2px 0 4px rgba(0,0,0,${shadowIntensity})`");
    expect(modal).toContain("`-2px 0 4px rgba(0,0,0,${shadowIntensity})`");
  });

  it("boundary cells facing the sliding content cast an opaque bg strip beyond the box edge", () => {
    expect(modal).toContain("const facesContent = di === stickyLeft - 1;");
    expect(modal).toContain("const facesContent = ri === stickyRight - 1;");
    expect(modal).toContain("...(facesContent ? [`1px 0 0 ${bg}`] : [])");
    expect(modal).toContain("...(facesContent ? [`-1px 0 0 ${bg}`] : [])");
  });

  it("the fix is documented at the factory — future passes must not drop it", () => {
    expect(modal).toContain("Task 163 — the boss saw a 1px transparent vertical line");
    expect(rails).toContain("Task 163 — offsets are integers");
    expect(rails).toContain("Math.floor(acc + widths[i])");
    expect(rails).toContain("Math.floor(acc + widths[widths.length - 1 - j])");
  });

  it("both rails still hand the offsets to sticky cells unchanged (wiring intact)", () => {
    expect(modal).toContain("left: rail.left[di]");
    expect(modal).toContain("right: rail.right[ri]");
    expect(modal).toContain("const next = computeRailOffsets(widths, stickyLeft, stickyRight);");
  });
});
