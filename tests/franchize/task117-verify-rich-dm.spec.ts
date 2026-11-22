// Task 117 — RICH VERIFICATION DM + OPERATOR SCORE + IDEAL ACHIEVEMENTS
// + КОПИЛКА КОМАНДЫ.
//
// Boss 2026-10-21: the сверка DM must explain ITSELF — rental window, photo,
// the coefficient legend, the full «откуда цифры» formula (each day, the
// multi-day tier rates, the gear baseline, the 10% markup) — so the operator
// presses ✅ from the message alone. Add the money game: a running operator
// score (подтверждённые бонусы → копилка) shown in the DM; «идеальная» аренда
// (пробег до/после + фото до/после) as separate achievements; and the owner's
// profile shows the team piggy bank with mark-as-paid entries.
//
// Pinned invariants (money-surface discipline):
//   • the formula block is digit-equal with computeRentalSalary's inputs —
//     one canon (standardRentalPrice delegates to standardRentalPriceDetailed);
//   • the score uses the SAME commission math as the payout hub (commissionOf);
//   • profile counters are SET absolutely (the «731 смены» lesson) — badge
//     grants carry NO incrementCounters deltas;
//   • ideal closure = odometer before/after AND photos before/after (boss's
//     definition), with SEPARATE badges for each component;
//   • old rows without the task117 fields degrade to the classic DM;
//   • the crew ledger skips single-party rows (boss's own cash);
//   • marking payouts from the profile is owner-tier gated server-side.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  auditGradeLine,
  bikeTierLabelRu,
  escapeVerifyHtml,
  formatMskShort,
  formatRubVerify,
  formatVerificationSummary,
  type RentalVerificationSnapshot,
} from "@/app/franchize/lib/rental-verify-core";
import {
  buildCrewPayoutLedger,
  parsePayoutInfo,
  type PayoutSourceRow,
} from "@/app/franchize/lib/rental-payout-core";
import {
  daysLabelRu,
  equipmentStandardLines,
  hoursLabelRu,
  type RentalEquipment,
} from "@/lib/salary-coefficients-shared";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

const UUID = "7c0f6a7e-6d59-4d13-9a41-0f3b2c1d4e5f";
const OP = "100200300"; // synthetic fixture (no real ids in repo)
const OWNER = "400500600"; // synthetic fixture

