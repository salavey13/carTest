"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { unstable_noStore as noStore } from "next/cache";

async function resolveCrewBySlug(slug: string) {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Crew '${slug}' not found`);
  return data;
}

function getCrewEnvVar(slug: string, baseName: string) {
  const suffix = slug.toUpperCase().replace(/-/g, "_");
  const key = `${baseName}_${suffix}`;
  const value = process.env[key];
  if (!value) {
    throw new Error(`Env var ${key} not found for crew ${slug}. Set it in Vercel env variables.`);
  }
  return value;
}

async function getCrewItems(slug: string) {
  const crew = await resolveCrewBySlug(slug);
  const { data, error } = await supabaseAdmin
    .from("cars")
    .select("*")
    .eq("type", "wb_item")
    .eq("crew_id", crew.id);
  if (error) throw error;
  return data || [];
}

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

export async function syncCrewWbStocks(slug: string) {
  let WB_TOKEN;
  let WB_WAREHOUSE_ID;
  try {
    WB_TOKEN = getCrewEnvVar(slug, "WB_API_TOKEN");
    WB_WAREHOUSE_ID = getCrewEnvVar(slug, "WB_WAREHOUSE_ID");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const items = await getCrewItems(slug);
  if (items.length === 0) return { success: false, error: "No items for this crew" };

  const stocks = items
    .map((i) => {
      const sku = i.specs?.wb_sku as string | undefined;
      if (!sku) return null;
      const amount = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
      const warehouseId = (i.specs?.wb_warehouse_id as string) || WB_WAREHOUSE_ID || "";
      if (!warehouseId) return null;
      return { sku, amount, warehouseId };
    })
    .filter(Boolean) as { sku: string; amount: number; warehouseId: string }[];

  if (stocks.length === 0) return { success: false, error: "No syncable items (check wb_sku setup)" };

  const url = `https://marketplace-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`;
  console.info("syncCrewWbStocks -> PUT", { url, count: stocks.length, sample: stocks[0] });

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ stocks: stocks.map(s => ({ sku: s.sku, amount: s.amount })) }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }
      return res;
    });
    return { success: true };
  } catch (err: any) {
    console.error("syncCrewWbStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in syncCrewWbStocks" };
  }
}

export async function syncCrewOzonStocks(slug: string) {
  let OZON_CLIENT_ID;
  let OZON_API_KEY;
  let OZON_WAREHOUSE_ID;
  try {
    OZON_CLIENT_ID = getCrewEnvVar(slug, "OZON_CLIENT_ID");
    OZON_API_KEY = getCrewEnvVar(slug, "OZON_API_KEY");
    OZON_WAREHOUSE_ID = getCrewEnvVar(slug, "OZON_WAREHOUSE_ID");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const items = await getCrewItems(slug);
  if (items.length === 0) return { success: false, error: "No items for this crew" };

  const stocks = items
    .map((i) => {
      const offer_id = i.specs?.ozon_sku as string | undefined;
      if (!offer_id) return null;
      const stock = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
      const warehouse_id = parseInt((i.specs?.ozon_warehouse_id as string) || OZON_WAREHOUSE_ID || "0", 10);
      if (isNaN(warehouse_id) || warehouse_id === 0) return null;
      return { offer_id, stock, warehouse_id };
    })
    .filter(Boolean) as { offer_id: string; stock: number; warehouse_id: number }[];

  if (stocks.length === 0) return { success: false, error: "No syncable items (check ozon_sku setup)" };

  const url = "https://api-seller.ozon.ru/v2/products/stocks";
  console.info("syncCrewOzonStocks -> POST", { url, count: stocks.length, sample: stocks[0] });

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }
      return res;
    });
    return { success: true };
  } catch (err: any) {
    console.error("syncCrewOzonStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in syncCrewOzonStocks" };
  }
}

