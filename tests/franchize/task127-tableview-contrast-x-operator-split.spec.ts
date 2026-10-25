// Task 127 — table view modal polish:
//   1. Theme-proof verification row tints (dark theme no longer washes out:
//      the tint mixes the tone color into the THEME bg instead of hardcoded
//      pastels; dark theme gets brighter tone text).
//   2. The modal panel clears the TG fullscreen native buttons — the header
//      «x» moves below the overlapped top-right corner.
//   3. Per-operator commission split: when ≥2 operators carry ЗП, the modal
//      shows who has how much of the total (+ %), and rows wear the
//      operator's stable emoji marker.
//
// Layers pinned here:
//   • Pure: hashString / operatorIconOf / operatorColorOf / buildOperatorSplit.
//   • Wiring: SECTION_COLS opCol (22 rentals / 6 sales) → split over the
//     visible sections → pills; row markers on the date + op cells.
//   • Theme: color-mix tint derivation + VER_TONE_FG_DARK + isDark threading
//     AnalyticsClientV2 → AnalyticsClient → ExportCsvModal → SectionTable.
//   • Safe top: useTelegramContentSafeTop → panel paddingTop.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

import {
  OPERATOR_COLORS,
  OPERATOR_ICONS,
  buildOperatorSplit,
  hashString,
  operatorColorOf,
  operatorIconOf,
} from "@/app/franchize/[slug]/rentals-analytics/components/lib/operator-split";

// ── 1. Pure: operator identity is STABLE (no randomness) ────────────────────

describe("task127 · operator identity (hash → icon + color)", () => {
  it("djb2 hash is stable and deterministic", () => {
    expect(hashString("@djorudjov")).toBe(hashString("@djorudjov"));
    expect(hashString("")).toBe(5381);
    // sanity: different labels hash differently (collision-free on real names)
    expect(hashString("@djorudjov")).not.toBe(hashString("@salavey13"));
  });

  it("icon + color always come from the palette and never drift per label", () => {
    for (const label of ["@djorudjov", "Иван Смирнов", "7813830016", "x", "🦖"]) {
      expect(OPERATOR_ICONS).toContain(operatorIconOf(label));
      expect(OPERATOR_COLORS).toContain(operatorColorOf(label));
    }
    // stable across repeated calls
    expect(operatorIconOf("@a")).toBe(operatorIconOf("@a"));
    expect(operatorColorOf("@a")).toBe(operatorColorOf("@a"));
  });

  it("palettes are long enough to keep a crew visually distinguishable", () => {
    expect(OPERATOR_ICONS.length).toBeGreaterThanOrEqual(8);
    expect(OPERATOR_COLORS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(OPERATOR_ICONS).size).toBe(OPERATOR_ICONS.length);
    expect(new Set(OPERATOR_COLORS).size).toBe(OPERATOR_COLORS.length);
  });
});

// ── 2. Pure: the split math ──────────────────────────────────────────────────

describe("task127 · buildOperatorSplit", () => {
  it("groups by label, sorts by amount desc, computes share of the grand total", () => {
    const split = buildOperatorSplit(
      [
        { label: "@a", amount: 3000 },
        { label: "@b", amount: 14000 },
        { label: "@a", amount: 1000 },
        { label: "@b", amount: 500 },
      ],
      18500,
    );
    expect(split.map((o) => o.label)).toEqual(["@b", "@a"]);
    expect(split[0].amount).toBe(14500);
    expect(split[1].amount).toBe(4000);
    expect(split[0].share).toBeCloseTo(14500 / 18500, 10);
    expect(split[1].share).toBeCloseTo(4000 / 18500, 10);
  });

  it("skips empty labels (unattributed rows) and guards a zero grand total", () => {
    const split = buildOperatorSplit(
      [
        { label: "", amount: 100 },
        { label: "   ", amount: 200 },
        { label: "@a", amount: 700 },
      ],
      0,
    );
    expect(split).toHaveLength(1);
    expect(split[0].share).toBe(0);
  });

  it("ties sort by label so the pill order never flickers", () => {
    const split = buildOperatorSplit(
      [
        { label: "@zeta", amount: 500 },
        { label: "@alpha", amount: 500 },
      ],
      1000,
    );
    expect(split.map((o) => o.label)).toEqual(["@alpha", "@zeta"]);
  });

  it("tolerates junk amounts without NaN-ing the whole split", () => {
    const split = buildOperatorSplit(
      [
        { label: "@a", amount: Number.NaN },
        { label: "@a", amount: 800 },
      ],
      800,
    );
    expect(split[0].amount).toBe(800);
  });
});

