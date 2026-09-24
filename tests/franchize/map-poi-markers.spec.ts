// tests/franchize/map-poi-markers.spec.ts
//
// Map-riders feedback (2026-09-22):
//   1. «when i attempt to start geosharing i get infinite requests to allow
//      share geotag in telegram» → WebApp.requestLocation must be ONE-SHOT:
//      no interval polling, no visibility re-requests; continuous stream is
//      the W3C watch; manual refresh exposed for Telegram-only WebViews.
//   2. «instead of simple dots show real icons with round pictures if
//      available» → RacingMap renders image/FA-badge divIcon markers for
//      point POIs; icon grammar parsing + URL-safety guarded.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPoiMarkerIcon,
  cssSafeUrlForMarker,
  fa6GlyphSvg,
  isSafeMarkerImageUrl,
  parsePoiIcon,
  safeCssColor,
} from "@/lib/map-poi-marker";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── icon grammar ─────────────────────────────────────────────────────────────

describe("parsePoiIcon grammar", () => {
  it("parses image: URLs (case-insensitive prefix)", () => {
    expect(parsePoiIcon("image:https://cdn.example.com/logo.png")).toEqual({
      kind: "image",
      url: "https://cdn.example.com/logo.png",
    });
    expect(parsePoiIcon("IMAGE:https://x.test/a.png")).toEqual({
      kind: "image",
      url: "https://x.test/a.png",
    });
  });

  it("parses ::FaXxx:: glyph names", () => {
    expect(parsePoiIcon("::FaLocationDot::")).toEqual({ kind: "fa", name: "FaLocationDot" });
    expect(parsePoiIcon(":: FaMotorcycle ::")).toEqual({ kind: "fa", name: "FaMotorcycle" });
  });

  it("parses initials: badges and caps them at 3 chars", () => {
    expect(parsePoiIcon("initials:АК")).toEqual({ kind: "initials", text: "АК" });
    expect(parsePoiIcon("INITIALS: Super")).toEqual({ kind: "initials", text: "Sup" });
    expect(parsePoiIcon("initials:")).toEqual({ kind: "none" });
  });

  it("returns none for empty/malformed values", () => {
    expect(parsePoiIcon(null)).toEqual({ kind: "none" });
    expect(parsePoiIcon("")).toEqual({ kind: "none" });
    expect(parsePoiIcon("image:")).toEqual({ kind: "none" });
    expect(parsePoiIcon("::Fa With Space::")).toEqual({ kind: "none" });
    expect(parsePoiIcon("javascript:alert(1)")).toEqual({ kind: "none" });
  });
});

// ── URL safety (marker HTML never gets hostile sources) ─────────────────────

