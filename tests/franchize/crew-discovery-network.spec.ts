// tests/franchize/crew-discovery-network.spec.ts
// 2026-10-01 — brainstorm outcome («Rate my idea… 9+/10») → implementation:
//
//   · GLOBAL crew discovery page /franchize/discovery — social graph of
//     beautiful circles: circle = crew, radius = people, curve = shared
//     people (boss: «kinda social graph :) with beautiful circles»);
//   · rider-page backward links — «Экипажи райдера» with each crew's
//     services in brief;
//   · CONSTRAINT (boss): «avoid additional inputs and generate capabilities
//     based on crew memberships info only» — every capability below is
//     DERIVED (catalog + metadata.franchize.storage + crew_members); there
//     is no user-supplied "skills" field anywhere.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildCrewNetworkModel,
  crewAccentFromMetadata,
  crewCircleRadius,
  deriveCrewServices,
  layoutCrewGraph,
  CREW_FALLBACK_ACCENTS,
  type CrewNetworkMember,
} from "../../app/franchize/lib/crew-network";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

describe("crew-network lib — capabilities derived, no new inputs", () => {
  it("every crew gets the rent service pointing at its catalog", () => {
    const pills = deriveCrewServices({ slug: "vip-bike", metadata: null });
    expect(pills.length).toBeGreaterThanOrEqual(1);
    const rent = pills.find((p) => p.key === "rent");
    expect(rent?.label).toBe("Аренда мото");
    expect(rent?.href).toBe("/franchize/vip-bike");
  });

  it("fleet size becomes an honest sub-line with RU plural forms", () => {
    expect(deriveCrewServices({ slug: "a", metadata: null, bikeCount: 1 })[0].sub).toBe("1 байк в парке");
    expect(deriveCrewServices({ slug: "a", metadata: null, bikeCount: 3 })[0].sub).toBe("3 байка в парке");
    expect(deriveCrewServices({ slug: "a", metadata: null, bikeCount: 6 })[0].sub).toBe("6 байков в парке");
    // zero fleet → no sub (no fake numbers)
    expect(deriveCrewServices({ slug: "a", metadata: null, bikeCount: 0 })[0].sub).toBeUndefined();
  });

  it("winter storage appears only when metadata.franchize.storage enables it", () => {
    const on = deriveCrewServices({
      slug: "alpha",
      metadata: { franchize: { storage: { enabled: true } } },
      storageBikeCount: 4,
    });
    const storage = on.find((p) => p.key === "storage");
    expect(storage?.label).toBe("Зимнее хранение");
    expect(storage?.href).toBe("/franchize/alpha/storage");
    expect(storage?.sub).toBe("4 на сезоне");

    const off = deriveCrewServices({
      slug: "alpha",
      metadata: { franchize: { storage: { enabled: false } } },
    });
    expect(off.find((p) => p.key === "storage")).toBeUndefined();
  });

  it("keeps the legacy vip-bike storage rule (enabled key absent → on)", () => {
    const pills = deriveCrewServices({ slug: "vip-bike", metadata: {} });
    expect(pills.find((p) => p.key === "storage")?.href).toBe("/franchize/vip-bike/storage");
  });

  it("service keys are closed over the derived set (no free-form user input)", () => {
    const pills = deriveCrewServices({
      slug: "x",
      metadata: { franchize: { storage: { enabled: true } } },
    });
    for (const pill of pills) expect(["rent", "storage"]).toContain(pill.key);
    for (const pill of pills) expect(pill.href.startsWith("/franchize/x")).toBe(true);
  });
});

