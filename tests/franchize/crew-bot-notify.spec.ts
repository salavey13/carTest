// tests/franchize/crew-bot-notify.spec.ts
//
// Фикс 2026-09-21 (boss-report): уведомление о закрытии аренды уводило на
// WEB-ссылку https://v0-car-test.vercel.app/franchize/<slug>/community вместо
// t.me/<bot>/app?startapp=… Имя бота берём из crew metadata
// (crews.contacts.telegramBotUsername), env — только фолбэк.
//
// Покрываем:
//   1. pure-хелперы crew-bot (normalize/botUsernameFromContacts),
//   2. resolveCrewBotUsername: contacts → env, TTL-кэш, never-throw,
//   3. ride-share-notify: арендатор получает t.me-кнопку по crewContacts
//      даже когда env пуст; cc-экипаж получает wall_<slug>, не web-ссылку,
//   4. owner/admin cc на смену статуса аренды (source-contract),
//   5. crew_watch cc арендаторских комментариев (source-contract),
//   6. блок «Аренды» на профиле райдера только self/staff (source-contract),
//   7. кроссслинк аренда → профиль райдера (source-contract).

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: vi.fn(async () => ({ ok: true })),
}));

const { supabaseAdmin } = vi.hoisted(() => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));
vi.mock("@/lib/supabase-server", () => ({ supabaseAdmin }));
vi.mock("@/app/franchize/lib/new-lead-notify", () => ({
  leadDeeplinkUrl: vi.fn((key: string) => `https://t.me/oneBikePlsBot/app?startapp=${key}`),
  resolveLeadNotifyRecipients: vi.fn(async () => ["owner-1", "admin-2"]),
  sanitizeLeadKey: vi.fn((v: string) => v),
}));

import {
  botUsernameFromContacts,
  clearCrewBotCache,
  normalizeBotUsername,
  resolveCrewBotUsername,
} from "@/app/franchize/lib/crew-bot";
import { notifyRideFinishedAndSuggestPost, summarizeRide } from "@/app/franchize/lib/ride-share-notify";
import { telegramDeliver } from "@/lib/telegram-transport";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const HOUR = 60 * 60 * 1000;
function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

const SUMMARY = summarizeRide({
  bikeTitle: "Kawasaki EX650K",
  startIso: isoAgo(4),
  endIso: isoAgo(1),
  totalCost: 9000,
  odometerBefore: 12000,
  odometerAfter: 12187,
  depositReturned: true,
  crewName: "Vip-Bike",
  crewSlug: "vip-bike",
});

/** Мок crews-запроса: .from("crews").select("contacts").eq(slug).maybeSingle() */
function mockCrewContacts(contacts: unknown) {
  (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table !== "crews") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: contacts ? { contacts } : null, error: null }),
        }),
      }),
    };
  });
}

beforeEach(async () => {
  // clearAllMocks чистит вызовы, но НЕ implementations — поэтому (codereview
  // P2-7) дефолт lead-резолвера переустанавливаем явно, а кэш бота сбрасываем.
  vi.clearAllMocks();
  clearCrewBotCache();
  delete (process.env as Record<string, string | undefined>).TELEGRAM_BOT_USERNAME;
  const { resolveLeadNotifyRecipients } = await import("@/app/franchize/lib/new-lead-notify");
  vi.mocked(resolveLeadNotifyRecipients).mockResolvedValue(["owner-1", "admin-2"]);
});

describe("crew-bot pure helpers", () => {
  it("normalizeBotUsername: strips @, rejects garbage and short names", () => {
    expect(normalizeBotUsername("@oneBikePlsBot")).toBe("oneBikePlsBot");
    expect(normalizeBotUsername(" oneCrossPlsBot ")).toBe("oneCrossPlsBot");
    expect(normalizeBotUsername("")).toBeNull();
    expect(normalizeBotUsername(null)).toBeNull();
    expect(normalizeBotUsername("abc")).toBeNull(); // < 5 chars
    expect(normalizeBotUsername("bad name!")).toBeNull();
  });

  it("botUsernameFromContacts reads telegramBotUsername and tolerates junk", () => {
    expect(botUsernameFromContacts({ telegramBotUsername: "oneBikePlsBot" })).toBe("oneBikePlsBot");
    expect(botUsernameFromContacts({ telegramBotUsername: "@oneBikePlsBot" })).toBe("oneBikePlsBot");
    expect(botUsernameFromContacts({ telegramBotUsername: null })).toBeNull();
    expect(botUsernameFromContacts(null)).toBeNull();
    expect(botUsernameFromContacts("nonsense")).toBeNull();
    expect(botUsernameFromContacts(undefined)).toBeNull();
  });
});

