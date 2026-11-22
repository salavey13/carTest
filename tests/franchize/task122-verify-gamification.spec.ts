// tests/franchize/task122-verify-gamification.spec.ts
//
// Task 122 (boss 2026-10-21, «gamify the сверка experience»):
//
//   «fucking gamify the shit out of it, make it the most pleasant part of the
//    work … notification can contain quick "next" latest unverified rental to
//    maybe look at … maybe show current "score", quick list of pending
//    verifications ready for final owner's touch»
//
// What landed:
//   1. Done-DM warm half (both verify paths — plain ✅✅ AND accepted deal):
//      ⚡️ speed flex (< 60 min, same window as verify_speedy), 🏆 explicit
//      ladder to the NEXT existing achievement, ✨ warm closer, ⏭ NEXT open
//      сверка pointer + 👀 deeplink button.
//   2. Payout hub: 🎯 «ready for your final ✅» party-targeted queue with
//      one-tap payo_ok_ buttons (re-render, no keyboard strip) + 🏅 счёт
//      сверк line; queued rows deduped from the paginated list.
//   3. Stale docstring fixed (admin ✅ is NOT final — task 120 semantics).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  nextUpLine,
  ruPlural,
  verificationSpeedLine,
  verifyProgressLine,
  warmCloserLine,
} from "@/app/franchize/lib/rental-verify-core";
import {
  buildPayoutItem,
  encodePayoutCallback,
  HUB_QUEUE_CAP,
  hubQueueOf,
  parsePayoutCallback,
  payoutHubKeyboard,
  formatPayoutHub,
  type PayoutItem,
  type PayoutSourceRow,
} from "@/app/franchize/lib/rental-payout-core";

const repo = (p: string) => resolve(__dirname, "../..", p);
const read = (p: string) => readFileSync(repo(p), "utf8");

const MIN = 60 * 1000;

