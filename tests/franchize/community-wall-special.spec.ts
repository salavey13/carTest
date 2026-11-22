// tests/franchize/community-wall-special.spec.ts
//
// Iteration 4 — special sauce: live bike availability (same contract as the
// checkout availability gate) and rider milestone badges.

import { describe, expect, it } from "vitest";
import {
  riderMilestoneBadge,
  wallBusyUntilMap,
  type WallBusyRentalRow,
} from "@/app/franchize/lib/community-wall";

const NOW = Date.parse("2026-09-20T12:00:00Z");
const HOUR = 60 * 60 * 1000;

const row = (over: Partial<WallBusyRentalRow>): WallBusyRentalRow => ({
  vehicle_id: "kawasaki-ex650k",
  status: "active",
  requested_start_date: "2026-09-20T10:00:00+03:00",
  requested_end_date: "2026-09-20T18:00:00+03:00",
  agreed_start_date: null,
  agreed_end_date: null,
  ...over,
});

describe("wallBusyUntilMap (checkout-gate parity)", () => {
  it("busy bike: maps to graced end, not raw end (+30 min grace)", () => {
    const map = wallBusyUntilMap([row({})], NOW);
    const end = Date.parse("2026-09-20T18:00:00+03:00");
    expect(map.get("kawasaki-ex650k")).toBe(end + 30 * 60 * 1000);
  });

  it("free bike: no blocking rows → absent from the map", () => {
    expect(wallBusyUntilMap([], NOW).size).toBe(0);
  });

  it("past rentals never block (stale active row)", () => {
    const map = wallBusyUntilMap(
      [row({ requested_end_date: "2026-09-19T18:00:00+03:00" })],
      NOW,
    );
    expect(map.size).toBe(0);
  });

  it("cancelled rentals never block, statuses mirror the gate list", () => {
    const map = wallBusyUntilMap(
      [row({ status: "cancelled" }), row({ status: "expired", vehicle_id: "b" })],
      NOW,
    );
    expect(map.size).toBe(0);
  });

  it("multiple rentals per bike keep the LATEST end", () => {
    const map = wallBusyUntilMap(
      [
        row({ requested_end_date: "2026-09-20T14:00:00+03:00" }),
        row({ requested_end_date: "2026-09-20T18:00:00+03:00" }),
      ],
      NOW,
    );
    const latest = Date.parse("2026-09-20T18:00:00+03:00") + 30 * 60 * 1000;
    expect(map.get("kawasaki-ex650k")).toBe(latest);
  });

  it("missing end falls back to start + 24h (gate parity)", () => {
    const map = wallBusyUntilMap([row({ requested_end_date: null, agreed_end_date: null })], NOW);
    const start = Date.parse("2026-09-20T10:00:00+03:00");
    expect(map.get("kawasaki-ex650k")).toBe(start + 24 * HOUR + 30 * 60 * 1000);
  });
});

describe("riderMilestoneBadge", () => {
  it("5/10/25/50 thresholds in order", () => {
    expect(riderMilestoneBadge(4)).toBeNull();
    expect(riderMilestoneBadge(5)?.label).toBe("Разогрев");
    expect(riderMilestoneBadge(10)?.label).toBe("Свой в доску");
    expect(riderMilestoneBadge(25)?.label).toBe("Ветеран дороги");
    expect(riderMilestoneBadge(50)?.label).toBe("Легенда экипажа");
    expect(riderMilestoneBadge(100)?.label).toBe("Легенда экипажа");
  });
});