describe("resolveCrewBotUsername", () => {
  it("resolves from crew contacts (metadata is the source of truth)", async () => {
    mockCrewContacts({ telegramBotUsername: "oneBikePlsBot" });
    expect(await resolveCrewBotUsername("vip-bike")).toBe("oneBikePlsBot");
  });

  it("falls back to env when crew has no bot in contacts", async () => {
    process.env.TELEGRAM_BOT_USERNAME = "envFallbackBot";
    mockCrewContacts({ telegramBotUsername: "" });
    expect(await resolveCrewBotUsername("vip-bike")).toBe("envFallbackBot");
  });

  it("never throws even when the DB layer explodes", async () => {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("db down");
    });
    expect(await resolveCrewBotUsername("vip-bike")).toBeNull();
  });

  it("caches per slug (second call hits no extra queries)", async () => {
    mockCrewContacts({ telegramBotUsername: "oneBikePlsBot" });
    await resolveCrewBotUsername("cached-slug");
    const callsAfterFirst = (supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length;
    await resolveCrewBotUsername("cached-slug");
    expect((supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("ride-share-notify × crew bot metadata (boss bug fix)", () => {
  it("renter gets a t.me/<crew-bot>/app?startapp=wallp_… button from crewContacts even without env", async () => {
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary: SUMMARY,
      renterChatId: "413553377",
      ccCrew: false,
      crewContacts: { telegramBotUsername: "oneBikePlsBot" },
    });
    expect(res.renterSent).toBe(true);
    const payload = vi.mocked(telegramDeliver).mock.calls[0][2] as {
      reply_markup?: { inline_keyboard?: { text: string; url: string }[][] };
    };
    const btn = payload.reply_markup?.inline_keyboard?.[0]?.[0];
    expect(btn?.url).toContain("https://t.me/oneBikePlsBot/app?startapp=wallp_");
    expect(btn?.url).not.toContain("v0-car-test.vercel.app");
  });

  it("crew cc button carries startapp=wall_<slug> (NOT a web link) via the crew bot", async () => {
    vi.mocked(telegramDeliver).mockClear();
    const { resolveLeadNotifyRecipients } = await import("@/app/franchize/lib/new-lead-notify");
    vi.mocked(resolveLeadNotifyRecipients).mockResolvedValue(["owner-1", "admin-2"]);
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary: SUMMARY,
      renterChatId: null,
      ccCrew: true,
      crewContacts: { telegramBotUsername: "oneBikePlsBot" },
    });
    expect(res.crewSent).toBe(2);
    for (const call of vi.mocked(telegramDeliver).mock.calls) {
      const payload = call[2] as {
        reply_markup?: { inline_keyboard?: { text: string; url: string }[][] };
      };
      const btn = payload.reply_markup?.inline_keyboard?.[0]?.[0];
      expect(btn?.url).toContain("https://t.me/oneBikePlsBot/app?startapp=wall_vip-bike");
      expect(btn?.url).not.toContain("v0-car-test.vercel.app");
    }
  });

  it("renter bot-flow rental with NO bot anywhere: message still delivers, no web-link button", async () => {
    vi.mocked(telegramDeliver).mockClear();
    // no env, no contacts, DB говорит «экипажа нет» → резолвер null → кнопки нет
    // (никогда не отдаём арендатору web-фолбэк на compose-действие).
    mockCrewContacts(null);
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary: SUMMARY,
      renterChatId: "413553377",
      ccCrew: false,
    });
    expect(res.renterSent).toBe(true);
    const payload = vi.mocked(telegramDeliver).mock.calls[0][2] as {
      reply_markup?: { inline_keyboard?: unknown };
    };
    expect(payload.reply_markup).toBeUndefined();
  });
});

describe("wiring (source contracts)", () => {
  it("confirmVehicleReturn passes crew contacts into the ride-share notify", () => {
    const src = read("app/rentals/actions.ts");
    expect(src).toContain('select("slug, name, contacts")');
    expect(src).toContain("crewContacts");
  });

  it("updateRentalStatus cc's owner+admins on every status change (non-fatal)", () => {
    const src = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(src).toContain("Owner/admin cc failed (non-fatal)");
    expect(src).toContain("resolveLeadNotifyRecipients(ccSlug, { includeMembers: false })");
    // deeplink to the analytics rental drawer
    expect(src).toContain("`rental_${rentalId}`");
    // skips silent mode and the actor
    expect(src).toContain("if (!silent && rental?.crew_id)");
  });

  it("renter comments cc owner/admin with the crew_watch reason", () => {
    const engage = read("app/franchize/lib/wall-engage-notify.ts");
    expect(engage).toContain("crew_watch");
    expect(engage).toContain("Арендатор прокомментировал на стене");
    const wall = read("app/franchize/server-actions/community-wall.ts");
    expect(wall).toContain('reason: "crew_watch"');
    expect(wall).toContain("resolveLeadNotifyRecipients(watchSlug, { includeMembers: false })");
  });

  it("wall + engage + rider-profile resolve the bot from crew metadata (not env-only)", () => {
    expect(read("app/franchize/lib/wall-notify.ts")).toContain("resolveCrewBotUsername(input.slug)");
    expect(read("app/franchize/server-actions/community-wall.ts")).toContain(
      "resolveCrewBotUsername(crew.slug || slug)",
    );
    expect(read("app/franchize/server-actions/rider-profile.ts")).toContain(
      "resolveCrewBotUsername(slug)",
    );
  });

  it("rider profile «Аренды» block is gated to self/staff server-side", () => {
    const src = read("app/franchize/server-actions/rider-profile.ts");
    expect(src).toContain("loadRecentRentalsForStaffOrSelf");
    expect(src).toContain("if (!input.isSelf && !input.isStaff) return [];");
    expect(src).toContain("recentRentals: []"); // hidden-profile branch too
  });

  it("rental page crosslinks to the rider profile of the renter", () => {
    const src = read("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(src).toContain("Профиль райдера →");
    expect(src).toContain("rider/${rental.renterId}");
  });
});
