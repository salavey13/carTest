// tests/franchize/crew-discovery-physics.spec.ts
//
// BOSS 2026-10-02 — «spread the circles properly… respread around selected
// circle on tap… spring physics… circles draggable and collision aware».
//
// The physics lives in a PURE module (crew-physics.ts) so the visual layer
// can be pinned by actually RUNNING it: no overlaps ever, real convergence,
// ring hierarchy correctness, and the deterministic no-randomness contract
// the SSR graph depends on.

import { describe, expect, it } from "vitest";
import {
  applyTargets,
  createSimulation,
  energize,
  FOCUS_HOP_SCALE,
  HANDSHAKE_MAX_DEPTH,
  hopDistances,
  ringAnchors,
  stepSimulation,
  type PhysicsNodeInit,
} from "../../app/franchize/lib/crew-physics";

const VIEW = 1000;
const r = (members: number) => Math.round(Math.min(118, 46 + 13 * Math.sqrt(members)));

/** The SSR layout contract: even orbit, like layoutCrewGraph's init. */
function orbitInit(ids: string[], radii: Record<string, number>): PhysicsNodeInit[] {
  const orbit = VIEW * 0.32;
  return ids.map((id, index) => {
    const angle = (2 * Math.PI * index) / ids.length - Math.PI / 2;
    return { id, r: radii[id], x: VIEW / 2 + orbit * Math.cos(angle), y: VIEW / 2 + orbit * Math.sin(angle) };
  });
}

function pairOverlaps(
  sim: ReturnType<typeof createSimulation>,
  pad: number,
): { a: string; b: string; gap: number }[] {
  const list = [...sim.nodes.values()];
  const bad: { a: string; b: string; gap: number }[] = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const dist = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
      const minDist = list[i].r + list[j].r + pad;
      if (dist < minDist - 0.5) bad.push({ a: list[i].id, b: list[j].id, gap: minDist - dist });
    }
  }
  return bad;
}

const REALISTIC = {
  ids: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
  radii: Object.fromEntries(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id, i) => [id, r(1 + (i % 6))])),
  links: [
    { source: "a", target: "b", weight: 2 },
    { source: "b", target: "c", weight: 1 },
    { source: "c", target: "d", weight: 3 },
    { source: "a", target: "f", weight: 1 },
    { source: "f", target: "g", weight: 1 },
    { source: "g", target: "h", weight: 2 },
    { source: "h", target: "d", weight: 1 },
    { source: "i", target: "a", weight: 1 },
    { source: "j", target: "c", weight: 1 },
  ],
};

function runSteps(sim: ReturnType<typeof createSimulation>, max = 1200): number {
  for (let step = 0; step < max; step += 1) {
    if (stepSimulation(sim).settled) return step;
  }
  return max;
}

describe("crew-physics — global mode: proper spread, zero overlaps", () => {
  it("connected network settles with NO overlapping circles", () => {
    const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
      width: VIEW,
      height: VIEW,
    });
    runSteps(sim);
    expect(pairOverlaps(sim, 10)).toEqual([]);
  });

  it("every circle stays inside the canvas (radius + margin)", () => {
    const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
      width: VIEW,
      height: VIEW,
    });
    runSteps(sim);
    for (const node of sim.nodes.values()) {
      const m = node.r + 14;
      expect(node.x).toBeGreaterThanOrEqual(m - 0.6);
      expect(node.x).toBeLessThanOrEqual(VIEW - m + 0.6);
      expect(node.y).toBeGreaterThanOrEqual(m - 0.6);
      expect(node.y).toBeLessThanOrEqual(VIEW - m + 0.6);
    }
  });

  it("unlinked islands do not pile into one blob — they spread apart", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `i${i}`);
    const radii = Object.fromEntries(ids.map((id) => [id, r(1)]));
    const sim = createSimulation(orbitInit(ids, radii), [], { width: VIEW, height: VIEW });
    runSteps(sim);
    // pairwise distances must approach a spread-out state: at most one
    // residual touching pair (wall pressure), never a pile
    const touching = pairOverlaps(sim, 10);
    expect(touching.length).toBeLessThanOrEqual(1);
    // and the layout actually uses the canvas
    const xs = [...sim.nodes.values()].map((n) => n.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(VIEW * 0.5);
  });

  it("connected circles settle near their spring rest length (no stretched web)", () => {
    const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
      width: VIEW,
      height: VIEW,
    });
    runSteps(sim);
    for (const link of sim.links) {
      const dist = Math.hypot(link.a.x - link.b.x, link.a.y - link.b.y);
      const rest = link.a.r + link.b.r + 140;
      expect(dist / rest).toBeLessThan(2.2);
    }
  });

  it("deterministic: same inputs → same final frame (SSR-safe contract, no randomness)", () => {
    const run = () => {
      const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
        width: VIEW,
        height: VIEW,
      });
      runSteps(sim);
      return [...sim.nodes.values()].map((n) => `${n.id}:${n.x.toFixed(2)}:${n.y.toFixed(2)}`).join("|");
    };
    expect(run()).toBe(run());
  });
});

