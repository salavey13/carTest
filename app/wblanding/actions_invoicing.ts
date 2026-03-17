"use server";

import { sendTelegramInvoice } from "@/app/actions"; // Core action (transport only)
import { supabaseAdmin } from "@/lib/supabase-server";
import { calculateServicePrice } from "./actions_referral";
import { logger } from "@/lib/logger";

const SERVICES_MAP = {
  'quick_setup': { 
      basePrice: 10000, 
      title: "Настройка склада (WB/Ozon)", 
      desc: "Полная интеграция, ключи, обучение." 
  },
  'team_training': { 
      basePrice: 10000, 
      title: "Обучение команды", 
      desc: "Тренинг для кладовщиков и менеджеров." 
  }
};

export async function purchaseWbService(
  userId: string, 
  serviceType: 'quick_setup' | 'team_training'
): Promise<{ success: boolean; error?: string }> {
  
  const serviceConfig = SERVICES_MAP[serviceType];
  if (!serviceConfig) return { success: false, error: "Unknown service" };

  // 1. Проверка и расчет цены (Синдикат)
  const calculation = await calculateServicePrice(userId, serviceConfig.basePrice);
  const finalAmount = calculation.price;

  // 2. Формируем уникальный payload для вебхука
  // Префикс 'wb_service_' направит этот инвойс в наш новый хендлер
  const payload = `wb_service_${serviceType}_${userId}_${Date.now()}`;

  // 3. Красивое описание со скидкой
  let description = serviceConfig.desc;
  if (calculation.discount > 0) {
    description += `\n🎁 Скидка Синдиката: -${calculation.discount} XTR`;
  }

  try {
    // 4. Вызываем CORE action только для отправки
    const result = await sendTelegramInvoice(
      userId, 
      serviceConfig.title, 
      description, 
      payload, 
      finalAmount, 
      0, // No subscription_id
      undefined // No photo
    );

    if (!result.success) throw new Error(result.error);

    // 5. Сохраняем инвойс в БД с богатыми метаданными для вебхука
    await supabaseAdmin.from("invoices").insert({ 
        id: payload, 
        user_id: userId, 
        amount: finalAmount, // Реально оплаченная сумма
        type: "wb_referral_service", // Специальный тип для нашего хендлера
        status: "pending", 
        metadata: { 
          service_type: serviceType,
          service_name: serviceConfig.title,
          base_price: serviceConfig.basePrice,
          discount_applied: calculation.discount,
          referrer_id: calculation.referrerId, // Чтобы вебхук знал, кому платить бонус
          syndicate_depth_check: true 
        }
    }); 

    logger.info(`[WB Invoice] Created for ${userId}: ${payload} (${finalAmount} XTR)`);
    return { success: true };

  } catch (error) {
    logger.error("Error in purchaseWbService:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}
