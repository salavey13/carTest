// tests/franchize/crew-discovery-deeplink.spec.ts
//
// BOSS 2026-10-02 — «polish crew discovery page, add link to it to
// map-riders nav bar … make sure deeplink that leads to this page
// exists/works».
//
// Three deliverables, each pinned HERE:
//   1. DEEPLINK: startapp=discovery → /franchize/discovery on the STATIC
//      fast path (the page is fully public — routing must happen BEFORE the
//      Telegram auth roundtrip, same class as crew_<slug>). The chain is
//      EXECUTED (builder → t.me URL → router resolver), not string-pinned:
//      the use-start-param-target lost-import regression (5c4485ecc) taught
//      us that only executed resolvers count.
//   2. NAV: FranchizeMapBottomNav carries a 4th tab «Сеть» — a plain Link
//      (works on the map page AND off it), franchize-scoped, and the legacy
//      nav audit (mapriders-no-legacy-nav.spec.ts) keeps applying.
//   3. PAGE: /franchize/discovery stays force-dynamic (fresh network —
//      no build-time prerender snapshot) and keeps the mobile-readable
//      graph canvas (640px floor + pan).

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { computeStaticFastTarget, START_PARAM_PAGE_MAP } from "@/hooks/use-start-param-target";
import { crewDiscoveryStartParam, buildTelegramAppLink } from "@/lib/wall-deeplink";
import { botUsernameFromCrewMetadata } from "@/app/franchize/lib/crew-bot";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("discovery deeplink: routing EXECUTED (boss 2026-10-02)", () => {
  it("startapp=discovery routes to /franchize/discovery on the static fast path", () => {
    expect(computeStaticFastTarget("discovery")).toBe("/franchize/discovery");
  });

  it("full chain: builder → t.me URL → param → router (byte-exact round-trip)", () => {
    const bot = botUsernameFromCrewMetadata({
      franchize: { contacts: { telegramBotUsername: "oneBikePlsBot" } },
    });
    expect(bot).toBe("oneBikePlsBot");
    const url = buildTelegramAppLink(bot!, crewDiscoveryStartParam());
    expect(url).toBe("https://t.me/oneBikePlsBot/app?startapp=discovery");
    // what the router receives is what the builder meant
    const startapp = url.split("startapp=")[1];
    expect(computeStaticFastTarget(startapp)).toBe("/franchize/discovery");
    // Bot API url-button rules: https, sane length
    expect(url.length).toBeLessThanOrEqual(256);
  });

  it("the legacy «crews» key is untouched — discovery did not hijack it", () => {
    // pre-existing legacy mapping must survive any future PAGE_MAP edits
    expect(START_PARAM_PAGE_MAP["crews"]).toBe("/crews");
    expect(START_PARAM_PAGE_MAP["discovery"]).toBe("/franchize/discovery");
  });

  it("garbage params still return null (no accidental discovery fallback)", () => {
    expect(computeStaticFastTarget("discovery_")).toBeNull();
    expect(computeStaticFastTarget("discoveryx")).toBeNull();
    expect(computeStaticFastTarget("Discovery")).toBeNull(); // case-sensitive grammar
  });
});

describe("map-riders bottom nav: «Сеть» tab (boss 2026-10-02)", () => {
  const nav = read("components/layout/FranchizeMapBottomNav.tsx");

  it("carries the discovery link, franchize-scoped", () => {
    expect(nav).toContain("/franchize/discovery");
    // every template-literal href the nav can emit stays franchize-scoped
    // (mirrors mapriders-no-legacy-nav.spec.ts — now with 4 tabs)
    const hrefs = [...nav.matchAll(/href=\{?`([^`]+)`/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) {
      expect(href.startsWith("/franchize/")).toBe(true);
    }
  });

  it("«Сеть» is a Link, not a sheet action — clickable on every route", () => {
    // rendered OUTSIDE the canControl-dependent item loop (a Link can never
    // be disabled by a missing sheet controller)
    const linkIdx = nav.indexOf("href={`/franchize/discovery`}");
    expect(linkIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeGreaterThan(nav.indexOf("{items.map("));
    // the discovery Link block itself must carry no canControl/disabled logic
    const block = nav.slice(linkIdx, linkIdx + 400);
    expect(block).not.toContain("canControl");
    expect(block).not.toContain("disabled");
    // the tab is labelled «Сеть» with the Network glyph
    expect(block).toContain("Сеть");
    expect(block).toContain("Network");
  });

  it("the grid is 4 columns (3 action tabs + «Сеть»)", () => {
    expect(nav).toContain("grid-cols-4");
    expect(nav).not.toContain("grid-cols-3");
  });
});

describe("map spot popup: «Сеть экипажей» cross-link", () => {
  const client = read("components/map-riders/MapRidersClientRefactored.tsx");

  it("the popup builds the deeplink through the canonical builder", () => {
    expect(client).toContain("crewDiscoveryStartParam");
    expect(client).toContain('crossCrewControl(crewDiscoveryStartParam, "/franchize/discovery", "Сеть экипажей")');
  });
});

describe("discovery page guarantees", () => {
  const page = read("app/franchize/discovery/page.tsx");

  it("stays force-dynamic — the network must render AS IT IS NOW", () => {
    expect(page).toContain('export const dynamic = "force-dynamic"');
  });

  it("the graph canvas keeps the mobile 640px floor + pan", () => {
    const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");
    expect(graph).toContain("overflow-x-auto");
    expect(graph).toContain("min-w-[640px] sm:min-w-0");
    expect(graph).toContain("Граф можно двигать вбок");
  });

  it("has a route-level loading skeleton", () => {
    expect(existsSync(join(ROOT, "app/franchize/discovery/loading.tsx"))).toBe(true);
  });
});
