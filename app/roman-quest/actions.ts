"use server";

// app/roman-quest/actions.ts — REAL Telegram-Stars (XTR) payments for the
// BESTSELLER feature tour (task165, boss: «add real xtr payments … i already
// tryed to implement gated by xtr access to items - think how to implement
// properly and go!»).
//
// The proper implementation follows the two in-repo precedents:
//   • donation (components/DonationComponent + sendDonationInvoice): a real
//     sendInvoice with currency XTR lands in the payer's Telegram chat —
//     they pay inside Telegram, no card forms on the web side;
//   • hotvibes ProtoCards (purchaseProtoCardAction + protocardPurchaseHandler):
//     the item access is GATED by the payment — a pending invoice row, the
//     webhook grants access idempotently on successful_payment.
//
// Item semantics for the tour: the ⭐ price buys the feature ACTIVATION
// voucher. The webhook (app/webhook-handlers/feature-tour.ts) grants:
//   • payer owns a crew → crews.metadata.feature_tour[key] = true (paid
//     activation — the real item) + personal receipt;
//   • payer has no crew (yet) → personal receipt only — a claimable voucher
//     that the activations API surfaces the moment they own a crew.
// Owners never see the ⭐ button (their checkbox is free) — but an owner who
// paid as a guest earlier gets the voucher applied automatically.

import { cookies } from "next/headers";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendTelegramInvoice } from "@/app/actions";
import { tourFeatureByKey, TOUR_FEATURE_KEYS } from "@/components/roman-gift/tourFeatures";

export type TourPurchaseResult =
  | { success: true; invoiceId: string; priceStars: number }
  | { success: false; error: "unauthorized" | "bad-feature-key" | "free-feature" | "already-owned" | "invoice-failed" | "db-failed"; message?: string };

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

async function sessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyTelegramActorCookieValue(
    cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
  );
}

async function ownedCrewSlug(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("crews")
    .select("slug")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
}

export async function purchaseTourFeatureAction(
  featureKey: string,
): Promise<TourPurchaseResult> {
  try {
    const userId = await sessionUserId();
    if (!userId) {
      return { success: false, error: "unauthorized", message: "Зайдите через Telegram — счёт приходит туда же." };
    }
    if (!featureKey || !TOUR_FEATURE_KEYS.has(featureKey)) {
      return { success: false, error: "bad-feature-key" };
    }
    const feature = tourFeatureByKey(featureKey)!;
    if (feature.priceStars <= 0) {
      return { success: false, error: "free-feature" };
    }

    // Already owned (voucher active) → honest no-op, no second charge.
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle();
    const meta = (userRow?.metadata || {}) as Record<string, unknown>;
    const purchases = (meta.feature_tour_purchases || {}) as Record<string, PurchaseReceipt>;
    if (purchases[featureKey]?.status === "active") {
      return { success: false, error: "already-owned", message: "Эта фича уже оплачена — чек в вашем Telegram." };
    }

    const crewSlug = await ownedCrewSlug(userId);
    if (crewSlug) {
      // Owners activate freely via the checkboxes — paying for their own crew
      // makes no sense; steer them back to the free path.
      return { success: false, error: "already-owned", message: `Для экипажа ${crewSlug} фича включается бесплатно — галочкой владельца.` };
    }

    const payload = `featuretour_${featureKey}_${userId}_${Date.now()}`;
    const title = `VIP BIKE: ${feature.title}`.slice(0, 32);
    const description = `${feature.gives} Оплата звёздами Telegram.`.slice(0, 255);

    // Pending invoice row first — the webhook handler reads its metadata
    // (sendTelegramInvoice skips its own bare insert when the row exists).
    const { data: created, error: dbError } = await supabaseAdmin
      .from("invoices")
      .insert({
        id: payload,
        user_id: userId,
        type: "feature_tour",
        amount: feature.priceStars,
        status: "pending",
        currency: "XTR",
        subscription_id: featureKey,
        metadata: {
          feature_key: featureKey,
          feature_title: feature.title,
          feature_href: feature.href,
          feature_gives: feature.gives,
          crew_slug: null,
        },
      })
      .select("id")
      .single();
    if (dbError || !created) {
      return { success: false, error: "db-failed" };
    }

    const sent = await sendTelegramInvoice(userId, title, description, payload, feature.priceStars, 0, undefined);
    if (!sent.success) {
      return { success: false, error: "invoice-failed", message: "Telegram не принял счёт — попробуйте ещё раз." };
    }
    return { success: true, invoiceId: payload, priceStars: feature.priceStars };
  } catch {
    return { success: false, error: "invoice-failed", message: "Не получилось отправить счёт — попробуйте ещё раз." };
  }
}
