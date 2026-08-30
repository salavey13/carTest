// iter28 — «стена мото» (bike story pages): pure-engine unit tests + source
// guards + LIVE simulation against the vip-bike DB.
//
// What this suite locks in:
//   1. computeBikeStats money discipline (iter27 continuation): cancelled
//      rentals never earn; service ₽ never mix into rental earnings; the
//      month slice uses the MSK calendar; odometer garbage rows contribute 0.
//   2. VK-wall feed rules: photo grid 1/2/3/4+, date dividers, wall ordering
//      («right now» pins to top, then newest), equipment chips.
//   3. Source guards: pages exist, the access gate mirrors the rentals-list
//      gate (owner / global admin incl. vprAdmin / ANY active crew member /
//      subrenter scope / password auth), photos come from the private bucket
//      as signed URLs, service events arrive via metadata.bike.
//   4. LIVE: the hero bike (ducati-panigale-s-electro-black) — engine output
//      equals an independent manual computation over the same rows.
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import {
  computeBikeStats,
  compareWallItems,
  dateDividerLabel,
  effectiveStatus,
  equipmentChips,
  formatRangeLabel,
  mskMonthKey,
  odometerDelta,
  photoGridRecipe,
  rentalDays,
  statusMeta,
} from "@/app/franchize/lib/bike-wall";

const read = (p: string) => readFileSync(p, "utf-8");
const APP = "app/franchize";

// ── 1. computeBikeStats: money discipline ────────────────────────────────────

const NOW = Date.parse("2026-08-31T12:00:00+00:00");

function row(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    totalCost: 10000,
    start: "2026-08-28T16:30:00+00:00",
    end: "2026-08-30T16:30:00+00:00",
    odometerBefore: 4356,
    odometerAfter: 4465,
    createdAt: "2026-08-27T10:00:00+00:00",
    ...overrides,
  };
}

describe("iter28: computeBikeStats money discipline", () => {
  it("cancelled rentals never earn, never count as completed, but stay visible on the wall", () => {
    const stats = computeBikeStats(
      [row({ status: "cancelled", totalCost: 8000 }), row({ totalCost: 10000 })],
      NOW,
    );
    expect(stats.earnedTotal).toBe(10000);
    expect(stats.completedCount).toBe(1);
    expect(stats.cancelledCount).toBe(1);
    expect(stats.totalCount).toBe(2);
  });

  it("month slice: only current-MSK-month earnings count (Aug 30 MSK = Aug, Aug 30 22:30 UTC = Aug 31 MSK → next month check)", () => {
    const stats = computeBikeStats(
      [
        row({ start: "2026-08-30T16:30:00+00:00", end: "2026-08-30T20:00:00+00:00", totalCost: 5200 }), // Aug 30 MSK 19:30
        row({ start: "2026-07-15T10:00:00+00:00", end: "2026-07-16T10:00:00+00:00", totalCost: 7000 }), // July
      ],
      NOW,
    );
    expect(stats.earnedTotal).toBe(12200);
    expect(stats.earnedThisMonth).toBe(5200);
  });

  it("service ₽ never mix into rental earnings — serviceTotal/serviceCount are separate", () => {
    const stats = computeBikeStats(
      [row({ totalCost: 10000 })],
      NOW,
      [
        { cost: 300, performedAt: "2026-08-29T17:30:30Z" },
        { cost: 750, performedAt: "2026-08-16T12:00:00Z" },
      ],
    );
    expect(stats.earnedTotal).toBe(10000);
    expect(stats.serviceCount).toBe(2);
    expect(stats.serviceTotal).toBe(1050);
    expect(stats.lastServiceAt).toBe("2026-08-29T17:30:30.000Z");
  });

  it("odometer: garbage (decreasing) rows contribute 0 distance; latest = max after", () => {
    const stats = computeBikeStats(
      [
        row({ odometerBefore: 7899, odometerAfter: 2562, start: "2026-08-23T17:00:00+00:00", end: "2026-08-24T17:00:00+00:00" }), // garbage
        row({ odometerBefore: 4356, odometerAfter: 4465 }),
      ],
      NOW,
    );
    expect(stats.distanceTotal).toBe(109);
    expect(stats.odometerLatest).toBe(4465);
  });

  it("avgCheck divides by earning rentals only", () => {
    const stats = computeBikeStats(
      [row({ totalCost: 10000 }), row({ totalCost: 2000 }), row({ status: "cancelled", totalCost: 99999 })],
      NOW,
    );
    expect(stats.avgCheck).toBe(6000);
  });

  it("daysInRent = ceil per rental, min 1; cancelled excluded", () => {
    const stats = computeBikeStats(
      [
        row({ start: "2026-08-28T16:30:00+00:00", end: "2026-08-30T16:30:00+00:00" }), // 2 days
        row({ start: "2026-08-20T10:00:00+00:00", end: "2026-08-20T18:00:00+00:00" }), // 1 day
        row({ status: "cancelled" }),
      ],
      NOW,
    );
    expect(stats.daysInRent).toBe(3);
  });
});

