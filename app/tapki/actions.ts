// /app/tapki/actions.ts
"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from 'uuid';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_PROVIDER_TOKEN = process.env.TELEGRAM_PROVIDER_TOKEN!; // NEW: Add to env for payments
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;

export async function createTapkiInvoice(userId: string, tapkiId: string, amount: number, imageUrl: string, customMessage: string = '') {
  return createAccessoryInvoice(userId, tapkiId, amount, imageUrl, customMessage, 'Тапки Света', 'Донат за good service - комфорт в сауне!'); // Use general function
}

export async function createAccessoryInvoice(userId: string, itemId: string, amount: number, imageUrl: string, customMessage: string = '', title: string, description: string) {
  try {
    const invoiceId = uuidv4();

    // Create invoice in DB
    const { data: invoice, error: invError } = await supabaseAdmin.from('invoices').insert({
      id: invoiceId,
      user_id: userId,
      subscription_id: 'fake_good_service',
      type: 'donation',
      amount: amount,
      status: 'pending',
      metadata: { item_id: itemId, image_url: imageUrl, message: `${description} ${customMessage}` }
    }).select().single();

    if (invError || !invoice) throw new Error(`Failed to create invoice: ${invError?.message}`);

    // NEW: Direct sendInvoice via Telegram API
    const payload = {
      chat_id: userId,
      title: title,
      description: `${description} ${customMessage ? `\nСообщение: ${customMessage}` : ''}`,
      payload: invoiceId, // For webhook
      provider_token: TELEGRAM_PROVIDER_TOKEN,
      currency: 'XTR',
      prices: [{ label: title, amount: amount }], // In smallest units? But XTR may differ; assume
      photo_url: imageUrl,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
    };

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.description || 'Failed to send invoice');

    return { success: true };
  } catch (error) {
    logger.error("[createAccessoryInvoice]", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateQuantity(itemId: string, decrement: number = 1) {
  try {
    const { data: item, error: fetchErr } = await supabaseAdmin.from('cars').select('quantity').eq('id', itemId).single();
    if (fetchErr || !item) throw new Error("Item not found");

    const newQuantity = (item.quantity || 0) - decrement;
    if (newQuantity < 0) throw new Error("Out of stock");

    const { error: updateErr } = await supabaseAdmin.from('cars').update({ quantity: newQuantity }).eq('id', itemId);
    if (updateErr) throw updateErr;

    if (newQuantity < 3) await sendLowStockAlert(itemId, newQuantity);

    return { success: true, newQuantity };
  } catch (error) {
    logger.error("[updateQuantity]", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendLowStockAlert(itemId: string, quantity: number) {
  try {
    const { data: owner, error } = await supabaseAdmin.from('cars').select('owner_id').eq('id', itemId).single();
    if (error || !owner?.owner_id) return;

    const message = `⚠️ Низкий запас аксессуара (ID: ${itemId})! Осталось ${quantity} шт. Пополните для good service! 😊`;
    await sendComplexMessage(owner.owner_id, message, []);
  } catch (error) {
    logger.error("[sendLowStockAlert]", error);
  }
}