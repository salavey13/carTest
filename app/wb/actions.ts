"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmins } from "@/app/actions";
import Papa from "papaparse";
import dns from "dns/promises";

// Helper function to generate image URL
const generateImageUrl = (id: string): string => {
  const baseURL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(".supabase.co", ".inmctohsodgdohamhzag.supabase.co") + "/storage/v1/object/public/wb/";
  let filename = id.replace(/^1\.5/, "poltorashka").replace(/^2/, "dvushka").replace(/ /g, "-") + ".jpg";
  return baseURL + filename;
};

// Helper to derive fields from id (existing logic, slightly hardened)
export const deriveFieldsFromId = (id: string) => {
  const parts = (id || "").toLowerCase().split(' ');
  let model = '';
  let make = '';
  let description = '';
  let specs: any = { warehouse_locations: [] };

  if (!parts || parts.length === 0) {
    return { model, make, description, specs };
  }

  if (parts[0] === '1.5') {
    model = '1.5';
  } else if (parts[0] === '2') {
    model = '2';
  } else if (parts[0] === 'евро' && parts[1] !== 'макси') {
    model = 'Евро';
  } else if (parts[0] === 'евро' && parts[1] === 'макси') {
    model = 'Евро Макси';
    parts.shift();
  } else if (parts[0].startsWith('наматрасник.') || parts[0].startsWith('наматрас.')) {
    model = 'Наматрасник';
    const sizePart = parts[0].split('.')[1] || '';
    const pattern = parts[1] || '';
    specs.size = sizePart || null;
    specs.pattern = pattern || null;
    specs.season = null;
    specs.color = parseInt(sizePart, 10) >= 160 ? 'dark-green' : 'light-green';
    description = parseInt(sizePart, 10) >= 160 ? 'Темно-зеленый, большой' : 'Салатовый, маленький';
    make = `${sizePart ? sizePart.charAt(0).toUpperCase() + sizePart.slice(1) : ''} ${pattern ? pattern.charAt(0).toUpperCase() + pattern.slice(1) : ''}`.trim();
    return { model, make, description, specs };
  } else {
    model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  make = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  switch ((model || "").toLowerCase()) {
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

  if (parts.includes('зима')) {
    specs.season = 'зима';
    description += ', полузакрытая';
  } else if (parts.includes('лето')) {
    specs.season = 'лето';
    description += ', полосочка';
  }
  specs.pattern = (parts[parts.length - 1] || '').replace(/[0-9]/g, '').trim();

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

    // Build promises, resolve, then filter
    const itemsToUpsertPromises = batch.map(async (row: any) => {
      const itemId = (row["Артикул"] || row["id"])?.toLowerCase();
      if (!itemId) {
        logger.warn(`Skipping row without id/Артикул: ${JSON.stringify(row)}`);
        return null;
      }

      const existingItem = existingItems?.find(item => item.id === itemId);

      const derived = deriveFieldsFromId(itemId);
      const make = row.make || derived.make || "Unknown Make";
      const model = row.model || derived.model || "Unknown Model";
      const description = row.description || derived.description || "No Description";

      let specs = row.specs ? JSON.parse(row.specs) : derived.specs || {};

      let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;

      if (!specs.warehouse_locations || !Array.isArray(specs.warehouse_locations)) {
        specs.warehouse_locations = [];
      }

      if (specs.warehouse_locations.length === 0) {
        specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
      } else {
        specs.warehouse_locations[0].quantity = quantity;
      }

      const itemToUpsert: any = {
        id: itemId,
        make,
        model,
        description,
        type: "wb_item",
        specs,
        image_url: row.image_url || generateImageUrl(itemId),
      };

      if (existingItem) {
        itemToUpsert.specs = { ...existingItem.specs, ...itemToUpsert.specs };
      }

      logger.info(`Prepared upsert for ${itemId} with quantity ${quantity}: ${JSON.stringify(itemToUpsert)}`);
      return itemToUpsert;
    });

    const resolved = await Promise.all(itemsToUpsertPromises);
    const itemsToUpsert = resolved.filter(Boolean) as any[];

    if (itemsToUpsert.length === 0) return { success: false, error: "No valid items" };

    logger.info(`Upserting ${itemsToUpsert.length} items to Supabase.`);
    const { error } = await supabaseAdmin.from("cars").upsert(itemsToUpsert, { onConflict: "id" });

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

    if (!specs.warehouse_locations || !Array.isArray(specs.warehouse_locations)) {
      specs.warehouse_locations = [];
    }

    let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }

    location.quantity = Math.max(0, (location.quantity || 0) + delta);

    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => l.quantity > 0);

    const totalQuantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + l.quantity, 0);

    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs })
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

