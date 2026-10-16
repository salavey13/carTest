import { describe, it, expect } from "vitest";
import {
  applyVerificationAction,
  escapeVerifyHtml,
  formatRubVerify,
  formatVerificationSummary,
  labelFromUsersMap,
  tallyVerificationStatuses,
  verificationKeyboard,
  VERIFICATION_STATUS_LABELS,
  type RentalVerificationRow,
} from "@/app/franchize/lib/rental-verify-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 101 — salary verification + counters integrity (boss 2026-10-17).
 *
 * Three boss asks pinned here:
 *   1. «731 смены за 3 месяца» — profile counters were incremented with
 *      ABSOLUTE totals once per eligible achievement per clock-out. The fix
 *      (syncFranchizeCountersAction — SET semantics) and the shift.ts call
 *      shape are pinned structurally; the DB recompute ships as Paul-SQL.
 *   2. 100 ₽/h coefficient must be VISIBLE (🎯 Ставки ЗП page block +
 *      per-member rates action).
 *   3. On-the-fly rental verification: when a rental closes, operator AND
 *      owner get the frozen commission snapshot with ✅/⚠️ buttons; both
 *      confirm → «verified» so month-end reviews only the remainder.
 *
 * The state machine is pure (rental-verify-core.ts) — exercised directly.
 */

const repoRoot = resolve(__dirname, "../..");
const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");

const baseRow = (over: Partial<RentalVerificationRow> = {}): RentalVerificationRow => ({
  rental_id: "11111111-1111-1111-1111-111111111111",
  crew_id: "crew-1",
  crew_slug: "vip-bike",
  operator_chat_id: "7813830016",
  owner_chat_id: "413553377",
  requested_by: "7813830016",
  requested_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  status: "pending",
  operator_confirmed_at: null,
  owner_confirmed_at: null,
  verified_at: null,
  disputed_by: null,
  dispute_reason: null,
  snapshot: {},
  source: "return_page",
  ...over,
});

const NOW = new Date().toISOString();

