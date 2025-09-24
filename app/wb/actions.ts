"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import Papa from "papaparse";
import dns from "dns/promises";

// WB Content API wrappers & helpers
const WB_CONTENT_TOKEN = process.env.WB_CONTENT_TOKEN;

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
      console.warn(`wbApiCall failed: ${response.status} - ${errText}`); // logger -> console for stability
      return { success: false, error: errText };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error("wbApiCall network error:", err); // logger -> console
    return { success: false, error: (err as Error).message };
  }
}

// Get Products Parent Categories
export async function getWbParentCategories(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/parent/all?locale=${locale}`);
}

// Get Subjects List
export async function getWbSubjects(locale: string = 'ru', name?: string, limit: number = 30, offset: number = 0, parentID?: number): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/object/all?locale=${locale}&limit=${limit}&offset=${offset}`;
  if (name) query += `&name=${encodeURIComponent(name)}`;
  if (parentID) query += `&parentID=${parentID}`;
  return wbApiCall(query);
}

// Get Subject Characteristics
export async function getWbSubjectCharcs(subjectId: number, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/charcs/${subjectId}?locale=${locale}`);
}

// Get Colors
export async function getWbColors(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/colors?locale=${locale}`);
}

// Get Genders
export async function getWbGenders(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/kinds?locale=${locale}`);
}

// Get Countries
export async function getWbCountries(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/countries?locale=${locale}`);
}

// Get Seasons
export async function getWbSeasons(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/seasons?locale=${locale}`);
}

// Get VAT Rates
export async function getWbVat(locale: string = 'ru'): Promise<{ success: boolean; data?: string[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/vat?locale=${locale}`);
}

