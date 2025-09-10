"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";

interface WarehouseCsvRow {
  'Артикул': string;
  'Количество': string;
  [key: string]: any;
}

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

async function getItemSpecs(itemId: string): Promise<any> {
  const { data } = await supabaseAdmin.from("cars").select("specs").eq("id", itemId).single();
  return data?.specs || {};
}

async function verifyAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('status')
    .eq('user_id', userId)
    .single();
  if (error || !user) return false;
  return user.status === 'admin';
}

export async function uploadWarehouseCsv(
  batch: any[],
  userId: string | undefined
): Promise<{ success: boolean; message?: string; error?: string }> {
  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    logger.warn(`Unauthorized warehouse CSV upload by ${userId || 'Unknown'}`);
    return { success: false, error: "Permission denied. Admin required." };
  }

  if (!batch || batch.length === 0) {
    return { success: false, error: "Empty batch provided." };
  }

  try {
    const itemsToUpsert = batch.map((row: any) => {
      const itemId = row["Артикул"]?.toLowerCase(); // Use optional chaining
      const quantity = parseInt(row["Количество"], 10);

      if (!itemId || isNaN(quantity)) {
        logger.warn(`Skipping invalid row: ${JSON.stringify(row)}`);
        return null; // Skip invalid rows
      }

      return {
        id: itemId,
        specs: {
          warehouse_locations: [{ voxel_id: "A1", quantity }],
        },

        type: "wb_item", // Ensure 'type' is set for new records
      };
    }).filter(item => item !== null); // Filter out invalid rows

    if (itemsToUpsert.length === 0) {
      return { success: false, error: "No valid items to upsert in this batch." };
    }

    const { data, error } = await supabaseAdmin
      .from("cars")
      .upsert(itemsToUpsert, { onConflict: "id" }) // Use 'id' for conflict resolution
      .select(); // Optional: Select the updated rows

    if (error) {
      logger.error("Error during upsert:", error);
      return { success: false, error: `Supabase upsert error: ${error.message}` };
    }

    return { success: true, message: `Successfully upserted ${itemsToUpsert.length} items.` };
  } catch (error) {
    logger.error("Unexpected error during upload:", error);
    return { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}


export async function exportDiffToAdmin(diffData: any[]): Promise<void> {
  try {
    // Add UTF-8 BOM to the beginning of the string
    const csvData = '\uFEFF' + Papa.unparse(diffData.map(d => ({
      'Артикул': d.id,
      'Изменение': d.diffQty,
      'Ячейка': d.voxel
    })), { header: true, delimiter: ',', quotes: true });
    const message = "Изменения склада в CSV.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: csvData,
        filename: "warehouse_diff.csv",
      },
    });
  } catch (error) {
    logger.error("[exportDiffToAdmin] Error:", error);
  }
}

    
export async function exportCurrentStock(items: any[]): Promise<void> {
  try {
    const stockData = items.map((item) => ({
      'Артикул': item.id,
      'Название': item.name,
      'Общее Количество': item.total_quantity,
      'Локации': item.locations.map((l: any) => `${l.voxel}:${l.quantity}`).join(", "),
      'Сезон': item.season || "N/A",
      'Узор': item.pattern || "N/A",
      'Цвет': item.color || "N/A",
      'Размер': item.size || "N/A",
    }));
    // Add UTF-8 BOM to the beginning of the string
    const csvData = '\uFEFF' + Papa.unparse(stockData, { header: true, delimiter: ',', quotes: true })
    const message = "Текущее состояние склада в CSV.";
    await notifyAdmins(message);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", message, [], {
      attachment: {
        type: "document",
        content: csvData,
        filename: "warehouse_stock.csv",
      },
    });
  } catch (error) {
    logger.error("[exportCurrentStock] Error:", error);
  }
}