export async function syncCrewYmStocks(slug: string, campaignId: string) {
  let YM_API_TOKEN;
  try {
    YM_API_TOKEN = getCrewEnvVar(slug, "YM_API_TOKEN");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const items = await getCrewItems(slug);
  if (items.length === 0) return { success: false, error: "No items for this crew" };

  const skus = items
    .map((i) => {
      const sku = i.specs?.ym_sku as string | undefined;
      if (!sku) return null;
      const count = (i.specs?.warehouse_locations || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
      return { sku, items: [{ count, updatedAt: new Date().toISOString() }] };
    })
    .filter(Boolean) as { sku: string; items: { count: number; updatedAt: string }[] }[];

  if (skus.length === 0) return { success: false, error: "No syncable items (check ym_sku setup)" };

  const url = `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/offers/stocks`;
  console.info("syncCrewYmStocks -> PUT", { url, count: skus.length, sample: skus[0] });

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Api-Key": YM_API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ skus }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Status ${res.status}: ${errText}`);
      }
      return res;
    });
    return { success: true };
  } catch (err: any) {
    console.error("syncCrewYmStocks error:", err);
    return { success: false, error: err?.message || "Unknown error in syncCrewYmStocks" };
  }
}

export async function getCrewYmCampaigns(slug: string) {
  let YM_API_TOKEN;
  try {
    YM_API_TOKEN = getCrewEnvVar(slug, "YM_API_TOKEN");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  try {
    const res = await fetch("https://api.partner.market.yandex.ru/v2/campaigns", {
      headers: { "Api-Key": YM_API_TOKEN, "Content-Type": "application/json" },
    });
    const status = res.status;
    const json = await res.json();
    const campaigns = json.campaigns || [];
    return { success: true, campaigns, raw: json, status };
  } catch (err: any) {
    console.error("getCrewYmCampaigns error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function checkCrewYmToken(slug: string, campaignId?: string) {
  let YM_API_TOKEN;
  try {
    YM_API_TOKEN = getCrewEnvVar(slug, "YM_API_TOKEN");
  } catch (err: any) {
    return { error: "missing_token", message: err.message, listStatus: 0, campStatus: 0, listText: "", campText: "" };
  }

  let listStatus = 0;
  let listText = "";
  try {
    const res = await fetch("https://api.partner.market.yandex.ru/v2/campaigns", {
      headers: { "Api-Key": YM_API_TOKEN },
    });
    listStatus = res.status;
    listText = await res.text();
  } catch (e: any) {
    return { error: "network_error", message: e.message, listStatus: 0, campStatus: 0, listText: "", campText: "" };
  }

  if (!campaignId) {
    return { listStatus, listText, campStatus: 0, campText: "", message: "no campaignId" };
  }

  let campStatus = 0;
  let campText = "";
  try {
    const res = await fetch(`https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}`, {
      headers: { "Api-Key": YM_API_TOKEN },
    });
    campStatus = res.status;
    campText = await res.text();
  } catch (e: any) {
    return { error: "network_error_campaign", message: e.message, listStatus, campStatus: 0, listText, campText: "" };
  }

  return { listStatus, listText, campStatus, campText, message: "ok" };
}

export async function fetchCrewWbPendingCount(slug: string) {
  let WB_TOKEN;
  try {
    WB_TOKEN = getCrewEnvVar(slug, "WB_API_TOKEN");
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }

  const statuses = ['awaiting_packaging', 'awaiting_deliver'];

  let total = 0;
  for (const status of statuses) {
    try {
      const url = 'https://marketplace-api.wildberries.ru/api/v4/fbs/posting/list';
      const body = {
        filter: { status },
        limit: 1,
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
      total += data?.total || 0;
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  }

  return { success: true, count: total };
}

export async function fetchCrewOzonPendingCount(slug: string) {
  let OZON_CLIENT_ID;
  let OZON_API_KEY;
  try {
    OZON_CLIENT_ID = getCrewEnvVar(slug, "OZON_CLIENT_ID");
    OZON_API_KEY = getCrewEnvVar(slug, "OZON_API_KEY");
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }

  const statuses = ['awaiting_packaging', 'awaiting_deliver'];

  let total = 0;
  for (const status of statuses) {
    try {
      const url = 'https://api-seller.ozon.ru/v3/posting/fbs/list';
      const body = {
        dir: 'ASC',
        filter: { status },
        limit: 1,
        offset: 0
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Client-Id': OZON_CLIENT_ID, 'Api-Key': OZON_API_KEY, 'Content-Type': "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, count: 0, error: `Ozon: ${res.status} - ${text}` };
      }
      const data = await res.json();
      total += data?.result?.total || 0;
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  }

  return { success: true, count: total };
}

export async function fetchCrewYmPendingCount(slug: string) {
  let YM_API_TOKEN;
  let YM_WAREHOUSE_ID;
  try {
    YM_API_TOKEN = getCrewEnvVar(slug, "YM_API_TOKEN");
    YM_WAREHOUSE_ID = getCrewEnvVar(slug, "YM_WAREHOUSE_ID");
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }

  let total = 0;
  let pageToken = '';
  do {
    try {
      const url = `https://api.partner.market.yandex.ru/v2/campaigns/${YM_WAREHOUSE_ID}/orders?status=PROCESSING&limit=50&page_token=${pageToken}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { "Api-Key": YM_API_TOKEN },
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, count: 0, error: `YM: ${res.status} - ${text}` };
      }
      const data = await res.json();
      total += data.orders?.length || 0;
      pageToken = data.pager?.nextPageToken || '';
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  } while (pageToken);

  return { success: true, count: total };
}

export async function setCrewWbBarcodes(slug: string) {
  let WB_TOKEN;
  try {
    WB_TOKEN = getCrewEnvVar(slug, "WB_API_TOKEN");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const itemsRes = await getCrewWarehouseItems(slug);
  if (!itemsRes.success || !itemsRes.data) return { success: false, error: "Failed to get crew items" };

  const res = await fetch("https://marketplace-api.wildberries.ru/api/v3/cards/list", {
    method: "POST",
    headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ filter: { withPhoto: -1 } }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `WB cards fetch failed: ${res.status} - ${text}` };
  }
  const json = await res.json();
  const cards = json.cards || [];

  const updates: any[] = [];
  let updated = 0;

  for (const card of cards) {
    const vc = (card.vendorCode || "").toLowerCase();
    const item = itemsRes.data.find(i => i.id.toLowerCase() === vc);
    if (!item) continue;

    const sizes = Array.isArray(card.sizes) ? card.sizes : [];
    const barcodes: string[] = sizes.flatMap((size: any) => Array.isArray(size.skus) ? size.skus : []);

    if (barcodes.length === 0) continue;

    const specs = { ...item.specs, wb_sku: barcodes[0], wb_barcodes: barcodes };

    updates.push({
      id: item.id,
      specs,
    });
    updated++;
  }

  if (updates.length > 0) {
    const crew = await resolveCrewBySlug(slug);
    const { error } = await supabaseAdmin.from("cars").update(updates).eq("crew_id", crew.id);
    if (error) return { success: false, error: error.message };
  }

  return { success: true, updated };
}

export async function setCrewYmSku(slug: string) {
  const itemsRes = await getCrewWarehouseItems(slug);
  if (!itemsRes.success || !itemsRes.data) return { success: false, error: "Failed to get crew items" };

  let YM_WAREHOUSE_ID;
  try {
    YM_WAREHOUSE_ID = getCrewEnvVar(slug, "YM_WAREHOUSE_ID");
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  const updates = itemsRes.data
    .filter(i => !i.specs?.ym_sku)
    .map(i => ({
      id: i.id,
      specs: { ...i.specs, ym_sku: i.id, ym_warehouse_id: YM_WAREHOUSE_ID },
    }));

  if (updates.length === 0) return { success: true, updated: 0 };

  const crew = await resolveCrewBySlug(slug);
  const { error } = await supabaseAdmin.from("cars").update(updates).eq("crew_id", crew.id);
  if (error) return { success: false, error: error.message };

  return { success: true, updated: updates.length };
}