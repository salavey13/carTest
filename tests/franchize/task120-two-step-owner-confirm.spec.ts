// tests/franchize/task120-two-step-owner-confirm.spec.ts
//
// Task 120 (boss 2026-10-21, right after the admin buttons went live):
//
//   1. «make admin confirmation not final — it as well should wait for crew
//      owner's confirmation as well (owner's confirmation is a must always)»
//        → admin ✅ records the endorsement (negotiation.adminVerified) and
//          the row keeps waiting for the OWNER party; only when the owner
//          has ALREADY confirmed may the admin tap close the row.
//
//   2. «in case rental is less then 24 hours then comission for rental itself
//      is not 1000 but 500 for mid bikes (750 instead of 1500 for high-tier
//      bikes, and 250 instead of 500 for low tier bikes), and 100rub bonus
//      instead of 200 for each equipment item»
//        → computeRentalSalary halves the base AND the per-unit gear
//          commission when the window is (0; 24) hours; наценка stays 10%.
//
//   3. Payout notes: the owner's transfer note travels with the money —
//      payout jsonb → ledger entry → «Копилка команды» modal → TG card.
//
//   4. Photo guards ditched: «ДО»/«ПОСЛЕ» photos at any time (no ±2h window).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyVerificationAction,
  formatVerificationSummary,
  type RentalVerificationRow,
  type RentalVerificationSnapshot,
} from "@/app/franchize/lib/rental-verify-core";
import {
  buildCrewPayoutLedger,
  buildPayoutItem,
  formatPayoutCard,
  type PayoutSourceRow,
} from "@/app/franchize/lib/rental-payout-core";
import {
  computeRentalSalary,
  isShortRentalHours,
  OFFICIAL_SALARY_CONFIG,
} from "@/lib/salary-coefficients-shared";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// ── Fixtures (synthetic ids — no real people in the repo) ───────────────────

const OP = "100200300";
const OWNER = "400500600";
const ADMIN = "413120000"; // synthetic crew-admin (the boss signing off)

const CONFIG = { ...OFFICIAL_SALARY_CONFIG };

function row(overrides: Partial<RentalVerificationRow> = {}): RentalVerificationRow {
  return {
    rental_id: "r-120",
    crew_id: "crew-1",
    crew_slug: "vip-bike",
    operator_chat_id: OP,
    owner_chat_id: OWNER,
    requested_by: OP,
    requested_at: "2026-10-21T10:00:00Z",
    status: "pending",
    operator_confirmed_at: null,
    owner_confirmed_at: null,
    verified_at: null,
    disputed_by: null,
    dispute_reason: null,
    snapshot: {},
    source: "modal-close",
    ...overrides,
  } as RentalVerificationRow;
}

// ── 1. <24h → commission halved ────────────────────────────────────────────

describe("task120 · short-rental commission halving", () => {
  it("isShortRentalHours: (0;24) exclusive — unknown/0/24+ are NOT short", () => {
    expect(isShortRentalHours(3)).toBe(true);
    expect(isShortRentalHours(23.5)).toBe(true);
    expect(isShortRentalHours(0.5)).toBe(true);
    expect(isShortRentalHours(24)).toBe(false); // exactly a whole day = full
    expect(isShortRentalHours(25)).toBe(false);
    expect(isShortRentalHours(0)).toBe(false); // unknown → full (never guess)
    expect(isShortRentalHours(null)).toBe(false);
    expect(isShortRentalHours(undefined)).toBe(false);
    expect(isShortRentalHours(NaN)).toBe(false);
  });

  it("boss's numbers: mid 1000→500, high 1500→750, low 500→250", () => {
    const mk = (category: Parameters<typeof computeRentalSalary>[0]["rentalCategory"]) =>
      computeRentalSalary({
        config: CONFIG,
        rentalCategory: category,
        equipmentUnits: 0,
        totalCost: 3000,
        standardPrice: 3000, // no markup → overprice 0, isolating the base
        equipmentDays: 1,
        rentalHours: 3,
      });
    expect(mk("regular").base).toBe(500); // mid
    expect(mk("premium").base).toBe(750); // high-tier
    expect(mk("partner_regular").base).toBe(250); // low-tier
    expect(mk("budget").base).toBe(375); // 750 halved
    expect(mk("partner_premium").base).toBe(375);
    // …and the flag travels with the breakdown
    expect(mk("regular").shortRental).toBe(true);
  });

  it("gear per-unit halved too: 200→100/ед (and the flat parts only)", () => {
    // 2 items, hourly window → gearDays 1 → perUnit 200 halved to 100.
    const s = computeRentalSalary({
      config: CONFIG,
      rentalCategory: "regular",
      equipmentUnits: 2,
      totalCost: 10000,
      standardPrice: 9500,
      equipmentDays: 1,
      rentalHours: 5,
    });
    expect(s.base).toBe(500);
    expect(s.equipment).toBe(200); // 2 × 100
    expect(s.overprice).toBe(50); // наценка NOT halved: 10% × 500
    expect(s.total).toBe(750);
  });

  it("full-day windows keep the legacy numbers (24h / unknown)", () => {
    const full = (rentalHours?: number | null) =>
      computeRentalSalary({
        config: CONFIG,
        rentalCategory: "regular",
        equipmentUnits: 2,
        totalCost: 10000,
        standardPrice: 9500,
        equipmentDays: 1,
        rentalHours,
      });
    expect(full(24).base).toBe(1000);
    expect(full(24).equipment).toBe(400);
    expect(full(undefined).base).toBe(1000); // omitted → full
    expect(full(0).base).toBe(1000); // unknown → full
    expect(full(72).shortRental).toBe(false);
  });
});

