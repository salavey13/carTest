// Task 107 — VERIFIED PAYOUT: the money half of the verification game.
// Pure-half matrix (money math, buckets, callback grammar, keyboards,
// formatters) + source-level wiring pins (routing, deeplink, notifications).
//
// Money-safety invariants pinned here:
//   • the tracked money is the frozen/agreed operator commission — never
//     recomputed, never negative;
//   • single-party rows (operator === owner / operator absent) are NOT payout
//     money — the boss's own cash never enters «к выплате»;
//   • an agreed (corrected) split overrides the frozen total;
//   • paid-out stamps live in payout jsonb; undo keeps the audit log;
//   • every `payo_` callback parses back to exactly one action, ≤ 64 bytes;
//   • the /doc payment-split prefix `pay_` is untouched by the `payo_` router.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  bucketKeyOf,
  buildPayoutItem,
  commissionOf,
  encodePayoutCallback,
  formatPayoutAllConfirm,
  formatPayoutCard,
  formatPayoutConfirm,
  formatPayoutHub,
  formatPayoutNotifyText,
  formatPayoutResult,
  isCommissionPaid,
  isPayoutRow,
  isoToDateLabel,
  parsePayoutCallback,
  parsePayoutInfo,
  payoutAllConfirmKeyboard,
  payoutCardKeyboard,
  payoutConfirmKeyboard,
  payoutHubKeyboard,
  summarizePayoutItems,
  PAYOUT_PAGE_SIZE,
  type PayoutItem,
  type PayoutSourceRow,
} from "@/app/franchize/lib/rental-payout-core";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

const UUID = "bd948bd0-e9db-44ef-8955-97933cee066f";
const OP = "100200300"; // synthetic fixture (no real ids in repo)
const OWNER = "400500600"; // synthetic fixture

