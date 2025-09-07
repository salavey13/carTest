"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import * as XLSX from "xlsx";

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
    // Генерация XLSX
    const worksheet = XLSX.utils.json_to_sheet(diffData, {
      header: ["id", "diffQty", "voxel"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Diff");
    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const xlsxContent = Buffer.from(xlsxBuffer).toString("base64");

    const message = "Изменения склада в XLSX для синхронизации с WB/Ozon готовы! Загружайте в панели.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: xlsxContent,
        filename: "warehouse_diff.xlsx",
      },
    });
    logger.info("[exportDiffToAdmin] XLSX sent to admins.");
  } catch (error) {
    logger.error("[exportDiffToAdmin] Error:", error);
  }
}

export async function exportCurrentStock(items: any[]): Promise<void> {
  try {
    // Формируем данные для текущего стока
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

    const worksheet = XLSX.utils.json_to_sheet(stockData, {
      header: ["id", "name", "total_quantity", "locations", "season", "pattern", "color", "size"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock");
    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const xlsxContent = Buffer.from(xlsxBuffer).toString("base64");

    const message = "Текущее состояние склада в XLSX. Загружайте в панели для синхронизации.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: xlsxContent,
        filename: "warehouse_stock.xlsx",
      },
    });
    logger.info("[exportCurrentStock] XLSX sent to admins.");
  } catch (error) {
    logger.error("[exportCurrentStock] Error:", error);
  }
}