// ── 2. feed / wall rules ─────────────────────────────────────────────────────

describe("iter28: VK-wall feed rules", () => {
  it("photoGridRecipe: 1 single / 2 pair / 3 row / 4+ 2×2 with +N overflow", () => {
    expect(photoGridRecipe(1)).toEqual({ className: expect.stringContaining("grid-cols-1"), visible: 1, overflow: 0 });
    expect(photoGridRecipe(2).visible).toBe(2);
    expect(photoGridRecipe(3).visible).toBe(3);
    expect(photoGridRecipe(4)).toEqual({ className: expect.stringContaining("grid-cols-2"), visible: 4, overflow: 0 });
    expect(photoGridRecipe(7).overflow).toBe(3);
    expect(photoGridRecipe(0).visible).toBe(0);
  });

  it("dateDividerLabel: Сегодня / Вчера / long form (MSK)", () => {
    const now = Date.parse("2026-08-31T10:00:00+00:00"); // 13:00 MSK
    expect(dateDividerLabel("2026-08-31T05:00:00+00:00", now)).toBe("Сегодня"); // 08:00 MSK
    expect(dateDividerLabel("2026-08-30T20:00:00+00:00", now)).toBe("Вчера"); // 23:00 MSK Aug 30
    expect(dateDividerLabel("2026-08-01T00:00:00+00:00", now)).toBe("1 августа");
  });

  it("wall ordering: «right now» pins above newer history, then newest first", () => {
    const now = Date.parse("2026-08-31T12:00:00+00:00");
    const activeOld = { isNow: true, start: "2026-08-20T10:00:00+00:00", createdAt: "2026-08-20T10:00:00+00:00", rentalId: "a" };
    const doneNew = { isNow: false, start: "2026-08-30T10:00:00+00:00", createdAt: "2026-08-30T10:00:00+00:00", rentalId: "b" };
    expect(compareWallItems(activeOld, doneNew)).toBeLessThan(0); // active wins despite older date
    const older = { isNow: false, start: "2026-08-01T10:00:00+00:00", createdAt: null, rentalId: "x" };
    expect(compareWallItems(doneNew, older)).toBeLessThan(0); // newest first
  });

  it("equipmentChips: numbers are units, booleans count 1, 0/false skipped, sorted by count", () => {
    const chips = equipmentChips({
      helmets: 2, gloves: 1, jacket: true, charger: false, boots: 0, pants: "true", bag: 3,
    });
    const byLabel = Object.fromEntries(chips.map((c) => [c.label, c.count]));
    expect(byLabel).toEqual({
      "шлем": 2,
      "перчатки": 1,
      "куртка": 1,
      "штаны": 1,
      "сумка": 3,
    });
    expect(chips[0]).toEqual({ label: "сумка", count: 3 }); // biggest first
    expect(chips).toHaveLength(5); // charger:false + boots:0 skipped
    expect(equipmentChips(null)).toEqual([]);
    expect(equipmentChips("junk")).toEqual([]);
  });

  it("effectiveStatus: past-due active → expired (24h grace), cancelled stays", () => {
    const now = Date.parse("2026-08-31T12:00:00+00:00");
    expect(effectiveStatus("active", "2026-08-29T12:00:00+00:00", now)).toBe("expired");
    expect(effectiveStatus("active", "2026-08-31T08:00:00+00:00", now)).toBe("active"); // within grace
    expect(effectiveStatus("cancelled", null, now)).toBe("cancelled");
  });

  it("formatRangeLabel and statusMeta basics", () => {
    expect(formatRangeLabel("2026-08-28T16:30:00+00:00", "2026-08-30T16:30:00+00:00")).toContain("→");
    expect(formatRangeLabel(null, null)).toBe("даты не указаны");
    expect(statusMeta("active").label).toBe("В аренде");
    expect(statusMeta("completed").tone).toBe("positive");
    expect(statusMeta("cancelled").tone).toBe("muted");
  });

  it("rentalDays min 1; mskMonthKey fixed +3 offset", () => {
    expect(rentalDays("2026-08-28T16:30:00+00:00", "2026-08-30T16:30:00+00:00")).toBe(2);
    expect(rentalDays("2026-08-28T16:30:00+00:00", null)).toBe(1);
    expect(rentalDays(null, null)).toBe(0);
    expect(mskMonthKey("2026-08-31T22:00:00+00:00")).toBe("2026-09"); // Sep 1 MSK
  });
});

