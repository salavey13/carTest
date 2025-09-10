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
      locations[index].quantity += quantity; // Добавляем delta
      if (locations[index].quantity <= 0) {
        locations.splice(index, 1);
      }
    } else if (quantity > 0) {
      locations.push({ voxel_id: voxelId, quantity });
    }
    if (voxelId.startsWith("B") && specs.min_quantity && (locations.find(l => l.voxel_id === voxelId)?.quantity || 0) < specs.min_quantity) {
      logger.warn(
        `[updateItemLocationQty] Warning: Quantity below min for B shelf.`,
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

interface WarehouseCsvRow {
  'Артикул': string;
  'Количество': string;
  [key: string]: any;
}

export async function uploadWarehouseCsv(
  csvContent: string,
  userId: string | undefined
): Promise<{ success: boolean; message?: string; error?: string }> {
  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    logger.warn(`Unauthorized warehouse CSV upload by ${userId || 'Unknown'}`);
    return { success: false, error: "Permission denied. Admin required." };
  }

  if (!csvContent.trim()) {
    return { success: false, error: 'No CSV data.' };
  }

  try {
    const parseResult = Papa.parse<WarehouseCsvRow>(csvContent.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.trim(),
      transform: v => v.trim(),
    });

    if (parseResult.errors.length > 0) {
      const firstError = parseResult.errors[0];
      return { success: false, error: `CSV Parse Error (Row ${firstError.row + 1}): ${firstError.message}` };
    }

    const rows = parseResult.data;
    if (rows.length === 0) {
      return { success: false, error: 'CSV empty.' };
    }

    const requiredHeaders = ["Артикул", "Количество"];
    const actualHeaders = Object.keys(rows[0] || {});
    const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
    if (missingHeaders.length > 0) {
      return { success: false, error: `Missing columns: ${missingHeaders.join(', ')}` };
    }

    const validationErrors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2;
      if (!row['Артикул'] || !row['Количество']) {
        validationErrors.push(`Row ${rowIndex}: Missing Артикул or Количество.`);
        continue;
      }
      const quantityNum = parseInt(row['Количество'], 10);
      if (isNaN(quantityNum)) {
        validationErrors.push(`Row ${rowIndex}: Invalid Количество "${row['Количество']}". Must be number.`);
        continue;
      }
    }

    if (validationErrors.length > 0) {
      return { success: false, error: `Validation Failed:\n${validationErrors.join('\n')}` };
    }

    let updatedCount = 0;
    const updateErrors: string[] = [];
    for (const row of rows) {
      const itemId = row['Артикул'].toLowerCase(); // Lower case to match ID
      const quantity = parseInt(row['Количество'], 10);

      const { success, error } = await supabaseAdmin
        .from("cars")
        .update({ specs: {warehouse_locations: [{voxel_id: "A1", quantity: quantity }]} })
        .eq("id", itemId);

      if (success) {
        updatedCount++;
      } else {
        updateErrors.push(`Item ${itemId}: ${error}`);
      }
    }

    const message = `Updated ${updatedCount} / ${rows.length} items.`;
    if (updateErrors.length > 0) {
      return { success: updatedCount > 0, message, error: `Errors:\n${updateErrors.join('\n')}` };
    }
    return { success: true, message };

  } catch (error) {
    logger.error('Warehouse CSV upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unexpected error.' };
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
    const message = "Изменения скла

да в CSV.";
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