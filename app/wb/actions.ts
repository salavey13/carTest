"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import type { Database } from "@/types/database.types";

type WarehouseItem = Database['public']['Tables']['cars']['Row'] & {
  specs: { 
    size: string; 
    color: string; 
    pattern: string; 
    season: string | null; 
    warehouse_locations: { voxel_id: string; quantity: number }[]; 
  };
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

export async function updateItemLocationQty(itemId: string, voxelId: string, quantity: number): Promise<{ success: boolean; error?: string }> {
  noStore();
  try {
    const specs = await getItemSpecs(itemId);
    let locations = specs.warehouse_locations || [];
    const index = locations.findIndex(l => l.voxel_id === voxelId);
    if (index >= 0) {
      if (quantity <= 0) {
        locations.splice(index, 1);
      } else {
        locations[index].quantity = quantity;
      }
    } else if (quantity > 0) {
      locations.push({ voxel_id: voxelId, quantity });
    }
    const { error } = await supabaseAdmin
      .from('cars')
      .update({ specs: { ...specs, warehouse_locations: locations } })
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.error("[updateItemLocationQty] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getItemSpecs(itemId: string): Promise<any> {
  const { data } = await supabaseAdmin.from('cars').select('specs').eq('id', itemId).single();
  return data?.specs || {};
}