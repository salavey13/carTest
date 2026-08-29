import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter18 — analytics counters split + subrenter workflow + bonus tasks:
//   T1. bottom sheet px-height + never-stuck-at-half (source guards)
//   T2. quick counters: «Экипировка» + «Субарендаторам» (super total intact)
//   T3. subrenter activation TG notification (3 activation paths)
//   T4. subrenter monthly earnings + users.metadata.subrenterOf ownership flag
//   T5. owner monthly payout sheet
//   T6. achievements TG notifications (achiever + owner + admins)
//   T7. prominent «Аренда создана!» dialog on the order page
// ─────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  schema: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    schema: mocks.schema,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/webhook-handlers/actions/sendComplexMessage", () => ({
  sendComplexMessage: vi.fn(async () => ({ success: true })),
}));

import {
  getEquipmentCostPart,
  getBikeRevenuePart,
  getSubrenterCut,
  getCrewPart,
  buildSubrenterActivationMessage,
  buildAchievementNotificationMessage,
  normalizeMonthKey,
  currentMskMonthKey,
  shiftMonthKey,
  summarizeSubrenterMonth,
  SUBRENTER_SHARE_PCT,
  SUBRENTER_EQUIPMENT_UNIT_PRICES,
} from "@/app/franchize/lib/subrenter-economics";
import { notifySubrenterOfRentalActivation } from "@/app/franchize/lib/subrenter-notify";
import { computeAnalyticsKpis } from "@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";

// ── Pure money math ─────────────────────────────────────────────────────────