// ── 2. Two-step confirmation: owner's ✅ is a must ──────────────────────────

describe("task120 · admin confirmation is not final", () => {
  it("admin ✅ on a fresh row → endorsement only, status untouched", () => {
    const res = applyVerificationAction(row(), {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t1",
      adminChatIds: [ADMIN],
    });
    expect(res.effect).toBe("admin_awaiting_owner");
    expect(res.actor).toBe("admin");
    expect(res.row!.status).toBe("pending");
    expect(res.row!.verified_at).toBeNull();
    expect(res.row!.owner_confirmed_at).toBeNull();
    // idempotent: a second admin tap changes nothing (still waiting).
    const again = applyVerificationAction(res.row!, {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t2",
      adminChatIds: [ADMIN],
    });
    expect(again.effect).toBe("admin_awaiting_owner");
  });

  it("operator → admin ✅ → still waiting; owner ✅ finishes the pair flow", () => {
    const op = applyVerificationAction(row(), { action: "confirm", chatId: OP, nowIso: "t1" });
    expect(op.effect).toBe("wait_other_party");
    const adm = applyVerificationAction(op.row!, {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t2",
      adminChatIds: [ADMIN],
    });
    expect(adm.effect).toBe("admin_awaiting_owner"); // NOT verified — owner owes his ✅
    expect(adm.row!.status).toBe("operator_confirmed");
    const own = applyVerificationAction(adm.row!, { action: "confirm", chatId: OWNER, nowIso: "t3" });
    expect(own.effect).toBe("verified");
    expect(own.row!.owner_confirmed_at).toBe("t3");
  });

  it("owner confirmed first → the admin tap CLOSES (owner's signature present)", () => {
    const own = applyVerificationAction(row(), { action: "confirm", chatId: OWNER, nowIso: "t1" });
    expect(own.effect).toBe("wait_other_party");
    const adm = applyVerificationAction(own.row!, {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t2",
      adminChatIds: [ADMIN],
    });
    expect(adm.effect).toBe("verified");
    expect(adm.row!.status).toBe("verified");
    expect(adm.row!.owner_confirmed_at).toBe("t1"); // the owner's OWN stamp, not the admin's
  });

  it("single-party rows follow the same rule: admin waits, owner closes", () => {
    const ownerOnly = row({ operator_chat_id: null });
    const adm = applyVerificationAction(ownerOnly, {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t1",
      adminChatIds: [ADMIN],
    });
    expect(adm.effect).toBe("admin_awaiting_owner");
    const own = applyVerificationAction(adm.row!, { action: "confirm", chatId: OWNER, nowIso: "t2" });
    expect(own.effect).toBe("verified"); // single human = owner, his ✅ is the whole agreement
  });

  it("operator === owner (same human) still verifies with one tap", () => {
    const same = row({ operator_chat_id: OWNER });
    const res = applyVerificationAction(same, { action: "confirm", chatId: OWNER, nowIso: "t1" });
    expect(res.effect).toBe("verified");
  });

  it("admin ⚠️ dispute unchanged; verified rows stay terminal", () => {
    const dis = applyVerificationAction(row(), {
      action: "dispute",
      chatId: ADMIN,
      nowIso: "t1",
      adminChatIds: [ADMIN],
    });
    expect(dis.effect).toBe("disputed");
    expect(dis.row!.dispute_reason).toContain("администратором");
    const done = row({ status: "verified", verified_at: "t0" });
    const late = applyVerificationAction(done, {
      action: "confirm",
      chatId: ADMIN,
      nowIso: "t1",
      adminChatIds: [ADMIN],
    });
    expect(late.effect).toBe("noop");
  });
});

