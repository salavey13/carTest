import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from '@supabase/supabase-js';
import { WebhookHandler } from "./types";
import { subscriptionHandler } from "./subscription";
import { carRentalHandler } from "./car-rental"; // Assuming you have these
import { supportHandler } from "./support";
import { donationHandler } from "./donation";
import { scriptAccessHandler } from "./script-access";
import { inventoryScriptAccessHandler } from "./inventory-script-access";
import { dummyModeHandler } from "./dummy-mode"; // Handler for ENABLING (if you keep it)
import { disableDummyModeHandler } from "./disable-dummy-mode"; // <-- IMPORT NEW HANDLER
import { supabaseAdmin } from "@/hooks/supabase"; // Use admin client for updates
import { sendTelegramMessage } from "../actions"; // Import from main actions
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/utils";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

// Add the new handler to this array
const handlers: WebhookHandler[] = [
  subscriptionHandler,
  carRentalHandler,
  supportHandler,
  donationHandler,
  scriptAccessHandler,
  inventoryScriptAccessHandler,
  dummyModeHandler, // Keep if you have a separate purchase flow for enabling features
  disableDummyModeHandler, // <-- ADD HERE (Handles payment for DISABLING dummy mode)
];

export async function handleWebhookProxy(update: any) {
  logger.log("Webhook Proxy: Received update", update);

  // Handle pre_checkout_query (No changes needed here)
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

  // Handle successful_payment
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const userId = update.message.chat.id.toString();
    const { invoice_payload, total_amount } = payment;
    logger.log(`Webhook Proxy: Handling successful_payment. Payload: ${invoice_payload}, Amount: ${total_amount}, UserID: ${userId}`);

    try {
      // Fetch invoice details (No changes needed here)
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
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          `🚨 ВНИМАНИЕ: Получен платеж (${total_amount / 100} XTR) с неизвестным payload: ${invoice_payload} от пользователя ${userId}. Инвойс не найден в базе!`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
        throw new Error(`Invoice not found for payload: ${invoice_payload}`);
      }

      // Check if invoice already processed (No changes needed here)
      if (invoice.status === 'paid') {
        logger.warn(`Webhook Proxy: Invoice ${invoice_payload} already marked as paid. Skipping processing.`);
        return;
      }

      // Mark invoice as paid (No changes needed here)
      const { error: updateInvoiceError } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice_payload);

      if (updateInvoiceError) {
        logger.error(`Webhook Proxy: Error marking invoice ${invoice_payload} as paid:`, updateInvoiceError);
        throw new Error(`Failed to update invoice status: ${updateInvoiceError.message}`);
      }
      logger.log(`Webhook Proxy: Invoice ${invoice_payload} marked as paid.`);

      // Fetch user data (No changes needed here)
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("*") // Select all, including metadata
        .eq("user_id", userId)
        .single();

      if (userError || !userData) {
        logger.error(`Webhook Proxy: Error fetching user ${userId} for invoice ${invoice_payload}:`, userError);
        // Handle missing user data, maybe notify admin
      } else {
        logger.log(`Webhook Proxy: Fetched user data for ${userId}:`, userData.username || 'No username');
      }

      // Find the appropriate handler (This logic correctly finds the handler based on canHandle)
      const handler = handlers.find(h => h.canHandle(invoice, invoice_payload));

      if (handler) {
        logger.log(`Webhook Proxy: Found handler for invoice type "${invoice.type}". Executing...`);
        const baseUrl = getBaseUrl();
        await handler.handle(
          invoice,
          userId,
          userData || { user_id: userId, metadata: {} }, // Pass basic user ID and empty metadata if fetch failed
          total_amount / 100, // Pass amount in actual currency units
          supabaseAdmin, // Pass the admin client
          TELEGRAM_BOT_TOKEN,
          ADMIN_CHAT_ID,
          baseUrl
        );
        logger.log(`Webhook Proxy: Handler for invoice ${invoice_payload} executed successfully.`);
      } else {
        logger.warn(`Webhook Proxy: No handler found for invoice type "${invoice.type || 'unknown'}" with payload ${invoice_payload}.`);
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          `⚠️ Необработанный платеж! Тип: ${invoice.type || 'Неизвестен (из payload?)'}, Payload: ${invoice_payload}, Сумма: ${total_amount / 100} XTR, Пользователь: ${userId}`,
          [],
          undefined,
          ADMIN_CHAT_ID
        );
      }
    } catch (error) {
      logger.error("Webhook Proxy: Error processing successful_payment:", error);
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        `🚨 Ошибка обработки успешного платежа! Payload: ${update.message?.successful_payment?.invoice_payload}, User: ${update.message?.chat?.id}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [],
        undefined,
        ADMIN_CHAT_ID
      );
    }
  } else {
    logger.log("Webhook Proxy: Received update that is not pre_checkout_query or successful_payment. Ignoring.", { type: Object.keys(update) });
  }
}