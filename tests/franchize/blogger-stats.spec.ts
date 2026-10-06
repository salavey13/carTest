// tests/franchize/blogger-stats.spec.ts
//
// Task 75 — bloggers configure their own stats (users.metadata.blogger):
//   · pure lib: sanitize (initialization/update semantics), audience reader,
//     rarity ladder integration, platform deep links, compact formatting;
//   · metadata reader: canonical bundle wins over the legacy loose-key scan;
//   · wiring contracts (source assertions, iter17 style): owner-only save,
//     metadata merge touches ONLY the blogger key, editor uses the same
//     sanitize as the server, discovery/map pick the bundle up unchanged.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bloggerRarityScore, bloggerRarityStars } from "@/app/franchize/lib/crew-network";
import {
  BLOGGER_FOLLOWERS_MAX,
  BLOGGER_HANDLE_MAX_LEN,
  BLOGGER_PLATFORM_KEYS,
  EMPTY_BLOGGER_STATS,
  bloggerHandleHref,
  bloggerStatsExternalAudience,
  bloggerWebsiteHref,
  externalAudienceFromUser,
  formatBloggerAudience,
  isBloggerStatsEmpty,
  sanitizeBloggerStats,
  type BloggerStats,
} from "@/app/franchize/lib/blogger-stats";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── sanitize: initialization + hostile-shape collapse ────────────────────────

describe("sanitizeBloggerStats", () => {
  it("initialization: undefined/null/garbage collapse to EMPTY (no throw)", () => {
    for (const garbage of [undefined, null, 42, "x", [], { platforms: "no" }, { website: { evil: true } }]) {
      expect(sanitizeBloggerStats(garbage)).toEqual(EMPTY_BLOGGER_STATS);
    }
  });

  it("every platform key always exists after a sanitize round (editor can bind)", () => {
    const out = sanitizeBloggerStats({ platforms: { instagram: { handle: "@a" } } });
    for (const key of BLOGGER_PLATFORM_KEYS) {
      expect(out.platforms[key]).toBeDefined();
      expect(typeof out.platforms[key].handle).toBe("string");
      expect(out.platforms[key].followers === null || typeof out.platforms[key].followers === "number").toBe(true);
    }
  });

  it("trims/caps handles and coerces follower numbers", () => {
    const out = sanitizeBloggerStats({
      platforms: {
        instagram: { handle: "  @motoblog  ", followers: "12500" },
        youtube: { handle: "x".repeat(500), followers: -5 },
        telegram: { handle: "@tg", followers: 1234.7 },
      },
    });
    expect(out.platforms.instagram.handle).toBe("@motoblog");
    expect(out.platforms.instagram.followers).toBe(12500);
    expect(out.platforms.youtube.handle.length).toBe(BLOGGER_HANDLE_MAX_LEN);
    expect(out.platforms.youtube.followers).toBeNull(); // negative → garbage → null
    expect(out.platforms.telegram.followers).toBe(1235); // rounded
  });

  it("caps the audience at the sanity bound", () => {
    const out = sanitizeBloggerStats({ platforms: { tiktok: { followers: 9e12 } } });
    expect(out.platforms.tiktok.followers).toBe(BLOGGER_FOLLOWERS_MAX);
  });

  it("unknown platform keys are DROPPED (whitelist, not pass-through)", () => {
    const out = sanitizeBloggerStats({
      platforms: { onlyfans: { handle: "@x", followers: 999 }, instagram: { handle: "@ok" } },
    });
    expect((out.platforms as unknown as Record<string, unknown>).onlyfans).toBeUndefined();
    expect(out.platforms.instagram.handle).toBe("@ok");
  });

  it("legacy compact shapes still land in the canonical slots", () => {
    const asHandle = sanitizeBloggerStats({ platforms: { vk: "@club1" } });
    expect(asHandle.platforms.vk.handle).toBe("@club1");
    const asNumber = sanitizeBloggerStats({ platforms: { dzen: 3200 } });
    expect(asNumber.platforms.dzen.followers).toBe(3200);
    expect(asNumber.platforms.dzen.handle).toBe("");
  });

  it("a valid updatedAt survives read-back (the «обновлено» caption), garbage is nulled", () => {
    // the sanitizer PRESERVES a well-formed stamp for display round-trips;
    // the SAVE path is the one that ignores client stamps (server re-stamps)
    expect(sanitizeBloggerStats({ updatedAt: "2020-01-01T00:00:00Z" }).updatedAt).toBe("2020-01-01T00:00:00Z");
    expect(sanitizeBloggerStats({ updatedAt: 42 }).updatedAt).toBeNull();
  });
});

// ── audience reader + emptiness gate ─────────────────────────────────────────

