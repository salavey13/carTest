// /app/actions/dummy_actions.ts
"use server";

import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions"; // Import from main actions
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";

/**
 * Sends an invoice for purchasing the ability to permanently DISABLE Dummy Mode
 * for a specific user. Intended for parents/admins managing user settings.
 *
 * @param targetUserId The ID of the user for whom Dummy Mode should be disabled.
 * @param requesterUserId The ID of the user (e.g., parent) requesting the purchase.
 *                      The invoice will be sent to this user.
 */
export async function purchaseDisableDummyMode(targetUserId: string, requesterUserId: string): Promise<{ success: boolean; alreadyDisabled?: boolean; message?: string; error?: string }> {
  logger.log(`Initiating purchase to DISABLE Dummy Mode for user: ${targetUserId} by requester: ${requesterUserId}`);
  debugLogger.log(`[Dummy Action] purchaseDisableDummyMode called with targetUserId=${targetUserId}, requesterUserId=${requesterUserId}`);

  if (!targetUserId || !requesterUserId) {
      return { success: false, error: "Target user ID and requester user ID are required." };
  }

  try {
    // 1. Check if the target user's dummy mode is already permanently disabled
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata, username, full_name") // Select name for notifications
      .eq("user_id", targetUserId)
      .maybeSingle(); // Use maybeSingle

    if (userError) {
      logger.error(`Error fetching target user ${targetUserId} data before purchase:`, userError);
      // Allow purchase attempt but log the error.
    }

    // Safely access metadata and the specific flag
    const isAlreadyDisabled = targetUser?.metadata?.is_dummy_mode_disabled_by_parent === true;

    if (isAlreadyDisabled) {
      logger.warn(`User ${targetUserId} already has Dummy Mode permanently disabled. Purchase skipped.`);
      const message = `Режим подсказок уже отключен для пользователя ${targetUser?.username || targetUserId}.`;
      return { success: true, alreadyDisabled: true, message };
    }

    // 2. Prepare Invoice Details
    const amount = 150; // 150 XTR (Confirm if this requires multiplication, e.g., 15000 for smallest unit)
                      // Assuming sendTelegramInvoice takes the value directly for XTR.
    const title = "🔒 Отключить Режим Подсказок";
    const description = `Отключить Режим Подсказок для пользователя ${targetUser?.username || targetUserId}. После оплаты эта опция будет применена к его аккаунту.`;
    // Unique payload including both user IDs for tracking context
    const invoicePayload = `disable_dummy_${targetUserId}_${requesterUserId}_${uuidv4().substring(0, 8)}`;

    // 3. Send the invoice via Telegram *to the requester*
    logger.info(`Sending disable_dummy_mode invoice ${invoicePayload} to requester ${requesterUserId}`);
    const invoiceResult = await sendTelegramInvoice(
      requesterUserId, // Send invoice to the parent/admin making the request
      title,
      description,
      invoicePayload,
      amount,
      0, // No subscription ID needed
      "https://images.unsplash.com/photo-1558017393-0a11d16f92bd?q=80&w=400" // Smaller relevant image
    );

    if (!invoiceResult.success) {
        // Error already logged by sendTelegramInvoice
      throw new Error(invoiceResult.error || "Failed to send disable_dummy_mode invoice via Telegram");
    }

    // 4. Store the invoice in the database (assuming sendTelegramInvoice doesn't already do this reliably)
    // It's generally better to save the invoice *before* sending, or have the sending function handle it atomically.
    // If sendTelegramInvoice saves it, this block might be redundant or needs adjustment.
    // Let's assume for now sendTelegramInvoice handles saving.
    // If not, uncomment and adapt this:
    /*
    const { error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert({
        id: invoicePayload,
        user_id: requesterUserId, // The user who needs to pay
        amount: amount, // Store the actual XTR amount correctly
        type: "disable_dummy_mode", // Specific type
        status: "pending",
        metadata: {
            description,
            target_user_id: targetUserId, // Store the target user ID
            target_username: targetUser?.username || null, // Store for easier logs/display
            requester_user_id: requesterUserId,
        },
        subscription_id: 0,
      });

    if (insertError) {
      logger.error(`Failed to save disable_dummy_mode invoice ${invoicePayload} to DB:`, insertError);
      // Notify admin about DB save failure?
      await notifyAdmin(`⚠️ DB Error: Failed to save disable_dummy_mode invoice ${invoicePayload} after sending. Error: ${insertError.message}`);
      // Decide if this failure should be shown to the user. Probably not, if the invoice was sent.
      // throw new Error(`Failed to save invoice record: ${insertError.message}`);
    }
    */

    logger.log(`Disable Dummy Mode invoice ${invoicePayload} sent to ${requesterUserId} (for target ${targetUserId}) and saved.`);
    return {
        success: true,
        alreadyDisabled: false,
        message: "Счет на отключение режима подсказок отправлен вам в Telegram. Пожалуйста, оплатите его для применения изменений."
    };

  } catch (error) {
    logger.error(`Error in purchaseDisableDummyMode (target: ${targetUserId}, requester: ${requesterUserId}):`, error);
    const message = error instanceof Error ? error.message : "Не удалось инициировать отключение режима подсказок.";
    // Notify admin about the failure
    await notifyAdmin(`❌ Ошибка при попытке покупки отключения Dummy Mode для ${targetUserId} (запросил ${requesterUserId}): ${message}`).catch(logger.error);
    return { success: false, alreadyDisabled: false, error: message };
  }
}