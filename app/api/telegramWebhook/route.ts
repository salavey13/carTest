// /app/api/telegramWebhook/route.ts
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { handleWebhookUpdate } from "@/app/actions"

export async function POST(request: Request) {
  try {
    const update = await request.json()

    // Add subscription update logic in successful payment handler
    if (update?.pre_checkout_query) {
      // ... existing pre-checkout logic ...
    } else if (update?.message?.successful_payment) {
      try {
        // Update invoice status
        // await updateInvoiceStatus(message.successful_payment.invoice_payload, 'paid')
        // If this was a subscription purchase, update user's subscription
        // const invoice = await getInvoiceById(message.successful_payment.invoice_payload)
        // if (invoice?.metadata?.type === 'subscription') {
        //   await updateUserSubscription(message.from.id.toString(), invoice.metadata.subscription_id)
        // }
        // ... rest of the successful payment logic ...
      } catch (error) {
        console.error("Error processing successful payment:", error)
      }
    }

    await handleWebhookUpdate(update)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error("Error handling webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

