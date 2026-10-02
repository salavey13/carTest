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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Snowflake, Users, X } from "lucide-react";
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
}: {
  nodes: CrewNetworkNode[];
  links: CrewNetworkLink[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<SimulationState | null>(null);
  const activeRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const gRefs = useRef(new Map<string, SVGGElement>());
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  /** Per-circle label pair — the rAF painter flips it above the circle when
   *  the circle lives near the bottom edge (map-label style). */
  const labelRefs = useRef(new Map<string, { name: SVGTextElement | null; count: SVGTextElement | null }>());
  const panelRef = useRef<HTMLDivElement | null>(null);
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
      { width: VIEW, height: VIEW },
    );
  }, [links, renderRadii, selectedId]);

  const initialPositions = useMemo(
    () =>
      layoutCrewGraph(
        nodes.map((n) => n.crewId),
        links,
        { width: VIEW, height: VIEW, radii: baseRadii },
      ),
    [links, nodes, baseRadii],
  );

  const selected = nodes.find((n) => n.crewId === selectedId) ?? null;
  const simActive = nodes.length > 0 && nodes.length <= SIM_MAX_NODES;

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
        const flip = node.y > VIEW - node.r - 62;
        pair.name?.setAttribute("y", (flip ? -(node.r + 46) : node.r + 26).toFixed(1));
        pair.count?.setAttribute("y", (flip ? -(node.r + 26) : node.r + 46).toFixed(1));
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
        const init = initialPositions[n.crewId] ?? { x: VIEW / 2, y: VIEW / 2 };
        return {
          id: n.crewId,
          r: renderRadii[n.crewId] ?? 60,
          x: carried?.x ?? init.x,
          y: carried?.y ?? init.y,
        };
      }),
      links,
      { width: VIEW, height: VIEW },
    );
    if (focus && selectedId) {
      applyTargets(simRef.current, focus.anchors, selectedId);
    } else {
      applyTargets(simRef.current, null);
    }
    drawFrame();
    wakeRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, selectedId, simActive]);

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
      {/* Horizontally scrollable with a 640px canvas floor on phones; circles
          themselves are drag handles (touchmove is claimed only while a
          circle is actually grabbed). */}
      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_-40px_rgba(2,8,23,0.9)] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="relative min-w-[640px] sm:min-w-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
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
            <rect x="0" y="0" width={VIEW} height={VIEW} fill="transparent" onClick={() => setSelectedId(null)} />

            {/* focus guide rings — the «handshake» depth made visible */}
            {focus?.ringRadii.slice(1).map((r, i) => (
              <g key={`guide-${i}`} style={{ pointerEvents: "none" }}>
                <circle
                  cx={VIEW / 2}
                  cy={VIEW / 2}
                  r={r}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity="0.07"
                  strokeDasharray="2 10"
                />
                <text
                  x={VIEW / 2}
                  y={VIEW / 2 - r - 10}
                  textAnchor="middle"
                  fontSize="15"
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
                const flipLabel = point.y > VIEW - r - 62;
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(isSelected ? null : node.crewId);
                      }
                    }}
                    className={simActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
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
                    <circle r={r} fill={`url(#cg-${index})`} stroke={node.accent} strokeWidth="1.8" />
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
                      fontSize="21"
                      fontWeight="700"
                      fill={isSelected ? "#ffffff" : "rgba(255,255,255,0.85)"}
                      stroke="rgba(4,9,20,0.88)"
                      strokeWidth="5"
                      strokeLinejoin="round"
                      paintOrder="stroke"
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
                      fontSize="13.5"
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

          {!selected && (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white/45">
              Тапни по кругу — сеть перестроится вокруг него · круги можно таскать
            </p>
          )}
          {selected && (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white/45">
              Тап по фону — вернуться ко всей сети
            </p>
          )}
        </div>
      </div>
      {/* mobile pan affordance (phones hide overlay scrollbars) */}
      <p className="mt-2 text-center text-[11px] font-semibold text-white/35 sm:hidden" aria-hidden>
        Граф можно двигать вбок — потяните пальцем
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
                  <h2 className="truncate text-xl font-black">{selected.name}</h2>
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
