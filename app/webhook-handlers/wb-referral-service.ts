import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { distributeSyndicateRewards } from "@/app/wblanding/actions_referral";
import { logger } from "@/lib/logger";

export const wbReferralServiceHandler: WebhookHandler = {
  // Ловим инвойсы, созданные нашим локальным экшеном
  canHandle: (invoice) => invoice.type === "wb_referral_service",

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId) => {
    logger.info(`[WB Handler] Processing payment ${invoice.id} from ${userId}`);

    const serviceName = invoice.metadata?.service_name || "Услуга склада";
    const serviceType = invoice.metadata?.service_type;

    // 1. Обновляем статус инвойса
    await supabaseAdmin
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    // 2. Записываем покупку в профиль юзера
    const currentMeta = userData.metadata || {};
    const purchasedServices = currentMeta.purchased_services || [];
    
    purchasedServices.push({
      id: invoice.id,
      type: serviceType,
      name: serviceName,
      amount: totalAmount,
      purchased_at: new Date().toISOString(),
      status: 'paid_pending_setup'
    });

    await supabaseAdmin
      .from("users")
      .update({ 
        metadata: { ...currentMeta, purchased_services: purchasedServices } 
      })
      .eq("user_id", userId);

    // 3. 💸 ЗАПУСК СИНДИКАТА (Распределение наград)
    // Это критическая часть. Вызываем логику распределения.
    try {
       await distributeSyndicateRewards(userId, totalAmount, serviceName);
    } catch (distError) {
       logger.error(`[WB Handler] Syndicate distribution failed for ${invoice.id}:`, distError);
       // Не фейлим основной флоу, но алерт админу нужен
       await sendTelegramMessage(telegramToken, `🚨 Ошибка распределения бонусов для ${invoice.id}`, [], undefined, adminChatId);
    }

    // 4. Уведомления
    await sendTelegramMessage(
      telegramToken,
      `✅ Оплата принята! Услуга "${serviceName}" активирована.\n\nАрхитектор свяжется с вами в течение 24 часов для начала работ.`,
      [], undefined, userId
    );

    await sendTelegramMessage(
      telegramToken,
      `💰 **ПРОДАЖА WB:**\nЮзер: ${userData.username || userId}\nУслуга: ${serviceName}\nСумма: ${totalAmount} XTR\nСкидка: ${invoice.metadata?.discount_applied > 0 ? 'ДА' : 'НЕТ'}`,
      [], undefined, adminChatId
    );
  },
};