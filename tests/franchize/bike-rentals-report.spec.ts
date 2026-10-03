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

  it("table rows: MSK dates, duration, client, status emoji, payment, мот/экип/итого split, created", () => {
    // 2026-10-03: one «Стоимость» column became Мот/Экип/Итого (boss: prices
    // must not hide equipment inside the moto price). Legacy rows without a
    // persisted split: gear 0 here → Экип «—», Мот = Итого.
    expect(out.markdown).toContain(
      "| # | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Мот | Экип | Итого | Создана |",
    );
    expect(out.markdown).toContain(
      "| 1 | 29.08.2026 15:00 → 29.08.2026 16:00 | 1 ч | SERG | 🟢 Завершена | оплачен | 3 500 ₽ | — | 3 500 ₽ | 29.08.2026 15:08 |",
    );
    expect(out.markdown).toContain(
      "| 2 | 11.09.2026 11:00 → 12.09.2026 11:00 | 1 дн | Илья I.O.S. | 🟢 Завершена | оплачен | 11 500 ₽ | — | 11 500 ₽ | 11.09.2026 11:51 |",
    );
    expect(out.markdown).toContain("| 3 | 24.09.2026 10:00 → 24.09.2026 13:00 | 3 ч | Мих |");
  });

  it("summary shows the мот/экип split behind the revenue (2026-10-03)", () => {
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **21 000 ₽**");
    expect(out.markdown).toContain("  - в т.ч. аренда мото: **21 000 ₽**");
    expect(out.markdown).toContain("  - в т.ч. экипировка: **0 ₽**");
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
      "| 2 | 27.09.2026 15:00 → 27.09.2026 18:00 | 3 ч | — | 🟡 Ожидает подтверждения | предоплата | — | — | — |",
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
    expect(out.markdown).toContain("| 2 | 02.09.2026 13:00 → 03.09.2026 13:00 | 1 дн | B | ⚪️ Отменена | — | 9 000 ₽ | — | 9 000 ₽ |");
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

// ── 7. money split columns + partner cut (2026-10-03, boss request) ──────────
//
// «we need to more precisely calculate prices for subrents and for equipment —
//  currently prices are shown including equipment and it's difficult to
//  understand to deduce subrenter's money part»
//
// The Kawasaki fixtures are REAL September 2026 vip-bike rows (kawasaki-ex650k,
// partner @K0r_Al chat 425137783): stored splits (4c01d23b), a legacy row with
// gear that now estimates by duration (ff6dbfee: helmet + jacket, 3h → 750),
// and an owner-voice override (d7e91c86 history) — the exact case the boss
// complained about.

describe("bike-rentals-report: мот/экип split + partner cut (2026-10-03)", () => {
  const NOW2 = Date.parse("2026-10-03T10:00:00+00:00");

  function row(over: Partial<BikeReportRentalRow>): BikeReportRentalRow {
    return {
      rentalId: "r",
      status: "completed",
      paymentStatus: "fully_paid",
      totalCost: 10000,
      agreedStart: "2026-09-14T09:00:00+00:00",
      agreedEnd: "2026-09-15T09:00:00+00:00",
      requestedStart: null,
      requestedEnd: null,
      createdAt: "2026-09-14T08:43:34+00:00",
      clientName: "Тест",
      metadata: null,
      ...over,
    };
  }

  it("stored split (metadata.bike_price/equipment_price) → exact Мот/Экип", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "Kawasaki EX650K (Ninja 650)",
      bikeId: "kawasaki-ex650k",
      crewName: "VIP_BIKE",
      rentals: [
        // REAL row 734e63c5: 11 500 = bike 10 000 + gear 1 500 (helmet + gloves)
        row({
          rentalId: "734e63c5",
          totalCost: 11500,
          clientName: "Салин Роман Анатольевич",
          metadata: { bike_price: 10000, equipment_price: 1500, equipment: { helmets: 1, gloves: 1 } },
        }),
      ],
      nowMs: NOW2,
    });
    expect(out.markdown).toContain(
      "| 1 | 14.09.2026 12:00 → 15.09.2026 12:00 | 1 дн | Салин Роман Анатольевич | 🟢 Завершена | оплачен | 10 000 ₽ | 1 500 ₽ | 11 500 ₽ |",
    );
    expect(out.markdown).toContain("  - в т.ч. аренда мото: **10 000 ₽**");
    expect(out.markdown).toContain("  - в т.ч. экипировка: **1 500 ₽**");
    // exact stored numbers carry NO estimate marker (cell-bounded: a bare
    // «1 500 ₽*» would false-positive inside the bold «**11 500 ₽**»)
    expect(out.markdown).toContain("| 1 500 ₽ |");
    expect(out.markdown).not.toContain("| 1 500 ₽* |");
  });

  it("legacy row with gear estimates BY DURATION: 3h helmet+jacket → 750 ₽* (was flat 1 500 ₽)", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "Kawasaki EX650K (Ninja 650)",
      bikeId: "kawasaki-ex650k",
      crewName: "VIP_BIKE",
      rentals: [
        // REAL row ff6dbfee: Sep 24 14:00→17:00 (3h), helmets 1 + jacket, no persisted split
        row({
          rentalId: "ff6dbfee",
          totalCost: 6000,
          agreedStart: "2026-09-24T14:00:00+00:00",
          agreedEnd: "2026-09-24T17:00:00+00:00",
          clientName: "Александр Медведев",
          metadata: { renter_name: "Александр Медведев", equipment: { helmets: 1, jacket: true } },
        }),
      ],
      nowMs: NOW2,
    });
    // <24h → half price: helmet 500 + jacket 250 = 750, marked as an estimate
    expect(out.markdown).toContain("| 750 ₽* | 6 000 ₽ |");
    expect(out.markdown).toContain("  - в т.ч. аренда мото: **5 250 ₽**");
    expect(out.markdown).toContain("  - в т.ч. экипировка: **750 ₽**");
    expect(out.markdown).toContain(
      "_Экипировка со «*» — оценка по прайсу за срок аренды (в строке нет сохранённой разбивки мот/экип)._",
    );
  });

  it("partner bike: «Партнёру 50%» column + «Доля партнёра» summary line (gear never splits)", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "Kawasaki EX650K (Ninja 650)",
      bikeId: "kawasaki-ex650k",
      crewName: "VIP_BIKE",
      subrent: { chatId: "425137783", pct: 50 },
      rentals: [
        row({
          rentalId: "734e63c5",
          totalCost: 11500,
          clientName: "Салин Роман Анатольевич",
          metadata: { bike_price: 10000, equipment_price: 1500, subrenter_chat_id: "425137783" },
        }),
        row({
          rentalId: "910a54c9",
          totalCost: 15000,
          clientName: "Скворцов Сергей Аркадьевич.",
          metadata: { bike_price: 15000, equipment_price: 0, subrenter_chat_id: "425137783" },
        }),
      ],
      nowMs: NOW2,
    });
    expect(out.markdown).toContain("| # | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Мот | Экип | Итого | Партнёру 50% | Создана |");
    // 10 000 bike → 5 000; 15 000 bike → 7 500
    expect(out.markdown).toContain("| 10 000 ₽ | 1 500 ₽ | 11 500 ₽ | 5 000 ₽ |");
    expect(out.markdown).toContain("| 15 000 ₽ | — | 15 000 ₽ | 7 500 ₽ |");
    expect(out.markdown).toContain("- Доля партнёра (50% от мото, экип не делится): **12 500 ₽**");
  });

  it("partner rows resolving to a DIFFERENT chat (bike changed owners) show no cut", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      subrent: { chatId: "111", pct: 50 },
      rentals: [
        row({ rentalId: "old-owner", totalCost: 10000, metadata: { bike_price: 10000, equipment_price: 0, subrenter_chat_id: "222" } }),
        row({ rentalId: "new-owner", totalCost: 10000, metadata: { bike_price: 10000, equipment_price: 0, subrenter_chat_id: "111" } }),
      ],
      nowMs: NOW2,
    });
    expect(out.markdown).toContain("| 10 000 ₽ | — | 10 000 ₽ | — |"); // old owner row
    expect(out.markdown).toContain("| 10 000 ₽ | — | 10 000 ₽ | 5 000 ₽ |"); // current owner row
    expect(out.markdown).toContain("- Доля партнёра (50% от мото, экип не делится): **5 000 ₽**");
  });

  it("linked gear mirror rows (выдача экипа) carry no money and never inflate revenue", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      subrent: { chatId: "111", pct: 50 },
      rentals: [
        row({ rentalId: "primary", totalCost: 10000, metadata: { bike_price: 9000, equipment_price: 1000 } }),
        row({
          rentalId: "mirror",
          totalCost: 1000,
          metadata: { item_type: "equipment", primary_rental_id: "primary", equipment: { helmets: 1 } },
        }),
      ],
      nowMs: NOW2,
    });
    expect(out.markdown).toContain("| выдача экипа |");
    expect(out.markdown).toContain("- Выручка (завершённые + активные): **10 000 ₽**"); // mirror NOT added
    expect(out.markdown).toContain("- Доля партнёра (50% от мото, экип не делится): **4 500 ₽**");
  });

  it("standalone gear rows (item_type=equipment): whole total is gear, partner cut 0", () => {
    const out = buildBikeRentalsReport({
      bikeLabel: "X",
      bikeId: "x",
      crewName: "C",
      subrent: { chatId: "111", pct: 50 },
      rentals: [
        row({
          rentalId: "gear-only",
          totalCost: 1500,
          metadata: { item_type: "equipment", equipment: { helmets: 1 } },
        }),
      ],
      nowMs: NOW2,
    });
    expect(out.markdown).toContain("| — | 1 500 ₽ | 1 500 ₽ | — |");
    expect(out.markdown).toContain("  - в т.ч. аренда мото: **0 ₽**");
    expect(out.markdown).toContain("  - в т.ч. экипировка: **1 500 ₽**");
  });
});

