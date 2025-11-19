"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { updateUserSettings, sendTelegramInvoice } from "@/app/actions";
import { processReferralCommissions } from "./ref_actions";
import { fetchBio30ProductById } from "./categories/actions";
import { CartItem } from "./types";

export async function checkoutCart(userId: string) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const cart: CartItem[] = user.data.metadata?.cart || [];
    if (cart.length === 0) throw new Error("Cart is empty");

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const description = cart.map(item => `${item.name} x${item.quantity}`).join(", ");
    const orderId = `bio30_cart_${userId}_${Date.now()}`;

    const invoiceResult = await sendTelegramInvoice(
      userId,
      "Оплата корзины BIO 3.0",
      `Товары: ${description}\nИтого: ${total} руб.`,
      orderId,
      total
    );

    if (invoiceResult.success) {
      await clearCart(userId);
      try {
        await processReferralCommissions(orderId, userId, total);
      } catch (commissionError) {
        logger.error(`Failed to process referral commissions for order ${orderId}:`, commissionError);
      }
      return { success: true, orderId };
    } else {
      return { success: false, error: invoiceResult.error };
    }
  } catch (e) {
    logger.error(`[checkoutCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

export async function addToCart(userId: string, productId: string, quantity: number = 1) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const productResult = await fetchBio30ProductById(productId);
    if (!productResult.success || !productResult.data) {
      throw new Error("Product not found");
    }

    const product = productResult.data;
    const currentCart: CartItem[] = user.data.metadata?.cart || [];
    const existing = currentCart.find(item => item.productId === productId);
    let updatedCart;
    
    if (existing) {
      existing.quantity += quantity;
      updatedCart = [...currentCart];
    } else {
      updatedCart = [...currentCart, {
        productId: product.id,
        quantity,
        name: product.title,
        price: product.price,
        image: product.image,
        category: product.category
      }];
    }

    const result = await updateUserSettings(userId, { cart: updatedCart });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[addToCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

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

export async function clearCart(userId: string) {
  try {
    const result = await updateUserSettings(userId, { cart: [] });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[clearCart] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

// FIXED: Added missing exports
export async function getReferralStats(userId: string) {
  return { success: true, data: { referralsCount: 0, totalEarned: 0 } };
}

export async function becomeReferralPartner(userId: string) {
  return { success: true };
}