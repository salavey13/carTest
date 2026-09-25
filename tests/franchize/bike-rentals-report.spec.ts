// bike-rentals-report — «Отчёт» button on the Мотопарк wall (2026-09-26).
//
// What this suite locks in:
//   1. The markdown builder reproduces the boss-approved one-pager EXACTLY —
//      verified against his two pasted samples (Yamaha R6, Suzuki M109R) whose
//      rows were cross-checked against the live DB on 2026-09-26.
//   2. Money discipline: revenue = completed+active only (the label says so);
//      avg check floors (38 000/3 → 12 666, boss sample); pending/cancelled/
//      expired never earn; service rows can't leak in (server filters
//      vehicle_id = bike).
//   3. Dates: agreed_* with requested_* fallback (pending rentals), MSK
//      wall-clock (+03:00), duration hours<24h else days.
//   4. Client names: users.full_name beats metadata.renter_name («SERG»,
//      «Maxim» — not the passport ФИО), then @username, then renter_name, «—».
//   5. Source guards: the server action reuses the same access gate as the
//      story wall, scopes subrenters to their bikes, and the button is a
//      SIBLING of the card Link (never a nested <button> inside <a>).
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  buildBikeRentalsReport,
  mskDateTime,
  paymentLabel,
  reportDuration,
  reportStatusLabel,
  reportStatusPlain,
  resolveReportClientName,
  type BikeReportRentalRow,
} from "@/app/franchize/lib/bike-rentals-report";
const read = (p: string) => readFileSync(p, "utf-8");
const APP = "app/franchize";

// ── fixtures — the boss's Yamaha R6 sample, byte-checked against the DB ──────

const NOW = Date.parse("2026-09-25T11:02:00+00:00"); // → 25.09.2026 14:02 МСК

function r6Rows(): BikeReportRentalRow[] {
  return [
    {
      rentalId: "63d243f1-fc1b-4953-aea0-a39d43408029",
      status: "completed",
      paymentStatus: "fully_paid",
      totalCost: 3500,
      agreedStart: "2026-08-29T12:00:00+00:00",
      agreedEnd: "2026-08-29T13:00:00+00:00",
      requestedStart: null,
      requestedEnd: null,
      createdAt: "2026-08-29T12:08:39.161733+00:00",
      clientName: "SERG",
    },
    {
      rentalId: "abd9cf5f-3bff-4aee-9c6e-36b3f2cfb490",
      status: "completed",
      paymentStatus: "fully_paid",
      totalCost: 11500,
      agreedStart: "2026-09-11T08:00:00+00:00",
      agreedEnd: "2026-09-12T08:00:00+00:00",
      requestedStart: null,
      requestedEnd: null,
      createdAt: "2026-09-11T08:51:55.218952+00:00",
      clientName: "Илья I.O.S.",
    },
    {
      rentalId: "a5f4aa2d-4545-487e-a150-d826eb6ede74",
      status: "completed",
      paymentStatus: "fully_paid",
      totalCost: 6000,
      agreedStart: "2026-09-24T07:00:00+00:00",
      agreedEnd: "2026-09-24T10:00:00+00:00",
      requestedStart: null,
      requestedEnd: null,
      createdAt: "2026-09-24T06:54:31.34082+00:00",
      clientName: "Мих",
    },
  ];
}

// ── 1. golden sample (R6) ────────────────────────────────────────────────────

