"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";
import type { WarehouseItem } from "@/app/wb/common";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { getWbProductCardsList } from "@/app/wb/content-actions";
import Papa from "papaparse";
import dns from "dns/promises";

/**
 * Utilities
 */
type Maybe<T> = T | null | undefined;

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.warn(`Retry ${i + 1}/${retries} failed: ${e?.message || e}`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

function decodeJwtPayloadSafe(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url -> base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    console.warn('decodeJwtPayloadSafe failed:', e?.message || e);
    return null;
  }
}

// WB token diagnostics: decode JWT + ping marketplace + warehouses
async function validateWbToken(WB_TOKEN: string): Promise<{ ok: boolean; warehouseId?: string; isTest?: boolean; reason?: string; payload?: any; warehouses?: any[]; requestId?: string; timestamp?: string }> {
  try {
    if (!WB_TOKEN) return { ok: false, reason: 'no_token' };

    // Decode JWT payload using safe helper
    let payload: any = null;
    try {
      payload = decodeJwtPayloadSafe(WB_TOKEN);
    } catch (e) {
      console.warn('WB token decode ended with exception', e?.message || e);
    }

    const isTest = !!payload?.t;
    console.info('WB token diagnostics:', { sid: payload?.sid, isTest });

    if (isTest) {
      console.warn('WB token is test/sandbox — use prod for live sync');
    }

    // Ping marketplace-api
    const pingRes = await fetch('https://marketplace-api.wildberries.ru/ping', {
      method: 'GET',
      headers: { Authorization: WB_TOKEN },
    });
    if (!pingRes.ok) {
      const text = await pingRes.text().catch(() => '');
      console.error('WB ping failed:', { status: pingRes.status, text });
      return { ok: false, reason: 'ping_failed', status: pingRes.status, text, payload };
    }

    // Fetch warehouses for validation/fallback
    const whRes = await getWbWarehouses();
    if (!whRes.success || !Array.isArray(whRes.data) || whRes.data.length === 0) {
      return { ok: false, reason: 'no_warehouses' };
    }
    const warehouses = whRes.data;
    console.info('WB warehouses fetched:', { count: warehouses.length, active: warehouses.filter((w: any) => w.isActive).length });

    // Use env if valid, else first one (even if not active, warn)
    let warehouseId = process.env.WB_WAREHOUSE_ID;
    if (!warehouseId || !warehouses.some((w: any) => String(w.id) === warehouseId)) {
      if (warehouses.length === 0) {
        return { ok: false, reason: 'no_warehouses' };
      }
      warehouseId = String(warehouses[0].id);
      console.warn('Fallback to first warehouseId (may not be active):', warehouseId);
    } else if (!warehouses.find((w: any) => String(w.id) === warehouseId)?.isActive) {
      console.warn('Using env warehouseId, but not active:', warehouseId);
    }

    return { ok: true, warehouseId, payload, isTest, warehouses };
  } catch (e: any) {
    return { ok: false, reason: 'exception', message: e?.message || e };
  }
}

