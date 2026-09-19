// tests/franchize/ride-share-notify.spec.ts
//
// «Поездка завершена» + suggested wall post (wall v4):
//   1. pure summary math (hours from the SAME rentalHours as stats posts,
//      odometer km, days, money),
//   2. suggested post text — data-grounded only, hashtags for discovery,
//   3. renter/crew TG builders (HTML escaping, deposit variants),
//   4. never-throw delivery + crew cc scope (owner/admins, no member fanout),
//   5. confirmVehicleReturn wiring (non-fatal, awaited) + compose deeplink.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/franchize/lib/new-lead-notify", () => ({
  leadDeeplinkUrl: vi.fn((key: string) => `https://t.me/oneBikePlsBot/app?startapp=${key}`),
  resolveLeadNotifyRecipients: vi.fn(async () => ["owner-1", "admin-2"]),
  sanitizeLeadKey: vi.fn((v: string) => v),
}));

import {
  buildRideFinishedCrewHtml,
  buildRideFinishedRenterHtml,
  buildSuggestedWallPost,
  formatRideDuration,
  notifyRideFinishedAndSuggestPost,
  summarizeRide,
} from "@/app/franchize/lib/ride-share-notify";
import { telegramDeliver } from "@/lib/telegram-transport";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const HOUR = 60 * 60 * 1000;

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

const BASE = {
  bikeTitle: "Kawasaki EX650K",
  totalCost: 9000,
  odometerBefore: 12000,
  odometerAfter: 12187,
  depositReturned: true,
  crewName: "Vip-Bike",
  crewSlug: "vip-bike",
};

beforeEach(() => {
  vi.clearAllMocks();
  delete (process.env as Record<string, string | undefined>).TELEGRAM_BOT_USERNAME;
});

describe("summarizeRide", () => {
  it("computes hours from agreed dates (ceil, min 1 — stats-post parity)", () => {
    const s = summarizeRide({
      ...BASE,
      startIso: isoAgo(12),
      endIso: isoAgo(0.2),
    });
    expect(s.hours).toBe(12);
    expect(s.days).toBeNull();
  });

  it("counts km from the odometer pair and rejects nonsense deltas", () => {
    const good = summarizeRide({ ...BASE, startIso: isoAgo(3), endIso: isoAgo(1) });
    expect(good.km).toBe(187);
    const negative = summarizeRide({
      ...BASE,
      odometerAfter: 11000, // below before — odometer typo must not reach the user
      startIso: isoAgo(3),
      endIso: isoAgo(1),
    });
    expect(negative.km).toBeNull();
  });

  it("multi-day rides expose days and keep hours", () => {
    const s = summarizeRide({ ...BASE, startIso: isoAgo(52), endIso: isoAgo(2) });
    expect(s.hours).toBe(50);
    expect(s.days).toBe(2);
  });

  it("missing dates still count as a 1-hour ride", () => {
    const s = summarizeRide({ ...BASE, startIso: null, endIso: null });
    expect(s.hours).toBe(1);
  });
});

describe("formatRideDuration", () => {
  it("12 ч / 50 ч → «2 д 2 ч»", () => {
    expect(formatRideDuration({ hours: 12, days: null })).toBe("12 ч");
    expect(formatRideDuration({ hours: 50, days: 2 })).toBe("2 д 2 ч");
    expect(formatRideDuration({ hours: 48, days: 2 })).toBe("2 д");
  });
});

describe("buildSuggestedWallPost", () => {
  it("bakes the ride summary in: bike, duration, km, deposit", () => {
    const text = buildSuggestedWallPost(
      summarizeRide({ ...BASE, startIso: isoAgo(12), endIso: isoAgo(0.5) }),
    );
    expect(text).toContain("12 ч на Kawasaki EX650K");
    expect(text).toContain("187 км за спиной");
    expect(text).toContain("Депозит вернули");
    expect(text).toContain("Vip-Bike");
    expect(text).toContain("#OnlyBike"); // feeds the wall's discovery/trending
  });

  it("never claims the deposit came back when it was withheld", () => {
    const text = buildSuggestedWallPost(
      summarizeRide({ ...BASE, depositReturned: false, startIso: isoAgo(4), endIso: isoAgo(1) }),
    );
    expect(text).not.toContain("Депозит вернули");
  });

  it("skips the km clause when the odometer data is missing", () => {
    const text = buildSuggestedWallPost(
      summarizeRide({
        ...BASE,
        odometerBefore: null,
        odometerAfter: null,
        startIso: isoAgo(4),
        endIso: isoAgo(1),
      }),
    );
    expect(text).not.toContain("км за спиной");
  });
});

