// tests/franchize/wall-geotags.spec.ts
//
// Wall × map interlink round 4: «пост с геотегом» + merge стены в шит карты.
//   · unit: sanitizeWallGeo (WGS-84 bounds, label cap, hostile input);
//   · unit: formatGeoCoords / haversineMeters / findNearestMotoSpot;
//   · unit: map-riders page wallParams validation shapes;
//   · source: geotag columns flow (migration → action insert/feed/pins);
//   · source: sheet hosts the real CommunityWallClient (obsolete blocks gone);
//   · source: wall↔map focus events + posts-changed sync + RacingMap focus.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatGeoCoords,
  sanitizeWallGeo,
  WALL_GEO_EXCERPT_LEN,
  WALL_GEO_LABEL_MAX_LEN,
  WALL_GEO_PINS_LIMIT,
  WALL_FOCUS_POST_EVENT,
  WALL_POSTS_CHANGED_EVENT,
} from "@/app/franchize/lib/community-wall";
import { findNearestMotoSpot, haversineMeters, NN_MOTO_SPOTS } from "@/lib/map-riders-spots";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── sanitizeWallGeo ──────────────────────────────────────────────────────────

describe("sanitizeWallGeo", () => {
  it("keeps a valid point and trims/caps the label", () => {
    const geo = sanitizeWallGeo({ lat: 56.2964, lng: 43.9464, label: `  ${"x".repeat(200)}  ` });
    expect(geo).not.toBeNull();
    expect(geo?.lat).toBe(56.2964);
    expect(geo?.lng).toBe(43.9464);
    expect(geo?.label?.length).toBe(WALL_GEO_LABEL_MAX_LEN);
  });

  it("drops out-of-range coordinates (DB check constraint parity)", () => {
    expect(sanitizeWallGeo({ lat: 91, lng: 0 })).toBeNull();
    expect(sanitizeWallGeo({ lat: -90.5, lng: 0 })).toBeNull();
    expect(sanitizeWallGeo({ lat: 0, lng: 181 })).toBeNull();
    expect(sanitizeWallGeo({ lat: 0, lng: -180.1 })).toBeNull();
  });

  it("requires BOTH lat and lng (mirrors the geo_pair constraint)", () => {
    expect(sanitizeWallGeo({ lat: 56.29 })).toBeNull();
    expect(sanitizeWallGeo({ lng: 43.94 })).toBeNull();
    expect(sanitizeWallGeo({})).toBeNull();
    expect(sanitizeWallGeo(null)).toBeNull();
    expect(sanitizeWallGeo("point")).toBeNull();
    expect(sanitizeWallGeo([56, 44])).toBeNull();
  });

  it("coerces numeric strings but rejects garbage / NaN / Infinity", () => {
    expect(sanitizeWallGeo({ lat: "56.29", lng: "43.94" })).toEqual({ lat: 56.29, lng: 43.94, label: null });
    expect(sanitizeWallGeo({ lat: Number.NaN, lng: 0 })).toBeNull();
    expect(sanitizeWallGeo({ lat: Number.POSITIVE_INFINITY, lng: 0 })).toBeNull();
    expect(sanitizeWallGeo({ lat: "abc", lng: 0 })).toBeNull();
  });

  it("empty/whitespace label → null label (post still geotags)", () => {
    expect(sanitizeWallGeo({ lat: 1, lng: 2, label: "   " })).toEqual({ lat: 1, lng: 2, label: null });
  });
});

// ── label helpers ────────────────────────────────────────────────────────────

describe("formatGeoCoords", () => {
  it("formats a deterministic short label", () => {
    expect(formatGeoCoords(56.296444, 43.946389)).toBe("56.2964, 43.9464");
  });

  it("strips trailing zeros without leaving dangling dots", () => {
    expect(formatGeoCoords(56, 43)).toBe("56, 43");
    expect(formatGeoCoords(56.5, 43.25)).toBe("56.5, 43.25");
  });
});

describe("findNearestMotoSpot", () => {
  it("snaps to the HQ-area spot within 250 m", () => {
    // nn-motomesto: [56.2958, 43.9478] — пл. Комсомольская
    const spot = findNearestMotoSpot(56.296, 43.948);
    expect(spot?.id).toBe("nn-motomesto");
  });

  it("returns null beyond maxMeters or for NaN input", () => {
    expect(findNearestMotoSpot(55.0, 44.0)).toBeNull();
    expect(findNearestMotoSpot(Number.NaN, 43.9)).toBeNull();
    // hard cap: nothing within 1 meter of a fake point in the middle of the volga
    expect(findNearestMotoSpot(56.0, 44.0, 1)).toBeNull();
  });

  it("haversineMeters: HQ → nn-motomesto is ~100 m (sanity)", () => {
    const dist = haversineMeters([56.296444, 43.946389], NN_MOTO_SPOTS[0].coords);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(400);
  });
});

