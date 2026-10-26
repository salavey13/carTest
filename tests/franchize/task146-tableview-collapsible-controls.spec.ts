// Task 146 — tableview round four (boss: "make everything collapsible
// (filters, counters, etc. — keep showing date picker only in collapsed-
// controls mode) to give more screen space to table — autocollapse in case
// screen is rotated on mobile … polish adaptability — super usable").
//
// Layers pinned here:
//   • Fold state — controlsExpanded + sessionStorage persistence of the
//     MANUAL choice + viewport defaults (desktop expanded / touch collapsed).
//   • Auto-collapse — orientation flip portrait→landscape on a coarse-point
//     (touch) device folds the controls; keyboards/resizes never fold; no
//     code path ever auto-expands.
//   • Collapsed header — ONE row: date pickers stay visible (the
//     "collapsed-controls" contract), search/send/download shrink to icons
//     (send/download hidden below sm), X still the same corner.
//   • Foldable region — totals tiles + «ЗП по операторам» + сверка chips
//     behind a grid-rows 1fr↔0fr animation; inert + aria-hidden while folded;
//     bulk-verify force-opens it so the progress button stays on screen.
//   • Toggle affordances — «Свернуть» next to the X when expanded;
//     SlidersHorizontal icon-button with an active-filter count badge when
//     folded (a folded filter must never be invisible).
//   • Adaptability polish — thin styled scrollbars + touch-action on the
//     scroll container; collapsed-phone search icon expands + focuses.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");
const modal = src(
  "app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx",
);

