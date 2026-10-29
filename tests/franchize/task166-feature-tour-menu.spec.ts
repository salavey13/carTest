// Task 166 — three workstreams from the boss's follow-up (30.10):
//
// 1. «as i said i want this flags to control the list of links in header menu
//    (configured in crew metadata;)» — crews.metadata.feature_tour flags now
//    DRIVE the burger menu: crew-scoped tour-feature links render only when
//    the flag is ON; the home link, external/hash links and the ⭐ tour link
//    always pass. Golden-standard vip-bike (and the other crews whose menus
//    already carry feature routes) are seeded all-true by
//    scripts/task166-feature-tour-menu-flags.mjs — nothing changes visually
//    for them; fresh crews (moto-selection) start minimal and GROW the menu
//    through the quest's activation checkboxes / paid ⭐ activations.
//
// 2. «rental deep link didn't open also, please doublecheck startapprouter
//    for regression» — hardening of the whole start_param chain:
//      · normalizeStartParamPath no longer lets decodeURIComponent URIError
//        kill the routing effect synchronously (it ran BEFORE the try);
//      · the router's try gained a CATCH (was try/finally only — any throw
//        was a silent unhandled rejection and the param never routed);
//      · AppContext processes a NEW (different) start_param value in the
//        same SPA life instead of a one-shot boolean guard.
//
// 3. Bonus (street-dude phone: «highlighting doesn't highlight, text turns
//    black becoming invisible, item modal didn't open up») — the catalog
//    degrades gracefully instead of dying:
//      · EVERY var() on the catalog/modal surface carries a concrete
//        dark-brand fallback (var-less engines — lite/proxy browsers,
//        ancient WebViews — keep readable text and the accent);
//      · ALL WebStorage access on the catalog hydration path is guarded
//        (storage ACCESS ITSELF throws on cookie-blocking phones — one
//        unguarded getItem in a mount effect killed the whole hydration);
//      · ItemModal is wrapped in its own error boundary — a modal-internal
//        crash can no longer take the catalog page down.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  filterMenuLinksByFeatureTour,
  featureTourFlagsOf,
  featureKeyForMenuHref,
} from "../../app/franchize/lib/feature-tour-menu";
import { TOUR_FEATURES, TOUR_MENU_LINK } from "../../components/roman-gift/tourFeatures";

const read = (p: string) => readFileSync(p, "utf8");
const runtime = read("app/franchize/actions-runtime.ts");
const featureMenu = read("app/franchize/lib/feature-tour-menu.ts");
const router = read("hooks/useStartParamRouter.ts");
const appContext = read("contexts/AppContext.tsx");
const catalog = read("app/franchize/components/CatalogClient.tsx");
const itemModal = read("app/franchize/modals/Item.tsx");
const cartHook = read("app/franchize/hooks/useFranchizeCart.ts");
const globals = read("app/globals.css");
const themeLib = read("app/franchize/lib/theme.ts");
const safeStorage = read("app/franchize/lib/safe-storage.ts");

const link = (label: string, href: string) => ({ label, href });