describe("task122 · warm closers", () => {
  it("returns a non-empty line, stable per seed", () => {
    const a = warmCloserLine("8450ef3b-0788-41da-b33a-6223bdd8a668");
    const b = warmCloserLine("8450ef3b-0788-41da-b33a-6223bdd8a668");
    expect(a.length).toBeGreaterThan(5);
    expect(a).toBe(b);
  });

  it("varies across rentals (no single-line monotony)", () => {
    const distinct = new Set(
      Array.from({ length: 12 }, (_, i) => warmCloserLine(`rental-${i}`)),
    );
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  it("never throws on null/undefined seed", () => {
    expect(typeof warmCloserLine(null)).toBe("string");
    expect(typeof warmCloserLine(undefined)).toBe("string");
  });
});

describe("task122 · ruPlural", () => {
  it("russian plural rules", () => {
    expect(ruPlural(1, "сверку", "сверки", "сверок")).toBe("сверку");
    expect(ruPlural(2, "сверку", "сверки", "сверок")).toBe("сверки");
    expect(ruPlural(5, "сверку", "сверки", "сверок")).toBe("сверок");
    expect(ruPlural(11, "сверку", "сверки", "сверок")).toBe("сверок");
    expect(ruPlural(21, "сверку", "сверки", "сверок")).toBe("сверку");
    expect(ruPlural(22, "сверку", "сверки", "сверок")).toBe("сверки");
  });
});

describe("task122 · speed flex (⚡️, same 60-min window as verify_speedy)", () => {
  const now = Date.now();

  it("null when the confirm took longer than an hour", () => {
    expect(verificationSpeedLine(new Date(now - 61 * MIN).toISOString(), new Date(now).toISOString())).toBeNull();
  });

  it("null on unusable timestamps", () => {
    expect(verificationSpeedLine(null, new Date(now).toISOString())).toBeNull();
    expect(verificationSpeedLine("", "")).toBeNull();
    // reversed order → not a duration
    expect(verificationSpeedLine(new Date(now).toISOString(), new Date(now - 5 * MIN).toISOString())).toBeNull();
  });

  it("under a minute → «меньше минуты»", () => {
    const line = verificationSpeedLine(new Date(now - 20 * 1000).toISOString(), new Date(now).toISOString());
    expect(line).toContain("меньше минуты");
  });

  it("minutes carry correct ru plural", () => {
    expect(verificationSpeedLine(new Date(now - 12 * MIN).toISOString(), new Date(now).toISOString())).toBe(
      "⚡️ Молниеносно: сверка заняла 12 минут",
    );
    expect(verificationSpeedLine(new Date(now - 1 * MIN).toISOString(), new Date(now).toISOString())).toBe(
      "⚡️ Молниеносно: сверка заняла 1 минуту",
    );
    expect(verificationSpeedLine(new Date(now - 2 * MIN).toISOString(), new Date(now).toISOString())).toBe(
      "⚡️ Молниеносно: сверка заняла 2 минуты",
    );
  });
});

describe("task122 · achievement ladder (🏆 mirrors the profile catalog)", () => {
  it("targets Безупречная десятка below 10", () => {
    expect(verifyProgressLine(0)).toContain("Безупречная десятка 🧾");
    expect(verifyProgressLine(0)).toContain("ещё 10 сверок");
    expect(verifyProgressLine(9)).toContain("ещё 1 сверку");
  });

  it("targets Полсотни рукопожатий from 10 to 49", () => {
    expect(verifyProgressLine(10)).toContain("Полсотни рукопожатий 💯");
    expect(verifyProgressLine(10)).toContain("ещё 40 сверок");
    expect(verifyProgressLine(48)).toContain("ещё 2 сверки");
    expect(verifyProgressLine(49)).toContain("ещё 1 сверку");
  });

  // Task 123 (boss: «verify_100 tier»): the ladder continues past 50 —
  // 50..99 now point at «Сотня без споров 🎖», null only from 100 up.
  it("targets Сотня без споров from 50 to 99 (task123 ladder continuation)", () => {
    expect(verifyProgressLine(50)).toContain("Сотня без споров 🎖");
    expect(verifyProgressLine(50)).toContain("ещё 50 сверок");
    expect(verifyProgressLine(98)).toContain("ещё 2 сверки");
    expect(verifyProgressLine(99)).toContain("ещё 1 сверку");
  });

  it("null once the ladder is finished (100+)", () => {
    expect(verifyProgressLine(100)).toBeNull();
    expect(verifyProgressLine(120)).toBeNull();
  });

  it("negative/garbage counts are clamped, not thrown", () => {
    expect(verifyProgressLine(-3)).toContain("ещё 10 сверок");
  });
});

describe("task122 · next-up pointer (⏭)", () => {
  const base = { bikeName: "BMW F800R", amountRub: 700 };

  it("pending + party → ждёт вашего ✅", () => {
    const line = nextUpLine({ ...base, status: "pending", viewerIsOperator: true, viewerIsOwner: false });
    expect(line).toBe("⏭ Следующая сверка: BMW F800R · 700 ₽ — ждёт вашего ✅");
  });

  it("operator_confirmed + viewer is owner → осталось ваше ✅", () => {
    const line = nextUpLine({ ...base, status: "operator_confirmed", viewerIsOperator: false, viewerIsOwner: true });
    expect(line).toContain("осталось ваше ✅");
  });

  it("operator_confirmed + viewer is operator → осталось ✅ владельца", () => {
    const line = nextUpLine({ ...base, status: "operator_confirmed", viewerIsOperator: true, viewerIsOwner: false });
    expect(line).toContain("осталось ✅ владельца");
  });

  it("owner_confirmed + viewer is operator → осталось ваше ✅", () => {
    const line = nextUpLine({ ...base, status: "owner_confirmed", viewerIsOperator: true, viewerIsOwner: false });
    expect(line).toContain("осталось ваше ✅");
  });

  it("staff (neither party) → ждёт подтверждения сторон; html-escapes bike names", () => {
    const line = nextUpLine({
      bikeName: "Kawa <script>",
      amountRub: 500,
      status: "pending",
      viewerIsOperator: false,
      viewerIsOwner: false,
    });
    expect(line).toContain("Kawa &lt;script&gt;");
    expect(line).toContain("ждёт подтверждения сторон");
  });
});

// ── Hub queue (🎯 ready for the viewer's final ✅) ──────────────────────────

function row(partial: Partial<PayoutSourceRow> & { rental_id: string }): PayoutSourceRow {
  return {
    rental_id: partial.rental_id,
    crew_id: "crew-1",
    crew_slug: "vip-bike",
    status: "pending",
    operator_chat_id: "100",
    owner_chat_id: "200",
    requested_at: "2026-10-21T10:00:00Z",
    verified_at: null,
    snapshot: { bikeName: "BMW F800R", total: 700, totalCost: 5500 },
    negotiation: undefined,
    payout: undefined,
    ...partial,
  } as PayoutSourceRow;
}

function itemOf(r: PayoutSourceRow, viewer: string): PayoutItem {
  const item = buildPayoutItem(r, viewer);
  if (!item) throw new Error("expected a payout item");
  return item;
}

describe("task122 · hubQueueOf (party-targeted final-touch queue)", () => {
  it("operator_confirmed → only the OWNER party sees it; owner_confirmed → only the operator", () => {
    const rows = [
      row({ rental_id: "r1", status: "operator_confirmed" }), // owner 200 must confirm
      row({ rental_id: "r2", status: "owner_confirmed" }), // operator 100 must confirm
      row({ rental_id: "r3", status: "pending" }), // nobody's final touch yet
      row({ rental_id: "r4", status: "verified" }), // done
      row({ rental_id: "r5", status: "disputed" }), // blocked
    ];
    const forOwner = hubQueueOf(rows.map((r) => itemOf(r, "200")));
    expect(forOwner.map((i) => i.rentalId)).toEqual(["r1"]);
    const forOperator = hubQueueOf(rows.map((r) => itemOf(r, "100")));
    expect(forOperator.map((i) => i.rentalId)).toEqual(["r2"]);
  });

  it("paid rows never re-enter the queue", () => {
    const r = row({
      rental_id: "paid1",
      status: "operator_confirmed",
      payout: { operator: { marked: true, at: "2026-10-21T11:00:00Z", by: "200" } },
    });
    expect(hubQueueOf([itemOf(r, "200")])).toEqual([]);
  });

  it("review #7: an open deal proposal keeps the row OUT of the queue (numbers not final)", () => {
    const r = row({
      rental_id: "neg1",
      status: "operator_confirmed",
      negotiation: { open: { by: "100", role: "operator", at: "2026-10-21T10:30:00Z", split: { base: 500, equipment: 100, overprice: 100 } } },
    });
    expect(hubQueueOf([itemOf(r, "200")])).toEqual([]);
  });

  it("review #4: a viewer who is NEITHER party sees no queue rows even owner-tier", () => {
    const rows = [
      row({ rental_id: "r1", status: "operator_confirmed" }),
      row({ rental_id: "r2", status: "owner_confirmed" }),
    ];
    expect(hubQueueOf(rows.map((r) => itemOf(r, "999")))).toEqual([]);
  });

  it("newest requested first, capped at HUB_QUEUE_CAP", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        rental_id: `q${i}`,
        status: "operator_confirmed",
        requested_at: new Date(Date.UTC(2026, 9, 1 + i, 10)).toISOString(),
      }),
    );
    const queue = hubQueueOf(rows.map((r) => itemOf(r, "200")));
    expect(queue).toHaveLength(HUB_QUEUE_CAP);
    // newest (Oct 8) first
    expect(queue[0].rentalId).toBe("q7");
    expect(queue[4].rentalId).toBe("q3");
  });
});

