// tests/franchize/crew-bot-notify.spec.ts
//
// Фикс 2026-09-21 (boss-report): уведомление о закрытии аренды уводило на
// WEB-ссылку https://v0-car-test.vercel.app/franchize/<slug>/community вместо
// t.me/<bot>/app?startapp=… Имя бота берём из crew metadata, env — только фолбэк.
//
// Фикс 2026-09-22 (boss-report №2, «share даёт v0-car-test.vercel.app»):
// резолвер читал КОЛОНКУ crews.contacts — её в схеме НЕТ (только metadata
// JSONB) → PostgREST PGRST204 → резолвер всегда null. Моки ниже читают
// РЕАЛЬНУЮ форму: .select("metadata") + metadata.franchize.contacts.
// telegramBotUsername. Старые моки маскировали баг — теперь контракт
// воспроизводит прод-схему 1:1.
//
// Покрываем:
//   1. pure-хелперы crew-bot (normalize/botUsernameFromContacts/
//      botUsernameFromCrewMetadata — prod-форма metadata.franchize.contacts),
//   2. resolveCrewBotUsername: metadata → env, TTL-кэш, never-throw,
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
  botUsernameFromCrewMetadata,
  clearCrewBotCache,
  normalizeBotUsername,
  PLATFORM_TELEGRAM_BOT_DEFAULT,
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

/** Мок crews-запроса: .from("crews").select("metadata").eq(slug).maybeSingle()
 *  ⚠️ РЕАЛЬНАЯ схема: колонки contacts в crews нет — только metadata JSONB
 *  с ботом внутри metadata.franchize.contacts.telegramBotUsername. */
function mockCrewMetadata(metadata: unknown) {
  (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table !== "crews") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: metadata ? { metadata } : null, error: null }),
        }),
      }),
    };
  });
}

/** Прод-форма metadata vip-bike (docs/sql/vip-bike-franchize-hydration.sql). */
const VIP_BIKE_METADATA = {
  franchize: {
    contacts: { telegramBotUsername: "oneBikePlsBot", telegram: "@I_O_S_NN" },
  },
};

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

  it("botUsernameFromCrewMetadata reads the PROD shape metadata.franchize.contacts (bug №2 regression)", () => {
    expect(botUsernameFromCrewMetadata(VIP_BIKE_METADATA)).toBe("oneBikePlsBot");
    // @-префикс толерантно
    expect(botUsernameFromCrewMetadata({ franchize: { contacts: { telegramBotUsername: "@oneCrossPlsBot" } } })).toBe("oneCrossPlsBot");
    // top-level metadata.contacts — фолбэк-форма
    expect(botUsernameFromCrewMetadata({ contacts: { telegramBotUsername: "flatBot" } })).toBe("flatBot");
    // franchize без контактов → null (не бросает)
    expect(botUsernameFromCrewMetadata({ franchize: {} })).toBeNull();
    expect(botUsernameFromCrewMetadata({})).toBeNull();
    expect(botUsernameFromCrewMetadata(null)).toBeNull();
    expect(botUsernameFromCrewMetadata("junk")).toBeNull();
    expect(botUsernameFromCrewMetadata(undefined)).toBeNull();
  });
});

describe("resolveCrewBotUsername", () => {
  it("resolves from crew metadata.franchize.contacts (metadata is the source of truth)", async () => {
    mockCrewMetadata(VIP_BIKE_METADATA);
    expect(await resolveCrewBotUsername("vip-bike")).toBe("oneBikePlsBot");
  });

  it("falls back to env when crew metadata has no bot", async () => {
    process.env.TELEGRAM_BOT_USERNAME = "envFallbackBot";
    mockCrewMetadata({ franchize: { contacts: { telegramBotUsername: "" } } });
    expect(await resolveCrewBotUsername("vip-bike")).toBe("envFallbackBot");
  });

  it("falls back to the PLATFORM bot when neither metadata nor env has one (invite fix 2026-09-22)", async () => {
    // Mini App один на все экипажи → deep link существует даже для dummy-экипажей
    // (nn-rolling-moto и т.п.) — резолвер больше НЕ возвращает null в норме.
    delete (process.env as Record<string, string | undefined>).TELEGRAM_BOT_USERNAME;
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    mockCrewMetadata(null);
    expect(await resolveCrewBotUsername("nn-rolling-moto")).toBe(PLATFORM_TELEGRAM_BOT_DEFAULT);
  });

  it("never throws even when the DB layer explodes (env пуст → платформенный дефолт)", async () => {
    delete (process.env as Record<string, string | undefined>).TELEGRAM_BOT_USERNAME;
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("db down");
    });
    // 2026-09-22: раньше тут ждали null → web-фолбэк; теперь платформенный бот.
    expect(await resolveCrewBotUsername("vip-bike")).toBe(PLATFORM_TELEGRAM_BOT_DEFAULT);
  });

  it("caches per slug (second call hits no extra queries)", async () => {
    mockCrewMetadata(VIP_BIKE_METADATA);
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

  it("renter bot-flow rental with NO crew bot: platform-bot fallback button (never web-link)", async () => {
    vi.mocked(telegramDeliver).mockClear();
    // 2026-09-22 (платформенный фолбэк): раньше «нет бота → нет кнопки»;
    // теперь Mini App один на все экипажи → резолвер отдаёт ПЛАТФОРМЕННОГО
    // бота, и арендатор получает валидную t.me-кнопку (веб-фолбэк по-прежнему
    // запрещён). Композиция wallp_<rental>_<slug> работает в том же Mini App.
    mockCrewMetadata(null);
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary: SUMMARY,
      renterChatId: "413553377",
      ccCrew: false,
    });
    expect(res.renterSent).toBe(true);
    const payload = vi.mocked(telegramDeliver).mock.calls[0][2] as {
      reply_markup?: { inline_keyboard?: { text: string; url: string }[][] };
    };
    const btn = payload.reply_markup?.inline_keyboard?.[0]?.[0];
    expect(btn?.url).toContain("https://t.me/oneBikePlsBot/app?startapp=wallp_");
    expect(btn?.url).not.toContain("v0-car-test.vercel.app");
  });
});

describe("wiring (source contracts)", () => {
  it("confirmVehicleReturn passes crew contacts into the ride-share notify", () => {
    const src = read("app/rentals/actions.ts");
    // ⚠️ колонки contacts в crews НЕТ — читаем metadata и выводим бота хелпером
    expect(src).toContain('select("slug, name, metadata")');
    expect(src).toContain("botUsernameFromCrewMetadata");
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
