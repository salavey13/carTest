// app/api/yandex-pay/qr/route.ts
// ── Яндекс PAY QR — on-the-fly generation (boss 2026-10-19) ─────────────────
// POST { orderId, amount, title?, description?, phone? }
//   → creates a Yandex Pay order via the Merchant API (creds in Vercel env:
//     YANDEX_PAY_API_KEY [+ MERCHANT_ID / API BASE]) and returns the
//     paymentUrl + a ready-to-embed QR data URL.
//   - Not configured + production → { ok:false, reason:"not_configured" }
//     (honest degradation — NO fake payment links in prod).
//   - Not configured + development → labelled demo paymentUrl so the flow is
//     testable before the creds land.
// GET → integration status { configured } (never echoes secrets).
//
// The web checkout does NOT go through this route (it imports the lib
// directly inside the server action) — this endpoint exists for other
// surfaces (rental page re-show, operator tools) and for testing the API
// wiring before creds arrive: curl -X POST .../api/yandex-pay/qr -d '{...}'.

import { NextResponse } from "next/server";
import {
  createYandexPayPayment,
  fetchQrDataUrl,
  isYandexPayConfigured,
  YANDEX_PAY_DEFAULT_API_BASE,
} from "@/app/franchize/lib/yandex-pay";

export const dynamic = "force-dynamic";
// QR needs an external API roundtrip (Yandex Pay + QR renderer).
export const maxDuration = 60;

const ORDER_ID_RE = /^[a-zA-Z0-9_-]{4,80}$/;

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: isYandexPayConfigured(),
    apiBase: process.env.YANDEX_PAY_API_BASE || YANDEX_PAY_DEFAULT_API_BASE,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const amount = Number(body?.amount);
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 128) : "Аренда";
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 256) : undefined;
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;

    if (!orderId || !ORDER_ID_RE.test(orderId)) {
      return NextResponse.json({ ok: false, error: "orderId is required (4..80 chars)" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ ok: false, error: "amount must be RUB 1..1 000 000" }, { status: 400 });
    }

    const pay = await createYandexPayPayment({ orderId, amountRub: amount, title, description, phone });

    if (!pay.ok) {
      const status = pay.reason === "not_configured" ? 200 : 502;
      return NextResponse.json({ ok: false, reason: pay.reason, error: pay.error }, { status });
    }

    const qrDataUrl = await fetchQrDataUrl(pay.paymentUrl);
    return NextResponse.json({
      ok: true,
      configured: !pay.demo,
      demo: pay.demo,
      paymentUrl: pay.paymentUrl,
      paymentId: pay.paymentId,
      qrDataUrl,
      // Text fallback for surfaces where the image failed to render.
      paymentUrlText: pay.paymentUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
