"use client";

// app/franchize/discovery/CrewDiscoveryGraph.tsx
//
// The beautiful-circles social graph, LIVE edition (boss 2026-10-02:
// «spread the circles properly… respread around selected circle on tap…
// spring physics for existing connections… circles draggable and collision
// aware… play with collapsibility»).
//
//   · circle = a crew, radius = its people (crewCircleRadius, sqrt scale);
//   · GLOBAL mode — radius-aware repulsion + link springs + hard collision
//     avoidance spread the circles properly; connections behave like springs
//     (stroke width follows the tension);
//   · tap a circle → FOCUS mode: BFS «handshake» hops re-lay the network into
//     concentric rings AROUND THE SELECTION — ring 1 = direct shared people,
//     ring 2 = one more handshake… (the «6 handshakes» idea, depth derived
//     from the tapped crew; deep hops collapse onto the outermost ring);
//   · every circle is DRAGGABLE — the rest of the network is shoved away by
//     collision; release springs it back (focus) or lets it float (global);
//   · physics = pure module crew-physics.ts (deterministic, no deps), driven
//     by a rAF loop that writes transforms/paths STRAIGHT to the DOM — React
//     never re-renders per frame, the loop sleeps when the graph settles;
//   · SSR renders the deterministic layoutCrewGraph positions; the client
//     physics takes over after hydration (no mismatch, zero randomness).
//   · collapsibility: the crew panel folds to its header row, the all-crews
//     cards live in a <details> on the page — no information overflow.
//   · typography round (boss 2026-10-03: «miniaturize circles, work on
//     typography, make it look neat»): circles are miniature color badges,
//     the text lives in a haloed two-line label block under each circle
//     (name + «N чел.» micro-caption, dark paint-order stroke keeps it
//     readable over links), connections slimmed to hairline springs —
//     structure first, paint second.
//   · codereview round: static mode (>80 crews) regains pointer
//     tap-to-focus (sim-off onClick fallback), guide-ring labels clear the
//     circles anchored at the ring top, the rAF painter skips redundant
//     label writes, and circles answer hover/keyboard-focus without a
//     single React re-render.
//   · wiki-dive round (boss 2026-10-04: «fullwidth circle area — more info
//     inside area, fit screen width on mobile, less scrolling»): the canvas
//     drops the 640px floor + sideways pan entirely — it is FULLWIDTH at
//     every viewport; stats pills + a legend card live INSIDE the canvas
//     overlay (optional props — the map-riders sheet keeps its own header
//     and passes nothing); the crew panel learns «Рукопожатия» — tappable
//     neighbor chips that re-focus the graph crew-to-crew, the wikipedia
//     dive made literal.
//
//   · regression round (boss 2026-10-04: «discovery page was kinda nuked…
//     circles disappeared, fix regression, circles back better than ever»):
//     TWO real defects shipped with the wiki round —
//     (1) the page paints its own dark world but bare h1/h2/h3 inherit the
//         GLOBAL --foreground, which is near-black under html.light →
//         headings rendered invisible for light-scheme visitors (the
//         «disappeared» look). Every heading on this page now carries
//         explicit light ink, and the page root pins a dark-scheme
//         --foreground triplet as a systemic guard;
//     (2) the ink-blowup multiplier (×1.6–2.1 on phones) made labels
//         outgrow the circles — an unreadable pile over a 1000-unit layout
//         squeezed into a 364px canvas. REPLACED by a viewBox shrink:
//         phones render the whole graph in a 640-unit box (the proven old
//         floor, minus the sideways pan) — circles, labels and links keep
//         the exact desktop proportions the boss approved, ink readable,
//         nothing overlaps. The in-canvas bottom hint moved BELOW the card
//         — the bottom edge is flip-label territory and text-over-text
//         there was the second pile-up.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, ChevronDown, Handshake, Info, Snowflake, Users, X } from "lucide-react";
import {
  crewCircleRadius,
  layoutCrewGraph,
  pluralRu,
  type CrewNetworkLink,
  type CrewNetworkNode,
} from "../lib/crew-network";
import {
  applyTargets,
  createSimulation,
  energize,
  FOCUS_HOP_SCALE,
  hopDistances,
  ringAnchors,
  stepSimulation,
  type SimulationState,
} from "../lib/crew-physics";

