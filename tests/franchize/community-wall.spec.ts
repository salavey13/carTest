// /tests/franchize/community-wall.spec.ts
//
// Unit tests for the OnlyBike community wall pure logic
// (app/franchize/lib/community-wall.ts): stats computation, RU plurals,
// relative time, initData user parsing. No Supabase, no server-only imports.
//
// Run: npx vitest run tests/franchize/community-wall.spec.ts

import { describe, it, expect } from "vitest";
import {
  buildStatsPostBody,
  computeRiderStats,
  formatRelativeTimeRu,
  formatRub,
  parseTelegramInitDataUser,
  pluralRu,
  rentalHours,
  type StatsRentalRow,
} from "@/app/franchize/lib/community-wall";

const NOW = Date.parse("2026-09-19T12:00:00Z");

function row(overrides: Partial<StatsRentalRow> = {}): StatsRentalRow {
  return {
    vehicle_id: "bike-a",
    status: "completed",
    total_cost: 1000,
    agreed_start_date: "2026-09-01T10:00:00Z",
    agreed_end_date: "2026-09-01T13:00:00Z",
    requested_start_date: null,
    requested_end_date: null,
    ...overrides,
  };
}

const BIKES = new Map([
  ["bike-a", { id: "bike-a", title: "Kawasaki EX650K", type: "bike" }],
  ["bike-b", { id: "bike-b", title: "Suzuki Boulevard", type: "bike" }],
  ["helmet", { id: "helmet", title: "The Meta Helmet", type: "equipment" }],
  ["svc", { id: "svc", title: "ТО цепи", type: "service" }],
]);

describe("computeRiderStats", () => {
  it("counts only non-cancelled bike rentals", () => {
    const stats = computeRiderStats(
      [
        row(), // bike, completed → counts
        row({ status: "cancelled", total_cost: 99999 }), // cancelled → ₽0, not a ride
        row({ vehicle_id: "helmet", total_cost: 500 }), // equipment → excluded
        row({ vehicle_id: "svc", total_cost: 3000 }), // service → excluded
        row({ vehicle_id: null }), // broken row → excluded
      ],
      BIKES,
    );
    expect(stats.ridesCount).toBe(1);
    expect(stats.totalSpent).toBe(1000);
    expect(stats.bikesUsed).toBe(1);
    expect(stats.bikes[0]).toMatchObject({ vehicleId: "bike-a", count: 1 });
  });

  it("sums ceil-hours with min 1 per dated rental (hourly city rentals)", () => {
    const stats = computeRiderStats(
      [
        row({ agreed_start_date: "2026-09-01T10:00:00Z", agreed_end_date: "2026-09-01T10:20:00Z" }), // 20 min → 1h
        row({ agreed_start_date: "2026-09-02T10:00:00Z", agreed_end_date: "2026-09-02T14:30:00Z" }), // 4.5h → 5h
      ],
      BIKES,
    );
    expect(stats.hoursRented).toBe(6);
    expect(stats.ridesCount).toBe(2);
  });

  it("falls back to requested dates when agreed are missing", () => {
    const stats = computeRiderStats(
      [
        row({
          agreed_start_date: null,
          agreed_end_date: null,
          requested_start_date: "2026-09-05T08:00:00Z",
          requested_end_date: "2026-09-06T08:00:00Z",
        }),
      ],
      BIKES,
    );
    expect(stats.hoursRented).toBe(24);
    expect(stats.firstRideAt).toBe("2026-09-05T08:00:00Z");
    expect(stats.lastRideAt).toBe("2026-09-05T08:00:00Z");
  });

  it("tracks first/last ride and groups bikes by count desc", () => {
    const stats = computeRiderStats(
      [
        row({ vehicle_id: "bike-b", agreed_start_date: "2026-09-10T00:00:00Z" }),
        row({ vehicle_id: "bike-a", agreed_start_date: "2026-09-01T00:00:00Z" }),
        row({ vehicle_id: "bike-a", agreed_start_date: "2026-09-15T00:00:00Z" }),
      ],
      BIKES,
    );
    expect(stats.firstRideAt).toBe("2026-09-01T00:00:00Z");
    expect(stats.lastRideAt).toBe("2026-09-15T00:00:00Z");
    expect(stats.bikes[0]).toMatchObject({ vehicleId: "bike-a", count: 2 });
    expect(stats.bikes[1]).toMatchObject({ vehicleId: "bike-b", count: 1 });
    expect(stats.bikesUsed).toBe(2);
  });

  it("returns an empty snapshot for no rentals", () => {
    const stats = computeRiderStats([], BIKES);
    expect(stats).toEqual({
      ridesCount: 0,
      hoursRented: 0,
      totalSpent: 0,
      bikesUsed: 0,
      firstRideAt: null,
      lastRideAt: null,
      bikes: [],
    });
  });

  it("handles string numerics from REST", () => {
    const stats = computeRiderStats([row({ total_cost: "2500" as unknown as number })], BIKES);
    expect(stats.totalSpent).toBe(2500);
  });
});

