// app/franchize/lib/crew-network.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Crew network (2026-10-01) — the «people help people» layer of the brainstorm
// (idea rated 9/10 after 2 iterations):
//
//   · a CREW is a wrapper around a service set (one-man crews are legal), so
//     the network's capabilities are DERIVED — no new user inputs anywhere;
//   · services come from data that already exists: the catalog (cars) and the
//     winter-storage flag in crew metadata (metadata.franchize.storage);
//   · the social graph comes from memberships ONLY: crew_members (+ owner as
//     the implicit first member) — two crews that share a person are linked;
//   · the layout is a deterministic force simulation (no d3, no Math.random)
//     so SSR/CSR agree and tests can pin exact outputs.
//
// Pure logic — no React, no Supabase here. Consumers: the global discovery
// page (/franchize/discovery) and the rider profile «Экипажи райдера» section.
// ─────────────────────────────────────────────────────────────────────────────

import { resolvePaletteByMode } from "@/app/franchize/lib/theme-resolver";
import { resolveStorageConfig } from "@/app/franchize/lib/storage-config";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";

// ── service pills (capabilities derived from existing config only) ──────────

export type CrewServiceKey = "rent" | "storage";

export interface CrewServicePill {
  key: CrewServiceKey;
  /** Short human label — «Аренда мото» / «Зимнее хранение». */
  label: string;
  /** Crew-scoped href — always inside /franchize/{slug}/*. */
  href: string;
  /** Optional derived sub-line — «6 в парке» / «3 на сезоне». */
  sub?: string;
}

/** RU plural forms — exported for the UI surfaces that render counts. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/**
 * Derive the service pills of a crew from EXISTING data only:
 *   · «Аренда мото» — the catalog is every franchize crew's core surface
 *     (sub shows the fleet size when known);
 *   · «Зимнее хранение» — resolveStorageConfig(metadata.franchize, slug).enabled
 *     (same legacy vip-bike rule as the catalog pill / storage wall).
 * Nothing here reads a user-supplied "skills" input — crew = service wrapper.
 */
export function deriveCrewServices(input: {
  slug: string;
  /** Crew metadata row (metadata.franchize ?? metadata) — raw jsonb. */
  metadata: unknown;
  bikeCount?: number;
  storageBikeCount?: number;
}): CrewServicePill[] {
  const slug = String(input.slug ?? "").trim();
  if (!slug) return [];

  const meta = isRecord(input.metadata) ? input.metadata : {};
  const franchize = isRecord(meta.franchize) ? meta.franchize : meta;

  const pills: CrewServicePill[] = [];

  const bikeCount = typeof input.bikeCount === "number" && input.bikeCount > 0 ? input.bikeCount : 0;
  pills.push({
    key: "rent",
    label: "Аренда мото",
    href: `/franchize/${slug}`,
    ...(bikeCount > 0
      ? { sub: `${bikeCount} ${pluralRu(bikeCount, ["байк", "байка", "байков"])} в парке` }
      : {}),
  });

  let storageEnabled = false;
  try {
    storageEnabled = resolveStorageConfig(franchize, slug).enabled === true;
  } catch {
    storageEnabled = false;
  }
  if (storageEnabled) {
    const onSeason =
      typeof input.storageBikeCount === "number" && input.storageBikeCount > 0 ? input.storageBikeCount : 0;
    pills.push({
      key: "storage",
      label: "Зимнее хранение",
      href: `/franchize/${slug}/storage`,
      ...(onSeason > 0 ? { sub: `${onSeason} на сезоне` } : {}),
    });
  }

  return pills;
}

// ── accent colors (per-crew circle paint, presentation-only fallback) ───────

/** Designer cycle for crews that never customized their theme — keeps the
 *  graph beautiful instead of N identical default-accent circles. */
