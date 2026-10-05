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
//
//   · INFINITE AREA + service satellites (boss 2026-10-04: «maybe by tapping
//     on circle we can spawn respective services as circles as well and kinda
//     connect to circles that have similar services… try to make kinda
//     infinite area for these circles, to let circles not clamp and have
//     some free real estate for additional infographics»):
//     — the canvas becomes an infinite-canvas WORLD: a camera (pan by
//       dragging the background, pinch on touch, ⌘/Ctrl+wheel zoom, zoom
//       buttons) moves a transformed world group over a dot-grid floor; the
//       physics gets soft walls (crew-physics overflowPad) so circles
//       breathe past the visible box instead of clamping against it;
//     — TAP A CREW → its services SPAWN as satellite circles around it
//       (label + sub + «+N в сети»), and ring-1 crews offering the SAME
//       service spawn a smaller satellite of their own, connected to the
//       selection's satellite by a dashed service-colored affinity edge —
//       the «similar services» constellation made literal (best practice:
//       progressive disclosure — satellites exist only in focus mode, so
//       the global network stays calm);
//     — the freed world margin hosts TWO INFOGRAPHIC STATIONS outside the
//       visible box («Услуги сети» — every service with its strongest
//       crews; «Рукопожатия-рекорды» — the top shared-people links), one
//       camera-chip tap away (Граф · Услуги · Рекорды); tapping a row
//       focuses that crew — the wikipedia dive now has a map.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bike,
  BookOpen,
  Camera,
  ChevronDown,
  Handshake,
  Info,
  LocateFixed,
  Network,
  Snowflake,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  crewCircleRadius,
  layoutCrewGraph,
  pluralRu,
  type CrewNetworkBlogger,
  type CrewNetworkBloggerLink,
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

/** INFINITE AREA — how far the world extends beyond the visible box (share
 *  of the view edge, each side). Circles breathe into this margin via the
 *  physics soft walls, and the infographic stations live out here; the
 *  camera (pan/pinch/wheel/chips) reaches everything. */
const WORLD_OVERFLOW_RATIO = 0.35;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.4;
/** World infographic stations (right: services, left: handshake records). */
const STATION_W = 320;
const STATION_GAP = 96;
const STATION_TOP = 96;

/** Service satellite paint/icons — keyed by CrewServiceKey. */
const SERVICE_META: Record<string, { color: string; icon: LucideIcon; short: string }> = {
  rent: { color: "#7dd3fc", icon: Bike, short: "Аренда" },
  storage: { color: "#93c5fd", icon: Snowflake, short: "Хранение" },
};

/** Blogger satellite paint — the «blue product» color (boss's metaphor:
 *  electrobikes carry the BLUE logo; the distribution layer wears it too). */
const BLOGGER_COLOR = "#60a5fa";
const BLOGGER_SAT_CAP = 5;
const BLOGGER_STATION_GAP = 36;
const BLOGGER_STATION_TOP = STATION_TOP + 520 + BLOGGER_STATION_GAP;

/** A service satellite spawned around a crew (focus mode). */
interface SatSpec {
  key: string;
  label: string;
  sub: string | null;
  href: string;
  r: number;
  /** Offset from the crew circle center (world units) — the satellite is
   *  rendered INSIDE the crew's <g>, so it rides along for free. */
  ox: number;
  oy: number;
  primary: boolean;
  aria: string;
  /** Blogger satellites carry the person — the renderer paints avatar,
   *  rarity stars and the blue product ring instead of a service glyph. */
  blogger?: CrewNetworkBlogger;
  /** Public posts by this author on the FOCUSED crew's wall. */
  focusPosts?: number;
}

/** A dashed «similar services» edge: selected crew's satellite ↔ a ring-1
 *  crew's satellite of the same service. Offsets are crew-local; the painter
 *  resolves world positions from the live simulation every frame. */
