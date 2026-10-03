// subrenter-month-report — «Отчёт партнёру» (2026-10-03, boss: «add "total
// for subrenter excluding equipment" report in subrenter's profile,
// subrenter's section in admin franchize page and in motopark»).
//
// What this suite locks in:
//   1. The headline line the boss asked for: «Итого партнёру (N% от мото,
//      без экипировки): X» — pct% of the BIKE part only.
//   2. Money discipline identical to the Мотопарк report: stored split wins,
//      legacy rows get the duration-aware gear estimate (with «*»), linked
//      mirror rows are «выдача экипа» with no money, standalone gear rows are
//      gear revenue (partner cut 0), cancelled rows are listed but never earn.
//   3. The SAME numbers flow through the stats object (toast/future surfaces).
//   4. Wiring guards: the server action (self + admin modes), the shared
//      delivery chain (report-file-delivery) and all three surfaces (profile
//      panel, admin overview, admin page, motopark story KPI).
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  buildSubrenterMonthReport,
  type SubrenterReportRentalRow,
} from "@/app/franchize/lib/subrenter-month-report";
const read = (p: string) => readFileSync(p, "utf-8");
const APP = "app/franchize";

const NOW = Date.parse("2026-10-03T11:00:00+00:00");
const MSK_MONTH = "2026-09";

function srow(over: Partial<SubrenterReportRentalRow>): SubrenterReportRentalRow {
  return {
    rentalId: "r",
    bikeId: "kawasaki-ex650k",
    bikeLabel: "Kawasaki EX650K",
    status: "completed",
    paymentStatus: "fully_paid",
    totalCost: 10000,
    agreedStart: "2026-09-15T11:00:00+00:00",
    agreedEnd: "2026-09-16T11:00:00+00:00",
    requestedStart: null,
    requestedEnd: null,
    createdAt: "2026-09-15T11:00:25+00:00",
    clientName: "Клиент",
    metadata: null,
    ...over,
  };
}

// ── 1. golden month: every money shape in one report ─────────────────────────

