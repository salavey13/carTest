// tests/franchize/crew-discovery-infinite.spec.ts
// 2026-10-04 — the INFINITE AREA + service-satellites round (boss:
// «maybe by tapping on circle we can spawn respective services as circles
// as well and kinda connect to circles that have similar services…
// try to make kinda infinite area for these circles, to let circles not
// clamp and have some free real estate for additional infographics»).
//
// Pins (component source — the visual contract):
//   · the canvas is an infinite-canvas WORLD: a camera transform moves a
//     world group (dot-grid floor + graph + infographic stations); pan =
//     background drag, pinch = two fingers, zoom = ⌘/Ctrl+wheel or buttons;
//     plain wheel keeps scrolling the page (no scroll hijack);
//   · TAP A CREW → its services spawn as satellite circles around it, and
//     ring-1 crews with the SAME service spawn their own smaller satellite,
//     connected by a dashed service-colored affinity edge (the painter keeps
//     it glued to both satellites while the network moves);
//   · the freed world margin hosts TWO infographic stations («Услуги сети»,
//     «Рукопожатия-рекорды»), one camera-chip tap away; rows focus crews;
//   · the physics gets soft walls (overflowPad) so circles stop clamping;
//   · map-riders sheet parity: everything is derived from the same
//     nodes/links props — no new inputs, no Supabase on the client.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

describe("graph canvas — infinite area camera", () => {
  const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");

  it("world group under the camera transform (home = identity, no hydration risk)", () => {
    expect(graph).toContain('<g ref={worldRef} transform="translate(0 0) scale(1)">');
    expect(graph).toContain("translate(${cam.x.toFixed(2)} ${cam.y.toFixed(2)}) scale(${cam.k.toFixed(4)})");
    // the camera applies on mount too (before any tween)
    expect(graph).toContain("applyCamera();\n    wakeRef.current();");
  });

  it("zoom bounds are clamped — [0.55 .. 2.4]", () => {
    expect(graph).toContain("const ZOOM_MIN = 0.55;");
    expect(graph).toContain("const ZOOM_MAX = 2.4;");
    expect(graph).toContain("Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k))");
  });

  it("background pan + tap-out-to-deselect (pointer slop, no click deselect)", () => {
    expect(graph).toContain("const onSurfacePointerDown = useCallback(");
    expect(graph).toContain("const onSurfacePointerMove = useCallback(");
    expect(graph).toContain("const onSurfacePointerUp = useCallback(");
    // the old click-to-deselect rect is gone — pan must not deselect
    expect(graph).not.toContain('onClick={() => setSelectedId(null)} />');
    // tap (below slop) on the world floor still returns to the whole network
    expect(graph).toContain("if (!pan.moved) setSelectedId(null);");
    // pan converts client deltas via the viewBox transform (zoom-agnostic)
    expect(graph).toContain("const cur = toView(event.clientX, event.clientY);");
  });

  it("two-finger pinch zooms around the midpoint", () => {
    expect(graph).toContain("pointersRef.current.size === 2");
    expect(graph).toContain("pinchRef.current = {");
    expect(graph).toContain("cam.k * (dist / pinch.lastDist)");
  });

  it("⌘/Ctrl+wheel zooms at the pointer — plain wheel never hijacks page scroll", () => {
    expect(graph).toContain("if (!(event.ctrlKey || event.metaKey)) return;");
    expect(graph).toContain('svg.addEventListener("wheel", onWheel, { passive: false })');
  });

  it("zoom buttons tween the camera (no jumps)", () => {
    expect(graph).toContain('onClick={() => zoomBy(1.35)}');
    expect(graph).toContain('onClick={() => zoomBy(1 / 1.35)}');
    expect(graph).toContain('aria-label="Приблизить"');
    expect(graph).toContain('aria-label="Отдалить"');
    expect(graph).toContain('aria-label="Вернуть камеру к графу"');
  });

  it("a fresh focus re-centers the world; camera tween rides the rAF loop", () => {
    expect(graph).toContain("// a fresh focus re-centers the world (rings compose around the middle)");
    expect(graph).toContain("if (selectedId) tweenHome();");
    expect(graph).toContain("const tween = camTweenRef.current;");
  });

  it("touch scroll-lock covers pan/pinch too (map-riders sheet parity)", () => {
    // the historical drag pin stays byte-identical…
    expect(graph).toContain("if (dragRef.current) event.preventDefault();");
    // …and pan/pinch claim the gesture as well
    expect(graph).toContain("else if (panRef.current || pinchRef.current) event.preventDefault();");
  });

  it("the world floor is a dot grid over the reachable world (also the pan surface)", () => {
    expect(graph).toContain('fill="url(#dotgrid)"');
    expect(graph).toContain("x={-(overflowPad + 600)}");
  });
});

