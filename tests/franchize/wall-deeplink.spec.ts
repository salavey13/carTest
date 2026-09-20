// tests/franchize/wall-deeplink.spec.ts
//
// Wall v4 deep links (startapp): parse/build round-trips, adversarial input,
// and the router FAST path (wall deep links must route BEFORE the Telegram
// auth roundtrip — the boss perf complaint).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTelegramAppLink,
  isUuidLike,
  parseWallDeepLink,
  sanitizeWallSlug,
  wallComposeStartParam,
  wallPostStartParam,
  wallStartParam,
} from "@/lib/wall-deeplink";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const POST_ID = "6f1d2c3a-1111-4222-8333-944455566677";
const RENTAL_ID = "0a1b2c3d-eeee-4fff-8123-456789abcdef";
const SLUG = "vip-bike";

describe("parseWallDeepLink", () => {
  it("parses wall_<slug>", () => {
    expect(parseWallDeepLink(`wall_${SLUG}`)).toEqual({ kind: "wall", slug: SLUG });
  });

  it("bare wall has no slug (router falls back to viewer's crew)", () => {
    expect(parseWallDeepLink("wall")).toEqual({ kind: "wall", slug: null });
    expect(parseWallDeepLink("wall_")).toEqual({ kind: "wall", slug: null });
  });

  it("parses post_<postId>_<slug> (share format) and bare post_<postId>", () => {
    expect(parseWallDeepLink(`post_${POST_ID}_${SLUG}`)).toEqual({
      kind: "post",
      postId: POST_ID,
      slug: SLUG,
    });
    expect(parseWallDeepLink(`post_${POST_ID}`)).toEqual({ kind: "post", postId: POST_ID, slug: null });
  });

  it("parses wallp_<rentalId>_<slug> (compose-from-ride)", () => {
    expect(parseWallDeepLink(`wallp_${RENTAL_ID}_${SLUG}`)).toEqual({
      kind: "compose",
      rentalId: RENTAL_ID,
      slug: SLUG,
    });
  });

  it("rejects non-wall params and malformed payloads", () => {
    expect(parseWallDeepLink("rent_bike-1")).toBeNull();
    expect(parseWallDeepLink("post_not-a-uuid_x")).toBeNull();
    // garbage slug after a VALID post id degrades to the bare form (gated
    // fallback to the viewer's crew) instead of dead-ending the link:
    expect(parseWallDeepLink(`post_${POST_ID}_../../etc`)).toEqual({
      kind: "post",
      postId: POST_ID,
      slug: null,
    });
    expect(parseWallDeepLink(`wallp_${RENTAL_ID}`)).toBeNull(); // no slug
    expect(parseWallDeepLink("")).toBeNull();
    expect(parseWallDeepLink(null)).toBeNull();
  });

  it("non-uuid garbage slug on wall_ degrades to own-crew wall, not dead link", () => {
    expect(parseWallDeepLink("wall_???")).toEqual({ kind: "wall", slug: null });
  });

  it("parses the <slug>_community alias to the same wall destination", () => {
    // crew-id_community form (boss request): same target as wall_<slug>
    expect(parseWallDeepLink("vip-bike_community")).toEqual({ kind: "wall", slug: "vip-bike" });
    // fixed prefixes always win over the suffix alias
    expect(parseWallDeepLink("wall_vip-bike")).toEqual({ kind: "wall", slug: "vip-bike" });
    expect(parseWallDeepLink(`post_${POST_ID}_vip-bike_community`)).toEqual({
      kind: "post",
      postId: POST_ID,
      slug: "vip-bike_community",
    });
    // garbage slug + suffix → no route (not a dead "own crew" fallback)
    expect(parseWallDeepLink("???_community")).toBeNull();
  });
});