// Get HS Codes
export async function getWbTnved(subjectID: number, search?: string, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/directory/tnved?subjectID=${subjectID}&locale=${locale}`;
  if (search) query += `&search=${search}`;
  return wbApiCall(query);
}

// Generate Barcodes
export async function generateWbBarcodes(count: number = 1): Promise<{ success: boolean; data?: string[]; error?: string }> {
  return wbApiCall('/content/v2/barcodes', 'POST', { count });
}

// Create Product Cards
export async function createWbProductCards(cards: any[]): Promise<{ success: boolean; error?: string }> {
  return wbApiCall('/content/v2/cards/upload', 'POST', cards);
}

// Get product cards list (cursor-based)
export async function getWbProductCardsList(settings: any = {}, locale: string = 'ru'): Promise<{ success: boolean; data?: any; error?: string }> {
  let allCards: any[] = [];
  let cursor: any = { limit: Math.min(settings.limit || 100, 100) };  // Clamp <=100
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

    console.info(`Page fetched: ${cards.length} cards, total so far: ${allCards.length}, next cursor: ${JSON.stringify(cursor)}, response total: ${total}`); // logger -> console
  } while ((cursor.updatedAt && cursor.nmID) && ((pageData?.cards?.length ?? 0) >= cursor.limit));

  return { success: true, data: { cards: allCards, total: allCards.length } };
}

// Helper function to generate image URL
const generateImageUrl = (id: string): string => {
  const baseURL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(".supabase.co", ".inmctohsodgdohamhzag.supabase.co") + "/storage/v1/object/public/wb/";
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
    const sizePart = parts[0].split('.')[1] || parts[1] || '';
    const pattern = parts.find(p => p.match(/[а-яё]+/i) && !['наматрасник', 'наматрас', sizePart].includes(p)) || parts[2] || '';
    specs.size = sizePart;
    specs.pattern = pattern || '';
    specs.season = null;
    specs.color = parseInt(sizePart, 10) >= 160 ? 'dark-green' : 'light-green';
    description = parseInt(sizePart, 10) >= 160 ? 'Темно-зеленый, большой' : 'Салатовый, маленький';
    make = `${sizePart ? (sizePart.charAt(0).toUpperCase() + sizePart.slice(1)) : ''} ${pattern ? (pattern.charAt(0).toUpperCase() + pattern.slice(1)) : ''}`.trim();
    return { model, make, description, specs };
  } else {
    model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  make = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

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
    console.info(`Fetched ${data?.length || 0} warehouse items from Supabase.`); // logger -> console
    return { success: true, data };
  } catch (error) {
    console.error("[getWarehouseItems] Error:", error); // logger -> console
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
  return user.status = 'admin';
}

export async function uploadWarehouseCsv(
  batch: any[],
  userId: string | undefined
): Promise<{ success: boolean; message?: string; error?: string }> {
  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    console.warn(`Unauthorized warehouse CSV upload by ${userId || 'Unknown'}`); // logger -> console
    return { success: false, error: "Permission denied. Admin required." };
  }

  if (!batch || batch.length === 0) {
    return { success: false, error: "Empty batch provided." };
  }

  try {
    const itemIds = batch.map((row: any) => (row["Артикул"] || row["id"])?.toLowerCase()).filter(Boolean);
    console.info(`Fetching existing items for ${itemIds.length} IDs.`); // logger -> console
    const { data: existingItems } = await supabaseAdmin.from("cars").select("*").in("id", itemIds);

    const itemsToUpsertPromises = batch.map(async (row: any) => {
      const itemId = (row["Артикул"] || row["id"])?.toLowerCase();
      if (!itemId) {
        console.warn(`Skipping row without id/Артикул: ${JSON.stringify(row)}`); // logger -> console
        return null;
      }

      const existingItem = existingItems?.find(item => item.id === itemId);

      const derived = deriveFieldsFromId(itemId);
      const make = row.make || derived.make || "Unknown Make";
      const model = row.model || derived.model || "Unknown Model";
      const description = row.description || derived.description || "No Description";

      let specs = row.specs ? JSON.parse(row.specs) : (derived.specs || { warehouse_locations: [] });

      let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;

      if (!specs.warehouse_locations || !Array.isArray(specs.warehouse_locations)) {
        specs.warehouse_locations = [];
      }

      if (specs.warehouse_locations.length === 0) {
        specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
      } else {
        specs.warehouse_locations[0].quantity = quantity;
      }

      // Ensure common fields that may be used by sync
      if (!specs.wb_warehouse_id && process.env.WB_WAREHOUSE_ID) {
        specs.wb_warehouse_id = process.env.WB_WAREHOUSE_ID;
      }
      if (!specs.ozon_warehouse_id && process.env.OZON_WAREHOUSE_ID) {
        specs.ozon_warehouse_id = process.env.OZON_WAREHOUSE_ID;
      }

      // Compose item
      const itemToUpsert: any = {
        id: itemId,
        make,
        model,
        description,
        type: "wb_item",
        specs,
        image_url: row.image_url || generateImageUrl(itemId),
      };

      // If item is new — tag specs accordingly
      if (!existingItem) {
        itemToUpsert.specs = { ...itemToUpsert.specs, status: "new item", created_at: new Date().toISOString() };
      } else {
        itemToUpsert.specs = { ...existingItem.specs, ...itemToUpsert.specs };
      }

      console.info(`Prepared upsert for ${itemId} with quantity ${quantity}: ${JSON.stringify(itemToUpsert)}`); // logger -> console
      return itemToUpsert;
    });

    const resolved = await Promise.all(itemsToUpsertPromises);
    const itemsToUpsert = resolved.filter(Boolean) as any[];

    if (itemsToUpsert.length === 0) return { success: false, error: "No valid items" };

    console.info(`Upserting ${itemsToUpsert.length} items to Supabase.`); // logger -> console
    const { error } = await supabaseAdmin.from("cars").upsert(itemsToUpsert, { onConflict: "id" });

    if (error) throw error;

    return { success: true, message: `Upserted ${itemsToUpsert.length} items.` };
  } catch (error) {
    console.error("Upload error:", error); // logger -> console
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
      console.error(`Error fetching item ${itemId} for location update:`, selectError); // logger -> console
      return { success: false, error: `Failed to fetch item: ${selectError.message}` };
    }

    if (!existingItem?.specs) {
      console.warn(`Item ${itemId} not found or missing specs.`); // logger -> console
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
      console.error(`Error updating item ${itemId} location ${voxelId}:`, updateError); // logger -> console
      return { success: false, error: `Failed to update item: ${updateError.message}` };
    }

    console.info(`Successfully updated item ${itemId} location ${voxelId} by ${delta}. New total: ${totalQuantity}`); // logger -> console
    return { success: true };
  } catch (error) {
    console.error("Error in updateItemLocationQty:", error); // logger -> console
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
      console.error(`Error fetching item ${itemId} for min_qty update:`, selectError); // logger -> console
      return { success: false, error: `Failed to fetch item: ${selectError.message}` };
    }

    if (!existingItem?.specs) {
      console.warn(`Item ${itemId} not found or missing specs.`); // logger -> console
      return { success: false, error: "Item not found or missing specs." };
    }

    let specs = existingItem.specs;
    specs.min_quantity = Math.floor(minQty); // Floor to integer

    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs })
      .eq("id", itemId);

    if (updateError) {
      console.error(`Error updating item ${itemId} min_qty:`, updateError); // logger -> console
      return { success: false, error: `Failed to update item: ${updateError.message}` };
    }

    console.info(`Successfully updated item ${itemId} min_qty to ${minQty}.`); // logger -> console
    return { success: true };
  } catch (error) {
    console.error("Error in updateItemMinQty:", error); // logger -> console
    return { success: false, error: (error as Error).message };
  }
}

// WB Sync (to platform from Supabase)
export async function syncWbStocks(): Promise<{ success: boolean; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  const WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  console.info(`syncWbStocks start. WB_WAREHOUSE_ID present: ${!!WB_WAREHOUSE_ID}, WB_TOKEN present: ${!!WB_TOKEN}`); // logger -> console

  if (!WB_TOKEN || !WB_WAREHOUSE_ID) {
    console.error("WB credentials missing in env."); // logger -> console
    return { success: false, error: "WB credentials missing" };
  }

  try {
    const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
    if (error || !items) {
      console.error("syncWbStocks: failed to fetch local items", error); // logger -> console
      return { success: false, error: error?.message || "No items found" };
    }

    const stocks = items
      .map(i => {
        const sku = i.specs?.wb_sku as string | undefined;
        if (!sku) {
          console.warn(`Skipping item ${i.id} without wb_sku in specs.`); // logger -> console
          return null;
        }
        const amount = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
        const warehouseId = parseInt((i.specs?.wb_warehouse_id as string) || WB_WAREHOUSE_ID, 10);
        return { sku, amount, warehouseId };
      })
      .filter(Boolean) as { sku: string; amount: number; warehouseId: number }[];

    if (stocks.length === 0) {
      console.warn("No items with wb_sku to sync."); // logger -> console
      return { success: false, error: "No syncable items (check wb_sku setup)" };
    }

    const url = "https://suppliers-api.wildberries.ru/api/v3/stocks";
    const maskedToken = WB_TOKEN ? `${WB_TOKEN.slice(0, 6)}...` : "MISSING";

    console.info("syncWbStocks -> About to POST", { // logger -> console
      url,
      method: "POST",
      token: maskedToken,
      stocksCount: stocks.length,
      sampleStock: stocks[0] || null,
    });

    try {
      const lookup = await dns.lookup("suppliers-api.wildberries.ru");
      console.info("syncWbStocks DNS lookup result", lookup); // logger -> console
    } catch (dnsErr: any) {
      console.warn("syncWbStocks DNS lookup failed", dnsErr?.code || dnsErr?.message || dnsErr); // logger -> console
    }

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": WB_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res;
    });

    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("syncWbStocks: failed to parse JSON response", { text }); // logger -> console
      return { success: false, error: "Invalid JSON from WB" };
    }

    console.info("syncWbStocks response", { status: response.status, bodySample: JSON.stringify(parsed).slice(0, 2000) }); // logger -> console

    if (parsed?.error) {
      return { success: false, error: parsed?.errorText || parsed?.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("syncWbStocks error:", { // logger -> console
      message: err?.message,
      stack: err?.stack,
      cause: err?.cause,
    });
    return { success: false, error: err?.message || "Unknown error in syncWbStocks" };
  }
}

// Ozon Sync (to platform from Supabase)
export async function syncOzonStocks(): Promise<{ success: boolean; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  const OZON_WAREHOUSE_ID = process.env.OZON_WAREHOUSE_ID;
  if (!OZON_CLIENT_ID || !OZON_API_KEY || !OZON_WAREHOUSE_ID) return { success: false, error: "Ozon credentials missing" };

  const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
  if (error || !items) return { success: false, error: error?.message || "No items found" };

  const stocks = items.map(i => ({
    offer_id: (i.specs?.ozon_sku as string) || i.id,
    stock: (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0),
    warehouse_id: parseInt((i.specs?.ozon_warehouse_id as string) || OZON_WAREHOUSE_ID, 10),
  }));

  try {
    const response = await withRetry(async () => {
      const res = await fetch("https://api-seller.ozon.ru/v3/products/stocks", {
        method: "POST",
        headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res;
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("syncOzonStocks: failed to parse JSON response", { text }); // logger -> console
      return { success: false, error: "Invalid JSON from Ozon" };
    }

    if (data.result?.errors?.length > 0) return { success: false, error: data.result.errors[0].message };
    return { success: true };
  } catch (err: any) {
    console.error("syncOzonStocks error:", err); // logger -> console
    return { success: false, error: err.message };
  }
}

// New: Setup WB barcodes (sku) in Supabase specs
export async function setWbBarcodes(): Promise<{ success: boolean; updated?: number; error?: string }> {
  try {
    const cardsRes = await getWbProductCardsList();
    if (!cardsRes.success) return { success: false, error: cardsRes.error || "Failed to fetch WB cards" };

    const cards = cardsRes.data.cards || [];

    const localRes = await getWarehouseItems();
    if (!localRes.success) return { success: false, error: localRes.error || "Failed to fetch local items" };

    const updates: any[] = [];

    for (const card of cards) {
      const vc = (card.vendorCode || "").toLowerCase();
      const item = localRes.data?.find(i => i.id.toLowerCase() === vc);
      if (!item) {
        console.debug(`No local item for WB vendorCode ${vc}`); // logger -> console
        continue;
      }

      const sizes = Array.isArray(card.sizes) ? card.sizes : [];
      const barcodes: string[] = sizes.flatMap((size: any) => Array.isArray(size.skus) ? size.skus : []);

      if (barcodes.length === 0) {
        console.warn(`No barcodes for card ${vc}`); // logger -> console
        continue;
      }

      // Take first barcode as main wb_sku, save all as wb_barcodes
      const specs = { ...item.specs, wb_sku: barcodes[0], wb_barcodes: barcodes };

      updates.push({
        id: item.id,
        specs,
      });
    }

    if (updates.length > 0) {
      const { error } = await supabaseAdmin.from("cars").upsert(updates, { onConflict: "id" });
      if (error) throw error;
      console.info(`Updated ${updates.length} items with WB barcodes.`); // logger -> console
    } else {
      console.info("No updates needed for WB barcodes."); // logger -> console
    }

    return { success: true, updated: updates.length };
  } catch (e: any) {
    console.error("setWbBarcodes error:", e); // logger -> console
    return { success: false, error: e.message || "Unknown error setting WB barcodes" };
  }
}

// Helper: Retry wrapper for fetches
async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.warn(`Retry ${i + 1}/${retries} failed: ${e?.message || e}`); // logger -> console
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

// WB Fetch stocks (with retry and safe parse)
export async function fetchWbStocks(): Promise<{ success: boolean; data?: { sku: string; amount: number }[]; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  let WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  if (!WB_WAREHOUSE_ID) {
    const whRes = await getWbWarehouses();
    if (whRes.success) {
      WB_WAREHOUSE_ID = whRes.data?.find((w: any) => w.isActive)?.id.toString();
    }
  }
  console.info(`fetchWbStocks start. WB_WAREHOUSE_ID: ${WB_WAREHOUSE_ID ? WB_WAREHOUSE_ID : "MISSING"}, tokenPresent: ${!!WB_TOKEN}`); // logger -> console

  if (!WB_TOKEN || !WB_WAREHOUSE_ID) {
    console.error("fetchWbStocks: missing WB credentials"); // logger -> console
    return { success: false, error: "WB credentials missing" };
  }

  try {
    const { data: items } = await supabaseAdmin.from("cars").select("id, specs").eq("type", "wb_item");
    if (!items) {
      console.warn("fetchWbStocks: no local items returned from Supabase"); // logger -> console
      return { success: false, error: "No local items" };
    }

    const skus = items.map(i => (i.specs?.wb_sku as string) || i.id).filter(Boolean);
    if (skus.length === 0) {
      console.warn("fetchWbStocks: no skus/barcodes available"); // logger -> console
      return { success: false, error: "No skus for fetch (setup barcodes first)" };
    }

    const url = `https://suppliers-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`;
    const maskedToken = WB_TOKEN ? `${WB_TOKEN.slice(0, 6)}...` : "MISSING";

    console.info("fetchWbStocks -> About to POST", { // logger -> console
      url,
      method: "POST",
      token: maskedToken,
      skusCount: skus.length,
      sampleSkus: skus.slice(0, 20),
    });

    try {
      const lookup = await dns.lookup("suppliers-api.wildberries.ru");
      console.info("fetchWbStocks DNS lookup result", lookup); // logger -> console
    } catch (dnsErr: any) {
      console.warn("fetchWbStocks DNS lookup failed", { code: dnsErr?.code, message: dnsErr?.message }); // logger -> console
    }

    const bodyStr = JSON.stringify({ skus });

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": WB_TOKEN, "Content-Type": "application/json" },
        body: bodyStr,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`WB returned ${res.status}: ${errText}`);
      }
      return res;
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("fetchWbStocks: invalid JSON", { text }); // logger -> console
      return { success: false, error: "Invalid JSON from WB" };
    }

    if (!data || !Array.isArray(data.stocks)) {
      console.warn("fetchWbStocks: unexpected response shape", { sample: JSON.stringify(data).slice(0, 2000) }); // logger -> console
      return { success: false, error: "WB returned unexpected payload" };
    }

    const stocks = data.stocks.map((s: any) => ({ sku: s.sku, amount: s.amount }));
    console.info(`Fetched ${stocks.length} stocks from WB.`); // logger -> console
    return { success: true, data: stocks };
  } catch (err: any) {
    console.error("fetchWbStocks error:", { // logger -> console
      message: err?.message,
      stack: err?.stack,
      cause: err?.cause ? { code: err.cause?.code, syscall: err.cause?.syscall, hostname: err.cause?.hostname } : undefined,
    });
    return { success: false, error: err?.message || "Unknown error in fetchWbStocks" };
  }
}

