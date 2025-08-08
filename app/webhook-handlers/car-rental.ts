import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => ["car_rental", "drop_anywhere", "sos_fuel", "sos_evac"].includes(invoice.type as string),
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const telegramBotLink = process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

    if (invoice.type === 'sos_fuel' || invoice.type === 'sos_evac') {
        const { rental_id, geotag } = metadata as { rental_id: string, geotag: any };
        
        await supabaseAdmin.from('events').insert({
            rental_id: rental_id,
            type: invoice.type,
            status: 'pending', // The trigger will notify the crew
            payload: { xtr_amount: totalAmount, reason: "User paid for SOS", geotag },
            created_by: userId
        });
        
        const renterMessage = `✅ Оплата принята! Ваш запрос на помощь отправлен экипажу. Ожидайте, они уже в пути!`;
        await sendComplexMessage(userId, renterMessage, [], {});
        return;
    }

    if (invoice.type === 'drop_anywhere') {
        const { rental_id } = metadata as { rental_id: string };
        const { data: eventData, error: eventError } = await supabaseAdmin
            .from('events')
            .insert({
                rental_id: rental_id,
                type: 'hustle_pickup',
                status: 'pending_geotag',
                payload: { xtr_amount: 100, reason: "User paid for drop anywhere" },
                created_by: userId
            })
            .select('id')
            .single();

        if (eventError || !eventData) {
            throw new Error(`Failed to create hustle event for rental ${rental_id}: ${eventError?.message}`);
        }

        await supabaseAdmin
            .from('user_states')
            .upsert({
                user_id: userId,
                state: 'awaiting_geotag',
                context: { rental_id: rental_id, event_id: eventData.id }
            });

        const renterMessage = `✅ Оплата принята! Теперь, пожалуйста, отправьте свою геолокацию через Telegram (Скрепка -> Геопозиция), чтобы экипаж знал, где забрать транспорт.`;
        await sendComplexMessage(userId, renterMessage, [], { imageQuery: metadata?.image_url });
        return;
    }

    if (invoice.type === 'car_rental') {
        const carId = metadata?.car_id;
        const rentalId = metadata?.rental_id;

        if (!carId || !rentalId) {
             throw new Error(`Critical: car_id or rental_id missing in invoice metadata for ID ${invoice.id}`);
        }

        const { data: vehicle, error: vehicleError } = await supabase
          .from("cars").select("owner_id, make, model, type").eq("id", carId).single();
        if (vehicleError) throw new Error(`Vehicle fetch error for ID ${carId}: ${vehicleError.message}`);
        if (!vehicle) throw new Error(`Vehicle with ID ${carId} not found.`);

        const { error: rentalUpdateError } = await supabase
            .from('rentals')
            .update({
                payment_status: 'interest_paid',
                metadata: { ...(metadata || {}), initial_invoice_id: invoice.id }
            })
            .eq('rental_id', rentalId);
        
        if (rentalUpdateError) throw new Error(`Failed to update rental record ${rentalId}: ${rentalUpdateError.message}`);

        const rentalManagementUrl = `${telegramBotLink}?startapp=rentals_${rentalId}`;
        const vehicleTypeString = vehicle.type === 'bike' ? 'байк' : 'автомобиль';

        const renterMessage = `✅ Оплата залога принята! Ваш интерес к аренде ${vehicleTypeString} **${vehicle.make} ${vehicle.model}** зафиксирован. Владелец уведомлен.\n\nНажмите кнопку ниже, чтобы открыть сделку и загрузить фото "ДО".`;
        await sendComplexMessage(userId, renterMessage, [[{ text: "🚀 Управлять Арендой", url: rentalManagementUrl }]], { imageQuery: metadata?.image_url });

        if (vehicle.owner_id) {
            const ownerMessage = `🔥 Новый запрос на аренду!\n\nПользователь @${userData.username || userId} оплатил залог за ваш ${vehicleTypeString} **${vehicle.make} ${vehicle.model}**.\n\nНажмите кнопку, чтобы открыть детали сделки и дождаться фото от арендатора.`;
            await sendComplexMessage(vehicle.owner_id, ownerMessage, [[{ text: "🔍 К Деталям Сделки", url: rentalManagementUrl }]], { imageQuery: metadata?.image_url });
        }
        
        const adminMessage = `🔔 Зафиксирована оплата залога: \n- **Транспорт:** ${vehicle.make} ${vehicle.model}\n- **Арендатор:** @${userData.username || userId}\n- **Владелец:** ${vehicle.owner_id}\n- **Сумма:** ${totalAmount} XTR`;
        await sendComplexMessage(adminChatId, adminMessage, []);
    }
  },
};