describe("bike-rentals-report: golden R6 sample", () => {
  const out = buildBikeRentalsReport({
    bikeLabel: "Yamaha R6",
    bikeId: "yamaha-r6-2007",
    crewName: "VIP_BIKE",
    rentals: r6Rows(),
    nowMs: NOW,
  });

  it("header + meta lines match the boss format exactly", () => {
    const lines = out.markdown.split("\n");
    expect(lines[0]).toBe("# Аренды за всё время — Yamaha R6");
    expect(lines[2]).toBe("- Байк: `yamaha-r6-2007` (VIP BIKE)"); // _ → space
    expect(lines[3]).toBe("- Период данных: 29.08.2026 — 24.09.2026");
    expect(lines[4]).toBe("- Отчёт сформирован: 25.09.2026 14:02 МСК");
  });

  it("summary: count, status breakdown, revenue, floored avg check", () => {
    expect(out.markdown).toContain("- Всего аренд: **3**");
    expect(out.markdown).toContain("  - Завершена: 3");
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **21 000 ₽**");
    expect(out.markdown).toContain("- Средний чек: **7 000 ₽**");
  });

  it("table rows: MSK dates, duration, client, status emoji, payment, money, created", () => {
    expect(out.markdown).toContain(
      "| # | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Стоимость | Создана |",
    );
    expect(out.markdown).toContain(
      "| 1 | 29.08.2026 15:00 → 29.08.2026 16:00 | 1 ч | SERG | 🟢 Завершена | оплачен | 3 500 ₽ | 29.08.2026 15:08 |",
    );
    expect(out.markdown).toContain(
      "| 2 | 11.09.2026 11:00 → 12.09.2026 11:00 | 1 дн | Илья I.O.S. | 🟢 Завершена | оплачен | 11 500 ₽ | 11.09.2026 11:51 |",
    );
    expect(out.markdown).toContain("| 3 | 24.09.2026 10:00 → 24.09.2026 13:00 | 3 ч | Мих |");
  });

  it("deep links section + filename", () => {
    expect(out.markdown).toContain("## Ссылки на аренды");
    expect(out.markdown).toContain("1. https://t.me/oneBikePlsBot/app?startapp=rental_63d243f1-fc1b-4953-aea0-a39d43408029");
    expect(out.markdown).toContain("3. https://t.me/oneBikePlsBot/app?startapp=rental_a5f4aa2d-4545-487e-a150-d826eb6ede74");
    expect(out.filename).toBe("rentals_yamaha-r6-2007_2026-09-25.md");
  });

  it("rows are chronological regardless of input order", () => {
    const shuffled = buildBikeRentalsReport({
      bikeLabel: "Yamaha R6",
      bikeId: "yamaha-r6-2007",
      crewName: "VIP_BIKE",
      rentals: [...r6Rows()].reverse(),
      nowMs: NOW,
    });
    const i1 = shuffled.markdown.indexOf("29.08.2026 15:00");
    const i2 = shuffled.markdown.indexOf("11.09.2026 11:00");
    const i3 = shuffled.markdown.indexOf("24.09.2026 10:00");
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });
});

// ── 2. Suzuki pending row — requested_* fallback + предоплата ────────────────

describe("bike-rentals-report: pending rental (Suzuki sample)", () => {
  const out = buildBikeRentalsReport({
    bikeLabel: "Suzuki M109R 1800 Boulevard",
    bikeId: "suzuki-vzr1800-boulevard-2006",
    crewName: "VIP_BIKE",
    rentals: [
      // one completed rental (Suzuki #1) + the pending one (Suzuki #4)
      {
        rentalId: "a78ebd3c-d95a-4b0c-a8a5-a648597c7438",
        status: "completed",
        paymentStatus: "fully_paid",
        totalCost: 16000,
        agreedStart: "2026-09-17T08:00:00+00:00",
        agreedEnd: "2026-09-18T08:00:00+00:00",
        requestedStart: null,
        requestedEnd: null,
        createdAt: "2026-09-17T07:33:25.767294+00:00",
        clientName: "Maxim",
      },
      {
        rentalId: "477248e4-2d6a-4cc9-bad1-7b63cdcfef20",
        status: "pending_confirmation",
        paymentStatus: "interest_paid",
        totalCost: null,
        agreedStart: null,
        agreedEnd: null,
        requestedStart: "2026-09-27T12:00:00+00:00",
        requestedEnd: "2026-09-27T15:00:00+00:00",
        createdAt: "2026-09-24T19:39:08.258173+00:00",
        clientName: null,
      },
    ],
    nowMs: NOW,
  });

  it("pending row: requested dates, предоплата, «—» cost, 🟡 status, excluded from revenue", () => {
    expect(out.markdown).toContain(
      "| 2 | 27.09.2026 15:00 → 27.09.2026 18:00 | 3 ч | — | 🟡 Ожидает подтверждения | предоплата | — |",
    );
    expect(out.markdown).toContain("  - Завершена: 1");
    expect(out.markdown).toContain("  - Ожидает подтверждения: 1");
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **16 000 ₽**");
    expect(out.markdown).toContain("- Средний чек: **16 000 ₽**");
  });

  it("data period stretches into the future window (17.09 — 27.09)", () => {
    expect(out.markdown).toContain("- Период данных: 17.09.2026 — 27.09.2026");
  });

  it("avg check floors the division (38 000 / 3 → 12 666, boss sample)", () => {
    const out2 = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        { rentalId: "a", status: "completed", paymentStatus: "fully_paid", totalCost: 16000, agreedStart: "2026-09-17T08:00:00+00:00", agreedEnd: "2026-09-18T08:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-17T07:33:25.767294+00:00", clientName: "Maxim" },
        { rentalId: "b", status: "completed", paymentStatus: "fully_paid", totalCost: 14000, agreedStart: "2026-09-18T00:00:00+00:00", agreedEnd: "2026-09-19T00:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-18T17:22:21.604039+00:00", clientName: "Maxim" },
        { rentalId: "c", status: "completed", paymentStatus: "fully_paid", totalCost: 8000, agreedStart: "2026-09-20T11:00:00+00:00", agreedEnd: "2026-09-20T17:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-20T10:16:18.235719+00:00", clientName: "Илья I.O.S." },
      ],
      nowMs: NOW,
    });
    expect(out2.markdown).toContain("- Выручка (завершённые + активные): **38 000 ₽**");
    expect(out2.markdown).toContain("- Средний чек: **12 666 ₽**"); // floor, not round(→12667)
  });
});

