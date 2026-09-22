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
  fa6GlyphSvg,
  isSafeMarkerImageUrl,
  parsePoiIcon,
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
    expect(html).toContain('src="https://cdn.test/logo.png"');
    expect(html).toContain("mr-poi--halo"); // carried from mr-spot-popup
    expect((icon as unknown as { options: { iconSize: number[] } }).options.iconSize).toEqual([34, 34]);
  });

  it("escapes hostile attribute characters and rejects unsafe schemes", () => {
    // scheme guard → falls back to the FA badge path; without faName → null
    expect(buildPoiMarkerIcon({ color: "#111111", imageUrl: "javascript:alert(1)" })).toBeNull();

    // a https URL with a quote must be escaped, never break out of src=""
    const sneaky = buildPoiMarkerIcon({
      color: "#111111",
      imageUrl: 'https://x.test/a.png" onerror="alert(1)',
      faName: "FaStore",
    });
    expect(sneaky).toBeTruthy();
    const html = (sneaky as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("&quot;");
    expect(html).not.toContain('" onerror="');
  });

  it("builds a glyph badge for known FA names and null for unknown ones", () => {
    const badge = buildPoiMarkerIcon({ color: "#f97316", faName: "FaMotorcycle" });
    expect(badge).toBeTruthy();
    const html = (badge as unknown as { options: { html: string } }).options.html;
    expect(html).toContain("<svg");

    expect(buildPoiMarkerIcon({ color: "#f97316", faName: "NoSuchIcon" })).toBeNull();
    expect(buildPoiMarkerIcon({ color: "#f97316" })).toBeNull();
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
