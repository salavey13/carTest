import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import { updateQuantity } from "@/app/tapki/actions";

export const tapkiHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "tapki_purchase",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const tapkiId = metadata?.tapki_id;

    if (!tapkiId) throw new Error("Tapki ID missing");

    // Update quantity
    const { success: qtySuccess } = await updateQuantity(tapkiId);
    if (!qtySuccess) throw new Error("Failed to update stock");

    // User confirmation with humor
    const userMessage = `✅ Тапочки куплены! Теперь твои ноги в сауне — как в шлюпке во время шторма. Наслаждайся, выживший! 😂`;
    await sendComplexMessage(userId, userMessage, [], { imageQuery: metadata?.image_url });

    // Admin notification
    const adminMessage = `🔔 Новая покупка тапочек: ${totalAmount} XTR от @${userData.username || userId}. Остаток: проверьте в CRM!`;
    await sendComplexMessage(adminChatId, adminMessage, []);
  },
};