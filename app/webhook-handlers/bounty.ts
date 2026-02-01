import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger";

export const bountyHandler: WebhookHandler = {
  // Catch both the "mutation" bounties and the "pure donation" love
  canHandle: (invoice) => invoice.type === "bounty_request" || invoice.type === "donation_pure",

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    logger.info(`[Bounty Handler] Processing ${invoice.type} from ${userId}`);

    // 1. Update Invoice Status to PAID (Critical for the Bounty Board to see it)
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    if (updateError) {
      logger.error(`[Bounty Handler] Failed to mark invoice ${invoice.id} as paid:`, updateError);
      // We continue anyway to notify admins, but this is bad.
    }

    // 2. Notify the User
    const userMsg = invoice.type === "bounty_request"
      ? `🚀 **Баунти Активировано!**\n\nВаша задача: "${invoice.metadata?.bounty_title}" добавлена в очередь.\nСумма поддержки: ${totalAmount} XTR.\n\nАрхитектор скоро рассмотрит заявку.`
      : `💖 **Спасибо за Поддержку!**\n\nВаши ${totalAmount} XTR получены. Вайб повышается!`;

    await sendTelegramMessage(telegramToken, userMsg, [], undefined, userId);

    // 3. Notify the Architect (You)
    const adminTitle = invoice.type === "bounty_request" ? "🧬 НОВАЯ МУТАЦИЯ (Bounty)" : "💖 ДОНАТ (Love)";
    const bountyDetails = invoice.type === "bounty_request"
      ? `\n**Задача:** ${invoice.metadata?.bounty_title}\n**Описание:** ${invoice.metadata?.bounty_desc}`
      : `\n**Сообщение:** ${invoice.metadata?.bounty_desc || "Без сообщения"}`;

    const adminMsg = `${adminTitle}\n` +
                     `**От:** ${userData.username || userId} (${userId})\n` +
                     `**Сумма:** ${totalAmount} XTR` +
                     bountyDetails;

    // Send to Admin Chat
    await sendTelegramMessage(telegramToken, adminMsg, [], undefined, adminChatId);
    
    // Optional: If it's a bounty, you might want to auto-post it to a "Bounty Channel" if you have one
  },
};