export const CREW_FALLBACK_ACCENTS = [
  "#f59e0b", // amber
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb7185", // rose
  "#facc15", // yellow
  "#2dd4bf", // teal
  "#f97316", // orange
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Best-effort accent for a crew circle: the crew's own configured palette
 * accent, else a stable fallback from the designer cycle (seeded by index so
 * the same crew always gets the same color on every render). A crew that
 * never customized its theme would resolve to the SAME default accent for
 * everyone — the cycle substitutes so the graph reads as distinct circles.
 */
export function crewAccentFromMetadata(metadata: unknown, fallbackSeed = 0): string {
  const meta = isRecord(metadata) ? metadata : {};
  const franchize = isRecord(meta.franchize) ? meta.franchize : meta;
  try {
    const accent = resolvePaletteByMode(franchize).accentMain;
    const isUntouchedDefault =
      typeof accent === "string" &&
      accent.trim().toUpperCase() === DEFAULT_FRANCHIZE_THEME.palette.accentMain.trim().toUpperCase();
    if (typeof accent === "string" && accent.trim().length > 0 && !isUntouchedDefault) {
      return accent.trim();
    }
  } catch {
    // fall through to the cycle
  }
  return CREW_FALLBACK_ACCENTS[Math.abs(fallbackSeed) % CREW_FALLBACK_ACCENTS.length];
}

// ── network model (nodes = crews, links = shared people) ────────────────────

export interface CrewNetworkMember {
  userId: string;
  /** full_name || username — the same public name the wall shows. */
  name: string;
  avatarUrl: string | null;
}

export interface CrewNetworkNodeInput {
  crewId: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  accent: string;
  /** Active member user ids + owner (the implicit first member). */
  memberUserIds: string[];
  services: CrewServicePill[];
}

export interface CrewNetworkNode extends CrewNetworkNodeInput {
  members: CrewNetworkMember[];
  memberCount: number;
}

export interface CrewNetworkLink {
  source: string;
  target: string;
  /** How many people both crews share (≥ 1). */
  weight: number;
  sharedUserIds: string[];
}

export interface CrewNetworkModel {
  nodes: CrewNetworkNode[];
  links: CrewNetworkLink[];
  /** Unique people across the whole network. */
  peopleCount: number;
  /** Crew-to-crew connections (shared members). */
  connectionCount: number;
}

/**
 * Build the social-graph model. Memberships are the ONLY social signal —
 * exactly the «no additional inputs» constraint from the brainstorm.
 */
export function buildCrewNetworkModel(
  inputs: CrewNetworkNodeInput[],
  people: Map<string, CrewNetworkMember>,
): CrewNetworkModel {
  const nodes: CrewNetworkNode[] = inputs.map((input) => {
    const seen = new Set<string>();
    const members: CrewNetworkMember[] = [];
    for (const userId of input.memberUserIds) {
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      const person = people.get(userId);
      members.push(person ?? { userId, name: "Райдер", avatarUrl: null });
    }
    return { ...input, members, memberCount: members.length };
  });

  const links: CrewNetworkLink[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = new Set(nodes[i].members.map((m) => m.userId));
      const shared = nodes[j].members.filter((m) => a.has(m.userId)).map((m) => m.userId);
      if (shared.length === 0) continue;
      // source/target ordered by array position → deterministic output
      links.push({ source: nodes[i].crewId, target: nodes[j].crewId, weight: shared.length, sharedUserIds: shared });
    }
  }

  const peopleIds = new Set<string>();
  for (const node of nodes) for (const m of node.members) peopleIds.add(m.userId);

  return {
    nodes,
    links,
    peopleCount: peopleIds.size,
    connectionCount: links.length,
  };
}

/**
 * Circle radius from crew size — sqrt keeps 1-man and 10-man crews comparable.
 * Boss 2026-10-03: «miniaturize circles, work on typography, make it look
 * neat» — the badge scale (35..72) replaced the billboard scale (59..118):
 * circles carry color and identity marks, the label block under each circle
 * carries the text, and the freed canvas keeps the web readable.
 */
export function crewCircleRadius(memberCount: number): number {
  const n = Math.max(1, memberCount);
  return Math.round(Math.min(72, 26 + 9 * Math.sqrt(n)));
}

// ── deterministic force layout (no deps, no randomness) ─────────────────────

