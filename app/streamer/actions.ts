"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import { randomUUID } from "crypto";

/**
 * Canonical tiers & sku pricing (server-side authoritative)
 */
const CANONICAL_TIERS: Record<string, number> = {
  tip: 50,
  supporter: 150,
  vip: 300,
  sauna: 500,
};

const SKU_TO_PRICE: Record<string, number> = {
  sauna_pack: 500,
  flipflops: 200,
  towel: 150,
};

function normalizeInvoicePayload(amount: number, metadata: any = {}) {
  const meta = { ...(metadata || {}) };

  // prefer explicit tierId if present
  if (meta.tierId && CANONICAL_TIERS[meta.tierId]) {
    const canonical = CANONICAL_TIERS[meta.tierId];
    if (Number(amount) !== canonical) {
      logger.warn("[createStreamerInvoice] amount mismatch with tierId, overriding client amount", { clientAmount: amount, tierId: meta.tierId, canonical });
      amount = canonical;
    }
  }

  // sku mapping (market items)
  if (meta.sku && SKU_TO_PRICE[meta.sku]) {
    const skuPrice = SKU_TO_PRICE[meta.sku];
    if (Number(amount) !== skuPrice) {
      logger.warn("[createStreamerInvoice] amount mismatch with sku, overriding client amount", { clientAmount: amount, sku: meta.sku, skuPrice });
      amount = skuPrice;
      // if sku corresponds to canonical tier, propagate tierId
      if (meta.sku === "sauna_pack") {
        meta.tierId = "sauna";
      }
    }
  }

  // ensure amount is integer > 0
  amount = Math.max(1, Math.floor(Number(amount) || 0));

  return { amount, metadata: meta };
}

/**
 * Create donation invoice (XTR / stars).
 * Uses supabaseAdmin to insert invoice (admins bypass RLS).
 */
export async function createStreamerInvoice({
  payerUserId,
  streamerId,
  amount, // integer XTR (stars)
  metadata = {},
}: {
  payerUserId: string;
  streamerId: string;
  amount: number;
  metadata?: Record<string, any>;
}) {
  if (!payerUserId) throw new Error("payerUserId required");
  if (!streamerId) throw new Error("streamerId required");
  if (!amount || amount <= 0) throw new Error("invalid amount");

  const invoiceId = `inv_${randomUUID()}`;

  try {
    // Server-side normalization (prevent client spoofing)
    const normalized = normalizeInvoicePayload(amount, metadata);
    amount = normalized.amount;
    metadata = normalized.metadata;

    // Prefer RPC if present; fall back to insert
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        id: invoiceId,
        type: "donation",
        user_id: payerUserId,
        subscription_id: streamerId,
        status: "pending",
        amount: amount,
        currency: "XTR",
        metadata: metadata,
      })
      .select()
      .single();

    if (error) {
      logger.error("[createStreamerInvoice] supabase error", error);
      throw error;
    }

    logger.info("[createStreamerInvoice] created", { invoiceId, payerUserId, streamerId, amount, metadata });
    return { success: true, invoice: data };
  } catch (e) {
    logger.error("[createStreamerInvoice] failed", e);
    return { success: false, error: (e as any).message ?? String(e) };
  }
}

/**
 * Update invoice to paid status.
 */
async function updateInvoiceToPaid(invoiceId: string) {
  const { data: updatedInvoice, error: updErr } = await supabaseAdmin
    .from("invoices")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select()
    .single();

  if (updErr) {
    logger.error("[markInvoicePaid] update invoice error", updErr);
    throw updErr;
  }

  return updatedInvoice;
}

/**
 * Award stars and apply perks to the streamer.
 */
async function awardStarsAndPerks(invoice: any) {
  const streamerId = invoice.subscription_id;
  const amount = Number(invoice.amount || 0);

  if (!streamerId) {
    logger.warn("[markInvoicePaid] invoice has no subscription_id", invoice.id);
    return { success: true, streamerId, newBalance: 0 };
  }

  const { data: streamerUser, error: streamerFetchErr } = await supabaseAdmin
    .from("users")
    .select("user_id, metadata")
    .eq("user_id", streamerId)
    .maybeSingle();

  if (streamerFetchErr) {
    logger.error("[markInvoicePaid] streamer user fetch error", streamerFetchErr);
    throw streamerFetchErr;
  }

  if (!streamerUser) {
    logger.warn("[markInvoicePaid] streamer user not found", { streamerId });
    return { success: true, streamerId, newBalance: 0 };
  }

  const meta = (streamerUser.metadata as any) || {};
  const prev = Number(meta?.starsBalance ?? 0);
  const next = prev + amount;

  // prepare updated metadata
  const newMeta = { ...(meta || {}), starsBalance: next };

  // If invoice has metadata that indicates VIP or market perks — apply them
  try {
    const invMeta = invoice.metadata || {};
    // VIP handling: extend vipExpires by vipDays (default 7)
    const tierId = invMeta?.tierId ?? invMeta?.kind;
    if (tierId === "vip" || invMeta?.kind === "vip") {
      const vipDays = Number(invMeta?.vipDays ?? 7);
      const now = new Date();
      const currentExpiry = meta?.vipExpires ? new Date(meta.vipExpires) : now;
      // if existing expiry in past, start from now
      const base = isNaN(currentExpiry.getTime()) || currentExpiry < now ? now : currentExpiry;
      const newExpiry = new Date(base.getTime() + vipDays * 24 * 60 * 60 * 1000);
      newMeta.vipExpires = newExpiry.toISOString();
      newMeta.isVip = true;
      logger.info("[markInvoicePaid] awarding VIP", { streamerId, vipDays, newExpiry: newMeta.vipExpires });
    }

    // Market SKU handling: record lastPurchasedSku (demo)
    if (invMeta?.sku) {
      newMeta.lastPurchasedSku = invMeta.sku;
      logger.info("[markInvoicePaid] recorded purchased sku", { streamerId, sku: invMeta.sku });
    }
  } catch (metaErr) {
    logger.warn("[markInvoicePaid] failed to process invoice metadata for perks", metaErr);
  }

  // update user metadata
  const { data: updatedUser, error: userUpdErr } = await supabaseAdmin
    .from("users")
    .update({ metadata: newMeta })
    .eq("user_id", streamerId)
    .select()
    .single();

  if (userUpdErr) {
    logger.error("[markInvoicePaid] failed to update user metadata", userUpdErr);
    throw userUpdErr;
  }

  return { success: true, streamerId, newBalance: next, streamerUser: updatedUser };
}

