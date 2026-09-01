// iter27 — cancelled rentals must not pollute ANY money/counters surface.
//
// Context: the user cancelled the aborted Panigale (ff73acb5, ₽8000, Aug 30)
// for real, but the analytics quick counters kept accounting it. Root cause
// was NOT the KPI math (live simulation below proves it was already correct)
// but STALE CLIENT STATE: `router.refresh()` after «Отменить» does not re-run
// the client-side loaders in AnalyticsClientV2, so the cards kept the
// pre-cancel values until a full app reopen.
//
// This suite locks in three things:
//   1. computeAnalyticsKpis is cancelled-proof BY ITSELF (defence in depth —
//      previously it trusted the caller to pre-filter and counted every row
//      in totalToday / returnsDue).
//   2. The cancel path actually reloads the dashboard data (onDataRefresh
//      wiring through AnalyticsClientV2's reloadToken).
//   3. Every money/counters surface keeps its cancelled exclusion (source
//      guards: CSV, salary engine, my-work, dashboard summary, subrenter
//      counters) + a LIVE end-to-end simulation against Supabase.
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  computeAnalyticsKpis,
  isRentalRelevantForDate,
  localDateOnly,
} from "@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";

const read = (p: string) => readFileSync(p, "utf-8");

// ── 1. KPI math is cancelled-proof on its own ────────────────────────────────

const day = "2026-08-30";
const msk = (h: number) => `2026-08-30T${String(h).padStart(2, "0")}:30:00+00:00`;
// End 17:30 UTC = 20:30 MSK — still Aug 30 in Moscow (the KPIs are MSK-scoped).
const endMsk = "2026-08-30T17:30:00+00:00";

function kpiRow(overrides: Partial<Parameters<typeof computeAnalyticsKpis>[0][number]>) {
  return {
    status: "completed",
    total_cost: 5000,
    requested_start_date: msk(11),
    requested_end_date: endMsk,
    agreed_start_date: msk(11),
    agreed_end_date: endMsk,
    metadata: {},
    ...overrides,
  };
}

describe("iter27: computeAnalyticsKpis excludes cancelled rows on its own", () => {
  it("cancelled rentals never count in totalToday / returnsDue / revenue / partner / equipment", () => {
    const rows = [
      kpiRow({ status: "completed", total_cost: 5200 }), // real rental
      kpiRow({ status: "cancelled", total_cost: 8000 }), // the aborted Panigale shape
      kpiRow({ status: "cancelled", total_cost: 5000, subrenterChatId: "111" }),
    ];
    const kpis = computeAnalyticsKpis(rows, day);
    expect(kpis.totalToday).toBe(1);          // not 2
    expect(kpis.revenueToday).toBe(5200);     // not 13200
    expect(kpis.companyPartToday).toBe(5200); // not 13200 − partner cut
    expect(kpis.owedToSubrentersToday).toBe(0); // cancelled partner bike pays nobody
    expect(kpis.equipmentPartToday).toBe(0);
    expect(kpis.activeCount).toBe(0);
    expect(kpis.returnsDue).toBe(1);          // the real rental ends on the day
  });

  it("a cancelled rental that both starts and ends on the day is invisible in every counter", () => {
    const kpis = computeAnalyticsKpis(
      [kpiRow({ status: "cancelled", total_cost: 9999 })],
      day,
    );
    expect(kpis.totalToday).toBe(0);
    expect(kpis.returnsDue).toBe(0);
    expect(kpis.revenueToday).toBe(0);
  });

  it("null/unknown statuses are still counted (only 'cancelled' is dropped)", () => {
    const kpis = computeAnalyticsKpis(
      [kpiRow({ status: null }), kpiRow({ status: undefined })],
      day,
    );
    expect(kpis.totalToday).toBe(2);
  });

  it("real statuses keep the documented semantics (pending/confirmed/active/completed revenue)", () => {
    const kpis = computeAnalyticsKpis(
      [
        kpiRow({ status: "pending_confirmation", total_cost: 1000 }),
        kpiRow({ status: "confirmed", total_cost: 2000 }),
        kpiRow({ status: "active", total_cost: 3000 }),
        kpiRow({ status: "disputed", total_cost: 4000 }), // real but not billable in revenue
      ],
      day,
    );
    expect(kpis.totalToday).toBe(4);
    expect(kpis.revenueToday).toBe(6000);
  });

  it("isRentalRelevantForDate stays a pure date filter (list audit behavior unchanged)", () => {
    const cancelled = kpiRow({ status: "cancelled" });
    expect(isRentalRelevantForDate(cancelled, day)).toBe(true);
    expect(isRentalRelevantForDate(cancelled, "2026-09-01")).toBe(false);
  });
});

