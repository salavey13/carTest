import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { NextRequest } from "next/server";

/**
 * Specs: отправка ответа в реальный чат Авито из CRM
 * (app/api/franchize/lead-avito-reply + lib/avito-messenger).
 *
 * Контракт:
 *  - роут ищет лид по metadata->>avitoChatId (алиас-ключ лида нестабилен);
 *  - синтетические чаты fwd-* (bot_forward) отвергаются 422 — реального
 *    чата нет, отправлять некуда;
 *  - без env (client_id/secret/user_id) — 503 с понятной подсказкой;
 *  - успех: 200 + message, metadata.messages дополнен seller-репликой
 *    с дедупом (webhook-эхо не задваивает пузырь), событие avito_reply
 *    записано в журнал;
 *  - ошибки Авито (402/403/…) маппятся в человекочитаемые ошибки.
 */

const mocks = vi.hoisted(() => ({
  updateCalls: [] as any[],
  existingIntent: null as { id: string; slug: string; contact_channel: string; metadata: Record<string, unknown> } | null,
  insertCalls: [] as any[],
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "lead_events") {
        const builder: any = {};
        builder.insert = (payload: any) => {
          mocks.insertCalls.push(payload);
          return { error: null };
        };
        return builder;
      }
      if (table !== "franchize_intents") {
        throw new Error(`Unexpected table: ${table}`);
      }
      const builder: any = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.filter = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => ({ data: mocks.existingIntent, error: null });
      builder.update = (payload: any) => {
        mocks.updateCalls.push(payload);
        return builder;
      };
      builder.eq = () => builder;
      return builder;
    },
  },
}));

// The route imports "../_auth" (relative specifier). Vitest resolves BOTH
// the alias and the relative path to the same file on disk, so mocking the
// canonical alias intercepts the route's import.
vi.mock("@/app/api/franchize/_auth", () => ({
  verifyCrewAccess: async () => ({ ok: true, userId: "413553377" }),
}));

import { POST } from "@/app/api/franchize/lead-avito-reply/route";
import {
  resetAvitoTokenCacheForTests,
  getAvitoAccessToken,
} from "@/app/franchize/lib/avito-messenger";

const ENV_KEYS = ["AVITO_CLIENT_ID", "AVITO_CLIENT_SECRET", "AVITO_USER_ID"] as const;

function setAvitoEnv() {
  process.env.AVITO_CLIENT_ID = "cid";
  process.env.AVITO_CLIENT_SECRET = "csecret";
  process.env.AVITO_USER_ID = "167526519";
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/franchize/lead-avito-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  crewId: "crew-uuid",
  slug: "vip-bike",
  chatId: "a1b2c3d4",
  leadId: "avito:a1b2c3d4",
  text: "Здравствуйте! Да, свободен, когда удобно подъехать?",
};

