// tests/franchize/task195-catalog-touch-highlight-month-quick-select.spec.ts
//
// task195 (boss, 2026-11-20 — mobile screenshots of the franchize catalog):
//   1. ACTIVE CARD HIGHLIGHT — the tapped/highlighted card on a phone showed
//      black «in anticipation» title/price over a DARK card: Tailwind
//      group-hover text/CTA flips fire on touch (and :hover sticks), but
//      every BACKGROUND layer (article var flip, info strip md:group-hover,
//      photo wash hidden md:block, melt gradient) was @media(min-width:768px)
//      gated. Fix: hover/active/focus-within drive the accent fill at EVERY
//      width — the boss wants the old mobile highlight (accent bg + gradient)
//      back, sticky hover included.
//   2. BONUS — quick recent-month selector in the rentals/sales tableview:
//      one icon button next to the date pickers (visible in BOTH expanded and
//      collapsed controls), tap a month → from = 1st day, to = last day,
//      persisted through the same writeStoredTableRange path.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRecentMonths } from "@/app/franchize/[slug]/rentals-analytics/lib/recent-months";

const repo = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(repo, p), "utf8");

const css = read("app/globals.css");
const catalog = read("app/franchize/components/CatalogClient.tsx");
const modal = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

describe("task195 · catalog active-card highlight on touch", () => {
  it("card background var flip: hover/active/focus-within at EVERY width", () => {
    expect(css).toContain(
      "[data-catalog-item]:hover,\n  [data-catalog-item]:active,\n  [data-catalog-item]:focus-within {",
    );
    expect(css).toContain("--card-base-bg: var(--catalog-accent,#d99a00)");
    expect(css).toContain("--card-base-img: none");
    // the old touch exclusion is gone — no min-width gate around the flip
    expect(css).not.toContain("@media (min-width: 768px) {\n    [data-catalog-item]:hover {");
  });

  it("melt gradient follows the same states (the accent gradient is back on touch)", () => {
    expect(css).toContain("[data-catalog-item]:hover .catalog-melt");
    expect(css).toContain("[data-catalog-item]:active .catalog-melt");
    expect(css).toContain("[data-catalog-item]:focus-within .catalog-melt");
  });

  it("spec balloons flip on the same states", () => {
    expect(css).toContain("[data-catalog-item]:hover .catalog-spec-chip");
    expect(css).toContain("[data-catalog-item]:active .catalog-spec-chip");
    expect(css).toContain("[data-catalog-item]:focus-within .catalog-spec-chip");
  });

  it("photo wash + info strip are ungated (was hidden md:block / md:group-hover)", () => {
    expect(catalog).toContain("group-hover:opacity-30");
    expect(catalog).not.toContain("hidden bg-[var(--catalog-accent");
    expect(catalog).not.toContain("md:group-hover:bg-[var(--catalog-accent,#d99a00)]");
    expect(catalog).toContain("group-hover:bg-[var(--catalog-accent,#d99a00)]");
  });
});

describe("task195 · quick recent-month selector (tableview)", () => {
  it("icon button + dropdown rendered in BOTH controls branches", () => {
    // one shared JSX const referenced twice (expanded + collapsed rows)
    expect(modal.match(/\{monthQuickSelector\}/g)?.length).toBe(2);
    expect(modal).toContain("const monthQuickSelector = (");
  });

  it("tapping a month sets first/last day and persists the range", () => {
    expect(modal).toContain("const applyQuickMonth");
    expect(modal).toContain("writeStoredTableRange(slug, variant, m.fromIso, m.toIso)");
    expect(modal).toContain("setMonthsOpen(false)");
  });

  it("12 recent months: behavior of the pure helper (labels + exact ranges)", () => {
    // helper lives in a pure .ts lib (the modal is TSX vitest can't transform)
    const months = buildRecentMonths(new Date(2026, 10, 20)); // Nov 2026
    expect(months).toHaveLength(12);
    expect(months[0].label).toBe("Ноябрь 2026");
    expect(months[0].fromIso).toBe("2026-11-01");
    expect(months[0].toIso).toBe("2026-11-30");
    expect(months[1].label).toBe("Октябрь 2026");
    expect(months[1].toIso).toBe("2026-10-31");
    // 12 months back from a March leap year — February gets day 29
    const aroundLeap = buildRecentMonths(new Date(2028, 2, 15), 12);
    const feb = aroundLeap.find((m) => m.key === "2028-02");
    expect(feb?.toIso).toBe("2028-02-29");
    expect(aroundLeap[aroundLeap.length - 1].key).toBe("2027-04");
  });

  it("the modal wires the helper + the shortcut is discoverable", () => {
    expect(modal).toContain('import { buildRecentMonths } from "../lib/recent-months";');
    expect(modal).toContain("const recentMonths = useMemo(() => buildRecentMonths(new Date()), []);");
    expect(modal).toContain("import { X, CalendarDays,");
    expect(modal).toContain('aria-label="Быстрый выбор месяца"');
    expect(modal).toContain("Быстрый выбор месяца — тап ставит первое и последнее число месяца в даты");
    expect(modal).toContain('aria-expanded={monthsOpen}');
    const lib = read("app/franchize/[slug]/rentals-analytics/lib/recent-months.ts");
    expect(lib).toContain("export function buildRecentMonths");
  });
});
