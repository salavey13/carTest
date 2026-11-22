// tests/franchize/moto-spots-coords.spec.ts
//
// POI coordinates regression (2026-09-22 fix).
//
// The first version of the NN moto-spots catalog placed real companies by
// "approximate address binding" — OSM (Nominatim house-level geocoding)
// showed 7 of 11 points were 1.7–13 km off (Мотогор sat on Автозавод instead
// of Сормово, КроссМото on a wasteland near Дубки instead of Высоково,
// Мототехника-52 in Анкудиновка instead of Афонино, пл. Минина near
// Белинского instead of the Kremlin, the embankment point in the Oka river…).
//
// These tests pin the OSM-verified coordinates so a future "re-seed" can't
// silently bring the wrong places back, and keep lib/map-riders-spots.ts in
// sync with the SQL migration (hq_location = metadata map.gps source).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NN_MOTO_SPOTS } from "@/lib/map-riders-spots";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const MIGRATION = "supabase/migrations/20260921000000_seed_nn_moto_spot_crews.sql";

/** OSM-verified [lat, lon] per spot id (Nominatim, 2026-09-22). */
const OSM_VERIFIED: Record<string, [number, number] | undefined> = {
  "nn-rolling-moto": [56.31541, 43.90416], // house POI «Вездеходов», Московское шоссе 137А
  "nn-mototeh-nn": [56.29777, 43.99905], // building 15к1, Артельная (Советский р-н)
  "nn-motogor": [56.34642, 43.88566], // building 35А, Коминтерна (Сормово!)
  "nn-motoservice-nn": [56.29408, 43.94968], // building 11А, Мотальный пер. (Ленинский)
  "nn-krossmoto": [56.38103, 43.76542], // building 40 к20, Мунина (Высоково)
  "nn-mototehnika52": [56.25533, 44.09768], // house 136, Магистральная (Афонино)
  "nn-minin-square": [56.3273, 44.0069], // площадь у Кремля
  "nn-nizhnevolzhskaya": [56.33159, 44.00946], // набережная у Чкаловской лестницы
};

describe("NN moto-spots: OSM-verified coordinates", () => {
  it("pins every geocoded spot to its real place", () => {
    for (const spot of NN_MOTO_SPOTS) {
      const expected = OSM_VERIFIED[spot.id];
      if (!expected) continue;
      const [lat, lon] = spot.coords;
      // 0.0005° ≈ 55 м — house-level match, not a district guess.
      expect(Math.abs(lat - expected[0])).toBeLessThan(0.0005);
      expect(Math.abs(lon - expected[1])).toBeLessThan(0.0005);
    }
  });

  it("keeps the two corrections that fix WRONG DISTRICTS, not just meters", () => {
    // Мотогор: Коминтерна is in Сормово — the old label said «Автозавод».
    const motogor = NN_MOTO_SPOTS.find((s) => s.id === "nn-motogor");
    expect(motogor?.address).toContain("(Сормово)");
    expect(motogor?.address).not.toContain("Автозавод");
    // КроссМото: Мунина 40к20 is Высоково.
    const krossmoto = NN_MOTO_SPOTS.find((s) => s.id === "nn-krossmoto");
    expect(krossmoto?.address).toContain("(Высоково)");
  });

  it("keeps the historically-correct spots untouched", () => {
    // Байк Ленд — exact GPS from the shop card (unchanged, OSM 10 m match).
    const bikeland = NN_MOTO_SPOTS.find((s) => s.id === "nn-bikeland");
    expect(bikeland?.coords).toEqual([56.32124, 44.00945]);
  });
});

describe("spots ↔ migration coordinates stay in sync", () => {
  const parseMigrationRows = (): Map<string, { address: string; lat: number; lon: number }> => {
    const sql = read(MIGRATION);
    const rows = new Map<string, { address: string; lat: number; lon: number }>();
    const re =
      /^\s*\('([a-z0-9-]+)',\s*'[a-z0-9-]+',\s*'(?:[^']*)',\s*'[a-z]+',\s*'([^']*)',\s*'(\d+\.\d+),\s*(\d+\.\d+)'/gm;
    for (const m of sql.matchAll(re)) {
      rows.set(m[1], { address: m[2], lat: Number(m[3]), lon: Number(m[4]) });
    }
    return rows;
  };

  it("seeds the SAME coords the map layer renders (no drift)", () => {
    const rows = parseMigrationRows();
    expect(rows.size).toBe(NN_MOTO_SPOTS.length);
    for (const spot of NN_MOTO_SPOTS) {
      const row = rows.get(spot.slug);
      expect(row, `migration row for ${spot.slug}`).toBeDefined();
      if (!row) continue;
      // The migration seeds crews' hq_location / metadata map.gps from the
      // same source of truth — they must not diverge again.
      expect(Math.abs(row.lat - spot.coords[0])).toBeLessThan(0.00001);
      expect(Math.abs(row.lon - spot.coords[1])).toBeLessThan(0.00001);
    }
  });

  it("seeds the SAME addresses the popups render", () => {
    const rows = parseMigrationRows();
    for (const spot of NN_MOTO_SPOTS) {
      const row = rows.get(spot.slug);
      expect(row?.address, `address for ${spot.slug}`).toBe(spot.address);
    }
  });
});
