import { SupabaseClient } from "@supabase/supabase-js";
// No need to import createClient here if we are using the pre-configured supabaseAdmin
// import { createClient } from '@supabase/supabase-js';
import { WebhookHandler } from "./types";
import { subscriptionHandler } from "./subscription";
import { carRentalHandler } from "./car-rental"; // Assuming you have these
import { supportHandler } from "./support";
import { donationHandler } from "./donation";
import { scriptAccessHandler } from "./script-access";
import { inventoryScriptAccessHandler } from "./inventory-script-access";

import { disableDummyModeHandler } from "./disable-dummy-mode"; // Handler for DISABLING
// Import the specific supabaseAdmin instance from your hook
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessage } from "../actions"; // Import from main actions
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils"; // Assuming utils is the correct path

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

// Ensure all required handlers are in this array
const handlers: WebhookHandler[] = [
  subscriptionHandler,
  carRentalHandler,
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
  dummyModeHandler, // Keep if you have logic for it
  disableDummyModeHandler, // Keep the handler for disabling dummy mode
  // Add selfDevBoostHandler if it should also exist:
  // selfDevBoostHandler,
];

export async function handleWebhookProxy(update: any) {
  // Using logger as in the target version
  logger.log("Webhook Proxy: Received update", update);

  // Handle pre_checkout_query (consistent with both versions)
  if (update.pre_checkout_query) {
    logger.log("Webhook Proxy: Handling pre_checkout_query", update.pre_checkout_query.id);
    try {
      // Using fetch as in the target version
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
      });
      logger.log("Webhook Proxy: Answered pre_checkout_query successfully");
    } catch (error) {
      logger.error("Webhook Proxy: Failed to answer pre_checkout_query:", error);
    }
    return; // Stop processing here for pre-checkout
  }

  // Handle successful_payment (using logic from the target version)
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const userId = update.message.chat.id.toString(); // Ensure user ID is string
    const { invoice_payload, total_amount } = payment;
    logger.log(`Webhook Proxy: Handling successful_payment. Payload: ${invoice_payload}, Amount: ${total_amount}, UserID: ${userId}`);

    try {
      // Fetch invoice details using supabaseAdmin from the hook
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_payload)
        .maybeSingle(); // Use maybeSingle to handle not found case gracefully

      if (invoiceError) {
        logger.error(`Webhook Proxy: Error fetching invoice ${invoice_payload}:`, invoiceError);
        // Don't throw immediately, maybe log and notify admin later if needed
        // Let's throw for now as invoice is crucial
        throw new Error(`Invoice fetch error: ${invoiceError.message}`);
      }

      if (!invoice) {
        // Critical issue: Payment received but no matching invoice
        logger.error(`Webhook Proxy: Invoice not found in DB for payload: ${invoice_payload}. Payment amount: ${total_amount}, User: ${userId}`);
        // Notify admin about the orphaned payment
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          `🚨 ВНИМАНИЕ: Получен платеж (${total_amount / 100} XTR) с неизвестным payload: ${invoice_payload} от пользователя ${userId}. Инвойс не найден в базе!`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
        // Throw an error to stop processing this payment further
        throw new Error(`Invoice not found for payload: ${invoice_payload}`);
      }

      // Check if invoice is already processed
      if (invoice.status === 'paid') {
        logger.warn(`Webhook Proxy: Invoice ${invoice_payload} already marked as paid. Skipping processing.`);
        return; // Avoid reprocessing
      }

      // Mark invoice as paid using supabaseAdmin
      const { error: updateInvoiceError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice_payload);

      if (updateInvoiceError) {
        logger.error(`Webhook Proxy: Error marking invoice ${invoice_payload} as paid:`, updateInvoiceError);
        // Decide if you should stop processing. For now, throw.
        throw new Error(`Failed to update invoice status: ${updateInvoiceError.message}`);
      }
      logger.log(`Webhook Proxy: Invoice ${invoice_payload} marked as paid.`);

      // Fetch user data using supabaseAdmin
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*") // Select all fields, including metadata
        .eq("user_id", userId)
        .single(); // Assuming user must exist if they made a payment

      // userData can be null if user deleted account between payment and webhook processing
      if (userError && userError.code !== 'PGRST116') { // PGRST116 = 'No rows returned' which is handled by !userData check
         logger.error(`Webhook Proxy: Error fetching user ${userId} for invoice ${invoice_payload}:`, userError);
         // If user data is critical for all handlers, might throw here.
         // For now, proceed and let handlers decide.
      }
      if (!userData) {
          logger.warn(`Webhook Proxy: User ${userId} not found in DB for invoice ${invoice_payload}. Proceeding with basic info.`);
          // Handlers need to be robust enough to handle missing userData
      } else {
          logger.log(`Webhook Proxy: Fetched user data for ${userId}:`, userData.username || 'No username');
      }

      // Find the appropriate handler based on invoice type or payload structure
      const handler = handlers.find(h => h.canHandle(invoice, invoice_payload)); // Pass both invoice data and raw payload

      if (handler) {
        logger.log(`Webhook Proxy: Found handler for invoice type "${invoice.type || 'type not in DB'}". Executing...`);
        const baseUrl = getBaseUrl(); // Get base URL dynamically
        // Execute the handler, passing the supabaseAdmin client instance
        await handler.handle(
          invoice,
          userId,
          // Provide a default object if userData is null/undefined
          userData || { user_id: userId, metadata: {} },
          total_amount / 100, // Pass amount in actual currency units (e.g., XTR)
          supabaseAdmin,      // Pass the imported supabaseAdmin client
          TELEGRAM_BOT_TOKEN,
          ADMIN_CHAT_ID,
          baseUrl             // Pass base URL if needed by handlers
        );
        logger.log(`Webhook Proxy: Handler for invoice ${invoice_payload} executed successfully.`);
      } else {
        // No handler found for this invoice type
        logger.warn(`Webhook Proxy: No handler found for invoice type "${invoice.type || 'unknown'}" with payload ${invoice_payload}.`);
        // Notify admin about unhandled payment type
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          `⚠️ Необработанный платеж! Тип: ${invoice.type || 'Неизвестен (из payload?)'}, Payload: ${invoice_payload}, Сумма: ${total_amount / 100} XTR, Пользователь: ${userId}`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      }
    } catch (error) {
      // Catch any errors during the process
      logger.error("Webhook Proxy: Error processing successful_payment:", error);
      // Notify admin about the failure
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        `🚨 Ошибка обработки успешного платежа! Payload: ${update.message?.successful_payment?.invoice_payload || 'N/A'}, User: ${update.message?.chat?.id || 'N/A'}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [],
        undefined,
        ADMIN_CHAT_ID
      );
    }
  } else {
    // Log if the update is neither pre_checkout_query nor successful_payment
    logger.log("Webhook Proxy: Received update that is not pre_checkout_query or successful_payment. Ignoring.", { type: Object.keys(update) });
  }
}