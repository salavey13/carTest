// tests/franchize/rider-profile.spec.ts
//
// Rider profile v1 (Chain-inspired): pure-lib behaviour + the wiring contracts
// that keep the new surface consistent with the wall family (palette bridge,
// author links, who-reacted privacy, prefs-aware fanout).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeRiderWallBadges,
  EMPTY_RIDER_PROFILE_CUSTOM,
  RIDER_BIO_MAX_LEN,
  RIDER_STATUS_EMOJIS,
  riderSinceLabel,
  sanitizeRiderProfileCustom,
  type RiderPublicStats,
} from "@/app/franchize/lib/rider-profile";
import { parseWallDeepLink, riderProfileStartParam } from "@/lib/wall-deeplink";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── pure lib: sanitizeRiderProfileCustom ─────────────────────────────────────

describe("sanitizeRiderProfileCustom", () => {
  it("returns the empty profile for hostile shapes", () => {
    expect(sanitizeRiderProfileCustom(null)).toEqual(EMPTY_RIDER_PROFILE_CUSTOM);
    expect(sanitizeRiderProfileCustom(42)).toEqual(EMPTY_RIDER_PROFILE_CUSTOM);
    expect(sanitizeRiderProfileCustom({ bio: { evil: true } })).toEqual(EMPTY_RIDER_PROFILE_CUSTOM);
  });

  it("caps bio/city/statusText and collapses whitespace", () => {
    const long = "очень длинная биография ".repeat(40);
    const out = sanitizeRiderProfileCustom({ bio: long, city: "  Нижний   Новгород  ", statusText: "  жду   выезда  " });
    expect(out.bio.length).toBeLessThanOrEqual(RIDER_BIO_MAX_LEN);
    expect(out.city).toBe("Нижний Новгород");
    expect(out.statusText).toBe("жду выезда");
  });

  it("whitelists the status emoji — arbitrary glyphs are dropped", () => {
    expect(sanitizeRiderProfileCustom({ statusEmoji: "🏍" }).statusEmoji).toBe("🏍");
    expect(sanitizeRiderProfileCustom({ statusEmoji: "<script>" }).statusEmoji).toBe("");
    expect(sanitizeRiderProfileCustom({ statusEmoji: "🤷" }).statusEmoji).toBe("");
  });

  it("hideProfile is true only for a literal boolean true", () => {
    expect(sanitizeRiderProfileCustom({ hideProfile: true }).hideProfile).toBe(true);
    expect(sanitizeRiderProfileCustom({ hideProfile: "yes" }).hideProfile).toBe(false);
  });
});

// ── pure lib: badges ─────────────────────────────────────────────────────────

const ZERO_STATS: RiderPublicStats = {
  ridesCount: 0,
  hoursRented: 0,
  bikesUsed: 0,
  postsCount: 0,
  photoPostsCount: 0,
  commentsCount: 0,
  reactionsReceived: 0,
  checkinCount: 0,
  firstRideAt: null,
};

describe("computeRiderWallBadges", () => {
  it("new rider: all locked with zero progress and a hint", () => {
    const badges = computeRiderWallBadges(ZERO_STATS);
    expect(badges.length).toBeGreaterThan(4);
    for (const b of badges) {
      expect(b.unlocked).toBe(false);
      expect(b.progress).toBe(0);
      expect(b.hint).toBeTruthy();
    }
  });

  it("milestones unlock in order (first post → voice)", () => {
    const first = computeRiderWallBadges({ ...ZERO_STATS, postsCount: 1 });
    const voice = computeRiderWallBadges({ ...ZERO_STATS, postsCount: 10 });
    const firstPost = first.find((b) => b.id === "first_post");
    const voiceBadge = voice.find((b) => b.id === "voice");
    expect(firstPost?.unlocked).toBe(true);
    expect(voiceBadge?.unlocked).toBe(true);
    // progress sits at 1 when unlocked
    expect(firstPost?.progress).toBe(1);
  });

  it("partial progress fills the bar and the hint counts down", () => {
    const badges = computeRiderWallBadges({ ...ZERO_STATS, reactionsReceived: 10 });
    const fav = badges.find((b) => b.id === "crowd_fav");
    expect(fav?.unlocked).toBe(false);
    expect(fav?.progress).toBeCloseTo(10 / 25, 5);
    expect(fav?.hint).toBe("ещё 15 реакций");
  });

  it("ride milestone appears only past 5 rides and mirrors the stats-post badge", () => {
    expect(computeRiderWallBadges({ ...ZERO_STATS, ridesCount: 4 }).find((b) => b.id === "ride_milestone")).toBeUndefined();
    const milestone = computeRiderWallBadges({ ...ZERO_STATS, ridesCount: 5 }).find((b) => b.id === "ride_milestone");
    expect(milestone?.unlocked).toBe(true);
    expect(milestone?.emoji).toBe("🔥");
  });

  it("photo + check-in + hours badges unlock on their thresholds", () => {
    const badges = computeRiderWallBadges({ ...ZERO_STATS, photoPostsCount: 3, checkinCount: 3, hoursRented: 20 });
    expect(badges.find((b) => b.id === "photographer")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "stamps")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "saddle")?.unlocked).toBe(true);
  });
});

