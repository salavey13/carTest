"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions"; 
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

const LISTING_FEE = 50; // 50 XTR to list an item

export async function getGearList() {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*, owner:users(username)")
      .in("type", ["gear", "weapon", "consumable", "loot"]) // Added 'loot'
      .order("daily_price", { ascending: true });

    if (error) {
        logger.error("Failed to fetch gear", error);
        return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
}

export async function rentGear(userId: string, gearId: string) {
  // ... existing rentGear code ...
  // (Assuming you want to keep the official rental logic for 'gear'/'weapon' types)
  try {
    const { data: item } = await supabaseAdmin.from("cars").select("*").eq("id", gearId).single();
    if (!item) throw new Error("Снаряжение не найдено.");

    const invoicePayload = `gear_rent_${gearId}_${Date.now()}`;
    const result = await sendTelegramInvoice(
      userId,
      `АРЕНДА: ${item.make} ${item.model}`,
      `Аренда: ${item.description || "Снаряжение"}`,
      invoicePayload,
      item.daily_price,
      0,
      item.image_url
    );

    if (!result.success) throw new Error(result.error);
    return { success: true, message: "Счет отправлен в Telegram." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- NEW: LOOT MARKET LOGIC ---

/**
 * Step 1: User pays to list an item.
 * We store the item details in metadata to insert AFTER payment.
 */
export async function payListingFee(userId: string, itemDetails: any) {
    try {
        // Encode item details into payload or store in temp table? 
        // Payload limit is small. Let's store in a 'pending_listings' table or just abuse 'user_states' metadata?
        // Actually, let's just trust the webhook metadata.
        
        const payload = `loot_list_${userId}_${Date.now()}`;
        
        // We pack the item details into the invoice metadata
        // Be careful with size limits, keep descriptions short in metadata
        const metadata = {
            action: 'list_loot',
            make: itemDetails.make,
            model: itemDetails.model,
            price: itemDetails.price,
            description: itemDetails.description,
            image_url: itemDetails.image_url
        };

        const result = await sendTelegramInvoice(
            userId,
            `РАЗМЕЩЕНИЕ: ${itemDetails.model}`,
            `Комиссия за объявление на Барахолке.`,
            payload,
            LISTING_FEE, 
            0,
            itemDetails.image_url
        );
        
        // We need to pass the metadata to the invoice creation manually if sendTelegramInvoice doesn't support it fully yet
        // Assuming your core createInvoice supports metadata update after creation or during creation if wired up.
        // Quick fix: Update the invoice record immediately after sending
        if (result.success) {
             await supabaseAdmin.from("invoices").update({ metadata }).eq("id", payload);
        }

        if (!result.success) throw new Error(result.error);
        return { success: true, message: "Счет на оплату комиссии отправлен." };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Step 2: Buyer contacts Seller.
 */
export async function contactSeller(buyerId: string, itemId: string) {
    try {
        const { data: item } = await supabaseAdmin.from("cars").select("*, owner:users(username, user_id)").eq("id", itemId).single();
        if (!item || !item.owner_id) throw new Error("Продавец не найден");

        const { data: buyer } = await supabaseAdmin.from("users").select("username").eq("user_id", buyerId).single();
        const buyerName = buyer?.username ? `@${buyer.username}` : "Покупатель";

        // Notify Seller
        await sendComplexMessage(
            item.owner_id,
            `💰 **НОВЫЙ ПОКУПАТЕЛЬ!**\n\nБоец ${buyerName} интересуется вашим лотом: **${item.make} ${item.model}** (${item.daily_price} RUB).\n\nСвяжитесь с ним для сделки.`
        );
        
        // Notify Buyer
        // Also send seller contact to buyer
        // const sellerLink = item.owner.username ? `https://t.me/${item.owner.username}` : "tg://user?id=" + item.owner_id;
        
        return { success: true, message: "Запрос отправлен продавцу!" };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getUserPurchases(userId: string) {
    if (!userId) return { success: false, data: [] };
    try {
        const { data, error } = await supabaseAdmin
            .from("user_purchases")
            .select("*")
            .eq("user_id", userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}