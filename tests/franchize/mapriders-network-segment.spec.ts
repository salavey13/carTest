// tests/franchize/mapriders-network-segment.spec.ts
//
// Task 69 (boss 2026-10-04) — «polish network tab in sliding on map-riders».
//
// WHAT WAS WRONG: the map bottom nav had FOUR tabs but only THREE lived in
// the sliding sheet (Стена/Лист/Топ segments of the single deck, Task 60).
// «Сеть» was a hard <Link href="/franchize/discovery"> — tapping it EJECTED
// the rider from the map page entirely. The deck's own header comment even
// promised «the bottom-nav tabs select/toggle these segments 1:1» while the
// fourth tab broke that contract.
//
// THE FIX: «Сеть» becomes a FOURTH segment of the same deck:
//   · the map-riders server page loads the network model with the SAME
//     loader the /franchize/discovery route uses (extracted to
//     load-network-model.ts, no duplicated queries);
//   · SheetNetworkPanel renders the same CrewDiscoveryGraph inside the deck;
//   · on the map page the nav tab dispatches the existing
//     mapriders-open-riders-drawer event with tab:"network" (toggle + snap +
//     per-segment scroll restore all inherited for free);
//   · off the map it degrades back to the plain Link (same fallback
//     contract as «Стена»).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const client = read("components/map-riders/MapRidersClientRefactored.tsx");
const panels = read("components/map-riders/MapRidersSheetPanels.tsx");
const nav = read("components/layout/FranchizeMapBottomNav.tsx");
const mapPage = read("app/franchize/[slug]/map-riders/page.tsx");
const discoveryPage = read("app/franchize/discovery/page.tsx");
const loader = read("app/franchize/discovery/load-network-model.ts");

describe("map-riders: «Сеть» is a deck segment, not an ejector (Task 69)", () => {
  it("segment type + SHEET_SEGMENTS carry network (mirrors the nav 1:1)", () => {
    expect(panels).toContain('export type MapRidersSheetSegment = "wall" | "list" | "top" | "network"');
    expect(client).toContain('key: "network", label: "Сеть"');
    // segmented control went 3 → 4 columns
    expect(client).toContain('grid grid-cols-4');
    expect(client).not.toContain('grid grid-cols-3');
  });

  it("nav «Сеть» selects the deck segment on the map page (no hard Link)", () => {
    // on-map: dispatch the preserved event with tab:"network"
    expect(nav).toContain('detail: { tab: "network" }');
    // off-map fallback: the plain Link to the global discovery page stays
    expect(nav).toContain("franchize/discovery");
    // highlight parity: the nav maps network → network for the deck broadcast
    expect(nav).toContain('network: "network"');
  });

  it("deck maps tab:\"network\" to the network segment and mounts the panel", () => {
    expect(client).toContain('tab === "network" ? "network"');
    expect(client).toContain('{sheetSegment === "network" ? <SheetNetworkPanel network={network ?? null} /> : null}');
    // per-segment scroll restore covers the new segment (Task 68 fix family)
    expect(client).toContain("{ wall: 0, list: 0, top: 0, network: 0 }");
  });

  it("SheetNetworkPanel renders the SAME graph as the discovery page + «Вся сеть» escape hatch", () => {
    expect(panels).toContain('from "@/app/franchize/discovery/CrewDiscoveryGraph"');
    // Task 74 wired the blogger distribution layer into the sheet's graph —
    // the same props the discovery page passes (no deprioritized fork).
    expect(panels).toContain("<CrewDiscoveryGraph");
    expect(panels).toContain("nodes={network.nodes}");
    expect(panels).toContain("links={network.links}");
    expect(panels).toContain("bloggers={network.bloggers}");
    expect(panels).toContain("bloggerLinks={network.bloggerLinks}");
    expect(panels).toContain("franchize/discovery");
    // empty state instead of a crash when the model fails to load
    expect(panels).toContain("Пока сеть пуста");
  });

  it("the model loader is extracted ONCE — discovery page and map page share it (no query drift)", () => {
    expect(existsSync(join(ROOT, "app/franchize/discovery/load-network-model.ts"))).toBe(true);
    // server-only marker: admin client import lives in the loader, never in the sheet
    expect(loader).toContain("supabaseAdmin");
    // discovery page consumes the loader (its private copy is gone)
    expect(discoveryPage).toContain('import { loadNetworkModel } from "./load-network-model"');
    expect(discoveryPage).not.toContain("async function loadNetworkModel()");
    // map-riders page consumes the loader, best-effort (map must never go down)
    expect(mapPage).toContain("loadNetworkModel");
    expect(mapPage).toContain("catch (error)");
    // the sheet consumers import the TYPE only — the admin client cannot leak
    // into the client bundle
    expect(panels).toContain('import type { CrewNetworkModelResult }');
    expect(client).toContain('import type { CrewNetworkModelResult }');
    expect(panels).not.toContain('from "@/lib/supabase-server"');
    expect(client).not.toContain('from "@/lib/supabase-server"');
  });

  it("crew discovery graph keeps its sheet-safe touch guard (drag ≠ scroll fight)", () => {
    const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");
    // the graph claims touchmove ONLY while a circle is actually grabbed —
    // otherwise the deck's scroll (Task 68 fix) and the graph drag fight
    expect(graph).toContain("drag on touch must not scroll the sheet/container mid-gesture");
    expect(graph).toContain("if (dragRef.current) event.preventDefault()");
  });
});