describe("task122 · payout hub text + keyboard", () => {
  const queueItem = itemOf(row({ rental_id: "r1", status: "operator_confirmed" }), "200");

  it("renders the 🎯 queue block and 🏅 score line", () => {
    const text = formatPayoutHub({
      scopeLabel: "все экипажи",
      summary: { toPay: { sum: 0, count: 0 }, unverified: { sum: 0, count: 0 }, paid: { sum: 0, count: 0 } },
      items: [],
      page: 0,
      hasMore: false,
      isOwnerTier: true,
      queue: [queueItem],
      score: { sum: 5500, count: 8 },
    });
    expect(text).toContain("🎯 <b>Готовы к вашему ✅</b> — вторая сторона уже подтвердила:");
    expect(text).toContain("• BMW F800R — 700 ₽ · ждёт вас");
    // Intl ru-RU groups thousands with U+00A0
    expect(text).toContain(`🏅 Счёт сверк: <b>5\u00A0500 ₽</b> (8 аренд)`);
  });

  it("no score line when the piggy bank is empty; no queue block when queue is empty", () => {
    const text = formatPayoutHub({
      scopeLabel: "Мои комиссии",
      summary: { toPay: { sum: 0, count: 0 }, unverified: { sum: 0, count: 0 }, paid: { sum: 0, count: 0 } },
      items: [],
      page: 0,
      hasMore: false,
      isOwnerTier: false,
      queue: [],
      score: { sum: 0, count: 0 },
    });
    expect(text).not.toContain("Счёт сверк");
    expect(text).not.toContain("Готовы к вашему");
  });

  it("queue buttons ride FIRST with the payo_ok_ opcode (review #1: vrf_ok_ would strip the hub keyboard)", () => {
    const kb = payoutHubKeyboard([], {
      page: 0,
      hasMore: false,
      toPayCount: 0,
      queue: [queueItem],
    });
    expect(kb[0][0].text).toContain("✅ BMW F800R · 700 ₽");
    expect(kb[0][0].callback_data).toBe("payo_ok_r1");
    // round-trip through the grammar
    const parsed = parsePayoutCallback(kb[0][0].callback_data);
    expect(parsed?.action).toBe("ok");
    expect(parsed?.rentalId).toBe("r1");
  });

  it("long bike names are trimmed inside the button", () => {
    const long = itemOf(
      row({ rental_id: "long", status: "operator_confirmed", snapshot: { bikeName: "Kawasaki ZZR1400 ABS Sport", total: 500 } }),
      "200",
    );
    const kb = payoutHubKeyboard([], { page: 0, hasMore: false, toPayCount: 0, queue: [long] });
    expect(kb[0][0].text.length).toBeLessThanOrEqual(40);
  });
});