describe("bloggerStatsExternalAudience / isBloggerStatsEmpty", () => {
  it("nothing declared → null (rarity scores on-chain activity only)", () => {
    expect(isBloggerStatsEmpty(EMPTY_BLOGGER_STATS)).toBe(true);
    expect(bloggerStatsExternalAudience(EMPTY_BLOGGER_STATS)).toBeNull();
  });

  it("declared presence without numbers → 1 (handle / website / followers 0)", () => {
    const withHandle = sanitizeBloggerStats({ platforms: { instagram: { handle: "@a" } } });
    expect(isBloggerStatsEmpty(withHandle)).toBe(false);
    expect(bloggerStatsExternalAudience(withHandle)).toBe(1);

    const withWebsite = sanitizeBloggerStats({ website: "motoblog.ru" });
    expect(bloggerStatsExternalAudience(withWebsite)).toBe(1);

    const zeroFollowers = sanitizeBloggerStats({ platforms: { youtube: { handle: "@c", followers: 0 } } });
    expect(bloggerStatsExternalAudience(zeroFollowers)).toBe(1);
  });

  it("numbers win and take the MAX across platforms (never a sum)", () => {
    const stats: BloggerStats = sanitizeBloggerStats({
      platforms: {
        instagram: { handle: "@a", followers: 1000 },
        youtube: { handle: "@b", followers: 45000 },
        telegram: { handle: "@c", followers: 500 },
      },
    });
    expect(bloggerStatsExternalAudience(stats)).toBe(45000);
  });
});

// ── rarity ladder integration (the reason the editor exists) ─────────────────

describe("blogger stats → rarity ladder", () => {
  const onChain = { postCount: 4, crewCount: 2, geotagCount: 2, likeCount: 5 }; // 4 + 2 + 1 + 1 = 8

  it("no stats → on-chain-only score (8 → 3★)", () => {
    const score = bloggerRarityScore({ ...onChain, externalAudience: null });
    expect(score).toBe(8);
    expect(bloggerRarityStars(score)).toBe(3);
  });

  it("declared presence (1) climbs to 4★ (bonus 3 + log10(1)+1)", () => {
    const score = bloggerRarityScore({ ...onChain, externalAudience: 1 });
    expect(score).toBe(12); // 8 + 3 + (0+1)
    expect(bloggerRarityStars(score)).toBe(4);
  });

  it("real numbers saturate the audience bonus (log10 cap → +7 max)", () => {
    const mid = bloggerRarityScore({ ...onChain, externalAudience: 12000 }); // +3+min(4, 5.08) = +7
    expect(mid).toBe(15);
    expect(bloggerRarityStars(mid)).toBe(4);
    const huge = bloggerRarityScore({ ...onChain, externalAudience: 100000000 });
    expect(huge).toBe(15); // the cap holds — stars are earned, not bought
  });

  it("the editor payoff: more posts + real audience → 5★", () => {
    const score = bloggerRarityScore({ postCount: 6, crewCount: 2, geotagCount: 2, likeCount: 5, externalAudience: 12000 }); // 10 + 7
    expect(score).toBe(17);
    expect(bloggerRarityStars(score)).toBe(5);
  });

  it("deterministic: same inputs → same score (SSR-safe)", () => {
    const a = bloggerRarityScore({ ...onChain, externalAudience: 2500 });
    const b = bloggerRarityScore({ ...onChain, externalAudience: 2500 });
    expect(a).toBe(b);
  });
});

// ── public deep links (the chips on the profile card) ────────────────────────

describe("bloggerHandleHref / bloggerWebsiteHref", () => {
  it("bare nicks map to the platform deep link", () => {
    expect(bloggerHandleHref("instagram", "@motoblog")).toBe("https://instagram.com/motoblog");
    expect(bloggerHandleHref("youtube", "channel")).toBe("https://youtube.com/@channel");
    expect(bloggerHandleHref("telegram", "@vipbike")).toBe("https://t.me/vipbike");
    expect(bloggerHandleHref("tiktok", "@ride")).toBe("https://tiktok.com/@ride");
    expect(bloggerHandleHref("vk", "club300")).toBe("https://vk.com/club300");
    expect(bloggerHandleHref("dzen", "@dzenblog")).toBe("https://dzen.ru/dzenblog");
  });

  it("full URLs pass through, hostile schemes and junk are rejected", () => {
    expect(bloggerHandleHref("instagram", "https://instagram.com/x/")).toBe("https://instagram.com/x/");
    expect(bloggerHandleHref("telegram", "javascript:alert(1)")).toBeNull();
    expect(bloggerHandleHref("telegram", "../../etc")).toBeNull();
    expect(bloggerHandleHref("telegram", "")).toBeNull();
  });

  it("website gets a https prefix and rejects hostile schemes", () => {
    expect(bloggerWebsiteHref("motoblog.ru")).toBe("https://motoblog.ru/");
    expect(bloggerWebsiteHref("https://ok.ru/blog")).toBe("https://ok.ru/blog");
    expect(bloggerWebsiteHref("javascript:alert(1)")).toBeNull();
    expect(bloggerWebsiteHref("")).toBeNull();
  });
});