export async function updateItemMinQty(
  itemId: string,
  minQty: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existingItem, error: selectError } = await supabaseAdmin
      .from("cars")
      .select("specs")
      .eq("id", itemId)
      .single();

    if (selectError) {
      logger.error(`Error fetching item ${itemId} for min_qty update:`, selectError);
      return { success: false, error: `Failed to fetch item: ${selectError.message}` };
    }

    if (!existingItem?.specs) {
      logger.warn(`Item ${itemId} not found or missing specs.`);
      return { success: false, error: "Item not found or missing specs." };
    }

    let specs = existingItem.specs;
    specs.min_quantity = Math.floor(minQty); // Floor to integer

    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs })
      .eq("id", itemId);

    if (updateError) {
      logger.error(`Error updating item ${itemId} min_qty:`, updateError);
      return { success: false, error: `Failed to update item: ${updateError.message}` };
    }

    logger.info(`Successfully updated item ${itemId} min_qty to ${minQty}.`);
    return { success: true };
  } catch (error) {
    logger.error("Error in updateItemMinQty:", error);
    return { success: false, error: (error as Error).message };
  }
}

// WB Sync (unchanged)
export async function syncWbStocks(): Promise<{ success: boolean; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  const WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  logger.info(`syncWbStocks start. WB_WAREHOUSE_ID present: ${!!WB_WAREHOUSE_ID}, WB_TOKEN present: ${!!WB_TOKEN}`);

  if (!WB_TOKEN || !WB_WAREHOUSE_ID) {
    logger.error("WB credentials missing in env.");
    return { success: false, error: "WB credentials missing" };
  }

  try {
    const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
    if (error || !items) {
      logger.error("syncWbStocks: failed to fetch local items", error);
      return { success: false, error: error?.message || "No items found" };
    }

    const stocks = items.map(i => ({
      sku: (i.specs?.wb_sku as string) || i.id,
      amount: (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0),
      warehouseId: parseInt((i.specs?.wb_warehouse_id as string) || WB_WAREHOUSE_ID, 10),
    }));

    const url = "https://suppliers-api.wildberries.ru/api/v5/stocks";
    const maskedToken = WB_TOKEN ? `${WB_TOKEN.slice(0, 6)}...` : "MISSING";

    logger.info("syncWbStocks -> About to POST", {
      url,
      method: "POST",
      token: maskedToken,
      stocksCount: stocks.length,
      sampleStock: stocks[0] || null,
    });

    try {
      const lookup = await dns.lookup("suppliers-api.wildberries.ru");
      logger.info("syncWbStocks DNS lookup result", lookup);
    } catch (dnsErr: any) {
      logger.warn("syncWbStocks DNS lookup failed", dnsErr?.code || dnsErr?.message || dnsErr);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": WB_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ stocks }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let parsed;
    try {
      parsed = await response.json();
    } catch (e) {
      logger.error("syncWbStocks: failed to parse JSON response", { status: response.status, statusText: response.statusText });
      return { success: false, error: `WB API returned non-JSON (status ${response.status})` };
    }

    logger.info("syncWbStocks response", { status: response.status, bodySample: JSON.stringify(parsed).slice(0, 2000) });

    if (!response.ok) {
      return { success: false, error: parsed?.errorText || parsed?.error || `WB API error status ${response.status}` };
    }

    if (parsed?.error) {
      return { success: false, error: parsed?.errorText || parsed?.error };
    }

    return { success: true };
  } catch (err: any) {
    logger.error("syncWbStocks error:", {
      message: err?.message,
      stack: err?.stack,
      cause: err?.cause,
    });
    return { success: false, error: err?.message || "Unknown error in syncWbStocks" };
  }
}

// Ozon Sync (unchanged)
export async function syncOzonStocks(): Promise<{ success: boolean; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  const OZON_WAREHOUSE_ID = process.env.OZON_WAREHOUSE_ID;
  if (!OZON_CLIENT_ID || !OZON_API_KEY || !OZON_WAREHOUSE_ID) return { success: false, error: "Ozon credentials missing" };

  const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
  if (error || !items) return { success: false, error: error?.message || "No items found" };

  const stocks = items.map(i => ({
    offer_id: (i.specs?.ozon_sku as string) || i.id,  // Fallback to ID
    stock: (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0),
    warehouse_id: parseInt((i.specs?.ozon_warehouse_id as string) || OZON_WAREHOUSE_ID, 10),
  }));

  try {
    const response = await fetch("https://api-seller.ozon.ru/v3/products/stocks", {
      method: "POST",
      headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ stocks }),
    });
    const data = await response.json();
    if (data.result?.errors?.length > 0) return { success: false, error: data.result.errors[0].message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// New: Fetch stocks from WB
export async function fetchWbStocks(): Promise<{ success: boolean; data?: { sku: string; amount: number }[]; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  let WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  if (!WB_WAREHOUSE_ID) {
    const whRes = await getWbWarehouses();
    if (whRes.success) {
      WB_WAREHOUSE_ID = whRes.data?.find((w: any) => w.isActive)?.id.toString();
    }
  }
  logger.info(`fetchWbStocks start. WB_WAREHOUSE_ID: ${WB_WAREHOUSE_ID ? WB_WAREHOUSE_ID : "MISSING"}, tokenPresent: ${!!WB_TOKEN}`);

  if (!WB_TOKEN || !WB_WAREHOUSE_ID) {
    logger.error("fetchWbStocks: missing WB credentials");
    return { success: false, error: "WB credentials missing" };
  }

  try {
    const { data: items } = await supabaseAdmin.from("cars").select("id, specs").eq("type", "wb_item");
    if (!items) {
      logger.warn("fetchWbStocks: no local items returned from Supabase");
      return { success: false, error: "No local items" };
    }

    const skus = items.map(i => (i.specs?.wb_sku as string) || i.id);
    const url = `https://suppliers-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`;
    const maskedToken = WB_TOKEN ? `${WB_TOKEN.slice(0, 6)}...` : "MISSING";

    if (isNaN(Number(WB_WAREHOUSE_ID))) {
      logger.warn("fetchWbStocks: WB_WAREHOUSE_ID is not numeric", { WB_WAREHOUSE_ID });
    }

    logger.info("fetchWbStocks -> About to POST", {
      url,
      method: "POST",
      token: maskedToken,
      skusCount: skus.length,
      sampleSkus: skus.slice(0, 20),
    });

    try {
      const lookup = await dns.lookup("suppliers-api.wildberries.ru");
      logger.info("fetchWbStocks DNS lookup result", lookup);
    } catch (dnsErr: any) {
      logger.warn("fetchWbStocks DNS lookup failed", { code: dnsErr?.code, message: dnsErr?.message });
    }

    const body = { skus };
    const bodyStr = JSON.stringify(body);
    logger.debug("fetchWbStocks request body (truncated)", { bodySample: bodyStr.slice(0, 4000) });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": WB_TOKEN, "Content-Type": "application/json" },
      body: bodyStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let errData;
      try {
        errData = await response.json();
      } catch (parseErr) {
        logger.error("fetchWbStocks: failed to parse error body", { status: response.status, statusText: response.statusText });
        return { success: false, error: `WB API returned status ${response.status}` };
      }
      logger.error("fetchWbStocks: WB API returned non-OK", { status: response.status, bodySample: JSON.stringify(errData).slice(0, 2000) });
      return { success: false, error: errData?.error || errData?.errorText || `WB API error ${response.status}` };
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.stocks)) {
      logger.warn("fetchWbStocks: unexpected response shape", { sample: JSON.stringify(data).slice(0, 2000) });
      return { success: false, error: "WB returned unexpected payload" };
    }

    const stocks = data.stocks.map((s: any) => ({ sku: s.sku, amount: s.amount }));
    logger.info(`Fetched ${stocks.length} stocks from WB.`);
    return { success: true, data: stocks };
  } catch (err: any) {
    logger.error("fetchWbStocks error:", {
      message: err?.message,
      stack: err?.stack,
      cause: err?.cause ? { code: err.cause?.code, syscall: err.cause?.syscall, hostname: err.cause?.hostname } : undefined,
    });
    return { success: false, error: err?.message || "Unknown error in fetchWbStocks" };
  }
}

