// Task 164 — BESTSELLER tour (boss audio 29.10 «BESTSELLER» + «BESTESTCONFIGURER»).
// ──────────────────────────────────────────────────────────────────────────
// The birthday quest becomes a product: a self-promoting tour of ALL main-menu
// features with per-stop CTA. Boss, verbatim intent:
//   • «если кто-то другой заходит вместо Романа — ему не поздравление: всё
//     то же самое, всё покажу, расскажу, только он ещё может нажать кнопку»;
//   • «галочки для владельца криу, чтобы активировать его криу — даже если
//     он по чужой криу лазит» (crews.metadata.feature_tour of HIS OWN crew);
//   • «в главном меню появляется ссылка — прописывается с метаданных»
//     (crews.metadata.franchize.header.menuLinks — existing mechanism, DB-only);
//   • «для Романа торт, для других — другой интересный концепт» (⭐);
//   • «конфетти остаётся только последней страницей» — /gift/roman is
//     ROMAN-ONLY, everyone else gets the tour finale.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  TOUR_FEATURES,
  TOUR_STOPS_TOTAL,
  TOUR_FEATURE_KEYS,
  TOUR_MENU_LINK,
  tourFeatureByKey,
  tourFeatureHasCta,
} from "../../components/roman-gift/tourFeatures";

const read = (p: string) => readFileSync(p, "utf8");
const component = read("components/roman-gift/RomanQuestCake.tsx");
const gate = read("app/api/roman-quest/gate/route.ts");
const activations = read("app/api/roman-quest/activations/route.ts");
const overview = read("app/gift/roman-quest/page.tsx");
const gift = read("app/gift/roman/page.tsx");

const hostPage = (p: string) => read(`app/franchize/[slug]/${p}/page.tsx`);
const ROOT_PAGE = read("app/page.tsx");
const RENT_BIKE = read("app/rent-bike/page.tsx");
const LEADERBOARD = read("app/leaderboard/page.tsx");
const DISCOVERY = read("app/franchize/discovery/page.tsx");

