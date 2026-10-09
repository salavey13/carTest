// tests/franchize/mapriders-single-sheet.spec.ts
//
// Task 60 (boss 2026-10-02) — «optimize bottom nav bar on map-riders, seems
// we have two sliding from bottom sheets:)) look overkill, think how to
// merge and enhance robustness and usability».
//
// WHAT WAS WRONG (audited before the merge):
//   1. TWO stacked sliding sheets: the main vaul sheet (wall feed) AND
//      RidersDrawer — a SECOND vaul drawer sliding OVER it when the nav
//      tapped «Топ»/«Лист». Two handles, two drag surfaces fighting over
//      gestures, two Esc/focus scopes.
//   2. RidersDrawer rendered its Drawer.Handle OUTSIDE the open-conditional:
//      a stray handle pill floated at the bottom of the screen ABOVE the
//      bottom nav (z-40 > nav z-30) even when the drawer was closed.
//   3. RidersDrawer's handle onClick toggled `internalIsOpen` while the
//      component was externally controlled — a dead button (state desync).
//   4. The sheet header carried a «Мини/Средне/Высоко/Макс» 4-button row —
//      snap-ui overkill on top of an already-draggable handle.
//
// THE MERGE: ONE command-deck sheet. RidersDrawer's tabs became SEGMENTS of
// the main sheet (Стена / Лист / Топ — mirroring the bottom nav 1:1). Nav
// event names are preserved; their semantics changed from "stack another
// drawer" to "select a segment (+ toggle-collapse on the second tap)".
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const client = read("components/map-riders/MapRidersClientRefactored.tsx");
const panels = read("components/map-riders/MapRidersSheetPanels.tsx");
const nav = read("components/layout/FranchizeMapBottomNav.tsx");