describe("iter18 · subrenter-economics (pure)", () => {
  it("unit price table mirrors the operator list (charger free, helmet 1000, soft gear 500)", () => {
    expect(SUBRENTER_EQUIPMENT_UNIT_PRICES.helmets).toBe(1000);
    expect(SUBRENTER_EQUIPMENT_UNIT_PRICES.gloves).toBe(500);
    expect(SUBRENTER_EQUIPMENT_UNIT_PRICES.charger).toBe(0);
    expect(SUBRENTER_SHARE_PCT).toBe(50);
  });

  it("getEquipmentCostPart: quantities, booleans, freebies, unknown keys", () => {
    expect(getEquipmentCostPart(null)).toBe(0);
    expect(getEquipmentCostPart({})).toBe(0);
    expect(getEquipmentCostPart({ equipment: { helmets: 2 } })).toBe(2000);
    expect(getEquipmentCostPart({ equipment: { gloves: true } })).toBe(500);
    expect(getEquipmentCostPart({ equipment: { helmets: 1, gloves: 1, jacket: true, charger: true } })).toBe(2000);
    expect(getEquipmentCostPart({ equipment: { boots: 2 } })).toBe(1000);
    // unknown gear type falls back to the soft-gear price
    expect(getEquipmentCostPart({ equipment: { wetsuit: 1 } })).toBe(500);
    // zero / false values contribute nothing
    expect(getEquipmentCostPart({ equipment: { helmets: 0, gloves: false } })).toBe(0);
    // array-shaped garbage is ignored
    expect(getEquipmentCostPart({ equipment: [1, 2, 3] })).toBe(0);
  });

  it("getEquipmentCostPart is GIFT-aware: «перчатки в подарок» bring 0 ₽", () => {
    // live shape of the yamaha-r7 rental (gloves_gift: true)
    expect(getEquipmentCostPart({ equipment: { gloves: 1, gloves_gift: true } })).toBe(0);
    // mixed: gifted gloves + 1 paid helmet
    expect(getEquipmentCostPart({ equipment: { helmets: 1, gloves: 1, gloves_gift: true } })).toBe(1000);
    // gift flag on another item does not hide the priced one
    expect(getEquipmentCostPart({ equipment: { helmets: 2, jacket_gift: true, jacket: true } })).toBe(2000);
  });

  it("getBikeRevenuePart / getSubrenterCut / getCrewPart math", () => {
    expect(getBikeRevenuePart(12000, 500)).toBe(11500);
    expect(getBikeRevenuePart("12000", "500")).toBe(11500); // string-spec bikes
    expect(getBikeRevenuePart(300, 1000)).toBe(0); // clamped, never negative
    // cut = 50% of the bike part
    expect(getSubrenterCut(12000, 500)).toBe(5750);
    expect(getSubrenterCut(12000, 0)).toBe(6000);
    expect(getSubrenterCut(3500, 500)).toBe(1500);
    // rounding to whole rubles
    expect(getSubrenterCut(1151, 0)).toBe(576);
    // pct override + bounds
    expect(getSubrenterCut(1000, 0, 40)).toBe(400);
    expect(getSubrenterCut(1000, 0, 200)).toBe(1000);
    expect(getSubrenterCut(1000, 0, -5)).toBe(0);
    // crew keeps equipment + (100−pct)% of the bike part
    expect(getCrewPart(12000, 500)).toBe(6250);
    expect(getCrewPart(3500, 500)).toBe(2000);
    // gift equipment: 12000 with gifted gloves → cut is the full half
    expect(getSubrenterCut(12000, getEquipmentCostPart({ equipment: { gloves: 1, gloves_gift: true } }))).toBe(6000);
  });

  it("buildSubrenterActivationMessage: figures, equipment exclusion, escaping", () => {
    const text = buildSubrenterActivationMessage({
      bikeTitle: "Yamaha R7 < SPORT >",
      renterName: "Иван",
      totalRub: 12000,
      equipmentRub: 500,
      cutRub: 5750,
      shortRentalId: "a963fda9",
      startDate: "2026-08-29T12:00:00+03:00",
      endDate: "2026-08-30T12:00:00+03:00",
      crewName: "VIP Bike",
    });
    // ru-RU grouping uses NBSP — normalize for readable assertions
    const flat = text.replace(/\u00A0/g, " ");
    expect(flat).toContain("Yamaha R7 &lt; SPORT &gt;"); // HTML-escaped
    expect(flat).toContain("12 000 ₽");
    expect(flat).toContain("Экипировка (не делится): 500 ₽");
    expect(flat).toContain("5 750 ₽");
    expect(flat).toContain("50%");
    expect(flat).toContain("a963fda9");
    expect(flat).toContain("Иван");

    // no equipment line when equipment is 0
    const bare = buildSubrenterActivationMessage({
      bikeTitle: "Yamaha R7",
      totalRub: 5400,
      equipmentRub: 0,
      cutRub: 2700,
    });
    const flatBare = bare.replace(/\u00A0/g, " ");
    expect(flatBare).not.toContain("не делится");
    expect(flatBare).toContain("5 400 ₽");
    expect(flatBare).toContain("2 700 ₽");
  });

  it("month keys: normalize / current / shift across year boundary", () => {
    expect(normalizeMonthKey("2026-08")).toBe("2026-08");
    expect(normalizeMonthKey(" 2026-08 ")).toBe("2026-08");
    expect(normalizeMonthKey("2026-13")).toBe("");
    expect(normalizeMonthKey("2026-8")).toBe("");
    expect(normalizeMonthKey("garbage")).toBe("");
    expect(normalizeMonthKey(null)).toBe("");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2025-12", 1)).toBe("2026-01");
    expect(shiftMonthKey("2026-08", 4)).toBe("2026-12");
    expect(shiftMonthKey("2026-08", 5)).toBe("2027-01");
    expect(currentMskMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("summarizeSubrenterMonth aggregates rows with the money split + docLinks", () => {
    const summary = summarizeSubrenterMonth(
      "2026-08",
      [
        {
          rentalId: "r1",
          bikeId: "yamaha-r7",
          bikeLabel: "Yamaha R7",
          status: "active",
          totalCost: 12000,
          agreedStartDate: "2026-08-29T12:00:00+03:00",
          agreedEndDate: "2026-08-30T12:00:00+03:00",
          metadata: { equipment: { gloves: 1, gloves_gift: true } },
        },
        {
          rentalId: "r2",
          bikeId: "yamaha-r7",
          bikeLabel: "Yamaha R7",
          status: "completed",
          totalCost: "5400", // string-spec bike
          agreedStartDate: "2026-08-04T10:00:00+03:00",
          agreedEndDate: "2026-08-04T16:00:00+03:00",
          metadata: null,
        },
      ],
      { docLinkBase: "/franchize/vip-bike/rental" },
    );
    expect(summary.month).toBe("2026-08");
    expect(summary.rentalCount).toBe(2);
    expect(summary.totalRub).toBe(17400);
    expect(summary.equipmentRub).toBe(0); // gloves were a gift
    expect(summary.bikePartRub).toBe(17400);
    expect(summary.cutRub).toBe(8700);
    expect(summary.rentals[0].cutRub).toBe(6000);
    expect(summary.rentals[1].cutRub).toBe(2700);
    expect(summary.rentals[0].docLink).toBe("/franchize/vip-bike/rental/r1");
  });

  it("buildAchievementNotificationMessage: role variants + escaping", () => {
    const achiever = buildAchievementNotificationMessage({
      crewName: "VIP Bike",
      achieverName: "Сергей",
      achieverUsername: "salavey13",
      achievementTitle: "Аналитик <Про> 📊",
      achievementDescription: "Открыл аналитику",
      recipientRole: "achiever",
    });
    expect(achiever).toContain("Достижение получено");
    expect(achiever).toContain("Аналитик &lt;Про&gt;");
    expect(achiever).toContain("Так держать");

    const owner = buildAchievementNotificationMessage({
      crewName: "VIP Bike",
      achieverName: "Сергей",
      achieverUsername: "salavey13",
      achievementTitle: "Аналитик 📊",
      recipientRole: "owner",
    });
    expect(owner).toContain("@salavey13");
    expect(owner).toContain("Новое достижение в экипаже");

    // username missing → falls back to the full name
    const anon = buildAchievementNotificationMessage({
      crewName: "VIP Bike",
      achieverName: "Сергей Морозов",
      achievementTitle: "Первая аренда",
      recipientRole: "owner",
    });
    expect(anon).toContain("Сергей Морозов");
  });
});

// ── Analytics quick counters (T2) ───────────────────────────────────────────

describe("iter18 · computeAnalyticsKpis — money split counters", () => {
  const DATE = "2026-08-29";
  const baseRow = {
    status: "completed",
    requested_start_date: "2026-08-29T12:00:00+03:00",
    agreed_end_date: "2026-08-29T18:00:00+03:00",
  };

  it("super total (revenueToday) is unchanged by the new counters — regression guard", () => {
    const rows = [
      { ...baseRow, total_cost: 12000, metadata: { equipment: { helmets: 1 } }, subrenterChatId: "687580818" },
      { ...baseRow, total_cost: 3500, metadata: null, subrenterChatId: null },
    ];
    const kpis = computeAnalyticsKpis(rows, DATE);
    // same sum the old implementation produced
    expect(kpis.revenueToday).toBe(15500);
    expect(kpis.totalToday).toBe(2);
  });

  it("equipment part counts ONLY equipment revenue of the day's real-status rows", () => {
    const rows = [
      { ...baseRow, total_cost: 12000, metadata: { equipment: { helmets: 1, gloves: 1 } } },
      { ...baseRow, total_cost: 3500, metadata: { equipment: { gloves: 1, gloves_gift: true } } },
      { ...baseRow, status: "cancelled", total_cost: 9999, metadata: { equipment: { helmets: 2 } } },
    ];
    const kpis = computeAnalyticsKpis(rows, DATE);
    expect(kpis.equipmentPartToday).toBe(1500); // 1000 + 500; gift gloves 0; cancelled excluded
  });

  it("owed to subrenters: 50% of the BIKE part of subrented bikes only", () => {
    const rows = [
      // subrented bike, 12000 with 1 helmet (1000): cut = 50% × 11000 = 5500
      { ...baseRow, total_cost: 12000, metadata: { equipment: { helmets: 1 } }, subrenterChatId: "687580818" },
      // OWN bike — no split
      { ...baseRow, total_cost: 3500, metadata: null, subrenterChatId: null },
      // subrented but cancelled — excluded from revenue rows
      { ...baseRow, status: "cancelled", total_cost: 8000, metadata: null, subrenterChatId: "687580818" },
    ];
    const kpis = computeAnalyticsKpis(rows, DATE);
    expect(kpis.owedToSubrentersToday).toBe(5500);
  });

  it("zero-state: no equipment and no subrented bikes → both counters are 0", () => {
    const kpis = computeAnalyticsKpis(
      [{ ...baseRow, total_cost: 1000, metadata: null }],
      DATE,
    );
    expect(kpis.equipmentPartToday).toBe(0);
    expect(kpis.owedToSubrentersToday).toBe(0);
  });
});

// ── notifySubrenterOfRentalActivation (T3, mocked supabase) ─────────────────

describe("iter18 · notifySubrenterOfRentalActivation", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  function chainOnce(result: unknown) {
    const then = {
      maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    };
    const eq = { ...then };
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => eq) })),
    };
  }

  it("sends nothing when the bike has no subrenter_chat_id", async () => {
    const q = chainOnce({
      rental_id: "r1",
      total_cost: 5000,
      metadata: {},
      vehicle: { id: "bike", make: "Honda", model: "CBR", specs: {} },
    });
    mocks.from.mockReturnValueOnce(q);
    const { sendComplexMessage } = await import("@/app/webhook-handlers/actions/sendComplexMessage");
    const chatId = await notifySubrenterOfRentalActivation({ rentalId: "r1" });
    expect(chatId).toBe("");
    expect(sendComplexMessage).not.toHaveBeenCalled();
  });

  it("sends the cut message to the partner when the bike IS subrented", async () => {
    const q = chainOnce({
      rental_id: "a963fda9-0000-0000-0000-000000000000",
      total_cost: 12000,
      metadata: { equipment: { gloves: 1, gloves_gift: true }, renter_name: "Кирилл" },
      agreed_start_date: "2026-08-29T12:00:00+03:00",
      agreed_end_date: "2026-08-30T12:00:00+03:00",
      vehicle: { id: "yamaha-r7", make: "Yamaha", model: "R7", specs: { subrenter_chat_id: "687580818" } },
    });
    mocks.from.mockReturnValueOnce(q);
    const { sendComplexMessage } = await import("@/app/webhook-handlers/actions/sendComplexMessage");
    const chatId = await notifySubrenterOfRentalActivation({ rentalId: "a963fda9-0000-0000-0000-000000000000" });
    expect(chatId).toBe("687580818");
    expect(sendComplexMessage).toHaveBeenCalledTimes(1);
    const [calledChatId, text, , opts] = (sendComplexMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledChatId).toBe("687580818");
    expect(opts?.parseMode).toBe("HTML");
    const flat = String(text).replace(/\u00A0/g, " ");
    expect(flat).toContain("Yamaha R7");
    expect(flat).toContain("Кирилл");
    // gift gloves → bike part 12000 → cut 6000
    expect(flat).toContain("6 000 ₽");
    expect(flat).not.toContain("не делится"); // equipment part is 0 → no line
  });

  it("never throws when the rental lookup fails (non-fatal)", async () => {
    const q = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
        })),
      })),
    };
    mocks.from.mockReturnValueOnce(q);
    await expect(
      notifySubrenterOfRentalActivation({ rentalId: "missing" }),
    ).resolves.toBe("");
  });
});

