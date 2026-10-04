// tests/franchize/crew-discovery-wiki.spec.ts
// 2026-10-04 — the «wikipedia dive» round (boss: «improve discovery page to
// be more informative, with more howtos and useful links… fullwidth circle
// area — more info inside area… make it interesting to explore, like a
// fucking wikipedia dive»).
//
// Pins:
//   · the canvas is fullwidth with in-canvas stats + legend (info lives
//     INSIDE the circle area — no page scroll spent on chrome);
//   · REGRESSION FIX 2026-10-04: phones render the graph in a 640-unit
//     viewBox (was: labelScale ink-blowup ×1.6–2.1 on a 1000-unit layout —
//     labels outgrew the circles and piled up); static ink keeps the
//     desktop-approved proportions, painter offsets are plain constants;
//   · the crew panel carries «Рукопожатия» chips that re-focus the graph —
//     crew-to-crew hopping without leaving the page;
//   · the page carries a six-card «Как это работает» strip (horizontal
//     snap-scroll on mobile) and a «Полезные ссылки» grid anchored on the
//     flagship crew (most people) — every href stays franchize-scoped.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

describe("graph canvas — fullwidth + in-canvas info", () => {
  const graph = read("app/franchize/discovery/CrewDiscoveryGraph.tsx");

  it("stats pills render INSIDE the canvas when the page passes counts", () => {
    // optional props: the map-riders sheet passes nothing and keeps its header
    expect(graph).toContain("peopleCount?: number;");
    expect(graph).toContain("connectionCount?: number;");
    expect(graph).toContain("peopleCount != null && connectionCount != null");
    expect(graph).toContain("pointer-events-none absolute left-2.5 top-2.5");
    // pluralRu drives the pill captions (no duplicated plural helpers)
    expect(graph).toContain('pluralRu(nodes.length, ["экипаж", "экипажа", "экипажей"])');
  });

  it("legend card lives in the canvas — toggle + dialog + howto anchor", () => {
    expect(graph).toContain('aria-label={legendOpen ? "Скрыть легенду графа" : "Как читать граф"}');
    expect(graph).toContain('role="dialog"');
    expect(graph).toContain('aria-label="Легенда графа сети"');
    // legend deep-links to the howto strip and the all-crews roster
    expect(graph).toContain('href="#howto"');
    expect(graph).toContain('href="#all-crews"');
    // overlay must never fight circle drag: only the button/card take pointer events
    expect(graph).toContain("pointer-events-none absolute");
    expect(graph).toContain("absolute right-2.5 top-2.5 z-20");
  });

  it("mobile renders the graph in a 640-unit viewBox — desktop proportions, no ink pile-up", () => {
    // the ResizeObserver picks the box: wide containers 1000, phones 640
    expect(graph).toContain("width >= 640 ? VIEW : 640");
    expect(graph).toContain("viewBox={`0 0 ${view} ${view}`}");
    // static ink back to the typography-round sizes (no labelScale multiplier)
    expect(graph).toContain("fontSize={21}");
    expect(graph).toContain("fontSize={13.5}");
    expect(graph).toContain("fontSize={15}");
    // SSR flip decision on the live box
    expect(graph).toContain("point.y > view - r - 62");
    // the painter reads the ref (no re-subscribe per frame)
    expect(graph).toContain("node.y > viewRef.current - node.r - 62");
    expect(graph).toContain("flip ? -(node.r + 46) : node.r + 26");
    // layout + sim + rings all follow the view box
    expect(graph).toContain("{ width: view, height: view }");
    // a view change re-seeds the sim (carrying positions)
    expect(graph).toContain("[nodes, links, selectedId, simActive, view]");
  });

  it("the bottom hint lives BELOW the canvas — flip-label territory stays clean", () => {
    expect(graph).not.toContain("absolute inset-x-0 bottom-3");
    expect(graph).toContain("Тапни по кругу — сеть перестроится вокруг него · круги можно таскать");
  });

  it("headings on this page are theme-proof — explicit light ink, no bare h1/h2/h3", () => {
    // the «disappeared» regression: bare headings inherited the global
    // light-theme --foreground (near-black) on a self-dark page
    for (const bare of ['className="truncate text-xl font-black"']) {
      expect(graph).not.toContain(bare);
    }
    expect(graph).toContain('className="truncate text-xl font-black text-white"');
  });

  it("the crew panel hops between crews — «Рукопожатия» chips re-focus the graph", () => {
    expect(graph).toContain("Рукопожатия · {neighbors.length}");
    expect(graph).toContain("neighbors.map(({ node: crew, weight }) => (");
    expect(graph).toContain("onClick={() => setSelectedId(crew.crewId)}");
    // strongest handshake first, capped — the dive stays readable
    expect(graph).toContain(".sort((a, b) => b.weight - a.weight).slice(0, 12)");
    // panel links reach the crew's own surfaces (about joined the row)
    expect(graph).toContain("/about`}");
  });
});