// ── compact audience formatting (map pin chip) ───────────────────────────────

describe("formatBloggerAudience", () => {
  it("thousands and millions compress", () => {
    expect(formatBloggerAudience(12000)).toBe("12 тыс.");
    expect(formatBloggerAudience(1500000)).toBe("1,5 млн");
    expect(formatBloggerAudience(12000000)).toBe("12 млн");
  });

  it("small numbers keep the RU grouping (digits survive locale separators)", () => {
    expect(formatBloggerAudience(9500).replace(/\D/g, "")).toBe("9500");
    expect(formatBloggerAudience(1200).replace(/\D/g, "")).toBe("1200");
  });
});

// ── metadata reader: canonical bundle vs legacy loose keys ───────────────────

describe("externalAudienceFromUser (canonical-first)", () => {
  it("returns null for missing rows and empty metadata", () => {
    expect(externalAudienceFromUser(undefined)).toBeNull();
    expect(externalAudienceFromUser({ website: null, metadata: {} })).toBeNull();
  });

  it("CANONICAL bundle wins over legacy keys — exact numbers, no summing", () => {
    const row = {
      website: null,
      metadata: {
        blogger: { platforms: { instagram: { handle: "@a", followers: 45000 }, youtube: { handle: "@b", followers: 900 } } },
        // legacy junk that would have scored differently:
        followers: 123,
        instagram: 7,
      },
    };
    expect(externalAudienceFromUser(row)).toBe(45000);
  });

  it("an EMPTY canonical bundle falls through to the legacy scan", () => {
    const row = {
      website: null,
      metadata: {
        blogger: { platforms: { instagram: { handle: "", followers: null } } },
        instagram: { followers: 1500 },
      },
    };
    expect(externalAudienceFromUser(row)).toBe(1500);
  });

  it("legacy scan still works for pre-Task-75 metadata (website → 1, nested numbers)", () => {
    expect(externalAudienceFromUser({ website: "blog.dev", metadata: {} })).toBe(1);
    expect(
      externalAudienceFromUser({ website: null, metadata: { settings: { youtube: { subscribers: 2500 } } } }),
    ).toBe(2500);
    expect(
      externalAudienceFromUser({ website: null, metadata: { telegram: "has channel" } }),
    ).toBe(1);
  });
});

// ── wiring contracts (source assertions, iter17 style) ───────────────────────

describe("blogger stats wiring", () => {
  it("save action is owner-only and sanitizes AFTER zod (defense in depth)", () => {
    const src = read("app/franchize/server-actions/rider-profile.ts");
    expect(src).toContain("export async function saveBloggerStatsAction");
    expect(src).toContain("const actor = await resolveWallActor(parsed.data.initData)");
    expect(src).toContain("sanitizeBloggerStats({");
    // server-stamped audit field — a hostile client cannot fake it
    expect(src).toContain("updatedAt: new Date().toISOString()");
  });

  it("metadata merge touches ONLY the blogger key (bot keys pass through)", () => {
    const src = read("app/franchize/server-actions/rider-profile.ts");
    expect(src).toContain("metadata: { ...meta, blogger: saved }");
  });

  it("the profile view carries the blogger layer (public card + editor init)", () => {
    const src = read("app/franchize/server-actions/rider-profile.ts");
    expect(src).toContain("buildBloggerView(bloggerStats, bloggerOnChain)");
    // hidden-profile collapse still satisfies the total view type
    expect(src).toContain("blogger: buildBloggerView(EMPTY_BLOGGER_STATS, ZERO_BLOGGER_ON_CHAIN)");
    // on-chain aggregates counted the SAME way the discovery loader counts them
    expect(src).toContain('.eq("author_id", riderId)');
    expect(src).toContain("geotagCount: rows.filter((r) => r.geo_lat != null).length");
  });

  it("the reader is re-exported from the loader (export surface unchanged)", () => {
    const loader = read("app/franchize/discovery/load-network-model.ts");
    expect(loader).toContain("export { externalAudienceFromUser }");
  });

  it("the editor converts drafts through the SAME pure sanitize as the server", () => {
    const client = read("app/franchize/[slug]/rider/[userId]/RiderProfileClient.tsx");
    expect(client).toContain("saveBloggerStatsAction");
    expect(client).toContain("getTelegramInitData() || undefined");
    expect(client).toContain("sanitizeBloggerStats({");
    expect(client).toContain("bloggerRarityStars");
  });

  it("the map popup shows the real reach, not just the fact of presence", () => {
    const map = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(map).toContain("formatBloggerAudience");
    expect(map).toContain("blogger.externalAudience > 1");
  });
});
