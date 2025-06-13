"use server";

import { supabaseAdmin } from '@/hooks/supabase'; 
import { logger } from "@/lib/logger";

/**
 * Spends KiloVibes for a user by calling the 'adjust_kilovibes' RPC.
 * This is a server-only function.
 */
export async function spendKiloVibes(
  userId: string, 
  amount: number, 
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[SERVER ACTION spendKiloVibes] Calling DB function to spend ${amount} KV for user ${userId}. Reason: ${reason}`);
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount provided." };
  }

  const adjustment = -Math.abs(amount);

  const { data, error } = await supabaseAdmin.rpc('adjust_kilovibes', {
      p_user_id: userId,
      p_kv_adjustment: adjustment,
  });

  if (error) {
    logger.error(`[SERVER ACTION spendKiloVibes] RPC call failed for user ${userId}:`, error);
    return { success: false, error: "Database transaction failed." };
  }
  
  const result = data[0];

  if (!result.success) {
    logger.warn(`[SERVER ACTION spendKiloVibes] DB function returned failure for user ${userId}: ${result.message}`);
    return { success: false, error: result.message };
  }

  logger.info(`[SERVER ACTION spendKiloVibes] Successfully spent ${amount} KV for user ${userId}. New balance: ${result.new_balance.toFixed(2)}. Reason: ${reason}`);

  return { success: true, newBalance: result.new_balance };
}

/**
 * Adds KiloVibes to a user's account by calling the 'adjust_kilovibes' RPC.
 * This is a server-only function.
 */
export async function addKiloVibes(
  userId: string, 
  amount: number, 
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  logger.info(`[SERVER ACTION addKiloVibes] Calling DB function to ADD ${amount} KV for user ${userId}. Reason: ${reason}`);
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user ID or amount provided." };
  }

  const adjustment = Math.abs(amount);

  const { data, error } = await supabaseAdmin.rpc('adjust_kilovibes', {
      p_user_id: userId,
      p_kv_adjustment: adjustment,
  });

  if (error) {
    logger.error(`[SERVER ACTION addKiloVibes] RPC call failed for user ${userId}:`, error);
    return { success: false, error: "Database transaction failed." };
  }
  
  const result = data[0];

  if (!result.success) {
    logger.warn(`[SERVER ACTION addKiloVibes] DB function returned failure for user ${userId}: ${result.message}`);
    return { success: false, error: result.message };
  }

  logger.info(`[SERVER ACTION addKiloVibes] Successfully added ${amount} KV for user ${userId}. New balance: ${result.new_balance.toFixed(2)}. Reason: ${reason}`);

  return { success: true, newBalance: result.new_balance };
}