// ── 3. money/status discipline ───────────────────────────────────────────────

describe("bike-rentals-report: status & money discipline", () => {
  it("cancelled never earns (nominal cost stays visible as a fact), ⚪️ in table and summary", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        { rentalId: "a", status: "completed", paymentStatus: "fully_paid", totalCost: 5000, agreedStart: "2026-09-01T10:00:00+00:00", agreedEnd: "2026-09-01T14:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-01T09:00:00+00:00", clientName: "A" },
        { rentalId: "b", status: "cancelled", paymentStatus: null, totalCost: 9000, agreedStart: "2026-09-02T10:00:00+00:00", agreedEnd: "2026-09-03T10:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-02T09:00:00+00:00", clientName: "B" },
      ],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("| 2 | 02.09.2026 13:00 → 03.09.2026 13:00 | 1 дн | B | ⚪️ Отменена | — | 9 000 ₽ |");
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **5 000 ₽**");
    expect(out.markdown).toContain("  - Завершена: 1");
    expect(out.markdown).toContain("  - Отменена: 1");
  });

  it("past-due active renders as 🔴 Просрочена (effectiveStatus) and does not earn", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        {
          rentalId: "a",
          status: "active",
          paymentStatus: "fully_paid",
          totalCost: 7000,
          agreedStart: "2026-09-01T10:00:00+00:00",
          agreedEnd: "2026-09-02T10:00:00+00:00", // >24h before NOW → expired
          requestedStart: null,
          requestedEnd: null,
          createdAt: "2026-09-01T09:00:00+00:00",
          clientName: "A",
        },
      ],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("🔴 Просрочена");
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **0 ₽**");
    expect(out.markdown).toContain("- Средний чек: **—**");
    expect(out.markdown).toContain("  - Просрочена: 1");
  });

  it("zero-cost earning rentals do not dilute the avg check", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        { rentalId: "a", status: "completed", paymentStatus: "fully_paid", totalCost: 10000, agreedStart: "2026-09-01T10:00:00+00:00", agreedEnd: "2026-09-02T10:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-01T09:00:00+00:00", clientName: "A" },
        { rentalId: "b", status: "completed", paymentStatus: "fully_paid", totalCost: 0, agreedStart: "2026-09-03T10:00:00+00:00", agreedEnd: "2026-09-03T12:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-03T09:00:00+00:00", clientName: "B" },
      ],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **10 000 ₽**");
    expect(out.markdown).toContain("- Средний чек: **10 000 ₽**"); // 10000/1, not /2
  });
});

// ── 4. helpers ───────────────────────────────────────────────────────────────