describe("riderSinceLabel", () => {
  it("prefers the first ride, falls back to the first post, tolerates junk", () => {
    expect(riderSinceLabel("2024-03-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe("в экипаже с 2024 года");
    expect(riderSinceLabel(null, "2023-07-11T00:00:00Z")).toBe("в экипаже с 2023 года");
    expect(riderSinceLabel(null, null)).toBeNull();
    expect(riderSinceLabel("garbage", "also-garbage")).toBeNull();
  });
});

// ── deeplink grammar: rider_<userId>_<slug> ──────────────────────────────────

describe("rider deeplink", () => {
  it("parses rider_<id>_<slug>", () => {
    expect(parseWallDeepLink("rider_413553377_vip-bike")).toEqual({ kind: "rider", userId: "413553377", slug: "vip-bike" });
  });

  it("rejects non-numeric ids, missing slug and empty segments", () => {
    expect(parseWallDeepLink("rider_abc_vip-bike")).toBeNull();
    expect(parseWallDeepLink("rider_413553377_")).toBeNull();
    expect(parseWallDeepLink("rider_413553377")).toBeNull();
    expect(parseWallDeepLink("rider_")).toBeNull();
  });

  it("is not confused with ride_ (the session composer)", () => {
    expect(parseWallDeepLink("rider_1_x")?.kind).toBe("rider");
    expect(parseWallDeepLink("ride_6f1d2c3a-1111-4222-8333-944455566677_vip-bike")?.kind).toBe("compose-ride");
  });

  it("builder round-trips and throws on hostile ids", () => {
    expect(riderProfileStartParam("413553377", "vip-bike")).toBe("rider_413553377_vip-bike");
    expect(() => riderProfileStartParam("drop; table", "vip-bike")).toThrow();
  });
});

// ── wiring contracts (source assertions, iter17 style) ───────────────────────

describe("rider profile wiring", () => {
  it("feed action accepts authorId and filters the query (no mapping fork)", () => {
    const src = read("app/franchize/server-actions/community-wall.ts");
    // FIX 2026-09-21: author_id is TEXT (TG numeric users.user_id) — the old
    // .uuid() gate rejected every real rider id, so the profile always showed
    // «Постов пока нет». Digits-only keeps hostile probing out instead.
    expect(src).toContain('regex(/^[0-9]{1,16}$/, "authorId must be a TG numeric id")');
    expect(src).toContain('if (authorId) query = query.eq("author_id", authorId);');
  });

  it("profile page renders with the SAME --community-* bridge as the wall", () => {
    const page = read("app/franchize/[slug]/rider/[userId]/page.tsx");
    expect(page).toContain('"--community-accent"');
    expect(page).toContain('"--community-accent-text"');
    // Cross-crew fanout: the page aggregates the rider's posts from ALL their
    // crews (loadRiderPostsAcrossCrews → getCommunityWallAction per crew).
    expect(page).toContain("loadRiderPostsAcrossCrews({ riderId: userId.trim() })");
    expect(page).toContain("getCommunityWallAction({ slug: crew.slug, authorId: riderId })");
    // riderId must be a TG numeric id — non-matching params 404 before any DB hit
    expect(page).toContain("RIDER_ID_RE.test(userId.trim())");
  });

  it("wall authors and comment authors link to the rider profile", () => {
    const client = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(client).toContain("href={`/franchize/${slug}/rider/${post.author.userId}`}");
    expect(client).toContain("href={`/franchize/${slug}/rider/${c.author.userId}`}");
    // crew-scope posts keep the plain header (the crew speaks, not a person)
    expect(client).toContain('post.authorScope === "rider" ? (');
  });

  it("who-reacted modal is portaled and riders-only (privacy parity with the table)", () => {
    const modal = read("app/franchize/[slug]/community/WhoReactedModal.tsx");
    expect(modal).toContain("getPostReactionsAction");
    expect(modal).toContain("getTelegramInitData");
    const client = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    // must be rendered through WallOverlayPortal (containing-block lesson)
    expect(client).toContain("<WhoReactedModal slug={slug} postId={whoReacted} onClose={() => setWhoReacted(null)} />");
  });

  it("who-reacted action gates on identity AND post ∈ crew (no cross-crew enumeration)", () => {
    const actions = read("app/franchize/server-actions/rider-profile.ts");
    expect(actions).toContain("if (!viewer) return { ok: false, error:");
    expect(actions).toContain("post.crew_id !== crew.id");
  });

  it("save action is owner-only (no staff override on a personal bio)", () => {
    const actions = read("app/franchize/server-actions/rider-profile.ts");
    expect(actions).toContain("const actor = await resolveWallActor(parsed.data.initData)");
    // deep-sanitize + emoji whitelist AFTER zod (defense in depth)
    expect(actions).toContain("sanitizeRiderProfileCustom({");
    expect(actions).toContain("RIDER_STATUS_EMOJIS as readonly string[]).includes(custom.statusEmoji)");
  });

  it("hideProfile collapses the public view for non-staff viewers", () => {
    const actions = read("app/franchize/server-actions/rider-profile.ts");
    expect(actions).toContain("if (custom.hideProfile && !isSelf && !isStaff)");
  });

  it("profile only renders for riders tied to the crew (no cross-crew identity cards)", () => {
    const actions = read("app/franchize/server-actions/rider-profile.ts");
    // tie = member / owner / any rental row / any visible wall post / self
    expect(actions).toContain("if (!hasTie) return { ok: false, error:");
    expect(actions).toContain("riderRow.user_id === crew.owner_id");
    expect(actions).toContain('from("crew_members")');
    expect(actions).toContain('from("rentals")');
  });

  it("wall fanout respects the «Стена экипажа» opt-out (fail-open helper)", () => {
    const prefs = read("app/franchize/lib/wall-prefs.ts");
    expect(prefs).toContain("return source.wallActivity !== false;");
    const notify = read("app/franchize/lib/wall-notify.ts");
    expect(notify).toContain("filterWallNotifyRecipients(resolved, input.slug)");
    const engage = read("app/franchize/lib/wall-engage-notify.ts");
    expect(engage).toContain("userWantsWallActivity(authorRow.metadata, input.slug)");
    expect(engage).toContain("notifyWallPostMentions");
    const actions = read("app/franchize/server-actions/community-wall.ts");
    // post mentions fire after the crew fanout, awaited (d275c52 lesson)
    expect(actions).toMatch(/await notifyNewWallPost\([\s\S]{1,600}?await notifyWallPostMentions\(/);
  });

  it("prefs type + normalize + UI toggle include wallActivity", () => {
    const pa = read("app/franchize/profile-actions.ts");
    expect(pa).toContain("wallActivity: boolean;");
    expect(pa).toContain("wallActivity: typeof raw.wallActivity === \"boolean\"");
    const ui = read("app/franchize/components/FranchizeProfileButton.tsx");
    expect(ui).toContain('key: "wallActivity"');
  });

  it("map page + drawer carry the wall family: palette bridge, live chip, profile links", () => {
    const mapPage = read("app/franchize/[slug]/map-riders/page.tsx");
    expect(mapPage).toContain('"--community-accent"');
    const mapClient = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(mapClient).toContain("cw-live-dot");
    // Стена больше не бэнд-ссылка: она и ЕСТЬ контент шита карты.
    expect(mapClient).toContain("Стена экипажа");
    expect(mapClient).toContain("<CommunityWallClient");
    const drawer = read("components/map-riders/RidersDrawer.tsx");
    expect(drawer).toContain("openRiderProfile(session.user_id)");
    // router push (no <a> inside <button> — invalid HTML)
    expect(drawer).toContain("router.push(`/franchize/${crewSlug}/rider/${userId}`)");
  });

  it("router fast-paths rider_<id>_<slug> and the gated fallback knows the kind", () => {
    const router = read("hooks/useStartParamRouter.ts");
    expect(router).toContain('link.kind === "rider"');
    expect(router).toContain("/rider/${link.userId}");
  });

  it("CRM profile links to the public rider profile", () => {
    const header = read("app/franchize/[slug]/profile/components/ProfileHeaderPanel.tsx");
    expect(header).toContain("rider/${riderId}");
  });
});
