// app/franchize/lib/crew-physics.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Crew-physics (2026-10-02) — the live layer under the discovery graph
// (boss: «spread the circles properly… respread around selected circle on
// tap… spring physics for existing connections… circles draggable and
// collision aware»):
//
//   · GLOBAL mode — radius-aware repulsion + link springs + soft gravity +
//     HARD collision avoidance: circles spread across the canvas properly
//     and can never overlap, however you shake the network;
//   · FOCUS mode (a crew is tapped) — BFS «handshake» hops from the selection
//     → concentric ring anchors; every circle is pulled to its ring by a soft
//     target spring while collision keeps the picture clean. The hierarchy IS
//     the «6 handshakes» idea: anyone reaches anyone in a few hops, and the
//     shown depth is derived FROM THE SELECTION (its own BFS depth);
//   · DRAG — a circle is pinned to the pointer (fx/fy); the rest of the
//     network is shoved away by collision. On release the circle springs back
//     to its anchor (focus) or floats freely (global);
//   · DETERMINISTIC — zero randomness, zero dependencies: same inputs → same
//     frame sequence, so tests pin exact outcomes. Pure math: no DOM, no
//     React, no Supabase here.
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphPoint {
  x: number;
  y: number;
}

export interface PhysicsLinkInput {
  source: string;
  target: string;
  /** Shared people (≥ 1) — heavier ties pull slightly closer. */
  weight?: number;
}

export interface PhysicsNodeInit {
  id: string;
  r: number;
  x: number;
  y: number;
}

export interface PhysicsNode {
  id: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Pointer pin — when set the node follows it exactly (drag state). */
  fx: number | null;
  fy: number | null;
}

export interface PhysicsTuning {
  /** Pull toward the canvas center. */
  gravity: number;
  /** Coulomb-ish repulsion strength, scaled by the two circle sizes. */
  repulsion: number;
  /** Per-pair repulsion cap (keeps one huge circle from rocketing others). */
  repulseCap: number;
  /** Link spring stiffness. */
  springK: number;
  /** Rest GAP between circle EDGES along a link. */
  springGap: number;
  /** Rest-length tightening per extra shared person (heavier tie = closer). */
  weightTighten: number;
  weightTightenCap: number;
  /** Velocity damping per step (0..1). */
  damping: number;
  /** Exponential cooling of the global motion budget. */
  alphaDecay: number;
  /** Slower cooling while focus anchors are active (long travels must finish). */
  alphaDecayFocus: number;
  /** Focus-anchor spring stiffness — NOT alpha-scaled: anchors own the end
   *  state and must converge even after the global motion budget cooled.
   *  Stability with damping 0.8 requires targetK·5 < 1 (0.15 → rate 0.75). */
  targetK: number;
  /** Minimum clearance between circle edges (hard collision). */
  collisionPad: number;
}

export const PHYSICS_DEFAULTS: PhysicsTuning = {
  gravity: 0.022,
  repulsion: 320,
  repulseCap: 30,
  springK: 0.07,
  springGap: 140,
  weightTighten: 16,
  weightTightenCap: 48,
  damping: 0.8,
  alphaDecay: 0.994,
  alphaDecayFocus: 0.992,
  targetK: 0.28,
  collisionPad: 10,
};

export interface SimulationState {
  nodes: Map<string, PhysicsNode>;
  /** Link endpoints resolved to live node refs — O(1) per step. */
  links: { a: PhysicsNode; b: PhysicsNode; weight: number }[];
  width: number;
  height: number;
  /** INFINITE AREA (2026-10-04, boss: «make kinda infinite area — circles
   *  not clamped, free real estate»): how far a circle may drift BEYOND the
   *  [0..W] box. 0 = the historical hard clamp (tests pin that behavior);
   *  >0 turns the box edges into soft springs — the network breathes into
   *  the world margin under collision pressure and recovers when it fades,
   *  with a hard cap at ±overflowPad so the camera can always reach all.
   *  Units: world units each side. */
  overflowPad: number;
  /** Global motion budget — decays every step; reset by applyTargets. */
  alpha: number;
  /** Focus anchors (node id → ring point) or null in global mode. */
  targets: Map<string, GraphPoint> | null;
  /** The focused node id (while targets active) — its own link springs are
   *  muted so the hierarchy center stays put (neighbors still feel them). */
  focusId: string | null;
  tuning: PhysicsTuning;
  steps: number;
}