describe("crew-network lib — social graph from memberships ONLY", () => {
  const people = new Map<string, CrewNetworkMember>([
    ["u1", { userId: "u1", name: "Паша", avatarUrl: null }],
    ["u2", { userId: "u2", name: "Лена", avatarUrl: "http://x/a.png" }],
    ["u3", { userId: "u3", name: "Максим", avatarUrl: null }],
  ]);

  it("links exactly the crews that share a person, with the right weight", () => {
    const model = buildCrewNetworkModel(
      [
        {
          crewId: "c1",
          slug: "a",
          name: "Alpha",
          description: "",
          logoUrl: null,
          accent: "#f00",
          memberUserIds: ["u1", "u2"],
          services: [],
        },
        {
          crewId: "c2",
          slug: "b",
          name: "Beta",
          description: "",
          logoUrl: null,
          accent: "#0f0",
          memberUserIds: ["u2"],
          services: [],
        },
        {
          crewId: "c3",
          slug: "c",
          name: "Gamma",
          description: "",
          logoUrl: null,
          accent: "#00f",
          memberUserIds: ["u3"],
          services: [],
        },
      ],
      people,
    );

    expect(model.links).toHaveLength(1);
    expect(model.links[0].source).toBe("c1");
    expect(model.links[0].target).toBe("c2");
    expect(model.links[0].weight).toBe(1);
    expect(model.links[0].sharedUserIds).toEqual(["u2"]);
    // Gamma is an island — present, but unlinked
    expect(model.nodes.map((n) => n.crewId)).toContain("c3");
    expect(model.peopleCount).toBe(3);
    expect(model.connectionCount).toBe(1);
  });

  it("dedupes repeated member ids inside one crew", () => {
    const model = buildCrewNetworkModel(
      [
        {
          crewId: "c1",
          slug: "a",
          name: "Alpha",
          description: "",
          logoUrl: null,
          accent: "#f00",
          memberUserIds: ["u1", "u1", "u2"],
          services: [],
        },
      ],
      people,
    );
    expect(model.nodes[0].memberCount).toBe(2);
  });

  it("unknown members degrade to a safe placeholder (no crash on orphan ids)", () => {
    const model = buildCrewNetworkModel(
      [
        {
          crewId: "c1",
          slug: "a",
          name: "Alpha",
          description: "",
          logoUrl: null,
          accent: "#f00",
          memberUserIds: ["ghost"],
          services: [],
        },
      ],
      people,
    );
    expect(model.nodes[0].members[0].name).toBe("Райдер");
  });
});

describe("crew-network lib — deterministic circle layout", () => {
  const ids = ["c1", "c2", "c3", "c4", "c5"];
  const links = [
    { source: "c1", target: "c2", weight: 2 },
    { source: "c2", target: "c3", weight: 1 },
  ];

  it("single node lands dead center", () => {
    const pos = layoutCrewGraph(["solo"], []);
    expect(pos.solo).toEqual({ x: 500, y: 500 });
  });

  it("same input → same output (SSR/CSR agreement, test-pinnable)", () => {
    const a = layoutCrewGraph(ids, links, { radii: { c1: 60, c2: 46, c3: 46, c4: 46, c5: 46 } });
    const b = layoutCrewGraph(ids, links, { radii: { c1: 60, c2: 46, c3: 46, c4: 46, c5: 46 } });
    expect(a).toEqual(b);
  });

  it("every node stays inside the 1000×1000 box with a radius margin", () => {
    const radii = { c1: 118, c2: 46, c3: 46, c4: 46, c5: 46 };
    const pos = layoutCrewGraph(ids, links, { radii });
    for (const id of ids) {
      const m = radii[id] + 14;
      expect(pos[id].x).toBeGreaterThanOrEqual(m);
      expect(pos[id].x).toBeLessThanOrEqual(1000 - m);
      expect(pos[id].y).toBeGreaterThanOrEqual(m);
      expect(pos[id].y).toBeLessThanOrEqual(1000 - m);
    }
  });

  it("all requested nodes receive a position", () => {
    const pos = layoutCrewGraph(ids, links);
    expect(Object.keys(pos).sort()).toEqual([...ids].sort());
  });
});