/**
 * Send Telegram notification (best-effort).
 */
async function notifyViaTelegram(streamerUser: any, amount: number, payerId: string) {
  try {
    const chatIdCandidate = (streamerUser?.metadata?.chat_id) || streamerUser.user_id;
    const chatId = String(chatIdCandidate);
    const text = `⭐ Поступление: +${amount} XTR от ${payerId || "анонимного"}\nБаланс: ${streamerUser.metadata.starsBalance}★`;
    await sendTelegramMessage(chatId, text);
  } catch (tgErr) {
    logger.warn("[markInvoicePaid] telegram notify failed (non-fatal)", tgErr);
  }
}

/**
 * Mark invoice paid, award stars to streamer.
 * This will:
 *  - update invoices.status -> paid
 *  - increment recipient user's metadata.starsBalance by amount
 *  - apply VIP/market perks from invoice.metadata (best-effort)
 *  - send optional Telegram notification to streamer (if chat id available)
 */
export async function markInvoicePaidAndDistribute({ invoiceId }: { invoiceId: string }) {
  if (!invoiceId) throw new Error("invoiceId required");

  try {
    // 1) Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      logger.error("[markInvoicePaid] fetch invoice error", invoiceError);
      throw invoiceError;
    }
    if (!invoice) {
      return { success: false, error: "invoice not found" };
    }
    if (invoice.status === "paid") {
      return { success: true, message: "already paid" };
    }

    // 2) Update invoice -> paid
    const updatedInvoice = await updateInvoiceToPaid(invoiceId);

    // 3) Award stars and perks
    const awarded = await awardStarsAndPerks(invoice);

    // 4) Send notification
    await notifyViaTelegram(awarded.streamerUser, invoice.amount, invoice.user_id);

    logger.info("[markInvoicePaid] success", { invoiceId, streamerId: awarded.streamerId, amount: invoice.amount, newBalance: awarded.newBalance });

    return { success: true, invoice: updatedInvoice, awardedTo: awarded.streamerId, newBalance: awarded.newBalance };
  } catch (e) {
    logger.error("[markInvoicePaid] error", e);
    return { success: false, error: (e as any).message ?? String(e) };
  }
}

/**
 * Get leaderboard for a streamer (top supporters).
 */
export async function getLeaderboard({ streamerId, limit = 10 }: { streamerId: string; limit?: number }) {
  if (!streamerId) throw new Error("streamerId required");

  try {
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("user_id, amount")
      .eq("subscription_id", streamerId)
      .eq("status", "paid");

    const map = new Map<string, number>();
    (invoices || []).forEach((r: any) => {
      const uid = r.user_id;
      const amt = Number(r.amount || 0);
      map.set(uid, (map.get(uid) || 0) + amt);
    });

    const arr = Array.from(map.entries()).map(([user_id, total]) => ({ user_id, total }));
    arr.sort((a, b) => b.total - a.total);
    const top = arr.slice(0, limit);

    // attach username / avatar
    const userIds = top.map((t) => t.user_id);
    let users = [];
    if (userIds.length) {
      const { data: usersData } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name, avatar_url, metadata")
        .in("user_id", userIds);
      users = usersData || [];
    }

    const result = top.map((t) => {
      const u = users.find((x: any) => x.user_id === t.user_id) || {};
      return {
        user_id: t.user_id,
        username: u.username || u.full_name || "Аноним",
        avatar_url: u.avatar_url || null,
        total: t.total,
      };
    });

    return { success: true, data: result };
  } catch (e) {
    logger.error("[getLeaderboard] error", e);
    return { success: false, error: (e as any).message ?? String(e) };
  }
}

/**
 * Fetch streamer profile by id
 */
export async function getStreamerProfile({ streamerId }: { streamerId: string }) {
  if (!streamerId) throw new Error("streamerId required");
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("user_id, username, full_name, avatar_url, metadata, description")
      .eq("user_id", streamerId)
      .maybeSingle();
    return { success: true, data };
  } catch (e) {
    logger.error("[getStreamerProfile] error", e);
    return { success: false, error: (e as any).message ?? String(e) };
  }
}