export interface GraphPoint {
  x: number;
  y: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  /** node id → circle radius (clamping margin). */
  radii?: Record<string, number>;
}

/**
 * Fruchterman–Reingold-ish simulation, fully deterministic:
 *   · initial positions on a circle by input order (single node → center);
 *   · pairwise repulsion, edge springs (stronger with weight), center pull;
 *   · linear cooling, clamped to the box with a per-node radius margin.
 * Same inputs → same outputs, so SSR markup and tests are stable.
 */
export function layoutCrewGraph(
  nodeIds: string[],
  links: Pick<CrewNetworkLink, "source" | "target" | "weight">[],
  opts?: LayoutOptions,
): Record<string, GraphPoint> {
  const width = opts?.width ?? 1000;
  const height = opts?.height ?? 1000;
  const iterations = opts?.iterations ?? 260;
  const radii = opts?.radii ?? {};
  const margin = (id: string) => (radii[id] ?? 60) + 14;

  const positions: Record<string, GraphPoint> = {};
  const cx = width / 2;
  const cy = height / 2;

  if (nodeIds.length === 0) return positions;

  if (nodeIds.length === 1) {
    positions[nodeIds[0]] = { x: cx, y: cy };
    return positions;
  }

  const orbit = Math.min(width, height) * 0.32;
  nodeIds.forEach((id, index) => {
    const angle = (2 * Math.PI * index) / nodeIds.length - Math.PI / 2;
    positions[id] = { x: cx + orbit * Math.cos(angle), y: cy + orbit * Math.sin(angle) };
  });

  const idSet = new Set(nodeIds);
  const edges = links
    .filter((l) => idSet.has(l.source) && idSet.has(l.target) && l.source !== l.target)
    .map((l) => ({ ...l }));

  const k = Math.sqrt((width * height) / Math.max(1, nodeIds.length)) * 0.62;
  const maxStep = Math.min(width, height) * 0.045;
  const minStep = 0.4;

  for (let iter = 0; iter < iterations; iter += 1) {
    const disp: Record<string, { x: number; y: number }> = {};
    for (const id of nodeIds) disp[id] = { x: 0, y: 0 };

    // repulsion (Coulomb)
    for (let i = 0; i < nodeIds.length; i += 1) {
      for (let j = i + 1; j < nodeIds.length; j += 1) {
        const a = positions[nodeIds[i]];
        const b = positions[nodeIds[j]];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) {
          // deterministic tie-break nudge instead of random jitter
          dx = 0.01 * (i + 1);
          dy = -0.01 * (j + 1);
          dist = Math.sqrt(dx * dx + dy * dy);
        }
        const force = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        disp[nodeIds[i]].x += ux * force;
        disp[nodeIds[i]].y += uy * force;
        disp[nodeIds[j]].x -= ux * force;
        disp[nodeIds[j]].y -= uy * force;
      }
    }

    // springs (attraction along edges; heavier for stronger human ties)
    for (const edge of edges) {
      const a = positions[edge.source];
      const b = positions[edge.target];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
      const spring = (dist * dist) / k;
      const weightBoost = 1 + 0.35 * Math.max(0, edge.weight - 1);
      const force = Math.min(spring * weightBoost, maxStep * 4);
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      disp[edge.source].x += ux;
      disp[edge.source].y += uy;
      disp[edge.target].x -= ux;
      disp[edge.target].y -= uy;
    }

    // gravity to center + cooling + clamp
    const step = Math.max(minStep, maxStep * (1 - iter / iterations));
    for (const id of nodeIds) {
      const d = disp[id];
      d.x += (cx - positions[id].x) * 0.02;
      d.y += (cy - positions[id].y) * 0.02;
      const len = Math.max(0.01, Math.sqrt(d.x * d.x + d.y * d.y));
      const capped = Math.min(len, step);
      positions[id].x += (d.x / len) * capped;
      positions[id].y += (d.y / len) * capped;

      const m = margin(id);
      positions[id].x = Math.min(width - m, Math.max(m, positions[id].x));
      positions[id].y = Math.min(height - m, Math.max(m, positions[id].y));
    }
  }

  return positions;
}
