"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

// Получение отзывов (Public)
export async function getApprovedTestimonials() {
  try {
    const { data, error } = await supabaseAdmin
      .from('testimonials')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    logger.error("[Landing] Error fetching testimonials:", error);
    return { success: false, data: [] };
  }
}

// Генерация "Личного Бренда" (Рефералки)
export async function getOrGenerateReferralCode(userId: string) {
  try {
    // 1. Получаем данные юзера, чтобы узнать username
    const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('username')
        .eq('user_id', userId)
        .single();

    if (userError) throw userError;

    // 2. Определяем желаемый код: Username (без @) или ID
    let desiredCode = user?.username 
        ? user.username.toUpperCase() 
        : `ID${userId}`;

    // 3. Проверяем, есть ли уже код у этого юзера
    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (existing) {
        // Если код уже есть, и он отличается от username (например, юзер сменил ник),
        // в идеале можно обновить, но для стабильности пока вернем старый, 
        // либо можно сделать логику обновления.
        // Пока вернем существующий, чтобы ссылки не ломались.
        return { success: true, code: existing.code };
    }

    // 4. Пытаемся создать новый
    // Проверка на коллизии (вдруг кто-то занял такой же код, маловероятно для username, но все же)
    const { data: collision } = await supabaseAdmin
        .from("referral_codes")
        .select("id")
        .eq("code", desiredCode)
        .single();

    if (collision) {
        // Если коллизия (редкость), добавляем суффикс
        desiredCode = `${desiredCode}_${Math.floor(Math.random() * 999)}`;
    }

    await supabaseAdmin.from("referral_codes").insert({
      user_id: userId,
      code: desiredCode,
      is_active: true,
      // Можно добавить metadata: { source: 'username_strategy' }
    });

    return { success: true, code: desiredCode };
  } catch (error) {
    logger.error("[Landing] Error managing referral code:", error);
    // Fallback на ID в случае ошибки
    return { success: true, code: `ID${userId}` };
  }
}