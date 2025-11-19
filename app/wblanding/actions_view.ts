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

// Генерация реферального кода (для Pirate Referral)
export async function getOrGenerateReferralCode(userId: string) {
  try {
    // 1. Проверяем, есть ли уже код
    const { data: existing } = await supabaseAdmin
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (existing) return { success: true, code: existing.code };

    // 2. Если нет — генерируем PIRATE-style код
    const code = `PIRATE${userId.slice(-4).toUpperCase()}${Math.floor(Math.random() * 99)}`;
    
    await supabaseAdmin.from("referral_codes").insert({
      user_id: userId,
      code: code,
      is_active: true,
    });

    return { success: true, code };
  } catch (error) {
    logger.error("[Landing] Error managing referral code:", error);
    return { success: false, error: "Не удалось создать код" };
  }
}