describe("discovery page — howtos + useful links", () => {
  const page = read("app/franchize/discovery/page.tsx");

  it("carries the howto strip: six real answers with deep-links", () => {
    expect(page).toContain('id="howto"');
    expect(page).toContain('aria-label="Как это работает"');
    // horizontal snap-scroll on phones, grid from sm up
    expect(page).toContain("snap-x snap-mandatory");
    expect(page).toContain("sm:grid-cols-3");
    for (const title of [
      "Арендовать мото",
      "Сдать байк на зимовку",
      "Создать свой экипаж",
      "Попасть на Live-карту",
      "Рукопожатия и круги",
      "Стена и рейтинг",
    ]) {
      expect(page).toContain(title);
    }
  });

  it("howto CTAs deep-link into the real product surfaces", () => {
    expect(page).toContain("/storage`");
    expect(page).toContain("/map-riders`");
    expect(page).toContain("/community`");
    expect(page).toContain('href="/franchize/create"');
  });

  it("the useful-links grid is anchored on the flagship crew (most people, oldest wins ties)", () => {
    expect(page).toContain('aria-label="Полезные ссылки"');
    expect(page).toContain("node.memberCount > best.memberCount ? node : best");
    // every key destination is one tap away
    for (const label of [
      "Каталог мото",
      "Зимнее хранение",
      "Live-карта",
      "Стена",
      "Рейтинг райдеров",
      "Об экипаже",
      "Создать экипаж",
      "Все экипажи",
    ]) {
      expect(page).toContain(`"${label}"`);
    }
  });

  it("storage howto targets a crew that ACTUALLY runs the storage service", () => {
    expect(page).toContain('services.some((service) => service.key === "storage")');
  });

  it("header stays one line — stats moved into the canvas", () => {
    // the old chips block is gone from the page body
    expect(page).not.toContain("pluralCrews");
    expect(page).not.toContain("pluralLinks");
    // counts cross into the graph as props instead
    expect(page).toContain("peopleCount={peopleCount}");
    expect(page).toContain("connectionCount={connectionCount}");
  });

  it("still honors the network-spec contract: franchize-scoped hrefs, SEO roster, no inputs", () => {
    expect(page.includes('"/franchize/discovery"')).toBe(false); // no self-link
    expect(page.includes('"/franchize/create"')).toBe(true);
    expect(page).toContain('aria-label="Все экипажи сети"');
    expect(page.toLowerCase().includes("skills")).toBe(false);
    expect(page.includes("<input")).toBe(false);
    expect(page.includes("<textarea")).toBe(false);
    expect(page).toContain('export const dynamic = "force-dynamic"');
  });

  it("REGRESSION GUARD 2026-10-04 — headings are theme-proof (light scheme must see them)", () => {
    // the global stylesheet paints bare h1/h2/h3 with --foreground, which is
    // near-black under html.light — every heading here carries light ink
    expect(page).toContain('className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl"');
    expect(page).toContain('className="mt-2.5 text-sm font-black text-white/95"');
    expect(page).toContain('className="truncate text-base font-bold text-white"');
    expect(page).toContain('className="mt-3 text-lg font-bold text-white"');
    // systemic guard: the page root pins a dark --foreground triplet
    expect(page).toContain('["--foreground" as string]: "45 25% 88%"');
  });
});
