/**
 * /analytics-pass command
 * =====================
 * Generates a time-based password for analytics access.
 * Only available to crew members.
 * Password expires after 24 hours.
 */

import { sendComplexMessage } from "../actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function analyticsPassCommand(chatId: number, userId: number, username?: string) {
  logger.info(`[ANALYTICS_PASS] >>> FUNCTION ENTERED <<< chatId=${chatId}, userId=${userId}, username=${username}`);
  const userIdStr = String(userId);
  logger.info(`[ANALYTICS_PASS] Command triggered by user ${userId} (${username}).`);

  try {
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

    // For each crew the user belongs to, generate or get existing password
    const results: string[] = [];
    const botUrl = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

    for (const membership of memberships) {
      const crew = (membership as any).crews;
      const crewId = crew.id;
      const slug = crew.slug;
      const crewName = crew.name;

      // Check if there's an existing active password (less than 24 hours old)
      const { data: existingPassword, error: existingError } = await supabaseAdmin
        .from("analytics_passwords")
        .select("password, expires_at")
        .eq("crew_id", crewId)
        .eq("created_by", userIdStr)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (existingPassword && !existingError) {
        const expiresAt = new Date(existingPassword.expires_at);
        const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
        results.push(
          `🔑 *${crewName}* (${slug})\n` +
          `Пароль: "${existingPassword.password}"\n` +
          `⏰ Действует ещё ${hoursLeft} ч.\n` +
          `🔗 [Открыть аналитику](${botUrl}/franchize/${slug}/rentals-analytics)`
        );
      } else {
        // Generate new password
        logger.info(`[ANALYTICS_PASS] Generating new password for crew ${slug} (${crewId})`);
        const { data: newPassword, error: generateError } = await supabaseAdmin
          .rpc("generate_analytics_password", {
            p_crew_id: crewId,
            p_created_by: userIdStr,
            p_slug: slug,
          });

        logger.info(`[ANALYTICS_PASS] Generate result:`, {
          generateError,
          hasData: !!newPassword,
          dataLength: newPassword?.length
        });

        if (generateError || !newPassword || newPassword.length === 0) {
          logger.error("[ANALYTICS_PASS] Error generating password:", generateError);
          results.push(`❌ *${crewName}*: Ошибка генерации пароля`);
          continue;
        }

        const passwordData = newPassword[0];
        const expiresAt = new Date(passwordData.expires_at);
        const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

        results.push(
          `🔑 *${crewName}* (${slug})\n` +
          `Пароль: "${passwordData.password}"\n` +
          `⏰ Действует ${hoursLeft} ч.\n` +
          `🔗 [Открыть аналитику](${botUrl}/franchize/${slug}/rentals-analytics)`
        );
      }
    }

    const message = `🔐 *Пароли для аналитики*\n\n${results.join("\n\n")}\n\n⚠️ Пароли действуют 24 часа. Не передавайте их посторонним.`;

    await sendComplexMessage(chatId, message);
    logger.info(`[ANALYTICS_PASS] Password(s) sent to user ${userId}.`);

  } catch (error) {
    logger.error("[ANALYTICS_PASS] Unexpected error:", error);
    await sendComplexMessage(
      chatId,
      "🚨 Непредвиденная ошибка. Попробуйте позже."
    );
  }
}