describe("crew-network lib — circle sizing and per-crew paint", () => {
  it("radius grows with membership and never exceeds the cap", () => {
    expect(crewCircleRadius(1)).toBeLessThan(crewCircleRadius(5));
    expect(crewCircleRadius(5)).toBeLessThan(crewCircleRadius(50));
    // boss 2026-10-03: «miniaturize circles» — the badge scale (26 + 9·√n,
    // capped 72) replaced the billboard scale (46 + 13·√n, capped 118)
    expect(crewCircleRadius(500)).toBe(72);
    expect(crewCircleRadius(1)).toBe(35);
  });

  it("uses the crew's configured accent when present (full flat palette)", () => {
    // resolvePaletteByMode only honors a flat palette when it carries the
    // full triple (bgBase + bgCard + accentMain) — real crews ship exactly that
    const accent = crewAccentFromMetadata({
      franchize: {
        theme: {
          palette: {
            bgBase: "#0b1220",
            bgCard: "#111a2e",
            accentMain: "#123456",
            accentMainHover: "#1a4a7a",
            textPrimary: "#ffffff",
            textSecondary: "#cccccc",
            borderSoft: "#22304a",
          },
        },
      },
    });
    expect(accent).toBe("#123456");
  });

  it("uses theme.palettes.light when mode-specific palettes exist", () => {
    const accent = crewAccentFromMetadata({
      franchize: {
        theme: {
          palettes: {
            light: { bgBase: "#fff", bgCard: "#f5f5f5", accentMain: "#0a7d33" },
            dark: { bgBase: "#000", bgCard: "#111", accentMain: "#33cc66" },
          },
        },
      },
    });
    expect(["#0a7d33", "#33cc66"]).toContain(accent);
  });

  it("falls back to the designer cycle (stable per seed) when theme is default", () => {
    const a = crewAccentFromMetadata(null, 3);
    const b = crewAccentFromMetadata(undefined, 3);
    expect(a).toBe(b);
    expect(CREW_FALLBACK_ACCENTS).toContain(a);
  });
});