describe("applyVerificationAction — dual confirmation state machine", () => {
  it("operator confirm first → operator_confirmed, waits for owner", () => {
    const res = applyVerificationAction(baseRow(), { action: "confirm", chatId: "7813830016", nowIso: NOW });
    expect(res.effect).toBe("wait_other_party");
    expect(res.actor).toBe("operator");
    expect(res.row!.status).toBe("operator_confirmed");
    expect(res.row!.operator_confirmed_at).toBe(NOW);
    expect(res.row!.owner_confirmed_at).toBeNull();
  });

  it("owner confirm after operator → verified (both timestamps, verified_at set)", () => {
    const afterOperator = baseRow({
      status: "operator_confirmed",
      operator_confirmed_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const res = applyVerificationAction(afterOperator, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(res.effect).toBe("verified");
    expect(res.row!.status).toBe("verified");
    expect(res.row!.owner_confirmed_at).toBe(NOW);
    expect(res.row!.verified_at).toBe(NOW);
  });

  it("operator confirm after owner → verified (symmetric)", () => {
    const afterOwner = baseRow({
      status: "owner_confirmed",
      owner_confirmed_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const res = applyVerificationAction(afterOwner, { action: "confirm", chatId: "7813830016", nowIso: NOW });
    expect(res.effect).toBe("verified");
    expect(res.row!.status).toBe("verified");
  });

  it("single-party rental (operator === owner) verifies on one confirm", () => {
    const solo = baseRow({ operator_chat_id: "413553377", owner_chat_id: "413553377" });
    // isOperator wins the actor check when the id matches both sides — the
    // operator branch must still short-circuit to verified (same human).
    const resAsOperator = applyVerificationAction(solo, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(resAsOperator.effect).toBe("verified");
    expect(resAsOperator.row!.status).toBe("verified");
  });

  it("operator-less attribution → owner's single confirm verifies", () => {
    const ownerOnly = baseRow({ operator_chat_id: null });
    const res = applyVerificationAction(ownerOnly, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(res.effect).toBe("verified");
  });

  it("dispute by a party wins over pending confirmations", () => {
    const afterOperator = baseRow({ status: "operator_confirmed", operator_confirmed_at: NOW });
    const res = applyVerificationAction(afterOperator, {
      action: "dispute",
      chatId: "413553377",
      nowIso: NOW,
      reason: "не согласен с наценкой",
    });
    expect(res.effect).toBe("disputed");
    expect(res.row!.status).toBe("disputed");
    expect(res.row!.disputed_by).toBe("413553377");
    expect(res.row!.dispute_reason).toBe("не согласен с наценкой");
  });

  it("dispute defaults the reason", () => {
    const res = applyVerificationAction(baseRow(), { action: "dispute", chatId: "7813830016", nowIso: NOW });
    expect(res.row!.dispute_reason).toBe("требует ручного разбора");
  });

  it("a stranger cannot act on the verification", () => {
    const res = applyVerificationAction(baseRow(), { action: "confirm", chatId: "999999", nowIso: NOW });
    expect(res.row).toBeNull();
    expect(res.error).toContain("не участник сверки");
  });

  it("re-confirming a verified row is an idempotent no-op (no DB write)", () => {
    const done = baseRow({
      status: "verified",
      operator_confirmed_at: NOW,
      owner_confirmed_at: NOW,
      verified_at: NOW,
    });
    const res = applyVerificationAction(done, { action: "confirm", chatId: "7813830016", nowIso: NOW });
    expect(res.row).toBeNull();
    expect(res.effect).toBe("noop");
    expect(res.error).toContain("Уже подтверждено");
  });

  it("double confirm by the same side keeps the FIRST timestamp", () => {
    const t1 = new Date(Date.now() - 120_000).toISOString();
    const afterOperator = baseRow({ status: "operator_confirmed", operator_confirmed_at: t1 });
    const res = applyVerificationAction(afterOperator, { action: "confirm", chatId: "7813830016", nowIso: NOW });
    expect(res.row!.operator_confirmed_at).toBe(t1);
  });
});

describe("verification message surface (money-sensitive formatting)", () => {
  const snapshot = {
    bikeName: "Xiaomi <script>alert(1)</script> Pro 2",
    rentalCategory: "regular",
    rentalCategoryLabel: "Обычные",
    totalCost: 12500.4,
    base: 300,
    equipment: 400,
    overprice: 45,
    total: 745,
    equipmentUnits: 2,
    equipmentFlags: "1шл+1перч",
    overpricePercent: 15,
    depositReturned: true,
    damageNotes: "Царапина на <крыле>",
    returnNotes: null,
    penalty: { amount: 1000, destination: "cash", reason: "скол" },
    attribution: { source: "request", createdByChatId: "7813830016", handedByChatId: null, returnedByChatId: "7813830016" },
    requestedAtIso: NOW,
  };
  const usersMap = new Map([
    ["7813830016", { username: "djorudjov", full_name: "Dmitry User" }],
    ["413553377", { username: "salavey13", full_name: null }],
  ]);

  it("summary shows the exact ₽ split both parties must agree on", () => {
    // Node's Intl formats ru grouping with U+00A0/U+202F — normalize before
    // comparing (Telegram renders all space variants identically).
    const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
    const text = norm(
      formatVerificationSummary({
        crewName: "VIP BIKE ELECTRO",
        snapshot,
        usersMap,
        operatorChatId: "7813830016",
        ownerChatId: "413553377",
        statusNote: "note",
      }),
    );
    expect(text).toContain("Комиссия оператора: 745 ₽");
    expect(text).toContain("техника (Обычные): +300 ₽");
    expect(text).toContain("экипировка (1шл+1перч): +400 ₽");
    expect(text).toContain("наценка (15%): +45 ₽");
    expect(text).toContain("Сумма аренды (клиент): <b>12 500 ₽</b>");
    expect(text).toContain("создал @djorudjov");
    expect(text).toContain("принял @djorudjov");
    expect(text).toContain("💰 депозит: возвращён");
    expect(text).toContain("⚠️ штраф 1 000 ₽ (cash) — скол");
    expect(text).toContain("🩹 ущерб: Царапина на &lt;крыле&gt;");
  });

  it("escapes user-controlled HTML (bike names / damage notes are free text)", () => {
    const text = formatVerificationSummary({
      crewName: "VIP BIKE ELECTRO",
      snapshot,
      usersMap,
      operatorChatId: "7813830016",
      ownerChatId: "413553377",
      statusNote: "note",
    });
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;script&gt;");
  });

  it("username-first labels (task100 lesson: «Dmitry User» never leads)", () => {
    expect(labelFromUsersMap(usersMap, "7813830016")).toBe("@djorudjov");
    expect(labelFromUsersMap(usersMap, "413553377")).toBe("@salavey13");
    expect(labelFromUsersMap(new Map(), "123")).toBe("id123");
    expect(labelFromUsersMap(usersMap, null)).toBe("—");
  });

  it("keyboard callback payloads stay within Telegram's 64-byte limit", () => {
    const kb = verificationKeyboard("11111111-1111-1111-1111-111111111111");
    expect(kb[0][0].callback_data).toBe("vrf_ok_11111111-1111-1111-1111-111111111111");
    for (const btn of kb.flat()) {
      expect(Buffer.byteLength(btn.callback_data, "utf8")).toBeLessThanOrEqual(64);
    }
    expect(kb[0][0].callback_data.startsWith("vrf_ok_")).toBe(true);
    expect(kb[0][1].callback_data.startsWith("vrf_dis_")).toBe(true);
  });

  it("ru rub formatting groups thousands", () => {
    const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
    expect(norm(formatRubVerify(12500.4))).toBe("12 500 ₽");
    expect(formatRubVerify(0)).toBe("0 ₽");
  });

  it("escapeVerifyHtml neutralizes angle brackets and ampersands", () => {
    expect(escapeVerifyHtml("<b>&")).toBe("&lt;b&gt;&amp;");
  });
});

describe("month-end tally (pure)", () => {
  it("counts verified/waiting/disputed; missing rows are unknown, not waiting", () => {
    const map = new Map([
      ["r1", { status: "verified" as const, operatorChatId: "1", ownerChatId: "2" }],
      ["r2", { status: "pending" as const, operatorChatId: "1", ownerChatId: "2" }],
      ["r3", { status: "operator_confirmed" as const, operatorChatId: "1", ownerChatId: "2" }],
      ["r4", { status: "disputed" as const, operatorChatId: "1", ownerChatId: "2" }],
    ]);
    const t = tallyVerificationStatuses(["r1", "r2", "r3", "r4", "r5"], map);
    expect(t).toEqual({ verified: 1, waiting: 2, disputed: 1, unknown: 1 });
  });

  it("empty map (SQL not applied) → everything unknown, zero waiting", () => {
    const t = tallyVerificationStatuses(["r1", "r2"], new Map());
    expect(t).toEqual({ verified: 0, waiting: 0, disputed: 0, unknown: 2 });
  });
});

describe("structural guarantees — counters fix (731 shifts bug)", () => {
  const shift = read("app/webhook-handlers/commands/shift.ts");

  it("grantShiftAchievements no longer passes absolute totals as incrementCounters", () => {
    // The exact corruption shape must be gone:
    expect(shift).not.toMatch(/incrementCounters:\s*\{\s*shiftsCompleted:\s*totalShifts/);
  });

  it("clock-out SETs counters from truth once via syncFranchizeCountersAction", () => {
    expect(shift).toContain("syncFranchizeCountersAction({");
    expect(shift).toContain("shiftsCompleted: totalShifts");
    expect(shift).toContain("totalHoursWorked: Math.round(totalHours * 100) / 100");
    // The per-achievement grant CALLS must carry no incrementCounters —
    // counters ride the single sync call. (Slice the loop itself: a text-ban
    // would false-positive on the fix comment mentioning the old shape, and
    // on the legit shiftsStarted delta at clock-IN.)
    const grantLoop = shift.slice(
      shift.indexOf("for (const achievement of achievementsToGrant)"),
      shift.indexOf("Failed to grant"),
    );
    expect(grantLoop).not.toContain("incrementCounters");
  });

  it("profile-actions exposes syncFranchizeCountersAction with SET semantics", () => {
    const pa = read("app/franchize/profile-actions.ts");
    expect(pa).toContain("export async function syncFranchizeCountersAction");
    // SET (not +=): the whole point of the fix.
    expect(pa).toMatch(/nextCounters\[key\] = value;/);
    // The increment path stays strictly for true deltas.
    expect(pa).toContain("nextCounters[key] = (nextCounters[key] || 0) + delta");
  });

  it("Paul's recompute SQL exists and is audited + idempotent", () => {
    const sql = read("docs/crewDocs/profile-counters-recompute-2026-10-17.sql");
    expect(sql).toContain("owner_fix_20261017_counters_recompute");
    expect(sql).toContain("IS DISTINCT FROM");
    expect(sql).toContain("crew_member_shifts");
  });
});

describe("structural guarantees — verification wiring", () => {
  it("command-handler routes vrf_ callbacks BEFORE the flow routers", () => {
    const ch = read("app/webhook-handlers/commands/command-handler.ts");
    expect(ch).toContain('text.startsWith("vrf_ok_")');
    expect(ch).toContain('text.startsWith("vrf_dis_")');
    expect(ch).toContain("handleRentalVerifyCallbackCommand");
    // Compare CALL positions, not first occurrences — the imports mention
    // handleEkipCallback long before the routing block.
    const vrfIdx = ch.indexOf('text.startsWith("vrf_ok_")');
    const ekipIdx = ch.indexOf("await handleEkipCallback");
    expect(vrfIdx).toBeGreaterThan(-1);
    expect(ekipIdx).toBeGreaterThan(-1);
    expect(vrfIdx).toBeLessThan(ekipIdx);
  });

  it("BOTH closure paths request verification (rental page + analytics dashboard)", () => {
    const actions = read("app/rentals/actions.ts");
    const dashboard = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(actions).toContain("requestRentalVerification");
    expect(actions).toContain('source: "return_page"');
    expect(dashboard).toContain("requestRentalVerification");
    expect(dashboard).toContain('source: "dashboard"');
  });

  it("server lib uses the CANONICAL commission math (no private re-implementation)", () => {
    const lib = read("app/franchize/lib/rental-verify.ts");
    expect(lib).toContain("computeRentalSalary({");
    expect(lib).toContain("resolveRentalOperator(");
    expect(lib).toContain("standardRentalPrice({");
  });

  it("pure core has ZERO imports (test-graph isolation)", () => {
    const core = read("app/franchize/lib/rental-verify-core.ts");
    const importLines = core.split("\n").filter((l) => /^import /.test(l));
    expect(importLines).toEqual([]);
  });

  it("SQL for Paul exists: table + unique rental_id + RLS + audit comment", () => {
    const sql = read("docs/crewDocs/rental-verifications-table-2026-10-17.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.rental_verifications");
    expect(sql).toMatch(/rental_id uuid NOT NULL UNIQUE/);
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("CHECK (status IN");
    expect(sql).toContain("task101 (2026-10-17, applied by Paul)");
  });

  it("salary category items carry the verification status (profile TL;DR)", () => {
    const scb = read("app/franchize/lib/salary-category-bonuses.ts");
    expect(scb).toContain("verificationStatus: RentalVerificationStatus | null");
    expect(scb).toContain("getVerificationStatusMap");
  });

  it("CSV gains the «Верификация» column in the АРЕНДЫ block", () => {
    const csv = read("lib/csv-builders/rentals-csv.ts");
    expect(csv).toContain('"Верификация"');
    expect(csv).toContain("VERIFICATION_STATUS_LABELS");
  });

  it("web admin verify action is owner-gated and reuses the state machine", () => {
    const sa = read("app/franchize/server-actions/rental-verify-actions.ts");
    expect(sa).toContain("access.isOwner !== true");
    expect(sa).toContain("applyVerificationAction(");
  });

  it("verification achievements exist in the catalog", () => {
    const pa = read("app/franchize/profile-actions.ts");
    for (const id of ["verify_first", "verify_speedy", "verify_10", "verify_50"]) {
      expect(pa).toContain(`id: "${id}"`);
    }
    // The counter rides the absolute sync from the server lib (DB truth),
    // never an increment.
    const lib = read("app/franchize/lib/rental-verify.ts");
    expect(lib).toContain("rentalsVerified: verifiedCount");
    expect(lib).toContain("syncFranchizeCountersAction({");
  });

  it("100 ₽/h coefficient is VISIBLE: Ставки ЗП block + per-member rates action", () => {
    const client = read("app/franchize/[slug]/salary-coefficients/SalaryCoefficientsClient.tsx");
    expect(client).toContain("Почасовая ставка смен");
    expect(client).toContain("getCrewHourlyRatesAction");
    const server = read("app/franchize/server-actions/salary-coefficients.ts");
    expect(server).toContain("export async function getCrewHourlyRatesAction");
    expect(server).toContain("DEFAULT_HOURLY_RATE");
    expect(server).toContain("hourly_rate");
  });

  it("status labels stay compact-ru for lists/CSV", () => {
    expect(VERIFICATION_STATUS_LABELS.verified).toBe("подтверждено");
    expect(VERIFICATION_STATUS_LABELS.pending).toBe("ожидает");
    expect(VERIFICATION_STATUS_LABELS.disputed).toBe("спор");
    expect(VERIFICATION_STATUS_LABELS.operator_confirmed).toBe("ждёт владельца");
    expect(VERIFICATION_STATUS_LABELS.owner_confirmed).toBe("ждёт оператора");
  });
});