beforeEach(() => {
  mocks.updateCalls.length = 0;
  mocks.insertCalls.length = 0;
  mocks.existingIntent = {
    id: "intent-1",
    slug: "vip-bike",
    contact_channel: "avito",
    metadata: {
      messages: [{ at: "2026-09-07T10:00:00Z", from: "buyer", text: "Свободен?" }],
    },
  };
  setAvitoEnv();
  resetAvitoTokenCacheForTests();
  global.fetch = vi.fn();
  // Default: token + send succeed.
  (global.fetch as any).mockImplementation(async (url: string, init?: any) => {
    if (String(url).endsWith("/token")) {
      return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 86400 }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/franchize/lead-avito-reply", () => {
  test("валидация: пустой/короткий текст → 400", async () => {
    const res = await POST(postRequest({ ...BASE_BODY, text: "   " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  test("синтетический чат fwd-* → 422 с подсказкой", async () => {
    const res = await POST(postRequest({ ...BASE_BODY, chatId: "fwd-abc123" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("форварда");
  });

  test("без env → 503 с подсказкой про AVITO_CLIENT_ID", async () => {
    delete process.env.AVITO_CLIENT_ID;
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("AVITO_CLIENT_ID");
  });

  test("лид не найден по chatId → 404", async () => {
    mocks.existingIntent = null;
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(404);
  });

  test("happy path: отправлено, лог дополнен seller-репликой, событие записано", async () => {
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message.from).toBe("seller");

    // metadata.messages дополнен, buyer-реплика сохранена
    expect(mocks.updateCalls.length).toBe(1);
    const messages = mocks.updateCalls[0].metadata.messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].from).toBe("buyer");
    expect(messages[1].from).toBe("seller");
    expect(messages[1].text).toBe(BASE_BODY.text);
    expect(mocks.updateCalls[0].metadata.avitoLastReplyAt).toBeTruthy();

    // Журнал: avito_reply с оператором-актором
    expect(mocks.insertCalls).toHaveLength(1);
    expect(mocks.insertCalls[0].type).toBe("avito_reply");
    expect(mocks.insertCalls[0].actor).toBe("413553377");
    expect(mocks.insertCalls[0].points).toBe(2);

    // В Авито ушёл правильный payload
    const sendCall = (global.fetch as any).mock.calls.find(
      ([url]: any) => String(url).includes("/messenger/v3/accounts/167526519/chats/a1b2c3d4/messages/"),
    );
    expect(sendCall).toBeTruthy();
    const payload = JSON.parse(sendCall[1].body);
    expect(payload.text).toBe(BASE_BODY.text);
    expect(payload.type).toBe("text");
  });

  test("дедуп: повторная seller-реплика с тем же текстом не задваивается", async () => {
    mocks.existingIntent = {
      ...mocks.existingIntent!,
      metadata: {
        messages: [
          { at: "2026-09-07T10:00:00Z", from: "buyer", text: "Свободен?" },
          // webhook-эхо уже дописало наш ответ (тот же текст)
          { at: "2026-09-07T10:00:01Z", from: "seller", text: BASE_BODY.text },
        ],
      },
    };
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(200);
    const messages = mocks.updateCalls[0].metadata.messages;
    const sellerReplies = messages.filter((m: any) => m.from === "seller");
    expect(sellerReplies).toHaveLength(1);
    expect(sellerReplies[0].text).toBe(BASE_BODY.text);
  });

  test("last_seen_at и lastMessage не трогаются (SLA «ждут ответа» не обнуляется)", async () => {
    await POST(postRequest(BASE_BODY));
    const patch = mocks.updateCalls[0];
    expect(patch.last_seen_at).toBeUndefined();
    expect(patch.metadata.lastMessage).toBeUndefined();
  });

  test("402 от Авито → человекочитаемая ошибка про подписку", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).endsWith("/token")) {
        return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 86400 }), { status: 200 });
      }
      return new Response("Payment Required", { status: 402 });
    });
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("API Мессенджера");
  });

  test("403 от Авито → ошибка про скоуп messenger:write", async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).endsWith("/token")) {
        return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 86400 }), { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    });
    const res = await POST(postRequest(BASE_BODY));
    const json = await res.json();
    expect(json.error).toContain("messenger:write");
  });

  test("401 при отправке → авто-перевыпуск токена и retry", async () => {
    const sendCalls: any[] = [];
    let tokenCallCount = 0;
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).endsWith("/token")) {
        tokenCallCount += 1;
        return new Response(JSON.stringify({ access_token: `tok-${tokenCallCount}`, expires_in: 86400 }), { status: 200 });
      }
      sendCalls.push(url);
      if (sendCalls.length === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response(JSON.stringify({ id: "msg-2" }), { status: 200 });
    });
    const res = await POST(postRequest(BASE_BODY));
    expect(res.status).toBe(200);
    expect(tokenCallCount).toBe(2); // токен перевыпущен
    expect(sendCalls).toHaveLength(2); // отправка повторена
  });
});

describe("avito-messenger: token cache", () => {
  test("токен кешируется: две отправки — один token-запрос", async () => {
    let tokenCalls = 0;
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (String(url).endsWith("/token")) {
        tokenCalls += 1;
        return new Response(JSON.stringify({ access_token: "tok-cached", expires_in: 86400 }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "m" }), { status: 200 });
    });
    resetAvitoTokenCacheForTests();
    const t1 = await getAvitoAccessToken();
    const t2 = await getAvitoAccessToken();
    expect(t1).toBe("tok-cached");
    expect(t2).toBe("tok-cached");
    expect(tokenCalls).toBe(1);
  });
});
