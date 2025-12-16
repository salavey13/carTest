import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";

export const qrMerchantHandler: WebhookHandler = {
  canHandle: (invoice) => {
      // Check for legacy string prefix OR structured metadata type
      if (invoice.type === 'gear_buy') return true;
      if (typeof invoice.id === 'string' && invoice.id.startsWith("gear_buy_")) return true;
      return false;
  },

  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata || {};
    const gearId = metadata.gear_id || invoice.id.split('_')[2]; // Fallback for legacy ID format
    
    // 1. Fetch Item
    const { data: item, error: itemError } = await supabase
        .from("cars") // Using 'cars' table for gear
        .select("*")
        .eq("id", gearId)
        .single();

    if (itemError || !item) {
        throw new Error(`Gear item not found: ${gearId}`);
    }

    // 2. Decrement Stock (if tracked)
    // Assuming 'quantity' column handles stock.
    const currentStock = parseInt(item.quantity || "0");
    if (currentStock > 0) {
        await supabase
            .from("cars")
            .update({ quantity: currentStock - 1 })
            .eq("id", gearId);
    }

    // 3. Log Purchase (Optional: separate table or just invoice history)
    // For now, invoice history is enough proof.

    // 4. Notify User (The "Digital Receipt")
    const message = `✅ **ОПЛАТА ПРИНЯТА**\n\nВы приобрели: **${item.make} ${item.model}**\nСписано: **${totalAmount} XTR**\n\n🔻 **ИНСТРУКЦИЯ:**\nПокажите этот экран администратору или возьмите предмет из ящика самостоятельно (если разрешено).`;
    
    await sendComplexMessage(
        userId, 
        message, 
        [], 
        { imageQuery: item.image_url }
    );

    // 5. Notify Owner (Admin)
    if (item.owner_id) {
        await sendComplexMessage(
            item.owner_id,
            `💰 **ПРОДАЖА СО СКЛАДА**\nБоец @${userData.username || userId} купил ${item.make} ${item.model}.\nОстаток: ${currentStock - 1}`
        );
    }
  },
};