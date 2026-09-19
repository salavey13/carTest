// tests/franchize/community-wall-reactions.spec.ts
//
// Unit tests for wall v3 emoji reactions: pure optimistic math (the client
// mirrors the DB trigger), server-side counter hygiene and the VK tap
// semantics (re-tap removes, tap another switches).

import { describe, expect, it } from "vitest";
import {
  isValidWallReaction,
  sanitizeReactionCounts,
  toggleReactionOptimistic,
  WALL_REACTIONS,
} from "@/app/franchize/lib/community-wall";

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