/** Bounds margin — the same +14 the SSR layout uses. */
export const BOUNDS_MARGIN = 14;

/**
 * Build a simulation. Initial positions usually come from the deterministic
 * SSR layout (layoutCrewGraph) so the first painted frame matches the server
 * markup; the client physics then takes over. Overlapping init positions get
 * a deterministic index-based nudge (never random — SSR-safe contract).
 */
export function createSimulation(
  inits: PhysicsNodeInit[],
  links: PhysicsLinkInput[],
  opts?: { width?: number; height?: number; overflowPad?: number; tuning?: Partial<PhysicsTuning> },
): SimulationState {
  const width = opts?.width ?? 1000;
  const height = opts?.height ?? 1000;
  const overflowPad = Math.max(0, opts?.overflowPad ?? 0);
  const tuning: PhysicsTuning = { ...PHYSICS_DEFAULTS, ...(opts?.tuning ?? {}) };

  const nodes = new Map<string, PhysicsNode>();
  inits.forEach((init, index) => {
    // deterministic de-overlap of degenerate init positions
    let x = init.x;
    let y = init.y;
    for (const other of nodes.values()) {
      const dx = x - other.x;
      const dy = y - other.y;
      if (Math.hypot(dx, dy) < 0.5) {
        x += 0.7 * ((index % 5) + 1);
        y -= 0.7 * ((index % 3) + 1);
      }
    }
    nodes.set(init.id, { id: init.id, r: init.r, x, y, vx: 0, vy: 0, fx: null, fy: null });
  });

  const resolved: SimulationState["links"] = [];
  for (const link of links) {
    if (link.source === link.target) continue;
    const a = nodes.get(link.source);
    const b = nodes.get(link.target);
    if (!a || !b) continue;
    resolved.push({ a, b, weight: Math.max(1, link.weight ?? 1) });
  }

  return { nodes, links: resolved, width, height, overflowPad, alpha: 1, targets: null, focusId: null, tuning, steps: 0 };
}

/** Point the simulation at focus anchors (or clear them) and re-energize.
 *  `focusId` (the tapped crew) mutes its own link springs — the hierarchy
 *  center must stay put regardless of which ring it anchors. */
export function applyTargets(
  state: SimulationState,
  targets: Map<string, GraphPoint> | null,
  focusId?: string | null,
): void {
  state.targets = targets;
  state.focusId = targets ? (focusId ?? null) : null;
  state.alpha = 1;
  state.steps = 0;
}

/**
 * One physics step. Returns the largest node displacement — the caller stops
 * the rAF loop when it settles below ~0.35 units (battery-friendly sleep).
 *
 * Every force is scaled by `alpha` (d3-style): the layout starts lively,
 * cools down exponentially, and the damped integration actually comes to
 * REST — a constant force floor would oscillate forever and never settle.
 */
