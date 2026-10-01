// tests/franchize/startapp-routing-regression.spec.ts
//
// BOSS 2026-10-01 — «for some reason when a click on them i didn't get
// routed .. doublecheck that startapp param routing is not broken».
//
// ROOT CAUSE (shipped in 291da8739, Sep 29): hooks/use-start-param-target.ts
// was extracted from useStartParamRouter.ts and the import of
// parseWallDeepLink was LOST. computeFastWallTarget threw
// «ReferenceError: parseWallDeepLink is not defined» on EVERY call — inside
// a void'ed async effect, so nothing surfaced it. Every startapp param that
// reaches the wall fast path (post_/wall_/wallp_/ride_/rider_/join_) died
// silently before router.replace, and rent_ (no static-fast match) died the
// same way. next.config ignoreBuildErrors hid it from the build; the old
// specs only STRING-PINNED the router (fast-auth-routing.spec.ts) or tested
// parseWallDeepLink in its own module (wall-deeplink.spec.ts) — no spec ever
// EXECUTED computeFastWallTarget.
//
// This spec EXECUTES the resolvers (import = compile+run under vitest) —
// the missing-import class of regression can never ship again.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  computeFastWallTarget,
  computeStaticFastTarget,
  parseRentDeepLink,
  parseRentalDetailDeepLink,
} from "@/hooks/use-start-param-target";
import {
  bikeRentStartParam,
  buildTelegramAppLink,
  wallPostStartParam,
  wallStartParam,
  crewJoinStartParam,
  riderProfileStartParam,
} from "@/lib/wall-deeplink";
import { botUsernameFromCrewMetadata, normalizeBotUsername } from "@/app/franchize/lib/crew-bot";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const POST_ID = "11111111-2222-3333-4444-555555555555";
const RENTAL_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const USER_ID = "123456789";
const SLUG = "vip-bike";

describe("startapp routing regression: computeFastWallTarget EXECUTES (boss 2026-10-01)", () => {
  it("wall_<slug> routes to the crew wall — no ReferenceError", () => {
    expect(computeFastWallTarget(wallStartParam(SLUG))).toBe(`/franchize/${SLUG}/community`);
  });

  it("post_<postId>_<slug> routes to the post (the «Открыть пост» button target)", () => {
    const param = wallPostStartParam(POST_ID, SLUG);
    expect(param).toBe(`post_${POST_ID}_${SLUG}`);
    expect(computeFastWallTarget(param)).toBe(`/franchize/${SLUG}/community?post=${POST_ID}`);
  });

  it("wallp_<rentalId>_<slug> opens the composer prefilled", () => {
    expect(computeFastWallTarget(`wallp_${RENTAL_ID}_${SLUG}`)).toBe(
      `/franchize/${SLUG}/community?compose=${RENTAL_ID}`,
    );
  });

  it("ride_<sessionId>_<slug> opens the ride-share composer", () => {
    expect(computeFastWallTarget(`ride_${RENTAL_ID}_${SLUG}`)).toBe(
      `/franchize/${SLUG}/community?ride=${RENTAL_ID}`,
    );
  });

  it("rider_<userId>_<slug> opens the public rider profile", () => {
    expect(computeFastWallTarget(riderProfileStartParam(USER_ID, SLUG))).toBe(
      `/franchize/${SLUG}/rider/${USER_ID}`,
    );
  });

  it("join_<slug> routes the invite with join_crew=true", () => {
    expect(computeFastWallTarget(crewJoinStartParam(SLUG))).toBe(`/franchize/${SLUG}?join_crew=true`);
  });

  it("rent_<bikeId> has NO fast target (gated path owns it) and still parses", () => {
    // The rent_ QR/quick-rent param must NOT be claimed by the wall fast path,
    // but the wall fast-path CHECK itself must run without throwing — the
    // router calls it for every param before the gated branch.
    expect(computeFastWallTarget("rent_bmw-f800r")).toBeNull();
    expect(parseRentDeepLink("rent_bmw-f800r")).toEqual({ bikeId: "bmw-f800r", docSha256: null });
  });

  it("static fast path still claims its own params (crew_/storage_/mapriders_/page map)", () => {
    expect(computeStaticFastTarget(`crew_${SLUG}`)).toBe(`/franchize/${SLUG}`);
    expect(computeStaticFastTarget(`storage_${SLUG}`)).toBe(`/franchize/${SLUG}/storage`);
    expect(computeStaticFastTarget("rent-bike")).toBe("/franchize/vip-bike");
    expect(computeStaticFastTarget("rent_bmw-f800r")).toBeNull();
  });

  it("rental_<id> parses (gated analytics/rental links unaffected by rent_)", () => {
    expect(parseRentalDetailDeepLink(`rental_${RENTAL_ID}`)).toEqual({ rentalId: RENTAL_ID });
  });
});