// ── migration + server action flow ───────────────────────────────────────────

describe("geotag persistence flow (source asserts)", () => {
  const MIGRATION = "supabase/migrations/20260922000000_crew_post_geotags.sql";

  it("migration adds nullable lat/lng/label with range + pair constraints and a partial feed index", () => {
    const sql = read(MIGRATION);
    expect(sql).toContain("add column if not exists geo_lat double precision");
    expect(sql).toContain("add column if not exists geo_lng double precision");
    expect(sql).toContain("add column if not exists geo_label text");
    expect(sql).toContain("crew_posts_geo_lat_range");
    expect(sql).toContain("crew_posts_geo_lng_range");
    expect(sql).toContain("crew_posts_geo_pair");
    expect(sql).toContain("crew_posts_geo_feed_idx");
    expect(sql).toContain("where geo_lat is not null and is_hidden = false");
  });

  it("createCommunityPostAction accepts geo input and writes sanitized columns", () => {
    const actions = read("app/franchize/server-actions/community-wall.ts");
    expect(actions).toContain("label: z.string().trim().min(1).max(WALL_GEO_LABEL_MAX_LEN).optional()");
    expect(actions).toContain("const composerGeo = sanitizeWallGeo(parsed.data.geo)");
    expect(actions).toContain("geo_lat: composerGeo.lat");
    // Untagged posts keep explicit NULLs.
    expect(actions).toContain("geo_lat: null, geo_lng: null, geo_label: null");
  });

  it("feed maps geo through the sanitizer; pins action is public, bounded and money-free", () => {
    const actions = read("app/franchize/server-actions/community-wall.ts");
    expect(actions).toContain("export async function getWallGeotagsAction");
    expect(actions).toContain("geo: sanitizeWallGeo({ lat: p.geo_lat, lng: p.geo_lng, label: p.geo_label })");
    expect(actions).toContain(".limit(WALL_GEO_PINS_LIMIT)");
    expect(actions).toContain('buildWallPostPreview(row.body, WALL_GEO_EXCERPT_LEN)');
    // money-free select (family rule): no ₽ columns on the pin path
    const geoFn = actions.slice(actions.indexOf("getWallGeotagsAction"), actions.indexOf("export async function createCommunityPostAction"));
    expect(geoFn).not.toContain("total_cost");
    expect(geoFn).not.toContain("price");
    // bounds cap exported from lib
    expect(WALL_GEO_PINS_LIMIT).toBe(200);
    expect(WALL_GEO_EXCERPT_LEN).toBe(140);
  });

  it("lib exports WallPostGeo/WallGeoPinView and the post view carries optional geo", () => {
    const lib = read("app/franchize/lib/community-wall.ts");
    expect(lib).toContain("export interface WallPostGeo");
    expect(lib).toContain("export interface WallGeoPinView");
    expect(lib).toMatch(/geo: WallPostGeo \| null;/);
  });
});

// ── composer + PostCard geotag UI ────────────────────────────────────────────

describe("wall composer & post card geotag (source asserts)", () => {
  const wall = read("app/franchize/[slug]/community/CommunityWallClient.tsx");

  it("composer has a Точка button, a picker (map point / geolocation) and a chip", () => {
    expect(wall).toContain('aria-label="Прикрепить точку на карте"');
    expect(wall).toContain("attachMapPointGeotag");
    expect(wall).toContain("attachMyLocationGeotag");
    expect(wall).toContain("пост появится меткой на карте");
    // geolocation errors surface in the composer, never alert()
    expect(wall).toContain("Геолокация недоступна в этом браузере.");
  });

  it("submit sends geo and clears it on success (and fires posts-changed)", () => {
    expect(wall).toContain("geo: geoTag ? { lat: geoTag.lat, lng: geoTag.lng, label: geoTag.label ?? undefined } : undefined");
    expect(wall).toContain("window.dispatchEvent(new CustomEvent(WALL_POSTS_CHANGED_EVENT))");
  });

  it("post card renders a geo chip: button on the map (handler), link on the wall page", () => {
    expect(wall).toContain("onFocusGeotag?: (geo: WallPostGeo, postId: string) => void");
    expect(wall).toContain("href={`/franchize/${slug}/map-riders?post=${post.id}`}");
    expect(wall).toContain('title="Показать на карте экипажа"');
  });

  it("wall listens for the map's focus-post event through the deeplink machinery", () => {
    expect(wall).toContain("window.addEventListener(WALL_FOCUS_POST_EVENT, handler)");
    expect(wall).toContain("pendingDeepLinkPostId = eventFocus?.id ?? highlightPostId ?? null");
    expect(wall).toContain("pendingDeepLinkPostId, eventFocus?.n");
  });
});