describe("bike-rentals-report: helpers", () => {
  it("duration: <24h in hours (floored, never «24 ч»), ≥24h in days, missing end → —", () => {
    expect(reportDuration("2026-08-29T12:00:00+00:00", "2026-08-29T13:00:00+00:00")).toBe("1 ч");
    expect(reportDuration("2026-09-20T11:00:00+00:00", "2026-09-20T17:00:00+00:00")).toBe("6 ч");
    expect(reportDuration("2026-09-11T08:00:00+00:00", "2026-09-12T08:00:00+00:00")).toBe("1 дн");
    expect(reportDuration("2026-09-11T08:00:00+00:00", "2026-09-13T12:00:00+00:00")).toBe("2 дн");
    // 23h36m must stay on the hours scale (round would render «24 ч»)
    expect(reportDuration("2026-09-11T08:00:00+00:00", "2026-09-12T07:36:00+00:00")).toBe("23 ч");
    expect(reportDuration("2026-09-11T08:00:00+00:00", null)).toBe("—");
    expect(reportDuration(null, null)).toBe("—");
  });

  it("payment labels: fully_paid / interest_paid / pending / unknown / null", () => {
    expect(paymentLabel("fully_paid")).toBe("оплачен");
    expect(paymentLabel("interest_paid")).toBe("предоплата");
    expect(paymentLabel("pending")).toBe("не оплачен");
    expect(paymentLabel("crypto_paid")).toBe("crypto_paid"); // future values pass through
    expect(paymentLabel(null)).toBe("—");
  });

  it("status labels use effective status", () => {
    expect(reportStatusLabel("completed", null, NOW)).toBe("🟢 Завершена");
    expect(reportStatusLabel("pending_confirmation", null, NOW)).toBe("🟡 Ожидает подтверждения");
    expect(reportStatusLabel("confirmed", null, NOW)).toBe("🟣 Подтверждена");
    expect(reportStatusLabel("active", "2026-09-20T10:00:00+00:00", NOW)).toBe("🔴 Просрочена");
    expect(reportStatusLabel("active", null, NOW)).toBe("🟢 В аренде");
    expect(reportStatusPlain("pending_confirmation", null, NOW)).toBe("Ожидает подтверждения");
  });

  it("client fallback chain: full_name → @username → renter_name → —", () => {
    expect(resolveReportClientName({ fullName: "SERG", username: null }, "Морозов С.А.")).toBe("SERG");
    expect(resolveReportClientName({ fullName: null, username: "vsem_longboard" }, null)).toBe("@vsem_longboard");
    expect(resolveReportClientName({ fullName: null, username: null }, "Максим Зефиров")).toBe("Максим Зефиров");
    expect(resolveReportClientName(null, null)).toBeNull();
    expect(resolveReportClientName({ fullName: "   ", username: "" }, "  ")).toBeNull();
  });

  it("mskDateTime: +03:00 fixed offset, ISO with fraction", () => {
    expect(mskDateTime("2026-09-24T06:54:31.34082+00:00")).toBe("24.09.2026 09:54");
    expect(mskDateTime(null)).toBe("—");
    expect(mskDateTime("garbage")).toBe("—");
  });

  it("table cells sanitize pipes and newlines", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        { rentalId: "a", status: "completed", paymentStatus: "fully_paid", totalCost: 1000, agreedStart: "2026-09-01T10:00:00+00:00", agreedEnd: "2026-09-01T12:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-01T09:00:00+00:00", clientName: "A|B\nC" },
      ],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("| A/B C |");
    expect(out.markdown.includes("A|B")).toBe(false);
  });
});

// ── 5. month scope + size cap + header sanitization ──────────────────────

