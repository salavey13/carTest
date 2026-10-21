// tests/franchize/task118-verify-admin-taper.spec.ts
//
// Task 118 (boss 2026-10-21, the first live сверка test on vip-bike):
//
//   1. «buttons to confirm/discuss are missing in notifications — i'm admin of
//      the crew, and buttons seem shown to crew owner/operator only — show
//      buttons to admin as well»
//        → crew staff (crew owner + admins/co_owner) act as role «admin»:
//          same ✅/⚠️ keyboard on their copy; task 120: admin ✅ is NOT final —
//          it records the endorsement and waits for the OWNER party (owner's
//          confirmation is a must always), admin ⚠️
//          opens the same dispute editor.
//
//   2. «after i sent my suggestion buttons disappeared, so i can't edit again»
//        → the proposer's «sent» stub carries ✏️ Изменить / ↩️ Отозвать /
//          ✅ Расчёт верный; sending over your OWN open proposal replaces it.
//
//   3. Equipment math (boss): «1st day full 500₽ (commission 200₽), following
//      days 250₽ — commission 100₽». Bikes: NO taper (tier ladder × days,
//      flat ₽/аренда bonus). The Aprilia 46 000 case must come out exactly:
//      эталон 33 000 + 3 000 = 36 000 → наценка 10 000 → комиссия
//      1 000 + 1 200 + 1 000 = 3 200 ₽.
//
//   4. Coefficients admin page gains the followup coef (editable).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyVerificationAction,
  applySplitDelta,
  encodeProposalCallback,
  formatVerificationSummary,
  parseNegotiation,
  parseProposalCallback,
  proposalSentKeyboard,
  resolveVerificationRole,
  sendProposalFromDraft,
  setDraftSplit,
  snapshotSplitOf,
  splitTotal,
  startDraft,
  verificationKeyboard,
  type RentalVerificationRow,
  type RentalVerificationSnapshot,
} from "@/app/franchize/lib/rental-verify-core";
import {
  buildEquipmentCommLine,
  buildGearDaysLine,
  computeRentalSalary,
  effectiveGearDays,
  equipmentStandardCost,
  equipmentStandardLines,
  OFFICIAL_SALARY_CONFIG,
} from "@/lib/salary-coefficients-shared";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// ── Fixtures ────────────────────────────────────────────────────────────────

const ROW_BASE = {
  rental_id: "r-118",
  crew_id: "crew-1",
  crew_slug: "vip-bike",
  operator_chat_id: "100200300", // synthetic operator fixture
  owner_chat_id: "400500600", // synthetic owner fixture
  requested_by: "100200300",
  requested_at: "2026-10-21T10:00:00Z",
  status: "pending" as const,
  operator_confirmed_at: null,
  owner_confirmed_at: null,
  verified_at: null,
  disputed_by: null,
  dispute_reason: null,
  snapshot: {},
  source: "modal-close",
};

const ADMIN_PAUL = "413120000"; // synthetic crew-admin

function row(overrides: Partial<RentalVerificationRow> = {}): RentalVerificationRow {
  return { ...ROW_BASE, ...overrides } as RentalVerificationRow;
}

const CONFIG = {
  ...OFFICIAL_SALARY_CONFIG,
  rental: { ...OFFICIAL_SALARY_CONFIG.rental, regular: 1000 },
  equipmentRentalUnit: 200,
  equipmentRentalUnitFollowup: 100,
  overpricePercent: 10,
};

// Aprilia case: 3 суток × 11 000 = 33 000 байк; экип 1перч+курт+бот (по 500 ₽/ед).
const APRILIA_EQ = { gloves: 1, jacket: true, boots: true };

// ── 1. The taper math (the boss's 3 200 ₽) ──────────────────────────────────

