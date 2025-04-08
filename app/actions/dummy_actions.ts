// /app/actions/dummy_actions.ts
"use server";

import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions"; // Import from the main actions file
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";

/**
 * Sends an invoice for purchasing the ability to DISABLE Dummy Mode.
 * This is intended for parents who want to enforce "real" test conditions.
 */
export async function purchaseDisableDummyMode(userId: string) {
  logger.log(`Initiating purchase to DISABLE Dummy Mode for user: ${userId}`);
  try {
    // Check if user's dummy mode is already permanently disabled
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .single();

    if (userError) {
      logger.error(`Error fetching user ${userId} before purchase:`, userError);
      // Don't necessarily block purchase, maybe log and continue
    }

    // Access the specific flag within metadata safely
    const isAlreadyDisabled = user?.metadata?.is_dummy_mode_disabled_by_parent === true;

    if (isAlreadyDisabled) {
      logger.warn(`User ${userId} already has Dummy Mode permanently disabled. Purchase skipped.`);
      return { success: true, alreadyDisabled: true, message: "Режим подсказок уже отключен для этого пользователя." };
    }

    const amount = 15000; // 150 XTR (adjust price for disabling)
    const title = "🔒 Отключить Режим Подсказок";
    const description = "Приобретите эту опцию, чтобы отключить возможность использования режима подсказок (Dummy Mode) в тестах ВПР для этого пользователя.";
    // Unique payload incorporating user ID and a random element
    const invoicePayload = `disable_dummy_${userId}_${uuidv4()}`;

    // Send the invoice via Telegram
    const invoiceResult = await sendTelegramInvoice(
      userId, // Send invoice *to the user* (parent needs to interact with their bot)
      title,
      description,
      invoicePayload,
      amount,
      0, // No subscription ID needed
      // Optional: Add a lock image or something relevant
      "https://images.unsplash.com/photo-1558017393-0a11d16f92bd?q=80&w=800" // Example lock image
    );

    if (!invoiceResult.success) {
      throw new Error(invoiceResult.error || "Failed to send invoice via Telegram");
    }

    // Store the invoice in the database
    const { error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert({
        id: invoicePayload,
        user_id: userId,
        amount: amount / 100, // Store the actual XTR amount
        type: "disable_dummy_mode", // New type
        status: "pending",
        metadata: { description },
        subscription_id: 0,
      });

    if (insertError) {
      logger.error("Failed to save disable_dummy_mode invoice to DB:", insertError);
      throw new Error(`Failed to save invoice: ${insertError.message}`);
    }

    logger.log(`Disable Dummy Mode invoice ${invoicePayload} sent and saved for user ${userId}`);
    return { success: true, alreadyDisabled: false, message: "Счет на отключение режима подсказок отправлен в Telegram!" };

  } catch (error) {
    logger.error("Error in purchaseDisableDummyMode:", error);
    return { success: false, alreadyDisabled: false, error: error instanceof Error ? error.message : "Не удалось инициировать отключение режима подсказок." };
  }
}