/** ru-RU money string — Intl uses NBSP group separators (the task-106 lesson). */
const rub = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n)} ₽`;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function row2p(overrides: Partial<PayoutSourceRow> = {}): PayoutSourceRow {
  return {
    rental_id: UUID,
    crew_slug: "vip-bike",
    status: "verified",
    operator_chat_id: OP,
    owner_chat_id: OWNER,
    requested_at: "2026-10-17T09:16:00.000Z",
    verified_at: "2026-10-17T10:00:00.000Z",
    snapshot: {
      bikeName: "BMW F800R",
      totalCost: 6500,
      base: 500,
      equipment: 250,
      overprice: 150,
      total: 900,
    },
    ...overrides,
  };
}

// ── Money math ───────────────────────────────────────────────────────────────

describe("task107 · payout money math", () => {
  it("uses snapshot.total as the commission and derives the company part", () => {
    const item = buildPayoutItem(row2p(), OP)!;
    expect(item.amount).toBe(900);
    expect(item.totalCost).toBe(6500);
    expect(item.companyPart).toBe(5600);
    expect(item.mine).toBe(true);
    expect(item.paid).toBe(false);
    expect(item.adjusted).toBe(false);
    expect(item.dateLabel).toBe("17.10");
  });

  it("an agreed (corrected) split overrides the frozen commission", () => {
    const row = row2p({
      negotiation: { agreed: { split: { base: 400, equipment: 250, overprice: 100 }, proposedBy: OP, acceptedBy: OWNER, at: "2026-10-17T10:00:00Z" } },
    });
    const { amount, adjusted } = commissionOf(row);
    expect(amount).toBe(750);
    expect(adjusted).toBe(true);
    const item = buildPayoutItem(row, OP)!;
    expect(item.amount).toBe(750);
    expect(item.companyPart).toBe(5750);
    expect(item.adjusted).toBe(true);
  });

  it("clamps negatives: zero snapshot money → 0, never negative", () => {
    const item = buildPayoutItem(row2p({ snapshot: { bikeName: "X", totalCost: -5, total: 0 } }), OP)!;
    expect(item.amount).toBe(0);
    expect(item.totalCost).toBe(0);
    expect(item.companyPart).toBe(0);
  });

  it("single-party rows are NOT payout money (boss's own cash)", () => {
    expect(isPayoutRow(row2p({ operator_chat_id: OWNER }))).toBe(false);
    expect(isPayoutRow(row2p({ operator_chat_id: null }))).toBe(false);
    expect(isPayoutRow(row2p())).toBe(true);
    expect(buildPayoutItem(row2p({ operator_chat_id: OWNER }), OWNER)).toBeNull();
    expect(buildPayoutItem(row2p({ operator_chat_id: null }), OWNER)).toBeNull();
  });

  it("mine=false for an owner-tier viewer who is not the operator", () => {
    const item = buildPayoutItem(row2p(), OWNER)!;
    expect(item.mine).toBe(false);
    expect(item.amount).toBe(900); // the money the owner-tier viewer owes out
  });

  it("a foreign/empty row is rejected", () => {
    expect(buildPayoutItem(null as unknown as PayoutSourceRow, OP)).toBeNull();
    expect(buildPayoutItem({ status: "verified" } as PayoutSourceRow, OP)).toBeNull();
  });

  it("isoToDateLabel is dd.MM and tolerates garbage", () => {
    expect(isoToDateLabel("2026-10-17T10:00:00.000Z")).toBe("17.10");
    expect(isoToDateLabel("2026-01-05T00:00:00Z")).toBe("05.01");
    expect(isoToDateLabel(null)).toBe("—");
    expect(isoToDateLabel("garbage")).toBe("—");
  });
});

// ── Payout jsonb parsing / stamping semantics ────────────────────────────────

describe("task107 · payout jsonb semantics", () => {
  it("absent/null/garbage payout = never touched (= unpaid)", () => {
    expect(isCommissionPaid({ payout: null })).toBe(false);
    expect(isCommissionPaid({ payout: undefined })).toBe(false);
    expect(isCommissionPaid({ payout: "junk" })).toBe(false);
    expect(isCommissionPaid({ payout: { operator: { marked: false } } })).toBe(false);
  });

  it("only an explicit operator.marked=true counts as paid", () => {
    expect(isCommissionPaid({ payout: { operator: { marked: true, at: "2026-10-18T10:00:00Z", by: OWNER } } })).toBe(true);
    const info = parsePayoutInfo({ operator: { marked: true, at: "a", by: "b", note: "нал" }, log: [{ action: "marked", at: "a", by: "b" }] });
    expect(info.operator?.marked).toBe(true);
    expect(info.operator?.note).toBe("нал");
    expect(info.log).toHaveLength(1);
    // non-string junk is dropped, not trusted
    expect(parsePayoutInfo({ operator: { marked: "yes", by: 42 } }).operator?.marked).toBe(false);
    expect(parsePayoutInfo({ operator: { marked: "yes", by: 42 } }).operator?.by).toBeUndefined();
  });
});

// ── Buckets ──────────────────────────────────────────────────────────────────

describe("task107 · buckets", () => {
  const mk = (over: Partial<PayoutItem>): PayoutItem =>
    ({
      rentalId: UUID,
      crewSlug: "vip-bike",
      bikeName: "BMW F800R",
      status: "verified",
      amount: 900,
      totalCost: 6500,
      companyPart: 5600,
      paid: false,
      markedAt: null,
      markedBy: null,
      verifiedAt: "2026-10-17T10:00:00.000Z",
      requestedAt: "2026-10-17T09:16:00.000Z",
      dateLabel: "17.10",
      adjusted: false,
      mine: true,
      proposalOpen: false,
      ...over,
    }) as PayoutItem;

  it("verified+unpaid → toPay, not verified → unverified, verified+paid → paid", () => {
    expect(bucketKeyOf({ status: "verified", paid: false })).toBe("toPay");
    expect(bucketKeyOf({ status: "operator_confirmed", paid: false })).toBe("unverified");
    expect(bucketKeyOf({ status: "pending", paid: false })).toBe("unverified");
    expect(bucketKeyOf({ status: "disputed", paid: false })).toBe("unverified");
    expect(bucketKeyOf({ status: "verified", paid: true })).toBe("paid");
  });

  it("sums per bucket and keeps counts", () => {
    const summary = summarizePayoutItems([
      mk({}),
      mk({ rentalId: "b", amount: 600 }),
      mk({ rentalId: "c", status: "pending", amount: 1500 }),
      mk({ rentalId: "d", paid: true, amount: 300 }),
    ]);
    expect(summary.toPay).toEqual({ sum: 1500, count: 2 });
    expect(summary.unverified).toEqual({ sum: 1500, count: 1 });
    expect(summary.paid).toEqual({ sum: 300, count: 1 });
  });

  it("undo (paid: true → false) returns money to «к выплате»", () => {
    const before = summarizePayoutItems([mk({ paid: true })]);
    const after = summarizePayoutItems([mk({ paid: false })]);
    expect(before.toPay.sum).toBe(0);
    expect(before.paid.sum).toBe(900);
    expect(after.toPay.sum).toBe(900);
    expect(after.paid.sum).toBe(0);
  });
});

// ── Callback grammar ─────────────────────────────────────────────────────────

describe("task107 · payo_ callback grammar", () => {
  it("round-trips every action, ≤ 64 bytes with a full uuid", () => {
    const withId = [
      ["open", encodePayoutCallback("open", UUID), "open"],
      ["mark", encodePayoutCallback("mark", UUID), "mark"],
      ["yes", encodePayoutCallback("yes", UUID), "yes"],
      ["undo", encodePayoutCallback("undo", UUID), "undo"],
      ["conv", encodePayoutCallback("conv", UUID), "conv"],
    ] as const;
    for (const [, data, action] of withId) {
      expect(data.length).toBeLessThanOrEqual(64);
      const parsed = parsePayoutCallback(data);
      expect(parsed).toEqual({ action, rentalId: UUID, page: 0 });
    }
    expect(parsePayoutCallback(encodePayoutCallback("hub", 3))).toEqual({ action: "hub", rentalId: null, page: 3 });
    expect(parsePayoutCallback(encodePayoutCallback("hub", -7))).toEqual({ action: "hub", rentalId: null, page: 0 });
    expect(parsePayoutCallback(encodePayoutCallback("all"))).toEqual({ action: "all", rentalId: null, page: 0 });
    expect(parsePayoutCallback(encodePayoutCallback("allyes"))).toEqual({ action: "allyes", rentalId: null, page: 0 });
  });

  it("rejects foreign data and malformed payloads", () => {
    expect(parsePayoutCallback("")).toBeNull();
    expect(parsePayoutCallback("pay_cash_1")).toBeNull();          // /doc payment split — untouched
    expect(parsePayoutCallback("pay_all_cash")).toBeNull();
    expect(parsePayoutCallback("vrf_ok_x")).toBeNull();
    expect(parsePayoutCallback("payo_")).toBeNull();
    expect(parsePayoutCallback("payo_unknown_x")).toBeNull();
    expect(parsePayoutCallback("payo_open_")).toBeNull();          // no rental id
    expect(parsePayoutCallback("payo_hub_")).toEqual({ action: "hub", rentalId: null, page: 0 }); // page defaults 0
  });

  it("the hub keyboard pages, lists items and offers mark-all only when money waits", () => {
    const items = Array.from({ length: PAYOUT_PAGE_SIZE + 2 }, (_, i) =>
      buildPayoutItem(row2p({ rental_id: `r${i}` }), OP)!,
    );
    const kb0 = payoutHubKeyboard(items.slice(0, PAYOUT_PAGE_SIZE), {
      page: 0,
      hasMore: true,
      toPayCount: 5,
      convertibles: [{ rentalId: "old1", bikeName: "Aprilia RS", dateLabel: "01.10" }],
    });
    expect(kb0.filter((row) => row.some((b) => b.callback_data.startsWith("payo_open_")))).toHaveLength(PAYOUT_PAGE_SIZE);
    expect(kb0.some((row) => row.some((b) => b.callback_data === "payo_conv_old1"))).toBe(true);
    expect(kb0.some((row) => row.some((b) => b.callback_data === "payo_hub_1"))).toBe(true);
    expect(kb0.some((row) => row.some((b) => b.callback_data === "payo_all"))).toBe(true);
    const kb1 = payoutHubKeyboard([], { page: 1, hasMore: false, toPayCount: 0 });
    expect(kb1.some((row) => row.some((b) => b.callback_data === "payo_hub_0"))).toBe(true);
    expect(kb1.some((row) => row.some((b) => b.callback_data === "payo_all"))).toBe(false);
  });

  it("the hub text carries the «Без сверки» conversion section", () => {
    const text = formatPayoutHub({
      scopeLabel: "все экипажи",
      summary: summarizePayoutItems([]),
      items: [],
      page: 0,
      hasMore: false,
      isOwnerTier: true,
      convertibles: [{ rentalId: "old1", bikeName: "<i>Aprilia</i>", dateLabel: "01.10" }],
    });
    expect(text).toContain("Без сверки");
    expect(text).toContain("&lt;i&gt;Aprilia&lt;/i&gt;"); // escaped
    expect(text).toContain("выслать сверку");
  });

  it("card keyboards follow the row state", () => {
    const item = buildPayoutItem(row2p(), OP)!;
    const unpaidKb = payoutCardKeyboard(item);
    expect(unpaidKb[0][0].callback_data).toBe(`payo_mark_${UUID}`);
    const paidKb = payoutCardKeyboard({ ...item, paid: true });
    expect(paidKb[0][0].callback_data).toBe(`payo_undo_${UUID}`);
    const pendingKb = payoutCardKeyboard({ ...item, status: "pending" });
    // NOT verified → route through the EXISTING vrf_ state machine
    expect(pendingKb[0].map((b) => b.callback_data)).toEqual([`vrf_ok_${UUID}`, `vrf_dis_${UUID}`]);
    const confirmKb = payoutConfirmKeyboard(UUID);
    expect(confirmKb[0].map((b) => b.callback_data)).toEqual([`payo_yes_${UUID}`, `payo_open_${UUID}`]);
    expect(payoutAllConfirmKeyboard()[0][0].callback_data).toBe("payo_allyes");
    expect(payoutAllConfirmKeyboard()[0][1].callback_data).toBe("payo_hub_0");
  });
});

// ── Formatters (HTML safety + money framing) ────────────────────────────────

describe("task107 · formatters", () => {
  const item = buildPayoutItem(row2p(), OP)!;

  it("escapes untrusted bike/crew names", () => {
    const evil = buildPayoutItem(row2p({ snapshot: { bikeName: "<script>alert(1)</script>", totalCost: 6500, total: 900 } }), OP)!;
    const card = formatPayoutCard({ item: evil });
    expect(card).not.toContain("<script>");
    expect(card).toContain("&lt;script&gt;");
    const hub = formatPayoutHub({
      scopeLabel: "<b>evil</b>",
      summary: summarizePayoutItems([item]),
      items: [evil],
      page: 0,
      hasMore: false,
      isOwnerTier: true,
    });
    expect(hub).not.toContain("<b>evil</b></b>");
    expect(hub).toContain("&lt;b&gt;evil&lt;/b&gt;");
  });

  it("the hub shows the three buckets with sums and counts", () => {
    const summary = summarizePayoutItems([item, { ...item, rentalId: "b", amount: 600 }, { ...item, rentalId: "c", status: "pending", amount: 1500 }]);
    const text = formatPayoutHub({ scopeLabel: "все экипажи", summary, items: [item], page: 0, hasMore: false, isOwnerTier: true });
    expect(text).toContain("К выплате (сверено)");
    expect(text).toContain(rub(1500)); // toPay: 900+600 (ru NBSP grouping)
    expect(text).toContain("(2)");
    expect(text).toContain("Не сверено");
    expect(text).toContain(rub(1500));
    expect(text).toContain("Выплачено всего");
    expect(text).toContain("комиссии операторам"); // owner-tier framing
  });

  it("the SQL note lands in the hub when the column is missing", () => {
    const text = formatPayoutHub({
      scopeLabel: "Мои комиссии",
      summary: summarizePayoutItems([]),
      items: [],
      page: 0,
      hasMore: false,
      isOwnerTier: false,
      sqlNote: "выплаты пока только на чтение",
    });
    expect(text).toContain("выплаты пока только на чтение");
  });

  it("card reflects verified / paid / disputed states", () => {
    expect(formatPayoutCard({ item })).toContain("Сверка подтверждена");
    expect(formatPayoutCard({ item })).toContain(rub(900));
    expect(formatPayoutCard({ item })).toContain(rub(5600)); // company part
    expect(formatPayoutCard({ item: { ...item, adjusted: true } })).toContain("скорректированы сделкой");
    expect(formatPayoutCard({ item: { ...item, paid: true, markedAt: "2026-10-18T12:00:00Z" }, markedByLabel: "@paul" })).toContain("отметил");
    expect(formatPayoutCard({ item: { ...item, paid: true, markedAt: "2026-10-18T12:00:00Z" }, markedByLabel: "@paul" })).toContain("18.10");
    expect(formatPayoutCard({ item: { ...item, status: "disputed" } })).toContain("Спор");
    expect(formatPayoutCard({ item: { ...item, status: "pending", proposalOpen: true } })).toContain("идёт переговоры");
  });

  it("confirm / result / notify texts frame the money honestly", () => {
    expect(formatPayoutConfirm(item)).toContain("Отметить выплату?");
    expect(formatPayoutConfirm(item)).toContain(rub(900));
    expect(formatPayoutAllConfirm({ toPay: { sum: 2400, count: 3 }, unverified: { sum: 0, count: 0 }, paid: { sum: 0, count: 0 } })).toContain(rub(2400));
    expect(formatPayoutResult({ kind: "marked", amount: 900, bikeName: "BMW F800R" })).toContain("Выплата записана");
    expect(formatPayoutResult({ kind: "unmarked", amount: 900, bikeName: "BMW F800R" })).toContain("Возвращено в ожидание");
    expect(formatPayoutResult({ kind: "markedAll", amount: 2400, count: 3 })).toContain("обнулился");
    expect(formatPayoutNotifyText({ kind: "marked", amount: 900, bikeName: "BMW", actorLabel: "@paul" })).toContain("@paul");
    expect(formatPayoutNotifyText({ kind: "unmarked", amount: 900, bikeName: "BMW", actorLabel: "@paul" })).toContain("вернул отметку");
  });
});

// ── Wiring pins (source-level, the task105/106 discipline) ───────────────────

describe("task107 · wiring pins", () => {
  const commandHandler = src("app/webhook-handlers/commands/command-handler.ts");
  const wrapper = src("app/webhook-handlers/commands/rental-payout.ts");
  const verifyLib = src("app/franchize/lib/rental-verify.ts");
  const payoutServer = src("app/franchize/lib/rental-payout.ts");
  const panel = src("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");

  it("payo_ routes BEFORE the /doc router (which owns pay_) and after vrf_", () => {
    const vrfAt = commandHandler.indexOf('text.startsWith("vrf_ok_")');
    const payoAt = commandHandler.indexOf('text.startsWith("payo_")');
    const docPayAt = commandHandler.indexOf('text.startsWith("pay_")');
    expect(vrfAt).toBeGreaterThan(-1);
    expect(payoAt).toBeGreaterThan(vrfAt);
    expect(docPayAt).toBeGreaterThan(payoAt); // /doc router comes later
    expect(commandHandler).toContain("handleRentalPayoutCallbackCommand");
  });

  it("/payouts + /start payout deeplink are wired, survey untouched otherwise", () => {
    expect(commandHandler).toContain('"/payouts"');
    expect(commandHandler).toContain("isPayoutStartPayload(text)");
    expect(commandHandler).toContain("startCommand(chatId, userId");
    expect(wrapper).toContain('payload === "payout"');
  });

  it("payout stamps are optimistic-locked on verified status", () => {
    const stampAt = payoutServer.indexOf(".update({ payout: nextPayout");
    const lockedAt = payoutServer.indexOf('.eq("status", "verified")');
    expect(stampAt).toBeGreaterThan(-1);
    expect(lockedAt).toBeGreaterThan(stampAt);
  });

  it("authority: party OR owner-tier, never anonymous", () => {
    expect(payoutServer).toContain("canMarkPayout");
    expect(payoutServer).toContain("crew_members");
    expect(payoutServer).toContain('from("crews")');
  });

  it("mark-all never DMs per row (one summary instead) and is bounded", () => {
    const start = payoutServer.indexOf("export async function markAllPayouts");
    const end = payoutServer.indexOf("// ── Callback flow");
    const markAll = payoutServer.slice(start, end);
    expect(markAll).not.toContain("notifyPartiesAboutPayout");
    expect(markAll).toContain("stampRentalPayout");
  });

  it("verified DMs now carry the 💰 payout-hub button", () => {
    expect((verifyLib.match(/payo_hub_0/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(verifyLib).toContain("Мои выплаты");
  });

  it("web strip is read-only and gated: action exists, panel renders the 3 buckets", () => {
    const actions = src("app/franchize/server-actions/rental-payout-actions.ts");
    expect(actions).toContain("verifyCrewAccess");
    expect(actions).toContain("isOwner !== true");
    expect(panel).toContain("getMyPayoutSummaryAction");
    expect(panel).toContain("buildStartLink(\"payout\")");
    expect(panel).toContain("Не сверено");
  });

  it("SQL migration file exists and is idempotent", () => {
    const sql = src("docs/crewDocs/rental-verifications-payout-2026-10-18.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS payout jsonb");
    expect(sql).toContain("POST-CHECK FAILED");
  });
});
