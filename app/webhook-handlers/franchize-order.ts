import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";

export const franchizeOrderHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "franchize_order",
  handle: async (invoice, userId, userData, totalAmount, supabase, _telegramToken, adminChatId) => {
    const metadata = (invoice.metadata ?? {}) as Record<string, any>;
    const rentalId = typeof metadata.rental_id === "string" ? metadata.rental_id : undefined;
    const slug = typeof metadata.slug === "string" ? metadata.slug : "vip-bike";

    if (!rentalId) {
      throw new Error(`franchize_order metadata missing rental_id for invoice ${invoice.id}`);
    }

    const firstItemId = metadata?.cartLines?.[0]?.itemId as string | undefined;
    if (!firstItemId) {
      throw new Error(`franchize_order metadata missing cart item for invoice ${invoice.id}`);
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars")
      .select("id, owner_id, make, model")
      .eq("id", firstItemId)
      .maybeSingle();

    if (vehicleError) {
      throw new Error(`franchize_order vehicle fetch failed: ${vehicleError.message}`);
    }

    if (!vehicle?.owner_id) {
      throw new Error(`franchize_order owner not found for vehicle ${firstItemId}`);
    }

    const totalRub = Number(metadata.totalAmount || metadata.subtotal || 0);
    const interestStars = Number(metadata.amountXtr || totalAmount || 0);

    const { error: upsertError } = await supabase.from("rentals").upsert(
      {
        rental_id: rentalId,
        user_id: userId,
        vehicle_id: vehicle.id,
        owner_id: vehicle.owner_id,
        status: "confirmed",
        payment_status: "interest_paid",
        interest_amount: interestStars,
        total_cost: totalRub,
        metadata: {
          ...(metadata || {}),
          source: "franchize_order",
          franchise_slug: slug,
          hot_client: true,
          invoice_id: invoice.id,
        },
      },
      { onConflict: "rental_id" },
    );

    if (upsertError) {
      throw new Error(`franchize_order rental upsert failed: ${upsertError.message}`);
    }

    const tgDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rental-${rentalId}`;
    const appLink = `https://v0-car-test.vercel.app/franchize/${slug}/rental/${rentalId}`;

    await sendComplexMessage(
      userId,
      `✅ Оплата подтверждения принята! Ты теперь hot client для ${vehicle.make} ${vehicle.model}.\n\nОткрой карточку сделки и продолжай flow:`,
      [[
        { text: "🚀 Открыть сделку (WebApp)", url: tgDeepLink },
        { text: "🌐 Franchize rental", url: appLink },
      ]],
      {},
    );

    await sendComplexMessage(
      vehicle.owner_id,
      `🔥 Новый горячий лид по франшизе ${slug}: @${userData.username || userId} оплатил 1% подтверждения за ${vehicle.make} ${vehicle.model}.`,
      [[{ text: "Открыть сделку", url: tgDeepLink }]],
      {},
    );

    await sendComplexMessage(
      adminChatId,
      `📌 Franchize order confirmed\nslug: ${slug}\nrental: ${rentalId}\nuser: @${userData.username || userId}\nvehicle: ${vehicle.make} ${vehicle.model}\ntotal: ${totalRub} ₽\ninterest: ${interestStars} XTR`,
      [[{ text: "Open rental", url: appLink }]],
      {},
    );
  },
};
