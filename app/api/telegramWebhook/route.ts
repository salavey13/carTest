// app/api/telegramWebhook/route.ts
import { NextResponse } from "next/server"
import { handleWebhookUpdate } from "@/app/actions"

export async function POST(request: Request) {
  try {
    const update = await request.json()
    await handleWebhookUpdate(update)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing Telegram webhook:", error)
    return NextResponse.json({ success: false, error: "Failed to process webhook" }, { status: 500 })
  }
}