describe("task166 · feature_tour flags drive the header menu", () => {
  const SLUG = "moto-selection";
  const vipBikeLinks = [
    link("Каталог", "/franchize/moto-selection"),
    link("О нас", "/franchize/moto-selection/about"),
    link("Контакты", "/franchize/moto-selection/contacts"),
    link("Корзина", "/franchize/moto-selection/cart"),
    link("Мотопарк", "/franchize/moto-selection/bikes"),
    link("Колесо фортуны", "/franchize/moto-selection/wheel"),
    link("Конфигуратор", "/franchize/moto-selection/configurator"),
    link("Сообщество", "/franchize/moto-selection/community"),
    link("Карта райдеров", "/franchize/moto-selection/map-riders"),
    link("Партнёрам", "/franchize/moto-selection/onboarding"),
    link("Продажи", "/franchize/moto-selection/sales"),
    link("Мои аренды", "/franchize/moto-selection/profile"),
    link("Прайс", "/franchize/moto-selection/calc-explainer"),
    link("Электро", "/franchize/moto-selection/electro-enduro"),
    link("Цифры сезона", "/franchize/moto-selection/season-stats"),
    TOUR_MENU_LINK,
    link("Telegram", "https://t.me/moto_selection"),
    link("FAQ", "/franchize/moto-selection#faq"),
  ];

  it("every crew-scoped TOUR_FEATURES href maps to exactly one route suffix", () => {
    const suffixes = new Map<string, string>();
    for (const f of TOUR_FEATURES) {
      if (!f.href.startsWith("/franchize/")) continue;
      const suffix = f.href.slice(`/franchize/${"vip-bike"}`.length);
      if (suffix === "") continue; // storefront = the crew home, exempt
      expect(suffixes.has(suffix), `duplicate suffix ${suffix}`).toBe(false);
      suffixes.set(suffix, f.key);
    }
    // the crew-scoped set the menu filter speaks
    for (const s of ["/configurator", "/wheel", "/bikes", "/cart", "/profile", "/calc-explainer", "/map-riders", "/community", "/sales", "/about", "/contacts", "/onboarding", "/electro-enduro", "/season-stats"]) {
      expect(suffixes.has(s), `missing feature route ${s}`).toBe(true);
    }
  });

  it("fresh crew (no flags): only non-feature links render — home, external, hash, tour link", () => {
    const out = filterMenuLinksByFeatureTour(vipBikeLinks, {}, SLUG);
    const labels = out.map((l) => l.label);
    expect(labels).toContain("Каталог"); // home — the door always renders
    expect(labels).toContain("⭐ Фичи экипажа"); // the tour hop always renders
    expect(labels).toContain("Telegram"); // external
    expect(labels).toContain("FAQ"); // hash anchor
    expect(labels).not.toContain("О нас");
    expect(labels).not.toContain("Корзина");
    expect(labels).not.toContain("Мотопарк");
    expect(labels).not.toContain("Колесо фортуны");
    expect(labels).not.toContain("Цифры сезона");
  });

  it("activated flags grow the menu back — one flag at a time", () => {
    const partial = filterMenuLinksByFeatureTour(vipBikeLinks, { about: true, bikes: true }, SLUG);
    const labels = partial.map((l) => l.label);
    expect(labels).toContain("О нас");
    expect(labels).toContain("Мотопарк");
    expect(labels).not.toContain("Корзина"); // still off
  });

  it("all-true flags render the full menu (golden standard vip-bike seed)", () => {
    const allTrue: Record<string, boolean> = {};
    for (const f of TOUR_FEATURES) allTrue[f.key] = true;
    const out = filterMenuLinksByFeatureTour(vipBikeLinks, allTrue, SLUG);
    expect(out.length).toBe(vipBikeLinks.length);
  });

  it("featureKeyForMenuHref: suffix matching is slug-agnostic and query/hash-proof", () => {
    expect(featureKeyForMenuHref("/franchize/moto-selection/wheel", "moto-selection")).toBe("wheel");
    expect(featureKeyForMenuHref("/franchize/vip-bike/calc-explainer", "vip-bike")).toBe("price_calc");
    expect(featureKeyForMenuHref("/franchize/moto-selection/cart?x=1", "moto-selection")).toBe("cart");
    expect(featureKeyForMenuHref("/franchize/moto-selection#faq", "moto-selection")).toBeNull();
    expect(featureKeyForMenuHref("/franchize/moto-selection", "moto-selection")).toBeNull(); // home
    expect(featureKeyForMenuHref("https://t.me/x", "moto-selection")).toBeNull();
    expect(featureKeyForMenuHref("/leaderboard", "moto-selection")).toBeNull();
  });

  it("featureTourFlagsOf keeps booleans only (the activations API dialect)", () => {
    expect(featureTourFlagsOf({ feature_tour: { about: true, cart: false, junk: "yes", n: 1 } })).toEqual({
      about: true,
      cart: false,
    });
    expect(featureTourFlagsOf({})).toEqual({});
    expect(featureTourFlagsOf(null)).toEqual({});
    expect(featureTourFlagsOf({ feature_tour: "oops" })).toEqual({});
  });

  it("the public VM builder applies the filter (and the not-found shell too)", () => {
    expect(runtime).toContain("filterMenuLinksByFeatureTour(");
    expect(runtime).toContain("featureTourFlagsOf(metadata)");
    expect(runtime).toContain("filterMenuLinksByFeatureTour(fallbackMenuLinks(slug), {}, slug)");
    // wired AFTER withSlug resolution — the filter sees resolved hrefs
    expect(runtime.indexOf("const menuLinksRaw = readArrayPath")).toBeGreaterThan(-1);
    expect(runtime.indexOf("filterMenuLinksByFeatureTour(\n      menuLinksRaw")).toBeGreaterThan(
      runtime.indexOf("const menuLinksRaw = readArrayPath"),
    );
  });

  it("the seed script covers every TOUR_FEATURES key for the golden standard + legacy menus", () => {
    const seed = read("scripts/task166-feature-tour-menu-flags.mjs");
    for (const f of TOUR_FEATURES) {
      expect(seed).toContain(`"${f.key}"`);
    }
    expect(seed).toContain('"vip-bike"');
    expect(seed).toContain("merge"); // documented merge-only intent
  });
});

