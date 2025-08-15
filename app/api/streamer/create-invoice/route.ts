import { NextResponse } from "next/server";
import { createStreamerInvoice } from "@/app/streamer/actions";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // payerUserId: prefer header (trusted), fallback to body
    const payerUserId = req.headers.get("x-user-id") || body?.payerUserId;
    const streamerId = body?.streamerId;
    const amount = Number(body?.amount ?? 0);
    const metadata = body?.metadata ?? {};

    if (!payerUserId) {
      return NextResponse.json({ success: false, error: "missing payer user id" }, { status: 401 });
    }
    if (!streamerId) {
      return NextResponse.json({ success: false, error: "missing streamer id" }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "invalid amount" }, { status: 400 });
    }

    const res = await createStreamerInvoice({ payerUserId, streamerId, amount, metadata });
    if (!res.success) {
      return NextResponse.json(res, { status: 500 });
    }

    // respond with created invoice
    return NextResponse.json({ success: true, invoice: res.invoice });
  } catch (e: any) {
    logger.error("[/api/streamer/create-invoice] error", e);
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}