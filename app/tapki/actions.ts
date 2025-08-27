"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

const TELEGRAM_BOT_LINK = process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

export async function createTapkiInvoice(userId: string, tapkiId: string, amount: number, imageUrl: string) {
  try {
    // Create invoice in DB
    const { data: invoice, error: invError } = await supabaseAdmin.from('invoices').insert({
      user_id: userId,
      type: 'tapki_purchase',
      amount: amount,
      status: 'pending',
      metadata: { tapki_id: tapkiId, image_url: imageUrl, message: "Tapki for sauna - спаси ноги в сауне!" }
    }).select().single();

    if (invError || !invoice) throw new Error(`Failed to create invoice: ${invError?.message}`);

    // Send message with invoice link or direct invoice
    const renterMessage = `🛒 Готовы купить тапочки для сауны? Оплатите 100 XTR и спасите ноги от жара!`;
    await sendComplexMessage(userId, renterMessage, [[{ text: "Оплатить тапочки", url: `${TELEGRAM_BOT_LINK}?startapp=invoice_${invoice.id}` }]], { imageQuery: imageUrl });

    return { success: true };
  } catch (error) {
    logger.error("[createTapkiInvoice]", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateQuantity(tapkiId: string, decrement: number = 1) {
  try {
    const { data: tapki, error: fetchErr } = await supabaseAdmin.from('cars').select('quantity').eq('id', tapkiId).single();
    if (fetchErr || !tapki) throw new Error("Tapki not found");

    const newQuantity = (tapki.quantity || 0) - decrement;
    if (newQuantity < 0) throw new Error("Out of stock");

    const { error: updateErr } = await supabaseAdmin.from('cars').update({ quantity: newQuantity }).eq('id', tapkiId);
    if (updateErr) throw updateErr;

    if (newQuantity < 3) await sendLowStockAlert(tapkiId, newQuantity);

    return { success: true, newQuantity };
  } catch (error) {
    logger.error("[updateQuantity]", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendLowStockAlert(tapkiId: string, quantity: number) {
  try {
    const { data: owner, error } = await supabaseAdmin.from('cars').select('owner_id').eq('id', tapkiId).single();
    if (error || !owner?.owner_id) return;

    const message = `⚠️ Низкий запас тапочек! Осталось ${quantity} шт. Пополните, чтобы не потерять клиентов в сауне-апокалипсисе! 😂`;
    await sendComplexMessage(owner.owner_id, message, []);
  } catch (error) {
    logger.error("[sendLowStockAlert]", error);
  }
}