// ── 3. The DM explains the halving (frozen formula) ─────────────────────────

describe("task120 · the сверка DM shows the short-rental rule", () => {
  const rub = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n)} ₽`;
  const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

  function summary(formula: RentalVerificationSnapshot["formula"]): string {
    const snap = {
      bikeName: "Segway X260",
      rentalCategory: "regular",
      rentalCategoryLabel: "Обычные",
      totalCost: 3000,
      base: 500,
      equipment: 200,
      overprice: 0,
      total: 700,
      equipmentUnits: 2,
      equipmentFlags: "1шл+1перч",
      overpricePercent: 10,
      depositReturned: null,
      damageNotes: null,
      returnNotes: null,
      penalty: null,
      attribution: { source: "request", createdByChatId: OP, handedByChatId: null, returnedByChatId: null },
      requestedAtIso: "2026-10-21T09:00:00.000Z",
      formula,
    } as RentalVerificationSnapshot;
    return formatVerificationSummary({
      crewName: "vip-bike",
      snapshot: snap,
      usersMap: new Map(),
      operatorChatId: OP,
      ownerChatId: OWNER,
      statusNote: "",
    });
  }

  const shortFormula = {
    fallback: false,
    bikeStandard: 2500,
    bikeTierLabel: null,
    bikeRate: null,
    bikeDays: 0,
    bikeHours: 5,
    gearLines: ["1 шлем — 500 ₽", "1 перчатки — 250 ₽"],
    gearStandard: 750,
    gearDays: 1,
    equipFollowupUnit: 100,
    gearDaysLabel: null,
    gearDaysLine: null,
    equipCommLine: null,
    shortRental: true,
    standardTotal: 3250,
    clientTotal: 3000,
    markup: 0,
    baseCoef: 1000,
    equipmentUnitCoef: 200,
    overpricePercent: 10,
  };

  it("short rental → the legend line spells out 1000→500 · 200→100", () => {
    const text = nbsp(summary(shortFormula));
    expect(text).toContain("аренда &lt; 24 ч — комиссия пополам");
    expect(text).toContain(nbsp(`мот ${rub(1000)} → ${rub(500)}`));
    expect(text).toContain(nbsp(`экип ${rub(200)} → ${rub(100)}/ед`));
    expect(text).toContain("аренда меньше суток — комиссия пополам");
  });

  // HOTFIX 2026-10-22 (bmw-f800r 8450ef3b): the summary travels with
  // parse_mode=HTML — a RAW `<` literal made Telegram reject EVERY copy with
  // 400 "can't parse entities" and the сверка never reached anyone. Guard:
  // after stripping the Telegram-allowed tags nothing may look like markup.
  it("summary contains no raw '<' outside Telegram HTML tags (hotfix regression)", () => {
    const ALLOWED = /<\/?\s*(b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|a|code|pre|blockquote)(\s[^>]*)?>/gi;
    const naked = (t: string) => t.replace(ALLOWED, "");
    const short = summary(shortFormula);
    const full = summary({ ...shortFormula, shortRental: false });
    expect(naked(short)).not.toMatch(/[<>]/);
    expect(naked(full)).not.toMatch(/[<>]/);
    // and the literal itself must be escaped, not raw
    expect(summary(shortFormula)).toContain("&lt; 24 ч");
  });

  it("full-day rows render the classic legend (no halving line)", () => {
    const text = nbsp(summary({ ...shortFormula, shortRental: false }));
    expect(text).not.toContain("комиссия пополам: мот");
    expect(text).toContain(nbsp(`мот ${rub(1000)}/аренда`));
  });
});

// ── 4. Payout notes travel with the money ───────────────────────────────────

describe("task120 · payout notes in the копилка", () => {
  const mkRow = (overrides: Record<string, unknown> = {}): PayoutSourceRow =>
    ({
      rental_id: "r-120",
      crew_slug: "vip-bike",
      operator_chat_id: OP,
      owner_chat_id: OWNER,
      status: "verified",
      verified_at: "2026-10-21T12:00:00Z",
      requested_at: "2026-10-21T10:00:00Z",
      snapshot: { total: 3200, bikeName: "Aprilia Shiver 750", totalCost: 46000 },
      negotiation: undefined,
      payout: undefined,
      ...overrides,
    }) as unknown as PayoutSourceRow;

  it("buildPayoutItem surfaces the stamp note", () => {
    const item = buildPayoutItem(
      mkRow({ payout: { operator: { marked: true, at: "2026-10-22T09:00:00Z", by: ADMIN, note: "перевод на карту *1234" } } }),
      OP,
    )!;
    expect(item.paid).toBe(true);
    expect(item.markedNote).toBe("перевод на карту *1234");
    // unmarked rows carry no note
    const fresh = buildPayoutItem(mkRow(), OP)!;
    expect(fresh.paid).toBe(false);
    expect(fresh.markedNote).toBeNull();
  });

  it("buildCrewPayoutLedger carries the note into the paid archive", () => {
    const ledger = buildCrewPayoutLedger(
      [
        mkRow({ payout: { operator: { marked: true, at: "2026-10-22T09:00:00Z", by: ADMIN, note: "нал" } } }),
        mkRow({ rental_id: "r-121", payout: { operator: { marked: true, at: "2026-10-22T10:00:00Z", by: ADMIN } } }),
      ],
      { crewSlug: "vip-bike", labelOf: (id) => `@id${id}` },
    );
    expect(ledger.paidLog).toHaveLength(2);
    const withNote = ledger.paidLog.find((e) => e.rentalId === "r-120")!;
    expect(withNote.note).toBe("нал");
    const noNote = ledger.paidLog.find((e) => e.rentalId === "r-121")!;
    expect(noNote.note).toBeNull();
  });

  it("formatPayoutCard prints the 📝 note line", () => {
    const item = buildPayoutItem(
      mkRow({ payout: { operator: { marked: true, at: "2026-10-22T09:00:00Z", by: ADMIN, note: "нал" } } }),
      OP,
    )!;
    const card = formatPayoutCard({ item, markedByLabel: "@crew_admin" });
    expect(card).toContain("📝 нал");
    expect(card).toContain("🏦 <b>Выплачено</b>");
  });

  it("markCrewPayoutAction forwards the note to stampRentalPayout (wiring)", () => {
    const src = read("app/franchize/server-actions/rental-payout-actions.ts");
    expect(src).toContain("note?: string | null");
    expect(src).toContain("note,");
  });
});

// ── 5. Wiring pins — one canon, guards really gone ──────────────────────────

describe("task120 · wiring pins", () => {
  it("all four salary call sites pass rentalHours: stdDetail.hours", () => {
    expect(read("app/franchize/lib/salary-category-bonuses.ts")).toContain("rentalHours: stdDetail.hours");
    expect(read("app/franchize/server-actions/my-work.ts")).toContain("rentalHours: stdDetail.hours");
    expect(read("lib/csv-builders/rentals-csv.ts")).toContain("rentalHours: stdDetail.hours");
    const verifyTs = read("app/franchize/lib/rental-verify.ts");
    expect(verifyTs).toContain("rentalHours: stdDetail.hours");
    expect(verifyTs).toContain("shortRental: salary.shortRental === true");
  });

  it("the snapshot formula type carries shortRental and the DM renders it", () => {
    const core = read("app/franchize/lib/rental-verify-core.ts");
    expect(core).toContain("shortRental?: boolean");
    // HOTFIX 2026-10-22: the legend goes out with parse_mode=HTML — raw '<'
    // is a 400. The source must carry the ESCAPED entity.
    expect(core).toContain("аренда &lt; 24 ч — комиссия пополам");
    expect(core).not.toContain("аренда < 24 ч");
  });

  it("photo guards are ditched: no 2h window left anywhere", () => {
    const photo = read("app/rentals/photo-actions.ts");
    expect(photo).not.toContain("TWO_HOURS");
    expect(photo).not.toContain("в течение 2 часов");
    // start photos: any real stage incl. completed; only cancelled rejects
    expect(photo).toContain('["pending_confirmation", "confirmed", "active", "completed"]');
    expect(photo).toContain('["active", "completed"]');
    const actions = read("app/rentals/actions.ts");
    expect(actions).not.toContain("в течение 2 часов");
    expect(actions).toContain("['active', 'completed']");
  });

  it("the ledger modal asks for a note and shows it in the archive", () => {
    const panel = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(panel).toContain("Заметка: нал / перевод на карту");
    expect(panel).toContain("note: note || null");
    expect(panel).toContain("e.note ? ` · 📝 ${e.note}` : \"\"");
    expect(panel).toContain("onMark: (rentalId: string, mark: boolean, note?: string) => void");
  });

  it("the TG payout card carries the note (markedNote)", () => {
    const core = read("app/franchize/lib/rental-payout-core.ts");
    expect(core).toContain("markedNote: string | null");
    expect(core).toContain("if (item.paid && item.markedNote)");
  });

  it("the admin done-text says owner + administration", () => {
    const verifyTs = read("app/franchize/lib/rental-verify.ts");
    expect(verifyTs).toContain("Расчёт подтверждён владельцем и администрацией");
    expect(verifyTs).toContain("Финальное подтверждение всегда за владельцем");
    expect(verifyTs).toContain("фиксирует отметку администрации");
  });
});