// Ozon Fetch stocks (with retry and safe parse)
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

      const response = await withRetry(async () => {
        const res = await fetch("https://api-seller.ozon.ru/v4/product/info/stocks", {
          method: "POST",
          headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Ozon returned ${res.status}: ${errText}`);
        }
        return res;
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("fetchOzonStocks: invalid JSON", { text }); // logger -> console
        return { success: false, error: "Invalid JSON from Ozon" };
      }

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

    console.info(`Fetched ${allStocks.length} stocks from Ozon.`); // logger -> console
    return { success: true, data: allStocks };
  } catch (err: any) {
    console.error("fetchOzonStocks error:", err); // logger -> console
    return { success: false, error: err.message };
  }
}

// Get warehouses list (suppliers-api)
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
    return { success: true, data };  // data: [{id, name, officeId, isActive, ...}]
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

// Ozon: Fetch product list with pagination
export async function getOzonProductList(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) {
    console.warn("No Ozon keys, skipping fetch"); // logger -> console
    return { success: false, error: "Ozon credentials missing" };
  }

  try {
    let allItems: any[] = [];
    let last_id = "";
    const limit = 1000;

    while (true) {
      const body = { filter: {}, last_id, limit };
      const response = await withRetry(async () => {
        const res = await fetch("https://api-seller.ozon.ru/v3/product/list", {
          method: "POST",
          headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Ozon returned ${res.status}: ${errText}`);
        }
        return res;
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("getOzonProductList: invalid JSON", { text }); // logger -> console
        return { success: false, error: "Invalid JSON from Ozon" };
      }

      allItems = [...allItems, ...data.result.items];
      last_id = data.result.last_id;
      if (!last_id) break;
    }

    console.info(`Fetched ${allItems.length} products from Ozon.`); // logger -> console
    return { success: true, data: allItems };  // [{offer_id, product_id, ...}]
  } catch (err: any) {
    console.error("getOzonProductList error:", err); // logger -> console
    return { success: false, error: (err as Error).message };
  }
}

