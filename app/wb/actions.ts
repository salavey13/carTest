"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import { parse } from "papaparse"; // Make sure that you import parse from papaparse
import Papa from "papaparse"; // Make sure that you import Papa from papaparse

// Helper function to generate image URL
const generateImageUrl = (id: string): string => {
    const baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ".inmctohsodgdohamhzag.supabase.co") + "/storage/v1/object/public/wb/";
    let filename = id.replace(/^1\.5/, "poltorashka").replace(/^2/, "dvushka").replace(/ /g, "-") + ".jpg";
    return baseURL + filename;
};

// Helper to derive fields from id
const deriveFieldsFromId = (id: string) => {
    const parts = id.toLowerCase().split(' ');
    let model = '';
    let make = '';
    let description = '';
    let specs: any = { warehouse_locations: [] };

    // Models
    if (parts[0] === '1.5') {
        model = '1.5';
    } else if (parts[0] === '2') {
        model = '2';
    } else if (parts[0] === 'евро' && parts[1] !== 'макси') {
        model = 'Евро';
    } else if (parts[0] === 'евро' && parts[1] === 'макси') {
        model = 'Евро Макси';
        parts.shift(); // Remove 'евро'
    } else if (parts[0].startsWith('наматрасник.')) {
        model = 'Наматрасник';
        const sizePart = parts[0].split('.')[1];
        const pattern = parts[1] || '';
        specs.size = sizePart;
        specs.pattern = pattern;
        specs.season = null;
        specs.color = parseInt(sizePart, 10) >= 160 ? 'dark-green' : 'light-green';
        description = parseInt(sizePart, 10) >= 160 ? 'Темно-зеленый, большой' : 'Салатовый, маленький';
        make = `${sizePart.charAt(0).toUpperCase() + sizePart.slice(1)} ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`;
        return { model, make, description, specs };
    } else {
        model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }

    // Make - rest capitalized
    make = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    // Description hardcoded
    switch (model.toLowerCase()) {
        case '1.5':
            description = 'Серая';

            specs.color = 'gray';
            specs.size = '150x200';
            break;
        case '2':
            description = 'Голубая';
            specs.color = 'blue';
            specs.size = '200x220';
            break;
        case 'евро':
            description = 'Бежевая';
            specs.color = 'beige';
            specs.size = '180x220';
            break;
        case 'евро макси':
            description = 'Красная';
            specs.color = 'red';
            specs.size = '220x240';
            break;
        case 'наматрасник':
            description = 'Зеленая';
            specs.color = 'green';
            break;
    }

    // Season/pattern in russian
    if (parts.includes('зима')) {
        specs.season = 'зима';
        description += ', полузакрытая';
    } else if (parts.includes('лето')) {
        specs.season = 'лето';
        description += ', полосочка';
    }
    specs.pattern = parts[parts.length - 1].replace(/[0-9]/g, '').trim();

    return { model, make, description, specs };
};

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
        logger.info(`Fetched ${data?.length || 0} warehouse items from Supabase.`);
        return { success: true, data };
    } catch (error) {
        logger.error("[getWarehouseItems] Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
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
        const itemIds = batch.map((row: any) => (row["Артикул"] || row["id"])?.toLowerCase()).filter(Boolean);
        logger.info(`Fetching existing items for ${itemIds.length} IDs.`);
        const { data: existingItems } = await supabaseAdmin.from("cars").select("*").in("id", itemIds);

        const itemsToUpsert = batch.map(async (row: any) => {
            const itemId = (row["Артикул"] || row["id"])?.toLowerCase();
            if (!itemId) {
                logger.warn(`Skipping row without id/Артикул: ${JSON.stringify(row)}`);
                return null;
            }

            const existingItem = existingItems?.find(item => item.id === itemId);

            let derived = deriveFieldsFromId(itemId);
            let make = row.make || derived.make || "Unknown Make";
            let model = row.model || derived.model || "Unknown Model";
            let description = row.description || derived.description || "No Description";

            let specs = row.specs ? JSON.parse(row.specs) : derived.specs;

            let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;

            // Ensure warehouse_locations exists and is an array
            if (!specs.warehouse_locations || !Array.isArray(specs.warehouse_locations)) {
                specs.warehouse_locations = [];
            }

            // Update warehouse locations based on quantity
            if (specs.warehouse_locations.length === 0) {
                specs.warehouse_locations = [{ voxel_id: "A1", quantity }]; // Default location
            } else {
                // Assuming ONE location for simplicity; adjust if needed
                specs.warehouse_locations[0].quantity = quantity;
            }

            const itemToUpsert = {
                id: itemId,
                make,
                model,
                description,
                type: "wb_item",
                specs,
                image_url: row.image_url || generateImageUrl(itemId),
                // quantity, // REMOVE Quantity Field here.
            };

            //Recalculate for existing Items.
            if (existingItem) {
                itemToUpsert.specs = { ...existingItem.specs, ...itemToUpsert.specs }; //Merge
            }

            logger.info(`Prepared upsert for ${itemId} with quantity ${quantity}: ${JSON.stringify(itemToUpsert)}`);
            return itemToUpsert;
        }).filter(Boolean);

        if (itemsToUpsert.length === 0) return { success: false, error: "No valid items" };

        logger.info(`Upserting ${itemsToUpsert.length} items to Supabase.`);
        // @ts-ignore
        const { error } = await supabaseAdmin.from("cars").upsert(await Promise.all(itemsToUpsert), { onConflict: "id" });

        if (error) throw error;

        return { success: true, message: `Upserted ${itemsToUpsert.length} items.` };
    } catch (error) {
        logger.error("Upload error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function updateItemLocationQty(
    itemId: string,
    voxelId: string,
    delta: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: existingItem, error: selectError } = await supabaseAdmin
            .from("cars")
            .select("specs")
            .eq("id", itemId)
            .single();

        if (selectError) {
            logger.error(`Error fetching item ${itemId} for location update:`, selectError);
            return { success: false, error: `Failed to fetch item: ${selectError.message}` };
        }

        if (!existingItem?.specs) {
            logger.warn(`Item ${itemId} not found or missing specs.`);
            return { success: false, error: "Item not found or missing specs." };
        }

        let specs = existingItem.specs;

        // Ensure warehouse_locations exists and is an array
        if (!specs.warehouse_locations || !Array.isArray(specs.warehouse_locations)) {
            specs.warehouse_locations = [];
        }

        // Find the location, or create it if it doesn't exist
        let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
        if (!location) {
            location = { voxel_id: voxelId, quantity: 0 };
            specs.warehouse_locations.push(location);
        }

        // Apply the delta, ensuring quantity doesn't go below 0
        location.quantity = Math.max(0, (location.quantity || 0) + delta);

        // Remove location if quantity is 0 - OPTIONAL: depends on your needs.
        specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => l.quantity > 0);

        const totalQuantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + l.quantity, 0);

        const { error: updateError } = await supabaseAdmin
            .from("cars")
            .update({ specs }) // Removed quantity: totalQuantity to avoid mismatches
            .eq("id", itemId);

        if (updateError) {
            logger.error(`Error updating item ${itemId} location ${voxelId}:`, updateError);
            return { success: false, error: `Failed to update item: ${updateError.message}` };
        }

        logger.info(`Successfully updated item ${itemId} location ${voxelId} by ${delta}. New total: ${totalQuantity}`);
        return { success: true };
    } catch (error) {
        logger.error("Error in updateItemLocationQty:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function exportDiffToAdmin(diffData: any[], isTelegram: boolean = false, summarized: boolean = false): Promise<{ success: boolean; csv?: string }> {
    let csvData;
    if (summarized) {
        csvData = '\uFEFF' + Papa.unparse(diffData.map(d => ({
            'Артикул': d.id,
            'Количество': d.diffQty,
        })), { header: true, delimiter: ',', quotes: true });
    } else {
        csvData = '\uFEFF' + Papa.unparse(diffData.map(d => ({
            'Артикул': d.id,
            'Изменение': d.diffQty,
            'Ячейка': d.voxel
        })), { header: true, delimiter: ',', quotes: true });
    }

    if (isTelegram) {
        return { success: true, csv: csvData };
    } else {
        await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Изменения склада в CSV.", [], {
            attachment: { type: "document", content: csvData, filename: "warehouse_diff.csv" },
        });
        return { success: true };
    }
}

export async function exportCurrentStock(items: any[], isTelegram: boolean = false, summarized: boolean = false): Promise<{ success: boolean; csv?: string }> {
    let csvData;
    if (summarized) {
        const stockData = items.map((item) => ({
            'Артикул': item.id,
            'Количество': item.total_quantity,
        }));
        csvData = '\uFEFF' + Papa.unparse(stockData, { header: true, delimiter: ',', quotes: true });
    } else {
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
        csvData = '\uFEFF' + Papa.unparse(stockData, { header: true, delimiter: ',', quotes: true });
    }

    if (isTelegram) {
        return { success: true, csv: csvData };
    } else {
        await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Текущее состояние склада в CSV.", [], {
            attachment: { type: "document", content: csvData, filename: "warehouse_stock.csv" },
        });
        return { success: true };
    }
}