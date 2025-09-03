"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import type { Database } from "@/types/database.types";

type WarehouseItem = Database['public']['Tables']['cars']['Row'] & {
  warehouse_location?: { voxel_id: string };
};

export async function getWarehouseItems(): Promise<{ success: boolean; data?: WarehouseItem[]; error?: string }> {
  noStore();
  try {
    const { data, error } = await supabaseAdmin
      .from('cars')
      .select('*')
      .eq('type', 'wb_item')
      .order('model');
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    logger.error("[getWarehouseItems] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateItemLocation(itemId: string, voxelId: string): Promise<{ success: boolean; error?: string }> {
  noStore();
  try {
    const { error } = await supabaseAdmin
      .from('cars')
      .update({ specs: { ...(await getItemSpecs(itemId)), warehouse_location: { voxel_id: voxelId } } })
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.error("[updateItemLocation] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getItemSpecs(itemId: string): Promise<any> {
  const { data } = await supabaseAdmin.from('cars').select('specs').eq('id', itemId).single();
  return data?.specs || {};
}