// ── 3. Modal wiring ─────────────────────────────────────────────────────────

describe("task127 · ExportCsvModal operator split wiring", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("opCol mapped to the builder's attribution columns (22 rentals / 6 sales)", () => {
    expect(modal).toContain("opCol: 22,");
    expect(modal).toContain("opCol: 6,");
  });

  it("split sums the ЗП column (col 1) over the PRE-op-filter sections (task128: pills stay tappable while filtered)", () => {
    expect(modal).toContain("entries.push({ label, amount: toNumber(r[1] || \"\") });");
    expect(modal).toContain("return buildOperatorSplit(entries, opGrandTotal);");
    expect(modal).toContain("const opGrandTotal = sumCell(rentPre, 1) + sumCell(salesPre, 1);");
  });

  it("pills render only when ≥2 operators share the period", () => {
    expect(modal).toContain("const showOpSplit = opSplit.length >= 2;");
  });

  it("unattributed ЗП is surfaced so pills reconcile against the Σ ЗП tile", () => {
    expect(modal).toContain("opUnattributed");
    expect(modal).toContain("без атрибуции");
  });

  it("rows carry the operator marker on the sticky date cell + the op cell", () => {
    expect(modal).toContain("const opMeta = opLabel");
    // task137 renamed the SectionTable loop vars (ci → di display / dataIdx
    // data) for the sticky-rail remap — the marker still rides the date cell
    // (display 0) and the «Оператор (ЗП)» cell.
    expect(modal).toContain("opMeta && (di === 0 || dataIdx === cfg.opCol)");
    expect(modal).toContain("operatorIconOf(opLabel)");
    expect(modal).toContain("operatorColorOf(opLabel)");
  });
});

// ── 4. Theme-proof verification tints ───────────────────────────────────────

describe("task127 · dark-theme contrast fix", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("row tints derive from the THEME bg (color-mix) — no hardcoded pastels", () => {
    expect(modal).toContain("const verToneBg = (tone: Exclude<VerTone, null>, base: string)");
    expect(modal).toMatch(/color-mix\(in srgb, \$\{VER_TONE_FG\[tone\]\} \$\{VER_TONE_TINT_PCT\[tone\]\}%, \$\{base\}\)/);
    // the washed-out pastels are gone
    expect(modal).not.toContain("#e7f6ec");
    expect(modal).not.toContain("#fde9e9");
    expect(modal).not.toContain("#fdf3e0");
  });

  it("dark theme gets brighter tone text (FG_DARK palette + verToneFg router)", () => {
    expect(modal).toContain("VER_TONE_FG_DARK");
    expect(modal).toContain('verified: "#4ade80"');
    expect(modal).toContain('disputed: "#f87171"');
    expect(modal).toContain('waiting: "#fbbf24"');
    expect(modal).toContain("verToneFg(verTone, isDark)");
  });

  it("isDark threads V2 → AnalyticsClient → modal → SectionTable", () => {
    const v2 = src("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    const client = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(v2).toContain("isDark={!themeArgs.isLightTheme}");
    expect(client).toContain("isDark?: boolean;");
    expect(modal).toContain("isDark?: boolean;");
    expect(modal).toMatch(/isDark=\{isDark\}/);
    expect(modal).toMatch(/showOpMarkers=\{showOpMarkers\}/);
  });
});

// ── 5. TG fullscreen safe top ───────────────────────────────────────────────

describe("task127 · the «x» clears the TG native buttons", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("panel pads by the app-wide TG content-safe-top measurement", () => {
    expect(modal).toContain('import { useTelegramContentSafeTop } from "@/app/franchize/hooks/useTelegramContentSafeTop";');
    expect(modal).toContain("const tgSafeTop = useTelegramContentSafeTop();");
    expect(modal).toContain("...(tgSafeTop > 0 ? { paddingTop: `${tgSafeTop}px` } : {}),");
  });

  it("still exactly one close button in the modal shell (task126 pin)", () => {
    expect(modal.match(/aria-label="Закрыть"/g)?.length).toBe(1);
  });

  it("the hook itself measures contentSafeAreaInset with the 54px mobile floor", () => {
    const hook = src("app/franchize/hooks/useTelegramContentSafeTop.ts");
    expect(hook).toContain("contentSafeAreaInset");
    expect(hook).toContain("TG_FULLSCREEN_TOP_FALLBACK_PX = 54");
  });
});
