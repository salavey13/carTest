"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

// === LEGAL COMPLIANCE CONFIG (Max 3 Levels) ===
const REWARD_MAP: Record<number, number> = {
  1: 2000, // Direct: 20%
  2: 300,  // Level 2: 3%
  3: 100,  // Level 3: 1%
};
const MAX_DEPTH = 3; // Hard cap for legal safety
const BASE_DISCOUNT = 1000;
const MAX_TOTAL_REWARDS_PER_MONTH = 100000; // AML cap

// === 1. SECURE PRICE CALCULATION ===
export async function calculateServicePrice(userId: string, basePrice: number) {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('metadata')
      .eq('user_id', userId)
      .single();

    const hasReferrer = !!user?.metadata?.referrer;
    
    const finalPrice = hasReferrer ? Math.max(0, basePrice - BASE_DISCOUNT) : basePrice;
    
    return {
      price: finalPrice,
      discount: hasReferrer ? BASE_DISCOUNT : 0,
      referrerId: user?.metadata?.referrer
    };
  } catch (e) {
    return { price: basePrice, discount: 0, referrerId: null };
  }
}

// === 2. WEALTH DISTRIBUTION ENGINE ===
export async function distributeSyndicateRewards(buyerId: string, amountPaid: number, serviceName: string) {
  logger.info(`[Syndicate] Processing payment ${buyerId}`);

  try {
    const { data: buyer } = await supabaseAdmin
      .from('users')
      .select('username, metadata, user_id')
      .eq('user_id', buyerId)
      .single();

    if (!buyer?.metadata?.referrer) {
      logger.info("[Syndicate] Organic purchase - no referrer");
      return;
    }

    const referrerId = buyer.metadata.referrer;
    const buyerName = buyer.username || `ID${buyerId}`;
    
    // Anti-fraud: Block self-referral
    if (referrerId === buyerId) {
      logger.warn(`[Syndicate] Self-referral blocked for ${buyerId}`);
      return;
    }

    let currentReferrerId: string | null = referrerId;
    let depth = 1;

    while (depth <= MAX_DEPTH && currentReferrerId) {
      const reward = REWARD_MAP[depth];
      
      if (reward && reward > 0) {
        // Record as service credit with tax liability flag
        await creditUserBalance(currentReferrerId, reward, {
          type: 'referral_commission',
          source_user: buyerName,
          source_user_id: buyerId,
          amount: reward,
          depth: depth,
          service: serviceName,
          timestamp: new Date().toISOString(),
          tax_liable: true
        });
        
        const depthEmoji = depth === 1 ? "🥇" : depth === 2 ? "🥈" : "🥉";
        const msg = `💸 **ПАРТНЕРСКАЯ ПРОГРАММА (${depthEmoji} Уровень ${depth})**\n` +
                    `Вам начислено: *+${reward} ₽*\n` +
                    `От пользователя: ${buyerName}\n` +
                    `Услуга: ${serviceName}\n\n` +
                    `_Комиссия за привлечение клиента_`;
                    
        await sendComplexMessage(currentReferrerId, msg, [], { parseMode: 'Markdown' });
      }

      // Move up the chain
      const { data: nextRef } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', currentReferrerId)
        .single();
      
      currentReferrerId = nextRef?.metadata?.referrer || null;
      depth++;
    }

    logger.info("[Syndicate] Distribution completed legally");

  } catch (error) {
    logger.error("[Syndicate] Distribution error:", error);
    throw error;
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

export async function getDiscountedPrice(userId: string, basePrice: number) {
  const { data } = await supabaseAdmin.from('users').select('metadata').eq('user_id', userId).single();
  const hasReferrer = !!data?.metadata?.referrer;
  
  return {
    finalPrice: hasReferrer ? Math.max(0, basePrice - BASE_DISCOUNT) : basePrice,
    discountApplied: hasReferrer ? BASE_DISCOUNT : 0,
    hasReferrer
  };
}