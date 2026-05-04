import { WebhookHandler } from "./types";
import { sendComplexMessage } from "./actions/sendComplexMessage";
import { retryFranchizeOrderNotification } from "@/app/franchize/actions";
import { ensureFranchizeOrderDocDelivery } from "./franchize-order-doc";

function formatMoney(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString("ru-RU")} ₽`;
}

function safeText(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export const franchizeOrderHandler: WebhookHandler = {
  canHandle: (invoice) => invoice.type === "franchize_order",
  handle: async (invoice, userId, userData, totalAmount, supabase, _telegramToken, adminChatId) => {
    const metadata = (invoice.metadata ?? {}) as Record<string, any>;
    const rentalId = typeof metadata.rental_id === "string" ? metadata.rental_id : undefined;
    const slug = typeof metadata.slug === "string" ? metadata.slug : "vip-bike";
    const orderId = typeof metadata.orderId === "string" ? metadata.orderId : undefined;

    if (!rentalId) {
      throw new Error(`franchize_order metadata missing rental_id for invoice ${invoice.id}`);
    }

    const firstItemId = metadata?.cartLines?.[0]?.itemId as string | undefined;
    if (!firstItemId) {
      throw new Error(`franchize_order metadata missing cart item for invoice ${invoice.id}`);
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("cars")
      .select("id, owner_id, make, model, image_url")
      .eq("id", firstItemId)
      .maybeSingle();

    if (vehicleError) {
      throw new Error(`franchize_order vehicle fetch failed: ${vehicleError.message}`);
    }

    if (!vehicle?.owner_id) {
      throw new Error(`franchize_order owner not found for vehicle ${firstItemId}`);
    }

    await ensureFranchizeOrderDocDelivery({
      supabase,
      slug,
      orderId,
      retry: retryFranchizeOrderNotification,
    });

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

    const documentKey = `${metadata.flowType === "sale" || metadata.flowType === "mixed" ? "sale" : "rental"}-${slug}-${orderId || ""}`;
    const sourceScope = `${metadata.flowType || "rental"}:${slug}:${orderId || ""}`;
    const { data: verifierRow } = await supabase
      .from("doc_verifier_records")
      .select("id, original_sha256")
      .eq("document_key", documentKey)
      .eq("integration_scope", sourceScope)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: persistedRental } = await supabase
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();

    const rentalMetadata = (persistedRental?.metadata ?? {}) as Record<string, any>;
    await supabase
      .from("rentals")
      .update({
        metadata: {
          ...rentalMetadata,
          contract_verifier: {
            scope: `rental:${rentalId}`,
            sourceScope,
            documentKey,
            docVerifierRecordId: verifierRow?.id ?? null,
            originalSha256: verifierRow?.original_sha256 ?? null,
            status: verifierRow?.id ? "verified" : "not_verified",
            verifiedAt: verifierRow?.id ? new Date().toISOString() : null,
            expiresAt: null,
          },
        },
      })
      .eq("rental_id", rentalId);

    const tgDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rental-${rentalId}`;
    const appLink = `https://v0-car-test.vercel.app/franchize/${slug}/rental/${rentalId}`;
    const catalogLink = `https://v0-car-test.vercel.app/franchize/${slug}`;

    const cartLines = Array.isArray(metadata.cartLines) ? metadata.cartLines : [];
    const extras = Array.isArray(metadata.extras) ? metadata.extras : [];
    const recipient = safeText(metadata.recipient);
    const phone = safeText(metadata.phone);
    const delivery = metadata.delivery === "delivery" ? "Доставка" : "Самовывоз";
    const slot = safeText(metadata.time);
    const comment = safeText(metadata.comment, "без комментария");
    const subtotalRub = Number(metadata.subtotal || 0);
    const extrasRub = Number(metadata.extrasTotal || 0);

    const cartText = cartLines.length
      ? cartLines
          .map((line: any) => {
            const title = safeText(line?.title || line?.itemId || "позиция");
            const qty = Number(line?.qty || 1);
            const pkg = safeText(line?.options?.package, "base");
            const duration = safeText(line?.options?.duration, "1d");
            const perk = safeText(line?.options?.perk, "none");
            return `• ${title} × ${qty} (${pkg}, ${duration}, ${perk})`;
          })
          .join("\n")
      : "• базовый пакет";

    const extrasText = extras.length
      ? extras.map((extra: any) => `• ${safeText(extra?.label)} (+${formatMoney(Number(extra?.price || 0))})`).join("\n")
      : "• без допов";

    const userMessage = [
      "🎉 You are in! Сделка подтверждена и стартует по-настоящему.",
      "",
      `🏍 Техника: ${vehicle.make} ${vehicle.model}`,
      `🆔 Rental: ${rentalId}`,
      `👤 Получатель: ${recipient}`,
      `📞 Телефон: ${phone}`,
      `🧭 Формат: ${delivery}`,
      `⏱ Слот: ${slot}`,
      `📝 Комментарий: ${comment}`,
      "",
      "🧺 Состав:",
      cartText,
      "",
      "✨ Допы:",
      extrasText,
      "",
      `💸 Subtotal: ${formatMoney(subtotalRub)}`,
      `💸 Extras: ${formatMoney(extrasRub)}`,
      `💸 Итого: ${formatMoney(totalRub)}`,
      `⭐ Подтверждение: ${interestStars} XTR`,
      "",
      "Нажми основную кнопку и продолжай оформление 🚀",
    ].join("\n");

    await sendComplexMessage(
      userId,
      userMessage,
      [
        [{ text: "🚀 Продолжить оформление", url: appLink }],
        [{ text: "📲 Открыть в Telegram WebApp", url: tgDeepLink }],
        [{ text: "🏁 К каталогу", url: catalogLink }],
      ],
      { imageQuery: `${vehicle.make} ${vehicle.model} motorcycle premium` },
    );

    await sendComplexMessage(
      vehicle.owner_id,
      `🔥 Новый горячий лид по франшизе ${slug}: @${userData.username || userId} оплатил 1% подтверждения за ${vehicle.make} ${vehicle.model}.\n` +
        `Сделка ${rentalId} готова к подтверждению следующего шага.`,
      [[{ text: "Открыть сделку", url: tgDeepLink }]],
      {},
    );

    await sendComplexMessage(
      adminChatId,
      `📌 Franchize order confirmed\nslug: ${slug}\nrental: ${rentalId}\nuser: @${userData.username || userId}\nvehicle: ${vehicle.make} ${vehicle.model}\nsubtotal: ${formatMoney(subtotalRub)}\nextras: ${formatMoney(extrasRub)}\ntotal: ${formatMoney(totalRub)}\ninterest: ${interestStars} XTR`,
      [[{ text: "Open rental", url: appLink }]],
      {},
    );
  },
};