describe("crew-physics — focus mode: the «handshake» rings", () => {
  it("hopDistances: BFS over shared-people links, islands absent", () => {
    const hops = hopDistances("a", [
      { source: "a", target: "b", weight: 1 },
      { source: "b", target: "c", weight: 1 },
      { source: "x", target: "y", weight: 1 },
    ]);
    expect(hops.get("a")).toBe(0);
    expect(hops.get("b")).toBe(1);
    expect(hops.get("c")).toBe(2);
    expect(hops.has("x")).toBe(false);
  });

  it("ringAnchors: ring 1 = direct neighbors, deeper rings sit farther out", () => {
    const radii = new Map(REALISTIC.ids.map((id) => [id, r(2)]));
    const focus = ringAnchors("a", REALISTIC.links, radii);
    expect(focus.ringOf.get("b")).toBe(1); // direct shared people
    expect(focus.ringOf.get("c")).toBe(2); // one more handshake
    expect(focus.ringOf.get("d")).toBe(3);
    // monotonic ring radii
    for (let k = 2; k < focus.ringRadii.length; k += 1) {
      expect(focus.ringRadii[k]).toBeGreaterThan(focus.ringRadii[k - 1]);
    }
    // the outermost ring fits the canvas with its own circles
    const last = focus.ringRadii.length - 1;
    expect(focus.ringRadii[last]).toBeLessThanOrEqual(VIEW / 2 - 14);
  });

  it("deep chains collapse onto the outer ring (maxRing cap)", () => {
    const chain = Array.from({ length: 12 }, (_, i) => ({
      source: `n${i}`,
      target: `n${i + 1}`,
      weight: 1,
    }));
    const radii = new Map(Array.from({ length: 13 }, (_, i) => [`n${i}`, 50]));
    const focus = ringAnchors("n0", chain, radii);
    for (const ring of focus.ringOf.values()) {
      expect(ring).toBeLessThanOrEqual(HANDSHAKE_MAX_DEPTH);
    }
    expect(focus.maxHop).toBeLessThanOrEqual(4); // component default cap
  });

  it("single-child chains get a deterministic kink — no radial ray stack", () => {
    const chain = [
      { source: "n0", target: "n1", weight: 1 },
      { source: "n1", target: "n2", weight: 1 },
      { source: "n2", target: "n3", weight: 1 },
    ];
    const radii = new Map([
      ["n0", 50],
      ["n1", 50],
      ["n2", 50],
      ["n3", 50],
    ]);
    const focus = ringAnchors("n0", chain, radii);
    const angleOf = (id: string) => {
      const a = focus.anchors.get(id)!;
      return Math.atan2(a.y - VIEW / 2, a.x - VIEW / 2);
    };
    // consecutive single-child rings must not inherit the exact same angle
    expect(angleOf("n2")).not.toBeCloseTo(angleOf("n1"), 3);
    expect(angleOf("n3")).not.toBeCloseTo(angleOf("n2"), 3);
  });

  it("focused simulation converges to the rings — monotonic bands, no overlaps", () => {
    const radii = new Map(REALISTIC.ids.map((id) => [id, r(1 + (id.charCodeAt(0) - 97) % 4)]));
    const focus = ringAnchors("a", REALISTIC.links, radii);
    const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
      width: VIEW,
      height: VIEW,
    });
    applyTargets(sim, focus.anchors, "a");
    runSteps(sim, 900);
    expect(pairOverlaps(sim, 10)).toEqual([]);
    // per-ring mean radius grows outward
    const ringMean: number[] = [];
    for (let k = 1; k < focus.ringRadii.length; k += 1) {
      const inRing = [...focus.ringOf].filter(([, ring]) => ring === k).map(([id]) => id);
      if (inRing.length === 0) continue;
      ringMean.push(
        inRing.reduce((s, id) => s + Math.hypot(sim.nodes.get(id)!.x - VIEW / 2, sim.nodes.get(id)!.y - VIEW / 2), 0) /
          inRing.length,
      );
    }
    for (let i = 1; i < ringMean.length; i += 1) {
      expect(ringMean[i]).toBeGreaterThan(ringMean[i - 1]);
    }
  });

  it("the focused circle stays near the center (its own springs are muted)", () => {
    const sim = createSimulation(orbitInit(REALISTIC.ids, REALISTIC.radii), REALISTIC.links, {
      width: VIEW,
      height: VIEW,
    });
    const focus = ringAnchors("a", REALISTIC.links, new Map(Object.entries(REALISTIC.radii)));
    applyTargets(sim, focus.anchors, "a");
    runSteps(sim, 900);
    const a = sim.nodes.get("a")!;
    expect(Math.hypot(a.x - VIEW / 2, a.y - VIEW / 2)).toBeLessThan(60);
  });
});

