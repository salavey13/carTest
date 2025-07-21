import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { supabaseAdmin } from "@/hooks/supabase";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => ["car_rental", "drop_anywhere", "sos_fuel", "sos_evac"].includes(invoice.type as string),
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const telegramBotLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

    if (invoice.type === 'sos_fuel' || invoice.type === 'sos_evac') {
        const { rental_id, geotag } = metadata;
        
        await supabaseAdmin.from('events').insert({
            rental_id: rental_id,
            type: invoice.type,
            status: 'pending', // The trigger will notify the crew
            payload: { xtr_amount: totalAmount, reason: "User paid for SOS", geotag },
            created_by: userId
        });
        
        const renterMessage = `✅ Оплата принята! Ваш запрос на помощь отправлен экипажу. Ожидайте, они уже в пути!`;
        await sendTelegramMessage(renterMessage, [], undefined, userId);
        return;
    }

    if (invoice.type === 'drop_anywhere') {
        const { rental_id } = metadata;
        // 1. Create a "hustle_pickup" event
        const { data: eventData, error: eventError } = await supabaseAdmin
            .from('events')
            .insert({
                rental_id: rental_id,
                type: 'hustle_pickup',
                status: 'pending_geotag', // Awaiting location from user
                payload: { xtr_amount: 100, reason: "User paid for drop anywhere" },
                created_by: userId
            })
            .select('id')
            .single();

        if (eventError || !eventData) {
            throw new Error(`Failed to create hustle event for rental ${rental_id}: ${eventError?.message}`);
        }

        // 2. Put user in a state to await their location
        await supabaseAdmin
            .from('user_states')
            .upsert({
                user_id: userId,
                state: 'awaiting_geotag',
                context: { rental_id: rental_id, event_id: eventData.id }
            });

        // 3. Instruct the user
        const renterMessage = `✅ Оплата принята! Теперь, пожалуйста, отправьте свою геолокацию через Telegram (Скрепка -> Геопозиция), чтобы экипаж знал, где забрать транспорт.`;
        await sendTelegramMessage(renterMessage, [], metadata.image_url, userId);
        return;
    }

    // --- Original car_rental logic ---
    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars").select("owner_id, make, model, type").eq("id", metadata.car_id).single();
    if (vehicleError) throw new Error(`Vehicle fetch error for ID ${metadata.car_id}: ${vehicleError.message}`);
    if (!vehicle) throw new Error(`Vehicle with ID ${metadata.car_id} not found.`);

    const { data: rental, error: rentalError } = await supabase
        .from('rentals').insert({
            user_id: userId, vehicle_id: metadata.car_id, owner_id: vehicle.owner_id,
            status: 'pending_confirmation', payment_status: 'interest_paid', interest_amount: totalAmount,
            metadata: { initial_invoice_id: invoice.id, requested_days: metadata.days, event_ids: [] }
        }).select('rental_id').single();
    if (rentalError) throw new Error(`Failed to create rental record: ${rentalError.message}`);

    const rentalManagementUrl = `${telegramBotLink}?startapp=rental_view_${rental.rental_id}`;
    const vehicleTypeString = vehicle.type === 'bike' ? 'байк' : 'автомобиль';

    const renterMessage = `✅ Ваш интерес к аренде ${vehicleTypeString} **${metadata.car_make} ${metadata.car_model}** зафиксирован! Владелец уведомлен.\n\nНажмите кнопку ниже, чтобы открыть сделку.`;
    await sendTelegramMessage(renterMessage, [{ text: "Управлять Арендой", url: rentalManagementUrl }], metadata.image_url, userId);

    if (vehicle.owner_id) {
        const ownerMessage = `🔥 Новый запрос на аренду!\n\nПользователь @${userData.username || userId} оплатил интерес к вашему ${vehicleTypeString} **${metadata.car_make} ${metadata.car_model}**.\n\nНажмите кнопку, чтобы открыть детали сделки.`;
        await sendTelegramMessage(ownerMessage, [{ text: "К Деталям Сделки", url: rentalManagementUrl }], metadata.image_url, vehicle.owner_id);
    }
    const adminMessage = `🔔 Зафиксирован интерес к аренде: \n- **Транспорт:** ${metadata.car_make} ${metadata.car_model}\n- **Арендатор:** @${userData.username || userId}\n- **Владелец:** ${vehicle.owner_id}\n- **Сумма интереса:** ${totalAmount} XTR`;
    await sendTelegramMessage(adminMessage, [], undefined, adminChatId);
  },
};