describe("rentalHours", () => {
  it("is 0 without a start", () => {
    expect(rentalHours(null, "2026-09-01T10:00:00Z")).toBe(0);
  });
  it("is at least 1 for zero-length or reversed periods", () => {
    expect(rentalHours("2026-09-01T10:00:00Z", "2026-09-01T10:00:00Z")).toBe(1);
    expect(rentalHours("2026-09-02T10:00:00Z", "2026-09-01T10:00:00Z")).toBe(1);
  });
});

describe("pluralRu", () => {
  it("handles 1 / 2-4 / 5-20 / 21 / 11-14", () => {
    expect(pluralRu(1, ["поездка", "поездки", "поездок"])).toBe("поездка");
    expect(pluralRu(2, ["поездка", "поездки", "поездок"])).toBe("поездки");
    expect(pluralRu(5, ["поездка", "поездки", "поездок"])).toBe("поездок");
    expect(pluralRu(11, ["поездка", "поездки", "поездок"])).toBe("поездок");
    expect(pluralRu(21, ["поездка", "поездки", "поездок"])).toBe("поездка");
    expect(pluralRu(22, ["поездка", "поездки", "поездок"])).toBe("поездки");
  });
});

describe("formatRelativeTimeRu", () => {
  it("says «только что» under a minute and for future timestamps", () => {
    expect(formatRelativeTimeRu("2026-09-19T11:59:30Z", NOW)).toBe("только что");
    expect(formatRelativeTimeRu("2026-09-19T12:01:00Z", NOW)).toBe("только что");
  });
  it("formats minutes, hours, yesterday, days", () => {
    expect(formatRelativeTimeRu("2026-09-19T11:30:00Z", NOW)).toBe("30 минут назад");
    expect(formatRelativeTimeRu("2026-09-19T09:00:00Z", NOW)).toBe("3 часа назад");
    expect(formatRelativeTimeRu("2026-09-18T09:00:00Z", NOW)).toBe("вчера");
    // 40h ago spans two midnights → «2 дня», not the misleading «вчера».
    expect(formatRelativeTimeRu("2026-09-17T20:00:00Z", NOW)).toBe("2 дня назад");
    expect(formatRelativeTimeRu("2026-09-15T12:00:00Z", NOW)).toBe("4 дня назад");
  });
  it("falls back to a date after a week", () => {
    expect(formatRelativeTimeRu("2026-09-01T12:00:00Z", NOW)).toBe("1 сен");
    expect(formatRelativeTimeRu("2025-09-01T12:00:00Z", NOW)).toBe("1 сен 2025");
  });
  it("is safe on garbage input", () => {
    expect(formatRelativeTimeRu(null, NOW)).toBe("");
    expect(formatRelativeTimeRu("not-a-date", NOW)).toBe("");
  });
});

describe("formatRub", () => {
  it("groups thousands and keeps sign", () => {
    expect(formatRub(12400)).toBe("12\u00A0400 ₽");
    expect(formatRub(-950)).toBe("−950 ₽");
    expect(formatRub(1000.4)).toBe("1\u00A0000 ₽");
  });
});

describe("parseTelegramInitDataUser", () => {
  it("parses a verified-shape initData user payload", () => {
    const initData = `user=%7B%22id%22%3A356282674%2C%22first_name%22%3A%22Иван%22%2C%22last_name%22%3A%22Петров%22%2C%22username%22%3A%22iv%22%2C%22photo_url%22%3A%22https%3A%2F%2Ft.me%2Fi.png%22%7D&auth_date=1758000000&hash=abc`;
    const parsed = parseTelegramInitDataUser(initData);
    expect(parsed).toEqual({
      id: "356282674",
      username: "iv",
      fullName: "Иван Петров",
      photoUrl: "https://t.me/i.png",
    });
  });
  it("returns null on garbage / missing user / missing id", () => {
    expect(parseTelegramInitDataUser("hash=abc")).toBeNull();
    expect(parseTelegramInitDataUser("user=not-json")).toBeNull();
    expect(parseTelegramInitDataUser(`user=%7B%7D&hash=abc`)).toBeNull();
  });
  it("keeps first-name-only riders", () => {
    const initData = `user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Аня%22%7D`;
    expect(parseTelegramInitDataUser(initData)).toMatchObject({ id: "42", fullName: "Аня", username: null });
  });
});

describe("buildStatsPostBody", () => {
  it("is honest about zero rides", () => {
    const body = buildStatsPostBody({
      ridesCount: 0, hoursRented: 0, totalSpent: 0, bikesUsed: 0,
      firstRideAt: null, lastRideAt: null, bikes: [],
    });
    expect(body).toContain("без поездок");
  });
  it("announces rides with correct plurals", () => {
    const body = buildStatsPostBody({
      ridesCount: 5, hoursRented: 12, totalSpent: 30000, bikesUsed: 2,
      firstRideAt: null, lastRideAt: null,
      bikes: [{ vehicleId: "bike-a", title: "Kawasaki", count: 3 }, { vehicleId: "bike-b", title: "Suzuki", count: 2 }],
    });
    expect(body).toContain("5 поездок");
    expect(body).toContain("12 часов");
    expect(body).toContain("2 байках");
  });
});