// ── 3. source guards ─────────────────────────────────────────────────────────

describe("iter28: source guards — pages, gate, photos, service linkage", () => {
  it("bikes pages exist (list + story)", () => {
    expect(existsSync(`${APP}/[slug]/bikes/page.tsx`)).toBe(true);
    expect(existsSync(`${APP}/[slug]/bikes/BikesWallClient.tsx`)).toBe(true);
    expect(existsSync(`${APP}/[slug]/bikes/[bikeId]/page.tsx`)).toBe(true);
    expect(existsSync(`${APP}/[slug]/bikes/[bikeId]/BikeStoryClient.tsx`)).toBe(true);
  });

  it("access gate: owner / global admin (vprAdmin top-level + metadata legacy) / ANY active crew member / subrenter / password auth", () => {
    const src = read(`${APP}/server-actions/bike-wall.ts`);
    expect(src).toContain("isPasswordAuth");               // password analytics auth
    expect(src).toContain('user?.role === "vprAdmin"');    // top-level global admin
    expect(src).toContain('userMetadata?.status === "admin"'); // metadata legacy admin
    expect(src).toContain("membership_status\", \"active\"");  // active membership (any role)
    expect(src).toContain("specs->>subrenter_chat_id");    // subrenter scope
    expect(src).toContain("Недостаточно прав");            // gate rejects outsiders
  });

  it("subrenter scope filters the fleet: .in('id', subrenterVehicleIds) + story guard", () => {
    const src = read(`${APP}/server-actions/bike-wall.ts`);
    expect(src).toContain("bikeQuery.in(\"id\", subrenterVehicleIds)");
    expect(src).toContain("другому партнёру"); // story page cross-partner guard
  });

  it("photos: private bucket + signed URLs + deleted/archived filtered", () => {
    const src = read(`${APP}/server-actions/bike-wall.ts`);
    expect(src).toContain("\"rental-photos\"");
    expect(src).toContain("createSignedUrls");
    expect(src).toContain(".is(\"deleted_at\", null)");
    expect(src).toContain(".is(\"archived_at\", null)");
  });

  it("service work linkage: or(vehicle_id, metadata->>bike) + parseServiceEvent + separate service feed kind", () => {
    const src = read(`${APP}/server-actions/bike-wall.ts`);
    expect(src).toContain("metadata->>bike");
    expect(src).toContain("parseServiceEvent");
    expect(src).toContain('kind: "service"');
    expect(src).toContain("service_name");
    expect(src).toContain("performed_at");
  });

  it("stats come from computeBikeStats (single money source, cancelled-proof)", () => {
    const src = read(`${APP}/server-actions/bike-wall.ts`);
    expect(src).toContain("computeBikeStats");
    expect(src).not.toContain("earnedTotal += Number(r.total_cost)"); // no hand-rolled money math
  });

  it("wall client renders photos from rentals (VK grid + lightbox), mobile-first single column", () => {
    const story = read(`${APP}/[slug]/bikes/[bikeId]/BikeStoryClient.tsx`);
    expect(story).toContain("photoGridRecipe");
    expect(story).toContain("aspectStyle");
    expect(story).toContain("setLightbox");
    expect(story).toContain("space-y-2.5"); // single-column wall stack
    expect(story).toContain("sticky top-0"); // date dividers stick on scroll
    const list = read(`${APP}/[slug]/bikes/BikesWallClient.tsx`);
    expect(list).toContain("sm:grid-cols-2 lg:grid-cols-3"); // responsive fleet grid (1 col on mobile)
    expect(list).toContain("formatMoney");
  });

  it("«Мотопарк» present in section nav links", () => {
    const src = read(`${APP}/lib/section-links.ts`);
    expect(src).toContain("Мотопарк");
    expect(src).toContain('"/bikes"');
  });

  it("both pages reuse AnalyticsPasswordEntry + useCrewTokens (consistent auth & theming)", () => {
    const list = read(`${APP}/[slug]/bikes/BikesWallClient.tsx`);
    const story = read(`${APP}/[slug]/bikes/[bikeId]/BikeStoryClient.tsx`);
    for (const src of [list, story]) {
      expect(src).toContain("AnalyticsPasswordEntry");
      expect(src).toContain("useCrewTokens");
      expect(src).toContain("useAppContext");
    }
  });
});

