"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import { parse } from "papaparse"; // Correct Import

// Helper function to generate image URL
const generateImageUrl = (id: string): string => {
    const baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ".inmctohsodgdohamhzag.supabase.co") + "/storage/v1/object/public/wb/";
    const filename = id.replace("1.5", "poltorashka").replace("2", "dvushka").replace(/ /g, "-") + ".jpg";
    return baseURL + filename;
};

interface WarehouseCsvRow {
  id: string;
  make: string;
  model: string;
  description: string;
  type: string;
  specs: string;
  image_url: string;
  Количество?: string; // Quantity may exist in some original csv values
}

async function getWarehouseItems(): Promise<{
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
        // Fetch existing items from Supabase to compare
        //** KEY CHANGE: Now using "Артикул" consistently  **//
        const itemIds = batch.map((row: any) => row["Артикул"]?.toLowerCase()).filter(Boolean);
        logger.info(`Fetching existing items for IDs: ${JSON.stringify(itemIds)}`);

        const { data: existingItems, error: existingItemsError } = await supabaseAdmin
            .from("cars")
            .select("*")
            .in("id", itemIds);

        if (existingItemsError) {
            logger.error("Error fetching existing items:", existingItemsError);
            return { success: false, error: `Error fetching existing items: ${existingItemsError.message}` };
        }

        logger.info(`Successfully fetched ${existingItems?.length || 0} existing items.`);

        const itemsToUpsert = batch.map((row: any) => {
            //** KEY CHANGE: Now using "Артикул" consistently  **//
            const itemId = row["Артикул"]?.toLowerCase();
            if (!itemId) {
                logger.warn(`Skipping row with missing Артикул: ${JSON.stringify(row)}`);
                return null;
            }

            const existingItem = existingItems?.find(item => item.id === itemId);

            // Parse quantity from the simplified CSV or default to 0 if not found
            let quantity = 0;
            try {
                const specs = JSON.parse(row["specs"]);
                if (specs?.warehouse_locations && Array.isArray(specs.warehouse_locations)) {
                    quantity = specs.warehouse_locations.reduce((acc, l) => acc + (parseInt(l.quantity, 10) || 0), 0);
                }
            } catch (e) {
                logger.warn(`Could not parse specs for item ${itemId}, using quantity from CSV if available. Error: ${e}`);
                quantity = parseInt(row["Количество"] || '0', 10) || 0;
            }

            if (isNaN(quantity)) {
                logger.warn(`Skipping invalid quantity for item ${itemId}: ${JSON.stringify(row)}`);
                return null;
            }

            let itemToUpsert: any;
            if (existingItem) {
                logger.info(`Item ${itemId} exists, merging data.`);
                try {
                    const parsedSpecs = JSON.parse(row["specs"] || "{}"); // Safely parse the specs
                    itemToUpsert = {
                        ...existingItem,
                        specs: { ...existingItem.specs, ...parsedSpecs, warehouse_locations: [{ voxel_id: "A1", quantity }] }
                    };
                } catch (e) {
                    logger.error(`Failed to parse and merge specs for existing item ${itemId}:`, e);
                    return null;
                }
            } else {
                logger.info(`Item ${itemId} does not exist, creating new item.`);
                itemToUpsert = {
                    id: itemId,
                    make: row["make"] || "Unknown Make",
                    model: row["model"] || "Unknown Model",
                    description: row["description"] || "No Description",
                    type: "wb_item",
                    specs: { warehouse_locations: [{ voxel_id: "A1", quantity }] },
                    image_url: generateImageUrl(itemId),
                };
            }
            return itemToUpsert;
        }).filter(item => item !== null);

        if (itemsToUpsert.length === 0) {
            logger.warn("No valid items to upsert in this batch.");
            return { success: false, error:"No valid items to upsert in this batch." };
        }

        logger.info(`Upserting ${itemsToUpsert.length} items.`);

        const { data, error } = await supabaseAdmin
            .from("cars")
            .upsert(itemsToUpsert, { onConflict: "id" })
            .select();

        if (error) {
            logger.error("Error during upsert:", error);
            return { success: false, error: `Supabase upsert error: ${error.message}` };
        }

        logger.info(`Successfully upserted ${itemsToUpsert.length} items.`);
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
      'Артикул': d.id,
      'Название': d.name,
      'Общее Количество': item.total_quantity,
      'Локации': item.locations.map((l: any) => `${l.voxel}:${l.quantity}`).join(", "),
      'Сезон': d.season || "N/A",
      'Узор': d.pattern || "N/A",
      'Цвет': d.color || "N/A",
      'Размер': d.size || "N/A",
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