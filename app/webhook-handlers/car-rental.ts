import { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "car_rental",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const telegramBotLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneSitePlsBot/app";
    
    // 1. Fetch vehicle data including the owner_id
    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars")
      .select("owner_id, make, model, type")
      .eq("id", metadata.car_id)
      .single();

    if (vehicleError) {
      throw new Error(`Vehicle fetch error for ID ${metadata.car_id}: ${vehicleError.message}`);
    }
    if (!vehicle) {
        throw new Error(`Vehicle with ID ${metadata.car_id} not found.`);
    }

    // 2. Create a new entry in the 'rentals' table
    const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
            user_id: userId,
            vehicle_id: metadata.car_id,
            owner_id: vehicle.owner_id,
            status: 'pending_confirmation',
            payment_status: 'interest_paid',
            interest_amount: totalAmount,
            metadata: {
                initial_invoice_id: invoice.id,
                requested_days: metadata.days,
            }
        })
        .select('rental_id')
        .single();
    
    if (rentalError) {
        throw new Error(`Failed to create rental record: ${rentalError.message}`);
    }

    const rentalManagementUrl = `${telegramBotLink}?startapp=rental_${rental.rental_id}`;
    const vehicleTypeString = vehicle.type === 'bike' ? 'байк' : 'автомобиль';

    // 3. Notify the Renter (user who paid)
    const renterMessage = `✅ Ваш интерес к аренде ${vehicleTypeString} **${metadata.car_make} ${metadata.car_model}** зафиксирован! Владелец уведомлен.\n\nНажмите кнопку ниже, чтобы открыть сделку.`;
    await sendTelegramMessage(
        renterMessage,
        [{ text: "Управлять Арендой", url: rentalManagementUrl }],
        metadata.image_url,
        userId
    );

    // 4. Notify the Owner
    if (vehicle.owner_id) {
        const ownerMessage = `🔥 Новый запрос на аренду!\n\nПользователь @${userData.username || userId} оплатил интерес к вашему ${vehicleTypeString} **${metadata.car_make} ${metadata.car_model}**.\n\nНажмите кнопку, чтобы открыть детали сделки.`;
        await sendTelegramMessage(
            ownerMessage,
            [{ text: "К Деталям Сделки", url: rentalManagementUrl }],
            metadata.image_url,
            vehicle.owner_id,
        );
    }

    // 5. Notify the Admin (optional, can be commented out)
    const adminMessage = `🔔 Зафиксирован интерес к аренде: \n- **Транспорт:** ${metadata.car_make} ${metadata.car_model}\n- **Арендатор:** @${userData.username || userId}\n- **Владелец:** ${vehicle.owner_id}\n- **Сумма интереса:** ${totalAmount} XTR`;
    await sendTelegramMessage(adminMessage, [], undefined, adminChatId);
  },
};