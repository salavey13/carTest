"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import { updateUserSettings } from "@/app/actions"; // Reuse existing updateUserSettings
import { sendTelegramInvoice } from "@/app/actions"; // Reuse sendTelegramInvoice if applicable

type CartItem = {
  productId: string;
  quantity: number;
  name: string;
  price: number;
};

// Hardcoded products for now (can load from supabase 'cars' later)
const PRODUCTS = [
  { id: "1", name: "Lion's Mane", price: 1500 },
  { id: "2", name: "Cordyceps Sinensis", price: 2000 },
  { id: "3", name: "Spirulina Chlorella", price: 1200 },
  { id: "4", name: "Magnesium Pyridoxine", price: 1800 },
];

/**
 * Add item to cart in user metadata
 */
export async function addToCart(userId: string, productId: string, quantity: number = 1) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const currentCart: CartItem[] = user.data.metadata?.cart || [];
    const existing = currentCart.find(item => item.productId === productId);
    let updatedCart;
    if (existing) {
      existing.quantity += quantity;
      updatedCart = [...currentCart];
    } else {
      const product = PRODUCTS.find(p => p.id === productId);
      if (!product) throw new Error("Product not found");
      updatedCart = [...currentCart, { productId, quantity, name: product.name, price: product.price }];
    }

    const result = await updateUserSettings(userId, { cart: updatedCart });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[addToCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(userId: string, productId: string) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const currentCart: CartItem[] = user.data.metadata?.cart || [];
    const updatedCart = currentCart.filter(item => item.productId !== productId);

    const result = await updateUserSettings(userId, { cart: updatedCart });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[removeFromCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Clear cart
 */
export async function clearCart(userId: string) {
  try {
    const result = await updateUserSettings(userId, { cart: [] });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[clearCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Checkout: Send invoice for cart items
 */
export async function checkoutCart(userId: string, chatId: string) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const cart: CartItem[] = user.data.metadata?.cart || [];
    if (cart.length === 0) throw new Error("Cart is empty");

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const description = cart.map(item => `${item.name} x${item.quantity}`).join(", ");

    const invoiceResult = await sendTelegramInvoice(
      chatId,
      "Оплата корзины BIO 3.0",
      `Товары: ${description}\nИтого: ${total} руб.`,
      `bio30_cart_${userId}_${Date.now()}`,
      total
    );

    if (invoiceResult.success) {
      // Clear cart after successful invoice
      await clearCart(userId);
      return { success: true };
    } else {
      return { success: false, error: invoiceResult.error };
    }
  } catch (e) {
    logger.error(`[checkoutCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Become referral partner
 */
export async function becomeReferralPartner(userId: string, email: string) {
  try {
    const result = await updateUserSettings(userId, { is_referral_partner: true, partner_email: email });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[becomeReferralPartner] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}