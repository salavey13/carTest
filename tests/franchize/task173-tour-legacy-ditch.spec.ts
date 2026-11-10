// Task 173 — boss: «lets perfect feature-tour (floating button on pages):
// 1/ need to ditch some legacy non-franchize pages from the tour — try to
//    understand which. 2/ on map-riders page floating button haz z-index
//    fighting with bottom nav bar it seems — can't click at first, but when
//    clicked i can't click on buttons in feature-tour modal: so can't
//    continue».
//
// The ditch list = the hosts that are NOT crew-scoped franchize routes
// (/, /rent-bike, /leaderboard): the tour sells crew features — a stop must
// map to a purchasable flag that grows that crew's burger menu, and global
// pages can never do that (feature-tour-menu.ts already refuses to link
// them per-crew).
//
// TASK174 twist (boss: «keep /franchize/discovery in feature tour as last
// step — kinda to show other crews that are being cooked» · Wolf of Wall
// Street, «sell me this pen»): discovery is BACK as stop 16 — the FINALE.
// It is priceStars 0 / no buy CTA on purpose: a global page can never grow
// a crew menu, but the finale never needed one — it SELLS the platform
// itself after the visitor has walked 15 crew features. Trail:
// season-stats (15) → discovery (16) → /gift/roman (gift epilogue).
//
// The clickability root cause: map-riders keeps the deck drawer (vaul/Radix
// Dialog) open, so body carries a stuck inline `pointer-events: none` — the
// FAB and the modal are fixed-position OUTSIDE the drawer's PE:auto subtree
// and inherited the dead pointer-events (same disease MapPhotoLightbox
// caught on 21.10). Fix = explicit pointerEvents:"auto" on both roots.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  TOUR_FEATURES,
  TOUR_STOPS_TOTAL,
  tourFeatureByKey,
  tourFeatureHasCta,
  tourNextFeature,
} from "../../components/roman-gift/tourFeatures";
import { featureKeyForMenuHref } from "../../app/franchize/lib/feature-tour-menu";

const read = (p: string) => readFileSync(p, "utf8");
const component = read("components/roman-gift/RomanQuestCake.tsx");
const catalog = read("components/roman-gift/tourFeatures.ts");

const legacyHost = (p: string) => read(p);

const LEGACY_HOSTS = [
  "app/page.tsx",
  "app/rent-bike/page.tsx",
  "app/leaderboard/page.tsx",
];

describe("task173/174 · legacy pages are OUT of the tour — discovery is the FINALE", () => {
  it("landing/garage/leaderboard stay out of the catalog", () => {
    for (const key of ["landing", "garage", "leaderboard"]) {
      expect(tourFeatureByKey(key), key).toBeUndefined();
    }
    expect(TOUR_STOPS_TOTAL).toBe(16);
  });

  it("discovery is BACK as the finale: global route, free, stop 16", () => {
    const finale = tourFeatureByKey("discovery");
    expect(finale).toBeTruthy();
    expect(finale!.stop).toBe(16);
    expect(finale!.href).toBe("/franchize/discovery");
    expect(finale!.priceStars).toBe(0);
    expect(tourFeatureHasCta("discovery")).toBe(false);
  });

  it("stops 1..15 are crew-scoped and purchasable (menu flags), the finale is the one global exception", () => {
    const crewStops = TOUR_FEATURES.filter((f) => f.stop <= 15);
    expect(crewStops.length).toBe(15);
    for (const f of crewStops) {
      // storefront = the crew home (no suffix) — still crew-scoped, and the
      // menu filter treats it as kind:"home" (always renders, never sold twice)
      expect(f.href, f.key).toMatch(/^\/franchize\/vip-bike(?:\/[a-z-]+)?$/);
      expect(f.priceStars, f.key).toBeGreaterThan(0);
      expect(tourFeatureHasCta(f.key), f.key).toBe(true);
    }
    // the finale breaks BOTH rules on purpose (Wolf of Wall Street pen)
    expect(tourFeatureByKey("discovery")!.href).not.toMatch(/^\/franchize\/vip-bike/);
    expect(tourFeatureByKey("discovery")!.priceStars).toBe(0);
  });

  it("the three legacy hosts lost both the mount and the import", () => {
    for (const p of LEGACY_HOSTS) {
      const src = legacyHost(p);
      expect(src, p).not.toContain("<RomanQuestCake");
      expect(src, p).not.toContain('from "@/components/roman-gift/RomanQuestCake"');
    }
  });

  it("task174: the discovery host REGAINED its mount and import (the finale lives there)", () => {
    const src = legacyHost("app/franchize/discovery/page.tsx");
    expect(src).toContain('from "@/components/roman-gift/RomanQuestCake"');
    expect(src).toContain("<RomanQuestCake");
    expect(src).toContain('featureKey="discovery"');
    // the finale hands the visitor to the gift epilogue, not to a crew page
    expect(src).toContain('nextHref="/gift/roman"');
    expect(src).toMatch(/riddle="[^"]{60,}"/);
  });

  it("the trail chain skips the ditched pages: wheel → bikes (was discovery)", () => {
    expect(tourNextFeature(4)?.key).toBe("bikes");
    const wheel = legacyHost("app/franchize/[slug]/wheel/page.tsx");
    expect(wheel).toContain('nextHref="/franchize/vip-bike/bikes"');
    expect(wheel).not.toContain('nextHref="/franchize/discovery"');
  });

  it("stop numbers stay contiguous 1..16 (reorder-safe helpers rely on it)", () => {
    expect(TOUR_FEATURES.map((f) => f.stop)).toEqual(
      Array.from({ length: TOUR_STOPS_TOTAL }, (_, i) => i + 1),
    );
  });
});

