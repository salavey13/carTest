"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

// === КОНФИГУРАЦИЯ СИНДИКАТА ===
const REWARD_MAP: Record<number, number> = {
  1: 2000, // Прямой реферер: 2000₽
  2: 300,  // Папа реферера: 300₽
  3: 100,  // Дед: 100₽
  // Уровни 4-13 получают по 50₽ (на пиво/сервер)
};
const BASE_DISCOUNT = 1000; // Скидка покупателю

export async function processSuccessfulPayment(buyerId: string, amount: number, serviceName: string) {
  try {
    logger.info(`[Syndicate] Processing payment from ${buyerId} for ${amount}`);

    // 1. Получаем данные покупателя и его реферера
    const { data: buyer } = await supabaseAdmin
      .from('users')
      .select('username, metadata')
      .eq('user_id', buyerId)
      .single();

    if (!buyer?.metadata?.referrer) {
      logger.info("[Syndicate] Organic user, no referrer.");
      return;
    }

    let currentReferrerId = buyer.metadata.referrer;
    let depth = 1;
    const chainLog: string[] = [];

    // 2. Запускаем цепную реакцию (Depth 13)
    while (depth <= 13 && currentReferrerId) {
      const reward = REWARD_MAP[depth] || (depth <= 13 ? 50 : 0);
      
      if (reward > 0) {
        // Начисляем баланс (в реале - запись в таблицу транзакций или metadata.balance)
        await addBalance(currentReferrerId, reward);
        
        // Уведомляем
        const depthMsg = depth === 1 ? "прямую продажу" : `продажу на уровне ${depth}`;
        await sendComplexMessage(
           currentReferrerId,
           `💸 **СИНДИКАТ:** +${reward}₽ за ${depthMsg}!\nПользователь: ${buyer.username || 'Аноним'}\nУслуга: ${serviceName}`
        );
        
        chainLog.push(`Lvl ${depth}: ${currentReferrerId} (+${reward})`);
      }

      // Ищем следующего в цепи (кто пригласил этого реферера?)
      const { data: nextRef } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', currentReferrerId)
        .single();
      
      currentReferrerId = nextRef?.metadata?.referrer || null;
      depth++;
    }

    logger.info(`[Syndicate] Chain complete:\n${chainLog.join('\n')}`);

  } catch (error) {
    logger.error("[Syndicate] Payment processing failed:", error);
  }
}

// Хелпер для начисления (просто пример, можно усложнить)
async function addBalance(userId: string, amount: number) {
  const { data } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  const currentBalance = data?.metadata?.syndicate_balance || 0;
  const newBalance = currentBalance + amount;
  
  await supabaseAdmin.from('users').update({
    metadata: { ...data?.metadata, syndicate_balance: newBalance }
  }).eq('user_id', userId);
}

// Хелпер для получения цены со скидкой
export async function getDiscountedPrice(userId: string, basePrice: number) {
  const { data } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  const hasReferrer = !!data?.metadata?.referrer;
  
  return {
    finalPrice: hasReferrer ? Math.max(0, basePrice - BASE_DISCOUNT) : basePrice,
    discountApplied: hasReferrer ? BASE_DISCOUNT : 0,
    hasReferrer
  };
}