describe("subrenter-month-report: golden September (all money shapes)", () => {
  const out = buildSubrenterMonthReport({
    partnerLabel: "Александр Корнилов (@K0r_Al)",
    partnerChatId: "425137783",
    crewName: "VIP_BIKE",
    month: MSK_MONTH,
    bikeLabels: ["Kawasaki EX650K"],
    pct: 50,
    nowMs: NOW,
    rentals: [
      // stored split: 11 500 = 10 000 moto + 1 500 gear → 5 000 partner
      srow({
        rentalId: "734e63c5",
        totalCost: 11500,
        clientName: "Салин Роман Анатольевич",
        metadata: { bike_price: 10000, equipment_price: 1500, subrenter_chat_id: "425137783" },
      }),
      // the 2026-10-03 fixed row: rent 10 000 (was overridden 15 000), gear 0
      srow({
        rentalId: "910a54c9",
        agreedStart: "2026-09-15T11:00:00+00:00",
        agreedEnd: "2026-09-16T11:00:00+00:00",
        totalCost: 10000,
        clientName: "Скворцов Сергей Аркадьевич.",
        metadata: { bike_price: 10000, equipment_price: 0, subrenter_chat_id: "425137783" },
      }),
      // cancelled: listed, never earns
      srow({
        rentalId: "c68db454",
        status: "cancelled",
        paymentStatus: "pending",
        totalCost: 10000,
        clientName: "Наталья Удалова",
        metadata: {},
      }),
      // legacy row WITHOUT a stored split: 3h window + helmet + gloves →
      // duration-aware estimate 500 + 250 = 750 gear, bike 7 750
      srow({
        rentalId: "legacy-3h",
        agreedStart: "2026-09-20T09:00:00+00:00",
        agreedEnd: "2026-09-20T12:00:00+00:00",
        totalCost: 8500,
        clientName: "Илья I.O.S.",
        metadata: { equipment: { helmets: 1, gloves: 1 } },
      }),
      // linked gear mirror: inventory echo, zero money
      srow({
        rentalId: "mirror",
        totalCost: 1000,
        metadata: { item_type: "equipment", primary_rental_id: "734e63c5", equipment: { helmets: 1 } },
      }),
      // standalone gear rental: whole total is gear, partner cut 0
      srow({
        rentalId: "gear-only",
        totalCost: 1500,
        metadata: { item_type: "equipment", equipment: { helmets: 1 } },
      }),
    ],
  });

  it("header carries partner, bikes, crew and the MSK month title", () => {
    expect(out.markdown).toContain("# Отчёт партнёру — Сентябрь 2026");
    expect(out.markdown).toContain("- Партнёр: Александр Корнилов (@K0r_Al) (id 425137783)");
    expect(out.markdown).toContain("- Байки: Kawasaki EX650K");
    expect(out.markdown).toContain("- Экипаж: VIP BIKE");
  });

  it("summary: revenue split moto/gear + THE boss line «Итого партнёру (без экипировки)»", () => {
    expect(out.markdown).toContain("- Всего аренд: **6**");
    expect(out.markdown).toContain("  - Завершена: 5");
    expect(out.markdown).toContain("  - Отменена: 1");
    // 11500 + 10000 + 8500 + 1500 (mirror row contributes nothing)
    expect(out.markdown).toContain("- Оборот (завершённые + активные): **31 500 ₽**");
    // 10000 + 10000 + 7750 + 0
    expect(out.markdown).toContain("  - в т.ч. аренда мото: **27 750 ₽**");
    // 1500 + 0 + 750 + 1500
    expect(out.markdown).toContain("  - в т.ч. экипировка: **3 750 ₽** (не делится — остаётся экипажу)");
    // 5000 + 5000 + 3875 + 0
    expect(out.markdown).toContain("- Итого партнёру (50% от мото, без экипировки): **13 875 ₽**");
  });

  it("table: Мот/Экип/Итого/Партнёру columns with estimate footnote and mirror echo", () => {
    expect(out.markdown).toContain("| # | Байк | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Мот | Экип | Итого | Партнёру 50% |");
    expect(out.markdown).toContain("| 10 000 ₽ | 1 500 ₽ | 11 500 ₽ | 5 000 ₽ |");
    expect(out.markdown).toContain("| 10 000 ₽ | — | 10 000 ₽ | 5 000 ₽ |");
    expect(out.markdown).toContain("| 7 750 ₽ | 750 ₽* | 8 500 ₽ | 3 875 ₽ |");
    expect(out.markdown).toContain("| — | 1 500 ₽ | 1 500 ₽ | — |");
    expect(out.markdown).toContain("| выдача экипа |");
    expect(out.markdown).toContain("⚪️ Отменена");
    expect(out.markdown).toContain(
      "_Экипировка со «*» — оценка по прайсу за срок аренды (в строке нет сохранённой разбивки мот/экип)._",
    );
  });

  it("deep links + filename stamp", () => {
    expect(out.markdown).toContain("https://t.me/oneBikePlsBot/app?startapp=rental_910a54c9");
    expect(out.filename).toBe("subrenter-report_425137783_2026-09.md");
  });

  it("stats object matches the printed summary", () => {
    expect(out.stats).toEqual({
      totalRentals: 6,
      earningRentals: 4,
      revenueRub: 31500,
      bikeRub: 27750,
      gearRub: 3750,
      partnerRub: 13875,
    });
  });
});

// ── 2. contract pct passthrough ──────────────────────────────────────────────

describe("subrenter-month-report: pct passthrough", () => {
  const out = buildSubrenterMonthReport({
    partnerLabel: "Партнёр",
    partnerChatId: "425137783",
    crewName: "VIP_BIKE",
    month: MSK_MONTH,
    bikeLabels: ["Kawasaki EX650K"],
    pct: 70,
    nowMs: NOW,
    rentals: [
      srow({ totalCost: 10000, metadata: { bike_price: 10000, equipment_price: 0, subrenter_chat_id: "425137783" } }),
    ],
  });
  it("partner cut follows the contract pct (70% of the bike part)", () => {
    expect(out.markdown).toContain("- Итого партнёру (70% от мото, без экипировки): **7 000 ₽**");
    expect(out.markdown).toContain("| Партнёру 70% |");
    expect(out.stats.partnerRub).toBe(7000);
  });
});

