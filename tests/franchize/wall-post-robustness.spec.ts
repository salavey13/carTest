// tests/franchize/wall-post-robustness.spec.ts
//
// BOSS 2026-10-02 — «make posting on crew walls robust as fuck»:
//   1. clientNonce idempotency: повторный тап «Опубликовать» после потерянного
//      ответа больше НЕ дублирует пост (dedupe по metadata->>client_nonce,
//      зеркало client_request_id из rentals);
//   2. single-flight claim рассылки: параллельные kick/крон не задваивают
//      доставку — CAS по run_token, stale-claim перехватывается;
//   3. queue не рапортует успех в пустоту (пост удалён → false);
//   4. kick-роут самозалечивает потерянную постановку job (self-heal);
//   5. клиент: submitPost с try/finally (композер больше не висит навсегда),
//      postingRef double-submit guard, pendingUploads guard, таймауты на
//      upload/kick fetch'ах, draft-автосохранение текста, try/finally на
//      комментариях/реакциях/ленте.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stateful supabase mock: per-table data for maybeSingle/single reads.
const tableData: Record<string, unknown> = {};
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const ret = () => chain;
      chain.select = vi.fn(ret);
      chain.insert = vi.fn(ret);
      chain.update = vi.fn(ret);
      chain.upsert = vi.fn(ret);
      chain.delete = vi.fn(ret);
      chain.eq = vi.fn(ret);
      chain.neq = vi.fn(ret);
      chain.is = vi.fn(ret);
      chain.gte = vi.fn(ret);
      chain.lt = vi.fn(ret);
      chain.in = vi.fn(ret);
      chain.not = vi.fn(ret);
      chain.or = vi.fn(ret);
      chain.order = vi.fn(ret);
      chain.limit = vi.fn(ret);
      chain.range = vi.fn(ret);
      chain.single = vi.fn(async () => ({ data: tableData[table] ?? null, error: null }));
      chain.maybeSingle = vi.fn(async () => ({ data: tableData[table] ?? null, error: null }));
      return chain;
    }),
  },
}));

vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: vi.fn(async () => ({ ok: true })),
}));

import {
  RENTER_NOTIFY_RUN_STALE_MS,
  isNotifyRunStale,
  parseNotifyJob,
  processWallRenterNotifyJob,
  queueWallRenterNotifyJob,
  type WallRenterNotifyJob,
} from "@/app/franchize/lib/wall-renter-notify";
import { telegramDeliver } from "@/lib/telegram-transport";
import { makeClientNonce } from "@/lib/client-nonce";
import { isTimeoutError, timeoutSignal } from "@/lib/timeout-signal";

const CLIENT = join(process.cwd(), "app/franchize/[slug]/community/CommunityWallClient.tsx");
const MAP = join(process.cwd(), "components/map-riders/MapRidersClientRefactored.tsx");
const ACTION = join(process.cwd(), "app/franchize/server-actions/community-wall.ts");
const ROUTE = join(process.cwd(), "app/api/franchize/wall-renter-notify/route.ts");
const LIB = join(process.cwd(), "app/franchize/lib/wall-renter-notify.ts");

function baseJob(overrides: Partial<WallRenterNotifyJob> = {}): WallRenterNotifyJob {
  return {
    status: "queued",
    audience: "all",
    requested_by: "boss-1",
    created_at: new Date().toISOString(),
    finished_at: null,
    sent_user_ids: [],
    sent: 0,
    failed: 0,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  for (const k of Object.keys(tableData)) delete tableData[k];
  vi.clearAllMocks();
});

// ── 1. parseNotifyJob: claim-поля (run_token / run_started_at) ────────────────

