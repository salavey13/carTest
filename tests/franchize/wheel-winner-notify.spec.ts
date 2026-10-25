// tests/franchize/wheel-winner-notify.spec.ts
//
// Boss codereview (2026-10-11, B3): уведомления о выигрыше на колесе фортуны.
//   1. pure TG-строители сообщений — промокод ОБЯЗАН быть в тексте (и
//      победителю, и сводке owner/админам), HTML экранируется;
//   2. dedupe-слот: один пакет уведомлений на (slug, user, код) в сутки;
//   3. delivery: победителю + всем crew-получателям, победитель исключён из
//      crew-листа; telegramDeliver never-throws.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const deliverMock = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: (...args: unknown[]) => deliverMock(...(args as [])),
}));

import {
  __resetWheelWinNotifyLimiterForTests,
  buildWheelCrewNotifyHtml,
  buildWheelWinnerDmHtml,
  claimWheelWinNotifySlot,
  resolveWheelWinnerDisplayName,
  wheelWinNotifyDay,
  wheelWinNotifyKey,
  notifyWheelWinners,
} from "@/app/franchize/lib/wheel-winner-notify";
import { wheelPrizeForCode } from "@/app/franchize/lib/wheel-of-fortune";

beforeEach(() => {
  vi.clearAllMocks();
  deliverMock.mockImplementation(async () => ({ ok: true }));
  __resetWheelWinNotifyLimiterForTests();
});

describe("wheel prize lookup (server truth)", () => {
  it("resolves every hardcoded wheel code to a prize", () => {
    for (const code of ["WHEEL1000", "WHEEL2000", "WHEEL5000", "WHEEL15"]) {
      const prize = wheelPrizeForCode(code);
      expect(prize, `prize for ${code}`).not.toBeNull();
      expect(prize?.code).toBe(code);
      expect(prize?.label.length).toBeGreaterThan(0);
      expect(prize?.description).toContain(code);
    }
  });

  it("rejects non-wheel codes (server does not trust the client)", () => {
    expect(wheelPrizeForCode("PROMORIDE")).toBeNull();
    expect(wheelPrizeForCode("FAKE1000")).toBeNull();
    expect(wheelPrizeForCode("")).toBeNull();
  });

  it("normalizes case and whitespace like the cart input", () => {
    expect(wheelPrizeForCode("  wheel5000 ")?.code).toBe("WHEEL5000");
  });
});

describe("winner DM builder", () => {
  it("includes the promo code in the text", () => {
    const html = buildWheelWinnerDmHtml({
      prizeLabel: "2 000 ₽",
      promoCode: "WHEEL2000",
      description: "Промокод WHEEL2000 — скидка 2000 ₽ на аренду или покупку",
      crewBrandName: "Vip Bike",
    });
    expect(html).toContain("WHEEL2000");
    expect(html).toContain("2 000 ₽");
    expect(html).toContain("Vip Bike");
  });

  it("escapes HTML in user-controlled brand names", () => {
    const html = buildWheelWinnerDmHtml({
      prizeLabel: "1 000 ₽",
      promoCode: "WHEEL1000",
      description: "",
      crewBrandName: "<b>Evil</b>",
    });
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(html).not.toContain("<b>Evil</b>");
  });
});

describe("crew notify builder", () => {
  it("names the winner and the promo code", () => {
    const html = buildWheelCrewNotifyHtml({
      winnerName: "Ivan",
      winnerUsername: "ivan_rides",
      prizeLabel: "5 000 ₽",
      promoCode: "WHEEL5000",
      crewBrandName: "Vip Bike",
    });
    expect(html).toContain("@ivan_rides");
    expect(html).toContain("WHEEL5000");
    expect(html).toContain("5 000 ₽");
  });

  it("falls back to the plain name when there is no username", () => {
    const html = buildWheelCrewNotifyHtml({
      winnerName: "Ivan",
      winnerUsername: null,
      prizeLabel: "15%",
      promoCode: "WHEEL15",
      crewBrandName: "Vip Bike",
    });
    expect(html).toContain("Ivan");
    expect(html).not.toContain("@");
  });

  it("boss 2026-10-25: shows nickname AND name together when both known", () => {
    const html = buildWheelCrewNotifyHtml({
      winnerName: "Сергей Затонский",
      winnerUsername: "zaton_rides",
      prizeLabel: "2 000 ₽",
      promoCode: "WHEEL2000",
      crewBrandName: "VIP BIKE",
    });
    expect(html).toContain("@zaton_rides · Сергей Затонский");
    // поздравительный тон (boss: «congratulate more kinda»)
    expect(html).toContain("Ура!");
  });

  it("does not duplicate the name when it equals the username", () => {
    const html = buildWheelCrewNotifyHtml({
      winnerName: "I_O_S_NN",
      winnerUsername: "I_O_S_NN",
      prizeLabel: "2 000 ₽",
      promoCode: "WHEEL2000",
      crewBrandName: "VIP BIKE",
    });
    expect(html).toContain("@I_O_S_NN");
    expect(html).not.toContain("@I_O_S_NN · I_O_S_NN");
  });
});

