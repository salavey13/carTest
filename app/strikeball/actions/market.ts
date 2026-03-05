"use server";

import { supabaseAnon, fetchUserData } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions"; 
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

const LISTING_FEE = 50; // 50 XTR to list an item

export async function getGearList() {
    // 1. Fetch all items (No Join)
    const { data, error } = await supabaseAnon
      .from("cars")
      .select("*")
      .in("type", ["gear", "weapon", "consumable", "loot"]) 
      .order("daily_price", { ascending: true });

    if (error) {
        logger.error("Failed to fetch gear", error);
        return { success: false, error: error.message };
    }

    if (!data || data.length === 0) return { success: true, data: [] };

    // 2. Extract Owner IDs for 'loot' items
    const ownerIds = Array.from(new Set(
        data
            .filter((item) => item.type === 'loot' && item.owner_id)
            .map((item) => item.owner_id)
    ));

    // 3. Fetch Usernames manually
    let userMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
        const { data: users, error: userError } = await supabaseAnon
            .from("users")
            .select("user_id, username")
            .in("user_id", ownerIds);
        
        if (!userError && users) {
            users.forEach((u: any) => {
                userMap[u.user_id] = u.username || "Unknown";
            });
        }
    }

    // 4. Merge Data
    const enrichedData = data.map((item) => {
        if (item.type === 'loot' && item.owner_id) {
            return {
                ...item,
                owner: { username: userMap[item.owner_id] }
            };
        }
        return item;
    });

    return { success: true, data: enrichedData };
}

export async function rentGear(userId: string, gearId: string) {
  try {
    const { data: item } = await supabaseAnon.from("cars").select("*").eq("id", gearId).single();
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

// --- LOOT MARKET LOGIC ---

export async function payListingFee(userId: string, itemDetails: any) {
    try {
        const payload = `loot_list_${userId}_${Date.now()}`;
        
        // We pack the item details into the invoice metadata
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
        
        if (result.success) {
             await supabaseAnon.from("invoices").update({ metadata }).eq("id", payload);
        }

        if (!result.success) throw new Error(result.error);
        return { success: true, message: "Счет на оплату комиссии отправлен." };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function contactSeller(buyerId: string, itemId: string) {
    try {
        // Fetch item first
        const { data: item } = await supabaseAnon.from("cars").select("*").eq("id", itemId).single();
        if (!item || !item.owner_id) throw new Error("Продавец не найден");

        // Fetch Buyer Name
        const { data: buyer } = await supabaseAnon.from("users").select("username").eq("user_id", buyerId).single();
        const buyerName = buyer?.username ? `@${buyer.username}` : "Покупатель";

        // Notify Seller
        await sendComplexMessage(
            item.owner_id,
            `💰 **НОВЫЙ ПОКУПАТЕЛЬ!**\n\nБоец ${buyerName} интересуется вашим лотом: **${item.make} ${item.model}** (${item.daily_price} RUB).\n\nСвяжитесь с ним для сделки.`
        );
        
        return { success: true, message: "Запрос отправлен продавцу!" };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getUserPurchases(userId: string) {
    if (!userId) return { success: false, data: [] };
    try {
        const { data, error } = await supabaseAnon
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