const rub = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n)} ₽`;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function baseSnapshot(overrides: Partial<RentalVerificationSnapshot> = {}): RentalVerificationSnapshot {
  return {
    bikeName: "Honda CBR 600RR",
    rentalCategory: "regular",
    rentalCategoryLabel: "Обычные",
    totalCost: 48000,
    base: 1000,
    equipment: 400,
    overprice: 150,
    total: 1550,
    equipmentUnits: 2,
    equipmentFlags: "1шл+курт",
    overpricePercent: 10,
    depositReturned: true,
    damageNotes: null,
    returnNotes: null,
    penalty: null,
    attribution: {
      source: "request",
      createdByChatId: OP,
      handedByChatId: OP,
      returnedByChatId: OP,
    },
    requestedAtIso: "2026-10-21T09:00:00.000Z",
    ...overrides,
  };
}

function richSnapshot(): RentalVerificationSnapshot {
  return baseSnapshot({
    rentalWindow: {
      startIso: "2026-10-12T15:30:00+03:00",
      endIso: "2026-10-18T15:30:00+03:00",
      hours: 144,
      days: 6,
      durationLabel: "6 суток",
    },
    formula: {
      fallback: false,
      bikeStandard: 45000,
      bikeTierLabel: "тариф 2–4 дня",
      bikeRate: 7500,
      bikeDays: 6,
      bikeHours: 144,
      gearLines: ["1 шлем — 1000 ₽", "куртка — 500 ₽"],
      gearStandard: 1500,
      standardTotal: 46500,
      clientTotal: 48000,
      markup: 1500,
      baseCoef: 1000,
      equipmentUnitCoef: 200,
      overpricePercent: 10,
    },
    bikePhotoUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/demo.jpg",
    audit: { grade: "fine", notes: [] },
  });
}

function summaryOf(snapshot: RentalVerificationSnapshot, score?: { sum: number; count: number } | null): string {
  return formatVerificationSummary({
    crewName: "vip-bike",
    snapshot,
    usersMap: new Map([[OP, { username: "djorudjov", full_name: "D" }], [OWNER, { username: "ilya", full_name: "I" }]]),
    operatorChatId: OP,
    ownerChatId: OWNER,
    statusNote: "Ждёт подтверждения: @djorudjov (оператор) и @ilya (владелец).",
    operatorScore: score,
  });
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe("task117 · msk short format", () => {
  it("formats an ISO timestamp as dd.MM HH:mm in Europe/Moscow", () => {
    // 15:30 MSK stays 15:30 regardless of the runner's TZ.
    expect(formatMskShort("2026-10-12T15:30:00+03:00")).toBe("12.10 15:30");
  });

  it("returns empty for null/garbage (degradation)", () => {
    expect(formatMskShort(null)).toBe("");
    expect(formatMskShort("not-a-date")).toBe("");
  });
});

describe("task117 · tier + duration labels", () => {
  it("maps multi-day tiers to the crew's vocabulary", () => {
    expect(bikeTierLabelRu("multi-day-2-4", 6, 144)).toBe("тариф 2–4 дня");
    expect(bikeTierLabelRu("multi-day-5-10", 7, 168)).toBe("тариф 5–10 дней");
    expect(bikeTierLabelRu("multi-day-11-30", 12, 288)).toBe("тариф 11–30 дней");
    expect(bikeTierLabelRu("daily", 1, 24)).toBe("суточный тариф");
    expect(bikeTierLabelRu("hourly", 0, 5)).toBe("почасовой тариф");
  });

  it("ru plurals: сутки/часов shapes", () => {
    expect(daysLabelRu(1)).toBe("1 сутки");
    expect(daysLabelRu(6)).toBe("6 суток");
    expect(daysLabelRu(21)).toBe("21 сутки");
    expect(hoursLabelRu(1)).toBe("1 час");
    expect(hoursLabelRu(5)).toBe("5 часов");
    expect(hoursLabelRu(21)).toBe("21 час");
  });
});

describe("task117 · standard gear lines (digit-equal with the baseline)", () => {
  it("produces per-unit lines digit-equal with the standard baseline", () => {
    // Baseline canon (equipmentStandardCost, server half): helmets 1000,
    // everything else 500, charger free. Expected: 2×1000 + 500 + 500 + 500.
    const eq: RentalEquipment = { helmets: 2, gloves: 1, jacket: true, boots: true, charger: true };
    const lines = equipmentStandardLines(eq);
    const sum = lines.reduce((s, l) => s + l.sum, 0);
    expect(sum).toBe(3500);
    expect(lines.map((l) => l.label)).toEqual(["2 шлема", "1 пара перчаток", "1 куртка", "1 бот"]);
    // charger is free — never priced
    expect(lines.some((l) => l.label.includes("заряд"))).toBe(false);
  });

  it("empty gear → no lines, zero cost", () => {
    expect(equipmentStandardLines({})).toEqual([]);
    expect(equipmentStandardLines(null)).toEqual([]);
  });
});

describe("task117 · audit grade line", () => {
  it("fine grade → clean badge, no notes", () => {
    expect(auditGradeLine({ grade: "fine", notes: [] })).toBe("🧾 Аудит: ✅ всё чисто");
  });

  it("almost/sus grades surface up to two notes (escaped)", () => {
    const line = auditGradeLine({ grade: "almost", notes: ["нет пробега после", "нет депозита", "лишняя заметка"] });
    expect(line).toContain("⚠️ есть замечания");
    expect(line).toContain("нет пробега после; нет депозита");
    expect(line).not.toContain("лишняя заметка");
    const sus = auditGradeLine({ grade: "sus", notes: ["<b>injection</b>"] });
    expect(sus).toContain("🚨 подозрительно");
    expect(sus).not.toContain("<b>");
    expect(sus).toContain(escapeVerifyHtml("<b>injection</b>"));
  });

  it("no audit stamp → no line (pre-task114 rows degrade)", () => {
    expect(auditGradeLine(undefined)).toBeNull();
  });
});

// ── The rich DM ──────────────────────────────────────────────────────────────

describe("task117 · rich verification DM", () => {
  it("renders the rental window (dates + duration) and the formula block", () => {
    const text = summaryOf(richSnapshot());
    expect(text).toContain("📅 12.10 15:30 → 18.10 15:30 · 6 суток");
    expect(text).toContain("🧮 <b>Откуда цифры</b>");
    expect(text).toContain(`  🏍 мот: 6 суток × ${rub(7500)} (тариф 2–4 дня) = ${rub(45000)}`);
    expect(text).toContain(`  🧰 экип по прайсу: 1 шлем — 1000 ₽ · куртка — 500 ₽ = ${rub(1500)}`);
    expect(text).toContain(`  ↳ эталон: ${rub(46500)} · клиент: ${rub(48000)} → наценка ${rub(1500)}`);
    expect(text).toContain(`  ↳ наценка: ${rub(1500)} × 10% = ${rub(150)}`);
    // The coefficient legend (the boss's «легенда текущих коэффициентов»)
    expect(text).toContain(`  📜 коэф.: мот ${rub(1000)}/аренда · экип ${rub(200)}/ед · наценка 10%`);
    // The customer-side pricing legend (gear halves from day 2)
    expect(text).toContain("экип клиенту: 1-е сутки полная цена, дальше — половина");
    // The frozen audit stamp
    expect(text).toContain("🧾 Аудит: ✅ всё чисто");
  });

  it("renders the operator score line when provided", () => {
    const text = summaryOf(richSnapshot(), { sum: 45300, count: 31 });
    expect(text).toContain(`🏅 Счёт @djorudjov: <b>${rub(45300)}</b> подтверждено (31 ар.)`);
  });

  it("hourly rentals show the hour math instead of days", () => {
    const snap = baseSnapshot({
      rentalWindow: { startIso: "2026-10-12T15:00:00+03:00", endIso: "2026-10-12T20:00:00+03:00", hours: 5, days: 0, durationLabel: "5 часов" },
      formula: {
        fallback: false,
        bikeStandard: 3750,
        bikeTierLabel: "почасовой тариф",
        bikeRate: 750,
        bikeDays: 0,
        bikeHours: 5,
        gearLines: [],
        gearStandard: 0,
        standardTotal: 3750,
        clientTotal: 3750,
        markup: 0,
        baseCoef: 1000,
        equipmentUnitCoef: 200,
        overpricePercent: 10,
      },
    });
    const text = summaryOf(snap);
    expect(text).toContain(`  🏍 мот: 5 ч × ${rub(750)} = ${rub(3750)}`);
    expect(text).toContain("🧰 экип по прайсу: нет");
  });

  it("degrades to the classic DM for pre-task117 rows (no formula/window/score)", () => {
    const text = summaryOf(baseSnapshot());
    expect(text).not.toContain("Откуда цифры");
    expect(text).not.toContain("📅");
    expect(text).not.toContain("🏅 Счёт");
    // The classic 3-line breakdown survives untouched
    expect(text).toContain(`📊 <b>Комиссия оператора: ${rub(1550)}</b>`);
    expect(text).toContain(`  • техника (Обычные): +${rub(1000)}`);
    expect(text).toContain(`  • экипировка (1шл+курт): +${rub(400)}`);
    expect(text).toContain(`  • наценка (10%): +${rub(150)}`);
  });

  it("fallback formula (no usable dates/specs) hides the «откуда цифры» block — markup is 0 by design", () => {
    const snap = baseSnapshot({
      formula: {
        fallback: true,
        bikeStandard: 48000,
        bikeTierLabel: null,
        bikeRate: null,
        bikeDays: 0,
        bikeHours: 0,
        gearLines: [],
        gearStandard: 0,
        standardTotal: 48000,
        clientTotal: 48000,
        markup: 0,
        baseCoef: 1000,
        equipmentUnitCoef: 200,
        overpricePercent: 10,
      },
    });
    expect(summaryOf(snap)).not.toContain("Откуда цифры");
  });

  it("formatRubVerify groups thousands the ru way (the NBSP lesson)", () => {
    expect(formatRubVerify(45300)).toBe(rub(45300));
  });
});

// ── КОПИЛКА КОМАНДЫ (crew ledger, pure half) ─────────────────────────────────

function payoutRow(overrides: Partial<PayoutSourceRow> = {}): PayoutSourceRow {
  return {
    rental_id: UUID,
    crew_slug: "vip-bike",
    status: "verified",
    operator_chat_id: OP,
    owner_chat_id: OWNER,
    requested_at: "2026-10-17T09:16:00.000Z",
    verified_at: "2026-10-17T10:00:00.000Z",
    snapshot: { bikeName: "BMW F800R", totalCost: 6500, base: 500, equipment: 250, overprice: 150, total: 900 },
    ...overrides,
  };
}

describe("task117 · crew payout ledger", () => {
  const labelOf = (id: string | null | undefined) => (id === OP ? "@djorudjov" : id === OWNER ? "@ilya" : String(id ?? "—"));

  it("buckets crew money: к выплате / выплачено / не сверено", () => {
    const view = buildCrewPayoutLedger(
      [
        payoutRow(), // verified, unpaid → toPay 900
        payoutRow({
          rental_id: "aaaaaaaa-0000-0000-0000-000000000001",
          payout: { operator: { marked: true, at: "2026-10-18T12:00:00.000Z", by: OWNER }, log: [] },
        }), // verified, paid → paid 900
        payoutRow({ rental_id: "aaaaaaaa-0000-0000-0000-000000000002", status: "pending" }), // unverified 900
      ],
      { crewSlug: "vip-bike", labelOf },
    );
    expect(view.totals.toPay).toEqual({ sum: 900, count: 1 });
    expect(view.totals.paid).toEqual({ sum: 900, count: 1 });
    expect(view.totals.unverified).toEqual({ sum: 900, count: 1 });
    expect(view.unpaid).toHaveLength(1);
    expect(view.paidLog).toHaveLength(1);
    expect(view.paidLog[0].markedAt).toBe("2026-10-18T12:00:00.000Z");
    expect(view.paidLog[0].markedByLabel).toBe("@ilya");
  });

  it("aggregates per-operator piggy banks (the score per human)", () => {
    const view = buildCrewPayoutLedger(
      [
        payoutRow(),
        payoutRow({ rental_id: "aaaaaaaa-0000-0000-0000-000000000003", snapshot: { bikeName: "X", total: 700 } }),
      ],
      { crewSlug: "vip-bike", labelOf },
    );
    expect(view.operators).toHaveLength(1);
    expect(view.operators[0]).toMatchObject({
      chatId: OP,
      label: "@djorudjov",
      verifiedSum: 1600,
      verifiedCount: 2,
      toPaySum: 1600,
      toPayCount: 2,
      paidSum: 0,
      paidCount: 0,
    });
  });

  it("single-party rows never enter the crew ledger (boss's own cash)", () => {
    const view = buildCrewPayoutLedger([payoutRow({ operator_chat_id: OWNER })], { crewSlug: "vip-bike", labelOf });
    expect(view.operators).toEqual([]);
    expect(view.unpaid).toEqual([]);
    expect(view.totals.toPay).toEqual({ sum: 0, count: 0 });
  });

  it("an agreed (corrected) split is the ledger money", () => {
    const view = buildCrewPayoutLedger(
      [payoutRow({ negotiation: { agreed: { split: { base: 400, equipment: 250, overprice: 100 }, proposedBy: OP, acceptedBy: OWNER, at: "2026-10-17T10:00:00Z" } } })],
      { crewSlug: "vip-bike", labelOf },
    );
    expect(view.totals.toPay.sum).toBe(750);
    expect(view.unpaid[0].adjusted).toBe(true);
  });

  it("paidLog caps at 50 newest-first (the archive stays bounded)", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      payoutRow({
        rental_id: `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, "0")}`,
        payout: { operator: { marked: true, at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), by: OWNER }, log: [] },
      }),
    );
    const view = buildCrewPayoutLedger(rows, { crewSlug: "vip-bike", labelOf });
    expect(view.paidLog).toHaveLength(50);
    // newest stamp first
    expect(Date.parse(view.paidLog[0].markedAt!)).toBeGreaterThan(Date.parse(view.paidLog[49].markedAt!));
  });

  it("parsePayoutInfo degrades garbage to unpaid", () => {
    expect(parsePayoutInfo(null).operator?.marked).toBeUndefined();
    expect(parsePayoutInfo("nope").operator?.marked).toBeUndefined();
    expect(parsePayoutInfo({ operator: { marked: true } }).operator?.marked).toBe(true);
  });
});

// ── Wiring pins (source-level, the established convention) ───────────────────

describe("task117 · wiring pins", () => {
  it("salary canon: standardRentalPrice DELEGATES to standardRentalPriceDetailed", () => {
    const s = src("lib/salary-coefficients.ts");
    expect(s).toContain("export function standardRentalPrice(");
    expect(s).toContain("return standardRentalPriceDetailed(params).price;");
    expect(s).toContain("export function standardRentalPriceDetailed(");
  });

  it("snapshot freezes formula + window + bikePhotoUrl (server half)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("vehicle:cars(id, make, model, specs, daily_price, type, crew_id, is_test_result, image_url)");
    expect(s).toContain("rentalWindow: {");
    expect(s).toContain("formula: {");
    expect(s).toContain("bikePhotoUrl: bikeImage.startsWith");
    expect(s).toContain("standardRentalPriceDetailed({");
  });

  it("the DM send loop sends the bike photo FIRST (cosmetic, separate message)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    const idx = s.indexOf("sendVerificationBikePhoto(chatId, snapshot.bikePhotoUrl");
    const idxSend = s.indexOf("await sendComplexMessage(chatId, summary, keyboard", idx);
    expect(idx).toBeGreaterThan(-1);
    expect(idxSend).toBeGreaterThan(idx);
  });

  it("the score uses the payout-hub money (TASK158: the operator's SLICE of a split) and feeds both DMs", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain('import { addressedShareAmount, commissionOf } from "./rental-payout-core";');
    expect(s).toContain("addressedShareAmount(row as never)");
    expect(s).toContain("export async function loadOperatorVerifiedScore(");
    expect(s).toContain('.eq("operator_chat_id", viewer)');
    expect(s).toContain('.eq("status", "verified")');
    // request DM + done DM both carry it
    expect(s).toContain("operatorScore,");
    expect(s).toContain("const scoreTail =");
  });

  it("staff cc receives the bike photo too (non-fatal)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("bikePhotoUrl: snapshot.bikePhotoUrl,");
    expect(s).toContain('bikePhotoUrl?: string | null;');
  });

  it("achievements: counter sync is ABSOLUTE and badge grants carry NO deltas", () => {
    const s = src("app/franchize/server-actions/rental-achievements.ts");
    expect(s).toContain("syncFranchizeCountersAction({");
    expect(s).toContain("rentalsClosed: count || 0,");
    expect(s).toContain("odometerFullClosures: docStats.odoFull,");
    expect(s).toContain("photosFullClosures: docStats.photosFull,");
    // no incrementCounters anywhere in the grant helper (the «731 смены» fix)
    expect(s).not.toContain("incrementCounters");
  });

  it("achievements: ideal = odo before/after + photos before/after, with SEPARATE badges", () => {
    const s = src("app/franchize/server-actions/rental-achievements.ts");
    expect(s).toContain('odoOk(meta?.odometer_before)');
    expect(s).toContain("Number(r.start_photo_count) > 0");
    expect(s).toContain('tryGrant("rental_odometer_full"');
    expect(s).toContain('tryGrant("rental_photo_full"');
    expect(s).toContain('tryGrant("rental_ideal_10"');
    expect(s).toContain('tryGrant("rental_ideal_closure"');
  });

  it("badge catalog registers the three new achievements", () => {
    const s = src("app/franchize/profile-actions.ts");
    expect(s).toContain('id: "rental_odometer_full"');
    expect(s).toContain('id: "rental_photo_full"');
    expect(s).toContain('id: "rental_ideal_10"');
  });

  it("BOTH closure paths feed the documentation picture", () => {
    const rentalPage = src("app/rentals/actions.ts");
    expect(rentalPage).toContain("start_photo_count, end_photo_count");
    expect(rentalPage).toContain("odometerBefore:");
    const modal = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(modal).toContain("grantRentalClosureAchievements");
    expect(modal).toContain("start_photo_count, end_photo_count");
  });

  it("the crew ledger is owner-tier gated and marks via stampRentalPayout", () => {
    const s = src("app/franchize/server-actions/rental-payout-actions.ts");
    expect(s).toContain("export async function getCrewPayoutLedgerAction(");
    expect(s).toContain("export async function markCrewPayoutAction(");
    expect(s).toContain("stampRentalPayout({");
    expect(s).toContain('if (access.isOwner !== true)');
  });

  it("the profile panel renders the ledger modal + the shifts footnote", () => {
    const s = src("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(s).toContain("getCrewPayoutLedgerAction");
    expect(s).toContain("markCrewPayoutAction");
    expect(s).toContain("Смены не сверяются");
    expect(s).toContain("Копилка команды");
  });
});