// ── 3. empty month ───────────────────────────────────────────────────────────

describe("subrenter-month-report: empty month", () => {
  const out = buildSubrenterMonthReport({
    partnerLabel: "Партнёр",
    partnerChatId: "42",
    crewName: "VIP_BIKE",
    month: MSK_MONTH,
    bikeLabels: ["Kawasaki EX650K"],
    pct: 50,
    nowMs: NOW,
    rentals: [],
  });
  it("zero everything, honest empty state", () => {
    expect(out.markdown).toContain("Аренд за этот месяц не было.");
    expect(out.markdown).toContain("- Оборот (завершённые + активные): **0 ₽**");
    expect(out.markdown).toContain("- Итого партнёру (50% от мото, без экипировки): **0 ₽**");
    expect(out.stats).toEqual({
      totalRentals: 0,
      earningRentals: 0,
      revenueRub: 0,
      bikeRub: 0,
      gearRub: 0,
      partnerRub: 0,
    });
  });
});

// ── 4. wiring guards — the same math and wording everywhere the boss asked ───

describe("subrenter-month-report: surfaces wiring", () => {
  const action = read(APP + "/server-actions/subrenter-monitoring.ts");
  const delivery = read(APP + "/lib/report-file-delivery.ts");
  const myBikes = read(APP + "/[slug]/profile/components/SubrenterMyBikesPanel.tsx");
  const overview = read(APP + "/[slug]/profile/components/SubrentersOverviewPanel.tsx");
  const manager = read(APP + "/components/SubrenterManagerPanel.tsx");
  const story = read(APP + "/[slug]/bikes/[bikeId]/BikeStoryClient.tsx");
  const wall = read(APP + "/server-actions/bike-wall.ts");
  const bikeReport = read(APP + "/lib/bike-rentals-report.ts");
  const button = read(APP + "/components/SubrenterReportButton.tsx");

  it("server action: SELF (verified actor) + ADMIN (canManageSubrenters + chatId) modes", () => {
    expect(action).toContain("getSubrenterMonthReportAction");
    expect(action).toContain("buildSubrenterMonthReport");
    expect(action).toContain("canManageSubrenters");
    expect(action).toContain("resolveServerActorUserId");
  });

  it("one delivery chain: the subrenter button reuses the Мотопарк forward/download recipe", () => {
    expect(delivery).toContain("export async function deliverReportFile");
    expect(read(APP + "/[slug]/bikes/BikeReportButton.tsx")).toContain("deliverReportFile");
    expect(button).toContain("deliverReportFile");
    expect(button).toContain("getSubrenterMonthReportAction");
  });

  it("subrenter profile panel: explicit «итого вам (без экипировки)» + self-mode button", () => {
    expect(myBikes).toContain("итого вам за месяц (без экипировки)");
    expect(myBikes).toContain("<SubrenterReportButton");
    expect(myBikes).toContain("actorUserId={userId}");
  });

  it("admin subrenter section: grand total + per-partner «итого партнёру» + report button", () => {
    expect(overview).toContain("Итого партнёрам за месяц (без экипировки)");
    expect(overview).toContain("итого партнёру");
    expect(overview).toContain('chatId={s.chatId}');
  });

  it("admin franchize page: monthly report block next to the weekly one", () => {
    expect(manager).toContain("Месячный отчёт партнёру (итого без экипировки)");
    expect(manager).toContain("getSubrenterMonthReportAction");
  });

  it("motopark story: «Партнёру N%» KPI (scope + all-time) and reworded report line", () => {
    expect(wall).toContain("partnerTotals");
    expect(story).toContain("partnerTotals");
    expect(story).toContain("без экипировки");
    expect(bikeReport).toContain("- Итого партнёру (");
  });
});
