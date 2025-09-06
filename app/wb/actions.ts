"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import type { WarehouseItem } from "@/app/wb/common";
import { SendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions"; // Предполагаем core notifyAdmins

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
    // Для 'B' полок проверяем min_quantity
    if (voxelId.startsWith('B') && specs.min_quantity && quantity < specs.min_quantity) {
      logger.warn(`[updateItemLocationQty] Warning: Quantity below min for B shelf: ${quantity} < ${specs.min_quantity}`);
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

export async function exportDiffToAdmin(diffCsv: string) {
  try {
    // Отправка файла в админ-чат
    const message = "Diff CSV для синхра WB/Ozon готов! Загружайте в панели.";
    await notifyAdmins(message); // Основное уведомление
    // Для файла используем SendComplexMessage с attach
    await SendComplexMessage(process.env.ADMINS_CHAT_ID, message, { attachment: { type: 'document', content: diffCsv, filename: 'warehouse_diff.csv' } });
    logger.info("[exportDiffToAdmin] Sent to admins.");
  } catch (error) {
    logger.error("[exportDiffToAdmin] Error:", error);
  }
}