describe("builders", () => {
  it("round-trips post → parse", () => {
    const param = wallPostStartParam(POST_ID, SLUG);
    expect(param).toBe(`post_${POST_ID}_${SLUG}`);
    expect(parseWallDeepLink(param)).toEqual({ kind: "post", postId: POST_ID, slug: SLUG });
  });

  it("round-trips compose → parse", () => {
    const param = wallComposeStartParam(RENTAL_ID, SLUG);
    expect(param).toBe(`wallp_${RENTAL_ID}_${SLUG}`);
    expect(parseWallDeepLink(param)).toEqual({ kind: "compose", rentalId: RENTAL_ID, slug: SLUG });
  });

  it("startapp params stay short (≤ 64 chars, comfortable TG budget)", () => {
    expect(wallStartParam(SLUG).length).toBeLessThanOrEqual(64);
    expect(wallPostStartParam(POST_ID, SLUG).length).toBeLessThanOrEqual(64);
    expect(wallComposeStartParam(RENTAL_ID, SLUG).length).toBeLessThanOrEqual(64);
  });

  it("over-budget slugs DOWNGRADE to the bare form, never a wrong-slug link", () => {
    const longSlug = "a-very-long-crew-slug-that-keeps-going-and-going"; // 48 chars
    const hugeSlug = `${longSlug}-and-even-more-characters-to-blow-the-budget`; // >59 chars
    const p = wallPostStartParam(POST_ID, longSlug);
    // bare post_<id> → parser resolves slug:null → router falls back to the
    // VIEWER's crew (a truncated slug would fast-route to an empty shell wall):
    expect(p).toBe(`post_${POST_ID}`);
    expect(parseWallDeepLink(p)).toEqual({ kind: "post", postId: POST_ID, slug: null });
    // wall_ has a 59-char slug budget — the 48-char slug FITS and stays intact:
    expect(wallStartParam(longSlug)).toBe(`wall_${longSlug}`);
    // but an over-budget slug degrades to bare `wall` (own-crew fallback):
    expect(wallStartParam(hugeSlug)).toBe("wall");
    expect(parseWallDeepLink(wallStartParam(hugeSlug))).toEqual({ kind: "wall", slug: null });
    // wallp_ has no bare form (parser needs the slug) — truncate to a valid prefix:
    const c = wallComposeStartParam(RENTAL_ID, longSlug);
    expect(c.length).toBeLessThanOrEqual(64);
    expect(parseWallDeepLink(c)).toEqual({ kind: "compose", rentalId: RENTAL_ID, slug: expect.any(String) });
  });

  it("builds t.me app links without @ in the bot handle", () => {
    expect(buildTelegramAppLink("@oneBikePlsBot", wallPostStartParam(POST_ID, SLUG))).toBe(
      `https://t.me/oneBikePlsBot/app?startapp=post_${POST_ID}_${SLUG}`,
    );
  });

  it("builders refuse non-uuid ids loudly", () => {
    expect(() => wallPostStartParam("nope", SLUG)).toThrow(/uuid/i);
    expect(() => wallComposeStartParam("nope", SLUG)).toThrow(/uuid/i);
  });
});

describe("guards", () => {
  it("isUuidLike / sanitizeWallSlug", () => {
    expect(isUuidLike(POST_ID)).toBe(true);
    expect(isUuidLike("hello")).toBe(false);
    expect(sanitizeWallSlug("vip-bike_2")).toBe("vip-bike_2"); // underscores are legal in slugs
    expect(sanitizeWallSlug("bad slug!")).toBeNull();
    expect(sanitizeWallSlug(null)).toBeNull();
  });
});

describe("useStartParamRouter fast path (source contract)", () => {
  const src = read("hooks/useStartParamRouter.ts");

  it("routes wall deep links BEFORE the auth gate", () => {
    const fastIdx = src.indexOf("computeFastWallTarget(paramToProcess)");
    const gateIdx = src.indexOf("if (isAppLoading || isAuthenticating)");
    expect(fastIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(fastIdx);
  });

  it("fast path marks the param handled and clears it (no double routing)", () => {
    expect(src).toContain("lastHandledStartParamRef.current = paramToProcess;");
    expect(src).toContain("clearStartParam?.();");
    expect(src).toContain("never fall through to the gated logic");
  });

  it("bare wall/post still resolve via userCrewInfo on the gated path", () => {
    expect(src).toContain('link.slug || userCrewInfo?.slug || "vip-bike"');
  });
});
