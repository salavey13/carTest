"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import Papa from "papaparse";

export async function getWarehouseItems(): Promise<{
  success: boolean;
  data?: WarehouseItem[];
  error?: string;
}> {
  noStore();
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("type", "wb_item")
      .order("model");
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    logger.error("[getWarehouseItems] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateItemLocationQty(
  itemId: string,
  voxelId: string,
  quantity: number,
): Promise<{ success: boolean; error?: string }> {
  noStore();
  try {
    const specs = await getItemSpecs(itemId);
    let locations = specs.warehouse_locations || [];
    const index = locations.findIndex((l) => l.voxel_id === voxelId);
    if (index >= 0) {
      if (quantity <= 0) {
        locations.splice(index, 1);
      } else {
        locations[index].quantity = quantity;
      }
    } else if (quantity > 0) {
      locations.push({ voxel_id: voxelId, quantity });
    }
    if (voxelId.startsWith("B") && specs.min_quantity && quantity < specs.min_quantity) {
      logger.warn(
        `[updateItemLocationQty] Warning: Quantity below min for B shelf: ${quantity} < ${specs.min_quantity}`,
      );
    }
    const { error } = await supabaseAdmin
      .from("cars")
      .update({ specs: { ...specs, warehouse_locations: locations } })
      .eq("id", itemId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.error("[updateItemLocationQty] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function getItemSpecs(itemId: string): Promise<any> {
  const { data } = await supabaseAdmin.from("cars").select("specs").eq("id", itemId).single();
  return data?.specs || {};
}

export async function exportDiffToAdmin(diffData: any[]): Promise<void> {
  try {
    const csvData = Papa.unparse(diffData.map(d => ({
      'Артикул': d.id,
      'Изменение': d.diffQty,
      'Ячейка': d.voxel
    })), { header: true, delimiter: ',', quotes: true });
    const message = "Изменения склада в CSV для синхронизации с WB/Ozon готовы! Загружайте в панели.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: Buffer.from(csvData, 'utf-8').toString('base64'),
        filename: "warehouse_diff.csv",
      },
    });
    logger.info("[exportDiffToAdmin] CSV sent to admins.");
  } catch (error) {
    logger.error("[exportDiffToAdmin] Error:", error);
  }
}

export async function exportCurrentStock(items: any[]): Promise<void> {
  try {
    const stockData = items.map((item) => ({
      id: item.id,
      name: item.name,
      total_quantity: item.total_quantity,
      locations: item.locations.map((l: any) => `${l.voxel}:${l.quantity}`).join(", "),
      season: item.season || "N/A",
      pattern: item.pattern || "N/A",
      color: item.color || "N/A",
      size: item.size || "N/A",
    }));

    const csvData = Papa.unparse(stockData, { header: true, delimiter: ',', quotes: true });
    const message = "Текущее состояние склада в CSV. Загружайте в панели для синхронизации.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: Buffer.from(csvData, 'utf-8').toString('base64'),
        filename: "warehouse_stock.csv",
      },
    });
    logger.info("[exportCurrentStock] CSV sent to admins.");
  } catch (error) {
    logger.error("[exportCurrentStock] Error:", error);
  }
}