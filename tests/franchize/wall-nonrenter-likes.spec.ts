// tests/franchize/wall-nonrenter-likes.spec.ts
//
// Boss request (2026-10-11): «Allow non renter (simple users) to like posts
// on the crew wall». Пиним контракт: ЛАЙК (реакция) доступен ЛЮБОЙ
// верифицированной Telegram-личности — членство в экипаже и аренды НЕ нужны.
// canWriteOnWall (посты/комментарии) аренду требует, togglePostReactionAction —
// НЕТ. Регрессия: если кто-то «закрутит гайки» и вернёт renter-gate в лайки —
// эта спека упадёт.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "tg_actor",
  verifyTelegramActorCookieValue: (value: string | undefined) =>
    value === "valid-actor-cookie" ? "555000111" : null,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/app/franchize/lib/crew-bot", () => ({
  resolveCrewBotUsername: vi.fn(async () => null),
}));

vi.mock("@/app/franchize/lib/wall-engage-notify", () => ({
  maybeNotifyReactionMilestone: vi.fn(async () => undefined),
}));

vi.mock("@/lib/wall-deeplink", () => ({
  buildTelegramAppLink: vi.fn(() => ""),
  sanitizeWallSlug: vi.fn((v: string) => v),
  wallPostStartParam: vi.fn(() => ""),
}));

import { canWriteOnWall, resolveWallActor } from "@/app/franchize/lib/wall-access";
import { togglePostReactionAction } from "@/app/franchize/server-actions/community-wall";

/** query-builder для count/head-запросов (assertReactionRate и т.п.). */
function countChain(count: number) {
  return {
    select: () => ({
      eq: () => ({
        gte: async () => ({ count, error: null }),
      }),
    }),
  };
}

/** Универсальная цепочка (любое число .eq/.limit) → maybeSingle(res). */
function universalChain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {
    eq: () => c,
    limit: () => c,
    maybeSingle: async () => result,
  };
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  // verified cookie identity — NON-renter: ни crew_members, ни rentals нет
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "valid-actor-cookie" }) });
});

describe("non-renter likes on the crew wall", () => {
  it("resolveWallActor accepts a verified cookie WITHOUT any crew relation", async () => {
    const actor = await resolveWallActor();
    expect(actor).not.toBeNull();
    expect(actor?.userId).toBe("555000111");
  });

  it("togglePostReactionAction succeeds for a user with NO membership and NO rentals", async () => {
    // assertReactionRate → 0 реакций за час
    mocks.from.mockImplementation((table: string) => {
      if (table === "crew_post_reactions") return countChain(0);
      // milestone-notify meta read: author ≠ reactor, пост видимый, crew slug
      if (table === "crew_posts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { author_id: "999", body: "Колесо фортуны — крути!", crew_id: "crew-1", is_hidden: false, crews: { slug: "vip-bike" } },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    // сам RPC: лайк добавлен, 14 лайков (за порогом следующего милистоуна 25)
    mocks.rpc.mockResolvedValue({
      data: { reaction: "🔥", like_count: 14, reaction_counts: { "🔥": 14 }, added: true },
      error: null,
    });

    const res = await togglePostReactionAction({ postId: "00000000-0000-4000-8000-000000000000", emoji: "🔥" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reaction).toBe("🔥");
      expect(res.likeCount).toBe(14);
    }
    expect(mocks.rpc).toHaveBeenCalledWith("toggle_post_reaction", expect.objectContaining({ p_user_id: "555000111" }));
  });

  it("source pins the contract: reaction toggle does NOT require canWriteOnWall", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/server-actions/community-wall.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function togglePostReactionAction"), src.indexOf("// ── ADD COMMENT"));
    expect(fn).not.toContain("canWriteOnWall");
    // identity всё равно обязательна (аноним с веба не может лайкать)
    expect(fn).toContain("resolveWallActor");
  });

  it("source pins the wall-access doc: likes stay open, writes need a crew relation", () => {
    const src = readFileSync(join(process.cwd(), "app/franchize/lib/wall-access.ts"), "utf8");
    expect(src).toContain("Likes stay open to any VERIFIED Telegram identity");
    // фраза разита переносом строки с '*' в докблоке — пиним устойчивый кусок
    expect(src.replace(/\s+/g, " ")).toContain("least one rental in this crew");
  });

  it("posting still requires the crew relation (renter or staff)", async () => {
    // не член экипажа и без аренд → canWriteOnWall = false
    mocks.from.mockImplementation((table: string) => {
      if (table === "users") {
        return { select: () => universalChain({ data: null, error: null }) };
      }
      if (table === "crew_members" || table === "rentals") {
        return { select: () => universalChain({ data: null, error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    });
    expect(await canWriteOnWall("555000111", { id: "crew-1", owner_id: "100" })).toBe(false);
  });
});