// ── Source guards (wiring of everything above) ───────────────────────────────

describe("iter18 · source guards (wiring)", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  // T1 — sheet fix
  it("AnalyticsMobileSheet: px viewport height + never rests at half size", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsMobileSheet.tsx");
    // strip // line comments first — the docblock legitimately mentions the
    // historical `max-h-[90vh]` it replaced
    const code = src.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("h-[90vh]");
    expect(src).toContain("useViewportHeightPx");
    expect(src).toContain("useAnimationControls");
    // after a non-dismissing drag the sheet ALWAYS returns to the full open position
    expect(src).toMatch(/onDragEnd[\s\S]*?controls\.start\(\{\s*y: 0/);
    expect(src).toContain("90dvh"); // pre-mount CSS fallback
    // the sheet height comes from the measured viewport in px
    expect(src).toContain("height: `${sheetHeightPx}px`");
  });

  it("useViewportHeightPx listens to TG viewportChanged + resize + rotation", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/hooks/useViewportHeightPx.ts");
    expect(src).toContain("viewportStableHeight");
    expect(src).toContain("viewportChanged");
    expect(src).toContain("orientationchange");
    expect(src).toContain("innerHeight");
  });

  // T2 — KPI cards
  it("AnalyticsKPICards renders 6 counters, super total card untouched", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsKPICards.tsx");
    expect(src).toContain("equipmentPartToday");
    expect(src).toContain("owedToSubrentersToday");
    expect(src).toContain("Экипировка");
    expect(src).toContain("Субарендаторам");
    // the headline revenue card keeps its label + green color
    expect(src).toMatch(/label: "Выручка"[\s\S]*?kpis\.revenueToday\.toLocaleString/);
    expect(src).toContain("#22c55e");
  });

  it("AnalyticsClientV2 maps subrenterChatId from vehicle specs", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(src).toContain("subrenterChatIdFromSpecs");
    expect(src).toContain("subrenter_chat_id");
  });

  // T3 — activation notifications wired into all three paths
  it("activateRental (web 2-step) notifies the subrenter", () => {
    const src = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toMatch(/activateRental[\s\S]*?notifySubrenterOfRentalActivation/);
  });

  it("updateRentalStatus notifies the subrenter on manual flips to active", () => {
    const src = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toMatch(/updateRentalStatus[\s\S]*?status === "active" && rental && rental\.old_status !== "active"[\s\S]*?notifySubrenterOfRentalActivation/);
  });

  it("activateRentalIfReady (auto) notifies the subrenter", () => {
    const src = read("app/franchize/server-actions/rental-activation.ts");
    expect(src).toContain("notifySubrenterOfRentalActivation");
  });

  // T4 — ownership flag + monthly earnings
  it("setBikeSubrenterAction maintains users.metadata.subrenterOf (backwards link)", () => {
    const src = read("app/franchize/server-actions/bike-subrenter.ts");
    expect(src).toContain("syncUserSubrenterFlag");
    expect(src).toContain("previousSubrenterChatId"); // clear/reassign refreshes the OLD partner too
    expect(src).toContain("subrenterOf");
  });

  it("getSubrenterOwnedBikesAction self-heals the ownership flag", () => {
    const src = read("app/franchize/server-actions/subrenter-monitoring.ts");
    expect(src).toMatch(/getSubrenterOwnedBikesAction[\s\S]*?syncUserSubrenterFlag/);
  });

  it("monthly earnings + payouts actions exist with MSK month scoping", () => {
    const src = read("app/franchize/server-actions/subrenter-monitoring.ts");
    expect(src).toContain("getSubrenterMonthlyEarningsAction");
    expect(src).toContain("getSubrentersMonthlyPayoutsAction");
    expect(src).toContain("Europe/Moscow");
    expect(src).toContain("summarizeSubrenterMonth");
  });

  it("ProfileClient renders month switchers for both panels", () => {
    const src = read("app/franchize/[slug]/profile/ProfileClient.tsx");
    expect(src).toContain("getSubrenterMonthlyEarningsAction");
    expect(src).toContain("getSubrentersMonthlyPayoutsAction");
    expect(src).toContain("shiftMonthKey");
    expect(src).toContain("Заработок за месяц");
    expect(src).toContain("Выплаты субарендаторам");
  });

  // T6 — achievement notifications
  it("grantFranchizeAchievementAction fires TG notifications on NEW unlocks only", () => {
    const src = read("app/franchize/profile-actions.ts");
    expect(src).toContain("notifyAchievementUnlocked");
    expect(src).toMatch(/if \(!alreadyUnlocked\) \{[\s\S]*?notifyAchievementUnlocked/);
    // notifies achiever + owner + crew admins, deduped
    expect(src).toMatch(/recipientRole: "achiever"/);
    expect(src).toMatch(/recipientRole: "owner"/);
    expect(src).toMatch(/\["owner", "admin", "co_owner"\]/);
  });

  // T7 — prominent success dialog
  it("OrderPageClient: prominent RENTAL CREATED dialog replaces the fade-away toast", () => {
    const src = read("app/franchize/components/OrderPageClient.tsx");
    expect(src).toContain("successDialog");
    expect(src).toContain("Аренда создана!");
    expect(src).toContain("aria-modal");
    // explicit close button (X) + a big Закрыть button
    expect(src).toMatch(/aria-label="Закрыть"[\s\S]*?X className="h-6 w-6"/);
    expect(src).toContain("Повторная отправка не нужна");
    // the success branch no longer toasts (the dialog is the confirmation)
    expect(src).not.toMatch(/toast\.success\(submitPayload\.flowType/);
  });
});