/* =========================
   Core: Warehouse CRUD & CSV upload
   ========================= */

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
    console.info(`Fetched ${data?.length || 0} warehouse items from Supabase.`);
    return { success: true, data };
  } catch (error: any) {
    console.error("[getWarehouseItems] Error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

async function verifyAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("status")
    .eq("user_id", userId)
    .single();
  if (error || !user) return false;
  return user.status === "admin";
}

export async function uploadWarehouseCsv(
  batch: any[],
  userId: string | undefined
): Promise<{ success: boolean; message?: string; error?: string }> {
  const isAdmin = await verifyAdmin(userId);
  if (!isAdmin) {
    console.warn(`Unauthorized warehouse CSV upload by ${userId || "Unknown"}`);
    return { success: false, error: "Permission denied. Admin required." };
  }

  if (!batch || batch.length === 0) {
    return { success: false, error: "Empty batch provided." };
  }

  try {
    const itemIds = batch.map((row: any) => (row["Артикул"] || row["id"])?.toLowerCase()).filter(Boolean);
    console.info(`Fetching existing items for ${itemIds.length} IDs.`);
    const { data: existingItems } = await supabaseAdmin.from("cars").select("*").in("id", itemIds);

    const itemsToUpsertPromises = batch.map(async (row: any) => {
      const itemId = (row["Артикул"] || row["id"])?.toLowerCase();
      if (!itemId) {
        console.warn(`Skipping row without id/Артикул: ${JSON.stringify(row)}`);
        return null;
      }

      const existingItem = existingItems?.find((item) => item.id === itemId);
      const derived = { make: row.make || "Unknown Make", model: row.model || "Unknown Model", description: row.description || "No Description" };

      let specs: any = row.specs ? (typeof row.specs === "string" ? JSON.parse(row.specs) : row.specs) : { warehouse_locations: [] };
      let quantity = parseInt(row["Количество"] || row.quantity || "0", 10) || 0;

      if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];
      if (specs.warehouse_locations.length === 0) {
        specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
      } else {
        specs.warehouse_locations[0].quantity = quantity;
      }

      if (!specs.wb_warehouse_id && process.env.WB_WAREHOUSE_ID) specs.wb_warehouse_id = process.env.WB_WAREHOUSE_ID;
      if (!specs.ozon_warehouse_id && process.env.OZON_WAREHOUSE_ID) specs.ozon_warehouse_id = process.env.OZON_WAREHOUSE_ID;

      const itemToUpsert: any = {
        id: itemId,
        make: derived.make,
        model: derived.model,
        description: derived.description,
        type: "wb_item",
        specs,
        image_url: row.image_url || `/api/images/${itemId}.jpg`,
      };

      if (!existingItem) {
        itemToUpsert.specs = { ...itemToUpsert.specs, status: "new item", created_at: new Date().toISOString() };
      } else {
        itemToUpsert.specs = { ...existingItem.specs, ...itemToUpsert.specs };
      }

      console.info(`Prepared upsert for ${itemId} with quantity ${quantity}`);
      return itemToUpsert;
    });

    const resolved = await Promise.all(itemsToUpsertPromises);
    const itemsToUpsert = resolved.filter(Boolean) as any[];

    if (itemsToUpsert.length === 0) return { success: false, error: "No valid items" };

    console.info(`Upserting ${itemsToUpsert.length} items to Supabase.`);
    const { error } = await supabaseAdmin.from("cars").upsert(itemsToUpsert, { onConflict: "id" });
    if (error) throw error;

    return { success: true, message: `Upserted ${itemsToUpsert.length} items.` };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error?.message || "Unknown upload error" };
  }
}

