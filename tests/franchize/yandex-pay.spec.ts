// tests/franchize/yandex-pay.spec.ts
// ── Яндекс PAY: server lib + checkout wiring (boss 2026-10-19) ──────────────
// Units: payment-order request shape/auth/idempotency, honest degradation
// without creds, QR fetch fallback. Wiring: source-assertion pins (repo
// convention) for the order-page option, the deposit rail, the zod enums and
// the checkout QR block position (AFTER the docx sends, BEFORE the lead tail).
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createYandexPayPayment,
  fetchQrPngBuffer,
  isYandexPayConfigured,
  YANDEX_PAY_DEFAULT_API_BASE,
  YANDEX_PAY_SANDBOX_API_BASE,
} from "../../app/franchize/lib/yandex-pay";

const ENV_KEYS = ["YANDEX_PAY_API_KEY", "YANDEX_PAY_MERCHANT_ID", "YANDEX_PAY_API_BASE"] as const;

function withEnv(env: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(env)) {
      // process.env coerces undefined → the string "undefined"; unset instead.
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("config", () => {
  it("is not configured without YANDEX_PAY_API_KEY", () => {
    withEnv({ YANDEX_PAY_API_KEY: undefined }, () => {
      expect(isYandexPayConfigured()).toBe(false);
    });
  });

  it("defaults to the production API base", () => {
    expect(YANDEX_PAY_DEFAULT_API_BASE).toBe("https://pay.yandex.ru/api");
    expect(YANDEX_PAY_SANDBOX_API_BASE).toBe("https://sandbox.pay.yandex.ru/api");
  });
});

describe("createYandexPayPayment — without creds", () => {
  it("production degrades honestly: no fake payment links", async () => {
    await withEnv({ YANDEX_PAY_API_KEY: undefined }, async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const res = await createYandexPayPayment({ orderId: "order-abc", amountRub: 1500, title: "Аренда" });
        expect(res).toEqual({ ok: false, reason: "not_configured" });
      } finally {
        process.env.NODE_ENV = prev;
      }
    });
  });

  it("development returns a clearly-labelled demo link (flow testable before creds)", async () => {
    await withEnv({ YANDEX_PAY_API_KEY: undefined }, async () => {
      const res = await createYandexPayPayment({ orderId: "order-abc", amountRub: 1500, title: "Аренда" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.demo).toBe(true);
        expect(res.paymentUrl).toContain("demo--yandex-pay");
      }
    });
  });
});

describe("createYandexPayPayment — with creds", () => {
  it("POSTs the Merchant API order with Api-Key auth + idempotency and returns paymentUrl", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({ code: 200, status: "success", data: { paymentUrl: "https://pay.yandex.ru/pay/x1" } }),
          { status: 200 },
        );
      }),
    );
    await withEnv({ YANDEX_PAY_API_KEY: "secret-key", YANDEX_PAY_MERCHANT_ID: "mer-1" }, async () => {
      const res = await createYandexPayPayment({
        orderId: "order-mtbnsf97",
        amountRub: 3000,
        title: "79BIKE Falcon GT",
        phone: "+7 900 123-45-67",
      });
      expect(res).toMatchObject({ ok: true, paymentUrl: "https://pay.yandex.ru/pay/x1", demo: false });

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://pay.yandex.ru/api/merchant/v1/orders");
      const headers = new Headers(calls[0].init.headers as HeadersInit);
      expect(headers.get("Authorization")).toBe("Api-Key secret-key");
      expect(headers.get("X-Request-Id")).toBe("ywp-order-mtbnsf97");
      expect(headers.get("X-Merchant-Id")).toBe("mer-1");

      const body = JSON.parse(String(calls[0].init.body));
      expect(body.currencyCode).toBe("RUB");
      expect(body.orderId).toBe("order-mtbnsf97");
      // Amounts are STRINGS per the API contract.
      expect(body.cart.total).toEqual({ amount: "3000.00", label: "79BIKE Falcon GT" });
      expect(body.cart.items[0].total).toBe("3000.00");
      expect(body.cart.items[0].quantity).toEqual({ count: "1", label: "шт" });
      expect(body.billingPhone).toBe("+79001234567");
    });
  });

  it("maps API errors to a non-throwing api_error result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "bad key" }), { status: 401 })));
    await withEnv({ YANDEX_PAY_API_KEY: "wrong" }, async () => {
      const res = await createYandexPayPayment({ orderId: "order-x", amountRub: 100, title: "t" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("api_error");
        expect(res.error).toContain("401");
      }
    });
  });

  it("response without paymentUrl → bad_response (defensive shape)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 200, data: {} }), { status: 200 })));
    await withEnv({ YANDEX_PAY_API_KEY: "k" }, async () => {
      const res = await createYandexPayPayment({ orderId: "order-x", amountRub: 100, title: "t" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("bad_response");
    });
  });

  it("rejects non-positive amounts before hitting the API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await withEnv({ YANDEX_PAY_API_KEY: "k" }, async () => {
      const res = await createYandexPayPayment({ orderId: "order-x", amountRub: 0, title: "t" });
      expect(res).toMatchObject({ ok: false, reason: "api_error" });
    });
  });
});

