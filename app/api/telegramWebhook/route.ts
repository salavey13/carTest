import { NextResponse } from "next/server"
import { validateTelegramWebAppData } from "@/lib/telegram"
import { logger } from "@/lib/logger"
import { handleWebhookUpdate } from "@/app/actions"

export async function POST(request: Request) {
  try {
    const update = await request.json()
    await handleWebhookUpdate(update)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error("Error handling webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

