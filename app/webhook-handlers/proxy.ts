"use server";
import axios from "axios";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

// Import all specific handlers
import { subscriptionHandler } from "./subscription";
import { carRentalHandler } from "./car-rental";
import { supportHandler } from "./support";
import { donationHandler } from "./donation";
import { scriptAccessHandler } from "./script-access";
import { inventoryScriptAccessHandler } from "./inventory-script-access";

// List of all webhook handlers
const handlers = [
  subscriptionHandler,
  carRentalHandler,
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
];

/*
Adding New Handlers
To add a new handler (e.g., new-type.ts), you now only modify /app/webhook-handlers/proxy.ts:

Create the New Handler:
tsx



// /app/webhook-handlers/new-type.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const newTypeHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "new_type",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    await sendTelegramMessage(telegramToken, "New type handled!", [], undefined, userId);
  },
};
Update proxy.ts:
tsx



// /app/webhook-handlers/proxy.ts
// ... (other imports)
import { newTypeHandler } from "./new-type";

const handlers = [
  subscriptionHandler,
  carRentalHandler,
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
  newTypeHandler, // Add here
];
*/



export async function handleWebhookProxy(update: any) {
  try {
    // Handle pre-checkout query
    if (update.pre_checkout_query) {
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
    }

    // Handle successful payment
    if (update.message?.successful_payment) {
      const { invoice_payload, total_amount } = update.message.successful_payment;

      // Fetch invoice
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_payload)
        .single();

      if (invoiceError || !invoice) throw new Error(`Invoice error: ${invoiceError?.message}`);

      // Update invoice status
      await supabaseAdmin.from("invoices").update({ status: "paid" }).eq("id", invoice_payload);

      // Fetch user data
      const userId = update.message.chat.id;
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (userError) throw new Error(`User fetch error: ${userError.message}`);

      // Prepare common parameters
      const baseUrl = getBaseUrl();
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN!;
      const adminChatId = process.env.ADMIN_CHAT_ID!;

      // Find and execute the appropriate handler
      const handler = handlers.find((h) => h.canHandle(invoice, invoice_payload));
      if (handler) {
        await handler.handle(
          invoice,
          userId,
          userData,
          total_amount,
          supabaseAdmin,
          telegramToken,
          adminChatId,
          baseUrl
        );
      } else {
        logger.warn(`No handler found for invoice type: ${invoice.type} or payload: ${invoice_payload}`);
      }
    }
  } catch (error) {
    logger.error("Error handling webhook update in proxy:", error);
  }
}