describe("map-riders: ONE sheet, not two (Task 60)", () => {
  it("RidersDrawer.tsx is deleted — no second vaul drawer can come back", () => {
    expect(existsSync(join(ROOT, "components/map-riders/RidersDrawer.tsx"))).toBe(false);
    expect(client).not.toContain('from "@/components/map-riders/RidersDrawer"');
  });

  it("the client mounts exactly ONE Drawer.Root (the command deck)", () => {
    expect(client.split("<Drawer.Root").length - 1).toBe(1);
    expect(client.split("<Drawer.Portal").length - 1).toBe(1);
  });

  it("the panels are pure segment bodies — zero vaul/Drawer usage (stray-handle regression guard)", () => {
    // The old bug class: a Drawer.Handle rendered outside the open-conditional
    // floated a dead pill over the bottom nav. Panels don't own drawers at all.
    expect(panels).not.toContain("from \"vaul\"");
    expect(panels).not.toContain("Drawer.");
    expect(panels).not.toContain("Drawer.Handle");
  });

  it("segments mirror the bottom nav 1:1: Стена / Лист / Топ (+ «Сеть» stays a Link)", () => {
    expect(client).toContain('key: "wall", label: "Стена"');
    expect(client).toContain('key: "list", label: "Лист"');
    expect(client).toContain('key: "top", label: "Топ"');
    // segmented control is a real tablist
    expect(client).toContain('role="tablist"');
    expect(client).toContain('role="tab"');
    expect(client).toContain("aria-selected={active}");
    // nav keeps its 4 tabs and the discovery Link (pinned in crew-discovery-deeplink.spec.ts)
    expect(nav).toContain("grid-cols-4");
    expect(nav).toContain('href={`/franchize/discovery`}');
  });

  it("nav tabs SELECT deck segments; event names preserved with new semantics", () => {
    // Топ → top, Сеть → network, Лист → list, Стена → wall (Task 69: сеть
    // присоединилась к деке — раньше была жёсткой ссылкой со страницы)
    expect(client).toContain('selectSegment(tab === "ride" ? "top" : tab === "network" ? "network" : "list", { toggle: true })');
    expect(client).toContain('selectSegment("wall", { toggle: true })');
    expect(nav).toContain('detail: { tab: "ride" }');
    expect(nav).toContain("mapriders-open-riders-drawer");
    expect(nav).toContain("mapriders-expand-sheet");
  });

  it("toggle usability: tapping the active expanded tab collapses the deck (Мини)", () => {
    // refs mirror state so the toggle reads fresh values without resubscribing
    expect(client).toContain("const sheetSegmentRef = useRef(sheetSegment);");
    expect(client).toContain("const activeSnapRef = useRef(activeSnap);");
    expect(client).toMatch(/opts\?\.toggle && sheetSegmentRef\.current === segment && activeSnapRef\.current > 0\.2/);
    expect(client).toContain("setActiveSnap(SNAP_MINI)");
  });

  it("the deck broadcasts mapriders-sheet-state and the nav highlights the active segment", () => {
    expect(client).toContain('new CustomEvent("mapriders-sheet-state"');
    expect(nav).toContain('window.addEventListener("mapriders-sheet-state"');
    // collapsed deck (snap ≤ 0.2) = nothing open → no highlight
    expect(nav).toMatch(/\(detail\.snap \?\? 0\) > 0\.2/);
    expect(nav).toContain("SEGMENT_BY_KEY");
    expect(nav).toContain('leaderboard: "top"');
    expect(nav).toContain('drawer: "list"');
    expect(nav).toContain('crew: "wall"');
  });

  it("wall actions force the wall segment (check-in / map-point compose / post focus)", () => {
    // After the merge, opening the sheet without pinning the segment could
    // reveal Лист/Топ instead of the wall the action promised.
    const matches = client.match(/selectSegment\("wall"\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    expect(client).toContain("onFocusGeotag={handleWallFocusGeotag}");
  });

  it("the wall segment stays mounted while Лист/Топ are open (no refetch storm per flip)", () => {
    expect(client).toContain('sheetSegment === "wall" ? "space-y-3" : "hidden"');
    expect(client).toContain('sheetSegment === "list" ? (');
    expect(client).toContain('sheetSegment === "top" ?');
  });

  it("Лист row tap collapses the deck so the fetched route becomes visible on the map", () => {
    expect(client).toContain("handleSelectSessionFromList");
    expect(client).toContain("onSelectSession={handleSelectSessionFromList}");
    expect(panels).toContain("onSelectSession?.(sessionId)");
  });

  it("Esc collapses the deck but modals own Esc first (no double-close race)", () => {
    expect(client).toMatch(/if \(event\.key !== "Escape"\) return;/);
    expect(client).toMatch(/if \(isPromptOpen \|\| isConfirmOpen \|\| mapLightbox\) return;/);
  });

  it("the Мини/Средне/Высоко/Макс button row is retired (drag handle + nav toggles cover snapping)", () => {
    expect(client).not.toContain("SNAP_LABELS");
    // word-boundary match: DRAWER_SNAP_POINTS legitimately survives
    expect(client).not.toMatch(/\bSNAP_POINTS\b/);
    expect(client).toContain("DRAWER_SNAP_POINTS");
  });

  it("the merged panels kept the relocated feature set (ride controls, leaderboard, replay)", () => {
    // ride controls (ex «Эфир» tab)
    expect(panels).toContain("privacy/set-visibility");
    expect(panels).toContain("privacy/set-auto-expire");
    expect(panels).toContain("privacy/toggle-home-blur");
    expect(panels).toContain("privacy/toggle-pause");
    expect(panels).toContain("Включить геошеринг");
    // leaderboard (ex «Топ» content)
    expect(panels).toContain("Недельный зал славы");
    // history/replay (ex «History» tab)
    expect(panels).toContain("ReplayFullscreen");
    expect(panels).toContain("Открыть replay");
    // meetups create form (ex «Meetups» tab)
    expect(panels).toContain("useMeetupCreator(crewSlug)");
  });

  it("panels read the crew theme tokens — one visual family with the wall (no hardcoded white/*)", () => {
    expect(panels).toContain("var(--mr-card)");
    expect(panels).toContain("var(--mr-border)");
    expect(panels).toContain("var(--mr-text)");
    // the old drawer was all-white hardcoded; the DECK panels are tokenized.
    // (ReplayFullscreen is excluded on purpose: it's a cinema-mode fullscreen
    // overlay outside the deck, dark by design.)
    const deckPanels = panels.slice(0, panels.indexOf("function ReplayFullscreen"));
    expect(deckPanels).not.toMatch(/border-white\/10|bg-white\/5|text-white/);
  });
});

// 2026-10-07 — boss: «all tabs have issues of fully scrolling to the bottom of
// what's inside the sheet». Two real roots, both pinned here so they stay dead:
//
// 1. VAUL SNAP-POINT GEOMETRY: with snapPoints, vaul 0.9 translates the
//    bottom-anchored drawer DOWN by (1−snap)·vh and expects Drawer.Content to
//    be viewport-height tall. Ours was natural-height, so at every snap the
//    bottom (1−snap)·vh of the sheet (incl. the scroll body's bottom) sat
//    below the screen edge: at the tab snap 0.66 ≈278px dead zone vs 136px
//    bottom padding → real content of EVERY tab unreachable.
// 2. SSR «window is not defined»: RiderMarkerLayer (dead import) and
//    SpeedGradientRoute statically imported react-leaflet — module-scope
//    window access inside the SSR graph crashed the route intermittently
//    (measured 5/6 requests on main before the fix).
describe("map-riders: sheet scrolls to the bottom (2026-10-07 geometry + SSR)", () => {
  it("Drawer.Content is viewport-height (vaul snapPoints canonical layout) with the card top-anchored", () => {
    expect(client).toContain('className="fixed inset-x-0 bottom-0 z-20 h-[100dvh] pointer-events-none"');
    expect(client).toContain('className="flex h-full flex-col justify-start"');
  });

  it("the scroll body stays capped to the active snap (no scroll area below the fold)", () => {
    expect(client).toContain("data-vaul-no-drag");
    expect(client).toContain("max(8rem, calc(${Math.round(activeSnap * 100)}dvh - 118px))");
  });

  it("no static react-leaflet import in the deck's SSR graph (window is not defined guard)", () => {
    // RiderMarkerLayer is dead code (never rendered) — its import alone pulled
    // leaflet into the SSR bundle; SpeedGradientRoute must stay ssr:false.
    expect(client).not.toContain('import { RiderMarkerLayer } from "@/components/map-riders/RiderMarkerLayer"');
    expect(client).toContain('import("@/components/map-riders/SpeedGradientRoute")');
    // the deck itself never imports react-leaflet statically
    expect(client).not.toMatch(/^import .*from "react-leaflet"/m);
  });
});

// ── Task 84 (+2026-10-09 vice tint): game-map skins ─────────────────────────
// Boss: «map stylized as red dead redemption… maybe like gta» → light =
// RDR2 parchment (sepia tiles + paper vignette), dark = GTA Vice night
// (violet-shifted tiles + Miami sunset wash + additive neon glows).
// Pins: the skin stays opt-in via RacingMap's skinMode, map-riders derives it
// from the RESOLVED tile layer (filter must match the rendered basemap), and
// the neon glow layer exists ONLY for the dark skin.
describe("map-riders: game-map skins (task 84 + vice tint)", () => {
  it("map-riders passes a skinMode derived from the resolved tile layer", () => {
    expect(client).toContain("skinMode={finalTileLayer");
    expect(client).toContain('"cartodb-light" || finalTileLayer === "osm" ? "light" : "dark"');
  });

  it("RacingMap keeps the skin opt-in (classic maps unchanged) and renders overlays guardedly", () => {
    const map = read("components/maps/RacingMap.tsx");
    expect(map).toContain('skinMode = null');
    expect(map).toContain('{skinMode ? <div aria-hidden className="mr-map-skin-vignette" /> : null}');
    expect(map).toContain('{skinMode === "dark" ? <div aria-hidden className="mr-map-skin-neon" /> : null}');
  });

  it("both skins live in globals.css — vice layer is screen-blended and dark-only", () => {
    const css = read("app/globals.css");
    expect(css).toContain(".mr-map-skin--light .leaflet-tile-pane");
    expect(css).toContain(".mr-map-skin--dark .leaflet-tile-pane");
    expect(css).toContain(".mr-map-skin--dark .mr-map-skin-vignette");
    expect(css).toContain("mix-blend-mode: screen");
    // neon glows must be scoped to the skin wrapper (never leaks to classic maps)
    expect(css).toContain(".mr-map-skin .mr-map-skin-neon");
  });
});
