// tests/franchize/map-routes-dirt.spec.ts
//
// Dirt-routes edition (2026-09-23) — source-контракт:
//  · клиент больше не инжектит захардкоженные DEFAULT_ROUTES — маршруты живут
//    только в БД (миграция 20260923000000);
//  · миграция сносит старые треки (type != 'point') и сеет грунтовые «между
//    мостами» с note/geojson;
//  · RacingMap рисует стартовые бейджи маршрутов с попапом (название/км/note);
//  · useLiveRiders: watchdog + деградация точности + race-guard;
//  · RacingMap поддерживает keyed-провайдера через NEXT_PUBLIC_MAP_TILE_URL.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CLIENT = "components/map-riders/MapRidersClientRefactored.tsx";
const MAP = "components/maps/RacingMap.tsx";
const HOOK = "hooks/useLiveRiders.ts";
const MIGRATION = "supabase/migrations/20260923000000_dirt_routes_between_bridges.sql";

describe("map-riders client: no more hardcoded routes", () => {
  const src = readFileSync(CLIENT, "utf8");

  it("DEFAULT_ROUTES constant is gone", () => {
    expect(src).not.toContain("const DEFAULT_ROUTES");
    expect(src).not.toContain("...DEFAULT_ROUTES");
  });

  it("merge keeps hqPoint and DB points, docs the migration source", () => {
    expect(src).toContain("return [hqPoint, ...staticMapPoints");
    expect(src).toContain("20260923000000_dirt_routes_between_bridges.sql");
  });

  it("stale demo filter stays (DB demo riders may exist until migration runs)", () => {
    expect(src).toContain('"vip-demo-rider-a"');
    expect(src).toContain('"vip-base-point"'); // MR-018: HQ is never filtered
  });
});

describe("migration: ditch old routes, seed dirt ones", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("removal is SELECTIVE: point POIs and admin routes survive, seed junk dies", () => {
    // point POIs + admin-authored routes (route-*) are preserved on re-run
    expect(sql).toContain("coalesce(poi->>'type', 'point') = 'point'");
    expect(sql).toContain("like 'route-%'");
    // old seed routes are dropped by exact id (not by a blanket non-point wipe)
    expect(sql).toContain("'vip-fedorovsky-sormovo-loop'");
    expect(sql).toContain("'route-dd05b5ca-2013-43ad-a80f-534fc7147015'");
    expect(sql).toContain("'route-138f5c07-3743-44d5-ad60-2aeca537f5ba'");
    // demo riders are dropped too
    expect(sql).toContain("not like 'vip-demo-rider-%'");
  });

  it("seeds the three dirt routes between the real Oka bridges", () => {
    expect(sql).toContain("dirt-kanavino-beach");
    expect(sql).toContain("dirt-meshcherskaya-pojma");
    expect(sql).toContain("dirt-priokskie-peski");
    // maps has NO updated_at column (review finding: UPDATE crashed the whole
    // migration) — the update must touch points_of_interest only
    const executable = sql.slice(sql.indexOf("begin;"));
    expect(executable).toContain("set points_of_interest = mg.next_pois");
    expect(executable).not.toContain("updated_at = now()");
  });

  it("routes carry geojson LineStrings + surface notes + dashed dirt styling", () => {
    expect(sql).toContain('"LineString"');
    expect(sql).toContain('"note"');
    expect(sql).toContain('"dashArray":"8, 6"');
  });

  it("is idempotent-friendly (rewrite-not-append update)", () => {
    expect(sql).toContain("set points_of_interest = mg.next_pois");
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
  });
});

describe("RacingMap: route-start badges", () => {
  const src = readFileSync(MAP, "utf8");

  it("badges skip point POIs, the live session route, and note-less routes", () => {
    expect(src).toContain('poi.type !== "point" && !poi.id.startsWith("route-") && Boolean(poi.note)');
  });

  it("badge popup shows name, type label, length and the DB note", () => {
    expect(src).toContain('poi.type === "loop" ? "Петля" : "Трек"');
    expect(src).toContain("{poi.note ? <div");
    expect(src).toContain("faName: \"FaFlag\"");
    expect(src).toContain('markerSize: "sm"');
  });

  it("badge icons are cached per color (no setIcon churn on rider ticks)", () => {
    expect(src).toContain("routeBadgeIconCache");
    expect(src).toContain("routeBadgeIcon(poi.color)");
    // positive assertion: the badge path builds via the cache keyed by the
    // whitelisted color (review iter 2 N1: the old negative check on a
    // single-line buildPoiMarkerIcon({ color: poi.color… ) was format-fragile)
    expect(src).toContain("buildPoiMarkerIcon({ color: key");
  });

  it("length helper walks the geojson LineString with lon/lat swap", () => {
    expect(src).toContain("function routeLengthKm");
    expect(src).toContain("return [c[1], c[0]]; // geojson lon,lat → leaflet lat,lng");
  });
});

describe("useLiveRiders: robustness pass", () => {
  const src = readFileSync(HOOK, "utf8");

  it("watchdog: 45s staleness → one silent W3C kick (never Telegram)", () => {
    expect(src).toContain("const WATCHDOG_TICK_MS = 15000");
    expect(src).toContain("const WATCHDOG_STALE_MS = 45000");
    expect(src).toContain("watchdogTimerRef");
    // cold start is not staleness + kicks are cooldown-throttled (review iter 1)
    expect(src).toContain("startedAtRef");
    expect(src).toContain("const since = Math.max(last?.time ?? 0, startedAtRef.current)");
    expect(src).toContain("const WATCHDOG_KICK_COOLDOWN_MS = 30000");
    expect(src).toContain("lastWatchdogKickAtRef.current = Date.now()");
    // scope strictly to the watchdog effect: it uses ONLY the W3C one-shot —
    // no Telegram requestLocation anywhere inside
    const from = src.indexOf("Robustness watchdog");
    const to = src.indexOf("MR geo-fix: visibility");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const chunk = src.slice(from, to);
    expect(chunk).toContain("getCurrentPosition");
    expect(chunk).not.toContain("requestLocation");
  });

  it("one-time accuracy degradation after a dead high-accuracy streak", () => {
    expect(src).toContain("degradedRef");
    expect(src).toContain("installWatch(false)");
    expect(src).toContain("watchErrorStreakRef.current >= 4");
  });

  it("rapid-toggle race guard: stale start() can no longer install a watch", () => {
    expect(src).toContain("startTokenRef");
    expect(src).toContain("token !== startTokenRef.current");
    expect(src).toContain("startTokenRef.current += 1; // invalidate any in-flight start()");
  });

  it("denied watches are not kicked by the watchdog (settings-only recovery)", () => {
    expect(src).toContain('geoErrorKindRef.current === "denied"');
  });
});

describe("RacingMap: keyed tile-provider override", () => {
  const src = readFileSync(MAP, "utf8");

  it("env override wins over presets; empty env keeps CARTO", () => {
    expect(src).toContain("process.env.NEXT_PUBLIC_MAP_TILE_URL");
    expect(src).toContain("const source = CUSTOM_TILE_URL || TILE_LAYERS[tileLayer]");
  });

  it("custom provider gets a configurable attribution (license-safe default)", () => {
    expect(src).toContain("process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION");
    expect(src).toContain("attribution={attribution}");
  });
});