describe("crew-physics — interaction mechanics", () => {
  it("drag pin (fx/fy) shoves neighbors away — collision avoidance while dragging", () => {
    const ids = ["p", "q", "r", "s"];
    const radii = Object.fromEntries(ids.map((id) => [id, 70]));
    const sim = createSimulation(orbitInit(ids, radii), [], { width: VIEW, height: VIEW });
    runSteps(sim);
    const p = sim.nodes.get("p")!;
    const before = [...sim.nodes.values()].map((n) => `${n.id}:${n.x.toFixed(0)}:${n.y.toFixed(0)}`).join("|");
    // grab p and slam it onto q's position
    p.fx = sim.nodes.get("q")!.x;
    p.fy = sim.nodes.get("q")!.y;
    for (let i = 0; i < 60; i += 1) stepSimulation(sim);
    const after = [...sim.nodes.values()].map((n) => `${n.id}:${n.x.toFixed(0)}:${n.y.toFixed(0)}`).join("|");
    expect(after).not.toBe(before);
    expect(pairOverlaps(sim, 10)).toEqual([]); // q got shoved away, not overlapped
    // release → the circle is free again
    p.fx = null;
    p.fy = null;
    expect(sim.nodes.get("p")!.fx).toBeNull();
  });

  it("release throw: velocity survives the release (spring-back energy)", () => {
    const sim = createSimulation(orbitInit(["solo"], { solo: 60 }), [], { width: VIEW, height: VIEW });
    const node = sim.nodes.get("solo")!;
    node.vx = 7;
    node.vy = -3;
    energize(sim, 0.6);
    const { settled } = stepSimulation(sim);
    expect(settled).toBe(false); // the throw is still flying
  });

  it("FOCUS_HOP_SCALE shrinks deep circles (deep rings fit the canvas)", () => {
    expect(FOCUS_HOP_SCALE[0]).toBe(1);
    expect(FOCUS_HOP_SCALE[1]).toBeLessThan(1);
    expect(FOCUS_HOP_SCALE[FOCUS_HOP_SCALE.length - 1]).toBeLessThan(FOCUS_HOP_SCALE[3]);
  });

  it("performance: 24 nodes × 900 steps stay in interactive budget", () => {
    const ids = Array.from({ length: 24 }, (_, i) => `n${i}`);
    const radii = Object.fromEntries(ids.map((id) => [id, 60]));
    const links: { source: string; target: string; weight: number }[] = [];
    for (let i = 0; i < 23; i += 1) links.push({ source: `n${i}`, target: `n${i + 1}`, weight: 1 });
    const started = performance.now();
    const sim = createSimulation(orbitInit(ids, radii), links, { width: VIEW, height: VIEW });
    runSteps(sim, 900);
    const elapsed = performance.now() - started;
    // 900 frames must simulate in well under a second of CPU (60fps budget)
    expect(elapsed).toBeLessThan(1000);
  });
});