// parseOzonToMinimal (keeps current behavior)
async function parseOzonToMinimal(products: any[], stocks: { sku: string; amount: number }[]): Promise<{ [offerId: string]: { product_id?: number; quantity: number } }> {
  const map: { [offerId: string]: { product_id?: number; quantity: number } } = {};

  products.forEach((prod: any) => {
    const offerId = prod.offer_id.toLowerCase();
    const stock = stocks.find(s => s.sku.toLowerCase() === offerId);
    map[offerId] = { product_id: prod.product_id, quantity: stock?.amount || 0 };
  });

  return map;
}

// extract IDs from sources
export async function extractIdsFromSources(): Promise<{
  success: boolean;
  wbIds: Set<string>;
  ozonIds: Set<string>;
  supaIds: Set<string>;
  unmatched: { wb: string[]; ozon: string[]; supa: string[] };
  error?: string;
}> {
  try {
    const wbRes = await getWbProductCardsList();
    if (!wbRes.success) throw new Error(wbRes.error || "WB fetch failed");
    const wbIds = new Set((wbRes.data?.cards || []).map((c: any) => c.vendorCode.toLowerCase()));

    const ozonRes = await getOzonProductList();
    const ozonIds = new Set((ozonRes.data || []).map((p: any) => p.offer_id.toLowerCase()));

    const supaRes = await getWarehouseItems();
    if (!supaRes.success) throw new Error(supaRes.error || "Supa fetch failed");
    const supaIds = new Set((supaRes.data || []).map((i: any) => i.id.toLowerCase()));

    const unmatchedWb = [...wbIds].filter(id => !supaIds.has(id));
    const unmatchedOzon = [...ozonIds].filter(id => !supaIds.has(id));
    const unmatchedSupa = [...supaIds].filter(id => !wbIds.has(id) && !ozonIds.has(id));

    return {
      success: true,
      wbIds,
      ozonIds,
      supaIds,
      unmatched: { wb: unmatchedWb, ozon: unmatchedOzon, supa: unmatchedSupa },
    };
  } catch (e: any) {
    return { success: false, wbIds: new Set(), ozonIds: new Set(), supaIds: new Set(), unmatched: { wb: [], ozon: [], supa: [] }, error: e.message };
  }
}

