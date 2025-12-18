import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";

export const qrMerchantHandler: WebhookHandler = {
  canHandle: (invoice) => {
      if (invoice.type === 'gear_buy' || invoice.type === 'loot_list') return true; // Added loot_list
      if (typeof invoice.id === 'string' && (invoice.id.startsWith("gear_buy_") || invoice.id.startsWith("loot_list_"))) return true;
      return false;
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata || {};

    // --- CASE 1: LISTING FEE PAID (CREATE LOOT ITEM) ---
    if (invoice.type === 'loot_list' || (typeof invoice.id === 'string' && invoice.id.startsWith('loot_list_'))) {
        const { make, model, price, description, image_url } = metadata;
        
        // Insert into 'cars' table with type='loot'
        const itemId = `loot-${userId}-${Date.now()}`;
        const { error } = await supabase.from("cars").insert({
            id: itemId,
            owner_id: userId,
            make: make || "Custom",
            model: model || "Loot",
            description: description || "",
            daily_price: price, // Selling price
            image_url: image_url || "",
            type: "loot",
            quantity: 1
        });

        if (error) {
            console.error("Failed to create loot item:", error);
            await sendComplexMessage(userId, "❌ Ошибка при создании лота. Обратитесь к админу.");
        } else {
            await sendComplexMessage(userId, `✅ **ЛОТ РАЗМЕЩЕН!**\n\n**${make} ${model}** теперь виден на Барахолке.\nЦена: ${price} RUB.`);
            // Notify Admin
            await sendComplexMessage(adminChatId, `📢 **НОВЫЙ ЛОТ НА БАРАХОЛКЕ**\nЮзер: ${userId}\nТовар: ${model}\nЦена: ${price}`);
        }
        return;
    }

    // --- CASE 2: BUYING GEAR (STANDARD SHOP) ---
    
     const gearId = metadata.gear_id || invoice.id.split('_')[2]; 
    
    // 1. Fetch Item
    const { data: item, error: itemError } = await supabase
        .from("cars") 
        .select("*")
        .eq("id", gearId)
        .single();

    if (itemError || !item) {
        throw new Error(`Gear item not found: ${gearId}`);
    }

    // 2. Decrement Stock
    const currentStock = parseInt(item.quantity || "0");
    if (currentStock > 0) {
        await supabase.from("cars").update({ quantity: currentStock - 1 }).eq("id", gearId);
    }

    // 3. LOG PURCHASE
    const { error: purchaseError } = await supabase.from("user_purchases").insert({
        user_id: userId,
        item_id: gearId,
        total_price: totalAmount,
        status: 'paid',
        metadata: { 
            item_name: `${item.make} ${item.model}`,
            item_type: item.type,
            image_url: item.image_url
        }
    });

    // 4. Notify User
    const message = `✅ **ОПЛАТА ПРИНЯТА**\n\nВы приобрели: **${item.make} ${item.model}**\nСписано: **${totalAmount} XTR**\n\n📦 **ТОВАР ДОБАВЛЕН В ИНВЕНТАРЬ**\nПокажите этот экран или QR код из профиля администратору.`;
    
    await sendComplexMessage(userId, message, [], { imageQuery: item.image_url });

    // 5. Notify Owner
    if (item.owner_id) {
        await sendComplexMessage(item.owner_id, `💰 **ПРОДАЖА СО СКЛАДА**\nБоец @${userData.username || userId} купил ${item.make} ${item.model}.\nОстаток: ${currentStock - 1}`);
    }
  },
};