// ── 8. source guards ─────────────────────────────────────────────────────────

describe("bike-rentals-report: source guards", () => {
  const action = read(`${APP}/server-actions/bike-wall.ts`);
  const wall = read(`${APP}/[slug]/bikes/BikesWallClient.tsx`);
  const story = read(`${APP}/[slug]/bikes/[bikeId]/BikeStoryClient.tsx`);
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

  it("2026-09-27: the report row lives on the BIKE STORY page (not on the wall cards)", () => {
    // The wall-card pill was nearly cropped away on mobile and ignored the
    // month selector — it moved into the story page as a full-width row.
    expect(story).toContain("BikeReportButton");
    expect(wall).not.toContain("BikeReportButton");
  });

  it("the story page renders the report row with the same auth as the story fetch", () => {
    expect(story).toContain("actorUserId={getActorUserId() || undefined}");
    expect(story).toContain("isPasswordAuth={!!passwordAuthOwnerId}");
  });

  it("the report row is a full-width action row, not a floating overlay pill", () => {
    expect(button).toContain("flex w-full items-center justify-between");
    // scope chip — the selected range is visible BEFORE the tap
    expect(button).toContain("за всё время");
    expect(button).toContain("monthLabelRu(month)");
    // no more absolute hit-area pad over the photo
    expect(button).not.toContain("-inset-x-3 -inset-y-2.5");
  });

  it("deep links resolve the bot via the crew-bot chain (prod has NO TELEGRAM_BOT_USERNAME env)", () => {
    const reportIdx = action.indexOf("getBikeRentalsReportAction");
    const reportBody = action.slice(reportIdx);
    expect(reportBody).toContain("resolveCrewBotUsername(params.slug)");
    expect(reportBody).toContain("platformBotUsername()");
    expect(reportBody).not.toContain('process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"');
  });

  it("month selector pipes through story → button → action (numbers never contradict)", () => {
    expect(story).toContain("month={month}");
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
    // focus ring + failure feedback
    expect(button).toContain("focus-visible:outline-2");
    expect(button).toContain("failed ? (");
    expect(button).toContain("e.stopPropagation()");
    // unmount cleanup for the reset timer
    expect(button).toContain("clearTimeout(resetTimer.current)");
  });

  it("2026-09-26: inside Telegram the report is SENT to the user's chat via the forward API", () => {
    // iOS WebView silently ignores blob downloads — the chat with the bot is
    // the reliable delivery channel. The forward envelope must match
    // /api/forward-telegram: {chat_id, method, payload, files}.
    expect(button).toContain('"/api/forward-telegram"');
    expect(button).toContain('method: "sendDocument"');
    expect(button).toContain("initDataUnsafe");
    // UTF-8-safe base64 (chunked — a report can exceed the spread limit)
    expect(button).toContain("new TextEncoder().encode");
    expect(button).toContain("function utf8ToBase64");
    // download stays as the non-TG path AND the fallback when forwarding fails
    expect(button).toContain("downloadMarkdown(markdown, filename)");
    expect(button).toContain("deliveredInTg");
    // caption is HTML-escaped (parse_mode: HTML)
    expect(button).toContain("escapeHtml(bikeLabel)");
  });
});
