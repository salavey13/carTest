import type { WebhookHandler } from "./types";
import { subscriptionHandler } from "./subscription";
import { carRentalHandler } from "./car-rental"; 
import { supportHandler } from "./support";
import { donationHandler } from "./donation";
import { scriptAccessHandler } from "./script-access";
import { inventoryScriptAccessHandler } from "./inventory-script-access";
import { selfDevBoostHandler } from "./selfdev-boost";
import { disableDummyModeHandler } from "./disable-dummy-mode";
import { protocardPurchaseHandler } from "./protocard-purchase-handler";
import { wbReferralServiceHandler } from "./wb-referral-service";
import { qrMerchantHandler } from "./qr-merchant"; // NEW IMPORT

import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

// Register all handlers here
const handlers: WebhookHandler[] = [
  wbReferralServiceHandler,
  qrMerchantHandler, // NEW HANDLER
  subscriptionHandler,
  carRentalHandler, 
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
  selfDevBoostHandler,
  disableDummyModeHandler,
  protocardPurchaseHandler, 
];

export async function handleWebhookProxy(update: any) {
  // Dynamic imports to avoid circular deps in some edge cases, good practice for heavy handlers
  const { supabaseAdmin } = await import("@/hooks/supabase");
  const { sendTelegramMessage } = await import("../actions"); 

  logger.log("Webhook Proxy: Received update", { update_id: update.update_id, type: Object.keys(update).join(',') });

  // 1. Handle Pre-Checkout (Validation before payment)
  if (update.pre_checkout_query) {
    logger.log("Webhook Proxy: Handling pre_checkout_query", update.pre_checkout_query.id);
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
      });
      logger.log("Webhook Proxy: Answered pre_checkout_query successfully");
    } catch (error) {
      logger.error("Webhook Proxy: Failed to answer pre_checkout_query:", error);
    }
    return; 
  }

  // 2. Handle Successful Payment (The Money Shot)
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const userId = update.message.chat.id.toString(); 
    const { invoice_payload, total_amount: totalAmountInStars } = payment; 
    
    logger.info(`Webhook Proxy: 💰 PAYMENT RECEIVED. Payload: ${invoice_payload}, Amount: ${totalAmountInStars} XTR, User: ${userId}`);

    try {
      // A. Verify Invoice in DB
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*") 
        .eq("id", invoice_payload)
        .maybeSingle(); 

      if (invoiceError) throw new Error(`Invoice DB fetch error: ${invoiceError.message}`);

      if (!invoice) {
        logger.error(`Webhook Proxy: 🛑 Invoice NOT FOUND for payload: ${invoice_payload}`);
        await sendTelegramMessage(
          `🚨 ALARM: Оплата ${totalAmountInStars} XTR без инвойса в БД! Payload: ${invoice_payload}, User: ${userId}`,
          [], undefined, ADMIN_CHAT_ID 
        );
        throw new Error(`Invoice not found: ${invoice_payload}`);
      }

      if (invoice.status === 'paid') {
        logger.warn(`Webhook Proxy: ⚠️ Invoice ${invoice_payload} already processed. Idempotency check triggered.`);
        return; 
      }
      
      // B. Fetch User Data
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*") 
        .eq("user_id", userId)
        .single(); 

      if (userError && userError.code !== 'PGRST116') { 
         logger.error(`Webhook Proxy: User DB error for ${userId}:`, userError);
      }

      // C. Find & Execute Handler
      const handler = handlers.find(h => h.canHandle(invoice, invoice_payload));

      if (handler) {
        logger.info(`Webhook Proxy: 🟢 Delegating to handler for type: ${invoice.type}`);
        const baseUrl = getBaseUrl(); 
        
        await handler.handle(
          invoice,
          userId,
          userData || { user_id: userId, metadata: {}, username: `tg_user_${userId}` }, // Fallback user obj
          totalAmountInStars, 
          supabaseAdmin,
          TELEGRAM_BOT_TOKEN, 
          ADMIN_CHAT_ID,
          baseUrl
        );
        
        logger.info(`Webhook Proxy: ✅ Handler finished for ${invoice_payload}`);
      } else {
        logger.warn(`Webhook Proxy: 🔴 No handler matched for type: ${invoice.type}`);
        await sendTelegramMessage( 
          `⚠️ UNHANDLED PAYMENT! Type: ${invoice.type}, Payload: ${invoice_payload}, Amount: ${totalAmountInStars}`,
          [], undefined, ADMIN_CHAT_ID
        );
      }

    } catch (error) {
      logger.error("Webhook Proxy: 🔥 FATAL ERROR processing payment:", error);
      await sendTelegramMessage( 
        `🚨 CRITICAL PAYMENT ERROR! Payload: ${invoice_payload}. Error: ${error instanceof Error ? error.message : String(error)}`,
        [], undefined, ADMIN_CHAT_ID
      );
    }
  } else {
    // Debug log for other updates (messages, etc) - can be noisy
    // logger.debug("Webhook Proxy: Ignoring non-payment update.");
  }
}