describe("task164 · tour catalog — 19 stops (task165: the full onboarding quest)", () => {
  it("nineteen sequential stops with unique keys and stable machine names", () => {
    expect(TOUR_STOPS_TOTAL).toBe(19);
    expect(TOUR_FEATURES.map((f) => f.stop)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(new Set(TOUR_FEATURES.map((f) => f.key)).size).toBe(19);
    // boss named these explicitly: «прямо прайс, эту карту, конфигуратор»
    expect(TOUR_FEATURE_KEYS.has("configurator")).toBe(true);
    expect(TOUR_FEATURE_KEYS.has("price_calc")).toBe(true);
    expect(TOUR_FEATURE_KEYS.has("map_riders")).toBe(true);
  });

  it("every stop href is a real route in the repo", () => {
    const routeOf = (href: string): string => {
      if (href === "/") return "app/page.tsx";
      if (href === "/franchize/vip-bike") return "app/franchize/[slug]/page.tsx";
      if (href.startsWith("/franchize/vip-bike/")) return `app/franchize/[slug]/${href.slice("/franchize/vip-bike/".length)}/page.tsx`;
      return `app${href}/page.tsx`;
    };
    for (const f of TOUR_FEATURES) {
      expect(existsSync(routeOf(f.href)), routeOf(f.href)).toBe(true);
    }
  });

  it("the landing is the door, not a feature — no CTA on stop 1", () => {
    expect(tourFeatureHasCta("landing")).toBe(false);
    expect(tourFeatureByKey("configurator")?.priceStars).toBeGreaterThan(0);
    expect(tourFeatureByKey("season_stats")?.priceStars).toBeGreaterThan(0);
  });
});

describe("task164 · gate v2 — tour for everyone, birthday for Roman only", () => {
  it("default Roman id is Роман Воробьёв (co_owner 244736261), env-overridable", () => {
    expect(gate).toContain('DEFAULT_ROMAN_TG_IDS = "244736261"');
    expect(gate).toContain("ROMAN_TG_USER_IDS");
  });

  it("no cookie → public tour guest; roman → birthday; owner → tour+crewSlug; member/guest → tour (task165: +authenticated flag)", () => {
    expect(gate).toContain('{ show: true, skin: "tour", role: "guest", authenticated: false }');
    expect(gate).toContain('{ show: true, skin: "birthday", role: "roman", authenticated: true }');
    expect(gate).toContain('{ show: true, skin: "tour", role: "owner", crewSlug, authenticated: true }');
    expect(gate).toContain('{ show: true, skin: "tour", role: "member", authenticated: true }');
    // fail-open degrades to the PUBLIC tour, never hides
    expect(gate).toContain('{ show: true, skin: "tour", role: "guest", authenticated: false }');
  });

  it("client cache key bumped to v2 — stale v1 «hidden» verdicts can't suppress the tour", () => {
    expect(component).toContain('GATE_SESSION_KEY = "roman-quest-gate-v2"');
    expect(component).not.toContain('"hidden"');
  });
});

describe("task164 · activations — per-crew feature flags in crews.metadata", () => {
  it("GET returns the OWNER's own flags; POST is owner-only with key validation", () => {
    expect(activations).toContain('error: "not-owner"');
    expect(activations).toContain('error: "bad-feature-key"');
    expect(activations).toContain("TOUR_FEATURE_KEYS.has(featureKey)");
    expect(activations).toContain('.eq("owner_id", userId)');
  });

  it("the write MERGES metadata — franchize UI config (menuLinks/theme) survives", () => {
    expect(activations).toMatch(/const merged = \{ \.\.\.meta, feature_tour: nextFlags \}/);
    expect(activations).toMatch(/Re-read right before the write/);
  });

  it("flags live under feature_tour of the crew the user OWNS (never the browsed crew)", () => {
    expect(activations).toContain("feature_tour");
    expect(activations).toContain("даже если\n// он по чужой криу лазит");
  });
});

describe("task164 · stop component — two skins on one trail", () => {
  it("birthday = cake + riddle (unchanged voice); tour = star + pitch + gives", () => {
    expect(component).toContain('const markerIcon = isBirthday ? "🎂" : "⭐"');
    expect(component).toContain('"Роман, это для тебя"');
    expect(component).toContain('"ФИЧА-ТУР VIP BIKE"');
    expect(component).toContain("Что это даёт экипажу:");
  });

  it("owner CTA is a REAL activation checkbox; guests get the ⭐ demo that routes to Telegram", () => {
    expect(component).toContain("Включить для экипажа");
    expect(component).toContain("/api/roman-quest/activations");
    expect(component).toContain("⭐ {feature.priceStars} · Подключить фичу");
    expect(component).toContain("https://t.me/I_O_S_NN");
  });

  it("the finale swap: tour users land on the tour hub, not the birthday letter", () => {
    expect(component).toContain('resolvedNextHref = isFinaleStep && !isBirthday ? "/gift/roman-quest" : nextHref');
    expect(component).toContain('"К финалу тура"');
  });

  it("no flash while the gate resolves — and the tour renders for EVERYONE after", () => {
    expect(component).toContain('if (gate.status === "loading") return null;');
    // v1 hid the whole quest from TG-identified simple users; v2 shows the tour
    expect(component).not.toContain('gate === "hidden"');
  });
});

describe("task164 · the trail — 10 wired stops", () => {
  it("stop 1 landing (девятнадцать следов now)", () => {
    expect(ROOT_PAGE).toContain('featureKey="landing"');
    expect(ROOT_PAGE).toContain("девятнадцать следов");
    // task165: stop numbers derive from the catalog — no host-page hardcode
    expect(ROOT_PAGE).not.toContain("stop={1}");
  });
  it("stop 2 витрина → leads to the configurator", () => {
    const franchize = read("app/franchize/[slug]/page.tsx");
    expect(franchize).toContain('featureKey="storefront"');
    expect(franchize).toContain('nextHref="/franchize/vip-bike/configurator"');
  });
  it("stop 3 конфигуратор → NOW leads to electro-enduro", () => {
    const page = hostPage("configurator");
    expect(page).toContain('featureKey="configurator"');
    expect(page).toContain('nextHref="/franchize/vip-bike/electro-enduro"');
  });
  it("stop 6 карта сети → зал славы", () => {
    expect(DISCOVERY).toContain('featureKey="discovery"');
    expect(DISCOVERY).toContain('nextHref="/leaderboard"');
  });
  it("stop 7 зал славы → гараж", () => {
    expect(LEADERBOARD).toContain('featureKey="leaderboard"');
    expect(LEADERBOARD).toContain('nextHref="/rent-bike"');
  });
  it("stop 8 гараж → NOW leads to the мотопарк", () => {
    expect(RENT_BIKE).toContain('featureKey="garage"');
    expect(RENT_BIKE).toContain('nextHref="/franchize/vip-bike/bikes"');
  });
  it("stop 12 прайс-калькулятор in BOTH branches (members-only page)", () => {
    const page = hostPage("calc-explainer");
    expect(page.match(/featureKey="price_calc"/g)?.length).toBe(2);
  });
  it("stop 13 карта райдеров → стена сообщества", () => {
    const page = hostPage("map-riders");
    expect(page).toContain('featureKey="map_riders"');
    expect(page).toContain('nextHref="/franchize/vip-bike/community"');
  });
  it("stop 14 стена сообщества → NOW leads to the витрина продаж", () => {
    const page = hostPage("community");
    expect(page).toContain('featureKey="community"');
    expect(page).toContain('nextHref="/franchize/vip-bike/sales"');
  });
  it("stop 19 цифры сезона in BOTH branches — the finale stop", () => {
    const page = hostPage("season-stats");
    expect(page.match(/featureKey="season_stats"/g)?.length).toBe(2);
  });
  it("the trail chain is gapless: each stop's nextHref equals the next stop's host href (task165: keyed, not numbered)", () => {
    for (let i = 0; i < TOUR_FEATURES.length - 1; i++) {
      const cur = TOUR_FEATURES[i];
      const next = TOUR_FEATURES[i + 1];
      // the host that carries stop N must link to the host of stop N+1
      const hostSrc =
        cur.href === "/"
          ? ROOT_PAGE
          : cur.href === "/rent-bike"
            ? RENT_BIKE
            : cur.href === "/leaderboard"
              ? LEADERBOARD
              : cur.href === "/franchize/discovery"
                ? DISCOVERY
                : cur.href === "/franchize/vip-bike"
                  ? read("app/franchize/[slug]/page.tsx")
                  : read(`app/franchize/[slug]/${cur.href.split("/").pop()}/page.tsx`);
      const cakeBlock = hostSrc.match(/<RomanQuestCake[\s\S]*?\/>/g) || [];
      expect(cakeBlock.some((b) => b.includes(`featureKey="${cur.key}"`) && b.includes(`nextHref="${next.href}"`))).toBe(true);
    }
  });
});

describe("task164 · surfaces — overview v2 + roman-only gift", () => {
  it("overview has BOTH heroes and the owner activation panel", () => {
    expect(overview).toContain("Квест");
    expect(overview).toContain("ФИЧА-ТУР");
    expect(overview).toContain("Активация для экипажа");
    expect(overview).toContain("/api/roman-quest/activations");
  });

  it("finale split: Roman → gift card; tour → sales finale", () => {
    expect(overview).toContain('router.push("/gift/roman")');
    expect(overview).toContain("Хочу такой экипаж");
    expect(overview).toContain("Соберите свой набор");
  });

  it("the birthday letter is ROMAN-ONLY — others are redirected to the tour", () => {
    expect(gift).toContain("useFeatureTourGate");
    expect(gift).toContain('router.replace("/gift/roman-quest")');
    expect(gift).toContain("!isRoman");
  });

  it("the menu link is pure metadata config (menuLinks mechanism, no code)", () => {
    expect(TOUR_MENU_LINK.href).toBe("/gift/roman-quest");
    expect(TOUR_MENU_LINK.label).toContain("Фичи экипажа");
  });
});