export function stepSimulation(state: SimulationState): { settled: boolean; maxDisplacement: number } {
  const t = state.tuning;
  const cx = state.width / 2;
  const cy = state.height / 2;
  const list = [...state.nodes.values()];
  const n = list.length;
  const alphaScale = state.alpha;

  const ax = new Map<string, number>();
  const ay = new Map<string, number>();
  for (const node of list) {
    ax.set(node.id, 0);
    ay.set(node.id, 0);
  }

  // gravity (much weaker in focus mode — anchors own the composition there)
  const g = (state.targets ? t.gravity * 0.15 : t.gravity) * alphaScale;
  for (const node of list) {
    ax.set(node.id, ax.get(node.id)! + (cx - node.x) * g);
    ay.set(node.id, ay.get(node.id)! + (cy - node.y) * g);
  }

  // link springs — the connections visibly behave like springs
  const springScale = state.targets ? 0.06 : 1; // anchors own focus mode
  for (const link of state.links) {
    const { a, b, weight } = link;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(0.01, Math.hypot(dx, dy));
    const tighten = Math.min(t.weightTightenCap, (weight - 1) * t.weightTighten);
    const rest = a.r + b.r + t.springGap - tighten;
    const force = Math.max(-30, Math.min(30, t.springK * (dist - rest) * alphaScale * springScale));
    const ux = (dx / dist) * force;
    const uy = (dy / dist) * force;
    // the focused circle never gets yanked by its own springs — it is the
    // center of the composition (its neighbors still feel the pull)
    if (a.id !== state.focusId) {
      ax.set(a.id, ax.get(a.id)! + ux);
      ay.set(a.id, ay.get(a.id)! + uy);
    }
    if (b.id !== state.focusId) {
      ax.set(b.id, ax.get(b.id)! - ux);
      ay.set(b.id, ay.get(b.id)! - uy);
    }
  }

  // radius-aware repulsion — bigger crews claim more room
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = list[i];
      const b = list[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        // deterministic tie-break (never random)
        dx = 0.01 * (i + 1);
        dy = -0.01 * (j + 1);
        dist = Math.hypot(dx, dy);
      }
      const meanR = (a.r + b.r) / 2;
      // in focus mode anchors own the composition — repulsion yields
      const cap = t.repulseCap * (state.targets ? 0.12 : 1);
      const force = Math.min(cap, (t.repulsion * meanR * meanR) / (dist * dist)) * alphaScale;
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      ax.set(a.id, ax.get(a.id)! + ux);
      ay.set(a.id, ay.get(a.id)! + uy);
      ax.set(b.id, ax.get(b.id)! - ux);
      ay.set(b.id, ay.get(b.id)! - uy);
    }
  }

  // focus anchors — soft springs toward the selection's rings. Deliberately
  // NOT scaled by alpha: global forces cool away, the anchors persist and
  // pull every circle to its ring no matter how long the travel is.
  if (state.targets) {
    for (const node of list) {
      const anchor = state.targets.get(node.id);
      if (!anchor || node.fx !== null) continue;
      ax.set(node.id, ax.get(node.id)! + (anchor.x - node.x) * t.targetK);
      ay.set(node.id, ay.get(node.id)! + (anchor.y - node.y) * t.targetK);
    }
  }

  // integrate (damped, speed-capped by the cooling budget)
  let maxDisplacement = 0;
  const speedCap = 0.5 + 23.5 * state.alpha;
  for (const node of list) {
    node.vx = (node.vx + ax.get(node.id)!) * t.damping;
    node.vy = (node.vy + ay.get(node.id)!) * t.damping;
    const speed = Math.hypot(node.vx, node.vy);
    if (speed > speedCap) {
      node.vx = (node.vx / speed) * speedCap;
      node.vy = (node.vy / speed) * speedCap;
    }
    if (node.fx !== null && node.fy !== null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.x += node.vx;
    node.y += node.vy;
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(node.vx, node.vy));
  }

  // HARD collision avoidance — circles never overlap, however you stir them.
  // Up to 6 passes: one sweep can push a later pair back into an earlier one,
  // and a packed canvas needs the extra sweeps to de-pile. A pushed node also
  // dissipates half its velocity — otherwise it re-integrates into the same
  // obstacle every frame and the layout never comes to rest.
  for (let pass = 0; pass < 6; pass += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = list[i];
        const b = list[j];
        const minDist = a.r + b.r + t.collisionPad;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = 0.01 * (j + 1);
          dy = 0.01 * (i + 1);
          dist = Math.hypot(dx, dy);
        }
        const overlap = minDist - dist;
        if (overlap <= 0) continue;
        const ux = dx / dist;
        const uy = dy / dist;
        const aPinned = a.fx !== null && a.fy !== null;
        const bPinned = b.fx !== null && b.fy !== null;
        if (aPinned && bPinned) continue;
        const share = aPinned || bPinned ? 1 : 0.5;
        if (!aPinned) {
          a.x -= ux * overlap * share;
          a.y -= uy * overlap * share;
          a.vx *= 0.5;
          a.vy *= 0.5;
        }
        if (!bPinned) {
          b.x += ux * overlap * share;
          b.y += uy * overlap * share;
          b.vx *= 0.5;
          b.vy *= 0.5;
        }
      }
    }
  }

  // walls — the proven hard clamp (overflowPad = 0), or the INFINITE AREA
  // soft boundary (overflowPad > 0): past the box edge a gentle spring pulls
  // the circle back, so collision pressure can push the network into the
  // world margin but it recovers once the pressure fades; a hard cap at
  // ±overflowPad keeps every circle reachable by the camera.
  const overflow = state.overflowPad;
  for (const node of list) {
    const m = node.r + BOUNDS_MARGIN;
    if (node.x < m) {
      if (overflow > 0) {
        node.vx += Math.min(14, (m - node.x) * 0.045);
        if (node.x < m - overflow) {
          node.x = m - overflow;
          node.vx = Math.abs(node.vx) * 0.5;
        }
      } else {
        node.x = m;
        node.vx = Math.abs(node.vx) * 0.5;
      }
    } else if (node.x > state.width - m) {
      if (overflow > 0) {
        node.vx -= Math.min(14, (node.x - (state.width - m)) * 0.045);
        if (node.x > state.width - m + overflow) {
          node.x = state.width - m + overflow;
          node.vx = -Math.abs(node.vx) * 0.5;
        }
      } else {
        node.x = state.width - m;
        node.vx = -Math.abs(node.vx) * 0.5;
      }
    }
    if (node.y < m) {
      if (overflow > 0) {
        node.vy += Math.min(14, (m - node.y) * 0.045);
        if (node.y < m - overflow) {
          node.y = m - overflow;
          node.vy = Math.abs(node.vy) * 0.5;
        }
      } else {
        node.y = m;
        node.vy = Math.abs(node.vy) * 0.5;
      }
    } else if (node.y > state.height - m) {
      if (overflow > 0) {
        node.vy -= Math.min(14, (node.y - (state.height - m)) * 0.045);
        if (node.y > state.height - m + overflow) {
          node.y = state.height - m + overflow;
          node.vy = -Math.abs(node.vy) * 0.5;
        }
      } else {
        node.y = state.height - m;
        node.vy = -Math.abs(node.vy) * 0.5;
      }
    }
  }

  // The wall clamp ABOVE can shove a node back INTO a neighbor (clamp runs
  // after the main passes) — one extra sweep guarantees every delivered frame
  // is overlap-free even when the sim freezes at the very next moment.
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = list[i];
      const b = list[j];
      const minDist = a.r + b.r + t.collisionPad;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        dx = 0.01 * (j + 1);
        dy = 0.01 * (i + 1);
        dist = Math.hypot(dx, dy);
      }
      const overlap = minDist - dist;
      if (overlap <= 0) continue;
      const ux = dx / dist;
      const uy = dy / dist;
      const aPinned = a.fx !== null && a.fy !== null;
      const bPinned = b.fx !== null && b.fy !== null;
      if (aPinned && bPinned) continue;
      const share = aPinned || bPinned ? 1 : 0.5;
      if (!aPinned) {
        a.x -= ux * overlap * share;
        a.y -= uy * overlap * share;
      }
      if (!bPinned) {
        b.x += ux * overlap * share;
        b.y += uy * overlap * share;
      }
    }
  }

  state.alpha = Math.max(0, state.alpha * (state.targets ? t.alphaDecayFocus : t.alphaDecay));
  state.steps += 1;

  // Settle on quiet frames — or on the hard step budget (residual sub-pixel
  // jitter against walls/collision must not keep the rAF loop awake forever).
  return { settled: maxDisplacement < 0.45 || state.steps > 900, maxDisplacement };
}