describe("task166 · startapp router hardening (deep link didn't open)", () => {
  it("normalizeStartParamPath survives malformed escapes (no sync URIError in the effect body)", () => {
    expect(router).toContain("let decoded = rawParam;");
    expect(router).toMatch(/try \{\s*decoded = decodeURIComponent\(rawParam\);/);
    // the guard comment explains the WHY for future greps
    expect(router).toContain("killed the whole routing effect on every render");
  });

  it("the routing try has a CATCH — a throw can no longer be a silent unhandled rejection", () => {
    expect(router).toContain('[ClientLayout] Failed to process start param:');
    // poison-param guard: handled params are marked so they never loop-retry
    expect(router).toMatch(/catch \(error\) \{[\s\S]*?lastHandledStartParamRef\.current = paramToProcess;/);
  });

  it("AppContext processes a NEW start_param value instead of a one-shot boolean", () => {
    // the old boolean guard must be gone from CODE (the task166 comment may
    // mention its name — that is documentation, not usage)
    expect(appContext).not.toContain("processedStartParam.current");
    expect(appContext).toContain("lastProcessedStartParamRef.current === startParam");
    expect(appContext).toContain("lastProcessedStartParamRef.current = startParam");
  });

  it("rental_ routing still lands on the dedicated page with the last-segment id", () => {
    expect(router).toContain('paramToProcess.startsWith("rental_")');
    expect(router).toContain("/franchize/${crewSlug}/rental/${parsed.rentalId}");
  });
});

describe("task166 · catalog graceful degradation (street-dude phone)", () => {
  it("every var() on the catalog surface carries a concrete fallback", () => {
    for (const src of [catalog, itemModal]) {
      const bare = src.match(/var\(--(?:catalog|item)-[a-z-]*\)/g) ?? [];
      expect(bare, `bare vars in ${src === catalog ? "CatalogClient" : "Item"}: ${bare.join(", ")}`).toEqual([]);
    }
    // the dark-brand fallback values themselves
    expect(catalog).toContain("var(--catalog-text,#f2f2f3)");
    expect(catalog).toContain("var(--catalog-accent,#d99a00)");
    expect(catalog).toContain("var(--catalog-card-bg,#111217)");
    expect(itemModal).toContain("var(--item-text,#f2f2f3)");
    expect(itemModal).toContain("var(--item-accent,#d99a00)");
    // globals.css catalog rules + the auto-theme double var chains
    expect(globals).toContain("var(--catalog-accent,#d99a00)");
    expect(themeLib).toContain("var(--franchize-bg-base,#0b0c10)");
    expect(themeLib).toContain("var(--franchize-text-primary,#f2f2f3)");
  });

  it("no unguarded WebStorage access remains on the catalog hydration path", () => {
    for (const [name, src] of [
      ["CatalogClient", catalog],
      ["ItemModal", itemModal],
      ["useFranchizeCart", cartHook],
    ] as const) {
      // comment lines may mention the old calls (documentation) — strip them
      // so the assertion speaks about CODE only
      const codeOnly = src
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      const bare = codeOnly.match(/(?<!safe)\b(?:window\.)?(?:sessionStorage|localStorage)\.(?:getItem|setItem|removeItem)/g) ?? [];
      expect(bare, `${name}: unguarded storage calls: ${bare.join(", ")}`).toEqual([]);
    }
    // the wrappers themselves are throw-proof by construction
    expect(safeStorage).toContain("catch {");
    expect(safeStorage).toContain("safeSessionStorage");
    expect(safeStorage).toContain("safeLocalStorage");
  });

  it("ItemModal is wrapped in its own error boundary (a modal crash keeps the catalog alive)", () => {
    expect(catalog).toContain("import { FranchizeErrorBoundary }");
    expect(catalog).toMatch(/<FranchizeErrorBoundary[\s\S]*?resetKey=\{selectedItem\?\.id[\s\S]*?>\s*\{\s*<ItemModal|<FranchizeErrorBoundary[\s\S]*?<ItemModal/);
    expect(catalog).toContain("</FranchizeErrorBoundary>");
  });

  it("the cart hook speaks safe storage (hydration effect cannot throw on blocked storage)", () => {
    expect(cartHook).toContain("safeLocalStorage.getItem(storageKey)");
    expect(cartHook).toContain("safeLocalStorage.setItem(storageKey");
    expect(cartHook).toContain("safeSessionStorage.getItem(syncHash)");
  });
});