describe("winner display name resolution (boss 2026-10-25: «525838009 выиграл» too raw)", () => {
  it("prefers the TG profile from initData", () => {
    const resolved = resolveWheelWinnerDisplayName(
      { username: "tg_rider", fullName: "Сергей Затонский" },
      { username: "db_rider", full_name: "Из базы" },
      "525838009",
    );
    expect(resolved).toEqual({ name: "Сергей Затонский", username: "tg_rider" });
  });

  it("cookie sessions (tg: null) fall back to the users profile full_name", () => {
    const resolved = resolveWheelWinnerDisplayName(
      null,
      { username: "db_rider", full_name: "Сергей Затонский" },
      "525838009",
    );
    expect(resolved).toEqual({ name: "Сергей Затонский", username: "db_rider" });
  });

  it("uses the DB username as the name when no full name is stored", () => {
    const resolved = resolveWheelWinnerDisplayName(null, { username: "db_rider", full_name: null }, "525838009");
    expect(resolved).toEqual({ name: "db_rider", username: "db_rider" });
  });

  it("last resort keeps the raw chat id (anonymous spin with no profile)", () => {
    const resolved = resolveWheelWinnerDisplayName(null, null, "525838009");
    expect(resolved).toEqual({ name: "525838009", username: null });
  });

  it("trims whitespace from the stored values", () => {
    const resolved = resolveWheelWinnerDisplayName(null, { username: "  spaced  ", full_name: "  Имя  " }, "42");
    expect(resolved).toEqual({ name: "Имя", username: "spaced" });
  });
});

describe("dedupe slot (one notify pack per slug+user+code+day)", () => {
  it("allows the first claim and blocks the same-day repeat", () => {
    const now = Date.UTC(2026, 9, 11, 12, 0, 0);
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now)).toBe(true);
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now + 60_000)).toBe(false);
  });

  it("does not cross-contaminate other users, codes or slugs", () => {
    const now = Date.UTC(2026, 9, 11, 12, 0, 0);
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now)).toBe(true);
    expect(claimWheelWinNotifySlot("vip-bike", "7813830016", "WHEEL2000", now)).toBe(true);
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL1000", now)).toBe(true);
    expect(claimWheelWinNotifySlot("nn-moto", "413553377", "WHEEL2000", now)).toBe(true);
  });

  it("reopens on the next UTC day (calendar-day window, like the spin cooldown)", () => {
    const now = Date.UTC(2026, 9, 11, 23, 59, 0);
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now)).toBe(true);
    // та же UTC-дата — блок;
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now + 30_000)).toBe(false);
    // следующий UTC-день (пусть даже через 2 минуты) — снова можно
    expect(claimWheelWinNotifySlot("vip-bike", "413553377", "WHEEL2000", now + 2 * 60_000)).toBe(true);
  });

  it("builds stable keys and UTC YYYYMMDD day tags", () => {
    expect(wheelWinNotifyDay(Date.UTC(2026, 0, 2, 23, 59))).toBe("20260102");
    expect(wheelWinNotifyKey("vip-bike", "42", "WHEEL15", "20261011")).toBe("vip-bike:42:WHEEL15:20261011");
  });
});

describe("notifyWheelWinners delivery", () => {
  it("DMs the winner with a cart button and every crew recipient", async () => {
    const result = await notifyWheelWinners({
      slug: "vip-bike",
      crewBrandName: "Vip Bike",
      winnerId: "356282674",
      winnerName: "I_O_S_NN",
      winnerUsername: "I_O_S_NN",
      prizeLabel: "2 000 ₽",
      promoCode: "WHEEL2000",
      description: "скидка 2000 ₽",
      crewRecipientIds: ["413553377", "7813830016"],
    });

    expect(result.winnerNotified).toBe(true);
    expect(result.crewNotifiedCount).toBe(2);
    expect(deliverMock).toHaveBeenCalledTimes(3);

    // telegramDeliver(method, chatId, payload)
    const [, winnerChat, winnerPayload] = deliverMock.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(winnerChat).toBe("356282674");
    expect(String(winnerPayload.text)).toContain("WHEEL2000");
    const keyboard = winnerPayload.reply_markup as { inline_keyboard: Array<Array<{ text: string; url: string }>> };
    expect(keyboard.inline_keyboard[0][0].url).toContain("/franchize/vip-bike/cart?promo=WHEEL2000");

    const [, crewChat, crewPayload] = deliverMock.mock.calls[1] as [string, string, Record<string, unknown>];
    expect(crewChat).toBe("413553377");
    expect(String(crewPayload.text)).toContain("WHEEL2000");
  });

  it("skips the winner DM for anonymous spins but still notifies the crew", async () => {
    const result = await notifyWheelWinners({
      slug: "vip-bike",
      crewBrandName: "Vip Bike",
      winnerId: null,
      winnerName: "Гость",
      winnerUsername: null,
      prizeLabel: "1 000 ₽",
      promoCode: "WHEEL1000",
      description: "",
      crewRecipientIds: ["413553377"],
    });
    expect(result.winnerNotified).toBe(false);
    expect(result.crewNotifiedCount).toBe(1);
    expect(deliverMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when Telegram fails — counts only successes", async () => {
    deliverMock.mockImplementation(async () => ({ ok: false, error: "blocked" }));
    const result = await notifyWheelWinners({
      slug: "vip-bike",
      crewBrandName: "Vip Bike",
      winnerId: "42",
      winnerName: "Rider",
      winnerUsername: null,
      prizeLabel: "15%",
      promoCode: "WHEEL15",
      description: "",
      crewRecipientIds: ["43", "44"],
    });
    expect(result.winnerNotified).toBe(false);
    expect(result.crewNotifiedCount).toBe(0);
  });
});
