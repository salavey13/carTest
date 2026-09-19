// tests/franchize/wall-engage-notify.spec.ts
//
// Wall v4 engagement notifications:
//   1. milestone rule + exactly-once semantics (source wiring),
//   2. pure TG message builders (HTML escaping!),
//   3. comment recipient dedupe + @mention extraction,
//   4. migration 20260920040000: RPC `added` flag + notify ledger + 300 KB bucket.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      const ret = {
        insert: vi.fn(() => ret),
        select: vi.fn(() => ret),
        upsert: vi.fn(() => ret),
        ...chain,
      };
      return ret;
    }),
  },
}));
vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: vi.fn(async () => ({ ok: true })),
}));

import {
  buildCommentNotifyHtml,
  buildReactionMilestoneHtml,
  dedupeCommentRecipients,
  extractMentionUsernames,
  isReactionMilestone,
  WALL_REACTION_MILESTONES,
} from "@/app/franchize/lib/wall-engage-notify";
import { parseWallText } from "@/app/franchize/lib/community-wall";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reaction milestones", () => {
  it("fires only on round numbers", () => {
    for (const m of WALL_REACTION_MILESTONES) {
      expect(isReactionMilestone(m)).toBe(true);
    }
    expect(isReactionMilestone(2)).toBe(false);
    expect(isReactionMilestone(7)).toBe(false);
    expect(isReactionMilestone(0)).toBe(false);
  });

  it("starts at 1 (the first reaction deserves a ping) and has a top cap", () => {
    expect(WALL_REACTION_MILESTONES[0]).toBe(1);
    expect(WALL_REACTION_MILESTONES.length).toBeGreaterThanOrEqual(5);
  });
});

describe("buildReactionMilestoneHtml", () => {
  it("first reaction names the reactor; later milestones show the count", () => {
    const first = buildReactionMilestoneHtml({ total: 1, topEmoji: "🔥", postPreview: "Поездка топ", reactorName: "Никита" });
    expect(first).toContain("Никита");
    expect(first).toContain("отреагировал");

    const many = buildReactionMilestoneHtml({ total: 10, topEmoji: "❤️", postPreview: "Поездка топ", reactorName: null });
    expect(many).toContain("10 реакций");
    expect(many).toContain("❤️");
  });

  it("escapes HTML in previews and names", () => {
    const html = buildReactionMilestoneHtml({
      total: 1,
      topEmoji: "❤️",
      postPreview: "<b>injection</b> & «quotes»",
      reactorName: "<script>x</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>injection</b>");
    expect(html).toContain("&lt;b&gt;injection&lt;/b&gt;");
    expect(html).toContain("&amp;");
  });
});

describe("buildCommentNotifyHtml", () => {
  it("renders all three reasons with distinct headlines", () => {
    const base = {
      commenterName: "Витя",
      commentBody: "Классный заезд!",
      postPreview: "Откатал 12 ч",
    };
    expect(buildCommentNotifyHtml({ ...base, reason: "post_author", replyToName: null })).toContain("на твой пост");
    expect(buildCommentNotifyHtml({ ...base, reason: "reply_author", replyToName: "Слава" })).toContain("в ответ Слава");
    expect(buildCommentNotifyHtml({ ...base, reason: "mentioned", replyToName: null })).toContain("упомянули");
  });

  it("escapes commenter name and body", () => {
    const html = buildCommentNotifyHtml({
      reason: "post_author",
      commenterName: "<i>@evil</i>",
      commentBody: "<a href='x'>click</a>",
      postPreview: "ok",
      replyToName: null,
    });
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("<a href=");
    expect(html).toContain("&lt;a href=");
  });
});

describe("dedupeCommentRecipients", () => {
  it("removes the commenter, duplicates and empty ids, keeps stable order", () => {
    const recipients = dedupeCommentRecipients(
      [
        { userId: "author", reason: "post_author" },
        { userId: "author", reason: "post_author" }, // dup
        { userId: "replier", reason: "reply_author", replyToName: "Слава" },
        { userId: "author", reason: "mentioned" }, // dup across reasons
        { userId: "", reason: "mentioned" }, // empty
        { userId: "me", reason: "mentioned" }, // the commenter themself
        { userId: "mention-2", reason: "mentioned" },
      ],
      "me",
    );
    expect(recipients.map((r) => r.userId)).toEqual(["author", "replier", "mention-2"]);
  });
});

describe("extractMentionUsernames", () => {
  it("extracts @mentions via the wall tokenizer, PRESERVING case (users.username stores TG case)", () => {
    const names = extractMentionUsernames("привет @Sly13 и @Nikita и @Third и @Fourth, Sly13@example.com не в счёте");
    expect(names).toContain("Sly13"); // original case — exact lookup tries it first
    expect(names).toContain("Nikita");
    expect(names.length).toBeLessThanOrEqual(3);
    expect(names).not.toContain("sly13@example.com");
  });

  it("dedupes by lowercase key (typing @sly13 twice yields one token)", () => {
    const names = extractMentionUsernames("@Sly13 и @sly13");
    expect(names.filter((n) => n.toLowerCase() === "sly13").length).toBe(1);
  });

  it("the action looks up BOTH case variants in one exact query (source contract)", () => {
    const actions = read("app/franchize/server-actions/community-wall.ts");
    expect(actions).toContain("const variants = [...new Set([...mentionNames, ...mentionNames.map((n) => n.toLowerCase())])]");
    expect(actions).toContain('.in("username", variants)');
    expect(actions).not.toContain("username.ilike.");
  });
});

describe("migration 20260920040000 (source contract)", () => {
  const migration = read("supabase/migrations/20260920040000_wall_engagement_300kb.sql");

  it("tightens the wallpix bucket to 300 KB", () => {
    expect(migration).toContain("307200");
    expect(migration).not.toContain("5242880");
  });

  it("re-creates toggle_post_reaction with the `added` flag (net-new only)", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.toggle_post_reaction");
    expect(migration).toContain("'added', v_added");
    expect(migration).toContain("v_added := true");
  });

  it("adds the exactly-once notify ledger keyed by (post, kind, key)", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.crew_post_notify_log");
    expect(migration).toContain("PRIMARY KEY (post_id, kind, key)");
    expect(migration).toContain("REFERENCES public.crew_posts(id) ON DELETE CASCADE");
  });
});