describe("bike-rentals-report: month scope, cap, sanitization", () => {
  const SEP = "2026-09";

  it("month scope: title «Аренды за сентябрь 2026», only that MSK month's rows, month filename", () => {
    const rows: BikeReportRentalRow[] = [
      ...r6Rows(), // 29.08, 11.09, 24.09 — only the last two are September
      {
        rentalId: "aug-only",
        status: "completed",
        paymentStatus: "fully_paid",
        totalCost: 999,
        agreedStart: "2026-08-30T10:00:00+00:00",
        agreedEnd: "2026-08-30T12:00:00+00:00",
        requestedStart: null,
        requestedEnd: null,
        createdAt: "2026-08-30T09:00:00+00:00",
        clientName: "Aug",
      },
    ];
    const out = buildBikeRentalsReport({ bikeLabel: "Yamaha R6", bikeId: "yamaha-r6-2007", crewName: "VIP_BIKE", rentals: rows, month: SEP, nowMs: NOW });
    expect(out.markdown).toContain("# Аренды за сентябрь 2026 — Yamaha R6");
    expect(out.markdown).not.toContain("за всё время");
    expect(out.markdown).toContain("- Всего аренд: **2**");
    expect(out.markdown).not.toContain("SERG"); // Aug row filtered out
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **17 500 ₽**");
    expect(out.filename).toBe("rentals_yamaha-r6-2007_2026-09.md");
  });

  it("unknown statuses stay in the summary (breakdown sums to the total)", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      rentals: [
        { rentalId: "a", status: "completed", paymentStatus: null, totalCost: 1000, agreedStart: "2026-09-01T10:00:00+00:00", agreedEnd: "2026-09-01T12:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-01T09:00:00+00:00", clientName: "A" },
        { rentalId: "b", status: "weird_status", paymentStatus: null, totalCost: 1000, agreedStart: "2026-09-02T10:00:00+00:00", agreedEnd: "2026-09-02T12:00:00+00:00", requestedStart: null, requestedEnd: null, createdAt: "2026-09-02T09:00:00+00:00", clientName: "B" },
      ],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("- Всего аренд: **2**");
    expect(out.markdown).toContain("  - Завершена: 1");
    expect(out.markdown).toContain("  - weird_status: 1");
  });

  it("size cap: >1000 rows keeps the NEWEST 1000 + a truncation note", () => {
    const rows: BikeReportRentalRow[] = Array.from({ length: 1005 }, (_, i) => ({
      rentalId: `r${String(i).padStart(4, "0")}`,
      status: "completed",
      paymentStatus: "fully_paid",
      totalCost: 100,
      agreedStart: `2026-${String(1 + (i % 9)).padStart(2, "0")}-01T10:00:00+00:00`,
      agreedEnd: `2026-${String(1 + (i % 9)).padStart(2, "0")}-02T10:00:00+00:00`,
      requestedStart: null,
      requestedEnd: null,
      createdAt: `2026-${String(1 + (i % 9)).padStart(2, "0")}-01T09:00:00+00:00`,
      clientName: `C${i}`,
    }));
    const out = buildBikeRentalsReport({ bikeLabel: "X", bikeId: "x", crewName: "C", rentals: rows, nowMs: NOW });
    expect(out.markdown).toContain("_Показаны последние 1000 аренд — всего 1005, более старые усечены._");
    expect(out.markdown).toContain("- Всего аренд: **1000**");
    expect(out.markdown).toContain("rental_r1004"); // newest kept
    expect(out.markdown).not.toContain("rental_r0000"); // oldest cut
  });

  it("header lines sanitize newlines/backticks from crew-controlled labels", () => {
    const out = buildBikeRentalsReport({ bikeLabel: "Yamaha\n# HAX", bikeId: "yamaha`r6", crewName: "VIP_BIKE", rentals: [], nowMs: NOW });
    const first = out.markdown.split("\n")[0];
    expect(first).toBe("# Аренды за всё время — Yamaha # HAX");
    expect(out.markdown).toContain("- Байк: `yamaha'r6` (VIP BIKE)");
  });
});

// ── 6. empty history ─────────────────────────────────────────────────────────

describe("bike-rentals-report: empty history", () => {
  it("renders a graceful zero report without links section", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "New Bike",
      bikeId: "new-bike",
      crewName: "VIP_BIKE",
      rentals: [],
      nowMs: NOW,
    });
    expect(out.markdown).toContain("# Аренды за всё время — New Bike");
    expect(out.markdown).toContain("- Всего аренд: **0**");
    expect(out.markdown).toContain("- Период данных: —");
    expect(out.markdown).toContain("Аренд пока не было.");
    expect(out.markdown).not.toContain("## Ссылки на аренды");
    expect(out.markdown).toContain("- Средний чек: **—**");
  });
});

// ── 6. source guards ─────────────────────────────────────────────────────────

