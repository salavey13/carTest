// /app/webhook-handlers/car-rental.ts
import { WebhookHandler } from "./types";
import { sendTelegramMessage, notifyAdmin } from "../actions";

export const carRentalHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "car_rental",
  handle: async (invoice, userId, userData, totalAmount, supabase, telegramToken, adminChatId, baseUrl) => {
    const metadata = invoice.metadata;
    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("owner_id, make, model, image_url")
      .eq("id", metadata.car_id)
      .single();

    if (carError) throw new Error(`Car fetch error: ${carError.message}`);

    await sendTelegramMessage(
      telegramToken,
      `🎉 Оплата аренды автомобиля ${metadata.car_make} ${metadata.car_model} прошла успешно!`,
      [{ text: "View Rental", url: `${baseUrl}/rent/${metadata.car_id}` }],
      undefined,
      userId
    );

    await notifyAdmin(
      metadata.car_id,
      `Вашу ${car.make} ${car.model} арендовал ${userData.username || userData.user_id}!`
    );

    await sendTelegramMessage(
      telegramToken,
      `🔔 Пользователь ${userData.username || userData.user_id} арендовал автомобиль ${car.make} ${car.model}.`,
      [],
      undefined,
      adminChatId
    );
  },
};