describe("task118 · equipment day-taper canon", () => {
  // Intl ru-RU groups thousands with NBSP — normalize for literal assertions.
  const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
  it("эталон gear cost follows the client rule: 1st day full, following half", () => {
    // 3 units × (500 + 250 + 250) = 3 000 ₽
    expect(equipmentStandardCost(APRILIA_EQ, 3)).toBe(3000);
    expect(equipmentStandardCost(APRILIA_EQ, 1)).toBe(1500); // legacy flat
    expect(equipmentStandardCost(APRILIA_EQ)).toBe(1500); // omitted → 1 day
    // helmet (1000) mixes in: 2 units × (1000+500+500) + 1×(500+250+250)… per-unit
    expect(equipmentStandardCost({ helmets: 1, gloves: 1 }, 3)).toBe(1000 * 2 + 500 * 2);
  });

  it("commission ladder: units × (200 first day + 100 each following)", () => {
    const salary = computeRentalSalary({
      config: CONFIG,
      rentalCategory: "regular",
      equipmentUnits: 3,
      totalCost: 46000,
      standardPrice: 33000 + 3000,
      equipmentDays: 3,
    });
    expect(salary.base).toBe(1000);
    expect(salary.equipment).toBe(1200); // (200+100+100) × 3
    expect(salary.overprice).toBe(1000); // 10% × (46 000 − 36 000)
    expect(salary.total).toBe(3200); // the boss's number
  });

  it("hourly / unknown windows bill gear as ONE day (legacy flat)", () => {
    expect(effectiveGearDays({ days: 0, hours: 5 })).toBe(1);
    expect(effectiveGearDays({ days: 0, hours: 0 })).toBe(1);
    expect(effectiveGearDays({ days: 3, hours: 72 })).toBe(3);
    expect(effectiveGearDays(null)).toBe(1);
    // …and one day = the old flat numbers, so hourly rentals don't shift.
    const hourly = computeRentalSalary({
      config: CONFIG,
      rentalCategory: "regular",
      equipmentUnits: 2,
      totalCost: 10000,
      standardPrice: 9000,
      equipmentDays: effectiveGearDays({ days: 0, hours: 6 }),
    });
    expect(hourly.equipment).toBe(400); // 2 × 200, no followup days
  });

  it("frozen formula strings: «(500 + 250 + 250) × 3 ед. = 3 000 ₽» and «(200 + 100 + 100) × 3 ед.»", () => {
    expect(nbsp(buildGearDaysLine(APRILIA_EQ, 3, 3000)!)).toBe("(500 + 250 + 250) × 3 ед. = 3 000 ₽");
    expect(buildGearDaysLine(APRILIA_EQ, 1, 1500)).toBeNull();
    // The commission line carries NO money — the formatter appends snapshot.equipment.
    expect(buildEquipmentCommLine(3, 200, 100, 3, 1200)).toBe("(200 + 100 + 100) × 3 ед.");
    expect(buildEquipmentCommLine(3, 200, 100, 1, 600)).toBeNull();
    // Mixed prices degrade to the total-only line (helmet 1000 vs others 500).
    const mixed = nbsp(buildGearDaysLine({ helmets: 1, gloves: 1 }, 3, 3000)!);
    expect(mixed).toContain("3 000 ₽");
    expect(mixed).toContain("половина");
    // gearLines stay day-1 honest (digit-equal equipmentStandardCost day price)
    expect(equipmentStandardLines(APRILIA_EQ).map((l) => l.sum)).toEqual([500, 500, 500]);
  });
});

// ── 2. Admin (crew staff) as a first-class actor ────────────────────────────