describe("task146 · fold state + persistence", () => {
  it("has the fold state and initializes it per open", () => {
    expect(modal).toContain("const [controlsExpanded, setControlsExpanded] = useState(true);");
    // per-open init lives in the isOpen effect
    expect(modal).toContain("setControlsExpanded(stored != null ? stored === \"1\" : !coarse);");
    expect(modal).toContain('window.sessionStorage.getItem(CONTROLS_STORAGE_KEY)');
  });

  it("viewport default: desktop (fine pointer) expanded, touch collapsed", () => {
    expect(modal).toContain('window.matchMedia("(pointer: coarse)").matches');
  });

  it("the MANUAL toggle persists to sessionStorage (per tab, no cross-day surprises)", () => {
    expect(modal).toContain('const CONTROLS_STORAGE_KEY = "rentalsAnalytics.csvTableControlsExpanded";');
    expect(modal).toContain('window.sessionStorage.setItem(CONTROLS_STORAGE_KEY, next ? "1" : "0");');
  });

  it("storage access is wrapped — private mode can't crash the modal", () => {
    expect(modal.match(/catch \{\n\s*\/\* private mode/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("task146 · auto-collapse on rotation", () => {
  it("listens to the orientation flip and folds on landscape for touch devices", () => {
    expect(modal).toContain('window.matchMedia("(orientation: landscape)")');
    expect(modal).toContain("const onOrientationChange = () => {\n      if (landscape.matches && coarse.matches) setControlsExpanded(false);\n    };");
    expect(modal).toContain("landscape.addEventListener(\"change\", onOrientationChange);");
    expect(modal).toContain("landscape.removeEventListener(\"change\", onOrientationChange);");
  });

  it("auto-collapse fires on the TRANSITION only — keyboard/resize never fold, nothing auto-expands", () => {
    // the orientation effect itself registers NO resize listener (task137's
    // rail measurement has its own — that one is fine and unrelated)
    const effStart = modal.indexOf('window.matchMedia("(orientation: landscape)")');
    const eff = modal.slice(modal.lastIndexOf("useEffect", effStart), modal.indexOf("}, [isOpen]);", effStart));
    expect(eff).not.toContain('window.addEventListener("resize"');
    // the only setControlsExpanded(true) calls are: the manual toggle path
    // and the bulk-verify force-open — never the orientation flip
    const expandCalls = modal.match(/setControlsExpanded\(true\)/g) ?? [];
    expect(expandCalls.length).toBe(2); // bulk force-open + expandAndFocusSearch
  });
});

describe("task146 · collapsed header keeps the date pickers", () => {
  it("two exclusive header branches — expanded and collapsed", () => {
    expect(modal).toContain("{controlsExpanded ? (");
    expect(modal.match(/controlsExpanded \? \(/g)?.length).toBe(1);
  });

  it("collapsed branch still renders BOTH date pickers (ids preserved, sr-only labels)", () => {
    const collapsed = modal.slice(modal.indexOf("COLLAPSED: one compact row"));
    expect(collapsed).toContain('htmlFor="csv-from"');
    expect(collapsed).toContain('htmlFor="csv-to"');
    expect(collapsed).toContain('aria-label="С даты"');
    expect(collapsed).toContain('aria-label="По дату"');
    // both inputs are editable in the collapsed row — the boss changes the
    // range without opening anything
    expect(collapsed.match(/type="date"/g)?.length).toBe(2);
  });

  it("collapsed row: search/send/download become compact icons; send/download hide below sm", () => {
    const collapsed = modal.slice(modal.indexOf("COLLAPSED: one compact row"));
    expect(collapsed).toContain("expandAndFocusSearch");
    expect(collapsed).toContain("hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 disabled:opacity-50 sm:inline-flex");
    expect(collapsed.match(/sm:hidden/g)?.length).toBe(1); // the phone search icon
  });
});

describe("task146 · foldable summary region", () => {
  it("totals + operator split + сверка chips live inside the animated region", () => {
    const regionStart = modal.indexOf('id="csv-controls-region"');
    const regionEnd = modal.indexOf("{/* ── Table(s)");
    const region = modal.slice(regionStart, regionEnd);
    expect(region).toContain("TotalsTile label=\"Записей\"");
    expect(region).toContain("ЗП по операторам");
    expect(region).toContain("Фильтр по сверке");
    // the region closes AFTER the chips block and BEFORE the table;
    // before the table: the region's id + one aria-controls per header
    // branch (expanded «Свернуть» + collapsed SlidersHorizontal) = 3
    expect(modal.slice(0, regionEnd).match(/csv-controls-region/g)?.length).toBe(3); // id + aria-controls
  });

  it("grid-rows 1fr↔0fr animation with an overflow-hidden child (0fr actually collapses)", () => {
    expect(modal).toContain('className="grid transition-[grid-template-rows] duration-300 ease-out"');
    expect(modal).toContain('gridTemplateRows: regionOpen ? "1fr" : "0fr"');
    expect(modal).toContain('<div className="overflow-hidden">');
  });

  it("folded controls are inert + aria-hidden — no ghost tab stops", () => {
    expect(modal).toContain("aria-hidden={!regionOpen}");
    expect(modal).toContain('{...(regionOpen ? {} : { inert: "" })}');
  });

  it("bulk verify force-opens the region (progress button must stay visible)", () => {
    expect(modal).toContain("const regionOpen = controlsExpanded || bulkActive;");
    // inside handleBulkVerify, right after the confirm dialog
    expect(modal).toContain("// Task 146 — the batch progress lives in the сверка chips row; open the\n    // folded controls so the count-up button stays visible while it runs.\n    setControlsExpanded(true);");
  });
});

describe("task146 · toggle affordances", () => {
  it("expanded: «Свернуть» with aria-expanded wired to the region", () => {
    expect(modal).toContain('aria-controls="csv-controls-region"');
    expect(modal).toContain("Свернуть сводку и фильтры — останутся только даты");
    expect(modal).toContain("<ChevronUp className=\"h-3.5 w-3.5\" aria-hidden />");
  });

  it("collapsed: SlidersHorizontal icon-button with an active-filter count badge", () => {
    expect(modal).toContain("const activeFilterCount =\n    (effectiveOpFilter ? 1 : 0) + (verFilter !== \"all\" ? 1 : 0);");
    expect(modal).toContain("aria-label=\"Показать сводку и фильтры\"");
    expect(modal).toContain("<SlidersHorizontal className=\"h-4 w-4\" aria-hidden />");
    expect(modal).toContain("backgroundColor: T.accent, color: \"#ffffff\"");
  });

  it("collapsed-phone search icon expands the controls and focuses the field", () => {
    expect(modal).toContain("const [searchFocusPending, setSearchFocusPending] = useState(false);");
    expect(modal).toContain("const expandAndFocusSearch = () => {");
    expect(modal).toContain("searchInputRef.current?.focus();");
    // ref lands on BOTH branch inputs (only one renders at a time)
    expect(modal.match(/ref=\{searchInputRef\}/g)?.length).toBe(2);
  });
});

describe("task146 · adaptability polish", () => {
  it("the scroll container got thin scrollbars + touch-action:manipulation", () => {
    expect(modal).toContain("[touch-action:manipulation]");
    expect(modal).toContain("[scrollbar-width:thin]");
    expect(modal).toContain("[&::-webkit-scrollbar-thumb]:rounded-full");
  });

  it("the fullscreen shell from task137 is untouched (no regression to boxed modal)", () => {
    expect(modal).toContain(
      "fixed inset-0 z-[70] flex items-stretch justify-center bg-black/60 backdrop-blur-sm",
    );
    expect(modal).not.toContain("sm:max-h-[88vh]");
    expect(modal).not.toContain("sm:max-w-7xl");
  });
});