// ── Wiring pins (server half) ───────────────────────────────────────────────

describe("task122 · wiring pins", () => {
  const verifyTs = read("app/franchize/lib/rental-verify.ts");
  const payoutTs = read("app/franchize/lib/rental-payout.ts");
  const payoutCore = read("app/franchize/lib/rental-payout-core.ts");
  const verifyCore = read("app/franchize/lib/rental-verify-core.ts");

  it("both verify paths funnel through sendVerifiedDoneDms (one game feel everywhere)", () => {
    expect(verifyTs).toContain("async function sendVerifiedDoneDms");
    expect(verifyTs.match(/await sendVerifiedDoneDms\(/g)?.length).toBe(2);
    expect(verifyTs).toContain("findNextVerificationFor({");
    expect(verifyTs).toContain("verifyProgressLine(await countVerifiedFor(chatId)");
    expect(verifyTs).toContain("warmCloserLine(params.rentalId)");
    expect(verifyTs).toContain("verificationSpeedLine(params.requestedAtIso, params.verifiedAtIso)");
    expect(verifyTs).toContain("nextUpLine({");
  });

  it("next-up deeplink rides on buildTelegramAppLink rental_ grammar (cross-crew bot aware)", () => {
    expect(verifyTs).toContain("url: buildTelegramAppLink(linkBot, `rental_${next.rentalId}`)");
    expect(verifyTs).toContain("👀 Следующая: ");
    // review #3: cross-crew pointers resolve THAT crew's bot
    expect(verifyTs).toContain("linkBot = (await resolveCrewBotUsername(next.crewSlug)) || botUsername");
  });

  it("payout hub passes queue + score (hub is the score surface too)", () => {
    expect(payoutTs).toContain("const queue = hubQueueOf(items);");
    expect(payoutTs).toContain("const score = await loadOperatorVerifiedScore(viewer).catch(() => null);");
    expect(payoutTs).toContain("queue: data.queue,");
    expect(payoutTs).toContain("score: data.score,");
    expect(payoutCore).toContain("export function hubQueueOf");
    expect(payoutCore).toContain('callback_data: encodePayoutCallback("ok", q.rentalId)');
  });

  it("review #1: the hub queue tap re-renders the hub instead of stripping its keyboard", () => {
    expect(payoutTs).toContain('case "ok": {');
    expect(payoutTs).toContain("data: `vrf_ok_${parsed.rentalId}`");
    // the strip inside handleRentalVerifyCallback must NOT fire for the hub:
    // the ok-case calls the verify machine WITHOUT messageId, then re-renders
    const okCase = payoutTs.slice(payoutTs.indexOf('case "ok": {'), payoutTs.indexOf('case "all": {'));
    expect(okCase).toContain("await renderHubInto({ chatId, page: 0, messageId });");
    expect(okCase).not.toContain("messageId:");
  });

  it("review #8: queued rentals are deduped out of the paginated list", () => {
    expect(payoutTs).toContain("const queueIds = new Set(data.queue.map((q) => q.rentalId));");
    expect(payoutTs).toContain("data.items.filter((i) => !queueIds.has(i.rentalId))");
  });

  it("review #4: next-pointer whitelist pins (never disputed/verified, excludes the just-confirmed row)", () => {
    expect(verifyTs).toContain('const openStatuses = ["pending", "operator_confirmed", "owner_confirmed"] as const;');
    expect(verifyTs).toContain('.in("status", [...openStatuses])');
    expect((verifyTs.match(/\.neq\("rental_id", exclude\)/g) || []).length).toBe(2);
    expect(verifyTs).toContain("crew_slug, requested_at, snapshot");
  });

  it("review #5: the deal path IS a verified сверка — score tail pinned", () => {
    expect(verifyTs).toContain("dealScoreTail");
    expect(verifyTs).toContain("commissionOf({ snapshot: current.snapshot, negotiation: acc.state })");
  });

  it("staff docstring no longer claims admin ✅ verifies instantly (task 120 semantics)", () => {
    expect(verifyTs).not.toContain("✅ verifies instantly");
    expect(verifyTs).toContain("the FINAL word always stays with the owner party");
  });

  it("done-DM keeps the 💰 Мои выплаты entry (task 107 untouched)", () => {
    expect(verifyTs).toContain('text: "💰 Мои выплаты", callback_data: "payo_hub_0"');
  });

  it("core helper surfaces exist", () => {
    expect(verifyCore).toContain("export function warmCloserLine");
    expect(verifyCore).toContain("export function verificationSpeedLine");
    expect(verifyCore).toContain("export function verifyProgressLine");
    expect(verifyCore).toContain("export function nextUpLine");
    expect(verifyCore).toContain("export function ruPlural");
  });
});