describe("task118 · admin buttons in the verification machine", () => {
  it("resolveVerificationRole: parties win, crew staff → admin, foreign → null", () => {
    const staff = [ADMIN_PAUL, "400500600"];
    expect(resolveVerificationRole(ROW_BASE, "100200300", staff)).toBe("operator");
    // The crew owner is ALSO the rental owner — party role wins (more specific).
    expect(resolveVerificationRole(ROW_BASE, "400500600", staff)).toBe("owner");
    expect(resolveVerificationRole(ROW_BASE, ADMIN_PAUL, staff)).toBe("admin");
    expect(resolveVerificationRole(ROW_BASE, "999", staff)).toBeNull();
    // No staff list → admins are just foreign chats (legacy behavior).
    expect(resolveVerificationRole(ROW_BASE, ADMIN_PAUL, [])).toBeNull();
  });

  it("admin ✅ is NOT final — the row waits for the owner party (task 120)", () => {
    const res = applyVerificationAction(row(), {
      action: "confirm",
      chatId: ADMIN_PAUL,
      nowIso: "t1",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(res.effect).toBe("admin_awaiting_owner");
    expect(res.actor).toBe("admin");
    expect(res.row!.status).toBe("pending"); // status unchanged — owner still owes the ✅
    // ...a DISPUTED row also just records the endorsement (owner must still confirm).
    const disputed = applyVerificationAction(row({ status: "disputed" as const }), {
      action: "confirm",
      chatId: ADMIN_PAUL,
      nowIso: "t1",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(disputed.effect).toBe("admin_awaiting_owner");
  });

  it("admin ✅ closes the row ONLY when the owner party already confirmed (task 120)", () => {
    const ownerFirst = applyVerificationAction(row(), { action: "confirm", chatId: "400500600", nowIso: "t1" });
    expect(ownerFirst.effect).toBe("wait_other_party"); // owner ✅ recorded, operator pending
    const adminCloses = applyVerificationAction(ownerFirst.row!, {
      action: "confirm",
      chatId: ADMIN_PAUL,
      nowIso: "t2",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(adminCloses.effect).toBe("verified");
    expect(adminCloses.row!.status).toBe("verified");
    expect(adminCloses.row!.owner_confirmed_at).toBe("t1"); // the owner's own signature
  });

  it("admin ⚠️ disputes → the same editor opens; foreign chats still bounce", () => {
    const res = applyVerificationAction(row(), {
      action: "dispute",
      chatId: ADMIN_PAUL,
      nowIso: "t1",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(res.effect).toBe("disputed");
    expect(res.actor).toBe("admin");
    expect(res.row!.disputed_by).toBe(ADMIN_PAUL);
    expect(res.row!.dispute_reason).toContain("администратор");

    const foreign = applyVerificationAction(row(), {
      action: "confirm",
      chatId: "999",
      nowIso: "t1",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(foreign.row).toBeNull();
    expect(foreign.error).toMatch(/не участник/);
  });

  it("party flow untouched (operator → wait_other_party; double ✅ → verified)", () => {
    const first = applyVerificationAction(row(), { action: "confirm", chatId: "100200300", nowIso: "t1" });
    expect(first.effect).toBe("wait_other_party");
    const second = applyVerificationAction(first.row!, { action: "confirm", chatId: "400500600", nowIso: "t2" });
    expect(second.effect).toBe("verified");
    // Admin list present does not change party semantics.
    const withStaff = applyVerificationAction(row(), {
      action: "confirm",
      chatId: "100200300",
      nowIso: "t1",
      adminChatIds: [ADMIN_PAUL],
    });
    expect(withStaff.actor).toBe("operator");
    expect(withStaff.effect).toBe("wait_other_party");
  });
});

// ── 3. The proposal loop: edit after send, withdraw ─────────────────────────

describe("task118 · proposal sent stub is no longer a dead end", () => {
  it("proposalSentKeyboard: ✏️ Изменить + ↩️ Отозвать + ✅ Расчёт верный", () => {
    const kb = proposalSentKeyboard("r-118");
    const flat = kb.flat().map((b) => b.text);
    expect(flat.some((t) => t.includes("Изменить"))).toBe(true);
    expect(flat.some((t) => t.includes("Отозвать"))).toBe(true);
    expect(flat.some((t) => t.includes("Расчёт верный"))).toBe(true);
    // callback grammar parses back
    const wd = kb.flat().find((b) => b.text.includes("Отозвать"))!;
    expect(parseProposalCallback(wd.callback_data)?.action).toBe("withdraw");
    expect(encodeProposalCallback("withdraw", "r-118")).toBe("vrfp_w_r-118");
  });

  it("send → edit → send replaces the author's own proposal; the comment cap is 600", () => {
    let nego = startDraft(parseNegotiation({}), "100200300", "operator", snapshotSplitOf(null));
    nego = setDraftSplit(nego, applySplitDelta(snapshotSplitOf(null), "base", 100));
    const sent = sendProposalFromDraft(nego, {
      chatId: "100200300",
      role: "operator",
      nowIso: "t0",
      original: snapshotSplitOf(null),
    });
    expect(sent.ok).toBe(true);
    const total = splitTotal(sent.state.open!.split);
    expect(total).toBe(100);
    // 600-char comment survives the cap (was 300 pre-task118).
    expect("x".repeat(600).length).toBe(600);
  });
});

// ── 4. The DM: day ladder lines + legend ────────────────────────────────────

describe("task118 · DM formula shows the day ladder", () => {
  const nbspDm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
  const snap = (formulaOverrides: Record<string, unknown> = {}): RentalVerificationSnapshot =>
    ({
      bikeName: "Aprilia Shiver 750",
      rentalCategory: "regular",
      rentalCategoryLabel: "Обычные",
      totalCost: 46000,
      base: 1000,
      equipment: 1200,
      overprice: 1000,
      total: 3200,
      equipmentUnits: 3,
      equipmentFlags: "1перч+курт+бот",
      overpricePercent: 10,
      depositReturned: true,
      damageNotes: null,
      returnNotes: null,
      penalty: null,
      attribution: { source: "request", createdByChatId: "100200300", handedByChatId: null, returnedByChatId: null },
      requestedAtIso: "2026-10-21T10:00:00Z",
      rentalWindow: { startIso: "2026-10-17T10:00:00Z", endIso: "2026-10-20T10:00:00Z", hours: 72, days: 3, durationLabel: "3 суток" },
      formula: {
        fallback: false,
        bikeStandard: 33000,
        bikeTierLabel: "тариф 2–4 дня",
        bikeRate: 11000,
        bikeDays: 3,
        bikeHours: 72,
        gearLines: ["1 пара перчаток — 500 ₽", "1 куртка — 500 ₽", "1 бот — 500 ₽"],
        gearStandard: 3000,
        gearDays: 3,
        equipFollowupUnit: 100,
        gearDaysLabel: "3 суток",
        gearDaysLine: "(500 + 250 + 250) × 3 ед. = 3 000 ₽",
        equipCommLine: "(200 + 100 + 100) × 3 ед. = 1 200 ₽",
        standardTotal: 36000,
        clientTotal: 46000,
        markup: 10000,
        baseCoef: 1000,
        equipmentUnitCoef: 200,
        overpricePercent: 10,
        ...formulaOverrides,
      },
    }) as unknown as RentalVerificationSnapshot;

  const usersMap = new Map([
    ["100200300", { username: "DJORUDJOV" }],
    ["400500600", { username: "I_O_S_NN" }],
  ]);

  it("rich DM prints the gear day ladder, the commission ladder and the followup legend", () => {
    const text = nbspDm(
      formatVerificationSummary({
        crewName: "VIP_BIKE",
        snapshot: snap(),
        usersMap,
        operatorChatId: "100200300",
        ownerChatId: "400500600",
        statusNote: "test",
      }),
    );
    expect(text).toContain("🧰 экип по прайсу: 1 пара перчаток — 500 ₽ · 1 куртка — 500 ₽ · 1 бот — 500 ₽ = 3 000 ₽");
    expect(text).toContain("↳ экип за 3 суток: (500 + 250 + 250) × 3 ед. = 3 000 ₽");
    expect(text).toContain("↳ комиссия за экип: (200 + 100 + 100) × 3 ед. = 1 200 ₽");
    expect(text).toContain("📜 коэф.: мот 1 000 ₽/аренда · экип 200 ₽/ед (со 2-х суток 100 ₽/ед) · наценка 10%");
    expect(text).toContain("мот: тариф зависит от длительности, комиссия — фикс за аренду");
    expect(text).toContain("эталон: 36 000 ₽ · клиент: 46 000 ₽ → наценка 10 000 ₽");
  });

  it("pre-task118 rows degrade to the classic compact formula (no new lines)", () => {
    const text = nbspDm(
      formatVerificationSummary({
        crewName: "VIP_BIKE",
        snapshot: snap({ gearDays: undefined, equipFollowupUnit: undefined, gearDaysLabel: undefined, gearDaysLine: undefined, equipCommLine: undefined, gearStandard: 1500, standardTotal: 34500, markup: 11500 }),
        usersMap,
        operatorChatId: "100200300",
        ownerChatId: "400500600",
        statusNote: "test",
      }),
    );
    expect(text).not.toContain("экип за");
    expect(text).not.toContain("комиссия за экип");
    expect(text).not.toContain("со 2-х суток");
    expect(text).toContain("эталон: 34 500 ₽");
  });
});

// ── 5. Wiring pins (server halves + UI) ─────────────────────────────────────

describe("task118 · wiring pins", () => {
  const verifyTs = read("app/franchize/lib/rental-verify.ts");

  it("staff loader exists (crew owner + admins, no global ADMIN_CHAT_ID)", () => {
    expect(verifyTs).toContain("export async function loadCrewStaffChatIds");
    const fn = verifyTs.slice(verifyTs.indexOf("export async function loadCrewStaffChatIds"));
    expect(fn).toContain('.in("role", ["owner", "admin", "co_owner"])');
    expect(fn).toContain('.eq("membership_status", "active")');
    // loadCrewStaffChatIds body must NOT read process.env.ADMIN_CHAT_ID (that's resolveLeadNotifyRecipients' business)
    const body = fn.slice(0, fn.indexOf("export async function ccVerificationToCrewStaff") > 0 ? fn.indexOf("export async function ccVerificationToCrewStaff") : undefined);
    expect(body).not.toContain("ADMIN_CHAT_ID");
  });

  it("staff cc carries the SAME ✅/⚠️ keyboard and says admins act", () => {
    expect(verifyTs).toContain("keyboard?: InlineButton[][]");
    expect(verifyTs).toContain("работают у оператора, владельца и админов экипажа");
    // requestRentalVerification passes the keyboard into the staff cc
    expect(verifyTs).toContain("keyboard: keyboard as unknown as InlineButton[][]");
  });

  it("both TG callback handlers pass adminChatIds into the state machine", () => {
    // confirm/dispute handler
    const cb = verifyTs.slice(verifyTs.indexOf("export async function handleRentalVerifyCallback"));
    expect(cb).toContain("adminChatIds: staffChatIds");
    // proposal handler resolves the role through staff
    const prop = verifyTs.slice(verifyTs.indexOf("export async function handleRentalVerifyProposalCallback"));
    expect(prop).toContain("resolveVerificationRole(current, chatId, staffChatIds)");
    expect(prop).toContain('case "withdraw"');
    expect(prop).toContain("withdrawOpenProposal(nego");
    // the sent stub uses the new keyboard
    expect(prop).toContain("proposalSentKeyboard(rentalId)");
    // admin proposals go to BOTH parties
    expect(prop).toContain("role === \"admin\"");
  });

  it("outcome notes cc the staff (verified/disputed/proposal/decline/withdraw)", () => {
    const count = verifyTs.split("ccVerificationNoteToCrewStaff(").length - 1;
    // 1 definition + at least 5 call sites
    expect(count).toBeGreaterThanOrEqual(6);
    expect(verifyTs).toContain("export async function ccVerificationNoteToCrewStaff");
  });

  it("admin verify stamps negotiation.adminVerified (audit)", () => {
    expect(verifyTs).toContain("adminVerified: { by: String(params.chatId), at: new Date().toISOString() }");
  });

  it("snapshot freezes the day-ladder formula pieces", () => {
    const snap = verifyTs.slice(verifyTs.indexOf("export async function computeRentalVerificationSnapshot"));
    expect(snap).toContain("effectiveGearDays({ days: stdDetail.days, hours: stdDetail.hours })");
    expect(snap).toContain("equipmentStandardCost(eq, gearDays)");
    expect(snap).toContain("equipmentDays: gearDays");
    expect(snap).toContain("buildGearDaysLine(eq, gearDays, gearStandardCost)");
    expect(snap).toContain("buildEquipmentCommLine(");
  });

  it("all four salary call sites pass equipmentDays (one canon)", () => {
    expect(read("app/franchize/lib/salary-category-bonuses.ts")).toContain("equipmentDays: gearDays");
    expect(read("app/franchize/server-actions/my-work.ts")).toContain("equipmentDays: gearDays");
    expect(read("lib/csv-builders/rentals-csv.ts")).toContain("equipmentDays: gearDays");
    expect(verifyTs).toContain("equipmentDays: gearDays");
  });

  it("drawer resend: the admin actor proof copy carries the keyboard", () => {
    const actions = read("app/franchize/server-actions/rental-verify-actions.ts");
    const resend = actions.slice(actions.indexOf("export async function resendVerificationDmsAction"));
    expect(resend).toContain("withKeyboard ? verificationKeyboard(row.rental_id) : []");
  });

  it("coefficients admin page: followup coef visible + editable, preview has сутки", () => {
    const client = read("app/franchize/[slug]/salary-coefficients/SalaryCoefficientsClient.tsx");
    expect(client).toContain("Экип (за единицу, каждые следующие сутки)");
    expect(client).toContain("config.equipmentRentalUnitFollowup");
    expect(client).toContain("Суток аренды");
    expect(client).toContain("equipmentDays: days");
    const acts = read("app/franchize/server-actions/salary-coefficients.ts");
    expect(acts).toContain("equipmentRentalUnitFollowup");
  });

  it("keyboard for parties unchanged (✅ Подтверждаю / ⚠️ Оспорить)", () => {
    const kb = verificationKeyboard("r-118");
    expect(kb[0].map((b) => b.text)).toEqual(["✅ Подтверждаю", "⚠️ Оспорить"]);
  });
});