describe("bike-rentals-report: source guards", () => {
  const action = read(`${APP}/server-actions/bike-wall.ts`);
  const wall = read(`${APP}/[slug]/bikes/BikesWallClient.tsx`);
  const button = read(`${APP}/[slug]/bikes/BikeReportButton.tsx`);

  it("server action exists and reuses the wall access gate (not a weaker check)", () => {
    expect(action).toContain("export async function getBikeRentalsReportAction");
    const gateCount = action.match(/resolveBikeWallAccess\(params\)/g)?.length ?? 0;
    expect(gateCount).toBeGreaterThanOrEqual(3); // wall + story + report
  });

  it("report action scopes the bike to the crew and type=bike (no cross-crew leaks)", () => {
    const reportIdx = action.indexOf("getBikeRentalsReportAction");
    const reportBody = action.slice(reportIdx);
    expect(reportBody).toContain('.eq("id", bikeId)');
    expect(reportBody).toContain('.eq("crew_id", crewId)');
    expect(reportBody).toContain('.eq("type", "bike")');
    // subrenter scope, same as the story action
    expect(reportBody).toContain("subrenterVehicleIds.includes");
    // service-work rows (vehicle_id = svc price item) can't sneak in
    expect(reportBody).toContain('.eq("vehicle_id", bikeId)');
    expect(reportBody).not.toContain("metadata->>bike");
  });

  it("client names: users.full_name wins over metadata.renter_name (boss samples)", () => {
    const reportIdx = action.indexOf("getBikeRentalsReportAction");
    const reportBody = action.slice(reportIdx);
    expect(reportBody).toContain('from("users")');
    expect(reportBody).toContain("resolveReportClientName");
  });

  it("the wall renders the report button with the same auth as the wall fetch", () => {
    expect(wall).toContain("BikeReportButton");
    expect(wall).toContain("actorUserId={getActorUserId() || undefined}");
    expect(wall).toContain("isPasswordAuth={!!passwordAuthOwnerId}");
  });

  it("the button never nests inside the card Link (sibling overlay, not <a><button>)", () => {
    // The photo section opens the button as a SIBLING of the underlay Link:
    expect(wall).toContain("className=\"absolute bottom-2 right-2 z-10\"");
    // and the card root is a plain div, not the Link itself:
    expect(wall).not.toContain('className="group block overflow-hidden rounded-2xl border transition active:scale-[0.985]"');
    expect(wall).toContain('className="group overflow-hidden rounded-2xl border transition active:scale-[0.985]"');
  });

  it("deep links resolve the bot via the crew-bot chain (prod has NO TELEGRAM_BOT_USERNAME env)", () => {
    const reportIdx = action.indexOf("getBikeRentalsReportAction");
    const reportBody = action.slice(reportIdx);
    expect(reportBody).toContain("resolveCrewBotUsername(params.slug)");
    expect(reportBody).toContain("platformBotUsername()");
    expect(reportBody).not.toContain('process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"');
  });

  it("month selector pipes through wall → card → button → action (numbers never contradict)", () => {
    expect(wall).toContain("month={month}");
    expect(button).toContain("month?: string | null");
    const reportIdx = action.indexOf("getBikeRentalsReportAction");
    const reportBody = action.slice(reportIdx);
    expect(reportBody).toContain("normalizeMonthParam(params.month)");
  });

  it("the button: initData, blob download, Telegram-gated clipboard, hit-area, failed state", () => {
    expect(button).toContain("getBikeRentalsReportAction");
    expect(button).toContain("getTelegramInitData()");
    expect(button).toContain("createObjectURL");
    expect(button).toContain('type: "text/markdown;charset=utf-8"');
    // clipboard fallback gated on the Telegram WebView + size guard
    expect(button).toContain("isTelegramWebView()");
    expect(button).toContain("CLIPBOARD_MAX_CHARS");
    expect(button).toContain("navigator.clipboard.writeText");
    // hit-area pad + focus ring + failure feedback
    expect(button).toContain("-inset-x-3 -inset-y-2.5");
    expect(button).toContain("focus-visible:outline-2");
    expect(button).toContain("failed ? (");
    expect(button).toContain("e.stopPropagation()");
    // unmount cleanup for the reset timer
    expect(button).toContain("clearTimeout(resetTimer.current)");
  });
});
