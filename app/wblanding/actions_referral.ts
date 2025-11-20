"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

// === КОНФИГУРАЦИЯ СИНДИКАТА (Depth 13) ===
const REWARD_MAP: Record<number, number> = {
  1: 2000, // Direct: 20%
  2: 300,  // Level 2: 3%
  3: 100,  // Level 3: 1%
  // 4-13: 50 RUB (Passive drip)
};
const MAX_DEPTH = 13;
const BASE_DISCOUNT = 1000;

// === 1. SECURE PRICE CALCULATION ===
// Вызывается перед созданием инвойса, чтобы определить честную цену
export async function calculateServicePrice(userId: string, basePrice: number) {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const hasReferrer = !!user?.metadata?.referrer;
    
    // Если есть реферер — даем скидку, иначе полная цена (для "лохов")
    const finalPrice = hasReferrer ? Math.max(0, basePrice - BASE_DISCOUNT) : basePrice;
    
    return {
      price: finalPrice,
      discount: hasReferrer ? BASE_DISCOUNT : 0,
      referrerId: user?.metadata?.referrer // Для логов
    };
  } catch (e) {
    return { price: basePrice, discount: 0, referrerId: null };
  }
}

// === 2. WEALTH DISTRIBUTION ENGINE ===
// Вызывается ПОСЛЕ успешной оплаты (из вебхука)
export async function distributeSyndicateRewards(buyerId: string, amountPaid: number, serviceName: string) {
  logger.info(`[Syndicate] 💸 Initiating distribution flow for buyer ${buyerId}. Amount: ${amountPaid}`);

  try {
    // Шаг 1: Найти покупателя и его "отца"
    const { data: buyer } = await supabaseAdmin
      .from('users')
      .select('username, metadata')
      .eq('user_id', buyerId)
      .single();

    if (!buyer?.metadata?.referrer) {
      logger.info("[Syndicate] 🛑 Organic user (no referrer). All profit stays in house.");
      return;
    }

    let currentReferrerId = buyer.metadata.referrer;
    let depth = 1;
    const buyerName = buyer.username || `ID${buyerId}`;

    // Шаг 2: Рекурсивный подъем по цепи (до 13 уровня)
    while (depth <= MAX_DEPTH && currentReferrerId) {
      // Определяем награду
      const reward = REWARD_MAP[depth] || (depth <= 13 ? 50 : 0);
      
      if (reward > 0) {
        logger.info(`[Syndicate] 💎 Lvl ${depth}: Sending ${reward} RUB to ${currentReferrerId}`);
        
        // A. Начисляем баланс в metadata (Metadata Ledger)
        await creditUserBalance(currentReferrerId, reward, {
            source_user: buyerName,
            depth: depth,
            service: serviceName,
            timestamp: new Date().toISOString()
        });
        
        // B. Уведомляем агента
        const depthEmoji = depth === 1 ? "🥇" : depth === 2 ? "🥈" : depth === 3 ? "🥉" : "⛓️";
        const msg = `💸 **СИНДИКАТ (${depthEmoji} Lvl ${depth})**\n` +
                    `Вам начислено: *+${reward} ₽*\n` +
                    `Источник: ${buyerName}\n` +
                    `Услуга: ${serviceName}`;
                    
        await sendComplexMessage(currentReferrerId, msg, [], { parseMode: 'Markdown' });
      }

      // Шаг 3: Ищем следующего в цепи ("деда")
      const { data: nextRef } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', currentReferrerId)
        .single();
      
      // Переходим на уровень выше
      currentReferrerId = nextRef?.metadata?.referrer || null;
      depth++;
    }

    logger.info("[Syndicate] ✅ Distribution chain completed successfully.");

  } catch (error) {
    logger.error("[Syndicate] ☠️ CRITICAL DISTRIBUTION FAILURE:", error);
    // Здесь можно добавить алерт админу, что деньги не дошли
  }
}

// === INTERNAL LEDGER HELPER ===
async function creditUserBalance(userId: string, amount: number, historyEntry: any) {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('metadata')
    .eq('user_id', userId)
    .single();

  if (!user) return;

  const currentMeta = user.metadata || {};
  const currentBalance = (currentMeta.syndicate_balance || 0) + amount;
  const currentHistory = Array.isArray(currentMeta.syndicate_history) ? currentMeta.syndicate_history : [];
  
  // Добавляем запись в историю (ограничиваем последними 50 записями, чтобы не раздувать JSON)
  const newHistory = [historyEntry, ...currentHistory].slice(0, 50);

  await supabaseAdmin
    .from('users')
    .update({
      metadata: {
        ...currentMeta,
        syndicate_balance: currentBalance,
        syndicate_history: newHistory
      }
    })
    .eq('user_id', userId);
}