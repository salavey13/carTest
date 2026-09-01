import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter19 — subrenter↔bike assignment:
//   1. user-picker lib (query sanitizer, or= expression, ranking, labels)
//   2. searchUsersForSubrenterAction (permission gate + mapping + ranking)
//   3. SubrenterManagerPanel picker wiring (source guards)
//   4. CLI skill scripts/assign-subrenter-skill.mjs (dry-run default, syncs)
// ─────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  schema: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    schema: mocks.schema,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/webhook-handlers/actions/sendComplexMessage", () => ({
  sendComplexMessage: vi.fn(async () => ({ success: true })),
}));

import {
  buildSubrenterUserLabel,
  buildUserSearchOrExpression,
  normalizeSubrenterUserQuery,
  rankSubrenterUserCandidate,
  SUBRENTER_USER_SEARCH_LIMIT,
  SUBRENTER_USER_SEARCH_MIN_LENGTH,
} from "@/app/franchize/lib/subrenter-user-search";
import { searchUsersForSubrenterAction } from "@/app/franchize/server-actions/bike-subrenter";

// 2026-09-02 (SA-002): the action now resolves the actor SERVER-side (signed
// cookie / initData) instead of trusting the client-supplied actorUserId.
// These tests simulate a valid signed cookie via the actor-cookie mock — the
// id below is what verifyTelegramActorCookieValue returns for this suite.
const authMock = vi.hoisted(() => ({ userId: "425137783" as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (_name: string) => ({ value: "mock-payload.mock-signature" }),
  }),
}));
vi.mock("@/lib/telegram-actor-cookie", () => ({
  TELEGRAM_ACTOR_COOKIE: "cartest_tg_actor",
  verifyTelegramActorCookieValue: () => authMock.userId,
}));

// ── 1. Pure picker helpers ───────────────────────────────────────────────────

describe("iter19 · subrenter-user-search (pure)", () => {
  it("sanitizer strips @, collapses whitespace and removes or=-breaking characters", () => {
    expect(normalizeSubrenterUserQuery("  @K0r_Al  ")).toBe("K0r_Al");
    expect(normalizeSubrenterUserQuery("Александр    Корнилов")).toBe("Александр Корнилов");
    // commas/parens/quotes/backslashes would split or break the PostgREST
    // disjunction — they must never reach the query (letters survive)
    expect(normalizeSubrenterUserQuery('a,b(c)"d\\e')).toBe("abcde");
    expect(normalizeSubrenterUserQuery("")).toBe("");
    expect(normalizeSubrenterUserQuery("@")).toBe("");
  });

  it("or= expression quotes values and wildcards id-prefix + name/username substring", () => {
    expect(buildUserSearchOrExpression("K0r_Al")).toBe(
      'user_id.ilike."K0r_Al*",username.ilike."*K0r_Al*",full_name.ilike."*K0r_Al*"',
    );
    // dots in full names («А. Корнилов») survive because values are quoted
    expect(buildUserSearchOrExpression("А. Корнил")).toContain('full_name.ilike."*А. Корнил*"');
  });

  it("ranking: exact id beats username prefix beats substring beats name-only", () => {
    const q = "4251";
    expect(rankSubrenterUserCandidate({ userId: "4251", username: null, fullName: null }, q)).toBe(0);
    expect(rankSubrenterUserCandidate({ userId: "999", username: "4251fan", fullName: null }, q)).toBe(1);
    expect(rankSubrenterUserCandidate({ userId: "999", username: "fan4251", fullName: null }, q)).toBe(2);
    expect(rankSubrenterUserCandidate({ userId: "999", username: null, fullName: "Иван 4251" }, q)).toBe(3);
  });

  it("label joins name · @username · id and skips missing parts", () => {
    expect(
      buildSubrenterUserLabel({ userId: "425137783", username: "K0r_Al", fullName: "Александр Корнилов" }),
    ).toBe("Александр Корнилов · @K0r_Al · 425137783");
    expect(buildSubrenterUserLabel({ userId: "425137783", username: null, fullName: null })).toBe("425137783");
    expect(buildSubrenterUserLabel({ userId: "1", username: "@dup_at", fullName: " " })).toBe("@dup_at · 1");
  });

  it("constants: min 2 chars, max 10 rows", () => {
    expect(SUBRENTER_USER_SEARCH_MIN_LENGTH).toBe(2);
    expect(SUBRENTER_USER_SEARCH_LIMIT).toBe(10);
  });
});

// ── 2. searchUsersForSubrenterAction ─────────────────────────────────────────

