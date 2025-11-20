"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

// === REFERRAL LOGIC ===

export async function getMyReferralCode(userId: string) {
  try {
    // 1. Получаем юзера
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('username, user_id')
      .eq('user_id', userId)
      .single();

    if (error || !user) throw new Error("User not found");

    // 2. Код — это Username (если есть) или ID
    // Мы приводим к верхнему регистру для стиля, но искать будем case-insensitive
    const code = user.username ? user.username.toUpperCase() : `ID${user.user_id}`;
    
    return { success: true, code };
  } catch (error) {
    logger.error("[Referral] Error fetching code:", error);
    return { success: false, code: "ERROR" };
  }
}

export async function applyReferralCode(userId: string, referralCode: string) {
  // Защита от само-реферальства
  if (!referralCode || referralCode.includes(userId)) return { success: false };

  try {
    // 1. Проверяем, не установлен ли уже реферер
    const { data: me } = await supabaseAdmin
        .from('users')
        .select('metadata')
        .eq('user_id', userId)
        .single();
    
    if (me?.metadata?.referrer) {
        return { success: false, error: "Referrer already set" };
    }

    // 2. Ищем реферера (по username или ID)
    // Сначала пробуем как ID
    let referrerId = null;
    if (referralCode.startsWith("ID")) {
        referrerId = referralCode.replace("ID", "");
    } else {
        // Ищем по username (case insensitive)
        const { data: refUser } = await supabaseAdmin
            .from('users')
            .select('user_id')
            .ilike('username', referralCode) // Case insensitive match
            .maybeSingle();
        if (refUser) referrerId = refUser.user_id;
    }

    if (!referrerId || referrerId === userId) return { success: false, error: "Invalid referrer" };

    // 3. Записываем связь в metadata
    const newMeta = { ...me?.metadata, referrer: referrerId, referrer_code: referralCode, referred_at: new Date().toISOString() };
    
    await supabaseAdmin
        .from('users')
        .update({ metadata: newMeta })
        .eq('user_id', userId);

    logger.info(`[Referral] User ${userId} linked to referrer ${referrerId} (${referralCode})`);
    return { success: true, referrerId };

  } catch (e) {
    logger.error("[Referral] Apply failed", e);
    return { success: false };
  }
}

// === CONTENT LOGIC ===

export async function getApprovedTestimonials() {
  const { data } = await supabaseAdmin
    .from('testimonials')
    .select('*')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(6);
  return { success: true, data: data || [] };
}