describe("fetchQrPngBuffer", () => {
  it("returns a Buffer when the renderer answers with a PNG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer as ArrayBuffer, { status: 200 })),
    );
    const buf = await fetchQrPngBuffer("https://pay.yandex.ru/pay/x1");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf?.length).toBeGreaterThan(0);
  });

  it("degrades to null on renderer failure (caller falls back to the text link)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 503 })));
    expect(await fetchQrPngBuffer("https://pay.yandex.ru/pay/x1")).toBeNull();
  });
});

// ── Wiring pins (source assertions, repo convention) ─────────────────────────
describe("yandex-pay wiring", () => {
  const fs = require("node:fs");
  const read = (p: string) => fs.readFileSync(`${process.cwd()}/${p}`, "utf8");

  it("order page offers Яндекс PAY alongside карта/наличка/сбп", () => {
    const src = read("app/franchize/components/OrderPageClient.tsx");
    expect(src).toContain('{ id: "yandex_pay", label: "Яндекс PAY", description: "Оплата по QR-коду Яндекс Пэй" }');
    expect(src).toContain('payment: z.enum(["card", "cash", "sbp", "yandex_pay"])');
    // Deposit rail choices include the new rail.
    expect(src).toContain('{ id: "yandex_pay" as const, label: "Яндекс PAY" }');
  });

  it("checkout zod accepts yandex_pay (invoice + recovery schemas)", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src.match(/payment: z\.enum\(\["telegram_xtr", "card", "cash", "sbp", "yandex_pay"\]\)/g)?.length).toBe(2);
    expect(src).toContain('depositMethod: z.enum(["cash", "card", "sbp", "yandex_pay"]).optional()');
  });

  it("QR block sits AFTER the docx sends and is non-fatal + metadata-persisted", () => {
    const src = read("app/franchize/actions-runtime.ts");
    const afterSends = src.indexOf("Partial DOCX delivery failure");
    const qrBlock = src.indexOf("Яндекс PAY: QR alongside the contract");
    const leadTail = src.indexOf("── Lead identity (boss-R1 fix 1");
    expect(afterSends).toBeGreaterThan(-1);
    expect(qrBlock).toBeGreaterThan(afterSends);
    expect(leadTail).toBeGreaterThan(qrBlock);
    expect(src).toContain('payload.payment === "yandex_pay"');
    expect(src).toContain("yandex_pay: yandexPayMeta");
  });

  it("deposit rail maps yandex_pay end-to-end (split + labels + column)", () => {
    const rail = read("app/franchize/lib/deposit-rail.ts");
    expect(rail).toContain('"cash" | "card" | "sbp" | "yandex_pay"');
    expect(rail).toContain('"yandex_pay"');
  });

  it("QR API route exists with bounded payload validation", () => {
    const route = read("app/api/yandex-pay/qr/route.ts");
    expect(route).toContain("createYandexPayPayment");
    expect(route).toContain("1_000_000");
    expect(route).toContain("not_configured");
  });
});

// ── Review round (boss 2026-10-20: «codereview yandex pay, polish it») ──────
describe("yandex-pay review polish", () => {
  const fs = require("node:fs");
  const read = (p: string) => fs.readFileSync(`${process.cwd()}/${p}`, "utf8");

  it("metadata lookups key on order_id (snake) — camelCase orderId matched ZERO prod rows", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).not.toContain('metadata->>orderId');
    expect(src.match(/metadata->>order_id/g)?.length).toBe(2); // contract attach + ywp persist
  });

  it("QR sendPhoto only targets REAL telegram users (numeric id), QR fetch skipped otherwise", () => {
    const src = read("app/franchize/actions-runtime.ts");
    const block = src.slice(src.indexOf('payload.payment === "yandex_pay"'), src.indexOf("── Lead identity (boss-R1 fix 1"));
    expect(block).toContain('/^\\d+$/.test(String(payload.telegramUserId))');
    // the external QR fetch lives INSIDE the numeric-guard branch
    expect(block.indexOf("fetchQrPngBuffer(pay.paymentUrl)")).toBeGreaterThan(
      block.indexOf("/^\\d+$/.test(String(payload.telegramUserId))"),
    );
  });

  it("rental page re-shows the stored payment QR (metadata.yandex_pay → RentalYandexPayCard, operator-only)", () => {
    const page = read("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).toContain("rentalMeta?.yandex_pay?.payment_url");
    expect(page).toContain("<RentalYandexPayCard");
    expect(page).not.toContain("fetchQrDataUrl"); // no Yandex/QR calls on the server page
    const card = read("app/franchize/components/RentalYandexPayCard.tsx");
    expect(card).toContain("api.qrserver.com"); // same public renderer as the claim-QR card
    expect(card).toContain("30 * 60 * 1000"); // ttl honesty (Merchant API ttl=1800s)
  });
});