/**
 * Re-energize after an interaction (drag release, re-focus): the interaction
 * happened while alpha was asleep, so springs toward anchors would otherwise
 * never pull the released circle back. Bumps alpha to at least `min` and
 * re-arms the step budget.
 */
export function energize(state: SimulationState, min = 0.6): void {
  state.alpha = Math.max(state.alpha, min);
  state.steps = 0;
}

// ── handshake hops + ring layout (the «6 handshakes» hierarchy) ──────────────

/** Maximum modeled depth — the classic «anyone through ≤ 6 people» bound. */
export const HANDSHAKE_MAX_DEPTH = 6;

/**
 * Circle-size scaling by handshake depth (focus mode): the selection and its
 * direct neighbors render full-size, deeper rings shrink so even a 4-ring
 * chain fits the canvas with readable gaps. Index 0 = the selection.
 */
export const FOCUS_HOP_SCALE = [1, 0.9, 0.72, 0.52, 0.42, 0.36, 0.32] as const;

/**
 * BFS hop distances from the selected crew over the shared-people links.
 * Deterministic (adjacency built in link order). The selected node is 0;
 * unreachable crews are simply absent.
 */
export function hopDistances(selectedId: string, links: PhysicsLinkInput[]): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  const push = (from: string, to: string) => {
    const list = adjacency.get(from);
    if (list) {
      if (!list.includes(to)) list.push(to);
    } else {
      adjacency.set(from, [to]);
    }
  };
  for (const link of links) {
    if (link.source === link.target) continue;
    push(link.source, link.target);
    push(link.target, link.source);
  }

  const hops = new Map<string, number>([[selectedId, 0]]);
  let frontier = [selectedId];
  let hop = 0;
  while (frontier.length > 0) {
    hop += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (hops.has(neighbor)) continue;
        hops.set(neighbor, hop);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return hops;
}

