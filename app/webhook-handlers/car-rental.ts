import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { escapeMarkdown } from "@/lib/utils";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => ["car_rental", "drop_anywhere", "sos_fuel", "sos_evac"].includes(invoice.type as string),
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const telegramBotLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
    const rentalId = metadata?.rental_id; // Extract rental_id from metadata for SOS/Hustle

    // --- SOS & HUSTLE FLOWS ---
    if (["sos_fuel", "sos_evac", "drop_anywhere"].includes(invoice.type as string)) {
        if (!rentalId) throw new Error(`Missing rental_id in metadata for invoice type ${invoice.type}`);

        let eventType: string;
        let userState: string | null = null;
        let renterMessage: string;

        if (invoice.type === 'drop_anywhere') {
            eventType = 'hustle_pickup';
            userState = 'awaiting_geotag';
            renterMessage = `✅ Оплата принята! Теперь, пожалуйста, отправьте свою геолокацию через Telegram (Скрепка -> Геопозиция), чтобы экипаж знал, где забрать транспорт.`;
        } else { // sos_fuel or sos_evac
            eventType = invoice.type;
            renterMessage = `✅ Оплата за ${invoice.type === 'sos_fuel' ? 'доставку топлива' : 'эвакуацию'} принята. Владелец и экипаж уведомлены и уже спешат на помощь!`;
        }

        const { error: eventError } = await supabaseAdmin.from('events').insert({
            rental_id: rentalId,
            type: eventType,
            status: userState ? 'pending_geotag' : 'pending',
            payload: { xtr_amount: totalAmount, reason: `User paid for ${invoice.type}` },
            created_by: userId
        });
        if (eventError) throw new Error(`Failed to create ${eventType} event for rental ${rentalId}: ${eventError.message}`);

        if (userState) {
            await supabaseAdmin.from('user_states').upsert({
                user_id: userId, state: userState, context: { rental_id: rentalId }
            });
        }
        
        await sendTelegramMessage(renterMessage, [], metadata.image_url, userId);
        return;
    }

    // --- Original car_rental logic ---
    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars").select("owner_id, make, model, type").eq("id", metadata.car_id).single();
    if (vehicleError) throw new Error(`Vehicle fetch error for ID ${metadata.car_id}: ${vehicleError.message}`);
    if (!vehicle) throw new Error(`Vehicle with ID ${metadata.car_id} not found.`);

    const { data: newRental, error: rentalError } = await supabase
        .from('rentals').insert({
            user_id: userId, vehicle_id: metadata.car_id, owner_id: vehicle.owner_id,
            status: 'pending_confirmation', payment_status: 'interest_paid', interest_amount: totalAmount,
            metadata: { initial_invoice_id: invoice.id, requested_days: metadata.days, event_ids: [] }
        }).select('rental_id').single();
    if (rentalError) throw new Error(`Failed to create rental record: ${rentalError.message}`);

    const rentalManagementUrl = `${telegramBotLink}?startapp=rental_view_${newRental.rental_id}`;
    const vehicleTypeString = vehicle.type === 'bike' ? 'байк' : 'автомобиль';
    
    const carMake = escapeMarkdown(metadata.car_make);
    const carModel = escapeMarkdown(metadata.car_model);
    const username = escapeMarkdown(userData.username || userId);

    const renterMessage = `✅ Ваш интерес к аренде ${vehicleTypeString} *${carMake} ${carModel}* зафиксирован! Владелец уведомлен.\n\nНажмите кнопку ниже, чтобы открыть сделку.`;
    await sendTelegramMessage(renterMessage, [{ text: "Управлять Арендой", url: rentalManagementUrl }], metadata.image_url, userId);

    if (vehicle.owner_id) {
        const ownerMessage = `🔥 Новый запрос на аренду!\n\nПользователь @${username} оплатил интерес к вашему ${vehicleTypeString} *${carMake} ${carModel}*.\n\nНажмите кнопку, чтобы открыть детали сделки.`;
        await sendTelegramMessage(ownerMessage, [{ text: "К Деталям Сделки", url: rentalManagementUrl }], metadata.image_url, vehicle.owner_id);
    }
    const adminMessage = `🔔 Зафиксирован интерес к аренде: \n- *Транспорт:* ${carMake} ${carModel}\n- *Арендатор:* @${username}\n- *Владелец:* ${vehicle.owner_id}\n- *Сумма интереса:* ${totalAmount} XTR`;
    await sendTelegramMessage(adminMessage, [], undefined, adminChatId);
  },
};