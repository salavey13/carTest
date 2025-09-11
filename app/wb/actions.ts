"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import { parse } from "papaparse";
import Papa from "papaparse";

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
    } else if (parts[0] === 'наматрасник.') {
        model = 'Наматрасник';
        const size = parts[1].replace('.', '');
        const pattern = parts[2];
        specs.size = size;
        specs.pattern = pattern;
        specs.season = null;
        specs.color = parseInt(size) >= 160 ? 'dark-green' : 'light-green';
        description = parseInt(size) >= 160 ? 'Темно-зеленый, большой' : 'Салатовый, маленький';
        return { model, make: `${size.charAt(0).toUpperCase() + size.slice(1)} ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`, description, specs };
    } else {
        model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }

    // Make - rest capitalized
    make = parts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

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
    // Season/pattern
    if (parts.includes('зима')) {
        specs.season = 'zima';
        description += ', полузакрытая';
    } else if (parts.includes('лето')) {
        specs.season = 'leto';
        description += ', полосочка';
    }
    specs.pattern = parts[parts.length - 1].replace(/[0-9]/g, '').trim();

    return { model, make, description, specs };
};

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
        // Fetch existing items
        const itemIds = batch.map((row: any) => (row["Артикул"] || row["id"])?.toLowerCase()).filter(Boolean);
        const { data: existingItems } = await supabaseAdmin.from("cars").select("*").in("id", itemIds);

        const itemsToUpsert = batch.map((row: any) => {
            const itemId = (row["Артикул"] || row["id"])?.toLowerCase();
            if (!itemId) return null;

            const existingItem = existingItems?.find(item => item.id === itemId);

            let derived = deriveFieldsFromId(itemId);
            let make = row.make || derived.make || "Unknown Make";
            let model = row.model || derived.model || "Unknown Model";
            let description = row.description || derived.description || "No Description";

            let specs = {};
            if (row.specs) {
                try {
                    specs = JSON.parse(row.specs);
                } catch {}
            } else {
                specs = derived.specs;
            }

            let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;
            if (!specs.warehouse_locations || specs.warehouse_locations.length === 0) {
                specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
            } else {
                quantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + (parseInt(l.quantity) || 0), 0);
            }

            const itemToUpsert = {
                id: itemId,
                make,
                model,
                description,
                type: "wb_item",
                specs,
                image_url: row.image_url || generateImageUrl(itemId),
                quantity, // Set quantity field
            };

            if (existingItem) {
                itemToUpsert.specs = { ...existingItem.specs, ...itemToUpsert.specs };
            }

            return itemToUpsert;
        }).filter(Boolean);

        if (itemsToUpsert.length === 0) return { success: false, error: "No valid items" };

        const { error } = await supabaseAdmin.from("cars").upsert(itemsToUpsert, { onConflict: "id" });
        if (error) throw error;

        return { success: true, message: `Upserted ${itemsToUpsert.length} items.` };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function exportDiffToAdmin(diffData: any[], isTelegram: boolean = false): Promise<{ success: boolean; csv?: string }> {
  const csvData = '\uFEFF' + Papa.unparse(diffData.map(d => ({
      'Артикул': d.id,
      'Изменение': d.diffQty,
      'Ячейка': d.voxel
    })), { header: true, delimiter: ',', quotes: true });

  if (isTelegram) {
    return { success: true, csv: csvData }; // Return for clipboard
  } else {
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Изменения склада в CSV.", [], {
      attachment: { type: "document", content: csvData, filename: "warehouse_diff.csv" },
    });
    return { success: true };
  }
}

export async function exportCurrentStock(items: any[], isTelegram: boolean = false): Promise<{ success: boolean; csv?: string }> {
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
  const csvData = '\uFEFF' + Papa.unparse(stockData, { header: true, delimiter: ',', quotes: true });

  if (isTelegram) {
    return { success: true, csv: csvData };
  } else {
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Текущее состояние склада в CSV.", [], {
      attachment: { type: "document", content: csvData, filename: "warehouse_stock.csv" },
    });
    return { success: true };
  }
}