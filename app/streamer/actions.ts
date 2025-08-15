"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import { randomUUID } from "crypto";

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

    logger.info("[createStreamerInvoice] created", { invoiceId, payerUserId, streamerId, amount });
    return { success: true, invoice: data };
  } catch (e) {
    logger.error("[createStreamerInvoice] failed", e);
    return { success: false, error: (e as any).message ?? String(e) };
  }
}

/**
 * Mark invoice paid, award stars to streamer.
 * This will:
 *  - update invoices.status -> paid
 *  - increment recipient user's metadata.starsBalance by amount
 *  - send optional Telegram notification to streamer (if user_id equals chat id)
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

    // 3) award stars: invoices.subscription_id is streamerId (recipient)
    const streamerId = invoice.subscription_id;
    const amount = Number(invoice.amount || 0);

    if (!streamerId) {
      logger.warn("[markInvoicePaid] invoice has no subscription_id", invoiceId);
      return { success: true, invoice: updatedInvoice };
    }

    // 4) read recipient user
    const { data: streamerUser } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .eq("user_id", streamerId)
      .maybeSingle();

    if (!streamerUser) {
      logger.warn("[markInvoicePaid] streamer user not found", { streamerId });
      return { success: true, invoice: updatedInvoice };
    }

    const meta = (streamerUser.metadata as any) || {};
    const prev = Number(meta?.starsBalance ?? 0);
    const next = prev + amount;

    const { data: updatedUser, error: userUpdErr } = await supabaseAdmin
      .from("users")
      .update({ metadata: { ...meta, starsBalance: next } })
      .eq("user_id", streamerId)
      .select()
      .single();

    if (userUpdErr) {
      logger.error("[markInvoicePaid] failed to update user metadata", userUpdErr);
      throw userUpdErr;
    }

    // 5) send Telegram notification (best-effort)
    try {
      // We assume streamerId may equal Telegram chat id or their stored metadata.chat_id
      const chatId = String(streamerId);
      const text = `⭐ Поступление: +${amount} XTR от ${invoice.user_id || "анонимного"}\nБаланс: ${next}★`;
      await sendTelegramMessage(chatId, text);
    } catch (tgErr) {
      logger.warn("[markInvoicePaid] telegram notify failed (non-fatal)", tgErr);
    }

    logger.info("[markInvoicePaid] success", { invoiceId, streamerId, amount, newBalance: next });

    return { success: true, invoice: updatedInvoice, awardedTo: streamerId, newBalance: next };
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
    return { success: false, error: (e as any).message ?? String(e) };
  }
}