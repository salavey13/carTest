import type { WebhookHandler } from "./types";
import { sendTelegramMessage } from "../actions";
import { logger } from "@/lib/logger";
import { tourFeatureByKey, TOUR_FEATURE_KEYS } from "@/components/roman-gift/tourFeatures";

// app/webhook-handlers/feature-tour.ts — grants the ⭐ purchase of a BESTSELLER
// tour feature (task165). Payload family: featuretour_<key>_<userId>_<ts>,
// invoice type "feature_tour". Mirrors protocardPurchaseHandler's discipline:
// idempotent (the proxy refuses already-paid invoices), access grant BEFORE
// the invoice status flip (worst case: a re-run re-grants the same flag),
// user + admin notifications, honest error messages.

type PurchaseReceipt = {
  status: "active";
  price: string;
  transaction_id: string;
  purchased_at: string;
  feature_key: string;
  feature_title: string;
  crew_slug: string | null;
  applied: boolean;
};

export const featureTourHandler: WebhookHandler = {
  canHandle: (invoice, payload) =>
    invoice.type === "feature_tour" ||
    (typeof payload === "string" && payload.startsWith("featuretour_")),

  handle: async (invoice, userId, userData, totalAmountXTR, supabase, telegramToken, adminChatId, baseUrl) => {
    const featureKey = invoice.subscription_id;
    if (!featureKey || !TOUR_FEATURE_KEYS.has(featureKey)) {
      logger.error(`[FeatureTourHandler] Unknown feature key in invoice ${invoice.id}: ${featureKey}`);
      await sendTelegramMessage(
        telegramToken,
        `🚨 feature_tour: оплаченный инвойс ${invoice.id} указывает на неизвестную фичу «${featureKey}» (${totalAmountXTR} XTR от ${userId}) — разберись вручную.`,
        [],
        undefined,
        adminChatId,
      );
      return;
    }
    const feature = tourFeatureByKey(featureKey)!;

    try {
      // 1. Resolve the payer's crew NOW (they may have created/joined since
      //    the invoice was issued — the owner check must be payment-time).
      const { data: crewRow } = await supabase
        .from("crews")
        .select("id, slug")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const crew = crewRow ? { id: crewRow.id as string, slug: crewRow.slug as string } : null;

      // 2. Personal receipt (the hotvibes-style access record) — MERGE, the
      //    users.metadata carries unrelated config (cyberFitness, behavior…).
      const receipt: PurchaseReceipt = {
        status: "active",
        price: `${totalAmountXTR} XTR`,
        transaction_id: invoice.id,
        purchased_at: new Date().toISOString(),
        feature_key: featureKey,
        feature_title: feature.title,
        crew_slug: crew?.slug ?? null,
        applied: Boolean(crew),
      };
      const { data: userRow } = await supabase
        .from("users")
        .select("metadata")
        .eq("user_id", userId)
        .maybeSingle();
      const userMeta = ((userRow?.metadata || {}) as Record<string, unknown>);
      const purchases = { ...((userMeta.feature_tour_purchases || {}) as Record<string, PurchaseReceipt>), [featureKey]: receipt };
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ metadata: { ...userMeta, feature_tour_purchases: purchases } })
        .eq("user_id", userId);
      if (userUpdateError) {
        logger.error(`[FeatureTourHandler] Failed to write purchase receipt for ${userId}:`, userUpdateError);
      }

      // 3. The REAL item: paid activation for the payer's own crew.
      if (crew) {
        const { data: freshCrew } = await supabase
          .from("crews")
          .select("metadata")
          .eq("id", crew.id)
          .maybeSingle();
        const crewMeta = ((freshCrew?.metadata || {}) as Record<string, unknown>);
        const flags = { ...((crewMeta.feature_tour || {}) as Record<string, unknown>), [featureKey]: true };
        const { error: crewUpdateError } = await supabase
          .from("crews")
          .update({ metadata: { ...crewMeta, feature_tour: flags } })
          .eq("id", crew.id);
        if (crewUpdateError) {
          logger.error(`[FeatureTourHandler] Failed to activate ${featureKey} for crew ${crew.slug}:`, crewUpdateError);
          await sendTelegramMessage(
            telegramToken,
            `⚠️ Оплата прошла (${totalAmountXTR} XTR, ${feature.title}), но активация для экипажа ${crew.slug} не записалась. Чек сохранён — включится вручную.`,
            [],
            undefined,
            userId,
          );
          return; // invoice stays pending — the retry path re-grants cleanly
        }
      }

      // 4. Invoice → paid (grant already landed).
      await supabase
        .from("invoices")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", invoice.id)
        .neq("status", "paid");

      // 5. Notifications.
      const featureLink = `${baseUrl}${feature.href}`;
      const userMessage = crew
        ? `⭐ Оплачено: «${feature.title}» (${totalAmountXTR} XTR). Фича включена для экипажа ${crew.slug} — уже работает.\nСтраница фичи: ${featureLink}`
        : `⭐ Оплачено: «${feature.title}» (${totalAmountXTR} XTR). Фича закреплена за тобой: включится на экипаже, владельцем которого ты станешь, — или покажи этот чек экипажу VIP BIKE, подключим вручную.\nСтраница фичи: ${featureLink}`;
      await sendTelegramMessage(telegramToken, userMessage, [], undefined, userId);
      await sendTelegramMessage(
        telegramToken,
        `🔔 [XTR·tour] ${userData?.username || userId} (${userId}) оплатил «${feature.title}» за ${totalAmountXTR} XTR${crew ? ` → активировано для ${crew.slug}` : " → ваучер (без экипажа)"}. Инвойс: ${invoice.id}.`,
        [],
        undefined,
        adminChatId,
      );
    } catch (error) {
      logger.error(`[FeatureTourHandler] Critical error for invoice ${invoice.id}:`, error);
      await sendTelegramMessage(
        telegramToken,
        `🚨 КРИТИЧЕСКАЯ ОШИБКА обработки feature_tour платежа! Invoice: ${invoice.id}, User: ${userId}. Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [],
        undefined,
        adminChatId,
      );
    }
  },
};