describe("graph canvas — service satellites on tap", () => {
  const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");

  it("the selection spawns ALL its services as satellites (fanned around the top)", () => {
    expect(graph).toContain("const satelliteModel = useMemo(");
    expect(graph).toContain("satsByCrew.set(sel.crewId, list);");
    expect(graph).toContain("-Math.PI / 2 + ((i - (count - 1) / 2) * 58 * Math.PI) / 180");
  });

  it("«+N в сети» — network-wide totals inform beyond the visible kin", () => {
    expect(graph).toContain("`+${plus} в сети`");
    expect(graph).toContain("totalByService");
  });

  it("ring-1 crews with the SAME service spawn their own smaller satellite", () => {
    expect(graph).toContain("kinByService.set(service.key, list.slice(0, 4));");
    expect(graph).toContain("if (satsByCrew.has(node.crewId)) continue; // one satellite per crew");
    expect(graph).toContain('service.key === "storage" ? `/franchize/${node.slug}/storage` : `/franchize/${node.slug}`');
  });

  it("satellites ride INSIDE the crew <g> — they follow physics for free", () => {
    expect(graph).toContain("(satelliteModel.satsByCrew.get(node.crewId) ?? []).map((sat) => {");
  });

  it("satellites navigate to the service (SPA route, keyboard parity) and never start drags", () => {
    expect(graph).toContain("router.push(sat.href);");
    expect(graph).toContain('role="link"');
    expect(graph).toContain("onPointerDown={(event) => event.stopPropagation()}");
    expect(graph).toContain('if (event.key === "Enter" || event.key === " ") {');
  });

  it("dashed service-colored affinity edges connect similar services", () => {
    // Task 74: edge paint/dash became ternaries — service edges keep the
    // SERVICE_META color + "3 7", blogger distribution edges go blue "7 5".
    expect(graph).toContain('strokeDasharray={edge.kind === "blogger" ? "7 5" : "3 7"}');
    expect(graph).toContain('stroke={edge.kind === "blogger" ? BLOGGER_COLOR : (SERVICE_META[edge.serviceKey]?.color ?? "#7dd3fc")}');
  });

  it("the painter keeps affinity edges glued to BOTH satellites at 60fps", () => {
    expect(graph).toContain("service-affinity edges follow their satellites (crew motion included)");
    expect(graph).toContain("const edgeEl = serviceEdgeRefs.current.get(key);");
    expect(graph).toContain("`M ${(a.x + meta.oax).toFixed(1)} ${(a.y + meta.oay).toFixed(1)} L ${(b.x + meta.obx).toFixed(1)} ${(b.y + meta.oby).toFixed(1)}`");
    // meta synced per render
    expect(graph).toContain("serviceEdgeMeta.current = new Map(");
  });

  it("progressive disclosure: satellites exist only in focus mode (global stays calm)", () => {
    expect(graph).toContain("if (!selectedId || !focusServices) return { satsByCrew, edges };");
  });
});

describe("graph canvas — world infographic stations", () => {
  const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");

  it("«Услуги сети» station lives OUTSIDE the visible box (right margin)", () => {
    expect(graph).toContain("<foreignObject x={view + STATION_GAP} y={STATION_TOP} width={STATION_W} height={520}>");
    expect(graph).toContain("Услуги сети");
    // strongest crews first, capped — the card stays a digest, not a roster
    expect(graph).toContain('.sort((a, b) => b.memberCount - a.memberCount).slice(0, 4)');
    // rows focus the crew and fly the camera home
    expect(graph).toContain("setSelectedId(crew.crewId);\n                              tweenHome();");
  });

  it("«Рукопожатия-рекорды» station lives OUTSIDE the visible box (left margin)", () => {
    expect(graph).toContain("<foreignObject x={-(STATION_GAP + STATION_W)} y={STATION_TOP} width={STATION_W} height={360}>");
    expect(graph).toContain("Рукопожатия-рекорды");
    expect(graph).toContain("[...links].sort((a, b) => b.weight - a.weight).slice(0, 3)");
  });

  it("station taps never trigger panning", () => {
    expect(graph).toContain("onPointerDown={(event) => event.stopPropagation()}");
  });

  it("camera chips bring the stations in one tap (Граф · Услуги · Рекорды)", () => {
    expect(graph).toContain('onClick={() => focusStation("services")}');
    expect(graph).toContain('onClick={() => focusStation("records")}');
    expect(graph).toContain('aria-label="Показать весь граф"');
    expect(graph).toContain('aria-label="Показать услуги сети"');
    expect(graph).toContain('aria-label="Показать рекорды рукопожатий"');
  });

  it("constitution: no new inputs — stations derive from nodes/links props only", () => {
    expect(graph).not.toContain("supabase");
    expect(graph).not.toContain("<input");
    expect(graph).not.toContain("useFetch");
  });
});

describe("physics — soft walls feed the infinite area", () => {
  const physics = read("app/franchize/lib/crew-physics.ts");

  it("createSimulation accepts overflowPad and stores it on the state", () => {
    expect(physics).toContain("overflowPad?: number");
    expect(physics).toContain("const overflowPad = Math.max(0, opts?.overflowPad ?? 0);");
    expect(physics).toContain("width, height, overflowPad, alpha: 1");
  });

  it("soft walls: spring-back past the box edge, hard cap at the world edge", () => {
    expect(physics).toContain("node.vx += Math.min(14, (m - node.x) * 0.045);");
    expect(physics).toContain("node.x = m - overflow;");
    expect(physics).toContain("node.y = state.height - m + overflow;");
  });

  it("overflowPad = 0 keeps the historical hard clamp branch", () => {
    expect(physics).toContain("} else {\n        node.x = m;\n        node.vx = Math.abs(node.vx) * 0.5;\n      }");
  });

  it("the graph feeds the sim the world margin (35% of the view, each side)", () => {
    const graphSrc = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");
    expect(graphSrc).toContain("const WORLD_OVERFLOW_RATIO = 0.35;");
    expect(graphSrc).toContain("overflowPad: Math.round(view * WORLD_OVERFLOW_RATIO)");
  });
});