const VIEW = 1000;
/** Above this the graph renders static (physics is O(n²) per frame). */
const SIM_MAX_NODES = 80;
/** Screen-pixel distance before a press counts as a drag, not a tap. */
const TAP_SLOP_PX = 7;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function truncate(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}

/** Perceived luminance → pick readable ink over an accent. */
function inkFor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length < 6) return "#0b1220";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0b1220" : "#ffffff";
}

/** useLayoutEffect that does not warn during SSR. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function CrewDiscoveryGraph({
  nodes,
  links,
  peopleCount,
  connectionCount,
}: {
  nodes: CrewNetworkNode[];
  links: CrewNetworkLink[];
  /** Optional in-canvas stats — the discovery page passes them so the
   *  chips live INSIDE the circle area; the map-riders sheet renders its
   *  own header and omits these. */
  peopleCount?: number;
  connectionCount?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  /** viewBox edge of the canvas: 1000 on wide containers, 640 on phones.
   *  The whole graph (layout, sim, rings, labels) renders in the 640-unit
   *  box on narrow screens — desktop proportions, readable ink, zero
   *  sideways pan. SSR and the first client render use 1000; the
   *  ResizeObserver flips phones right after hydration (no mismatch). */
  const [view, setView] = useState(VIEW);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  /** painter reads the live box from the ref (no re-subscribe per frame) */
  const viewRef = useRef(VIEW);
  const simRef = useRef<SimulationState | null>(null);
  const activeRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const gRefs = useRef(new Map<string, SVGGElement>());
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  /** Per-circle label pair — the rAF painter flips it above the circle when
   *  the circle lives near the bottom edge (map-label style). The last-y
   *  caches let the painter skip redundant setAttribute churn at 60fps. */
  const labelRefs = useRef(
    new Map<string, { name: SVGTextElement | null; count: SVGTextElement | null; lastNameY?: string; lastCountY?: string }>(),
  );
  const panelRef = useRef<HTMLDivElement | null>(null);

  // fullwidth canvas: measure the CONTAINER — phones get the 640-unit box
  // (regression fix: ink proportions stay desktop-true, the sim layout
  // adapts, nothing needs a sideways pan or blown-up labels).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (width: number) => {
      const next = width >= 640 ? VIEW : 640;
      viewRef.current = next;
      setView((prev) => (prev === next ? prev : next));
    };
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      measure(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
    lastX: number;
    lastY: number;
    throwVX: number;
    throwVY: number;
  } | null>(null);

  // ── derived model (per render — selection switches modes) ─────────────────
  const baseRadii = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of nodes) map[node.crewId] = crewCircleRadius(node.memberCount);
    return map;
  }, [nodes]);

  const hops = useMemo(() => {
    if (!selectedId) return null;
    return hopDistances(
      selectedId,
      links.map((l) => ({ source: l.source, target: l.target, weight: l.weight })),
    );
  }, [links, selectedId]);

  /** Focus mode shrinks deep circles so even a 4-ring chain fits the canvas. */
  const renderRadii = useMemo(() => {
    if (!hops) return baseRadii;
    const map: Record<string, number> = {};
    for (const node of nodes) {
      const hop = hops.get(node.crewId);
      const scale = hop === undefined ? 0.3 : FOCUS_HOP_SCALE[Math.min(hop, 6)];
      map[node.crewId] = Math.round(baseRadii[node.crewId] * scale);
    }
    return map;
  }, [baseRadii, hops, nodes]);

  const focus = useMemo(() => {
    if (!selectedId || !hops) return null;
    return ringAnchors(
      selectedId,
      links.map((l) => ({ source: l.source, target: l.target, weight: l.weight })),
      new Map(Object.entries(renderRadii)),
      { width: view, height: view },
    );
  }, [links, renderRadii, selectedId, view]);

  /** Per-ring max rendered circle radius — guide labels must clear the
   *  circles anchored at the ring's top (the fan starts at -90°, so a
   *  circle IS anchored exactly where the label would sit). */
  const ringLabelClearance = useMemo(() => {
    if (!focus) return [] as number[];
    const maxR: number[] = [];
    for (const [id, ring] of focus.ringOf) {
      if (ring < 1) continue;
      maxR[ring] = Math.max(maxR[ring] ?? 0, renderRadii[id] ?? 0);
    }
    return maxR;
  }, [focus, renderRadii]);

  const initialPositions = useMemo(
    () =>
      layoutCrewGraph(
        nodes.map((n) => n.crewId),
        links,
        { width: view, height: view, radii: baseRadii },
      ),
    [links, nodes, baseRadii, view],
  );

  const selected = nodes.find((n) => n.crewId === selectedId) ?? null;
  const simActive = nodes.length > 0 && nodes.length <= SIM_MAX_NODES;

  /** «Рукопожатия» — crews sharing people with the selection, strongest
   *  first; tapping a chip re-focuses the graph on it (the wiki dive). */
  const neighbors = useMemo(() => {
    if (!selectedId) return [] as { node: CrewNetworkNode; weight: number }[];
    const byId = new Map(nodes.map((n) => [n.crewId, n]));
    const list: { node: CrewNetworkNode; weight: number }[] = [];
    for (const link of links) {
      const other =
        link.source === selectedId
          ? link.target
          : link.target === selectedId
            ? link.source
            : null;
      if (!other) continue;
      const node = byId.get(other);
      if (node) list.push({ node, weight: link.weight });
    }
    return list.sort((a, b) => b.weight - a.weight).slice(0, 12);
  }, [links, nodes, selectedId]);

  const selectedSet = useMemo(() => {
    if (!selectedId) return null;
    const incident = new Set<string>([selectedId]);
    for (const link of links) {
      if (link.source === selectedId) incident.add(link.target);
      if (link.target === selectedId) incident.add(link.source);
    }
    return incident;
  }, [links, selectedId]);

  // ── the frame painter: sim state → DOM (no React) ──────────────────────────
  const drawFrame = useCallback(() => {
    const st = simRef.current;
    if (!st) return;
    for (const node of st.nodes.values()) {
      const gEl = gRefs.current.get(node.id);
      gEl?.setAttribute("transform", `translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})`);
      // bottom-edge circles would clip their label block on the viewBox
      // border — flip it above the circle live (SSR render does the same
      // flip from the deterministic initial positions)
      const pair = labelRefs.current.get(node.id);
      if (pair) {
        const flip = node.y > viewRef.current - node.r - 62;
        const nameY = (flip ? -(node.r + 46) : node.r + 26).toFixed(1);
        const countY = (flip ? -(node.r + 26) : node.r + 46).toFixed(1);
        if (pair.lastNameY !== nameY) {
          pair.name?.setAttribute("y", nameY);
          pair.lastNameY = nameY;
        }
        if (pair.lastCountY !== countY) {
          pair.count?.setAttribute("y", countY);
          pair.lastCountY = countY;
        }
      }
    }
    for (const link of st.links) {
      const pathEl = pathRefs.current.get(`${link.a.id}-${link.b.id}`);
      if (!pathEl) continue;
      const dx = link.b.x - link.a.x;
      const dy = link.b.y - link.a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / dist;
      const uy = dy / dist;
      const x1 = link.a.x + ux * link.a.r;
      const y1 = link.a.y + uy * link.a.r;
      const x2 = link.b.x - ux * link.b.r;
      const y2 = link.b.y - uy * link.b.r;
      const mx = (x1 + x2) / 2 - uy * dist * 0.08;
      const my = (y1 + y2) / 2 + ux * dist * 0.08;
      pathEl.setAttribute(
        "d",
        `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      );
      // the spring stretches visibly under tension
      const rest = link.a.r + link.b.r + st.tuning.springGap;
      const tension = Math.max(0, (dist - rest) / rest);
      pathEl.setAttribute("stroke-width", Math.min(3.4, 1.05 + link.weight * 0.55 + tension * 1.6).toFixed(2));
    }
  }, []);

  // ── sim lifecycle: rebuild on structure/mode change, carry positions ───────
  useIsoLayoutEffect(() => {
    if (!simActive) {
      simRef.current = null;
      return;
    }
    const prev = simRef.current;
    simRef.current = createSimulation(
      nodes.map((n) => {
        const carried = prev?.nodes.get(n.crewId);
        const init = initialPositions[n.crewId] ?? { x: view / 2, y: view / 2 };
        return {
          id: n.crewId,
          r: renderRadii[n.crewId] ?? 60,
          x: carried?.x ?? init.x,
          y: carried?.y ?? init.y,
        };
      }),
      links,
      { width: view, height: view },
    );
    if (focus && selectedId) {
      applyTargets(simRef.current, focus.anchors, selectedId);
    } else {
      applyTargets(simRef.current, null);
    }
    drawFrame();
    wakeRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, selectedId, simActive, view]);

  // ── the rAF loop (mount once): run steps, paint, sleep when settled ────────
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const st = simRef.current;
      if (st) {
        const { settled } = stepSimulation(st);
        drawFrame();
        if (!settled) {
          raf = requestAnimationFrame(tick);
          return;
        }
      }
      activeRef.current = false;
    };
    wakeRef.current = () => {
      if (activeRef.current) return;
      activeRef.current = true;
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current();
    return () => {
      cancelAnimationFrame(raf);
      activeRef.current = false;
    };
  }, [drawFrame]);

  // drag on touch must not scroll the sheet/container mid-gesture
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current) event.preventDefault();
    };
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => svg.removeEventListener("touchmove", onTouchMove);
  }, []);

  // Esc → back to the whole network (keyboard parity with tap-outside)
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  // ── drag + tap handlers (per circle) ────────────────────────────────────────────
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  const onNodePointerDown = useCallback(
    (id: string) => (event: React.PointerEvent<SVGGElement>) => {
      if (!simRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // old WebView without pointer capture — drag still works via move events
      }
      const view = toView(event.clientX, event.clientY);
      const node = simRef.current.nodes.get(id);
      if (!view || !node) return;
      dragRef.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        lastX: view.x,
        lastY: view.y,
        throwVX: 0,
        throwVY: 0,
      };
      node.fx = view.x;
      node.fy = view.y;
      energize(simRef.current, 0.3);
      wakeRef.current?.();
    },
    [toView],
  );

  const onNodePointerMove = useCallback(
    (id: string) => (event: React.PointerEvent<SVGGElement>) => {
      const drag = dragRef.current;
      const st = simRef.current;
      if (!drag || drag.id !== id || !st) return;
      const view = toView(event.clientX, event.clientY);
      const node = st.nodes.get(id);
      if (!view || !node) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > TAP_SLOP_PX) {
        drag.moved = true;
      }
      node.fx = view.x;
      node.fy = view.y;
      // remember the gesture velocity — the release throws the circle
      drag.throwVX = Math.max(-9, Math.min(9, (view.x - drag.lastX) * 0.55));
      drag.throwVY = Math.max(-9, Math.min(9, (view.y - drag.lastY) * 0.55));
      drag.lastX = view.x;
      drag.lastY = view.y;
      wakeRef.current?.();
    },
    [toView],
  );

  const onNodePointerUp = useCallback(
    (id: string) => (event: React.PointerEvent<SVGGElement>) => {
      const drag = dragRef.current;
      const st = simRef.current;
      if (!drag || drag.id !== id || !st) return;
      const node = st.nodes.get(id);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // capture may already be gone (pointercancel) — harmless
      }
      dragRef.current = null;
      if (node) {
        node.fx = null;
        node.fy = null;
        if (drag.moved) {
          node.vx = drag.throwVX;
          node.vy = drag.throwVY;
        }
      }
      if (!drag.moved) {
        // a tap — toggle the focus
        setSelectedId((prev) => (prev === id ? null : id));
        energize(st, 0.7);
      } else {
        energize(st, 0.5);
      }
      wakeRef.current?.();
    },
    [],
  );

  // ── render ────────────────────────────────────────────────────────────────
  const selectedHops = hops;
  const dimOf = (id: string): number => {
    if (!selectedSet) return 1;
    if (selectedSet.has(id)) return 1;
    const hop = selectedHops?.get(id);
    if (hop === undefined) return 0.22; // unreachable island — fades out
    if (hop === 2) return 0.72;
    return 0.45;
  };

  return (
    <div className="mt-6">
      {/* ── the graph ─────────────────────────────────────────────────────── */}
      {/* FULLWIDTH at every viewport (wiki round — no 640px floor, no sideways
          pan); phones render the graph in a 640-unit viewBox so circles and
          labels keep the approved desktop proportions (regression round);
          circles themselves remain drag handles (touchmove is claimed only
          while a circle is grabbed). */}
      <div
        ref={wrapRef}
        className="relative rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_-40px_rgba(2,8,23,0.9)]"
      >
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${view} ${view}`}
            className="h-auto w-full select-none"
            role="group"
            aria-label="Социальный граф сети: круги — экипажи, линии — общие люди"
          >
            <defs>
              {nodes.map((node, index) => (
                <radialGradient key={node.crewId} id={`cg-${index}`} cx="35%" cy="30%" r="75%">
                  <stop offset="0%" stopColor={node.accent} stopOpacity="0.95" />
                  <stop offset="55%" stopColor={node.accent} stopOpacity="0.62" />
                  <stop offset="100%" stopColor={node.accent} stopOpacity="0.26" />
                </radialGradient>
              ))}
              {nodes.map((node, index) => (
                <clipPath key={node.crewId} id={`cp-${index}`}>
                  <circle cx="0" cy="0" r={(renderRadii[node.crewId] ?? 60) * 0.66} />
                </clipPath>
              ))}
            </defs>

            {/* tap-outside-to-deselect surface */}
            <rect x="0" y="0" width={view} height={view} fill="transparent" onClick={() => setSelectedId(null)} />

            {/* focus guide rings — the «handshake» depth made visible */}
            {focus?.ringRadii.slice(1).map((r, i) => (
              <g key={`guide-${i}`} style={{ pointerEvents: "none" }}>
                <circle
                  cx={view / 2}
                  cy={view / 2}
                  r={r}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.07"
                  strokeDasharray="2 10"
                />
                <text
                  x={view / 2}
                  y={view / 2 - r - (ringLabelClearance[i + 1] ?? 30) - 12}
                  textAnchor="middle"
                  fontSize={15}
                  fontWeight="700"
                  letterSpacing="2.5"
                  fill="#ffffff"
                  opacity="0.34"
                  stroke="rgba(4,9,20,0.85)"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {pluralRu(i + 1, ["шаг", "шага", "шагов"]).toUpperCase()}
                </text>
              </g>
            ))}

            {/* links (curved springs) */}
            <g>
              {links.map((link) => {
                const a = initialPositions[link.source];
                const b = initialPositions[link.target];
                if (!a || !b) return null;
                const active = selectedSet ? selectedSet.has(link.source) && selectedSet.has(link.target) : false;
                const dimmed = selectedSet !== null && !active;
                return (
                  <path
                    key={`${link.source}-${link.target}`}
                    ref={(el) => {
                      if (el) pathRefs.current.set(`${link.source}-${link.target}`, el);
                      else pathRefs.current.delete(`${link.source}-${link.target}`);
                    }}
                    fill="none"
                    stroke={active ? "#7dd3fc" : "#ffffff"}
                    strokeWidth={Math.min(3.4, 1.05 + link.weight * 0.55)}
                    strokeLinecap="round"
                    opacity={active ? 0.9 : dimmed ? 0.04 : Math.min(0.34, 0.1 + link.weight * 0.08)}
                    style={{ transition: "opacity 240ms ease, stroke 240ms ease" }}
                  />
                );
              })}
            </g>

            {/* crew circles */}
            <g>
              {nodes.map((node, index) => {
                const point = initialPositions[node.crewId];
                if (!point) return null;
                const r = renderRadii[node.crewId] ?? 60;
                const isSelected = node.crewId === selectedId;
                const dim = dimOf(node.crewId);
                const ink = inkFor(node.accent);
                // SSR/static flip decision — physics keeps it live afterwards
                const flipLabel = point.y > view - r - 62;
                // static fallback (>SIM_MAX_NODES): the sim sleeps, but a pointer
                // tap must still focus the circle — the onClick below only fires
                // when simActive is false, so it can never double-toggle the
                // pointer-capture tap path
                return (
                  <g
                    key={node.crewId}
                    ref={(el) => {
                      if (el) gRefs.current.set(node.crewId, el);
                      else gRefs.current.delete(node.crewId);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Экипаж ${node.name}: ${node.memberCount} чел., услуги: ${node.services.map((s) => s.label).join(", ") || "каталог"}`}
                    transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                    onPointerDown={simActive ? onNodePointerDown(node.crewId) : undefined}
                    onPointerMove={simActive ? onNodePointerMove(node.crewId) : undefined}
                    onPointerUp={simActive ? onNodePointerUp(node.crewId) : undefined}
                    onPointerCancel={simActive ? onNodePointerUp(node.crewId) : undefined}
                    onClick={simActive ? undefined : () => setSelectedId(isSelected ? null : node.crewId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(isSelected ? null : node.crewId);
                      }
                    }}
                    className={simActive ? "group cursor-grab active:cursor-grabbing" : "group cursor-pointer"}
                    style={{
                      opacity: dim,
                      transition: "opacity 240ms ease",
                    }}
                  >
                    {/* soft glow pad — a whisper, not a halo */}
                    <circle
                      r={r + (isSelected ? 16 : 8)}
                      fill={node.accent}
                      opacity={isSelected ? 0.22 : 0.1}
                      style={{ transition: "r 240ms ease, opacity 240ms ease" }}
                    />
                    {/* selection ring */}
                    {isSelected && (
                      <circle r={r + 6} fill="none" stroke="#ffffff" strokeWidth="1.6" strokeDasharray="4 6" opacity="0.85" />
                    )}
                    {/* the circle itself */}
                    <circle
                      r={r}
                      fill={`url(#cg-${index})`}
                      stroke={node.accent}
                      strokeWidth="1.8"
                      className="transition group-hover:brightness-110 group-focus-visible:brightness-125"
                    />
                    {/* logo (falls through to initials when absent/broken) */}
                    {node.logoUrl && (
                      <g clipPath={`url(#cp-${index})`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <image
                          href={node.logoUrl}
                          x={-r * 0.66}
                          y={-r * 0.66}
                          width={r * 1.32}
                          height={r * 1.32}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </g>
                    )}
                    {!node.logoUrl && (
                      <text
                        textAnchor="middle"
                        y={r * 0.14}
                        fontSize={Math.max(12, r * 0.42)}
                        fontWeight="800"
                        fill={ink}
                        opacity="0.95"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {initialsOf(node.name)}
                      </text>
                    )}
                    {/* label block under the circle — name + count micro-caption;
                        the dark paint-order halo keeps both readable over links
                        and neighbor labels (structure first, paint second) */}
                    <text
                      ref={(el) => {
                        const pair = labelRefs.current.get(node.crewId) ?? { name: null, count: null };
                        pair.name = el;
                        if (!pair.name && !pair.count) labelRefs.current.delete(node.crewId);
                        else labelRefs.current.set(node.crewId, pair);
                      }}
                      textAnchor="middle"
                      y={flipLabel ? -(r + 46) : r + 26}
                      fontSize={21}
                      fontWeight="700"
                      fill={isSelected ? "#ffffff" : "rgba(255,255,255,0.85)"}
                      stroke="rgba(4,9,20,0.88)"
                      strokeWidth="5"
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      className="transition group-hover:fill-white/95 group-focus-visible:fill-white"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {truncate(node.name, isSelected ? 24 : 16)}
                    </text>
                    <text
                      ref={(el) => {
                        const pair = labelRefs.current.get(node.crewId) ?? { name: null, count: null };
                        pair.count = el;
                        if (!pair.name && !pair.count) labelRefs.current.delete(node.crewId);
                        else labelRefs.current.set(node.crewId, pair);
                      }}
                      textAnchor="middle"
                      y={flipLabel ? -(r + 26) : r + 46}
                      fontSize={13.5}
                      fontWeight="600"
                      fill={isSelected ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.5)"}
                      stroke="rgba(4,9,20,0.85)"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {node.memberCount} чел.
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* ── in-canvas info overlay (wiki round): the circle area carries its
              own stats and legend — more info INSIDE the area, zero page
              scroll spent on chrome. pointer-events stay off except the
              legend button/card, so drag/tap never fights the overlay. ── */}
          {peopleCount != null && connectionCount != null && (
            <div
              className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex max-w-[calc(100%-3.5rem)] flex-wrap gap-1.5"
              aria-hidden
            >
              <span className="rounded-full border border-white/12 bg-[#0b1220]/75 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur-sm">
                {nodes.length} {pluralRu(nodes.length, ["экипаж", "экипажа", "экипажей"])}
              </span>
              <span className="rounded-full border border-white/12 bg-[#0b1220]/75 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur-sm">
                {peopleCount} {pluralRu(peopleCount, ["человек", "человека", "человек"])}
              </span>
              <span className="rounded-full border border-white/12 bg-[#0b1220]/75 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur-sm">
                {connectionCount} {pluralRu(connectionCount, ["связь", "связи", "связей"])}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            aria-expanded={legendOpen}
            aria-label={legendOpen ? "Скрыть легенду графа" : "Как читать граф"}
            className="absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0b1220]/75 text-white/75 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
          >
            {legendOpen ? <X className="h-4 w-4" aria-hidden /> : <Info className="h-4 w-4" aria-hidden />}
          </button>
          <AnimatePresence initial={false}>
            {legendOpen && (
              <motion.div
                key="legend-card"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-x-2.5 top-12 z-20 rounded-2xl border border-white/12 bg-[#0b1220]/92 p-4 shadow-2xl backdrop-blur-md"
                role="dialog"
                aria-label="Легенда графа сети"
              >
                <p className="text-xs font-black uppercase tracking-wide text-white/70">Как читать граф</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/75">
                  <li>⬤ Круг — целый экипаж; размер — сколько в нём людей</li>
                  <li>⌇ Линия — общие люди между двумя экипажами</li>
                  <li>◎ Кольца — «рукопожатия» от выбранного круга (1 шаг, 2 шага…)</li>
                  <li>✋ Круги можно таскать — остальные расступаются</li>
                  <li>☞ Тап по кругу — фокус; тап по фону — вся сеть снова</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="#howto"
                    onClick={() => setLegendOpen(false)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-sky-300/40 bg-sky-400/15 px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:brightness-125"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden /> Как это работает
                  </a>
                  <a
                    href="#all-crews"
                    onClick={() => setLegendOpen(false)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-white/80 transition hover:border-white/40"
                  >
                    Все экипажи сети
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* hint lives BELOW the canvas — the canvas bottom edge is flip-label
          territory, an in-canvas hint there collided with crew labels
          (regression round: the second pile-up) */}
      <p className="mt-2 text-center text-xs font-semibold text-white/45" aria-hidden>
        {selected
          ? "Тап по фону — вернуться ко всей сети"
          : "Тапни по кругу — сеть перестроится вокруг него · круги можно таскать"}
      </p>

      {/* ── detail panel (collapsible) ─────────────────────────────────────── */}
      <div ref={panelRef}>
        {selected ? (
          <section
            aria-label={`Экипаж ${selected.name}`}
            className="mt-4 rounded-3xl border border-white/12 bg-white/[0.07] p-5 backdrop-blur-md md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-expanded={panelOpen}
              >
                {selected.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.logoUrl}
                    alt=""
                    width={52}
                    height={52}
                    className="rounded-2xl object-cover"
                    style={{ height: 52, width: 52, boxShadow: `0 0 0 2px ${selected.accent}66` }}
                  />
                ) : (
                  <span
                    className="flex items-center justify-center rounded-2xl text-lg font-black"
                    style={{ height: 52, width: 52, backgroundColor: `${selected.accent}26`, color: selected.accent }}
                  >
                    {initialsOf(selected.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-white">{selected.name}</h2>
                  <p className="text-xs font-semibold text-white/60">
                    {selected.memberCount}{" "}
                    {pluralRu(selected.memberCount, ["человек", "человека", "человек"])} в экипаже
                    {focus && focus.maxHop >= 1 && (
                      <span className="text-white/45">
                        {" "}
                        · до любого круга — ≤ {focus.maxHop}{" "}
                        {pluralRu(focus.maxHop, ["шаг", "шага", "шагов"])}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronDown
                  className={`ml-auto h-5 w-5 shrink-0 text-white/50 transition-transform ${panelOpen ? "" : "-rotate-90"}`}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Закрыть карточку экипажа"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {panelOpen && (
                <motion.div
                  key="panel-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  className="overflow-hidden"
                >
                  {selected.description && (
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{selected.description}</p>
                  )}

                  {/* services — the whole point of the network */}
                  {selected.services.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selected.services.map((service) => (
                        <Link
                          key={service.key}
                          href={service.href}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition hover:brightness-125"
                          style={{
                            borderColor: `${selected.accent}66`,
                            color: selected.accent,
                            backgroundColor: `${selected.accent}14`,
                          }}
                        >
                          {service.key === "storage" ? <Snowflake className="h-4 w-4" aria-hidden /> : null}
                          {service.label}
                          {service.sub && <span className="font-medium opacity-75">· {service.sub}</span>}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* handshake chips — the wikipedia dive: hop crew-to-crew via
                      shared people without ever leaving the graph */}
                  {neighbors.length > 0 && (
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/55">
                        <Handshake className="h-3.5 w-3.5" aria-hidden /> Рукопожатия · {neighbors.length}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {neighbors.map(({ node: crew, weight }) => (
                          <button
                            key={crew.crewId}
                            type="button"
                            onClick={() => setSelectedId(crew.crewId)}
                            aria-label={`Переключить фокус на экипаж ${crew.name}: ${weight} общих людей`}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] py-1 pl-2 pr-3 text-xs font-bold text-white/85 transition hover:border-white/35 hover:bg-white/[0.1]"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: crew.accent }}
                              aria-hidden
                            />
                            {truncate(crew.name, 18)}
                            <span className="font-semibold text-white/50">· {weight} общ.</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* people */}
                  {selected.members.length > 0 && (
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/55">
                        <Users className="h-3.5 w-3.5" aria-hidden /> Люди экипажа
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {selected.members.slice(0, 8).map((member) => (
                          <span
                            key={member.userId}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] py-1 pl-1 pr-2.5 text-xs font-semibold text-white/80"
                          >
                            {member.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={member.avatarUrl}
                                alt=""
                                width={22}
                                height={22}
                                className="h-[22px] w-[22px] rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/12 text-[9px] font-black">
                                {initialsOf(member.name)}
                              </span>
                            )}
                            {truncate(member.name, 20)}
                          </span>
                        ))}
                        {selected.memberCount > 8 && (
                          <span className="text-xs font-semibold text-white/55">
                            и ещё {selected.memberCount - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* links row */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/franchize/${selected.slug}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition hover:brightness-110 sm:flex-none"
                      style={{ backgroundColor: selected.accent, color: inkFor(selected.accent) }}
                    >
                      Открыть экипаж <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      href={`/franchize/${selected.slug}/community`}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40"
                    >
                      Стена
                    </Link>
                    <Link
                      href={`/franchize/${selected.slug}/about`}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40"
                    >
                      О экипаже
                    </Link>
                    <Link
                      href={`/franchize/${selected.slug}/map-riders`}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40"
                    >
                      Live-карта
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <p className="mt-3 text-center text-xs text-white/40" aria-hidden>
            Круг — экипаж · размер — люди · линия — общие люди · тап — фокус на рукопожатиях
          </p>
        )}
      </div>
    </div>
  );
}