describe("parseNotifyJob — run claim fields", () => {
  it("preserves run_token / run_started_at", () => {
    const job = parseNotifyJob({
      notify_job: { ...baseJob({ status: "running", run_token: "tok-123", run_started_at: "2026-10-02T10:00:00Z" }) },
    });
    expect(job).not.toBeNull();
    expect(job?.run_token).toBe("tok-123");
    expect(job?.run_started_at).toBe("2026-10-02T10:00:00Z");
  });

  it("tolerates legacy jobs without claim fields (null, not crash)", () => {
    const job = parseNotifyJob({ notify_job: baseJob() });
    expect(job).not.toBeNull();
    expect(job?.run_token).toBeNull();
    expect(job?.run_started_at).toBeNull();
  });

  it("garbage token shapes degrade to null", () => {
    const job = parseNotifyJob({ notify_job: baseJob({ run_token: 42 as unknown as string }) });
    expect(job?.run_token).toBeNull();
  });
});

// ── 2. isNotifyRunStale: перехват только протухшего claim ────────────────────

describe("isNotifyRunStale — claim freshness", () => {
  it("queued job is claimable (stale)", () => {
    expect(isNotifyRunStale(baseJob(), Date.now())).toBe(true);
  });

  it("running with FRESH run_started_at is NOT claimable", () => {
    const now = Date.now();
    const job = baseJob({ status: "running", run_started_at: new Date(now - 10_000).toISOString() });
    expect(isNotifyRunStale(job, now)).toBe(false);
  });

  it("running OLDER than RENTER_NOTIFY_RUN_STALE_MS is claimable (crashed runner)", () => {
    const now = Date.now();
    const job = baseJob({ status: "running", run_started_at: new Date(now - RENTER_NOTIFY_RUN_STALE_MS - 1).toISOString() });
    expect(isNotifyRunStale(job, now)).toBe(true);
  });

  it("running without run_started_at (pre-claim legacy) is claimable", () => {
    expect(isNotifyRunStale(baseJob({ status: "running" }), Date.now())).toBe(true);
  });

  it("garbage run_started_at is claimable (never deadlocks the fanout)", () => {
    const job = baseJob({ status: "running", run_started_at: "not-a-date" });
    expect(isNotifyRunStale(job, Date.now())).toBe(true);
  });
});

// ── 3. processWallRenterNotifyJob: single-flight busy / absent / guard ───────