describe("task173/174 · the finale hop is wired on the money stop", () => {
  it("season-stats (15) points to the network in BOTH branches", () => {
    const page = legacyHost("app/franchize/[slug]/season-stats/page.tsx");
    const cakeBlocks = page.match(/<RomanQuestCake[\s\S]*?\/>/g) || [];
    expect(cakeBlocks.length).toBe(2);
    for (const block of cakeBlocks) {
      expect(block).toContain('featureKey="season_stats"');
      expect(block).toContain('nextHref="/franchize/discovery"');
      expect(block).toContain("Посмотреть, кто варится");
    }
    expect(tourNextFeature(15)?.key).toBe("discovery");
  });

  it("the finale is the end of the purchasable trail: nothing follows stop 16", () => {
    expect(tourNextFeature(TOUR_STOPS_TOTAL)).toBeUndefined();
    expect(tourNextFeature(16)).toBeUndefined();
  });

  it("the finale carries no buy CTA in the modal (priceStars 0 → ctaOn false)", () => {
    // the modal gates the whole buy block behind tourFeatureHasCta
    expect(component).toContain("tourFeatureHasCta");
    expect(component).toContain("!isBirthday && ctaOn && feature");
    // the hub card gets an intentional finale badge instead of a star row
    const hub = read("app/gift/roman-quest/page.tsx");
    expect(hub).toContain("не продаётся — продаёт");
  });
});

describe("task173 · the tour survives the stuck pointer-events on map-riders", () => {
  it("the floating marker re-enables pointer-events explicitly (inherited body PE:none guard)", () => {
    expect(component).toContain('style={{ opacity: 0.55, pointerEvents: "auto" }}');
  });

  it("the stop-modal overlay re-enables pointer-events for its whole subtree", () => {
    // overlay root carries the auto; boss's «can't click on buttons in
    // feature-tour modal» died with this line
    expect(component).toContain('style={{ pointerEvents: "auto" }}');
    expect(component).toMatch(/role="dialog"[\s\S]{0,200}style=\{\{ pointerEvents: "auto" \}\}/);
  });

  it("on map-nav routes the marker lifts above the bottom deck nav", () => {
    // same route family ClientLayout pins FranchizeMapBottomNav to
    expect(component).toContain("(map-riders|leaderboard)");
    expect(component).toContain("bottom-[5.5rem] md:bottom-4");
    expect(component).toContain("const aboveBottomNav");
  });

  it("the z ladder still makes sense: marker 70 < modal 100 (nav is z-30, lightbox 9999)", () => {
    expect(component).toContain("z-[70]");
    expect(component).toContain("z-[100]");
  });
});

describe("task173 · catalog invariants after the cut (16 stops incl. the finale)", () => {
  it("preview URLs stay in the tourpix bucket (no new raw screenshots needed)", () => {
    expect(catalog).toContain("tourpix/task165");
    expect(catalog).not.toContain(".png");
  });

  it("all 16 keys are unique; suffix map has no collisions for the menu filter", () => {
    const keys = TOUR_FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(16);
    // no href collides after stripping the crew prefix — the menu filter
    // maps suffix→key (the finale keeps its full global path, also unique)
    const suffixes = TOUR_FEATURES.map((f) => f.href.replace("/franchize/vip-bike", ""));
    expect(new Set(suffixes).size).toBe(16);
  });
});

describe("task173 · codereview fix — the buy-feature entry is wired for EVERY crew", () => {
  const runtime = read("app/franchize/actions-runtime.ts");

  it("TOUR_MENU_LINK is runtime-injected into BOTH menu builders (deduped by href)", () => {
    expect(runtime).toContain('import { TOUR_MENU_LINK } from "@/components/roman-gift/tourFeatures"');
    expect(runtime).toContain("function withTourHubLink");
    expect(runtime).toContain("withTourHubLink(menuLinksRaw)");
    expect(runtime).toContain("withTourHubLink(fallbackMenuLinks(slug))");
    // dedupe: crews whose metadata already carries the link keep exactly one
    expect(runtime).toMatch(/links\.some\(\(l\) => l\.href === TOUR_MENU_LINK\.href\)/);
  });

  it("the hub href is not a crew-scoped feature — the filter always passes it", () => {
    expect(featureKeyForMenuHref("/gift/roman-quest", "moto-selection")).toBeNull();
    expect(featureKeyForMenuHref("/gift/roman-quest", "vip-bike")).toBeNull();
  });

  it("the finale is a global route — the filter maps it to no crew flag either", () => {
    expect(featureKeyForMenuHref("/franchize/discovery", "moto-selection")).toBeNull();
    expect(featureKeyForMenuHref("/franchize/discovery", "vip-bike")).toBeNull();
  });
});
