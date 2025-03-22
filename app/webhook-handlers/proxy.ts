"use server";
import axios from "axios";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

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

// Utility to get the base URL dynamically (copied from actions.ts)
function getBaseUrl() {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://v0-car-test.vercel.app";
}

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