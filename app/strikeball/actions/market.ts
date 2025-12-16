"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions"; 
import { logger } from "@/lib/logger";

export async function getGearList() {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .in("type", ["gear", "weapon", "consumable"]) 
      .order("daily_price", { ascending: true });

    if (error) {
      logger.error("Failed to fetch gear", error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
}

/**
 * Sends a Telegram Invoice for purchasing/renting gear.
 * Uses 'gear_buy' type for the webhook to detect.
 */
export async function rentGear(userId: string, gearId: string) {
  try {
    const { data: item } = await supabaseAdmin.from("cars").select("*").eq("id", gearId).single();
    if (!item) throw new Error("Снаряжение не найдено.");

    // Payload format: gear_buy_{ID}_{TIMESTAMP}
    const invoicePayload = `gear_buy_${gearId}_${Date.now()}`;
    
    const result = await sendTelegramInvoice(
      userId,
      `ПОКУПКА/АРЕНДА: ${item.make} ${item.model}`,
      `Товар: ${item.description || "Тактическое снаряжение"}`,
      invoicePayload,
      item.daily_price,
      0,
      item.image_url
    );

    if (!result.success) throw new Error(result.error);
    return { success: true, message: "Счет отправлен в Telegram." };
  } catch (e: any) {
    logger.error("Rent Gear Failed", e);
    return { success: false, error: e.message };
  }
}