/* =========================
   Update single location qty
   ========================= */

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
      console.error(`Error fetching item ${itemId} for location update:`, selectError);
      return { success: false, error: `Failed to fetch item: ${selectError.message}` };
    }

    if (!existingItem?.specs) {
      console.warn(`Item ${itemId} not found or missing specs.`);
      return { success: false, error: "Item not found or missing specs." };
    }

    let specs = existingItem.specs;

    if (!Array.isArray(specs.warehouse_locations)) specs.warehouse_locations = [];

    let location = specs.warehouse_locations.find((l: any) => l.voxel_id === voxelId);
    if (!location) {
      location = { voxel_id: voxelId, quantity: 0 };
      specs.warehouse_locations.push(location);
    }

    location.quantity = Math.max(0, (location.quantity || 0) + delta);

    specs.warehouse_locations = specs.warehouse_locations.filter((l: any) => l.quantity > 0);

    const totalQuantity = specs.warehouse_locations.reduce((acc: number, l: any) => acc + l.quantity, 0);

    const { error: updateError } = await supabaseAdmin.from("cars").update({ specs }).eq("id", itemId);

    if (updateError) {
      console.error(`Error updating item ${itemId} location ${voxelId}:`, updateError);
      return { success: false, error: `Failed to update item: ${updateError.message}` };
    }

    console.info(`Successfully updated item ${itemId} location ${voxelId} by ${delta}. New total: ${totalQuantity}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateItemLocationQty:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

/* =========================
   CSV Export helpers
   ========================= */

export async function exportDiffToAdmin(diffData: any[], isTelegram = false): Promise<{ success: boolean; csv?: string }> {
  let csvData = "\uFEFF" + Papa.unparse(diffData.map((d) => ({ Артикул: d.id, Изменение: d.diffQty, Ячейка: d.voxel })), { header: true, delimiter: ",", quotes: true });

  if (isTelegram) {
    return { success: true, csv: csvData };
  } else {
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Изменения склада в CSV.", [], {
      attachment: { type: "document", content: csvData, filename: "warehouse_diff.csv" },
    });
    return { success: true, csv: csvData };
  }
}

export async function exportCurrentStock(items: any[], isTelegram = false, summarized = false): Promise<{ success: boolean; csv?: string }> {
  let csvData;
  if (summarized) {
    const stockData = items.map((item) => ({ Артикул: item.id, Количество: item.total_quantity }));
    csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: ",", quotes: true });
  } else {
    const stockData = items.map((item) => ({
      Артикул: item.id,
      Название: item.name,
      "Общее Количество": item.total_quantity,
      Локации: item.locations.map((l: any) => `${l.voxel}:${l.quantity}`).join(", "),
    }));
    csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: ",", quotes: true });
  }

  if (isTelegram) {
    return { success: true, csv: csvData };
  } else {
    await sendComplexMessage(process.env.ADMIN_CHAT_ID || "413553377", "Текущее состояние склада в CSV.", [], {
      attachment: { type: "document", content: csvData, filename: "warehouse_stock.csv" },
    });
    return { success: true, csv: csvData };
  }
}

/* =========================
   Update min qty
   ========================= */

export async function updateItemMinQty(itemId: string, minQty: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existingItem, error: selectError } = await supabaseAdmin.from("cars").select("specs").eq("id", itemId).single();
    if (selectError) {
      console.error(`Error fetching item ${itemId} for min_qty update:`, selectError);
      return { success: false, error: `Failed to fetch item: ${selectError.message}` };
    }
    if (!existingItem?.specs) {
      console.warn(`Item ${itemId} not found or missing specs.`);
      return { success: false, error: "Item not found or missing specs." };
    }
    let specs = existingItem.specs;
    specs.min_quantity = Math.floor(minQty);
    const { error: updateError } = await supabaseAdmin.from("cars").update({ specs }).eq("id", itemId);
    if (updateError) {
      console.error(`Error updating item ${itemId} min_qty:`, updateError);
      return { success: false, error: `Failed to update item: ${updateError.message}` };
    }
    console.info(`Successfully updated item ${itemId} min_qty to ${minQty}.`);
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateItemMinQty:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

/* =======================
   Wildberries sync (send stocks) - FIXED: v3 PUT /api/v3/stocks/{warehouseId}
   ======================= */

export async function syncWbStocks(): Promise<{ success: boolean; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  console.info(`syncWbStocks start. WB_TOKEN present: ${!!WB_TOKEN}`);

  if (!WB_TOKEN) {
    console.error("WB credentials missing in env.");
    return { success: false, error: "WB credentials missing" };
  }

  // Validate token and get warehouseId
  const diag = await validateWbToken(WB_TOKEN);
  if (!diag.ok) {
    console.error('WB diagnostics failed:', diag);
    return { success: false, error: `WB validation failed: ${diag.reason} - ${diag.message || diag.text || 'check logs'}` };
  }
  const WB_WAREHOUSE_ID = diag.warehouseId!;

  try {
    const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
    if (error || !items) {
      console.error("syncWbStocks: failed to fetch local items", error);
      return { success: false, error: error?.message || "No items found" };
    }

    const stocks = items
      .map((i) => {
        const sku = i.specs?.wb_sku as string | undefined;
        if (!sku) {
          console.warn(`Skipping item ${i.id} without wb_sku in specs.`);
          return null;
        }
        const amount = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
        const warehouseId = parseInt((i.specs?.wb_warehouse_id as string) || WB_WAREHOUSE_ID, 10);
        return { sku, amount, warehouseId };
      })
      .filter(Boolean) as { sku: string; amount: number; warehouseId: number }[];

    if (stocks.length === 0) {
      console.warn("No items with wb_sku to sync.");
      return { success: false, error: "No syncable items (check wb_sku setup)" };
    }

    const url = `https://marketplace-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`;
    const maskedToken = WB_TOKEN ? `${WB_TOKEN.slice(0, 6)}...` : "MISSING";
    const body = { stocks: stocks.map(s => ({ sku: s.sku, amount: s.amount })) };

    console.info("syncWbStocks -> About to PUT v3", {
      url,
      method: "PUT",
      token: maskedToken,
      stocksCount: stocks.length,
      sampleStock: stocks[0] || null,
      sampleBody: JSON.stringify(body).slice(0, 500) + "...",
      warehouseId: WB_WAREHOUSE_ID
    });

    try {
      const lookup = await dns.lookup("marketplace-api.wildberries.ru");
      console.info("syncWbStocks DNS lookup result", lookup);
    } catch (dnsErr: any) {
      console.warn("syncWbStocks DNS lookup failed", dnsErr?.code || dnsErr?.message || dnsErr);
    }

    try {
      const response = await withRetry(async () => {
        const res = await fetch(url, {
          method: "PUT",
          headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok && res.status >= 500) { // Retry only on server errors
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText}`);
        }
        if (!res.ok) {
          const errText = await res.text();
          const requestId = errText.match(/"requestId": "([a-f0-9-]+)"/)?.[1] || 'unknown';
          const timestamp = errText.match(/"timestamp": "([0-9T:Z-]+)"/)?.[1] || 'unknown';
          console.error("syncWbStocks: non-OK response", { status: res.status, errText, requestId, timestamp });
          return { ok: false, status: res.status, text: errText, requestId, timestamp };
        }
        return { ok: true, res };
      });

      if (!response.ok) {
        return { success: false, error: `WB API error: ${response.status} - ${response.text} (requestId: ${response.requestId || 'unknown'}, timestamp: ${response.timestamp || 'unknown'})` };
      }

      const text = await response.res.text();
      let parsed;
      try {
        parsed = JSON.parse(text || "{}");
      } catch (e) {
        console.error("syncWbStocks: failed to parse JSON response", { text });
        return { success: false, error: "Invalid JSON from WB" };
      }

      console.info("syncWbStocks response", { status: (parsed && (parsed.status || "unknown")) || response.res.status, bodySample: JSON.stringify(parsed).slice(0, 2000) });

      if (parsed?.error) {
        return { success: false, error: parsed?.errorText || parsed?.error };
      }

      return { success: true };
    } catch (err: any) {
      console.error("syncWbStocks error (after retries):", { message: err?.message, stack: err?.stack });
      return { success: false, error: err?.message || "Unknown error in syncWbStocks" };
    }
  } catch (err: any) {
    console.error("syncWbStocks outer error:", err);
    return { success: false, error: err?.message || "Unknown error in syncWbStocks" };
  }
}

/* =======================
   Ozon sync (import stocks) - FIXED: v2 POST /v2/products/stocks + product_id mapping
   ======================= */

let ozonProductCache: { [offer_id: string]: number } | null = null; // Cache product_id by offer_id

export async function syncOzonStocks(): Promise<{ success: boolean; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  const OZON_WAREHOUSE_ID = process.env.OZON_WAREHOUSE_ID;
  if (!OZON_CLIENT_ID || !OZON_API_KEY || !OZON_WAREHOUSE_ID) return { success: false, error: "Ozon credentials missing" };

  const { data: items, error } = await supabaseAdmin.from("cars").select("*").eq("type", "wb_item");
  if (error || !items) return { success: false, error: error?.message || "No items found" };

  // Fetch/cache product_ids
  if (!ozonProductCache) {
    const prodRes = await getOzonProductList();
    if (prodRes.success && prodRes.data) {
      ozonProductCache = {};
      prodRes.data.forEach((p: any) => {
        ozonProductCache[p.offer_id] = p.product_id;
      });
      console.info(`Ozon product cache built: ${Object.keys(ozonProductCache).length} offer_ids mapped`);
    } else {
      console.error("Failed to fetch Ozon products for mapping");
      return { success: false, error: "Failed to map offer_id to product_id" };
    }
  }

  const stocks = items
    .map((i) => {
      const offer_id = i.specs?.ozon_sku as string | undefined;
      if (!offer_id) {
        console.warn(`Skipping item ${i.id} without ozon_sku in specs.`);
        return null;
      }
      const product_id = ozonProductCache[offer_id];
      if (!product_id) {
        console.warn(`Skipping item ${i.id}: no product_id for offer_id ${offer_id}`);
        return null;
      }
      const stock = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
      const warehouse_id = parseInt((i.specs?.ozon_warehouse_id as string) || OZON_WAREHOUSE_ID, 10);
      return { offer_id, product_id, stock, warehouse_id };
    })
    .filter(Boolean) as { offer_id: string; product_id: number; stock: number; warehouse_id: number }[];

  if (stocks.length === 0) {
    console.warn("No items with ozon_sku and product_id to sync.");
    return { success: false, error: "No syncable items (check ozon_sku setup and mapping)" };
  }

  // v2 endpoint
  const url = "https://api-seller.ozon.ru/v2/products/stocks";
  console.info("syncOzonStocks -> About to POST", { url, count: stocks.length, sample: stocks[0] });

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      if (!res.ok && res.status >= 500) { // Retry only on server errors
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, status: res.status, text: errText }; // Don't throw, handle below
      }
      return { ok: true, res };
    });

    if (!response.ok) {
      console.error("syncOzonStocks: API returned non-OK", { status: response.status, text: response.text });
      return { success: false, error: `Ozon API error: ${response.status} - ${response.text}` };
    }

    const text = await response.res.text();
    let data;
    try {
      data = JSON.parse(text || "{}");
    } catch (e) {
      console.error("syncOzonStocks: failed to parse JSON response", { text });
      return { success: false, error: "Invalid JSON from Ozon" };
    }

    if (data.result?.errors?.length > 0) {
      console.error("syncOzonStocks -> Ozon returned errors:", data.result.errors);
      return { success: false, error: data.result.errors[0].message || "Ozon error" };
    }

    console.info("syncOzonStocks successful", { sample: JSON.stringify(data).slice(0, 2000) });
    return { success: true };
  } catch (err: any) {
    console.error("syncOzonStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in syncOzonStocks" };
  }
}

/* =======================
   Fetch helpers: WB & Ozon reads
   ======================= */

export async function fetchWbStocks(): Promise<{ success: boolean; data?: { sku: string; amount: number }[]; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  let WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  if (!WB_WAREHOUSE_ID) {
    const whRes = await getWbWarehouses();
    if (whRes.success) WB_WAREHOUSE_ID = whRes.data?.find((w: any) => w.isActive)?.id.toString();
  }
  console.info(`fetchWbStocks start. WB_WAREHOUSE_ID: ${WB_WAREHOUSE_ID ? WB_WAREHOUSE_ID : "MISSING"}, tokenPresent: ${!!WB_TOKEN}`);

  if (!WB_TOKEN || !WB_WAREHOUSE_ID) return { success: false, error: "WB credentials missing" };

  try {
    const { data: items } = await supabaseAdmin.from("cars").select("id, specs").eq("type", "wb_item");
    if (!items) return { success: false, error: "No local items" };

    const skus = items.map((i) => (i.specs?.wb_sku as string) || i.id).filter(Boolean);
    if (skus.length === 0) return { success: false, error: "No skus for fetch (setup barcodes first)" };

    const url = `https://marketplace-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`;
    console.info("fetchWbStocks -> About to POST", { url, skusCount: skus.length, sampleSkus: skus.slice(0, 20) });

    try {
      const lookup = await dns.lookup("marketplace-api.wildberries.ru");
      console.info("fetchWbStocks DNS lookup result", lookup);
    } catch (dnsErr: any) {
      console.warn("fetchWbStocks DNS lookup failed", { code: dnsErr?.code, message: dnsErr?.message });
    }

    const bodyStr = JSON.stringify({ skus });

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
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
      data = JSON.parse(text || "{}");
    } catch (e) {
      console.error("fetchWbStocks: invalid JSON", { text });
      return { success: false, error: "Invalid JSON from WB" };
    }

    if (!data || !Array.isArray(data.stocks)) {
      console.warn("fetchWbStocks: unexpected response shape", { sample: JSON.stringify(data).slice(0, 2000) });
      return { success: false, error: "WB returned unexpected payload" };
    }

    const stocks = data.stocks.map((s: any) => ({ sku: s.sku, amount: s.amount }));
    console.info(`Fetched ${stocks.length} stocks from WB.`);
    return { success: true, data: stocks };
  } catch (err: any) {
    console.error("fetchWbStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in fetchWbStocks" };
  }
}

export async function fetchOzonStocks(): Promise<{ success: boolean; data?: { sku: string; amount: number }[]; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, error: "Ozon credentials missing" };

  try {
    const { data: items } = await supabaseAdmin.from("cars").select("id, specs").eq("type", "wb_item");
    if (!items) return { success: false, error: "No local items" };

    const offerIds = items.map((i) => (i.specs?.ozon_sku as string) || i.id);
    let allStocks: { sku: string; amount: number }[] = [];
    let lastId = "";
    const limit = 1000;

    while (true) {
      const body = { filter: { offer_id: offerIds, visibility: "ALL" }, last_id: lastId, limit };
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
        data = JSON.parse(text || "{}");
      } catch (e) {
        console.error("fetchOzonStocks: invalid JSON parse", { text });
        return { success: false, error: "Invalid JSON from Ozon" };
      }

      if (!data || !Array.isArray(data.items)) {
        console.warn("fetchOzonStocks: unexpected response shape", { sample: JSON.stringify(data).slice(0, 2000) };
        return { success: false, error: "Ozon returned unexpected payload" };
      }

      const itemsStocks = data.items.flatMap((item: any) =>
        item.stocks.map((stock: any) => ({ sku: item.offer_id, amount: stock.present - stock.reserved }))
      );

      allStocks = [...allStocks, ...itemsStocks];

      lastId = data.last_id;
      if (!lastId || data.total < limit) break;
    }

    console.info(`Fetched ${allStocks.length} stocks from Ozon.`);
    return { success: true, data: allStocks };
  } catch (err: any) {
    console.error("fetchOzonStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in fetchOzonStocks" };
  }
}

/* =======================
   Support: getWbWarehouses, getOzonProductList, parse helpers
   ======================= */

export async function getWbWarehouses(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const token = process.env.WB_API_TOKEN;
  if (!token) return { success: false, error: "WB_API_TOKEN missing" };

  try {
    const res = await fetch("https://marketplace-api.wildberries.ru/api/v3/warehouses", {
      headers: { Authorization: token },
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

export async function getOzonProductList(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) {
    console.warn("No Ozon keys, skipping fetch");
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
        data = JSON.parse(text || "{}");
      } catch (e) {
        console.error("getOzonProductList: invalid JSON", { text });
        return { success: false, error: "Invalid JSON from Ozon" };
      }

      allItems = [...allItems, ...(data.result?.items || [])];
      last_id = data.result?.last_id || "";
      if (!last_id) break;
    }

    console.info(`Fetched ${allItems.length} products from Ozon.`);
    return { success: true, data: allItems };
  } catch (err: any) {
    console.error("getOzonProductList error:", err);
    return { success: false, error: err?.message || "Unknown error in getOzonProductList" };
  }
}

async function parseOzonToMinimal(products: any[], stocks: { sku: string; amount: number }[]): Promise<{ [offerId: string]: { product_id?: number; quantity: number } }> {
  const map: { [offerId: string]: { product_id?: number; quantity: number } } = {};

  products.forEach((prod: any) => {
    const offerId = prod.offer_id.toLowerCase();
    const stock = stocks.find(s => s.sku.toLowerCase() === offerId);
    map[offerId] = { product_id: prod.product_id, quantity: stock?.amount || 0 };
  });

  return map;
}

/* =======================
   Cross-source helpers: extractIds, SQL generation
   ======================= */

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

  const wbMap: { [k: string]: { nmID: number; barcodes: string[]; quantity: number } } = {};
  cards.forEach((c: any) => {
    const vc = (c.vendorCode || "").toLowerCase();
    const barcodes: string[] = Array.isArray(c.sizes) ? c.sizes.flatMap((size: any) => Array.isArray(size.skus) ? size.skus : []) : [];
    wbMap[vc] = { nmID: c.nmID, barcodes, quantity: 0 };
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

    let wbVendor: string | undefined;
    if (manualMap && manualMap.wb) {
      wbVendor = Object.keys(manualMap.wb).find(k => {
        const v = manualMap.wb[k];
        if (!v) return false;
        return v === item.id || v === idLower;
      });
    }

    const effectiveWbVendor = (wbVendor || idLower).toLowerCase();
    const effectiveOzonOffer = (Object.keys(manualMap?.ozon || {}).find(k => (manualMap!.ozon[k] === item.id || manualMap!.ozon[k] === idLower)) || idLower).toLowerCase();

    const wb = wbMap[effectiveWbVendor] || {};
    const ozon = ozonMap[effectiveOzonOffer] || {};

    if ((!wb.barcodes || !Array.isArray(wb.barcodes) || wb.barcodes.length === 0) && (!ozon.product_id)) {
      sqlLines.push(`-- Skipped unmatched for '${item.id}'`);
      return;
    }

    sqlLines.push(`-- Update for ${item.id} (WB vendor: ${effectiveWbVendor || 'none'}, Ozon offer: ${effectiveOzonOffer || 'none'})`);

    const json: any = {
      wb_sku: wb.barcodes?.[0] || item.id,
      wb_barcodes: wb.barcodes || [],
      ozon_sku: ozon.product_id || item.id,
      wb_warehouse_id: wbWhId,
      ozon_warehouse_id: ozonWhId,
    };

    const jsonStr = JSON.stringify(json).replace(/'/g, "''");
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

/* =======================
   Optional: setWbBarcodes helper (fetch cards -> upsert barcodes into local specs)
   ======================= */

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
        console.debug(`No local item for WB vendorCode ${vc}`);
        continue;
      }

      const sizes = Array.isArray(card.sizes) ? card.sizes : [];
      const barcodes: string[] = sizes.flatMap((size: any) => Array.isArray(size.skus) ? size.skus : []);

      if (barcodes.length === 0) {
        console.warn(`No barcodes for card ${vc}`);
        continue;
      }

      const specs = { ...item.specs, wb_sku: barcodes[0], wb_barcodes: barcodes };

      updates.push({
        id: item.id,
        make: item.make,
        model: item.model,
        description: item.description,
        type: item.type,
        specs,
        image_url: item.image_url,
      });
    }

    if (updates.length > 0) {
      const { error } = await supabaseAdmin.from("cars").upsert(updates, { onConflict: "id" });
      if (error) throw error;
      console.info(`Updated ${updates.length} items with WB barcodes.`);
    } else {
      console.info("No updates needed for WB barcodes.");
    }

    return { success: true, updated: updates.length };
  } catch (e: any) {
    console.error("setWbBarcodes error:", e);
    return { success: false, error: e.message || "Unknown error setting WB barcodes" };
  }
}

/* =======================
   Pending Count Fetchers
   ======================= */

export async function fetchWbPendingCount(): Promise<{ success: boolean; count: number; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  const WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  if (!WB_TOKEN || !WB_WAREHOUSE_ID) return { success: false, count: 0, error: "WB credentials missing" };

  try {
    const url = 'https://marketplace-api.wildberries.ru/api/v4/fbs/posting/list';
    const body = {
      filter: { status: 'awaiting_packaging' },
      limit: 1, // Just to get total
      next: 0
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, count: 0, error: `WB: ${res.status} - ${text}` };
    }

    const data = await res.json();
    const total = data?.total || 0;
    return { success: true, count: total };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

export async function fetchOzonPendingCount(): Promise<{ success: boolean; count: number; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, count: 0, error: "Ozon credentials missing" };

  try {
    const url = 'https://api-seller.ozon.ru/v3/posting/fbs/list';
    const body = {
      dir: 'ASC',
      filter: { status: 'awaiting_packaging' },
      limit: 1, // Just for total
      offset: 0
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Client-Id': OZON_CLIENT_ID, 'Api-Key': OZON_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, count: 0, error: `Ozon: ${res.status} - ${text}` };
    }

    const data = await res.json();
    const total = data?.result?.total || 0;
    return { success: true, count: total };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/* =======================
   End of file
   ======================= */