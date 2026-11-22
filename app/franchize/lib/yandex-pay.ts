// app/franchize/lib/yandex-pay.ts
// ── Яндекс PAY — server-side payment QR (boss 2026-10-19) ───────────────────
// Renter picks «Яндекс PAY» at web checkout → the server creates a Yandex Pay
// order via the Merchant API, turns the returned paymentUrl into a QR PNG and
// sends it to the renter along with the generated contract (actions-runtime →
// buildFranchizeOrderDocAndNotify). API creds (YANDEX_PAY_API_KEY) are added
// to the Vercel env LATER — until then every call degrades gracefully:
//   - production  → { ok:false, reason:"not_configured" }, NO fake links;
//   - development → clearly-labelled demo payment URL so the QR → sendPhoto
//     path can be exercised end-to-end without creds.
//
// Merchant API reference (pay.yandex.ru/docs, backend / yandex-pay-api):
//   POST {base}/merchant/v1/orders
//   Authorization: Api-Key <key>   (console.pay.yandex.ru/settings)
//   X-Request-Id: <uuid>           (idempotency — reuse on 5xx/429 retries)
//   X-Request-Timeout: 15
//   body: { cart: { externalId, items[], total: { amount, label } },
//           currencyCode: "RUB", orderId, ... }
//   → { code: 200, data: { paymentUrl }, status: "success" }
// Amounts are STRINGS ("1500.00") per the API contract.

export const YANDEX_PAY_DEFAULT_API_BASE = "https://pay.yandex.ru/api";
export const YANDEX_PAY_SANDBOX_API_BASE = "https://sandbox.pay.yandex.ru/api";

export interface YandexPayConfig {
  apiKey: string;
  merchantId: string | null;
  apiBase: string;
}

/** Env-driven config; empty apiKey = not configured (callers must degrade). */
export function getYandexPayConfig(): YandexPayConfig | null {
  const apiKey = (process.env.YANDEX_PAY_API_KEY || "").trim();
  if (!apiKey) return null;
  const merchantId = (process.env.YANDEX_PAY_MERCHANT_ID || "").trim() || null;
  const apiBase = (process.env.YANDEX_PAY_API_BASE || YANDEX_PAY_DEFAULT_API_BASE).replace(/\/+$/, "");
  return { apiKey, merchantId, apiBase };
}

export function isYandexPayConfigured(): boolean {
  return getYandexPayConfig() !== null;
}

export type YandexPayResult =
  | { ok: true; paymentUrl: string; paymentId: string | null; demo: boolean }
  | { ok: false; reason: "not_configured" | "api_error" | "bad_response"; error?: string };

/**
 * Create a Yandex Pay order for the rent (one per checkout) and return the
 * paymentUrl to encode into the QR. Idempotency: X-Request-Id derived from
 * the orderId so a lambda retry cannot double-create orders.
 */
export async function createYandexPayPayment(input: {
  orderId: string;
  amountRub: number;
  title: string;
  description?: string;
  phone?: string | null;
}): Promise<YandexPayResult> {
  const config = getYandexPayConfig();
  const amount = Number(input.amountRub);

  // ── Not configured: honest degradation (prod) / labelled demo (dev) ──────
  if (!config) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "not_configured" };
    }
    // Dev-only demo link — visibly marked, never money-real.
    const demoUrl = `https://pay.yandex.ru/pay/demo--yandex-pay--${encodeURIComponent(input.orderId)}?amount=${Number.isFinite(amount) ? amount : 0}&demo=1`;
    return { ok: true, paymentUrl: demoUrl, paymentId: null, demo: true };
  }

  if (!input.orderId || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "api_error", error: "orderId/amountRub are required" };
  }

  const amountStr = amount.toFixed(2);
  const itemTitle = (input.title || "Аренда").slice(0, 128);
  const itemDescription = (input.description || itemTitle).slice(0, 256);

  const body = {
    cart: {
      externalId: input.orderId,
      items: [
        {
          title: itemTitle,
          description: itemDescription,
          productId: input.orderId,
          quantity: { count: "1", label: "шт" },
          unitPrice: amountStr,
          discountedUnitPrice: amountStr,
          subtotal: amountStr,
          total: amountStr,
        },
      ],
      total: { amount: amountStr, label: itemTitle },
    },
    currencyCode: "RUB",
    orderId: input.orderId,
    isPrepayment: false,
    ttl: 1800,
    ...(input.phone ? { billingPhone: String(input.phone).replace(/[^\d+]/g, "") } : {}),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${config.apiBase}/merchant/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${config.apiKey}`,
        // Idempotency: same order → same request id (lambda retries safe).
        "X-Request-Id": `ywp-${input.orderId}`,
        "X-Request-Timeout": "15",
        "X-Request-Attempt": "0",
        ...(config.merchantId ? { "X-Merchant-Id": config.merchantId } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const raw: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        reason: "api_error",
        error: `Yandex Pay API HTTP ${res.status}: ${safeErrorText(raw)}`,
      };
    }
    const paymentUrl = extractPaymentUrl(raw);
    if (!paymentUrl) {
      return { ok: false, reason: "bad_response", error: `No paymentUrl in response: ${safeErrorText(raw)}` };
    }
    return { ok: true, paymentUrl, paymentId: extractPaymentId(raw), demo: false };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function safeErrorText(raw: unknown): string {
  try {
    return JSON.stringify(raw).slice(0, 300);
  } catch {
    return String(raw).slice(0, 300);
  }
}

/** Defensive response shape: data.paymentUrl | data.payment_url | data.order.paymentUrl. */
function extractPaymentUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const data = (raw as Record<string, unknown>).data;
  const candidates: unknown[] = [data, data && typeof data === "object" ? (data as Record<string, unknown>).order : null];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const rec = c as Record<string, unknown>;
    const url = rec.paymentUrl ?? rec.payment_url ?? rec.url;
    if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

function extractPaymentId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const data = (raw as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const id = rec.paymentId ?? rec.payment_id ?? rec.orderId ?? rec.order_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

/**
 * Payment URL → QR PNG buffer (api.qrserver.com — the SAME external renderer
 * the /doc claim-QR flow already uses; bounded at 8s). Returns null on any
 * failure — callers send the paymentUrl as text fallback instead of the QR.
 */
export async function fetchQrPngBuffer(text: string): Promise<Buffer | null> {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=${encodeURIComponent(text)}&color=000000&bgcolor=ffffff`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(qrUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/** QR PNG → base64 data URL (for web surfaces: rental page / order success). */
export async function fetchQrDataUrl(text: string): Promise<string | null> {
  const buf = await fetchQrPngBuffer(text);
  return buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
}
