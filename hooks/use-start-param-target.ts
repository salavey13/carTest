// hooks/use-start-param-target.ts
// ─────────────────────────────────────────────────────────────────────────────
// PURE startapp-param → target-path resolver, extracted from
// useStartParamRouter.ts (2026-09-29): tests and server code can now import
// computeStaticFastTarget WITHOUT pulling the client hook graph ("use
// client" + AppContext) into a vitest transform. Behaviour is 1:1 with the
// previous inline copy — the hook file re-exports the same function.
// ─────────────────────────────────────────────────────────────────────────────

export const START_PARAM_PAGE_MAP: Record<string, string> = {
  elon: "/elon",
  musk_market: "/elon",
  arbitrage_seeker: "/elon",
  topdf_psycho: "/topdf",
  settings: "/settings",
  profile: "/profile",
  sauna: "/sauna-rent",
  streamer: "/streamer",
  demo: "/about_en",
  wb: "/wblanding",
  // ⚠️ wb_dashboard is intentionally NOT here: it must NOT enter the static
  // fast path. The gated branch below upgrades it to /wb/<crewSlug> when the
  // viewer's crew (userCrewInfo) is known — a static map entry would lock it
  // to /wblanding for everyone (caught in the 41-b code review).
  "audit-tool": "/wblanding",
  // Route create_crew deep link directly to the inline "Создать экипаж" tab
  // on /franchize/create. That tab calls createCrew() and then transitions
  // to the customization editor for the new crew. No more /wblanding bounce.
  create_crew: "/franchize/create#create-crew-form",
  reports: "/wblanding",
  crews: "/crews",
  "repo-xml": "/repo-xml",
  "style-guide": "/style-guide",
  "start-training": "/selfdev/gamified",
  paddock: "/paddock",
  leaderboard: "/leaderboard",
  "rent-bike": "/franchize/vip-bike",
};

export const BIO30_PRODUCT_PATHS: Record<string, string> = {
  cordyceps: "/bio30/categories/cordyceps-sinensis",
  spirulina: "/bio30/categories/spirulina-chlorella",
  "lions-mane": "/bio30/categories/lion-s-mane",
  "lion-s-mane": "/bio30/categories/lion-s-mane",
  magnesium: "/bio30/categories/magnesium-pyridoxine",
  "cordyceps-sinensis": "/bio30/categories/cordyceps-sinensis",
  "spirulina-chlorella": "/bio30/categories/spirulina-chlorella",
  "magnesium-pyridoxine": "/bio30/categories/magnesium-pyridoxine",
};

/**
 * Parse a rent_ deep-link parameter into its components.
 *
 * Formats:
 *   rent_{bikeId}              → standard rent (no QR, no doc hash)
 *   rent_{bikeId}_{docSha256}  → QR deep-link with doc hash for 1-click next rent
 *
 * Returns null if the param doesn't start with "rent_".
 */
export function parseRentDeepLink(param: string): { bikeId: string; docSha256: string | null } | null {
  if (!param.startsWith("rent_")) return null;

  const afterPrefix = param.slice(5); // everything after "rent_"
  if (!afterPrefix) return null;

  // Split on "_" — bike IDs use hyphens, sha256 is hex; neither contains "_"
  // "kawasaki-ex650k_abc123def" → ["kawasaki-ex650k", "abc123def"]
  // "kawasaki-ex650k"          → ["kawasaki-ex650k"]
  const parts = afterPrefix.split("_");
  const bikeId = parts[0].trim().toLowerCase();
  if (!bikeId) return null;

  // SHA256 hex is 64 chars, but accept any non-empty second segment
  const docSha256 = parts.length > 1 && parts[1].trim() ? parts[1].trim() : null;

  return { bikeId, docSha256 };
}

/**
 * Parse a testdrive_ deep-link parameter.
 *
 * Format:
 *   testdrive_{bikeId}_{docSha256}  → QR deep-link from /testdrive command
 *
 * Returns null if the param doesn't start with "testdrive_".
 * Mirrors parseRentDeepLink but for the testdrive flow (separate table +
 * separate claim RPC).
 */
export function parseTestdriveDeepLink(param: string): { bikeId: string; docSha256: string | null } | null {
  if (!param.startsWith("testdrive_")) return null;

  const afterPrefix = param.slice(10); // everything after "testdrive_"
  if (!afterPrefix) return null;

  // Split on "_" — bike IDs use hyphens, sha256 is hex; neither contains "_"
  const parts = afterPrefix.split("_");
  const bikeId = parts[0].trim().toLowerCase();
  if (!bikeId) return null;

  const docSha256 = parts.length > 1 && parts[1].trim() ? parts[1].trim() : null;

  return { bikeId, docSha256 };
}

