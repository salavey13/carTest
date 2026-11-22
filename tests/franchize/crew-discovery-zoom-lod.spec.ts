// tests/franchize/crew-discovery-zoom-lod.spec.ts
//
// ZOOM-LOD round (boss 2026-10-11) — «overhaul ui/ux of network tab of
// sliding sheet on map-riders — full zoom/pinch support on mobile and make
// circle even more miniature but interesting, play with zoom — make visual
// details depend on zoom level and handle it dynamicly on the fly».
//
// Contract pinned here:
//   1. MINIATURE circles — every radius × MINIATURE_SCALE at the single choke
//      point (baseRadii), so layout, physics and paint stay coherent;
//      crewCircleRadius itself keeps its tested contract.
//   2. FULL PINCH — a capture-phase pointerdown listener registers pointers
//      that land on circles/satellites (their stopPropagation used to blind
//      the pinch); a two-pointer transition cancels an in-flight circle drag
//      and pans, then seeds pinchRef — zoom from ANY starting surface.
//   3. DOUBLE-TAP zoom on the background: second tap <340ms/<26px zooms at
//      the finger, or homes the camera when already zoomed in.
//   4. ZOOM LOD — applyCamera stamps data-lod="far|mid|near|macro" on the
//      world group (write-on-change); a scoped stylesheet (CG_LOD_CSS)
//      cross-fades: far → labels off/sparse floor/stations dimmed, near →
//      service rim ticks, macro → «N общ.» link badges. The painter glues
//      badge positions to the springs only while macro is live.
//   5. Miniature-but-interesting circles — deterministic accent arc (share
//      of the largest crew) + breathing sky halo on blogger crews.
//   6. Sheet variant — SheetNetworkPanel passes variant="sheet": no page
//      margin, no below-canvas hint (the deck keeps its own compact chips).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");
const panels = read("components/map-riders/MapRidersSheetPanels.tsx");

