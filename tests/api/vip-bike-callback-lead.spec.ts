import { NextRequest } from "next/server";

type CaptureRow = {
  result_status: string;
  intent_id: string;
  intent_metadata: Record<string, unknown> | null;
  retry_after_seconds: number;
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  captureResult: {
    data: [
      {
        result_status: "created",
        intent_id: "created",
        intent_metadata: { notificationStatus: "pending" },
        retry_after_seconds: 0,
      },
    ],
    error: null,
  } as { data: CaptureRow[] | null; error: { message?: string } | null },
  finalizeResult: { data: true, error: null } as {
    data: boolean | null;
    error: { message?: string } | null;
  },
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: () => ({
    allowed: true,
    remaining: 3,
    retryAfterSeconds: 60,
    limit: 4,
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { POST as genericPOST } from "../../app/api/franchize/callback-lead/route";
import { POST } from "../../app/api/franchize/vip-bike/callback-lead/route";

function configureSupabase() {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "capture_vip_bike_callback_intent") {
      return mocks.captureResult;
    }
    if (name === "finalize_vip_bike_callback_notification") {
      return mocks.finalizeResult;
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });

  mocks.from.mockImplementation((table: string) => {
    if (table !== "crews") throw new Error(`Unexpected table: ${table}`);
    const crewBuilder = {
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        data: { owner_id: "123456789" },
        error: null,
      })),
    };
    crewBuilder.eq.mockReturnValue(crewBuilder);
    return { select: vi.fn(() => crewBuilder) };
  });
}

function request(ip: string) {
  return new NextRequest(
    "https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": ip,
        Referer:
          "https://rental.vip-bike.ru/franchize/vip-bike?propulsion=petrol&utm_source=yandex&yclid=123",
      },
      body: JSON.stringify({
        slug: "vip-bike",
        name: "Иван",
        phone: "+7 999 123-45-67",
        consent: true,
      }),
    },
  );
}

describe("VIP BIKE callback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.finalizeResult = { data: true, error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    configureSupabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_FORWARD_SECRET;
    delete process.env.TELEGRAM_FORWARD_URL;
    delete process.env.CRON_SECRET;
    delete process.env.CODEX_BRIDGE_CALLBACK_SECRET;
  });

  test("confirms success only after Telegram accepts the notification", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("203.0.113.10"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, notificationSent: true });
    const captureCall = mocks.rpc.mock.calls.find(
      ([name]) => name === "capture_vip_bike_callback_intent",
    );
    expect(captureCall?.[1]).toMatchObject({
      p_phone: "+79991234567",
      p_source_route: expect.stringContaining("propulsion=petrol"),
    });
    expect(captureCall?.[1]?.p_intent_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const finalizeCall = mocks.rpc.mock.calls.find(
      ([name]) => name === "finalize_vip_bike_callback_notification",
    );
    expect(finalizeCall?.[1]).toMatchObject({
      p_notification_status: "sent",
      p_notification_attempt_id: captureCall?.[1]?.p_notification_attempt_id,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("fails closed when the Telegram token is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("203.0.113.20"));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({ success: false, saved: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps capturing leads atomically while the new RPC migration is pending", async () => {
    mocks.captureResult = {
      data: null,
      error: {
        message: "Could not find capture_vip_bike_callback_intent",
      },
    };
    let tempInsertCount = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "crews") {
        const crewBuilder = {
          eq: vi.fn(),
          maybeSingle: vi.fn(async () => ({
            data: { owner_id: "123456789" },
            error: null,
          })),
        };
        crewBuilder.eq.mockReturnValue(crewBuilder);
        return { select: vi.fn(() => crewBuilder) };
      }
      if (table === "temp_franchize_carts") {
        const deleteBuilder = {
          eq: vi.fn(),
          like: vi.fn(),
          lt: vi.fn(async () => ({ error: null })),
        };
        deleteBuilder.eq.mockReturnValue(deleteBuilder);
        deleteBuilder.like.mockReturnValue(deleteBuilder);
        return {
          delete: vi.fn(() => deleteBuilder),
          insert: vi.fn(async () => {
            tempInsertCount += 1;
            return { error: null };
          }),
        };
      }
      if (table === "franchize_intents") {
        const existingBuilder = {
          eq: vi.fn(),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        };
        existingBuilder.eq.mockReturnValue(existingBuilder);
        const insertBuilder = {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "created" }, error: null })),
          })),
        };
        const finalBuilder = {
          eq: vi.fn(),
          filter: vi.fn(),
          select: vi.fn(),
          maybeSingle: vi.fn(async () => ({ data: { id: "created" }, error: null })),
        };
        finalBuilder.eq.mockReturnValue(finalBuilder);
        finalBuilder.filter.mockReturnValue(finalBuilder);
        finalBuilder.select.mockReturnValue(finalBuilder);
        return {
          select: vi.fn(() => existingBuilder),
          insert: vi.fn(() => insertBuilder),
          update: vi.fn(() => finalBuilder),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("203.0.113.21"));

    expect(response.status).toBe(200);
    expect(tempInsertCount).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("does not show a false success when Telegram rejects the notification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("failure", { status: 500 })),
    );

    const response = await POST(request("203.0.113.11"));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      success: false,
      saved: true,
      notificationSent: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finalize_vip_bike_callback_notification",
      expect.objectContaining({ p_notification_status: "failed" }),
    );
  });

  test("blocks a concurrent duplicate while the database claim is pending", async () => {
    mocks.captureResult = {
      data: [
        {
          result_status: "pending",
          intent_id: "duplicate",
          intent_metadata: { notificationStatus: "pending" },
          retry_after_seconds: 17,
        },
      ],
      error: null,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("203.0.113.12"));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(payload).toMatchObject({ success: false, saved: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns the atomic database quota decision", async () => {
    mocks.captureResult = {
      data: [
        {
          result_status: "rate_limited",
          intent_id: "limited",
          intent_metadata: null,
          retry_after_seconds: 600,
        },
      ],
      error: null,
    };

    const response = await POST(request("203.0.113.13"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
  });

  test.each([
    ["another-crew", "another-bike", "Аренда другого экипажа"],
    ["vip-bike", "sale-bike", "Продажа VIP BIKE"],
    ["vip-bike", "service-item", "Сервис VIP BIKE"],
  ])(
    "keeps the shared endpoint available for %s / %s",
    async (slug, bikeId, bikeTitle) => {
      mocks.from.mockImplementation((table: string) => {
        if (table === "users") {
          return { upsert: vi.fn(async () => ({ error: null })) };
        }
        if (table === "franchize_intents") {
          return { upsert: vi.fn(async () => ({ error: null })) };
        }
        if (table === "crews") {
          const crewBuilder = {
            eq: vi.fn(),
            maybeSingle: vi.fn(async () => ({
              data: { owner_id: "123456789" },
              error: null,
            })),
          };
          crewBuilder.eq.mockReturnValue(crewBuilder);
          return { select: vi.fn(() => crewBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const response = await genericPOST(
        new NextRequest("https://rental.vip-bike.ru/api/franchize/callback-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            bikeId,
            bikeTitle,
            name: "Иван",
            phone: "+7 999 123-45-67",
          }),
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
});