export interface RingLayout {
  /** node id → anchor point (reachable nodes only). */
  anchors: Map<string, GraphPoint>;
  /** ringRadii[k] — radius of the hop-k ring (ring 0 = center). */
  ringRadii: number[];
  /** Deepest modeled hop (≤ HANDSHAKE_MAX_DEPTH). */
  maxHop: number;
  /** node id → its ring (hop, clamped to maxDepth). */
  ringOf: Map<string, number>;
}

/**
 * Deterministic ring layout around a selection:
 *   · ring radii accumulate from the REAL circle sizes (no ring is tighter
 *     than its biggest circles allow);
 *   · ring 1 spreads evenly; deeper rings fan around their BFS parent's
 *     angle — subtrees keep pointing at the parent they were reached
 *     through, so the hierarchy is readable;
 *   · hops beyond the depth cap collapse onto the outermost ring;
 *   · anchors are SOFT targets — the physics (collision + springs) cleans
 *     up whatever interleaving the fan produces.
 */
export function ringAnchors(
  selectedId: string,
  links: PhysicsLinkInput[],
  radii: Map<string, number>,
  opts?: { width?: number; height?: number; ringGap?: number; maxRing?: number },
): RingLayout {
  const width = opts?.width ?? 1000;
  const height = opts?.height ?? 1000;
  const ringGap = opts?.ringGap ?? 150;
  // Deep chains (hop > maxRing) collapse onto the outermost ring — a canvas
  // cannot fit 6 generous concentric bands of full-size circles, and the
  // hierarchy beyond ~4 hops adds no discovery value anyway.
  const maxRing = Math.min(HANDSHAKE_MAX_DEPTH, opts?.maxRing ?? 4);
  const cx = width / 2;
  const cy = height / 2;

  const hops = hopDistances(selectedId, links);
  const radiusOf = (id: string) => radii.get(id) ?? 60;

  // group by (clamped) ring, keep BFS discovery order for determinism
  const byRing: string[][] = [];
  const ringOf = new Map<string, number>();
  for (const [id, rawHop] of hops) {
    const ring = Math.min(rawHop, maxRing);
    ringOf.set(id, ring);
    (byRing[ring] ??= []).push(id);
  }

  // Ring radii — adaptive so DEEP hierarchies still fit the canvas:
  //   · per-ring MINIMUM spacing comes from the real circle sizes (+pad);
  //   · the desired ringGap is distributed across rings with whatever room
  //     remains between the selection and the canvas edge;
  //   · a shallow hierarchy gets the full airy gap, a deep one packs the
  //     outer rings tighter — bands stay monotonic, no ring can overflow
  //     (the component passes hop-scaled radii: deep circles are smaller).
  const maxRingRadius = (ring: string[]) => Math.max(0, ...ring.map(radiusOf));
  const depth = byRing.length - 1;
  // the outermost ring must leave room for its own biggest circle:
  // ringRadius[K] ≤ half - margin - maxR(K)
  const outerCap = Math.max(
    0,
    Math.min(width, height) / 2 - BOUNDS_MARGIN - maxRingRadius(byRing[depth] ?? []),
  );
  const minSizes: number[] = []; // per ring k: maxR(k-1) + maxR(k) + pad
  let minTotal = 0;
  for (let k = 1; k < byRing.length; k += 1) {
    const s = maxRingRadius(byRing[k - 1]) + maxRingRadius(byRing[k]) + PHYSICS_DEFAULTS.collisionPad;
    minSizes.push(s);
    minTotal += s;
  }
  const slack = Math.max(0, outerCap - radiusOf(selectedId) - minTotal);
  const extra = depth > 0 ? Math.min(ringGap, slack / depth) : 0;
  const ringRadii: number[] = [0];
  for (let k = 1; k < byRing.length; k += 1) {
    ringRadii[k] = ringRadii[k - 1] + minSizes[k - 1] + extra;
  }

  // BFS parents (first discoverer wins — deterministic via link order)
  const parentOf = new Map<string, string>();
  {
    const adjacency = new Map<string, string[]>();
    for (const link of links) {
      if (link.source === link.target) continue;
      (adjacency.get(link.source) ?? adjacency.set(link.source, []).get(link.source)!).push(link.target);
      (adjacency.get(link.target) ?? adjacency.set(link.target, []).get(link.target)!).push(link.source);
    }
    const seen = new Set<string>([selectedId]);
    let frontier = [selectedId];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (seen.has(neighbor)) continue;
          seen.add(neighbor);
          parentOf.set(neighbor, id);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
  }

  const angleOf = new Map<string, number>([[selectedId, -Math.PI / 2]]);
  const anchors = new Map<string, GraphPoint>();
  anchors.set(selectedId, { x: cx, y: cy });

  for (let k = 1; k < byRing.length; k += 1) {
    const ring = byRing[k];
    const step = Math.min(0.6, (2 * Math.PI) / Math.max(1, ring.length) * 1.15);

    if (k === 1) {
      // one parent (the selection) — spread the whole ring evenly
      ring.forEach((id, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring.length;
        angleOf.set(id, angle);
        anchors.set(id, { x: cx + ringRadii[k] * Math.cos(angle), y: cy + ringRadii[k] * Math.sin(angle) });
      });
      continue;
    }

    // fan children around their parent's angle, groups ordered by parent
    // angle (then discovery order) — the tree reads outward without crossings
    const groups = new Map<string, string[]>();
    for (const id of ring) {
      const parent = parentOf.get(id) ?? selectedId;
      (groups.get(parent) ?? groups.set(parent, []).get(parent)!).push(id);
    }
    const orderedParents = [...groups.keys()].sort((p, q) => {
      const ap = angleOf.get(p) ?? 0;
      const aq = angleOf.get(q) ?? 0;
      return ap - aq || (p < q ? -1 : 1);
    });
    for (const parent of orderedParents) {
      const children = groups.get(parent)!;
      const base = angleOf.get(parent) ?? -Math.PI / 2;
      // single-child chains would inherit the parent's angle EXACTLY and
      // stack into one radial ray — kink them alternately by depth so the
      // chain reads as a spiral, not a cannon barrel
      const kink = children.length === 1 ? (k % 2 === 0 ? 0.4 : -0.4) : 0;
      children.forEach((id, i) => {
        const angle = base + kink + (i - (children.length - 1) / 2) * step;
        angleOf.set(id, angle);
        anchors.set(id, { x: cx + ringRadii[k] * Math.cos(angle), y: cy + ringRadii[k] * Math.sin(angle) });
      });
    }
  }

  // clamp anchors inside the canvas (radius + margin)
  for (const [id, anchor] of anchors) {
    const m = radiusOf(id) + BOUNDS_MARGIN;
    anchor.x = Math.min(width - m, Math.max(m, anchor.x));
    anchor.y = Math.min(height - m, Math.max(m, anchor.y));
  }

  return { anchors, ringRadii, maxHop: Math.max(0, byRing.length - 1), ringOf };
}