// New: Fetch stocks from Ozon
export async function fetchOzonStocks(): Promise<{ success: boolean; data?: { sku: string; amount: number }[]; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, error: "Ozon credentials missing" };

  try {
    const { data: items } = await supabaseAdmin.from("cars").select("id, specs").eq("type", "wb_item");
    if (!items) return { success: false, error: "No local items" };

    const offerIds = items.map(i => (i.specs?.ozon_sku as string) || i.id);

    let allStocks: { sku: string; amount: number }[] = [];
    let lastId = "";
    const limit = 1000;

    while (true) {
      const body = {
        filter: { offer_id: offerIds, visibility: "ALL" },
        last_id: lastId,
        limit,
      };

      const response = await fetch("https://api-seller.ozon.ru/v4/product/info/stocks", {
        method: "POST",
        headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json();
        return { success: false, error: errData.error || "Ozon API error" };
      }

      const data = await response.json();
      const itemsStocks = data.result.items.flatMap((item: any) =>
        item.stocks.map((stock: any) => ({
          sku: item.offer_id,
          amount: stock.present - stock.reserved,
        }))
      );

      allStocks = [...allStocks, ...itemsStocks];

      lastId = data.result.last_id;
      if (data.result.total < limit) break;
    }

    logger.info(`Fetched ${allStocks.length} stocks from Ozon.`);
    return { success: true, data: allStocks };
  } catch (err) {
    logger.error("fetchOzonStocks error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// --- WB Content API helpers ---
const WB_CONTENT_TOKEN = process.env.WB_CONTENT_TOKEN; // Токен для Content category
const WB_PRICES_TOKEN = process.env.WB_PRICES_TOKEN; // Токен для Prices and Discounts

async function wbApiCall(endpoint: string, method: string = 'GET', body?: any, token: string = WB_CONTENT_TOKEN) {
  try {
    const response = await fetch(`https://content-api.wildberries.ru${endpoint}`, {
      method,
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let errText;
      try {
        const errData = await response.json();
        errText = errData.errorText || errData.error || "WB API error";
      } catch {
        errText = await response.text() || "Unknown error";
      }
      logger.error(`wbApiCall failed: ${response.status} - ${errText}`);
      return { success: false, error: errText };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    logger.error("wbApiCall network error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// Get Products Parent Categories
export async function getWbParentCategories(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/parent/all?locale=${locale}`);
}
export async function getWbSubjects(locale: string = 'ru', name?: string, limit: number = 30, offset: number = 0, parentID?: number): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/object/all?locale=${locale}&limit=${limit}&offset=${offset}`;
  if (name) query += `&name=${encodeURIComponent(name)}`;
  if (parentID) query += `&parentID=${parentID}`;
  return wbApiCall(query);
}
export async function getWbSubjectCharcs(subjectId: number, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/charcs/${subjectId}?locale=${locale}`);
}
export async function getWbColors(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/colors?locale=${locale}`);
}
export async function getWbGenders(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/kinds?locale=${locale}`);
}
export async function getWbCountries(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/countries?locale=${locale}`);
}
export async function getWbSeasons(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/seasons?locale=${locale}`);
}
export async function getWbVat(locale: string = 'ru'): Promise<{ success: boolean; data?: string[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/vat?locale=${locale}`);
}
export async function getWbTnved(subjectID: number, search?: string, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/directory/tnved?subjectID=${subjectID}&locale=${locale}`;
  if (search) query += `&search=${search}`;
  return wbApiCall(query);
}
export async function generateWbBarcodes(count: number = 1): Promise<{ success: boolean; data?: string[]; error?: string }> {
  return wbApiCall('/content/v2/barcodes', 'POST', { count });
}
export async function createWbProductCards(cards: any[]): Promise<{ success: boolean; error?: string }> {
  return wbApiCall('/content/v2/cards/upload', 'POST', cards);
}

// Get warehouses
export async function getWbWarehouses(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const token = process.env.WB_API_TOKEN;
  if (!token) return { success: false, error: "WB_API_TOKEN missing" };

  try {
    const res = await fetch("https://suppliers-api.wildberries.ru/api/v3/warehouses", {
      headers: { "Authorization": token },
      method: "GET",
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `WB returned ${res.status}: ${text}` };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

// getWbProductCardsList - cursor-based pagination (robust)
export async function getWbProductCardsList(settings: any = {}, locale: string = 'ru'): Promise<{ success: boolean; data?: any; error?: string }> {
  let allCards: any[] = [];
  let cursor: any = { limit: Math.min(settings.limit || 100, 100) };
  let total = 0;
  let pageData: any = null;

  do {
    const effectiveSettings = {
      ...settings,
      filter: settings.filter || { withPhoto: -1 },
      cursor,
    };
    const body = { settings: effectiveSettings };

    const res = await wbApiCall(`/content/v2/get/cards/list?locale=${locale}`, 'POST', body);
    if (!res.success) return res;

    pageData = res.data || {};
    const cards = Array.isArray(pageData.cards) ? pageData.cards : [];

    allCards = [...allCards, ...cards];
    total = pageData.cursor?.total ?? total;

    cursor = {
      limit: cursor.limit,
      updatedAt: pageData.cursor?.updatedAt,
      nmID: pageData.cursor?.nmID,
    };

    logger.info(`Page fetched: ${cards.length} cards, total so far: ${allCards.length}, next cursor: ${JSON.stringify(cursor)}, response total: ${total}`);
  } while ((cursor.updatedAt && cursor.nmID) && ((pageData?.cards?.length ?? 0) >= cursor.limit));

  return { success: true, data: { cards: allCards, total: allCards.length } };
}

// parseWbCardsToMinimal: build minimal map and fetch stocks by barcodes
export async function parseWbCardsToMinimal(cards: any[], warehouseId: string): Promise<{ [vendorCode: string]: { nmID: number; barcodes: string[]; quantity: number } }> {
  const map: { [vendorCode: string]: { nmID: number; barcodes: string[]; quantity: number } } = {};

  cards.forEach((card: any) => {
    const vc = (card.vendorCode || "").toLowerCase();
    // sizes may be missing for some cards; handle safe
    const barcodes: string[] = Array.isArray(card.sizes) ? card.sizes.flatMap((size: any) => size.skus || []) : (card.barcodes || []);
    map[vc] = { nmID: card.nmID, barcodes, quantity: 0 };
  });

  const allBarcodes = Object.values(map).flatMap(m => m.barcodes);
  if (allBarcodes.length > 0) {
    const stocksRes = await fetchWbStocksForBarcodes(allBarcodes, warehouseId);
    if (stocksRes.success && stocksRes.data) {
      stocksRes.data.forEach((stock: any) => {
        Object.entries(map).forEach(([vc, info]) => {
          if (info.barcodes.includes(stock.sku)) {
            info.quantity += stock.amount;
          }
        });
      });
    } else {
      logger.warn("No stocks fetched for WB quantities");
    }
  }

  return map;
}

// fetchWbStocksForBarcodes
export async function fetchWbStocksForBarcodes(barcodes: string[], warehouseId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const token = process.env.WB_API_TOKEN;
  if (!token) return { success: false, error: "Token missing" };

  try {
    const res = await fetch(`https://suppliers-api.wildberries.ru/api/v3/stocks/${warehouseId}`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ skus: barcodes }),
    });
    if (!res.ok) return { success: false, error: await res.text() };
    const data = await res.json();
    return { success: true, data: data.stocks };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Ozon product list
export async function getOzonProductList(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, error: "Ozon credentials missing" };

  try {
    let allItems: any[] = [];
    let last_id = "";
    const limit = 1000;

    while (true) {
      const body = { filter: {}, last_id, limit };
      const response = await fetch("https://api-seller.ozon.ru/v2/product/list", {
        method: "POST",
        headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json();
        return { success: false, error: errData.error || "Ozon API error" };
      }

      const data = await response.json();
      allItems = [...allItems, ...data.result.items];
      last_id = data.result.last_id;
      if (!last_id) break;
    }

    logger.info(`Fetched ${allItems.length} products from Ozon.`);
    return { success: true, data: allItems };
  } catch (err) {
    logger.error("getOzonProductList error:", err);
    return { success: false, error: (err as Error).message };
  }
}

export async function parseOzonToMinimal(products: any[], stocks: { sku: string; amount: number }[]): Promise<{ [offerId: string]: { product_id?: number; quantity: number } }> {
  const map: { [offerId: string]: { product_id?: number; quantity: number } } = {};

  products.forEach((prod: any) => {
    const offerId = (prod.offer_id || "").toLowerCase();
    const stock = (stocks || []).find(s => s.sku.toLowerCase() === offerId);
    map[offerId] = { product_id: prod.product_id, quantity: stock?.amount || 0 };
  });

  return map;
}

// ------------------ FUZZY MATCHING HELPERS -----------------------
const KNOWN_MODELS = ["1.5", "2", "евро макси", "евро", "наматрасник"];
const KNOWN_SEASONS = ["зима", "лето"];

function normalizeSpaces(s: string) {
  return s.replace(/[\u00A0]+/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[al][bl];
}

function similarRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const lev = levenshtein(a, b);
  const maxl = Math.max(a.length, b.length);
  return maxl === 0 ? 1 : 1 - lev / maxl;
}

function applySynonyms(s: string): string {
  let res = (s || "").toLowerCase();
  res = res.replace(/ё/g, "е");
  res = res.replace(/[._\-]+/g, " ");
  res = res.replace(/\bевр?о\s*макс(и|и)?\b/g, "евро макси");
  res = res.replace(/\bевромакси\b/g, "евро макси");
  res = res.replace(/\bевро макс\b/g, "евро макси");
  res = res.replace(/\bнаматрасн\b/g, "наматрасник");
  res = res.replace(/\bнаматрас\b/g, "наматрасник");
  res = res.replace(/\bобл(егч?ен|егч?енн)?\b/g, "лето");
  res = res.replace(/\bоблегченн[аяо]\b/g, "лето");
  res = normalizeSpaces(res);
  return res;
}

function canonicalizeId(raw: string) {
  const cleaned = applySynonyms(raw || "");
  const tokens = cleaned.split(" ").filter(Boolean);
  let model = "";
  let season = "";
  let patternTokens: string[] = [];

  const joined = tokens.join(" ");
  if (joined.includes("евро макси")) {
    model = "евро макси";
    const idx = joined.indexOf("евро макси");
    const before = joined.slice(0, idx).trim();
    const after = joined.slice(idx + "евро макси".length).trim();
    const rest = (before + " " + after).trim();
    const restT = rest ? rest.split(" ").filter(Boolean) : [];
    restT.forEach(tok => {
      if (KNOWN_SEASONS.includes(tok)) season = tok;
      else patternTokens.push(tok);
    });
    const pattern = patternTokens.join(" ").trim();
    const canonical = [model, season, pattern].filter(Boolean).join(" ").trim();
    return { model, season, pattern, canonical };
  }

  for (const t of tokens) {
    if (KNOWN_MODELS.includes(t)) {
      model = t;
      break;
    }
  }

  if (!model) {
    const maybe = tokens.find(t => t === "1.5" || t === "2");
    if (maybe) model = maybe;
  }

  for (const t of tokens) {
    if (KNOWN_SEASONS.includes(t)) {
      season = t;
      break;
    }
  }

  patternTokens = tokens.filter(t => t !== model && t !== season);
  if (!model && tokens.length > 0) {
    const first = tokens[0];
    if (["1.5", "2"].includes(first) || first.startsWith("евро") || first.startsWith("наматрас")) {
      model = first;
      patternTokens = tokens.slice(1).filter(t => t !== season);
    }
  }

  const pattern = patternTokens.join(" ").trim();
  const canonical = [model, season, pattern].filter(Boolean).join(" ").trim();
  return { model, season, pattern, canonical };
}

function scoreMatch(aRaw: string, bRaw: string) {
  const a = canonicalizeId(aRaw);
  const b = canonicalizeId(bRaw);

  if (a.canonical && b.canonical && a.canonical === b.canonical) return 1;

  let score = 0;
  if (a.model && b.model) {
    score += a.model === b.model ? 0.5 : 0;
  } else if (!a.model && !b.model) {
    score += 0.1;
  }

  if (a.season && b.season) {
    score += a.season === b.season ? 0.2 : 0;
  }

  const patScore = similarRatio(a.pattern || "", b.pattern || "");
  score += patScore * 0.3;

  return Math.min(1, score);
}

async function findBestSupaMatch(sourceId: string, supaIds: string[]) {
  let best = { id: "", score: 0 };
  for (const s of supaIds) {
    const sc = scoreMatch(sourceId, s);
    if (sc > best.score) {
      best = { id: s, score: sc };
    }
    if (best.score >= 0.99) break;
  }
  return best;
}
// ------------------ END FUZZY HELPERS -----------------------------

// extractIdsFromSources: returns autoMatches
export async function extractIdsFromSources(): Promise<{
  success: boolean;
  wbIds: Set<string>;
  ozonIds: Set<string>;
  supaIds: Set<string>;
  unmatched: { wb: string[]; ozon: string[]; supa: string[] };
  autoMatches?: { wb: { [wbId: string]: { supaId?: string; score: number } }; ozon: { [ozonId: string]: { supaId?: string; score: number } } };
  error?: string;
}> {
  try {
    // WB
    const wbRes = await getWbProductCardsList();
    if (!wbRes.success) throw new Error(wbRes.error || "WB fetch failed");
    const wbCards = wbRes.data?.cards || [];
    const wbIdsArr = wbCards.map((c: any) => (c.vendorCode || "").toLowerCase());
    const wbIds = new Set(wbIdsArr);

    // Ozon
    const ozonRes = await getOzonProductList();
    const ozonArr = (ozonRes.data || []).map((p: any) => (p.offer_id || "").toLowerCase());
    const ozonIds = new Set(ozonArr);

    // Supa
    const supaRes = await getWarehouseItems();
    if (!supaRes.success) throw new Error(supaRes.error || "Supa fetch failed");
    const supaArr = (supaRes.data || []).map((i: any) => (i.id || "").toLowerCase());
    const supaIds = new Set(supaArr);

    const supaList = [...supaIds];
    const wbList = [...wbIds];
    const ozonList = [...ozonIds];

    const autoMatches: any = { wb: {}, ozon: {} };

    for (const wbId of wbList) {
      const best = await findBestSupaMatch(wbId, supaList);
      if (best.score > 0) autoMatches.wb[wbId] = { supaId: best.id || undefined, score: Number(best.score.toFixed(3)) };
      else autoMatches.wb[wbId] = { supaId: undefined, score: 0 };
    }

    for (const ozId of ozonList) {
      const best = await findBestSupaMatch(ozId, supaList);
      if (best.score > 0) autoMatches.ozon[ozId] = { supaId: best.id || undefined, score: Number(best.score.toFixed(3)) };
      else autoMatches.ozon[ozId] = { supaId: undefined, score: 0 };
    }

    const threshold = 0.75;
    const matchedSupa = new Set<string>();
    const unmatchedWb: string[] = [];
    for (const w of wbList) {
      const m = autoMatches.wb[w];
      if (m?.supaId && m.score >= threshold) {
        matchedSupa.add(m.supaId);
      } else {
        unmatchedWb.push(w);
      }
    }
    const unmatchedOzon: string[] = [];
    for (const o of ozonList) {
      const m = autoMatches.ozon[o];
      if (m?.supaId && m.score >= threshold) {
        matchedSupa.add(m.supaId);
      } else {
        unmatchedOzon.push(o);
      }
    }
    const unmatchedSupa = [...supaList].filter(s => !matchedSupa.has(s) && !wbList.includes(s) && !ozonList.includes(s));

    return {
      success: true,
      wbIds,
      ozonIds,
      supaIds,
      unmatched: { wb: unmatchedWb, ozon: unmatchedOzon, supa: unmatchedSupa },
      autoMatches,
    };
  } catch (e: any) {
    logger.error("extractIdsFromSources error:", e);
    return { success: false, wbIds: new Set(), ozonIds: new Set(), supaIds: new Set(), unmatched: { wb: [], ozon: [], supa: [] }, error: e.message };
  }
}

// generateUpdateSql (unchanged but uses parse helpers)
async function generateUpdateSql(manualMap: { wb: { [wbVendor: string]: string }; ozon: { [ozonOffer: string]: string } } = { wb: {}, ozon: {} }): Promise<string> {
  const wbWhRes = await getWbWarehouses();
  const wbWhId = process.env.WB_WAREHOUSE_ID || (wbWhRes.success && wbWhRes.data?.find((w: any) => w.isActive)?.id) || "12345";

  const ozonWhId = process.env.OZON_WAREHOUSE_ID || "67890";

  const cardsRes = await getWbProductCardsList();
  if (!cardsRes.success) return "-- Error fetching WB cards";
  const wbMap = await parseWbCardsToMinimal(cardsRes.data.cards, wbWhId);

  const ozonProdRes = await getOzonProductList();
  const ozonStockRes = await fetchOzonStocks();
  const ozonMap = (ozonProdRes.success && ozonStockRes.success)
    ? await parseOzonToMinimal(ozonProdRes.data || [], ozonStockRes.data || [])
    : {};

  const localRes = await getWarehouseItems();
  if (!localRes.success) return "-- Error fetching local items";

  const sqlLines: string[] = [];
  localRes.data?.forEach((item: any) => {
    const idLower = item.id.toLowerCase();
    const wbVendor = Object.keys(manualMap.wb).find(k => manualMap.wb[k] === item.id) || idLower;
    const ozonOffer = Object.keys(manualMap.ozon).find(k => manualMap.ozon[k] === item.id) || idLower;

    if (!wbMap[wbVendor] && !manualMap.wb[wbVendor]) {
      sqlLines.push(`-- Skipped unmatched WB for '${item.id}'`);
    }
    if (!ozonMap[ozonOffer] && !manualMap.ozon[ozonOffer]) {
      sqlLines.push(`-- Skipped unmatched Ozon for '${item.id}'`);
    }
    if (!wbMap[wbVendor] && !ozonMap[ozonOffer]) return;

    const wb = wbMap[wbVendor] || {};
    const ozon = ozonMap[ozonOffer] || {};

    const json = {
      wb_sku: wb.nmID || item.id,
      ozon_sku: ozon.product_id || item.id,
      wb_warehouse_id: wbWhId,
      ozon_warehouse_id: ozonWhId,
      wb_api_quantity: wb.quantity || 0,
      ozon_api_quantity: ozon.quantity || 0,
    };

    sqlLines.push(
      `UPDATE public.cars SET specs = specs || '${JSON.stringify(json)}'::jsonb WHERE id = '${item.id}' AND type = 'wb_item';`
    );
  });

  return sqlLines.join("\n");
}

// getWarehouseSql exported
export async function getWarehouseSql(manualMap?: { wb: { [key: string]: string }; ozon: { [key: string]: string } }): Promise<{ success: boolean; sql?: string; error?: string }> {
  try {
    const sql = await generateUpdateSql(manualMap);
    return { success: true, sql };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ------------------ createMissingSupaItems (auto-create minimal items with sane specs) ----------------
export async function createMissingSupaItems(ids: string[], createdBy?: string): Promise<{ success: boolean; created: string[]; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) return { success: true, created: [] };
  try {
    // Normalize IDs and dedupe
    const uniqIds = Array.from(new Set(ids.map(id => (id || "").toLowerCase().trim()))).filter(Boolean);

    const itemsToCreate = uniqIds.map(id => {
      const derived = deriveFieldsFromId(id);
      // Build robust specs
      const baseSpecs: any = {
        wb_sku: derived?.model ? undefined : id, // keep fallback
        warehouse_locations: [{ voxel_id: "A1", quantity: 0 }],
        size: derived?.specs?.size || derived?.specs?.size || null,
        pattern: derived?.specs?.pattern || null,
        season: derived?.specs?.season || null,
        color: derived?.specs?.color || null,
        min_quantity: 0,
        wb_warehouse_id: process.env.WB_WAREHOUSE_ID || null,
        ozon_warehouse_id: process.env.OZON_WAREHOUSE_ID || null,
        created_by: createdBy || "automation",
      };

      // Merge derived.specs deeper
      const mergedSpecs = { ...derived.specs, ...baseSpecs };

      return {
        id,
        make: derived.make || id,
        model: derived.model || "Unknown",
        description: derived.description || "",
        type: "wb_item",
        specs: mergedSpecs,
        image_url: generateImageUrl(id),
      };
    });

    const { error } = await supabaseAdmin.from("cars").upsert(itemsToCreate, { onConflict: "id" });
    if (error) throw error;
    logger.info(`Created ${itemsToCreate.length} missing supa items (automation).`);
    return { success: true, created: itemsToCreate.map(i => i.id) };
  } catch (e: any) {
    logger.error("createMissingSupaItems error:", e);
    return { success: false, created: [], error: e.message };
  }
}