/**
 * Parse a lead_ deep-link parameter.
 *
 * Formats:
 *   lead_{userId}           → open leads page with this lead's detail drawer
 *   leads_{segment}         → open leads page pre-filtered (hot|warm|verified|troubled)
 *
 * Returns null if the param doesn't match.
 */
export function parseLeadDeepLink(param: string): { leadId?: string; segment?: string } | null {
  // lead_{userId} — specific lead detail
  if (param.startsWith("lead_") && !param.startsWith("leads_")) {
    const leadId = param.slice(5).trim();
    if (!leadId) return null;
    return { leadId };
  }

  // leads_{segment} — pre-filtered list
  if (param.startsWith("leads_")) {
    const segment = param.slice(6).trim().toLowerCase();
    const validSegments = ["hot", "warm", "verified", "troubled", "all"];
    if (segment && validSegments.includes(segment)) {
      return { segment };
    }
  }

  return null;
}

/**
 * Parse a rental_ deep-link parameter (for analytics page, NOT the rent_ QR link).
 *
 * Formats:
 *   rental_{rentalId}  → open analytics page with this rental's detail drawer
 *
 * Returns null if the param doesn't start with "rental_".
 */
export function parseRentalDetailDeepLink(param: string): { rentalId: string } | null {
  if (!param.startsWith("rental_")) return null;
  const rentalId = param.slice(7).trim();
  if (!rentalId) return null;
  return { rentalId };
}

/**
 * Parse an analytics_ deep-link parameter.
 *
 * Formats:
 *   analytics_{tab}              → open analytics on a specific tab (rentals|sales|services)
 *   analytics_{tab}_{date}       → open analytics on a specific tab + date
 *   analytics_rental_{rentalId}  → open analytics rentals tab with rental detail
 *   analytics_sale_{saleId}      → open analytics sales tab with sale detail
 *
 * Returns null if the param doesn't start with "analytics_".
 */
