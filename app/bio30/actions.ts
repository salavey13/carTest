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

type Referral = {
  referredUserId: string;
  earned: number;
};

type SetReferrerParams = {
  userId: string;
  referrerId: string;
  referrerCode: string;
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
    let updatedCart = currentCart.filter(item => item.productId !== productId);

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
      // Add referral logic if referrer exists
      const metadata = user.data.metadata || {};
      if (metadata.referrer_id) {
        const earned = Math.floor(total * 0.1); // 10% commission
        await addReferral(metadata.referrer_id, userId, earned);
      }
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
 * Become referral partner and initialize referrals
 */
export async function becomeReferralPartner(userId: string, email: string) {
  try {
    const result = await updateUserSettings(userId, { is_referral_partner: true, partner_email: email, referrals: [] });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[becomeReferralPartner] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Set referrer if not already set (from startapp param)
 */
export async function setReferrer({ userId, referrerId, referrerCode }: SetReferrerParams) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const metadata = user.data.metadata || {};
    // Security: Don't overwrite if already set, prevent self-ref, ensure referrer is partner
    if (metadata.referrer_id) {
      throw new Error("Referrer already set");
    }
    if (referrerId === userId) {
      throw new Error("Cannot refer self");
    }
    const referrer = await supabaseAdmin.from("users").select("metadata").eq("user_id", referrerId).single();
    if (!referrer.data || !referrer.data.metadata?.is_referral_partner) {
      throw new Error("Invalid referrer (not a partner)");
    }

    const result = await updateUserSettings(userId, { referrer_id: referrerId, referrer_code: referrerCode });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[setReferrer] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Get referral stats from user metadata
 */
export async function getReferralStats(userId: string): Promise<{ success: boolean; data?: { referralsCount: number; totalEarned: number }; error?: string }> {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    if (!user.data) throw new Error("User not found");

    const referrals: Referral[] = user.data.metadata?.referrals || [];
    const referralsCount = referrals.length;
    const totalEarned = referrals.reduce((sum, ref) => sum + ref.earned, 0);

    return { success: true, data: { referralsCount, totalEarned } };
  } catch (e) {
    logger.error(`[getReferralStats] Error for user ${userId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Add referral (when a referred user makes a purchase)
 */
export async function addReferral(referrerId: string, referredUserId: string, earned: number) {
  try {
    const user = await supabaseAdmin.from("users").select("metadata").eq("user_id", referrerId).single();
    if (!user.data) throw new Error("Referrer not found");

    const currentReferrals: Referral[] = user.data.metadata?.referrals || [];
    let updatedReferrals = [...currentReferrals, { referredUserId, earned }];

    const result = await updateUserSettings(referrerId, { referrals: updatedReferrals });
    return { success: result.success, error: result.error };
  } catch (e) {
    logger.error(`[addReferral] Error for referrer ${referrerId}:`, e);
    return { success: false, error: (e as Error).message };
  }
}