describe("isSafeMarkerImageUrl", () => {
  it("allows http(s) and data:image", () => {
    expect(isSafeMarkerImageUrl("https://cdn.test/a.png")).toBe(true);
    expect(isSafeMarkerImageUrl("http://cdn.test/a.png")).toBe(true);
    expect(isSafeMarkerImageUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isSafeMarkerImageUrl("data:image/webp;base64,AAAA")).toBe(true);
  });

  it("rejects javascript:, vbscript:, relative junk and oversize", () => {
    expect(isSafeMarkerImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkerImageUrl("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeMarkerImageUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isSafeMarkerImageUrl("/relative/path.png")).toBe(false);
    expect(isSafeMarkerImageUrl("")).toBe(false);
    expect(isSafeMarkerImageUrl("https://a.test/" + "x".repeat(3000))).toBe(false);
  });
});

// ── FA glyph rendering (react-icons/fa6 → static svg string) ────────────────

describe("fa6GlyphSvg", () => {
  it("renders known FA6 names to svg markup (cached)", () => {
    const first = fa6GlyphSvg("FaLocationDot");
    expect(first).toBeTruthy();
    expect(first).toContain("<svg");
    expect(fa6GlyphSvg("FaLocationDot")).toBe(first);
  });

  it("returns null for unknown/hostile names (lookup key, never markup)", () => {
    expect(fa6GlyphSvg("NotARealIcon")).toBeNull();
    expect(fa6GlyphSvg("javascript:alert(1)")).toBeNull();
    expect(fa6GlyphSvg("<script>x</script>")).toBeNull();
  });
});

// ── divIcon builder ──────────────────────────────────────────────────────────

describe("buildPoiMarkerIcon", () => {
  it("builds a round-picture divIcon from a safe image URL", () => {
    const icon = buildPoiMarkerIcon({
      color: "#3b82f6",
      imageUrl: "https://cdn.test/logo.png",
      markerClassName: "mr-spot-popup",
    });
    expect(icon).toBeTruthy();
    const html = (icon as unknown as { options: { html: string } }).options.html;
    // MR polish: the photo is a CSS background layer now — a broken URL just
    // paints nothing (glyph fallback underneath), no <img> broken-icon ever.
    expect(html).toContain("background-image:url('https://cdn.test/logo.png')");
    expect(html).toContain("mr-poi--halo"); // carried from mr-spot-popup
    expect((icon as unknown as { options: { iconSize: number[] } }).options.iconSize).toEqual([34, 34]);
  });

  it("layers the FA glyph UNDER the picture as the broken-image fallback", () => {
    const icon = buildPoiMarkerIcon({
      color: "#f97316",
      imageUrl: "https://cdn.test/logo.png",
      faName: "FaLocationDot",
    });
    const html = (icon as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("mr-poi__glyph");
    expect(html).toContain("<svg");
    expect(html).toContain("mr-poi__img");
    // glyph first (bottom layer), photo second (top layer)
    expect(html.indexOf("mr-poi__glyph")).toBeLessThan(html.indexOf("mr-poi__img"));
  });

  it("escapes hostile attribute characters and rejects unsafe schemes", () => {
    // scheme guard → falls back to the FA badge path; without faName → null
    expect(buildPoiMarkerIcon({ color: "#111111", imageUrl: "javascript:alert(1)" })).toBeNull();

    // A quote/paren smuggled into the URL must not break out of the CSS
    // url('…') string (HTML entities alone are decoded BEFORE CSS parsing —
    // cssSafeUrlForMarker percent-encodes the breakout chars instead).
    const sneaky = buildPoiMarkerIcon({
      color: "#111111",
      imageUrl: 'https://x.test/a.png\') ; background-image:url("https://evil.test',
      faName: "FaStore",
    });
    expect(sneaky).toBeTruthy();
    const html = (sneaky as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("%27"); // ' → %27 — CSS string cannot terminate
    expect(html).toContain("%22"); // " → %22
    expect(html).toContain("%3B"); // ; → %3B — no property injection
    expect(html).not.toContain("url('https://x.test/a.png')"); // raw breakout gone
  });

  it("builds a glyph badge for known FA names and null for unknown ones", () => {
    const badge = buildPoiMarkerIcon({ color: "#f97316", faName: "FaMotorcycle" });
    expect(badge).toBeTruthy();
    const html = (badge as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("<svg");

    expect(buildPoiMarkerIcon({ color: "#f97316", faName: "NoSuchIcon" })).toBeNull();
    expect(buildPoiMarkerIcon({ color: "#f97316" })).toBeNull();
  });

  it("builds a local initials badge with auto-contrast text (polish 2026-09-23)", () => {
    const onDark = buildPoiMarkerIcon({ color: "#111827", initials: "АК" });
    expect(onDark).toBeTruthy();
    let html = (onDark as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("mr-poi__initials");
    expect(html).toContain(">АК</span>");
    expect(html).toContain("color:#ffffff"); // dark disc → white text

    // yellow self-rider disc → dark text (white on #facc15 was unreadable)
    const onYellow = buildPoiMarkerIcon({ color: "#facc15", initials: "СБ" });
    html = (onYellow as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("color:#0f172a");

    // hostile initials are escaped (capped at 3 chars BEFORE escaping),
    // never interpolated as markup
    const hostile = buildPoiMarkerIcon({ color: "#111827", initials: "<b>" });
    html = (hostile as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("supports the lg anchor size (HQ) and the explicit halo", () => {
    const lg = buildPoiMarkerIcon({ color: "#f97316", faName: "FaLocationDot", markerSize: "lg", halo: true });
    const options = (lg as unknown as { options: { html: string; iconSize: number[]; iconAnchor: number[]; popupAnchor: number[] } }).options;
    expect(options.iconSize).toEqual([40, 40]);
    expect(options.iconAnchor).toEqual([20, 20]);
    expect(options.popupAnchor).toEqual([0, -22]);
    expect(options.html).toContain("mr-poi--lg");
    expect(options.html).toContain("mr-poi--halo");

    const md = buildPoiMarkerIcon({ color: "#f97316", faName: "FaLocationDot" });
    const mdOptions = (md as unknown as { options: { iconSize: number[] } }).options;
    expect(mdOptions.iconSize).toEqual([34, 34]);
    expect(mdOptions.html).not.toContain("mr-poi--lg");
  });

  it("supports the sm route-start badge size (dirt routes 2026-09-23)", () => {
    const sm = buildPoiMarkerIcon({ color: "#eab308", faName: "FaFlag", markerSize: "sm" });
    const options = (sm as unknown as { options: { html: string; iconSize: number[]; iconAnchor: number[]; popupAnchor: number[] } }).options;
    expect(options.iconSize).toEqual([26, 26]);
    expect(options.iconAnchor).toEqual([13, 13]);
    expect(options.popupAnchor).toEqual([0, -15]);
    expect(options.html).toContain("mr-poi--sm");
    expect(options.html).not.toContain("mr-poi--lg");
  });

  it("whitelists the disc color — a hostile 'red;…' cannot inject CSS declarations", () => {
    expect(safeCssColor("red;background:url(https://evil.test)")).toBe("#f97316");
    expect(safeCssColor("#facc15")).toBe("#facc15");
    expect(safeCssColor("rgb(96 165 250)")).toBe("rgb(96 165 250)");
    expect(safeCssColor("rgba(96, 165, 250, 0.5)")).toBe("rgba(96, 165, 250, 0.5)");
    expect(safeCssColor("")).toBe("#f97316");
    expect(safeCssColor(null)).toBe("#f97316");

    const injected = buildPoiMarkerIcon({ color: "red;background:url(https://evil.test)", faName: "FaStore" });
    const html = (injected as unknown as { options: { html: string } }).options.html;
    expect(html).toContain('style="background-color:#f97316"');
    expect(html).not.toContain("evil.test");
  });

  it("cssSafeUrlForMarker keeps the data:image structure but kills quote breakouts", () => {
    // the ;base64, token and mime params must survive (data URL integrity)
    expect(cssSafeUrlForMarker("data:image/png;base64,QUJD")).toBe("data:image/png;base64,QUJD");
    const hostile = cssSafeUrlForMarker("data:image/png;base64,QU'JD\"BK\\C");
    expect(hostile).toContain("%27");
    expect(hostile).toContain("%22");
    expect(hostile).toContain("%5C");
    expect(hostile).toContain(";base64,");

    // SF-1: a raw newline is a CSS BAD-STRING terminator — after it the parser
    // resumes declarations at the next ';'. It must be encoded too.
    const nl = cssSafeUrlForMarker("data:image/png;x\n;background:url(https://evil.test)");
    expect(nl).toContain("%0A");
    expect(nl).not.toContain("\n");
  });
});

// ── geo fix: requestLocation is ONE-SHOT (no popup storm) ────────────────────

describe("useLiveRiders one-shot Telegram location (source asserts)", () => {
  const src = read("hooks/useLiveRiders.ts");

  it("no interval timer around requestLocation anymore", () => {
    expect(src).not.toContain("telegramTimerRef");
    expect(src).not.toMatch(/setInterval\([^)]*requestTelegramLocation/s);
  });

  it("exactly two call sites: the initial one-shot + the manual refresh", () => {
    const calls = src.match(/requestTelegramLocation\(\)/g) || [];
    expect(calls.length).toBe(2);
    expect(src).toContain("await requestTelegramLocation()");
    expect(src).toContain("void requestTelegramLocation()");
  });

  it("visibility refresh never re-invokes the native popup", () => {
    const effectStart = src.indexOf('document.addEventListener("visibilitychange"');
    expect(effectStart).toBeGreaterThan(-1);
    const effectBody = src.slice(src.lastIndexOf("useEffect", effectStart), effectStart);
    expect(effectBody).not.toContain("requestTelegramLocation");
  });

  it("browser watch is the continuous source + telegram-only manual refresh exists", () => {
    expect(src).toContain("navigator.geolocation.watchPosition(");
    expect(src).toContain("hasBrowserFix");
    expect(src).toContain("refreshTelegramFix");
  });
});

// ── marker wiring in RacingMap + map client (source asserts) ─────────────────

describe("POI marker wiring (source asserts)", () => {
  it("RacingMap renders divIcon markers with a CircleMarker fallback", () => {
    const map = read("components/maps/RacingMap.tsx");
    expect(map).toContain("buildPoiMarkerIcon(");
    expect(map).toContain("parsePoiIcon(");
    expect(map).toContain("<Marker");
    expect(map).toContain("<CircleMarker");
    // XSS guard must survive the refactor
    expect(map).toContain("React.isValidElement(poi.popup)");
  });

  it("map client wires round pictures for HQ, spots, wall pins and catalog", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("getSpotCrewLogosAction");
    expect(client).toContain("imageUrl: crew.logoUrl || null");
    expect(client).toContain("motoSpotKindIcon(spot.kind)");
    expect(client).toContain("imageUrl: spotLogos[spot.slug] || null");
    expect(client).toContain("imageUrl: pin.photoUrl ?? null");
    expect(client).toContain("imageUrl: item.imageUrl || null");
    expect(client).toContain("refreshTelegramFix");
  });

  it("spot-crew-logos action reads logo_url by catalog slugs only", () => {
    const action = read("app/franchize/server-actions/spot-crew-logos.ts");
    expect(action).toContain('.from("crews")');
    expect(action).toContain('"slug, logo_url"');
    expect(action).toContain("NN_MOTO_SPOTS.map((s) => s.slug)");
  });
});

// ── polish pass 2026-09-23: people wear pictures too + GPS error surfacing ──

describe("POI polish wiring (source asserts)", () => {
  it("live riders use real avatars with a local initials fallback (no placehold.co)", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    // the foreign placeholder CDN round-trip is gone from the map page
    expect(client).not.toContain("placehold.co");
    expect(client).toContain("session?.users?.avatar_url");
    expect(client).toContain("icon: `initials:${initialsFromName(name)}`");
    expect(client).toContain("markerClassName: isStale ? \"mr-poi--stale\" : undefined");
    // demo riders render locally too
    expect(client).toContain("icon: `initials:${String.fromCharCode(65 + index)}`");
  });

  it("meetup markers wear the meetup PHOTO first, creator's avatar as fallback (API joins avatar_url)", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    // 2026-09-25: photo wins («add respective photo to be used for icon on map»),
    // avatar stays the middle of the fallback chain → FaLocationDot badge.
    expect(client).toContain("imageUrl: m.photo_url?.trim() || m.users?.avatar_url?.trim() || null");
    const shared = read("app/api/map-riders/_lib/shared.ts");
    expect(shared).toContain("users:created_by_user_id(username, full_name, avatar_url)");
    const types = read("lib/map-riders.ts");
    expect(types).toContain("avatar_url?: string | null;");
    expect(types).toContain("photo_url?: string | null;");
  });

  it("HQ is the lg halo anchor", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain('markerSize: "lg" as const');
    expect(client).toContain("markerHalo: true");
  });

  it("GPS failures surface as a plain-language chip, not a console-only warn", () => {
    const hook = read("hooks/useLiveRiders.ts");
    expect(hook).toContain("LiveRidersGeoError");
    expect(hook).toContain("error.PERMISSION_DENIED");
    expect(hook).toContain("error.POSITION_UNAVAILABLE");
    expect(hook).toContain("setGeoError((prev) => (prev === kind ? prev : kind))");
    // transient errors need a 2-in-a-row streak before the chip shows —
    // a weak-signal timeout↔fix cycle must not flicker it (codereview S2)
    expect(hook).toContain("watchErrorStreakRef");
    expect(hook).toContain("watchErrorStreakRef.current >= 2");
    // a real fix clears the chip; a landed Telegram fix clears soft errors too
    expect(hook).toContain("setGeoError(null)");
    expect(hook).toContain('prev === "denied" ? prev : null');
    // codereview B1: the GPS pipeline must stay identity-stable — volatile
    // inputs (paused/onPosition/privacy) are read through refs, not deps
    expect(hook).toContain("onPositionRef");
    expect(hook).toContain("pausedRef");
    expect(hook).toContain("[broadcastPosition, hapticPulse]");
    // codereview N3: manual refresh falls back to a W3C one-shot outside Telegram
    expect(hook).toContain("getCurrentPosition(");

    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("geoError");
    expect(client).toContain("Доступ к геолокации запрещён");
    expect(client).toContain("GPS-сигнал недоступен");
    // manual refresh also covers the errored-but-no-telegram-fix case
    expect(client).toContain("(isUsingTelegram || geoError !== null)");
  });

  it("the builder hardens CSS url() against injection (cssSafeUrlForMarker)", () => {
    const lib = read("lib/map-poi-marker.ts");
    expect(lib).toContain("cssSafeUrlForMarker");
    expect(lib).toContain("background-image:url('${escAttr(cssSafeUrlForMarker(");
  });
});