// ── 2. Cancel path reloads the dashboard data (the actual reported bug) ──────

describe("iter27: «Отменить» reloads the client-side dashboard data", () => {
  it("AnalyticsClient declares onDataRefresh and fires it after a successful cancel", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(src).toContain("onDataRefresh?: () => void");
    // the success branch must trigger the reload AFTER updateRentalStatus
    const successBranch = src.split('if (result.success) {')[1]?.split("} else {")[0] ?? "";
    expect(successBranch).toContain("router.refresh()");
    expect(successBranch).toContain("onDataRefresh?.()");
  });

  it("AnalyticsClientV2 bumps a reload token that re-runs loadRentals/loadSales", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(src).toMatch(/const \[reloadToken, setReloadToken\] = useState\(0\)/);
    // the token is part of the loader effect deps…
    expect(src).toMatch(/\[getActorUserId, date, loadRentals, loadSales, reloadToken\]/);
    // …and is bumped by the callback passed to AnalyticsClient
    expect(src).toContain('onDataRefresh={() => setReloadToken((t) => t + 1)}');
  });
});

// ── 3. Every other money/counters surface keeps excluding cancelled ─────────

describe("iter27: cancelled exclusions across all aggregation surfaces (source guards)", () => {
  it("CSV builder (download + TG + table view Σ) filters cancelled at the query level", () => {
    const src = read("lib/csv-builders/rentals-csv.ts");
    expect(src).toContain('.neq("status", "cancelled")');
  });

  it("salary engine (ЗП / calculateSalaryForPeriod) filters cancelled", () => {
    const src = read("app/franchize/server-actions/salary-calculations.ts");
    expect(src).toContain('.neq("status", "cancelled")');
  });

  it("profile «Моя работа» day salary filters cancelled", () => {
    const src = read("app/franchize/server-actions/my-work.ts");
    expect(src).toContain('.neq("status", "cancelled")');
  });

  it("dashboard server summary counts only non-cancelled items", () => {
    const src = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toContain('const nonCancelledItems = items.filter(r => r.status !== "cancelled")');
    // returns-day query also excludes cancelled server-side
    expect(src).toMatch(/\.neq\("status", "cancelled"\)/);
  });

  it("subrenter counters («всего аренд») skip cancelled", () => {
    const src = read("app/franchize/server-actions/subrenter-monitoring.ts");
    // both counter loops guard on the cancelled status (owned-bikes filter + overview stats loop)
    expect(src).toContain('String(r.status ?? "") !== "cancelled")');
    expect(src).toContain('if (String(r.status ?? "") === "cancelled") continue;');
    // monthly payout queries keep the SQL-level exclusion — 2026-09-02 (M4):
    // the payout sheet + weekly report now use the STRICTER earning-status
    // filter (expired/disputed rows never earn), matching the wall's rule.
    expect(src.match(/\.in\("status", \["completed", "active", "confirmed", "pending_confirmation"\]\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(src.match(/\.neq\("status", "cancelled"\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("admin «successful rentals» uses an explicit status whitelist", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain('.in("status", ["confirmed", "active", "completed"])');
  });

  it("evening summary + weekly revenue bash scripts exclude cancelled", () => {
    const evening = read("boss-commands/evening-summary.sh");
    expect(evening).toContain('map(select(.status != "cancelled"))');
    const weekly = read("boss-commands/weekly-revenue.sh");
    expect(weekly).toContain("status=in.(active,completed)");
  });
});

// ── 4. LIVE end-to-end simulation (real DB, real KPI functions) ─────────────
// Mirrors getRentalsDashboard's query trio + dedupe, then runs the real client
// pipeline (displayRentals → dayPageRentals → computeAnalyticsKpis) and asserts
// the cancelled Panigale (ff73acb5) never reaches the KPI input rows.

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

const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // vip-bike
const BASE_SELECT =
  "rental_id,user_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date," +
  "requested_start_date,requested_end_date,created_at,metadata," +
  "vehicle:cars!inner(id,make,model,crew_id,specs)";

async function fetchDayPage(date: string) {
  const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
  const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();
  const dayBeforeStart = new Date(new Date(startOfDay).getTime() - 24 * 3600 * 1000).toISOString();
  const dayAfterEnd = new Date(new Date(endOfDay).getTime() + 24 * 3600 * 1000).toISOString();
  const enc = encodeURIComponent;
  const base = `rentals?select=${enc(BASE_SELECT)}&vehicle.crew_id=eq.${CREW_ID}`;
  const q1 = `${base}&requested_start_date=gte.${enc(startOfDay)}&requested_start_date=lte.${enc(endOfDay)}&order=created_at.desc`;
  const q2 = `${base}&agreed_start_date=gte.${enc(startOfDay)}&agreed_start_date=lte.${enc(endOfDay)}&requested_start_date=is.null&order=created_at.desc`;
  const or3 = `or=(and(agreed_end_date.gte.${enc(dayBeforeStart)},agreed_end_date.lte.${enc(dayAfterEnd)}),` +
    `and(requested_end_date.gte.${enc(dayBeforeStart)},requested_end_date.lte.${enc(dayAfterEnd)}),` +
    `and(agreed_end_date.is.null,requested_end_date.gte.${enc(startOfDay)},requested_end_date.lte.${enc(endOfDay)})))`;
  const q3 = `rentals?select=${enc(BASE_SELECT)}&vehicle.crew_id=eq.${CREW_ID}&${or3}&status=neq.cancelled&order=created_at.desc`;

  const [a, b, c] = await Promise.all([sb(q1), sb(q2), sb(q3)]);
  const map = new Map<string, any>();
  for (const r of [...a, ...b, ...c]) if (!map.has(r.rental_id)) map.set(r.rental_id, r);
  const seen = new Set<string>();
  const items: any[] = [];
  for (const r of map.values()) {
    const key = `${r.user_id}::${r.vehicle_id}`;
    if (!seen.has(key)) { seen.add(key); items.push(r); }
  }
  return items;
}

describe("iter27: live quick-counter simulation (vip-bike, Aug 29–31)", () => {
  it("KPI cards exclude the cancelled rentals on every inspected day", async () => {
    const hasCreds = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasCreds) return; // no creds in CI — source guards above still cover the logic

    for (const date of ["2026-08-29", "2026-08-30", "2026-08-31"]) {
      const items = await fetchDayPage(date);
      const toRow = (item: any) => ({
        rental_id: item.rental_id,
        status: item.status,
        total_cost: Number(item.total_cost) || 0,
        requested_start_date: item.requested_start_date,
        requested_end_date: item.requested_end_date,
        agreed_start_date: item.agreed_start_date,
        agreed_end_date: item.agreed_end_date,
        created_at: item.created_at,
        metadata: item.metadata || {},
        vehicle_id: item.vehicle_id,
      });
      const nonService = items
        .filter((r) => !String(r.vehicle_id || "").startsWith("vip-bike-svc-"))
        .map(toRow);
      // Day-page rows fed RAW (cancelled included) — mirrors a hypothetical
      // caller that forgets to pre-filter. The iter27 hardening inside
      // computeAnalyticsKpis must make the pre-filter redundant:
      const dayPageRaw = nonService.filter((r) => isRentalRelevantForDate(r, date));
      const rawKpis = computeAnalyticsKpis(dayPageRaw, date);
      const filteredKpis = computeAnalyticsKpis(
        dayPageRaw.filter((r) => r.status !== "cancelled"),
        date,
      );
      expect(rawKpis, `${date}: KPIs differ between raw and pre-filtered input — cancelled leaked`).toEqual(filteredKpis);

      // The aborted Panigale (ff73acb5, ₽8000, started Aug 30) is the exact
      // reported case: its money must not be inside Aug 30's revenue.
      if (date === "2026-08-30") {
        const dayPageRawCancelled = dayPageRaw.filter((r) => r.status === "cancelled");
        const cancelledMoney = dayPageRawCancelled.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
        // Revenue = STARTED-today billable rows only (MSK calendar day).
        const billableMoney = dayPageRaw
          .filter((r) =>
            ["active", "completed", "confirmed", "pending_confirmation"].includes(String(r.status ?? "")) &&
            localDateOnly(r.requested_start_date || r.agreed_start_date) === date)
          .reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
        expect(rawKpis.revenueToday).toBe(billableMoney); // cancelled ₽ excluded
        expect(cancelledMoney).toBeGreaterThan(0); // the cancelled row really is on this day page
        const startedNonCancelled = dayPageRaw.filter(
          (r) =>
            String(r.status ?? "") !== "cancelled" &&
            localDateOnly(r.requested_start_date || r.agreed_start_date) === date,
        ).length;
        expect(rawKpis.totalToday).toBe(startedNonCancelled); // «Аренд сегодня» ignores cancelled
        // And a cancelled row that STARTS today must not be counted anywhere:
        const startedCancelled = dayPageRawCancelled.filter(
          (r) => localDateOnly(r.requested_start_date || r.agreed_start_date) === date,
        );
        expect(startedCancelled.length).toBeGreaterThanOrEqual(1); // Panigale case present
      }
    }
  }, 60000);
});
