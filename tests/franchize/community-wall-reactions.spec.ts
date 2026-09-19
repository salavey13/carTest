// tests/franchize/community-wall-reactions.spec.ts
//
// Unit tests for wall v3 emoji reactions: pure optimistic math (the client
// mirrors the DB trigger), server-side counter hygiene and the VK tap
// semantics (re-tap removes, tap another switches).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isValidWallReaction,
  sanitizeReactionCounts,
  toggleReactionOptimistic,
  WALL_REACTIONS,
} from "@/app/franchize/lib/community-wall";

const ROOT = join(__dirname, "../..");
const MIGRATION = "supabase/migrations/20260920010000_onlybike_wall_reactions.sql";

/** Boss-guard: the SQL CHECK constraint can never drift from WALL_REACTIONS. */
describe("reactions migration ↔ lib sync", () => {
  const sql = existsSync(join(ROOT, MIGRATION))
    ? readFileSync(join(ROOT, MIGRATION), "utf8")
    : "";

  it("migration exists", () => {
    expect(sql).not.toBe("");
  });

  it("every WALL_REACTIONS emoji is in the SQL CHECK + RPC whitelist", () => {
    for (const emoji of WALL_REACTIONS) {
      expect(sql.split(emoji).length - 1).toBeGreaterThanOrEqual(2);
    }
  });

  it("legacy likes are retired, RLS is on, no anon SELECT policy", () => {
    expect(sql).toContain("DROP TABLE public.crew_post_likes");
    expect(sql).toContain("ALTER TABLE public.crew_post_reactions ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toMatch(/CREATE POLICY[^;]*crew_post_reactions/);
  });

  it("atomic toggle RPC exists and returns the fresh aggregate", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.toggle_post_reaction");
    expect(sql).toContain("jsonb_build_object('reaction', v_final, 'like_count', v_total, 'reaction_counts', v_counts)");
  });

  it("backfill is exception-safe and refuses to drop likes on an incomplete copy", () => {
    expect(sql).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(sql).toContain("backfill incomplete");
  });
});

describe("WALL_REACTIONS", () => {
  it("has ❤️ as the default quick-tap reaction, six total", () => {
    expect(WALL_REACTIONS[0]).toBe("❤️");
    expect(WALL_REACTIONS).toHaveLength(6);
  });
});

describe("isValidWallReaction", () => {
  it("accepts exactly the set members", () => {
    for (const emoji of WALL_REACTIONS) expect(isValidWallReaction(emoji)).toBe(true);
  });

  it("rejects junk, unknown emoji and non-strings", () => {
    expect(isValidWallReaction("💀")).toBe(false);
    expect(isValidWallReaction("spam")).toBe(false);
    expect(isValidWallReaction(42)).toBe(false);
    expect(isValidWallReaction(null)).toBe(false);
  });
});

describe("sanitizeReactionCounts", () => {
  it("keeps known emoji with positive ints, drops everything else", () => {
    expect(sanitizeReactionCounts({ "❤️": 3, "🔥": 1 })).toEqual({ "❤️": 3, "🔥": 1 });
    expect(sanitizeReactionCounts({ "💀": 5, spam: 2, "👍": 0, "😂": -1, "😮": 1.5 })).toEqual({});
  });

  it("returns {} for hostile shapes", () => {
    expect(sanitizeReactionCounts(null)).toEqual({});
    expect(sanitizeReactionCounts("x")).toEqual({});
    expect(sanitizeReactionCounts([1, 2])).toEqual({});
  });
});

describe("toggleReactionOptimistic (VK tap semantics)", () => {
  it("adds a fresh reaction: +1 total", () => {
    expect(toggleReactionOptimistic({}, 0, null, "🔥")).toEqual({
      counts: { "🔥": 1 },
      total: 1,
      next: "🔥",
    });
  });

  it("re-tap of the same emoji removes it (undo), dropping zero keys", () => {
    expect(toggleReactionOptimistic({ "❤️": 1 }, 1, "❤️", "❤️")).toEqual({ counts: {}, total: 0, next: null });
    expect(toggleReactionOptimistic({ "❤️": 3 }, 3, "❤️", "❤️")).toEqual({ counts: { "❤️": 2 }, total: 2, next: null });
  });

  it("switching emoji moves the count without changing the total", () => {
    const res = toggleReactionOptimistic({ "❤️": 2 }, 2, "❤️", "🏍");
    expect(res).toEqual({ counts: { "❤️": 1, "🏍": 1 }, total: 2, next: "🏍" });
    // and when it was the last ❤️, the zero key is dropped
    const res2 = toggleReactionOptimistic({ "❤️": 1, "🔥": 2 }, 3, "❤️", "🏍");
    expect(res2).toEqual({ counts: { "🔥": 2, "🏍": 1 }, total: 3, next: "🏍" });
  });

  it("never lets the total go negative on weird snapshots", () => {
    expect(toggleReactionOptimistic({}, 0, "🔥", "🔥").total).toBe(0);
  });
});
