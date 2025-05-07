import { WebhookHandler } from "./types";
import { subscriptionHandler } from "./subscription";
import { carRentalHandler } from "./car-rental"; // Restored car rental handler
import { supportHandler } from "./support";
import { donationHandler } from "./donation";
import { scriptAccessHandler } from "./script-access";
import { inventoryScriptAccessHandler } from "./inventory-script-access";
import { selfDevBoostHandler } from "./selfdev-boost";
import { disableDummyModeHandler } from "./disable-dummy-mode";
// Import the specific supabaseAdmin instance from your hook
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage } from "../actions"; // Import from main actions
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

// Ensure all required handlers are in this array
const handlers: WebhookHandler[] = [
  subscriptionHandler,
  carRentalHandler, // Restored
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
  selfDevBoostHandler,
  disableDummyModeHandler,
];

export async function handleWebhookProxy(update: any) {
  logger.log("Webhook Proxy: Received update", update);

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

  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const userId = update.message.chat.id.toString(); 
    const { invoice_payload, total_amount } = payment;
    logger.log(`Webhook Proxy: Handling successful_payment. Payload: ${invoice_payload}, Amount: ${total_amount}, UserID: ${userId}`);

    try {
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_payload)
        .maybeSingle(); 

      if (invoiceError) {
        logger.error(`Webhook Proxy: Error fetching invoice ${invoice_payload}:`, invoiceError);
        throw new Error(`Invoice fetch error: ${invoiceError.message}`);
      }

      if (!invoice) {
        logger.error(`Webhook Proxy: Invoice not found in DB for payload: ${invoice_payload}. Payment amount: ${total_amount}, User: ${userId}`);
        // Using correct sendTelegramMessage call from new version
        await sendTelegramMessage(
          `🚨 ВНИМАНИЕ: Получен платеж (${total_amount / 100} XTR) с неизвестным payload: ${invoice_payload} от пользователя ${userId}. Инвойс не найден в базе!`,
          [],
          undefined,
          ADMIN_CHAT_ID 
        );
        throw new Error(`Invoice not found for payload: ${invoice_payload}`);
      }

      if (invoice.status === 'paid') {
        logger.warn(`Webhook Proxy: Invoice ${invoice_payload} already marked as paid. Skipping processing.`);
        return; 
      }

      const { error: updateInvoiceError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice_payload);

      if (updateInvoiceError) {
        logger.error(`Webhook Proxy: Error marking invoice ${invoice_payload} as paid:`, updateInvoiceError);
        throw new Error(`Failed to update invoice status: ${updateInvoiceError.message}`);
      }
      logger.log(`Webhook Proxy: Invoice ${invoice_payload} marked as paid.`);

      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*") 
        .eq("user_id", userId)
        .single(); // Using single as per new version, old was also single.

      if (userError && userError.code !== 'PGRST116') { 
         logger.error(`Webhook Proxy: Error fetching user ${userId} for invoice ${invoice_payload}:`, userError);
      }
      if (!userData) {
          logger.warn(`Webhook Proxy: User ${userId} not found in DB for invoice ${invoice_payload}. Proceeding with basic info.`);
      } else {
          logger.log(`Webhook Proxy: Fetched user data for ${userId}:`, userData.username || 'No username');
      }

      const handler = handlers.find(h => {
         if (invoice.type) { 
             return h.canHandle(invoice, invoice_payload); 
         } else { 
             return h.canHandle(invoice, invoice_payload); 
         }
      });


      if (handler) {
        logger.log(`Webhook Proxy: Found handler for invoice type "${invoice.type || 'type not in DB / checking payload'}". Executing...`);
        const baseUrl = getBaseUrl(); 
        await handler.handle(
          invoice,
          userId,
          userData || { user_id: userId, metadata: {}, id: parseInt(userId,10) }, 
          total_amount / 100, 
          supabaseAdmin,
          TELEGRAM_BOT_TOKEN, 
          ADMIN_CHAT_ID,
          baseUrl
        );
        logger.log(`Webhook Proxy: Handler for invoice ${invoice_payload} executed successfully.`);
      } else {
        logger.warn(`Webhook Proxy: No handler found for invoice type "${invoice.type || 'unknown'}" with payload ${invoice_payload}.`);
        await sendTelegramMessage( // Using correct sendTelegramMessage call
          `⚠️ Необработанный платеж! Тип: ${invoice.type || 'Неизвестен (из payload?)'}, Payload: ${invoice_payload}, Сумма: ${total_amount / 100} XTR, Пользователь: ${userId}`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      }
    } catch (error) {
      logger.error("Webhook Proxy: Error processing successful_payment:", error);
      await sendTelegramMessage( // Using correct sendTelegramMessage call
        `🚨 Ошибка обработки успешного платежа! Payload: ${update.message?.successful_payment?.invoice_payload || 'N/A'}, User: ${update.message?.chat?.id || 'N/A'}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [],
        undefined,
        ADMIN_CHAT_ID
      );
    }
  } else {
    logger.log("Webhook Proxy: Received update that is not pre_checkout_query or successful_payment. Ignoring.", { type: Object.keys(update) });
  }
}