describe("processWallRenterNotifyJob — single-flight", () => {
  it("fresh running claim → busy result, NO delivery attempts", async () => {
    tableData.crew_posts = {
      id: "11111111-1111-1111-1111-111111111111",
      crew_id: "crew-1",
      author_id: "author-1",
      body: "пост",
      kind: "post",
      is_hidden: false,
      metadata: {
        notify_job: baseJob({
          status: "running",
          run_token: "tok-live",
          run_started_at: new Date().toISOString(),
          sent: 3,
        }),
      },
    };
    const res = await processWallRenterNotifyJob("11111111-1111-1111-1111-111111111111");
    expect(res.ok).toBe(true);
    expect(res.busy).toBe(true);
    expect(res.status).toBe("running");
    expect(res.sent).toBe(3);
    expect(telegramDeliver).not.toHaveBeenCalled();
  });

  it("no job in metadata → absent (not a 500)", async () => {
    tableData.crew_posts = {
      id: "11111111-1111-1111-1111-111111111111",
      crew_id: "crew-1",
      author_id: "author-1",
      body: "пост",
      kind: "post",
      is_hidden: false,
      metadata: {},
    };
    const res = await processWallRenterNotifyJob("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe("absent");
    expect(res.ok).toBe(false);
    expect(telegramDeliver).not.toHaveBeenCalled();
  });

  it("garbage post id → guarded error before any DB call", async () => {
    const res = await processWallRenterNotifyJob("'; drop table crew_posts;--");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("bad post id");
  });

  it("crew mismatch (kick of another crew's post) → rejected without delivery", async () => {
    tableData.crew_posts = {
      id: "11111111-1111-1111-1111-111111111111",
      crew_id: "crew-B",
      author_id: "author-1",
      body: "пост",
      kind: "post",
      is_hidden: false,
      metadata: { notify_job: baseJob() },
    };
    const res = await processWallRenterNotifyJob("11111111-1111-1111-1111-111111111111", 50_000, "crew-A");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("does not belong");
    expect(telegramDeliver).not.toHaveBeenCalled();
  });
});

// ── 4. queueWallRenterNotifyJob: не рапортует успех в пустоту ────────────────

describe("queueWallRenterNotifyJob — missing post guard", () => {
  it("returns false when the post row is gone (update into the void)", async () => {
    tableData.crew_posts = null;
    const ok = await queueWallRenterNotifyJob("11111111-1111-1111-1111-111111111111", "recent", "boss-1");
    expect(ok).toBe(false);
  });
});

// ── 5. client helpers: nonce + timeout signal ────────────────────────────────

describe("client robustness helpers", () => {
  it("makeClientNonce — unique across calls", () => {
    const a = makeClientNonce();
    const b = makeClientNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it("makeClientNonce — fallback shape is nonce-like when crypto is absent (source contract)", () => {
    // Removing globalThis.crypto is impossible in some runtimes (getter-only),
    // so pin the fallback SHAPE in source instead of simulating the WebView.
    const src = readFileSync(join(process.cwd(), "lib/client-nonce.ts"), "utf8");
    expect(src).toContain("post-${Date.now()}-");
    expect(src).toContain("crypto.randomUUID");
  });

  it("timeoutSignal returns a signal or undefined (never throws on old runtimes)", () => {
    const sig = timeoutSignal(1000);
    expect(sig === undefined || sig instanceof AbortSignal).toBe(true);
  });

  it("isTimeoutError recognizes TimeoutError/AbortError, ignores plain failures", () => {
    const te = new Error("The operation was aborted due to timeout");
    te.name = "TimeoutError";
    expect(isTimeoutError(te)).toBe(true);
    expect(isTimeoutError(new Error("fetch failed"))).toBe(false);
  });
});

// ── 6. source contracts — server action idempotency ──────────────────────────

describe("source contracts — createCommunityPostAction idempotency", () => {
  const src = readFileSync(ACTION, "utf8");

  it("dedupe lookup by metadata->>client_nonce scoped to author+crew+24h", () => {
    expect(src).toContain('.eq("metadata->>client_nonce", clientNonce)');
    expect(src).toContain('.eq("author_id", actor.userId)');
    expect(src).toContain('.eq("crew_id", crew.id)');
    expect(src).toContain('24 * 60 * 60 * 1000');
  });

  it("dedupe hit returns the EXISTING post via buildSingleWallPostView (no re-insert)", () => {
    expect(src).toContain("buildSingleWallPostView(dup)");
  });

  it("insert row carries metadata.client_nonce for new posts", () => {
    expect(src).toContain("metadata: { client_nonce: clientNonce }");
  });

  it("garbage nonce shapes degrade to null (old clients keep posting)", () => {
    expect(src).toContain("CLIENT_NONCE_RE");
    expect(src).toMatch(/CLIENT_NONCE_RE = [^;]+8,64/);
  });

  it("notify_job queue failure is retried once before giving up", () => {
    expect(src).toContain("queue failed once — retrying");
  });

  it("getWallPostAction reuses the same view builder (one source of truth)", () => {
    expect(src).toContain("return { ok: true, post: await buildSingleWallPostView(postRow) };");
  });
});

// ── 7. source contracts — fanout single-flight CAS ───────────────────────────

describe("source contracts — wall-renter-notify single-flight", () => {
  const src = readFileSync(LIB, "utf8");

  it("claim CAS rides on run_token equality / absence", () => {
    expect(src).toContain('.eq("metadata->notify_job->>run_token", fresh.run_token)');
    expect(src).toContain('.is("metadata->notify_job->>run_token", null)');
  });

  it("ledger writes are token-guarded (lost claim stops delivery)", () => {
    expect(src).toContain('expectRunToken: runToken');
    expect(src).toContain("lost fanout claim");
  });

  it("update results are checked via .select(\"id\") row count", () => {
    expect(src).toMatch(/query\.select\("id"\)/);
    expect(src).toContain("updated.length === 0");
  });

  it("processor returns busy when another run owns the job", () => {
    expect(src).toMatch(/busy: true/);
  });
});

// ── 8. source contracts — kick route self-heal ───────────────────────────────

describe("source contracts — wall-renter-notify route self-heal", () => {
  const src = readFileSync(ROUTE, "utf8");

  it("accepts audience and validates it against the allowlist", () => {
    expect(src).toContain("WALL_RENTER_AUDIENCES.includes(body.audience");
  });

  it("repairs an absent job when the post is alive and in-crew", () => {
    expect(src).toContain('result.status === "absent" && audience');
    expect(src).toContain('queueWallRenterNotifyJob(postId, audience, actor.userId)');
  });

  it("crew-scopes the repair lookup (no cross-crew repair)", () => {
    expect(src).toContain('.eq("crew_id", crewId)');
    expect(src).toContain('.eq("is_hidden", false)');
  });
});

// ── 9. source contracts — client composer hardening ──────────────────────────

describe("source contracts — client composer hardening", () => {
  const src = readFileSync(CLIENT, "utf8");

  it("submitPost: synchronous double-submit ref guard", () => {
    expect(src).toContain("if (postingRef.current) return;");
    expect(src).toContain("postingRef.current = true;");
  });

  it("submitPost: finally always releases the composer (no infinite spinner)", () => {
    expect(src).toMatch(/} finally \{\s*\n\s*postingRef\.current = false;\s*\n\s*setPosting\(false\);/);
  });

  it("submitPost: network crash keeps the draft and invites one more tap", () => {
    expect(src).toContain("Сеть подвела — пост не ушёл. Текст и фото на месте");
  });

  it("submitPost: never publishes while photos are still uploading", () => {
    expect(src).toContain("if (pendingUploads) {");
  });

  it("submitPost: sends the idempotency nonce and rotates it after success", () => {
    expect(src).toContain("clientNonce: composeNonceRef.current");
    expect(src).toContain("composeNonceRef.current = makeClientNonce();");
  });

  it("submitPost: dedupe-safe feed merge by post id (no React-key duplicates)", () => {
    expect(src).toContain("prev.some((p) => p.id === res.post.id)");
  });

  it("photo upload fetch is bounded by a 60s timeout", () => {
    expect(src).toContain('"/api/franchize/wall-photo-upload"');
    expect(src).toContain("timeoutSignal(60_000)");
  });

  it("kickRenterFanout: audience passed (self-heal), 65s timeout, busy handled", () => {
    expect(src).toContain("audience }),\n        signal: timeoutSignal(65_000)");
    expect(src).toContain("json?.busy");
  });

  it("composer text is autosaved and restored (draft survives reload)", () => {
    expect(src).toContain("onlybike:wall:draft:");
    expect(src).toContain("sessionStorage.getItem(draftStorageKey)");
    expect(src).toContain("sessionStorage.removeItem(draftStorageKey)");
  });

  it("comment submit cannot wedge sendingCommentFor (finally)", () => {
    expect(src).toMatch(
      /\} finally \{\s*\n\s*setSendingCommentFor\(\(prev\) => \(\{ \.\.\.prev, \[post\.id\]: false \}\)\);\s*\n\s*\}/,
    );
  });

  it("reaction rollback on network crash releases pendingLikes (finally)", () => {
    expect(src).toMatch(
      /\} finally \{\s*\n\s*setPendingLikes\(\(prev\) => \{\s*\n\s*const next = new Set\(prev\);\s*\n\s*next\.delete\(post\.id\);\s*\n\s*return next;\s*\n\s*\}\);\s*\n\s*\}/,
    );
  });

  it("feed load failure surfaces an error instead of an eternal spinner", () => {
    expect(src).toContain("Лента не загрузилась — проверь сеть и обнови страницу.");
  });
});

// ── 10. source contracts — map client parity ─────────────────────────────────

describe("source contracts — map client parity", () => {
  const src = readFileSync(MAP, "utf8");

  it("meetup auto-post passes clientNonce and survives network crashes", () => {
    expect(src).toContain("clientNonce: makeClientNonce()");
    expect(src).toContain("пост о точке не опубликовался");
  });

  it("map fanout kick sends audience and uses the timeout helper", () => {
    expect(src).toContain("signal: timeoutSignal(65_000)");
    expect(src).toContain("audience }),");
  });
});
