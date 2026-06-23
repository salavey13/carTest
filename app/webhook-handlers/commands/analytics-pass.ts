/**
 * /analytics-pass command
 * =====================
 * Generates a time-based password for analytics access and sends it to crew email.
 * Only available to crew members.
 * Password expires after 24 hours.
 */

import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

// Internal API URL for email sending
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

async function sendPasswordToEmail(crewId: string, slug: string, crewName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${SITE_URL}/api/send-analytics-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crewId }),
    });

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || "Failed to send email" };
    }

    return { success: true };
  } catch (error) {
    logger.error("[ANALYTICS_PASS] Email send error:", error);
    return { success: false, error: "Network error sending email" };
  }
}

export async function analyticsPassCommand(chatId: number, userId: number, username?: string) {
  logger.info(`[ANALYTICS_PASS] >>> FUNCTION ENTERED <<< chatId=${chatId}, userId=${userId}, username=${username}`);
  const userIdStr = String(userId);

  try {
    logger.info(`[ANALYTICS_PASS] Command triggered by user ${userId} (${username}).`);
    logger.info(`[ANALYTICS_PASS] Fetching crew membership for user ${userIdStr}...`);

    // Get crew membership for the user
    const { data: memberships, error: memberError } = await supabaseAdmin
      .from("crew_members")
      .select(`
        crew_id,
        crews!inner (
          id,
          slug,
          name
        )
      `)
      .eq("user_id", userIdStr)
      .eq("membership_status", "active");

    logger.info(`[ANALYTICS_PASS] Membership query result:`, {
      memberError,
      membershipCount: memberships?.length || 0
    });

    if (memberError) {
      logger.error("[ANALYTICS_PASS] Error fetching crew membership:", memberError);
      await sendComplexMessage(
        chatId,
        "⚠️ Ошибка доступа к базе данных. Попробуйте позже."
      );
      return;
    }

    if (!memberships || memberships.length === 0) {
      logger.info(`[ANALYTICS_PASS] No active memberships found for user ${userIdStr}`);
      await sendComplexMessage(
        chatId,
        "🔒 *Доступ запрещен*\n\nЭта команда доступна только членам команды VIP Bike. Свяжитесь с администратором для получения доступа."
      );
      return;
    }

    // For each crew the user belongs to, send password via email
    const results: string[] = [];

    for (const membership of memberships) {
      const crew = (membership as any).crews;
      const crewId = crew.id;
      const slug = crew.slug;
      const crewName = crew.name;

      logger.info(`[ANALYTICS_PASS] Sending password to email for crew ${slug} (${crewId})`);

      // Send password via email
      const emailResult = await sendPasswordToEmail(crewId, slug, crewName);

      if (emailResult.success) {
        results.push(
          `✅ *${crewName}*: Пароль отправлен на эл. почту экипажа.`
        );
      } else {
        results.push(
          `❌ *${crewName}*: ${emailResult.error || "Ошибка отправки"}`
        );
      }
    }

    const message = `🔐 *Пароли для аналитики*\n\n${results.join("\n\n")}\n\n⏰ Пароли действуют 24 часа. Проверьте почту.`;

    await sendComplexMessage(chatId, message);
    logger.info(`[ANALYTICS_PASS] Password email(s) triggered for user ${userId}.`);

  } catch (error) {
    logger.error("[ANALYTICS_PASS] ++++ ERROR CAUGHT ++++", error);
    logger.error("[ANALYTICS_PASS] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    await sendComplexMessage(
      chatId,
      "🚨 Непредвиденная ошибка. Попробуйте позже."
    );
  }
}