export function parseAnalyticsDeepLink(param: string): {
  tab?: string;
  date?: string;
  rentalId?: string;
  saleId?: string;
} | null {
  if (!param.startsWith("analytics_")) return null;
  const rest = param.slice(10); // after "analytics_"

  // analytics_rental_{rentalId}
  if (rest.startsWith("rental_")) {
    return { tab: "rentals", rentalId: rest.slice(7) };
  }

  // analytics_sale_{saleId}
  if (rest.startsWith("sale_")) {
    return { tab: "sales", saleId: rest.slice(5) };
  }

  // analytics_{tab}_{date} — e.g. analytics_rentals_2026-07-24
  const dateMatch = rest.match(/^(rentals|sales|services)_(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return { tab: dateMatch[1], date: dateMatch[2] };
  }

  // analytics_{tab} — e.g. analytics_rentals
  if (["rentals", "sales", "services"].includes(rest)) {
    return { tab: rest };
  }

  return null;
}

/**
 * FAST PATH for wall deep links (wall v4).
 *
 * The OLD flow waited for the full Telegram auth roundtrip before ANY routing
 * (`isAppLoading || isAuthenticating` gate), so a notification deep link sat on
 * the home page for seconds while dbUser + crew snapshot were fetched, and only
 * THEN navigated. Wall destinations are PUBLIC pages — the auth wait bought
 * nothing for them.
 *
 * Params whose payload is self-contained route IMMEDIATELY on first render:
 *   wall_<slug>               → /franchize/<slug>/community
 *   post_<postId>_<slug>      → /franchize/<slug>/community?post=<id>
 *   wallp_<rentalId>_<slug>   → /franchize/<slug>/community?compose=<id>
 *   ride_<sessionId>_<slug>   → /franchize/<slug>/community?ride=<id>
 *   rider_<userId>_<slug>     → /franchize/<slug>/rider/<userId> (public
 *                               rider profile, Chain-style — profile v1)
 *   join_<slug>               → /franchize/<slug>?join_crew=true (crew invite:
 *                               admin sends to a future owner; the person
 *                               auto-joins as member, promotion comes later)
 *
 * Bare forms (wall / post_<id>) need userCrewInfo to resolve the crew — they
 * stay on the gated path (this returns null for them).
 */
export function computeFastWallTarget(param: string): string | null {
  const link = parseWallDeepLink(param);
  if (!link) return null;
  if (link.kind === "wall") {
    return link.slug ? `/franchize/${link.slug}/community` : null;
  }
  if (link.kind === "post") {
    return link.slug ? `/franchize/${link.slug}/community?post=${link.postId}` : null;
  }
  if (link.kind === "compose-ride") {
    return `/franchize/${link.slug}/community?ride=${link.sessionId}`;
  }
  if (link.kind === "rider") {
    return `/franchize/${link.slug}/rider/${link.userId}`;
  }
  if (link.kind === "join") {
    // Invite links must work for people who are NOT members yet — route them
    // on the fast path (no auth wait); JoinCrewBanner handles the rest.
    return `/franchize/${link.slug}?join_crew=true`;
  }
  return `/franchize/${link.slug}/community?compose=${link.rentalId}`;
}

/**
 * STATIC fast path (2026-09-22 routing speed fix).
 *
 * The OLD flow routed EVERYTHING behind `isAppLoading || isAuthenticating` —
 * i.e. after the full Telegram auth roundtrip (validate-telegram-auth →
 * fetchDbUser → maybe upsert). Deep links to static pages sat on the entry
 * page long enough for the whole catalog to load before the transition —
 * «catalog finishes loading before transition happens».
 *
 * Params whose target is fully determined by the param itself (no dbUser /
 * userCrewInfo needed) route IMMEDIATELY, before the auth gate:
 *   · every START_PARAM_PAGE_MAP key (rent-bike, crews, settings, …);
 *   · mapriders_<slug> / mapriders-<slug> — slug carried in the param
 *     (bare mapriders with no slug still needs userCrewInfo → gated);
 *   · crew_<slug> and legacy <slug>_join_crew / crew_<slug>_join_crew;
 *   · viz_<id>.
 *
 * Params that need auth data (rent_/cart_/testdrive_ claims, analytics/
 * lead/rental slug via userCrewInfo, bare wall forms) stay on the gated
 * path — the gate itself is now cheaper (auth is a single roundtrip since
 * the validate API returns the dbUser).
 */
export function computeStaticFastTarget(param: string): string | null {
  // Static page map — target is a constant, auth buys nothing.
  if (START_PARAM_PAGE_MAP[param]) return START_PARAM_PAGE_MAP[param];

  // mapriders_<slug> — self-contained (slug in the param).
  if (param.startsWith("mapriders_") || param.startsWith("mapriders-")) {
    const sep = param.includes("_") ? "_" : "-";
    const slug = param.split(sep).slice(1).join(sep).trim();
    if (slug && /^[a-z0-9-]{1,64}$/i.test(slug)) return `/franchize/${slug}/map-riders`;
    // Bare mapriders — needs userCrewInfo → gated path decides.
    return null;
  }

  // storage_<slug> — the «Зимнее хранение» owner wall (2026-09-27). The page
  // itself adapts: staff sees the season board, a logged-in owner his bikes,
  // a guest the offer — so no auth data is needed to route (self-contained).
  // storage_<slug>_<bikeId> (2026-09-29, boss nuance 2) — straight into the
  // bike's «Карточка хранения» story page. storage_bikes ids are uuids
  // (hyphens, NO underscores), so splitting the rest at the LAST underscore
  // disambiguates: slugs may contain underscores, uuids cannot.
  if (param.startsWith("storage_")) {
    const rest = param.substring(8);
    const lastUnderscore = rest.lastIndexOf("_");
    if (lastUnderscore > 0) {
      const maybeSlug = rest.slice(0, lastUnderscore);
      const maybeBikeId = rest.slice(lastUnderscore + 1);
      if (
        maybeSlug
        && /^[A-Za-z0-9_-]{1,64}$/.test(maybeSlug)
        && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(maybeBikeId)
      ) {
        return `/franchize/${maybeSlug}/storage/${maybeBikeId}`;
      }
    }
    if (rest && /^[A-Za-z0-9_-]{1,64}$/.test(rest)) return `/franchize/${rest}/storage`;
    return null;
  }

  // crew_<slug> / crew_<slug>_join_crew — self-contained.
  if (param.startsWith("crew_")) {
    const content = param.substring(5);
    if (content.endsWith("_join_crew")) {
      const slug = content.substring(0, content.length - 10);
      if (slug) return `/franchize/${slug}?join_crew=true`;
      return null;
    }
    if (content) return `/franchize/${content}`;
    return null;
  }

  // viz_<id> — god-mode sandbox sim.
  if (param.startsWith("viz_")) {
    const simId = param.substring(4);
    if (simId) return `/god-mode-sandbox?simId=${simId}`;
    return null;
  }

  return null;
}