// ── 4. LIVE simulation (vip-bike, creds-dependent like iter27) ───────────────

const env: Record<string, string> = {};
for (const line of readFileSync("/home/z/my-project/upload/secrets_all.txt", "utf-8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]!] = m[2].trim().replace(/^"|"$/g, "");
}

async function sb(path: string): Promise<any[]> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const HERO_BIKE = "ducati-panigale-s-electro-black";
const SELECT = encodeURIComponent(
  "rental_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date,created_at,metadata",
);

describe("iter28: live hero-bike simulation (vip-bike)", () => {
  it("engine stats equal an independent manual computation over the same rows", async () => {
    const hasCreds = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasCreds) return; // no creds in CI — unit + source guards above still cover the logic

    // same or() query as getBikeStoryAction
    const orFilter = encodeURIComponent(
      `or=(vehicle_id.eq.${HERO_BIKE},metadata->>bike.eq.${HERO_BIKE})`,
    );
    const rows = await sb(`rentals?select=${SELECT}&${orFilter}&limit=300`);
    expect(rows.length).toBeGreaterThan(0);

    const bikeRentals = rows.filter((r) => r.vehicle_id === HERO_BIKE);
    const serviceRows = rows
      .filter((r) => r.vehicle_id !== HERO_BIKE && r.metadata?.bike === HERO_BIKE)
      .map((r) => ({ cost: Number(r.total_cost) || 0, performedAt: r.metadata?.performed_at ?? r.created_at }));
    expect(serviceRows.length).toBeGreaterThan(0); // the metadata.bike discovery holds on live data

    const engine = computeBikeStats(
      bikeRentals.map((r) => ({
        status: r.status,
        totalCost: r.total_cost,
        start: r.agreed_start_date,
        end: r.agreed_end_date,
        odometerBefore: r.metadata?.odometer_before,
        odometerAfter: r.metadata?.odometer_after,
        createdAt: r.created_at,
      })),
      Date.now(),
      serviceRows,
    );

    // manual computation, independent of the engine
    const manualEarned = bikeRentals
      .filter((r) => r.status !== "cancelled")
      .reduce((acc, r) => acc + (Number(r.total_cost) || 0), 0);
    const manualService = serviceRows.reduce((acc, s) => acc + s.cost, 0);
    expect(engine.earnedTotal).toBe(manualEarned);
    expect(engine.serviceTotal).toBe(manualService);
    expect(engine.serviceCount).toBe(serviceRows.length);
    expect(engine.cancelledCount).toBe(bikeRentals.filter((r) => r.status === "cancelled").length);
  });

  it("fleet-level: at least one bike in vip-bike has service history via metadata.bike", async () => {
    const hasCreds = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasCreds) return;
    const svc = await sb(
      `rentals?select=rental_id,metadata->>bike&metadata->>bike=not.is.null&limit=200`,
    );
    expect(svc.length).toBeGreaterThan(0);
    const linked = svc.filter((r) => typeof r.bike === "string" && r.bike.length > 0);
    expect(linked.length).toBeGreaterThan(0);
  });
});