// ── sheet merge: карта + стена = один экран ─────────────────────────────────

describe("map-riders sheet hosts the community wall (source asserts)", () => {
  const client = read("components/map-riders/MapRidersClientRefactored.tsx");
  const page = read("app/franchize/[slug]/map-riders/page.tsx");

  it("sheet renders the real CommunityWallClient with map-selected point + focus handler", () => {
    expect(client).toContain("<CommunityWallClient");
    expect(client).toContain("mapSelectedPoint={state.selectedMeetupPoint}");
    expect(client).toContain("onFocusGeotag={handleWallFocusGeotag}");
    expect(client).toContain("composeRideId={sheetRideComposeId ?? wallParams?.composeRideId ?? null}");
  });

  it("obsolete sheet content is gone (quiz / hero stats / пульт / leaderboard in sheet)", () => {
    expect(client).not.toContain("BeginnerRiderOnboardingQuiz");
    expect(client).not.toContain("Пульт райдера");
    expect(client).not.toContain("heroStats");
    expect(client).not.toContain("LeaderboardSection");
    expect(client).not.toContain("mapriders-scroll-to-leaderboard");
    // the old hardcoded bot share link left with the пульт
    expect(client).not.toContain("oneBikePlsBot");
  });

  it("map gains the geotag pin layer with wallpost- ids and fly-to focus", () => {
    expect(client).toContain("wallpost-${pin.postId}");
    expect(client).toContain("getWallGeotagsAction({ slug: crewSlug })");
    expect(client).toContain("WALL_POSTS_CHANGED_EVENT");
    expect(client).toContain("focusPoint={wallFocusPoint}");
    expect(client).toContain("openWallPostFromMap");
    expect(client).toContain('icon: "::FaCameraRetro::"');
  });

  it("page validates wall deep-link params like the /community page does", () => {
    expect(page).toContain("uuidRe.test(rawPost)");
    expect(page).toMatch(/\[a-z0-9-\]\{1,64\}\$\/i\.test\(rawSpot\)/);
    expect(page).toContain("wallParams={wallParams}");
  });

  it("RidersDrawer owns the relocated ride controls + leaderboard (ride tab)", () => {
    const drawer = read("components/map-riders/RidersDrawer.tsx");
    expect(drawer).toContain('value="ride"');
    expect(drawer).toContain("RideControlsPanel");
    expect(drawer).toContain("LeaderboardPanel");
    expect(drawer).toContain("privacy/toggle-home-blur");
    expect(drawer).toContain("privacy/set-visibility");
    // bottom nav: Стена expands the sheet, Топ opens the ride tab
    const nav = read("components/layout/FranchizeMapBottomNav.tsx");
    expect(nav).toContain('detail: { tab: "ride" }');
    expect(nav).toContain("mapriders-expand-sheet");
    // (off-map fallback Link for Стена is asserted in the review-fixes test)
  });

  it("RacingMap exposes a focusPoint prop driven by leaflet's useMap().flyTo", () => {
    const map = read("components/maps/RacingMap.tsx");
    expect(map).toContain("export interface RacingMapFocusPoint");
    expect(map).toContain("focusPoint?: RacingMapFocusPoint | null");
    expect(map).toMatch(/map\.flyTo\(\[focus\.lat, focus\.lng\], Math\.max\(map\.getZoom\(\), 14\)/);
  });

  it("review round-1 fixes: geo-only post, event-focus precedence, ride-stop interlink, nav fallback", () => {
    const actions = read("app/franchize/server-actions/community-wall.ts");
    // (1) a lone geotag IS a valid post — server accepts what the composer enables
    expect(actions).toContain("&& !composerGeo");
    // (2) event focus wins over the stale ?post= URL target
    const wall = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(wall).toContain("pendingDeepLinkPostId = eventFocus?.id ?? highlightPostId ?? null");
    // (3) stop from the drawer's Эфир tab keeps the share-ride interlink
    const drawer = read("components/map-riders/RidersDrawer.tsx");
    expect(drawer).toContain("onRideStopped?: (endedSessionId: string) => void");
    expect(drawer).toContain("onRideStopped,");
    // (5) in-page share intent beats a stale ?ride= URL param
    expect(read("components/map-riders/MapRidersClientRefactored.tsx")).toContain(
      "composeRideId={sheetRideComposeId ?? wallParams?.composeRideId ?? null}",
    );
    // (9) off-map routes keep a working Стена link in the bottom nav
    const nav = read("components/layout/FranchizeMapBottomNav.tsx");
    expect(nav).toContain('!canControl && item.key === "crew"');
    // (12) reaction picker click-away is portaled (sheet containing-block trap)
    expect(wall).toMatch(/WallOverlayPortal>[\s\S]{0,160}fixed inset-0 z-30/);
  });
});