describe("TG builders", () => {
  it("renter receipt shows the summary and the ready-to-post text", () => {
    const summary = summarizeRide({ ...BASE, startIso: isoAgo(12), endIso: isoAgo(0.5) });
    const html = buildRideFinishedRenterHtml(summary, buildSuggestedWallPost(summary));
    expect(html).toContain("Поездка завершена");
    expect(html).toContain("Kawasaki EX650K");
    expect(html).toContain("Депозит возвращён");
    expect(html).toContain("Откатал 12 ч");
  });

  it("withheld deposit gets the ⚠️ variant", () => {
    const summary = summarizeRide({ ...BASE, depositReturned: false, startIso: isoAgo(4), endIso: isoAgo(1) });
    const html = buildRideFinishedRenterHtml(summary, buildSuggestedWallPost(summary));
    expect(html).toContain("Депозит удержан");
    expect(html).not.toContain("Депозит возвращён");
  });

  it("crew copy mentions the suggested post (no leaks of renter PII)", () => {
    const summary = summarizeRide({ ...BASE, startIso: isoAgo(6), endIso: isoAgo(1) });
    const html = buildRideFinishedCrewHtml(summary);
    expect(html).toContain("Аренда закрыта");
    expect(html).toContain("поделиться постом");
  });

  it("escapes bike names (metadata is user-ish input)", () => {
    const summary = summarizeRide({
      ...BASE,
      bikeTitle: "<b>Super</b> Bike",
      startIso: isoAgo(4),
      endIso: isoAgo(1),
    });
    expect(buildRideFinishedCrewHtml(summary)).not.toContain("<b>Super</b>");
  });
});

describe("notifyRideFinishedAndSuggestPost", () => {
  it("sends the renter message with the compose deeplink button", async () => {
    const summary = summarizeRide({ ...BASE, startIso: isoAgo(12), endIso: isoAgo(0.5) });
    process.env.TELEGRAM_BOT_USERNAME = "oneBikePlsBot";
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary,
      renterChatId: "413553377",
      ccCrew: false, // renter-only message (cc is ON by default — tested below)
    });
    expect(res.renterSent).toBe(true);
    const payload = vi.mocked(telegramDeliver).mock.calls[0][2] as {
      reply_markup?: { inline_keyboard?: { text: string; url: string }[][] };
    };
    const btn = payload.reply_markup?.inline_keyboard?.[0]?.[0];
    expect(btn?.url).toContain("startapp=wallp_");
    expect(btn?.url).toContain("_vip-bike");
    // crew cc was NOT requested here
    expect(res.crewSent).toBe(0);
  });

  it("cc reaches owner/admins only (no member fanout) and skips the renter", async () => {
    const summary = summarizeRide({ ...BASE, startIso: isoAgo(4), endIso: isoAgo(1) });
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary,
      renterChatId: "owner-1", // owner IS the renter — no self-cc
      ccCrew: true,
    });
    // resolveLeadNotifyRecipients mock returns owner-1 + admin-2; owner-1 filtered out
    expect(res.crewSent).toBe(1);
  });

  it("never throws even when delivery explodes", async () => {
    vi.mocked(telegramDeliver).mockImplementation(async () => {
      throw new Error("network down");
    });
    const summary = summarizeRide({ ...BASE, startIso: isoAgo(4), endIso: isoAgo(1) });
    const res = await notifyRideFinishedAndSuggestPost({
      rentalId: "0a1b2c3d-eeee-4fff-8123-456789abcdef",
      crewSlug: "vip-bike",
      summary,
      renterChatId: "413553377",
      ccCrew: true,
    });
    expect(res.renterSent).toBe(false);
    expect(res.crewSent).toBe(0);
  });
});

describe("wiring (source contract)", () => {
  it("confirmVehicleReturn calls the ride-share notify after the receipt (non-fatal, awaited)", () => {
    const src = read("app/rentals/actions.ts");
    expect(src).toContain("notifyRideFinishedAndSuggestPost");
    expect(src).toContain("Ride-share notify failed (non-fatal)");
  });

  it("the upload route enforces the 300 KB wall v4 budget with a dimension ladder", () => {
    const route = read("app/api/franchize/wall-photo-upload/route.ts");
    expect(route).toContain("300 * 1024");
    expect(route).toContain("[1280, 1080, 896]");
    expect(route).not.toContain("500 * 1024");
  });

  it("the wall client prefill/compose lands via ?compose=<rentalId>", () => {
    const client = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(client).toContain("getWallRentalDraftAction");
    expect(client).toContain("composeDraft?.canAttachRental ? composeDraft.rentalId : undefined");
    expect(client).toContain("{ maxSize: 1280, quality: 0.7 }");
  });

  it("the share button uses the post deep link when the bot username is known", () => {
    const client = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(client).toContain("wallPostStartParam(post.id, slug)");
  });
});