describe("global discovery page — static route, memberships-only data", () => {
  const page = read("app/franchize/discovery/page.tsx");
  const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");

  it("exists as a static segment (wins over /franchize/[slug] for 'discovery')", () => {
    expect(page.includes("export default async function CrewDiscoveryPage")).toBe(true);
  });

  it("the ONLY social signal is crew_members (+ owner as implicit member)", () => {
    // Task 69: the queries live in the EXTRACTED loader (load-network-model.ts)
    // shared with the map-riders sheet — same guarantees, one file.
    const model = page + read("app/franchize/discovery/load-network-model.ts");
    expect(model.includes('.from("crew_members")')).toBe(true);
    expect(model.includes('.eq("membership_status", "active")')).toBe(true);
    expect(model.includes("crew.owner_id ? [crew.owner_id]")).toBe(true);
    // no other membership-ish source smuggled in
    expect(model.includes('.from("users")')).toBe(true); // names/avatars for members
  });

  it("capabilities come from the derived lib, never from a user input", () => {
    const model = page + read("app/franchize/discovery/load-network-model.ts");
    expect(model.includes("deriveCrewServices(")).toBe(true);
    expect(model.includes("buildCrewNetworkModel(")).toBe(true);
    // server page collects NOTHING: no free-text "capabilities" field, no form
    expect(page.toLowerCase().includes("skills")).toBe(false);
    expect(page.includes("<input")).toBe(false);
    expect(page.includes("<textarea")).toBe(false);
  });

  it("renders the graph and a server-rendered all-crews grid (SEO + no-JS)", () => {
    expect(page.includes("<CrewDiscoveryGraph")).toBe(true);
    expect(page.includes('aria-label="Все экипажи сети"')).toBe(true);
  });

  it("every href on the discovery surface stays inside the franchize namespace", () => {
    // collect template hrefs from both files; static ones must be franchize-scoped
    const sources = page + graph;
    expect(sources.includes('"/admin')).toBe(false);
    expect(sources.includes('"/leaderboard')).toBe(false);
    expect(sources.includes('"/crews')).toBe(false);
    expect(sources.includes('"/paddock')).toBe(false);
    expect(sources.includes('"/franchize/discovery"')).toBe(false); // no self-link
    expect(sources.includes('"/franchize/create"')).toBe(true);
  });

  it("the graph is dependency-free SVG (no d3, no Math.random — SSR-safe)", () => {
    expect(/from\s+["']d3/.test(graph)).toBe(false);
    expect(graph.includes("Math.random")).toBe(false);
    expect(graph.includes("layoutCrewGraph(")).toBe(true);
    expect(graph.includes("crewCircleRadius(")).toBe(true);
    expect(graph.includes("<circle")).toBe(true);
    // selection UX: tap circle → panel, Esc/tap-outside → back
    expect(graph.includes('setSelectedId(null)')).toBe(true);
  });

  it("typography round 2026-10-03 — miniature badges, haloed two-line labels", () => {
    // the count moved OUT of the circle into the label block under it
    expect(graph.includes("{node.memberCount} чел.")).toBe(true);
    // dark paint-order halo keeps labels readable over links and neighbors
    expect(graph.includes('paintOrder="stroke"')).toBe(true);
    // two-line label block: name + count micro-caption (wiki round: the ink
    // is multiplied by labelScale — blown UP on narrow viewports)
    expect(graph.includes("fontSize={21 * labelScale}")).toBe(true);
    expect(graph.includes("fontSize={13.5 * labelScale}")).toBe(true);
    // bottom-edge circles flip their label block above the circle (SSR + rAF)
    expect(graph.includes("flipLabel ? -(r + 46 * labelScale) : r + 26 * labelScale")).toBe(true);
    expect(graph.includes("node.y > VIEW - node.r - 62 * s")).toBe(true);
    // initials re-centered (no in-circle count pushing them up anymore)
    expect(graph.includes("y={r * 0.14}")).toBe(true);
    // connections slimmed to hairline springs
    expect(graph.includes("Math.min(3.4, 1.05 + link.weight * 0.55)")).toBe(true);
  });

  it("codereview round — static-mode tap, ring-label clearance, hover affordance", () => {
    // >80 crews: the sim sleeps, but pointer tap must still focus a circle
    // (gated on !simActive so it can never double-toggle the sim tap path)
    expect(graph.includes("onClick={simActive ? undefined : () => setSelectedId(isSelected ? null : node.crewId)}")).toBe(true);
    // guide labels clear the circles anchored at the ring top (fan starts at -90°)
    expect(graph.includes("ringLabelClearance[i + 1] ?? 30")).toBe(true);
    expect(graph.includes("maxR[ring] = Math.max(maxR[ring] ?? 0, renderRadii[id] ?? 0)")).toBe(true);
    // desktop hover / keyboard-focus affordance without React re-renders
    expect(graph.includes("group-hover:brightness-110")).toBe(true);
    expect(graph.includes("group-hover:fill-white/95")).toBe(true);
    // the rAF painter skips redundant label y writes (60fps churn guard)
    expect(graph.includes("if (pair.lastNameY !== nameY)")).toBe(true);
  });
});

describe("rider page — backward links to crews with brief services", () => {
  const riderPage = read("app/franchize/[slug]/rider/[userId]/page.tsx");
  const riderClient = read("app/franchize/[slug]/rider/[userId]/RiderProfileClient.tsx");

  it("loads memberships + owned crews and passes the briefs to the client", () => {
    expect(riderPage.includes("loadRiderCrewBriefs")).toBe(true);
    expect(riderPage.includes('.from("crew_members")')).toBe(true);
    expect(riderPage.includes('.eq("owner_id", riderId)')).toBe(true);
    expect(riderPage.includes("riderCrews={riderCrews}")).toBe(true);
  });

  it("briefs carry derived services (lib call) and current-crew marking", () => {
    expect(riderPage.includes("deriveCrewServices({ slug, metadata: crew.metadata })")).toBe(true);
    expect(riderPage.includes("isCurrent: crew.id === currentCrewId")).toBe(true);
  });

  it("renders the «Экипажи райдера» section + global network crosslink", () => {
    expect(riderClient.includes("Экипажи райдера")).toBe(true);
    expect(riderClient.includes('href="/franchize/discovery"')).toBe(true);
    expect(riderClient.includes("этот экипаж")).toBe(true);
    // privacy stance pinned in a comment: memberships are already public per crew
    expect(riderClient.includes("already public")).toBe(true);
  });

  it("brief services link inside each crew's own namespace", () => {
    expect(riderClient.includes("href={`/franchize/${crew.slug}`}")).toBe(true);
    expect(riderClient.includes("service.href")).toBe(true);
  });
});

describe("network entry points", () => {
  it("CrewFooter carries the global «Сеть экипажей» link on every crew page", () => {
    const footer = read("app/franchize/components/CrewFooter.tsx");
    expect(footer.includes('href="/franchize/discovery"')).toBe(true);
    expect(footer.includes("Сеть экипажей")).toBe(true);
  });
});
