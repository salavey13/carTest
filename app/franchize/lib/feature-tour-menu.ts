// app/franchize/lib/feature-tour-menu.ts — task166: crews.metadata.feature_tour
// flags DRIVE the header menu (boss: «as i said i want this flags to control
// the list of links in header menu (configured in crew metadata;)»).
//
// The rule is deliberately LITERAL and uniform for every crew:
//   · a menu link whose target is a crew-scoped TOUR FEATURE route
//     (/configurator, /wheel, /bikes, /cart, /profile, /calc-explainer,
//      /map-riders, /community, /sales, /about, /contacts, /onboarding,
//      /electro-enduro, /season-stats) renders ONLY when the crew's
//     metadata.feature_tour[<featureKey>] === true;
//   · everything else is NEVER filtered — the crew's own storefront (the
//     home link), external links, hash anchors, root-relative landings and
//     the ⭐ tour link (/gift/roman-quest) always render;
//   · no flags yet (fresh crew / feature_tour unset) → feature links hidden.
//     The golden-standard vip-bike keeps its full menu because the seed
//     script (scripts/task166-feature-tour-menu-flags.mjs) set ALL its flags
//     to true — the quest's owner checkboxes (POST /api/roman-quest/activations)
//     are the day-to-day control, and toggling a checkbox instantly grows or
//     shrinks that crew's burger menu (SSR reads metadata → zero code).
//
// PURE module — no IO, no React. The public VM builder
// (actions-runtime.getFranchizeBySlug) applies it after withSlug() resolution.

import { TOUR_FEATURES } from "@/components/roman-gift/tourFeatures";

export type FeatureTourFlags = Record<string, boolean>;

/** Route suffixes (after `/franchize/<slug>`) that are flag-controlled. */
const FEATURE_SUFFIX_BY_KEY: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const feature of TOUR_FEATURES) {
    const href = feature.href ?? "";
    // Crew-scoped routes look like /franchize/<slug>/suffix (the catalog
    // literals use the vip-bike slug). Global routes (/, /leaderboard,
    // /rent-bike, /franchize/discovery) are NOT crew features — skip them:
    // a crew menu never links them per-crew.
    const crewScoped = href.startsWith("/franchize/");
    if (!crewScoped) continue;
    const afterSlug = href.slice("/franchize/".length).replace(/^[^/]+/, "");
    // storefront → "" (the crew home) — excluded from filtering by the
    // caller below; keeping it in the map is harmless but the empty suffix
    // never matches a sub-page link.
    map.set(feature.key, afterSlug);
  }
  return map;
})();

/** Reverse index: route suffix → feature key (first wins, keys are unique). */
const KEY_BY_SUFFIX: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [key, suffix] of FEATURE_SUFFIX_BY_KEY) {
    if (suffix && !map.has(suffix)) map.set(suffix, key);
  }
  return map;
})();

/** Booleans-only read of crews.metadata.feature_tour (same dialect as the activations API). */
export function featureTourFlagsOf(metadata: unknown): FeatureTourFlags {
  const raw = (metadata as { feature_tour?: unknown } | null)?.feature_tour;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const flags: FeatureTourFlags = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") flags[key] = value;
  }
  return flags;
}

export interface MenuLinkLike {
  label: string;
  href: string;
}

/**
 * Strip the query/hash, then the `/franchize/<slug>` prefix.
 * Returns:
 *   { kind: "home" }            — the crew's own storefront (/franchize/<slug>)
 *   { kind: "crew", suffix }    — a crew-scoped sub-route
 *   { kind: "other" }           — external / global / hash / root-relative
 */
function classifyHref(href: string, slug: string): { kind: "home" } | { kind: "crew"; suffix: string } | { kind: "other" } {
  const raw = String(href || "").trim();
  if (!raw) return { kind: "other" };
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:")) return { kind: "other" };
  const path = raw.split("#")[0].split("?")[0];
  if (!path) return { kind: "other" };
  const prefix = `/franchize/${slug}`;
  if (path === prefix) return { kind: "home" };
  if (path.startsWith(`${prefix}/`)) return { kind: "crew", suffix: path.slice(prefix.length) };
  return { kind: "other" };
}

/**
 * Filter the resolved header menuLinks by the crew's feature_tour flags.
 * Links that are not crew-scoped tour features pass through untouched.
 */
export function filterMenuLinksByFeatureTour<T extends MenuLinkLike>(
  links: T[],
  flags: FeatureTourFlags,
  slug: string,
): T[] {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return links;
  return links.filter((link) => {
    const classified = classifyHref(link.href, safeSlug);
    if (classified.kind !== "crew") return true;
    const key = KEY_BY_SUFFIX.get(classified.suffix);
    if (!key) return true; // not a tour feature route — plain crew page
    return flags[key] === true;
  });
}

/** Test/spec helper: which feature key (if any) does this href map to? */
export function featureKeyForMenuHref(href: string, slug: string): string | null {
  const classified = classifyHref(href, slug);
  if (classified.kind !== "crew") return null;
  return KEY_BY_SUFFIX.get(classified.suffix) ?? null;
}
