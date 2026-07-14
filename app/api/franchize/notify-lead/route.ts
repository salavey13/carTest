// app/api/franchize/notify-lead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../_auth";

/**
 * Send a Telegram notification to a lead.
 *
 * POST body: { telegramChatId: string, message: string }
 *
 * Proxies through forward-telegram API (Telegram is blocked on VPS).
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check: only crew members can send notifications
    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    const body = await request.json();
    const { telegramChatId, message } = body;

    if (!telegramChatId || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing telegramChatId or message" },
        { status: 400 }
      );
    }

    const forwardApiUrl =
      process.env.FORWARD_TELEGRAM_API ||
      "https://v0-car-test.vercel.app/api/forward-telegram";

    const resp = await fetch(forwardApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        method: "sendMessage",
        payload: {
          text: `📩 Уведомление от VIP BIKE:\n\n${message.trim()}`,
          parse_mode: "Markdown",
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error("[notify-lead] forward-telegram error:", errText);
      return NextResponse.json(
        { success: false, error: `Telegram API error: ${errText}` },
        { status: 502 }
      );
    }

    const result = await resp.json();
    logger.info(`[notify-lead] Message sent to ${telegramChatId}`);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error("[notify-lead] Exception:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