describe("startapp routing regression: the missing import is pinned", () => {
  it("use-start-param-target.ts imports parseWallDeepLink from wall-deeplink", () => {
    const src = read("hooks/use-start-param-target.ts");
    expect(src).toContain('import { parseWallDeepLink } from "@/lib/wall-deeplink";');
  });

  it("useStartParamRouter still delegates to the pure resolvers (structure unchanged)", () => {
    const src = read("hooks/useStartParamRouter.ts");
    const staticIdx = src.indexOf("computeStaticFastTarget(paramToProcess)");
    const wallIdx = src.indexOf("computeFastWallTarget(paramToProcess)");
    const gateIdx = src.indexOf("if (isAppLoading || isAuthenticating)");
    expect(staticIdx).toBeGreaterThan(-1);
    expect(wallIdx).toBeGreaterThan(staticIdx);
    expect(gateIdx).toBeGreaterThan(wallIdx);
  });
});

describe("boss scenario end-to-end: vip-bike post notification links (pure chain)", () => {
  it("quick-rent button URL matches the boss example exactly and round-trips", () => {
    const bot = botUsernameFromCrewMetadata({
      franchize: { contacts: { telegramBotUsername: "oneBikePlsBot" } },
    });
    expect(bot).toBe("oneBikePlsBot");
    const param = bikeRentStartParam("bmw-f800r");
    const url = buildTelegramAppLink(bot!, param!);
    expect(url).toBe("https://t.me/oneBikePlsBot/app?startapp=rent_bmw-f800r");
    // Round-trip: what the router receives is what the builder meant.
    const startapp = url.split("startapp=")[1];
    expect(parseRentDeepLink(startapp)).toEqual({ bikeId: "bmw-f800r", docSha256: null });
    // …and the resolved destination exists (catalog page with the bike modal).
    expect(computeFastWallTarget(startapp)).toBeNull(); // gated branch routes it
  });

  it("post button URL stays inside the Telegram 64-char startapp budget", () => {
    const param = wallPostStartParam(POST_ID, SLUG);
    expect(param.length).toBeLessThanOrEqual(64);
    const url = buildTelegramAppLink(normalizeBotUsername("@oneBikePlsBot")!, param);
    expect(url.startsWith("https://t.me/oneBikePlsBot/app?startapp=post_")).toBe(true);
  });

  it("every t.me link the wall notifies generate is well-formed (scheme, bot, startapp)", () => {
    const urls = [
      buildTelegramAppLink("oneBikePlsBot", bikeRentStartParam("bmw-f800r")!),
      buildTelegramAppLink("oneBikePlsBot", wallPostStartParam(POST_ID, SLUG)),
      buildTelegramAppLink("oneBikePlsBot", wallStartParam(SLUG)),
    ];
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\/app\?startapp=[A-Za-z0-9_-]+$/);
      // Bot API url-button rules: https only, ≤ 256 chars.
      expect(url.length).toBeLessThanOrEqual(256);
    }
  });
});
