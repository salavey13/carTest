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

export async function rentGear(userId: string, gearId: string) {
  try {
    const { data: item } = await supabaseAdmin.from("cars").select("*").eq("id", gearId).single();
    if (!item) throw new Error("Снаряжение не найдено.");

    const invoicePayload = `gear_rent_${gearId}_${Date.now()}`;
    
    const result = await sendTelegramInvoice(
      userId,
      `АРСЕНАЛ: ${item.make} ${item.model}`,
      `Аренда: ${item.description || "Секретное оборудование"}`,
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