describe("iter19 · searchUsersForSubrenterAction", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    // Default: a properly signed actor cookie for the crew-owner id.
    authMock.userId = "425137783";
  });

  function crewQuery(ownerId: string) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { id: "crew-1", owner_id: ownerId }, error: null })),
        })),
      })),
    };
  }

  function usersQuery(rows: unknown[], captured: { or?: unknown; order?: unknown; limit?: unknown }) {
    return {
      select: vi.fn(() => ({
        or: vi.fn((expr: string) => {
          captured.or = expr;
          return {
            order: vi.fn((...o: unknown[]) => {
              captured.order = o;
              return {
                limit: vi.fn((n: number) => {
                  captured.limit = n;
                  return Promise.resolve({ data: rows, error: null });
                }),
              };
            }),
          };
        }),
      })),
    };
  }

  it("rejects queries shorter than the minimum", async () => {
    const res = await searchUsersForSubrenterAction({ slug: "vip-bike", actorUserId: "1", query: "a" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("2");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("denies non-admins before touching the users table", async () => {
    authMock.userId = "425137783"; // signed cookie identity — NOT the owner below
    // crew owner is somebody else AND membership check returns nothing
    const membershipQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    };
    const topUserQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { role: "attendee", status: "free", metadata: {} }, error: null })),
        })),
      })),
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "crews") return crewQuery("owner-1");
      if (table === "crew_members") return membershipQuery;
      return topUserQuery;
    });
    const res = await searchUsersForSubrenterAction({ slug: "vip-bike", actorUserId: "425137783", query: "Корнилов" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Недостаточно прав.");
    // the users table is touched exactly ONCE — by the permission check
    // (top-level role lookup), never by the picker search itself
    const usersCalls = mocks.from.mock.calls.filter((c) => c[0] === "users");
    expect(usersCalls).toHaveLength(1);
  });

  it("searches with the quoted or= expression, limit 10, and ranks the exact id first", async () => {
    const captured: { or?: unknown; order?: unknown; limit?: unknown } = {};
    const rows = [
      { user_id: "111", username: "kornilov_fan", full_name: "Фанат" },
      { user_id: "425137783", username: "K0r_Al", full_name: "Александр Корнилов" },
    ];
    mocks.from.mockImplementation((table: string) => {
      if (table === "crews") return crewQuery("425137783"); // actor IS the owner
      return usersQuery(rows, captured);
    });

    const res = await searchUsersForSubrenterAction({
      slug: "vip-bike",
      actorUserId: "425137783",
      query: "@425137783",
    });

    expect(res.success).toBe(true);
    expect(captured.or).toBe('user_id.ilike."425137783*",username.ilike."*425137783*",full_name.ilike."*425137783*"');
    expect(captured.limit).toBe(10);
    expect(captured.order?.[0]).toBe("username");
    // exact id match must be ranked first even though the DB ordered it second
    expect(res.data?.[0]).toEqual({ userId: "425137783", username: "K0r_Al", fullName: "Александр Корнилов" });
    expect(res.data?.[1]?.userId).toBe("111");
  });

  it("returns a DB error instead of throwing", async () => {
    const failing = {
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
          })),
        })),
      })),
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "crews") return crewQuery("425137783");
      return failing;
    });
    const res = await searchUsersForSubrenterAction({ slug: "vip-bike", actorUserId: "425137783", query: "qq" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("boom");
  });
});

// ── 3+4. Source guards (wiring) ──────────────────────────────────────────────

describe("iter19 · source guards (wiring)", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("SubrenterManagerPanel wires the picker: search action, Найти button, pickUser, label hint", () => {
    const src = read("app/franchize/components/SubrenterManagerPanel.tsx");
    expect(src).toContain("searchUsersForSubrenterAction");
    expect(src).toContain("openPicker");
    expect(src).toContain("pickUser");
    expect(src).toContain("buildSubrenterUserLabel");
    expect(src).toContain("pickerResults");
    // manual raw-id entry must survive (partners who never opened the app)
    expect(src).toMatch(/inputMode="numeric"/);
    expect(src).toContain("Найти");
    // typed edits invalidate the picked-user hint
    expect(src).toMatch(/setPickedUser\(null\)/);
  });

  it("bike-subrenter.ts: search action is admin-gated and save resolves the partner label", () => {
    const src = read("app/franchize/server-actions/bike-subrenter.ts");
    expect(src).toContain("export async function searchUsersForSubrenterAction");
    expect(src).toContain("canManageSubrenters");
    expect(src).toMatch(/\.or\(buildUserSearchOrExpression\(query\)\)/);
    // iter19: save() gets a resolved label for the toast
    expect(src).toContain("subrenterLabel");
    expect(src).toContain("subrenterKnownUser");
    expect(src).toContain("buildSubrenterUserLabel");
  });

  it("REGRESSION (PGRST204): the cars PATCH must never send updated_at — cars has no such column", () => {
    const src = read("app/franchize/server-actions/bike-subrenter.ts");
    const carsUpdate = src.match(/from\("cars"\)[\s\S]{0,220}?\.update\(([^)]*)\)/g) ?? [];
    expect(carsUpdate.length).toBeGreaterThan(0);
    for (const block of carsUpdate) {
      const args = block.slice(block.indexOf(".update("));
      expect(args).not.toContain("updated_at");
    }
    // the script follows the same rule
    const script = read("scripts/assign-subrenter-skill.mjs");
    const carPatch = script.match(/cars\?id=eq\.[\s\S]{0,260}?body: JSON\.stringify\(([^)]*)\)/g) ?? [];
    for (const block of carPatch) {
      expect(block).not.toContain("updated_at");
    }
  });

  it("CLI skill: dry-run default, --apply gate, --clear, --list, flag sync, TG via forwarding API", () => {
    const src = read("scripts/assign-subrenter-skill.mjs");
    // safety: dry-run unless --apply
    expect(src).toContain("const APPLY = flags.apply === true;");
    expect(src).toContain("DRY RUN");
    // features
    expect(src).toContain("--clear");
    expect(src).toContain("--list");
    expect(src).toContain("subrenter_chat_id");
    expect(src).toContain("subrenterOf");
    // both the new AND the previous partner get their flag refreshed
    expect(src).toContain("previousSubrenter");
    // notification goes through the token-less forwarding API, best-effort
    expect(src).toContain("forward-telegram");
    expect(src).toContain("non-fatal");
    // it must resolve users by id / exact username / fuzzy name like the panel
    expect(src).toContain("username.ilike");
    expect(src).toContain("full_name.ilike");
  });

  it("skill doc documents the three assignment paths (web picker / CLI / bot /subrent)", () => {
    const doc = read("docs/skills/fk-pasha-admin.md");
    expect(doc).toContain("assign-subrenter-skill.mjs");
    expect(doc).toContain("searchUsersForSubrenterAction");
    expect(doc).toContain("user picker");
  });
});