// Simplified generateUpdateSql (production-safe): does not call heavy warehouse enumeration.
// Uses vendorCode -> nmID mapping from WB cards and local items. Quantities are best-effort (0 if unknown).
async function generateUpdateSql(manualMap: { wb: { [key: string]: string }; ozon: { [key: string]: string } } = { wb: {}, ozon: {} }): Promise<string> {
  const wbWhRes = await getWbWarehouses();
  const wbWhId = process.env.WB_WAREHOUSE_ID || (wbWhRes.success && wbWhRes.data?.find((w: any) => w.isActive)?.id) || "12345";
  const ozonWhId = process.env.OZON_WAREHOUSE_ID || "67890";

  const cardsRes = await getWbProductCardsList();
  if (!cardsRes.success) return "-- Error fetching WB cards";
  const cards = cardsRes.data.cards || [];

  // Build simple wbMap: vendorCode -> { nmID, quantity: 0 }
  const wbMapSimple: { [k: string]: { nmID: number; quantity: number } } = {};
  cards.forEach((c: any) => {
    const vc = (c.vendorCode || "").toLowerCase();
    wbMapSimple[vc] = { nmID: c.nmID, quantity: 0 }; // qty unknown here (use 0)
  });

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

    // Try to find a wb vendor that was manually mapped to this local item
    let wbVendor: string | undefined;
    if (manualMap && manualMap.wb) {
      wbVendor = Object.keys(manualMap.wb).find(k => {
        const v = manualMap.wb[k];
        if (!v) return false;
        return v === item.id || v === idLower;
      });
    }

    // Fallback: assume local id equals vendor code
    const effectiveWbVendor = (wbVendor || idLower).toLowerCase();
    const effectiveOzonOffer = (Object.keys(manualMap?.ozon || {}).find(k => (manualMap!.ozon[k] === item.id || manualMap!.ozon[k] === idLower)) || idLower).toLowerCase();

    const wb = wbMapSimple[effectiveWbVendor] || {};
    const ozon = ozonMap[effectiveOzonOffer] || {};

    // If both unmatched, skip with comment
    if ((!wb || !wb.nmID) && (!ozon || !ozon.product_id)) {
      sqlLines.push(`-- Skipped unmatched for '${item.id}'`);
      return;
    }

    const json: any = {
      wb_sku: wb.nmID || item.id,
      ozon_sku: ozon.product_id || item.id,
      wb_warehouse_id: wbWhId,
      ozon_warehouse_id: ozonWhId,
      wb_api_quantity: wb.quantity || 0,
      ozon_api_quantity: ozon.quantity || 0,
    };

    const jsonStr = JSON.stringify(json).replace(/'/g, "''"); // escape single quotes for SQL literal
    sqlLines.push(
      `UPDATE public.cars SET specs = specs || '${jsonStr}'::jsonb WHERE id = '${item.id}' AND type = 'wb_item';`
    );
  });

  return sqlLines.join("\n");
}

export async function getWarehouseSql(manualMap?: { wb: { [key: string]: string }; ozon: { [key: string]: string } }): Promise<{ success: boolean; sql?: string; error?: string }> {
  try {
    const sql = await generateUpdateSql(manualMap || { wb: {}, ozon: {} });
    return { success: true, sql };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}