describe("zoom-LOD: miniature circles that stay interesting", () => {
  it("radii shrink at ONE choke point (baseRadii) — crewCircleRadius keeps its contract", () => {
    expect(graph).toContain("const MINIATURE_SCALE = 0.72;");
    expect(graph).toContain("Math.round(crewCircleRadius(node.memberCount) * MINIATURE_SCALE)");
    // the lib function itself is untouched (its own spec pins 35/72)
    const lib = read("app/franchize/lib/crew-network.ts");
    expect(lib).toContain("Math.round(Math.min(72, 26 + 9 * Math.sqrt(n)))");
  });

  it("accent arc — deterministic capacity gauge on the rim (SSR-stable)", () => {
    expect(graph).toContain("function accentArcPath(r: number, sweepDeg: number): string");
    expect(graph).toContain("accentArcPath(r + 3.2, 40 + 290 * (node.memberCount / maxMemberCount))");
    expect(graph).toContain("const maxMemberCount = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.memberCount), 1), [nodes]);");
  });

  it("blogger crews breathe — sky halo on the distribution layer", () => {
    expect(graph).toContain('className="cg-halo"');
    expect(graph).toContain("bloggersByCrew.has(node.crewId)");
    expect(graph).toContain("@keyframes cg-breathe");
    expect(graph).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("zoom-LOD: full pinch on mobile", () => {
  it("capture-phase pointer registry — pinch engages even when fingers start on circles", () => {
    expect(graph).toContain('svg.addEventListener("pointerdown", onCapturePointerDown, { capture: true })');
    // the gesture handover: an in-flight circle drag is cancelled, its node
    // un-pinned, then pinchRef seeds from the two live pointers
    expect(graph).toContain("onCapturePointerDown");
    expect(graph).toContain("node.fx = null;\n          node.fy = null;");
    expect(graph).toContain("pinchRef.current = {\n          lastDist: Math.max(1, Math.hypot(v2.x - v1.x, v2.y - v1.y)),");
  });

  it("double-tap zoom — second background tap zooms at the finger (or homes)", () => {
    expect(graph).toContain("const DOUBLE_TAP_MS = 340;");
    expect(graph).toContain("const DOUBLE_TAP_SLOP_PX = 26;");
    expect(graph).toContain("const DOUBLE_TAP_ZOOM = 1.8;");
    expect(graph).toContain("lastTapRef.current = isDoubleTap ? null : { t: now, x: event.clientX, y: event.clientY };");
    expect(graph).toContain("if (camRef.current.k > 1.15) {");
  });
});

describe("zoom-LOD: visual details follow the camera on the fly", () => {
  it("applyCamera stamps data-lod on the world group — write-on-change, no re-render", () => {
    expect(graph).toContain('const band = lodOf(cam.k);\n    if (band !== lodRef.current) {\n      lodRef.current = band;\n      worldRef.current?.setAttribute("data-lod", band);\n    }');
    expect(graph).toContain('return k < 0.72 ? "far" : k < 1.3 ? "mid" : k < 2 ? "near" : "macro";');
    expect(graph).toContain('<g ref={worldRef} className="cg-lod" data-lod="mid" transform="translate(0 0) scale(1)">');
  });

  it("scoped stylesheet cross-fades the layers (cg-* family, no global bleed)", () => {
    expect(graph).toContain("const CG_LOD_CSS = `");
    // far: constellation read
    expect(graph).toContain('.cg-lod[data-lod="far"] .cg-label { opacity: 0; }');
    expect(graph).toContain('.cg-lod[data-lod="far"] .cg-floor-far { opacity: 1; }');
    expect(graph).toContain('.cg-lod[data-lod="far"] .cg-station { opacity: 0.22; pointer-events: none; }');
    // near: rim ticks; macro: link badges
    expect(graph).toContain('.cg-lod[data-lod="near"] .cg-tick, .cg-lod[data-lod="macro"] .cg-tick { opacity: 1; }');
    expect(graph).toContain('.cg-lod[data-lod="macro"] .cg-badge { opacity: 1; }');
    // the stylesheet rides the component (scoped, cg-prefixed)
    expect(graph).toContain("<style>{CG_LOD_CSS}</style>");
  });

  it("sparse floor pattern + two-layer floor cross-fade", () => {
    expect(graph).toContain('<pattern id="dotgrid-sparse" width="116" height="116" patternUnits="userSpaceOnUse">');
    expect(graph).toContain('className="cg-floor"');
    expect(graph).toContain('className="cg-floor-far"');
  });

  it("service rim ticks wake up at near zoom", () => {
    expect(graph).toContain('className="cg-tick"');
    expect(graph).toContain("node.services.slice(0, 2).map((service, tickIndex) => {");
  });

  it("link badges ride the springs — real handshakes only, painter glues them while macro is live", () => {
    expect(graph).toContain('className="cg-linkbadges"');
    // weight ≥ 2 only — «1 общ.» on every weak tie turned macro into noise
    expect(graph).toContain("links.filter((link) => link.weight >= 2).map((link) => {");
    expect(graph).toContain("if (lodRef.current === \"macro\") {\n        const badgeEl = badgeRefs.current.get(`${link.a.id}-${link.b.id}`);");
    expect(graph).toContain("{link.weight} общ.");
    // the count caption folds at macro (name + badges is the macro read)
    expect(graph).toContain('.cg-lod[data-lod="macro"] .cg-count { opacity: 0; }');
    expect(graph).toContain('className="cg-label cg-count"');
  });
});

describe("zoom-LOD: the sheet variant (map-riders network tab)", () => {
  it("SheetNetworkPanel passes variant=sheet and names the zoom gestures in-chip", () => {
    expect(panels).toContain('variant="sheet"');
    expect(panels).toContain("щипок · двойной тап — зум");
    // the old two-line hint is gone — the in-canvas legend covers the manual
    expect(panels).not.toContain("Тап по кругу перестраивает сеть вокруг него");
  });

  it("the graph strips page chrome in sheet variant (margin + below-canvas hint)", () => {
    expect(graph).toContain('variant = "page"');
    expect(graph).toContain('variant === "sheet" ? "mt-0" : "mt-6"');
    expect(graph).toContain('{variant !== "sheet" && (');
  });

  it("the graph opts out of vaul sheet-drag (data-vaul-no-drag) — pinch must never drag the deck away", () => {
    // regression: pinch on the graph used to double as a vaul sheet-drag —
    // the deck slid from under the fingers and vaul's pointerout handler
    // crashed on a null lastKnownPointerEventRef (TypeError … 'target')
    expect(graph).toContain("data-vaul-no-drag");
    // belt + suspenders: the floor pointerdown never reaches the drawer at
    // all — vaul's onPress (isDragging=true per press) is starved, so its
    // pointerout crash class is unreachable from the graph
    expect(graph).toContain("event.stopPropagation();");
    expect(graph).toContain("starving it of the pointerdown makes that path unreachable");
  });

  it("sheet canvas is solid dark — the graph paints a dark world on any deck theme", () => {
    expect(graph).toContain('variant === "sheet" ? "bg-[#0b1220]" : "bg-white/[0.04]"');
  });
});
