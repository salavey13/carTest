import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { supabaseAdmin } from "@/hooks/supabase";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => ["car_rental", "hustle_dropoff"].includes(invoice.type || ''),
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const telegramBotLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
    
    // Handle "Drop Anywhere" Hustle Payment
    if (invoice.type === 'hustle_dropoff') {
        const { rental_id } = metadata;
        if (!rental_id) throw new Error("hustle_dropoff invoice is missing rental_id in metadata");

        // 1. Create the `hustle_pickup` event
        await supabase.from('events').insert({
            rental_id: rental_id,
            type: 'hustle_pickup',
            status: 'pending_geotag', // Awaiting user's location
            payload: { xtr_amount: 100, reason: "User paid for drop-off" }, // Bounty for the crew
            created_by: userId
        });

        // 2. Set user state to await geotag
        await supabase.from('user_states').upsert({
            user_id: userId,
            state: 'awaiting_geotag',
            context: { rental_id: rental_id }
        });

        // 3. Notify renter with instructions
        const instructions = "✅ Оплата принята! Теперь, пожалуйста, отправьте вашу геолокацию (Прикрепить -> Геопозиция), чтобы экипаж мог забрать транспорт.";
        await sendTelegramMessage(instructions, [], undefined, userId);
        return;
    }

    // --- Original Car Rental Interest Flow ---
    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars")
      .select("owner_id, make, model, type")
      .eq("id", metadata.car_id)
      .single();

    if (vehicleError) throw new Error(`Vehicle fetch error for ID ${metadata.car_id}: ${vehicleError.message}`);
    if (!vehicle) throw new Error(`Vehicle with ID ${metadata.car_id} not found.`);

    const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
            user_id: userId,
            vehicle_id: metadata.car_id,
            owner_id: vehicle.owner_id,
            status: 'pending_confirmation',
            payment_status: 'interest_paid',
            interest_amount: totalAmount,
            metadata: { event_ids: [] } // Initialize with empty event_ids
        })
        .select('rental_id')
        .single();
    
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