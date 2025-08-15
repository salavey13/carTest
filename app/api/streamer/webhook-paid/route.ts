import { NextResponse } from "next/server";
import { markInvoicePaidAndDistribute } from "@/app/streamer/actions";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      logger.warn("[webhook-paid] invalid secret");
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = body?.invoiceId || body?.id;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "missing invoiceId" }, { status: 400 });
    }

    const res = await markInvoicePaidAndDistribute({ invoiceId });
    if (!res.success) {
      return NextResponse.json(res, { status: 500 });
    }

    return NextResponse.json({ success: true, result: res });
  } catch (e: any) {
    logger.error("[/api/streamer/webhook-paid] error", e);
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}