interface ServiceEdgeSpec {
  key: string;
  serviceKey: string;
  /** «blogger» edges ride the same painter but render thin-solid blue. */
  kind: "service" | "blogger";
  aId: string;
  bId: string;
  oax: number;
  oay: number;
  obx: number;
  oby: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

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
  bloggers = [],
  bloggerLinks = [],
}: {
  nodes: CrewNetworkNode[];
  links: CrewNetworkLink[];
  /** Optional in-canvas stats — the discovery page passes them so the
   *  chips live INSIDE the circle area; the map-riders sheet renders its
   *  own header and omits these. */
  peopleCount?: number;
  connectionCount?: number;
  /** Distribution layer (2026-10-05): wall bloggers + their crew ties.
   *  Optional — older consumers (tests, storybook-ish usages) keep working. */
  bloggers?: CrewNetworkBlogger[];
  bloggerLinks?: CrewNetworkBloggerLink[];
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

  // ── INFINITE AREA camera + service-edge refs ──────────────────────────
  const router = useRouter();
  /** camera: world→screen is translate(x y) scale(k); home = identity. */
  const camRef = useRef({ x: 0, y: 0, k: 1 });
  const camTweenRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const worldRef = useRef<SVGGElement | null>(null);
  /** background pan / two-finger pinch (svg-level — circles stopPropagation) */
  const panRef = useRef<{ id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  /** dashed service-affinity edges — the painter keeps them glued to the
   *  satellites while the network moves; meta is synced per render. */
  const serviceEdgeRefs = useRef(new Map<string, SVGPathElement>());
  const serviceEdgeMeta = useRef(
    new Map<string, { aId: string; bId: string; oax: number; oay: number; obx: number; oby: number }>(),
  );

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

  // ── camera primitives (declared before the painter — the rAF tick drives
  //    camera tweens first, then the physics) ────────────────────────────
  const clampZoom = useCallback((k: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k)), []);
  const applyCamera = useCallback(() => {
    const cam = camRef.current;
    worldRef.current?.setAttribute(
      "transform",
      `translate(${cam.x.toFixed(2)} ${cam.y.toFixed(2)}) scale(${cam.k.toFixed(4)})`,
    );
  }, []);
  const tweenCameraTo = useCallback(
    (x: number, y: number, k: number) => {
      camTweenRef.current = { x, y, k: clampZoom(k) };
      wakeRef.current?.();
    },
    [clampZoom],
  );
  const tweenHome = useCallback(() => {
    camTweenRef.current = { x: 0, y: 0, k: 1 };
    wakeRef.current?.();
  }, []);

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
  /** World margin beyond the visible box (soft walls + station real estate). */
  const overflowPad = Math.round(view * WORLD_OVERFLOW_RATIO);

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

  // ── bloggers (distribution layer): who posts on whose wall ──────────────
  const bloggersById = useMemo(() => new Map(bloggers.map((b) => [b.userId, b])), [bloggers]);

  /** crewId → its wall bloggers, strongest voice first (deterministic). */
  const bloggersByCrew = useMemo(() => {
    const map = new Map<string, { blogger: CrewNetworkBlogger; posts: number }[]>();
    for (const tie of bloggerLinks) {
      const blogger = bloggersById.get(tie.userId);
      if (!blogger) continue;
      const list = map.get(tie.crewId) ?? [];
      list.push({ blogger, posts: tie.postCount });
      map.set(tie.crewId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.blogger.rarityScore - a.blogger.rarityScore || b.posts - a.posts);
    }
    return map;
  }, [bloggersById, bloggerLinks]);

  /** userId → in-graph crews the blogger posts on (the distribution web). */
  const crewsByBlogger = useMemo(() => {
    const map = new Map<string, { crewId: string; posts: number }[]>();
    for (const tie of bloggerLinks) {
      const list = map.get(tie.userId) ?? [];
      list.push({ crewId: tie.crewId, posts: tie.postCount });
      map.set(tie.userId, list);
    }
    return map;
  }, [bloggerLinks]);

  /** The blogger's strongest in-graph crew (most posts, deterministic tie) —
   *  the «Блогеры» station focuses the graph there on tap. */
  const topCrewOfBlogger = useCallback(
    (blogger: CrewNetworkBlogger): string | null => {
      const ties = (crewsByBlogger.get(blogger.userId) ?? [])
        .slice()
        .sort((a, b) => b.posts - a.posts || (a.crewId < b.crewId ? -1 : 1));
      return ties[0]?.crewId ?? blogger.crewIds[0] ?? null;
    },
    [crewsByBlogger],
  );

  // ── service satellites (INFINITE ROUND) ────────────────────────────────
  /** Focus-mode service model: the selection's own services + ring-1 crews
   *  offering the SAME service («similar services» kin), capped, strongest
   *  handshake first; plus network-wide per-service totals for «+N в сети». */
  const focusServices = useMemo(() => {
    if (!selectedId) return null;
    const sel = nodes.find((n) => n.crewId === selectedId);
    if (!sel || sel.services.length === 0) return null;
    const byId = new Map(nodes.map((n) => [n.crewId, n]));
    const kinByService = new Map<string, { node: CrewNetworkNode; weight: number }[]>();
    for (const service of sel.services) {
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
        if (node && node.services.some((s) => s.key === service.key)) {
          list.push({ node, weight: link.weight });
        }
      }
      list.sort((a, b) => b.weight - a.weight || (a.node.crewId < b.node.crewId ? -1 : 1));
      kinByService.set(service.key, list.slice(0, 4));
    }
    const totalByService = new Map<string, number>();
    for (const node of nodes) {
      for (const s of node.services) {
        totalByService.set(s.key, (totalByService.get(s.key) ?? 0) + 1);
      }
    }
    return { sel, kinByService, totalByService };
  }, [links, nodes, selectedId]);

  /** Satellite geometry — deterministic (angles derive from the SSR-stable
   *  initialPositions), so SSR markup and client first render agree. */
  const satelliteModel = useMemo(() => {
    const satsByCrew = new Map<string, SatSpec[]>();
    const edges: ServiceEdgeSpec[] = [];
    if (!selectedId || !focusServices) return { satsByCrew, edges };
    const { sel, kinByService, totalByService } = focusServices;
    const selInit = initialPositions[sel.crewId] ?? { x: view / 2, y: view / 2 };

    // the selection spawns ALL its services, fanned around the top
    const count = sel.services.length;
    sel.services.forEach((service, i) => {
      const meta = SERVICE_META[service.key];
      const angle = -Math.PI / 2 + ((i - (count - 1) / 2) * 58 * Math.PI) / 180;
      const satR = 30;
      const orbit = (renderRadii[sel.crewId] ?? 60) + satR + 34;
      const ox = orbit * Math.cos(angle);
      const oy = orbit * Math.sin(angle);
      const shown = kinByService.get(service.key) ?? [];
      const plus = Math.max(0, (totalByService.get(service.key) ?? 0) - 1 - shown.length);
      const sub = [service.sub ?? null, plus > 0 ? `+${plus} в сети` : null].filter(Boolean).join(" · ") || null;
      const list = satsByCrew.get(sel.crewId) ?? [];
      list.push({
        key: service.key,
        label: meta?.short ?? service.label,
        sub,
        href: service.href,
        r: satR,
        ox,
        oy,
        primary: true,
        aria: `Услуга «${service.label}» экипажа ${sel.name}${sub ? ` — ${sub}` : ""}`,
      });
      satsByCrew.set(sel.crewId, list);
    });

    // neighbors sharing a service spawn a smaller satellite of THEIR own,
    // pointed at the selection — the dashed affinity edge connects the pair
    for (const service of sel.services) {
      const meta = SERVICE_META[service.key];
      const selSat = satsByCrew.get(sel.crewId)?.find((s) => s.key === service.key);
      if (!selSat || !meta) continue;
      for (const { node } of kinByService.get(service.key) ?? []) {
        if (satsByCrew.has(node.crewId)) continue; // one satellite per crew
        const init = initialPositions[node.crewId];
        if (!init) continue;
        const angle = Math.atan2(selInit.y - init.y, selInit.x - init.x);
        const satR = 22;
        const orbit = (renderRadii[node.crewId] ?? 60) + satR + 26;
        const ox = orbit * Math.cos(angle);
        const oy = orbit * Math.sin(angle);
        satsByCrew.set(node.crewId, [
          {
            key: service.key,
            label: meta.short,
            sub: null,
            href: service.key === "storage" ? `/franchize/${node.slug}/storage` : `/franchize/${node.slug}`,
            r: satR,
            ox,
            oy,
            primary: false,
            aria: `Похожая услуга «${service.label}» у экипажа ${node.name}`,
          },
        ]);
        edges.push({
          key: `se-${service.key}-${node.crewId}`,
          serviceKey: service.key,
          kind: "service",
          aId: sel.crewId,
          bId: node.crewId,
          oax: selSat.ox,
          oay: selSat.oy,
          obx: ox,
          oby: oy,
          ax: selInit.x + selSat.ox,
          ay: selInit.y + selSat.oy,
          bx: init.x + ox,
          by: init.y + oy,
        });
      }
    }
    // ── bloggers of the selection spawn BELOW (services fan above): every
    //    wall author becomes a person satellite; a blogger who also posts on
    //    OTHER crews in-graph gets a dashed blue edge to each of them — the
    //    distribution web made literal (boss 2026-10-05: «connect bloggers
    //    with crews», the blue-product coverage push).
    const selBloggers = (bloggersByCrew.get(sel.crewId) ?? []).slice(0, BLOGGER_SAT_CAP);
    const selRadius = renderRadii[sel.crewId] ?? 60;
    selBloggers.forEach(({ blogger, posts }, i) => {
      const angle = Math.PI / 2 + ((i - (selBloggers.length - 1) / 2) * 34 * Math.PI) / 180;
      const satR = 26;
      const orbit = selRadius + satR + 34;
      const ox = orbit * Math.cos(angle);
      const oy = orbit * Math.sin(angle);
      const extraCrews = Math.max(0, blogger.crewIds.length - 1);
      const sub = [
        `★${blogger.rarityStars}`,
        pluralRu(blogger.postCount, ["пост", "поста", "постов"]),
        extraCrews > 0 ? `+${extraCrews} ${pluralRu(extraCrews, ["экипаж", "экипажа", "экипажей"])}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const spec: SatSpec = {
        key: `blogger-${blogger.userId}`,
        label: blogger.name,
        sub,
        href: `/franchize/${sel.slug}/rider/${blogger.userId}`,
        r: satR,
        ox,
        oy,
        primary: true,
        aria: `Блогер ${blogger.name}: ${pluralRu(posts, ["пост", "поста", "постов"])} на стене этого экипажа, редкость ${blogger.rarityStars} из 5`,
        blogger,
        focusPosts: posts,
      };
      const list = satsByCrew.get(sel.crewId) ?? [];
      list.push(spec);
      satsByCrew.set(sel.crewId, list);

      // distribution edges: blogger → every other in-graph crew they post on
      const others = (crewsByBlogger.get(blogger.userId) ?? []).filter((tie) => tie.crewId !== sel.crewId);
      for (const tie of others) {
        const otherInit = initialPositions[tie.crewId];
        if (!otherInit) continue; // tie to a crew outside the graph — skip
        edges.push({
          key: `bl-${blogger.userId}-${tie.crewId}`,
          serviceKey: "blogger",
          kind: "blogger",
          aId: sel.crewId,
          bId: tie.crewId,
          oax: ox,
          oay: oy,
          obx: 0,
          oby: 0,
          ax: selInit.x + ox,
          ay: selInit.y + oy,
          bx: otherInit.x,
          by: otherInit.y,
        });
      }
    });
    return { satsByCrew, edges };
  }, [focusServices, initialPositions, renderRadii, selectedId, view, bloggersByCrew, crewsByBlogger]);

  // ── world stations: the freed margin hosts real infographics ──────────
  const stationById = useMemo(() => new Map(nodes.map((n) => [n.crewId, n])), [nodes]);

  const stationServices = useMemo(() => {
    const order = ["rent", "storage"];
    const byKey = new Map<string, CrewNetworkNode[]>();
    for (const node of nodes) {
      for (const service of node.services) {
        const list = byKey.get(service.key) ?? [];
        list.push(node);
        byKey.set(service.key, list);
      }
    }
    return [...byKey.entries()]
      .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([key, list]) => ({
        key,
        crews: [...list].sort((a, b) => b.memberCount - a.memberCount).slice(0, 4),
        total: list.length,
      }));
  }, [nodes]);

  const stationRecords = useMemo(() => [...links].sort((a, b) => b.weight - a.weight).slice(0, 3), [links]);

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
    // service-affinity edges follow their satellites (crew motion included)
    for (const [key, meta] of serviceEdgeMeta.current) {
      const edgeEl = serviceEdgeRefs.current.get(key);
      if (!edgeEl) continue;
      const a = st.nodes.get(meta.aId);
      const b = st.nodes.get(meta.bId);
      if (!a || !b) continue;
      edgeEl.setAttribute(
        "d",
        `M ${(a.x + meta.oax).toFixed(1)} ${(a.y + meta.oay).toFixed(1)} L ${(b.x + meta.obx).toFixed(1)} ${(b.y + meta.oby).toFixed(1)}`,
      );
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
      { width: view, height: view, overflowPad: Math.round(view * WORLD_OVERFLOW_RATIO) },
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

  // ── the rAF loop (mount once): camera tweens + sim steps + paint, sleeps
  //    when everything settled ─────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let busy = false;
      const tween = camTweenRef.current;
      if (tween) {
        const cam = camRef.current;
        const nx = cam.x + (tween.x - cam.x) * 0.16;
        const ny = cam.y + (tween.y - cam.y) * 0.16;
        const nk = cam.k + (tween.k - cam.k) * 0.16;
        if (Math.abs(tween.x - nx) < 0.4 && Math.abs(tween.y - ny) < 0.4 && Math.abs(tween.k - nk) < 0.002) {
          cam.x = tween.x;
          cam.y = tween.y;
          cam.k = tween.k;
          camTweenRef.current = null;
        } else {
          cam.x = nx;
          cam.y = ny;
          cam.k = nk;
          busy = true;
        }
        applyCamera();
      }
      const st = simRef.current;
      if (st) {
        const { settled } = stepSimulation(st);
        drawFrame();
        if (!settled) busy = true;
      }
      if (busy) {
        raf = requestAnimationFrame(tick);
        return;
      }
      activeRef.current = false;
    };
    wakeRef.current = () => {
      if (activeRef.current) return;
      activeRef.current = true;
      raf = requestAnimationFrame(tick);
    };
    applyCamera();
    wakeRef.current();
    return () => {
      cancelAnimationFrame(raf);
      activeRef.current = false;
    };
  }, [drawFrame, applyCamera]);

  // keep the painter's service-edge meta in sync with the rendered model
  useIsoLayoutEffect(() => {
    serviceEdgeMeta.current = new Map(
      satelliteModel.edges.map((edge) => [
        edge.key,
        { aId: edge.aId, bId: edge.bId, oax: edge.oax, oay: edge.oay, obx: edge.obx, oby: edge.oby },
      ]),
    );
  }, [satelliteModel]);

  // drag on touch must not scroll the sheet/container mid-gesture — and the
  // infinite-area gestures (background pan / pinch) claim the gesture too
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current) event.preventDefault();
      else if (panRef.current || pinchRef.current) event.preventDefault();
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

  // a fresh focus re-centers the world (rings compose around the middle)
  useEffect(() => {
    if (selectedId) tweenHome();
  }, [selectedId, tweenHome]);

  // ── drag + tap handlers (per circle) ────────────────────────────────────────────
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  // ── infinite-area gestures: pan / pinch / wheel-zoom / zoom buttons ──────
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const cam = camRef.current;
      const k = clampZoom(cam.k * factor);
      const eff = k / cam.k;
      camTweenRef.current = null;
      cam.x = px - (px - cam.x) * eff;
      cam.y = py - (py - cam.y) * eff;
      cam.k = k;
      applyCamera();
    },
    [applyCamera, clampZoom],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const cam = camRef.current;
      const k = clampZoom(cam.k * factor);
      const wx = (view / 2 - cam.x) / cam.k;
      const wy = (view / 2 - cam.y) / cam.k;
      tweenCameraTo(view / 2 - k * wx, view / 2 - k * wy, k);
    },
    [clampZoom, tweenCameraTo, view],
  );

  const focusStation = useCallback(
    (which: "services" | "records" | "bloggers") => {
      const x = which === "services" || which === "bloggers" ? view + STATION_GAP : -(STATION_GAP + STATION_W);
      const y = which === "bloggers" ? BLOGGER_STATION_TOP : STATION_TOP;
      // bloggers card is taller (480) — aim a bit lower so the header row
      // stays inside the focus window (the services 520-card had the same
      // cut-off and lived with it; the bloggers station gets the fix)
      const aimY = y + (which === "bloggers" ? 235 : 170);
      const k = clampZoom(Math.min(1.1, (view * 0.6) / STATION_W));
      tweenCameraTo(view / 2 - k * (x + STATION_W / 2), view / 2 - k * aimY, k);
    },
    [clampZoom, tweenCameraTo, view],
  );

  /** svg-level handlers — circles/panels stopPropagation, so reaching here
   *  means the BACKGROUND (world floor) is pressed: pan, pinch or tap-out. */
  const onSurfacePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        svg.setPointerCapture(event.pointerId);
      } catch {
        // old WebView without pointer capture — gestures still work inside
      }
      if (pointersRef.current.size === 2) {
        const [p1, p2] = [...pointersRef.current.values()];
        const v1 = toView(p1.x, p1.y);
        const v2 = toView(p2.x, p2.y);
        if (v1 && v2) {
          pinchRef.current = {
            lastDist: Math.max(1, Math.hypot(v2.x - v1.x, v2.y - v1.y)),
            lastMidX: (v1.x + v2.x) / 2,
            lastMidY: (v1.y + v2.y) / 2,
          };
        }
        panRef.current = null;
        return;
      }
      panRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };
    },
    [toView],
  );

  const onSurfacePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      const pinch = pinchRef.current;
      if (pinch && pointersRef.current.size >= 2) {
        const [p1, p2] = [...pointersRef.current.values()];
        const v1 = toView(p1.x, p1.y);
        const v2 = toView(p2.x, p2.y);
        if (!v1 || !v2) return;
        const dist = Math.max(1, Math.hypot(v2.x - v1.x, v2.y - v1.y));
        const midX = (v1.x + v2.x) / 2;
        const midY = (v1.y + v2.y) / 2;
        const cam = camRef.current;
        const k = clampZoom(cam.k * (dist / pinch.lastDist));
        const eff = k / cam.k;
        cam.x = midX - (midX - cam.x) * eff;
        cam.y = midY - (midY - cam.y) * eff;
        cam.k = k;
        cam.x += midX - pinch.lastMidX;
        cam.y += midY - pinch.lastMidY;
        camTweenRef.current = null;
        applyCamera();
        pinch.lastDist = dist;
        pinch.lastMidX = midX;
        pinch.lastMidY = midY;
        return;
      }
      const pan = panRef.current;
      if (!pan || pan.id !== event.pointerId) return;
      const cur = toView(event.clientX, event.clientY);
      const last = toView(pan.lastX, pan.lastY);
      if (!cur || !last) return;
      if (Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY) > TAP_SLOP_PX) {
        pan.moved = true;
      }
      camTweenRef.current = null;
      const cam = camRef.current;
      cam.x += cur.x - last.x;
      cam.y += cur.y - last.y;
      applyCamera();
      pan.lastX = event.clientX;
      pan.lastY = event.clientY;
    },
    [applyCamera, clampZoom, toView],
  );

  const onSurfacePointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const pan = panRef.current;
    if (pan && pan.id === event.pointerId) {
      panRef.current = null;
      if (!pan.moved) setSelectedId(null); // tap on the world — the whole network
    }
  }, []);

  // ⌘/Ctrl + wheel = zoom at the pointer (plain wheel keeps scrolling the
  // page — an infinite canvas must not hijack the document scroll)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const pt = toView(event.clientX, event.clientY);
      if (pt) zoomAt(pt.x, pt.y, Math.exp(-event.deltaY * 0.0022));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toView, zoomAt]);

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
            onPointerDown={onSurfacePointerDown}
            onPointerMove={onSurfacePointerMove}
            onPointerUp={onSurfacePointerUp}
            onPointerCancel={onSurfacePointerUp}
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
              {Object.entries(SERVICE_META).map(([key, meta]) => (
                <radialGradient key={`sg-${key}`} id={`sg-${key}`} cx="35%" cy="30%" r="75%">
                  <stop offset="0%" stopColor={meta.color} stopOpacity="0.95" />
                  <stop offset="55%" stopColor={meta.color} stopOpacity="0.62" />
                  <stop offset="100%" stopColor={meta.color} stopOpacity="0.26" />
                </radialGradient>
              ))}
              <pattern id="dotgrid" width="44" height="44" patternUnits="userSpaceOnUse">
                <circle cx="1.4" cy="1.4" r="1.4" fill="#ffffff" opacity="0.08" />
              </pattern>
            </defs>

            {/* ── INFINITE AREA: the world group lives under the camera —
                pan/pinch/wheel/chips move this transform, the circles stop
                clamping against the visible box (soft physics walls) and the
                freed margin hosts the infographic stations below. ── */}
            <g ref={worldRef} transform="translate(0 0) scale(1)">
            {/* the world floor — a dot grid across the whole reachable area;
                it is also the pan/tap surface (svg-level handlers) */}
            <rect
              x={-(overflowPad + 600)}
              y={-(overflowPad + 600)}
              width={view + 2 * (overflowPad + 600)}
              height={view + 2 * (overflowPad + 600)}
              fill="url(#dotgrid)"
            />

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

            {/* service-affinity + blogger-distribution edges — the painter
                keeps them glued to BOTH endpoints while the network moves */}
            <g>
              {satelliteModel.edges.map((edge) => (
                <path
                  key={edge.key}
                  ref={(el) => {
                    if (el) serviceEdgeRefs.current.set(edge.key, el);
                    else serviceEdgeRefs.current.delete(edge.key);
                  }}
                  d={`M ${edge.ax.toFixed(1)} ${edge.ay.toFixed(1)} L ${edge.bx.toFixed(1)} ${edge.by.toFixed(1)}`}
                  fill="none"
                  stroke={edge.kind === "blogger" ? BLOGGER_COLOR : (SERVICE_META[edge.serviceKey]?.color ?? "#7dd3fc")}
                  strokeWidth={edge.kind === "blogger" ? 1.7 : 1.4}
                  strokeDasharray={edge.kind === "blogger" ? "7 5" : "3 7"}
                  strokeLinecap="round"
                  opacity={edge.kind === "blogger" ? 0.66 : 0.55}
                  style={{ pointerEvents: "none" }}
                />
              ))}
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
                    onPointerDown={simActive ? onNodePointerDown(node.crewId) : (event) => event.stopPropagation()}
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

                    {/* service satellites (INFINITE ROUND): spawn on focus —
                        the selection's own services + same-service satellites
                        on ring-1 crews, all riding the crew's <g> for free */}
                    {(satelliteModel.satsByCrew.get(node.crewId) ?? []).map((sat) => {
                      const meta = SERVICE_META[sat.key];
                      const Icon = meta?.icon;
                      // ── blogger satellite (distribution layer, 2026-10-05):
                      //    person circle in the blue-product color, avatar
                      //    over a local-initials fallback, rarity stars in
                      //    the sub line; the dashed blue distribution edges
                      //    to their other crews ride the painter (below).
                      if (sat.blogger) {
                        const b = sat.blogger;
                        const clipId = `blc-${b.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
                        const rare = b.rarityStars >= 4;
                        return (
                          <g
                            key={`sat-${sat.key}-${sat.ox.toFixed(0)}`}
                            role="link"
                            tabIndex={0}
                            aria-label={sat.aria}
                            transform={`translate(${sat.ox.toFixed(1)} ${sat.oy.toFixed(1)})`}
                            className="cursor-pointer"
                            onPointerDown={(event) => event.stopPropagation()}
                            onPointerUp={(event) => event.stopPropagation()}
                            onPointerMove={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(sat.href);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(sat.href);
                              }
                            }}
                          >
                            <defs>
                              <clipPath id={clipId}>
                                <circle r={sat.r - 2} />
                              </clipPath>
                            </defs>
                            {/* rarity glow — rare voices breathe brighter */}
                            <circle r={sat.r + (rare ? 9 : 5)} fill={BLOGGER_COLOR} opacity={rare ? 0.2 : 0.13} />
                            <circle r={sat.r} fill="#101a33" stroke={BLOGGER_COLOR} strokeWidth="1.6" />
                            {/* initials painted FIRST — a broken avatar just
                                reveals them (same contract as map markers) */}
                            <text
                              textAnchor="middle"
                              y={4}
                              fontSize={12}
                              fontWeight="800"
                              fill="#dbeafe"
                              style={{ pointerEvents: "none", userSelect: "none" }}
                            >
                              {initialsOf(b.name)}
                            </text>
                            {b.avatarUrl && (
                              <g clipPath={`url(#${clipId})`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <image
                                  href={b.avatarUrl}
                                  x={-(sat.r - 2)}
                                  y={-(sat.r - 2)}
                                  width={(sat.r - 2) * 2}
                                  height={(sat.r - 2) * 2}
                                  preserveAspectRatio="xMidYMid slice"
                                />
                              </g>
                            )}
                            {rare && (
                              <circle r={sat.r + 13} fill="none" stroke={BLOGGER_COLOR} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 5" />
                            )}
                            <text
                              textAnchor="middle"
                              y={sat.r + 16}
                              fontSize={12}
                              fontWeight="800"
                              fill="#ffffff"
                              stroke="rgba(4,9,20,0.88)"
                              strokeWidth="3.5"
                              strokeLinejoin="round"
                              paintOrder="stroke"
                              style={{ pointerEvents: "none", userSelect: "none" }}
                            >
                              {truncate(b.name, 16)}
                            </text>
                            {sat.sub && (
                              <text
                                textAnchor="middle"
                                y={sat.r + 30}
                                fontSize={10.5}
                                fontWeight="700"
                                fill={BLOGGER_COLOR}
                                stroke="rgba(4,9,20,0.85)"
                                strokeWidth="3"
                                strokeLinejoin="round"
                                paintOrder="stroke"
                                style={{ pointerEvents: "none", userSelect: "none" }}
                              >
                                {sat.sub}
                              </text>
                            )}
                          </g>
                        );
                      }
                      return (
                        <g
                          key={`sat-${sat.key}-${sat.ox.toFixed(0)}`}
                          role="link"
                          tabIndex={0}
                          aria-label={sat.aria}
                          transform={`translate(${sat.ox.toFixed(1)} ${sat.oy.toFixed(1)})`}
                          className="cursor-pointer"
                          style={{ opacity: sat.primary ? 1 : 0.88 }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          onPointerMove={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(sat.href);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(sat.href);
                            }
                          }}
                        >
                          <circle r={sat.r + 5} fill={meta?.color ?? "#7dd3fc"} opacity={0.16} />
                          <circle
                            r={sat.r}
                            fill={`url(#sg-${sat.key})`}
                            stroke={meta?.color ?? "#7dd3fc"}
                            strokeWidth="1.6"
                          />
                          {Icon && (
                            <g transform="translate(-11 -11)">
                              <Icon width={22} height={22} color={meta ? inkFor(meta.color) : "#0b1220"} strokeWidth={2.2} aria-hidden />
                            </g>
                          )}
                          <text
                            textAnchor="middle"
                            y={sat.r + 17}
                            fontSize={14.5}
                            fontWeight="800"
                            fill="#ffffff"
                            stroke="rgba(4,9,20,0.88)"
                            strokeWidth="4"
                            strokeLinejoin="round"
                            paintOrder="stroke"
                            style={{ pointerEvents: "none", userSelect: "none" }}
                          >
                            {sat.label}
                          </text>
                          {sat.sub && (
                            <text
                              textAnchor="middle"
                              y={sat.r + 32}
                              fontSize={11.5}
                              fontWeight="600"
                              fill="rgba(255,255,255,0.62)"
                              stroke="rgba(4,9,20,0.85)"
                              strokeWidth="3.5"
                              strokeLinejoin="round"
                              paintOrder="stroke"
                              style={{ pointerEvents: "none", userSelect: "none" }}
                            >
                              {sat.sub}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* ── world stations: infographic cards OUTSIDE the visible box —
                the «infinite area» real estate (camera chips below bring them
                in). pointerdown is stopped so panning never fights taps. ── */}
            {stationServices.length > 0 && (
              <foreignObject x={view + STATION_GAP} y={STATION_TOP} width={STATION_W} height={520}>
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  className="rounded-2xl border border-white/12 bg-[#0b1220]/95 p-4 shadow-2xl"
                  style={{ width: STATION_W }}
                >
                  <p className="text-xs font-black uppercase tracking-wide text-white/60">Услуги сети</p>
                  {stationServices.map(({ key, crews, total }) => {
                    const meta = SERVICE_META[key];
                    const Icon = meta?.icon;
                    return (
                      <div key={key} className="mt-3">
                        <div className="flex items-center gap-2">
                          {Icon && (
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                              aria-hidden
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                          )}
                          <p className="text-sm font-bold text-white/90">{meta?.short ?? key}</p>
                          <span className="ml-auto text-[11px] font-semibold text-white/50">
                            {total} {pluralRu(total, ["экипаж", "экипажа", "экипажей"])}
                          </span>
                        </div>
                        {crews.map((crew) => (
                          <button
                            key={crew.crewId}
                            type="button"
                            onClick={() => {
                              setSelectedId(crew.crewId);
                              tweenHome();
                            }}
                            className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition hover:border-white/30 hover:bg-white/[0.09]"
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: crew.accent }} aria-hidden />
                            <span className="truncate text-xs font-semibold text-white/85">{truncate(crew.name, 22)}</span>
                            <span className="ml-auto shrink-0 text-[10px] font-semibold text-white/45">{crew.memberCount} чел.</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  <p className="mt-3 text-[10px] leading-relaxed text-white/40">Тап по экипажу — граф перестроится вокруг него</p>
                </div>
              </foreignObject>
            )}
            {stationRecords.length > 0 && (
              <foreignObject x={-(STATION_GAP + STATION_W)} y={STATION_TOP} width={STATION_W} height={360}>
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  className="rounded-2xl border border-white/12 bg-[#0b1220]/95 p-4 shadow-2xl"
                  style={{ width: STATION_W }}
                >
                  <p className="text-xs font-black uppercase tracking-wide text-white/60">Рукопожатия-рекорды</p>
                  {stationRecords.map((link) => {
                    const a = stationById.get(link.source);
                    const b = stationById.get(link.target);
                    if (!a || !b) return null;
                    return (
                      <button
                        key={`${link.source}-${link.target}`}
                        type="button"
                        onClick={() => {
                          setSelectedId(link.source);
                          tweenHome();
                        }}
                        className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition hover:border-white/30 hover:bg-white/[0.09]"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.accent }} aria-hidden />
                        <span className="truncate text-xs font-semibold text-white/85">
                          {truncate(a.name, 14)} ⇄ {truncate(b.name, 14)}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] font-semibold text-white/45">{link.weight} общ.</span>
                      </button>
                    );
                  })}
                  <p className="mt-3 text-[10px] leading-relaxed text-white/40">Самые крепкие связи сети — по общим людям</p>
                </div>
              </foreignObject>
            )}
            {bloggers.length > 0 && (
              <foreignObject x={view + STATION_GAP} y={BLOGGER_STATION_TOP} width={STATION_W} height={480}>
                <div
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  className="rounded-2xl border border-sky-400/20 bg-[#0b1220]/95 p-4 shadow-2xl"
                  style={{ width: STATION_W }}
                >
                  <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-sky-200/80">
                    <Camera className="h-3.5 w-3.5" aria-hidden /> Блогеры сети · {bloggers.length}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                    Пишут на стенах экипажей — органическое распределение «синего продукта». Звёзды — редкость голоса.
                  </p>
                  {bloggers.slice(0, 6).map((blogger) => {
                    const topCrewId = topCrewOfBlogger(blogger);
                    const topCrew = topCrewId ? stationById.get(topCrewId) : null;
                    return (
                      <button
                        key={blogger.userId}
                        type="button"
                        onClick={() => {
                          if (topCrewId) {
                            setSelectedId(topCrewId);
                            tweenHome();
                          }
                        }}
                        aria-label={topCrew ? `Блогер ${blogger.name} — переключить граф на экипаж ${topCrew.name}` : `Блогер ${blogger.name}`}
                        className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition hover:border-sky-300/40 hover:bg-white/[0.09]"
                      >
                        {blogger.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={blogger.avatarUrl}
                            alt=""
                            width={22}
                            height={22}
                            className="h-[22px] w-[22px] shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-sky-400/20 text-[9px] font-black text-sky-100" aria-hidden>
                            {initialsOf(blogger.name)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-white/85">{truncate(blogger.name, 16)}</span>
                          <span className="block text-[10px] font-medium text-white/45">
                            {pluralRu(blogger.postCount, ["пост", "поста", "постов"])} · {pluralRu(blogger.crewIds.length, ["экипаж", "экипажа", "экипажей"])}
                            {topCrew ? ` · топ: ${truncate(topCrew.name, 12)}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="text-[10px] font-bold text-sky-300" aria-label={`Редкость ${blogger.rarityStars} из 5`}>
                            {"★".repeat(blogger.rarityStars)}
                          </span>
                          {blogger.externalAudience != null && (
                            <span className="rounded-full border border-sky-300/40 px-1.5 text-[9px] font-bold leading-tight text-sky-200">
                              +вне платформы{blogger.externalAudience > 1 ? ` · ${blogger.externalAudience}` : ""}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  <p className="mt-3 text-[10px] leading-relaxed text-white/40">Тап — фокус на экипаже с самыми сильными постами блогера</p>
                </div>
              </foreignObject>
            )}
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
              {bloggers.length > 0 && (
                <span className="rounded-full border border-sky-300/25 bg-[#0b1220]/75 px-2.5 py-1 text-[10px] font-bold text-sky-200/90 backdrop-blur-sm">
                  {bloggers.length} {pluralRu(bloggers.length, ["блогер", "блогера", "блогеров"])}
                </span>
              )}
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
                  <li>◈ Тап по кругу — сателлиты услуг; пунктир — похожие услуги соседей</li>
                  <li>📷 Голубой сателлит — блогер стены; пунктир — он же пишет в другие экипажи (распределение)</li>
                  <li>✋ Круги можно таскать — остальные расступаются</li>
                  <li>☞ Тап по кругу — фокус; тап по фону — вся сеть снова</li>
                  <li>⤢ Карта больше экрана: тащи фон, зум — щипок или Ctrl/⌘+колесо, станции — чипы внизу</li>
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

          {/* ── camera chips: the world is bigger than the screen ── */}
          <div className="absolute bottom-2.5 left-2.5 z-20 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={tweenHome}
              aria-label="Показать весь граф"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/15 bg-[#0b1220]/75 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              <Network className="h-3.5 w-3.5" aria-hidden /> Граф
            </button>
            {stationServices.length > 0 && (
              <button
                type="button"
                onClick={() => focusStation("services")}
                aria-label="Показать услуги сети"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/15 bg-[#0b1220]/75 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
              >
                Услуги
              </button>
            )}
            {stationRecords.length > 0 && (
              <button
                type="button"
                onClick={() => focusStation("records")}
                aria-label="Показать рекорды рукопожатий"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/15 bg-[#0b1220]/75 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
              >
                Рекорды
              </button>
            )}
            {bloggers.length > 0 && (
              <button
                type="button"
                onClick={() => focusStation("bloggers")}
                aria-label="Показать блогеров сети — распределение продукта"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-sky-300/30 bg-[#0b1220]/75 px-3 py-1.5 text-[11px] font-bold text-sky-200 backdrop-blur-sm transition hover:border-sky-300/60 hover:text-sky-100"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden /> Блогеры {bloggers.length}
              </button>
            )}
          </div>
          <div className="absolute bottom-2.5 right-2.5 z-20 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => zoomBy(1.35)}
              aria-label="Приблизить"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0b1220]/75 text-white/75 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.35)}
              aria-label="Отдалить"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0b1220]/75 text-white/75 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={tweenHome}
              aria-label="Вернуть камеру к графу"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0b1220]/75 text-white/75 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
            </button>
          </div>

        </div>
      </div>

      {/* hint lives BELOW the canvas — the canvas bottom edge is flip-label
          territory, an in-canvas hint there collided with crew labels
          (regression round: the second pile-up) */}
      <p className="mt-2 text-center text-xs font-semibold text-white/45" aria-hidden>
        {selected
          ? "Тап по фону — вернуться ко всей сети"
          : "Тапни по кругу — сеть перестроится вокруг него · круги можно таскать"}
        <span className="block sm:inline"> · карта больше экрана: тащи фон, зум — щипок / Ctrl+колесо, станции — чипы внизу</span>
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

                  {/* wall bloggers — the distribution layer: who feeds this
                      crew's wall, their rarity and cross-crew reach (tap →
                      public rider page, the same identity the wall chips
                      and map pins render) */}
                  {selected && (bloggersByCrew.get(selected.crewId)?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-sky-200/70">
                        <Camera className="h-3.5 w-3.5" aria-hidden /> Блогеры стены ·{" "}
                        {bloggersByCrew.get(selected.crewId)!.length}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {bloggersByCrew.get(selected.crewId)!.map(({ blogger, posts }) => (
                          <Link
                            key={blogger.userId}
                            href={`/franchize/${selected.slug}/rider/${blogger.userId}`}
                            aria-label={`Профиль блогера ${blogger.name}: ${pluralRu(posts, ["пост", "поста", "постов"])}, редкость ${blogger.rarityStars} из 5`}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 py-1 pl-1 pr-3 text-xs font-bold text-white/85 transition hover:border-sky-300/50 hover:bg-sky-400/20"
                          >
                            {blogger.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={blogger.avatarUrl}
                                alt=""
                                width={22}
                                height={22}
                                className="h-[22px] w-[22px] rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sky-400/25 text-[9px] font-black text-sky-100" aria-hidden>
                                {initialsOf(blogger.name)}
                              </span>
                            )}
                            {truncate(blogger.name, 16)}
                            <span className="text-sky-300" aria-hidden>
                              {"★".repeat(blogger.rarityStars)}
                            </span>
                            <span className="font-semibold text-white/50">· {pluralRu(posts, ["пост", "поста", "постов"])}</span>
                            {blogger.externalAudience != null && (
                              <span className="rounded-full border border-sky-300/40 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-sky-200">
                                +вне платформы
                              </span>
                            )}
                          </Link>
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