describe("dedup + anti-flood wiring (source contract)", () => {
  const lib = read("app/franchize/lib/wall-engage-notify.ts");

  it("claimNotifySlot is a TRUE ignore-duplicates upsert (P0 v4 review fix)", () => {
    expect(lib).toContain('upsert(');
    expect(lib).toContain('onConflict: "post_id,kind,key"');
    expect(lib).toContain("ignoreDuplicates: true");
    // a plain insert would 409 on conflict and hit the error branch → always send
    expect(lib).not.toMatch(/\.insert\(\{ post_id: postId, kind, key \}\)/);
  });

  it("comment fanout has an hourly cap per (recipient, post) and parallel sends", () => {
    expect(lib).toContain("WALL_COMMENT_NOTIFY_HOURLY_CAP_PER_POST = 3");
    expect(lib).toContain("countRecentCommentNotifies");
    expect(lib).toContain("Promise.allSettled(");
  });

  it("cap COUNT and slot KEY agree on the layout (recipient FIRST — prefix-LIKE works)", () => {
    // claim key:
    expect(lib).toContain("`${recipient.userId}:${input.commentId}`");
    // count pattern:
    expect(lib).toContain("`${recipientId}:%`");
    // a claim failure must not abort the loop (already-claimed DMs would
    // otherwise stay suppressed in the ledger forever):
    expect(lib).toContain("let ok = true;");
  });
});

describe("action wiring (source contract)", () => {
  const actions = read("app/franchize/server-actions/community-wall.ts");

  it("toggle action notifies only on net-new reactions and never blocks the toggle", () => {
    expect(actions).toContain("res.added === true && res.reaction === emoji");
    expect(actions).toContain("maybeNotifyReactionMilestone");
    expect(actions).toContain("non-fatal");
  });

  it("comment action fans out to post author / reply author / mentions", () => {
    expect(actions).toContain("notifyWallComment");
    expect(actions).toContain('reason: "post_author"');
    expect(actions).toContain('reason: "reply_author"');
    expect(actions).toContain('reason: "mentioned"');
  });

  it("mention lookup is EXACT (no ilike wildcards — @ivan_petrov must not ping ivanXpetrov)", () => {
    expect(actions).not.toContain("username.ilike.");
    expect(actions).toContain('.in("username", variants)');
  });

  it("reaction notify meta fetch skips hidden posts", () => {
    expect(actions).toContain('is_hidden === false');
  });

  it("new-post crew notification now carries the postId (lands ON the post)", () => {
    expect(read("app/franchize/lib/wall-notify.ts")).toContain("postId?: string | null");
    expect(actions).toMatch(/notifyNewWallPost\(\{[\s\S]{0,120}postId,\n\s*authorName/);
  });
});
