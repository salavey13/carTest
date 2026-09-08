import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { NextRequest } from "next/server";

/**
 * Specs for the vip-bike.ru marketing-site form integration: the site's
 * server proxies its lead form into /api/franchize/callback-lead.
 *
 * Two surfaces are covered:
 *  1. Schema + payload wiring for the new optional fields
 *     (nick / formSource / landingPath) — stored in metadata, surfaced in
 *     the Telegram notification, landingPath wins over the (absent) Referer.
 *  2. Trusted ingest mode via x-callback-ingest-secret:
 *     skips the local per-IP limiter (a server proxy is ONE IP shared by all
 *     customers) and uses a per-request ipHash (neutralizes the RPC's
 *     per-IP quota; the global quota still applies). Wrong/absent secret →
 *     legacy behavior, including 429 on the local limiter.
 */

const mocks = vi.hoisted(() => ({
  rpcCalls: [] as Array<[string, Record<string, unknown>]>,
  rateLimit: { allowed: true, remaining: 3, retryAfterSeconds: 60, limit: 4 },
  captureResult: {
    data: [
      {
        result_status: "created",
        intent_id: "created",
        intent_metadata: { notificationStatus: "pending" },
        retry_after_seconds: 0,
      },
    ],
    error: null as { message?: string } | null,
  },
  finalizeResult: { data: true, error: null },
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "crews") throw new Error(`Unexpected table: ${table}`);
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => ({ data: { owner_id: "413553377" }, error: null });
      return builder;
    },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      mocks.rpcCalls.push([name, args || {}]);
      if (name === "capture_vip_bike_callback_intent") return mocks.captureResult;
      if (name === "finalize_vip_bike_callback_notification") return mocks.finalizeResult;
      throw new Error(`Unexpected RPC: ${name}`);
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(() => mocks.rateLimit),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { POST } from "../../app/api/franchize/callback-lead/route";

function siteProxyRequest(extraHeaders: Record<string, string> = {}) {
  return new NextRequest("https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-real-ip": "203.0.113.77",
      ...extraHeaders,
    },
    body: JSON.stringify({
      slug: "vip-bike",
      name: "Олег",
      phone: "+7 903 123-45-67",
      nick: "@oleg_biker",
      formSource: "home-final",
      landingPath: "/?utm_source=yandex&utm_medium=cpc",
      consent: true,
    }),
  });
}

function fetchMock() {
  return vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpcCalls.length = 0;
  mocks.rateLimit = { allowed: true, remaining: 3, retryAfterSeconds: 60, limit: 4 };
  mocks.captureResult = {
    data: [
      {
        result_status: "created",
        intent_id: "created",
        intent_metadata: { notificationStatus: "pending" },
        retry_after_seconds: 0,
      },
    ],
    error: null,
  };
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
  process.env.CALLBACK_INGEST_SECRET = "site-shared-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.CALLBACK_INGEST_SECRET;
});

describe("vip-bike.ru site form → callback-lead", () => {
  test("accepts nick/formSource/landingPath and stores them in metadata", async () => {
    vi.stubGlobal("fetch", fetchMock());
    const response = await POST(
      siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, notificationSent: true });

    const capture = mocks.rpcCalls.find(([name]) => name === "capture_vip_bike_callback_intent");
    expect(capture).toBeTruthy();
    const meta = capture![1].p_metadata as Record<string, unknown>;
    expect(meta).toMatchObject({
      nick: "@oleg_biker",
      formSource: "home-final",
      phone: "+79031234567",
      ingest: "site_proxy",
    });
    // landingPath (trusted proxy) becomes the source route, not the default.
    expect(capture![1].p_source_route).toBe("/?utm_source=yandex&utm_medium=cpc");
  });

  test("trusted ingest header skips the local per-IP limiter", async () => {
    vi.stubGlobal("fetch", fetchMock());
    mocks.rateLimit = { allowed: false, remaining: 0, retryAfterSeconds: 42, limit: 4 };

    const response = await POST(
      siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }),
    );

    // Would have been 429 without the trusted header.
    expect(response.status).toBe(200);
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  test("per-request ipHash differs between two trusted submissions", async () => {
    vi.stubGlobal("fetch", fetchMock());
    await POST(siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }));
    await POST(siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }));

    const hashes = mocks.rpcCalls
      .filter(([name]) => name === "capture_vip_bike_callback_intent")
      .map(([, args]) => (args as any).p_metadata.ipHash as string);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  test("wrong or missing secret keeps the legacy rate-limited behavior", async () => {
    vi.stubGlobal("fetch", fetchMock());
    mocks.rateLimit = { allowed: false, remaining: 0, retryAfterSeconds: 30, limit: 4 };

    const wrong = await POST(
      siteProxyRequest({ "x-callback-ingest-secret": "nope" }),
    );
    expect(wrong.status).toBe(429);

    const missing = await POST(siteProxyRequest());
    expect(missing.status).toBe(429);
  });

  test("trusted flag is off entirely when CALLBACK_INGEST_SECRET is unset", async () => {
    vi.stubGlobal("fetch", fetchMock());
    delete process.env.CALLBACK_INGEST_SECRET;

    const response = await POST(
      siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }),
    );
    expect(response.status).toBe(200);

    const capture = mocks.rpcCalls.find(([name]) => name === "capture_vip_bike_callback_intent");
    const meta = capture![1].p_metadata as Record<string, unknown>;
    // No trusted marker and no limiter bypass for the header-only call.
    expect(meta.ingest).toBeUndefined();
  });

  test("Telegram notification announces the site form with the nick", async () => {
    const fetchStub = fetchMock();
    vi.stubGlobal("fetch", fetchStub);

    await POST(siteProxyRequest({ "x-callback-ingest-secret": "site-shared-secret" }));

    expect(fetchStub).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchStub.mock.calls[0] as unknown as any[])[1].body as string);
    expect(body.text).toContain("Новая заявка с сайта vip-bike.ru");
    expect(body.text).toContain("@oleg_biker");
    expect(body.text).toContain("home-final");
  });

  test("rejects an unsafe landingPath (no whitespace control chars)", async () => {
    vi.stubGlobal("fetch", fetchMock());
    const response = await POST(
      new NextRequest("https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "203.0.113.77",
          "x-callback-ingest-secret": "site-shared-secret",
        },
        body: JSON.stringify({
          slug: "vip-bike",
          name: "Олег",
          phone: "+79031234567",
          landingPath: "/x\ninjected-header",
          consent: true,
        }),
      }),
    );
    expect(response.status).toBe(200);

    const capture = mocks.rpcCalls.find(([name]) => name === "capture_vip_bike_callback_intent");
    // Unsafe path fell back to the default source route.
    expect(capture![1].p_source_route).toBe("/franchize/vip-bike");
  });
});
