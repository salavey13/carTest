"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { updateItemLocationQty } from "@/app/wb/actions";
import { syncWbSpecific, syncOzonSpecific, syncYmSpecific } from "@/app/wb/actions";
import { notifyAdmin } from "@/app/actions";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";

export async function registerOzonWebhook(url: string): Promise<{ success: boolean; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, error: "Ozon credentials missing" };

  try {
    const body = {
      url, // webhook URL
      events: ["new_posting", "posting_status_change"], // subscribe to new orders and status
    };
    const res = await fetch("https://api-seller.ozon.ru/v1/api/webhook/subscribe", {
      method: "POST",
      headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Ozon returned ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function registerYmWebhook(url: string, campaignId: string): Promise<{ success: boolean; error?: string }> {
  const YM_API_TOKEN = process.env.YM_API_TOKEN;
  if (!YM_API_TOKEN) return { success: false, error: "YM credentials missing" };

  try {
    const body = { url }; // YM sendNotification for webhook reg
    const res = await fetch(`https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/push-notifications/sendNotification`, {
      method: "POST",
      headers: { "Api-Key": YM_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `YM returned ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

async function getLastPollTs(platform: 'wb' | 'ozon' | 'ym'): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("config")
    .select("value")
    .eq("key", `last_poll_${platform}`)
    .single();
  return data?.value || null;
}

async function setLastPollTs(platform: 'wb' | 'ozon' | 'ym', ts: string) {
  await supabaseAdmin
    .from("config")
    .upsert({ key: `last_poll_${platform}`, value: ts }, { onConflict: "key" });
}

async function processOrder(orderId: string, platform: 'wb' | 'ozon' | 'ym', items: { sku: string; qty: number }[]) {
  try {
    // Dedup check
    const { data: existing } = await supabaseAdmin
      .from("processed_orders")
      .select("order_id") // corrected column
      .eq("order_id", orderId)
      .eq("platform", platform)
      .single();

    if (existing) {
      console.info(`${platform.toUpperCase()} process: duplicate order ${orderId}, skipping`);
      return { success: true, message: "Duplicate, skipped" };
    }

    // Process items + insert to salary_calc
    const affectedSkus = new Set<string>();
    const today = new Date().toISOString().split('T')[0];
    for (const it of items) {
      const sku = it.sku;
      const qty = it.qty;
      if (sku) {
        const { data: current } = await supabaseAdmin.from("salary_calc")
          .select("decreased_qty")
          .eq("date", today)
          .eq("platform", platform)
          .eq("item_id", sku)
          .single();

        const newQty = (current?.decreased_qty || 0) + qty;

        await supabaseAdmin.from("salary_calc").upsert({
          date: today,
          platform,
          item_id: sku,
          decreased_qty: newQty
        }, { onConflict: "date, platform, item_id" });

        await updateItemLocationQty(sku, "A1", -qty); // Default voxel or find

        // Alarm if low stock
        const { data: item } = await supabaseAdmin.from("cars").select("specs").eq("id", sku).single();
        if (item) {
          const total = item.specs.warehouse_locations.reduce((sum: number, l: any) => sum + l.quantity, 0);
          const min = item.specs.min_quantity || 0;
          if (total < min) {
            await notifyAdmin(`Low stock alarm: ${sku} now ${total} < ${min}`);
          }
        }

        affectedSkus.add(sku);
      }
    }

    // Add to processed
    await supabaseAdmin.from("processed_orders").insert({
      order_id: orderId, // corrected column
      platform,
      items,
      processed_at: new Date().toISOString(),
    });

    // Precise syncs
    await syncWbSpecific(Array.from(affectedSkus));
    await syncOzonSpecific(Array.from(affectedSkus));
    await syncYmSpecific(Array.from(affectedSkus));

    return { success: true };
  } catch (err: any) {
    console.error(`${platform.toUpperCase()} process error for order ${orderId}:`, err);
    return { success: false, error: err.message };
  }
}

export async function pollWbOrders(): Promise<{ success: boolean; processed?: number; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  if (!WB_TOKEN) return { success: false, error: "WB credentials missing" };

  try {
    const lastTs = await getLastPollTs('wb') || new Date(Date.now() - 24*60*60*1000).toISOString(); // 24h fallback
    const since = new Date(lastTs).toISOString().split('.')[0] + 'Z'; // WB format

    const res = await fetch(`https://marketplace-api.wildberries.ru/api/v5/orders?date_start=${since}&flag=0`, {
      headers: { Authorization: WB_TOKEN },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `WB returned ${res.status}: ${text}` };
    }
    const data = await res.json();
    const orders = data.orders || [];

    let processed = 0;
    for (const order of orders) {
      const orderId = order.orderId.toString();
      const items = order.products.map((p: any) => ({ sku: p.sku.toString(), qty: p.quantity || 1 }));
      const procRes = await processOrder(orderId, 'wb', items);
      if (procRes.success) processed++;
    }

    await setLastPollTs('wb', new Date().toISOString());

    if (processed > 0) {
      await notifySalaryRows('wb', processed);
    }

    return { success: true, processed };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function pollOzonOrders(): Promise<{ success: boolean; processed?: number; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  if (!OZON_CLIENT_ID || !OZON_API_KEY) return { success: false, error: "Ozon credentials missing" };

  try {
    const lastTs = await getLastPollTs('ozon') || new Date(Date.now() - 24*60*60*1000).toISOString();
    const since = new Date(lastTs).toISOString().split('.')[0] + 'Z';

    const body = {
      dir: 'ASC',
      filter: { since, status: 'awaiting_packaging' },
      limit: 100,
      offset: 0
    };
    const res = await fetch("https://api-seller.ozon.ru/v3/posting/fbs/list", {
      method: "POST",
      headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Ozon returned ${res.status}: ${text}` };
    }
    const data = await res.json();
    const postings = data.result.postings || [];

    let processed = 0;
    for (const posting of postings) {
      const orderId = posting.posting_number.toString();
      const items = posting.products.map((p: any) => ({ sku: p.sku.toString(), qty: p.quantity || 1 }));
      const procRes = await processOrder(orderId, 'ozon', items);
      if (procRes.success) processed++;
    }

    await setLastPollTs('ozon', new Date().toISOString());

    if (processed > 0) {
      await notifySalaryRows('ozon', processed);
    }

    return { success: true, processed };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function pollYmOrders(campaignId: string): Promise<{ success: boolean; processed?: number; error?: string }> {
  const YM_API_TOKEN = process.env.YM_API_TOKEN;
  if (!YM_API_TOKEN) return { success: false, error: "YM credentials missing" };

  try {
    const lastTs = await getLastPollTs('ym') || new Date(Date.now() - 24*60*60*1000).toISOString();
    const fromDate = new Date(lastTs).toISOString().split('T')[0]; // YM fromDate format YYYY-MM-DD

    const res = await fetch(`https://api.partner.market.yandex.ru/campaigns/${campaignId}/orders?fromDate=${fromDate}`, {
      headers: { "Authorization": `Bearer ${YM_API_TOKEN}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `YM returned ${res.status}: ${text}` };
    }
    const data = await res.json();
    const orders = data.orders || [];

    let processed = 0;
    for (const order of orders) {
      const orderId = order.id.toString();
      const items = order.items.map((i: any) => ({ sku: i.shopSku.toString(), qty: i.count || 1 }));
      const procRes = await processOrder(orderId, 'ym', items);
      if (procRes.success) processed++;
    }

    await setLastPollTs('ym', new Date().toISOString());

    if (processed > 0) {
      await notifySalaryRows('ym', processed);
    }

    return { success: true, processed };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

async function syncWbSpecific(skus: string[]): Promise<{ success: boolean; error?: string }> {
  const WB_TOKEN = process.env.WB_API_TOKEN;
  const WB_WAREHOUSE_ID = process.env.WB_WAREHOUSE_ID;
  if (!WB_TOKEN || !WB_WAREHOUSE_ID) return { success: false, error: "WB credentials missing" };

  const { data: items } = await supabaseAdmin.from("cars").select("*").in("specs.wb_sku", skus).eq("type", "wb_item");
  if (!items) return { success: false, error: "No items" };

  const stocks = items.map(i => ({
    sku: i.specs.wb_sku as string,
    amount: i.specs.warehouse_locations.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0),
  }));

  try {
    const res = await fetch(`https://marketplace-api.wildberries.ru/api/v3/stocks/${WB_WAREHOUSE_ID}`, {
      method: "PUT",
      headers: { Authorization: WB_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ stocks }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `WB returned ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

async function syncOzonSpecific(offerIds: string[]): Promise<{ success: boolean; error?: string }> {
  const OZON_CLIENT_ID = process.env.OZON_CLIENT_ID;
  const OZON_API_KEY = process.env.OZON_API_KEY;
  const OZON_WAREHOUSE_ID = process.env.OZON_WAREHOUSE_ID;
  if (!OZON_CLIENT_ID || !OZON_API_KEY || !OZON_WAREHOUSE_ID) return { success: false, error: "Ozon credentials missing" };

  const { data: items } = await supabaseAdmin.from("cars").select("*").in("specs.ozon_sku", offerIds).eq("type", "wb_item");
  if (!items) return { success: false, error: "No items" };

  // Assume ozonProductCache loaded or load
  // ... (load if needed)

  const stocks = items.map(i => ({
    offer_id: i.specs.ozon_sku as string,
    product_id: ozonProductCache[i.specs.ozon_sku],
    stock: i.specs.warehouse_locations.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0),
    warehouse_id: parseInt(OZON_WAREHOUSE_ID, 10),
  })).filter(s => s.product_id);

  try {
    const res = await fetch("https://api-seller.ozon.ru/v2/products/stocks", {
      method: "POST",
      headers: { "Client-Id": OZON_CLIENT_ID, "Api-Key": OZON_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ stocks }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Ozon returned ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

async function syncYmSpecific(skus: string[]): Promise<{ success: boolean; error?: string }> {
  const YM_API_TOKEN = process.env.YM_API_TOKEN;
  if (!YM_API_TOKEN) return { success: false, error: "YM credentials missing" };

  const { data: items } = await supabaseAdmin.from("cars").select("*").in("specs.ym_sku", skus).eq("type", "wb_item");
  if (!items) return { success: false, error: "No items" };

  const ymStocks = items.map(i => ({
    sku: i.specs.ym_sku as string,
    items: [{ count: i.specs.warehouse_locations.reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0), updatedAt: new Date().toISOString() }],
  }));

  const campaignId = process.env.YM_WAREHOUSE_ID!;

  try {
    const res = await fetch(`https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/offers/stocks`, {
      method: "PUT",
      headers: { "Api-Key": YM_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ skus: ymStocks }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `YM returned ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error" };
  }
}

export async function getSalaryCalcToday(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseAdmin.from("salary_calc").select("*").eq("date", today);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function generateDailySummary(): Promise<{ success: boolean; text?: string; csv?: string; error?: string }> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: rows } = await supabaseAdmin.from("salary_calc")
      .select("platform, cars!inner(specs->>size as size, specs->>season as season), decreased_qty")
      .eq("date", today);

    const groups = new Map<string, { wb: number; ozon: number; ym: number; total: number }>();
    (rows || []).forEach((r: any) => {
      const key = `${r.size || 'unknown'} ${r.season || 'unknown'}`.trim();
      const entry = groups.get(key) || { wb: 0, ozon: 0, ym: 0, total: 0 };
      entry[r.platform] = (entry[r.platform] || 0) + (r.decreased_qty || 0);
      entry.total += r.decreased_qty || 0;
      groups.set(key, entry);
    });

    const textLines = Array.from(groups.entries()).map(([key, vals]) => `${key}: ${vals.wb} | ${vals.ozon} | ${vals.ym} | ${vals.total}`);
    const text = textLines.join("\n");

    const csvData = Array.from(groups.entries()).map(([key, vals]) => ({ group: key, wb: vals.wb, ozon: vals.ozon, ym: vals.ym, total: vals.total }));
    const csv = Papa.unparse(csvData);

    await notifyAdmin(`Daily summary for ${today}:\n${text}`);
    await sendComplexMessage(process.env.ADMIN_CHAT_ID!, "Summary CSV:", [], {
      attachment: { type: "document", content: csv, filename: `daily_summary_${today}.csv` }
    });

    return { success: true, text, csv };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function notifySalaryRows(platform: string, processed: number) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin.from("salary_calc")
    .select("*")
    .eq("date", today)
    .eq("platform", platform);

  if (!data || data.length === 0) return;

  const csv = Papa.unparse(data, { header: true });
  const message = `New salary calc rows for ${platform.toUpperCase()} on ${today}: ${processed} orders processed.`;
  await notifyAdmin(message);
  await sendComplexMessage(process.env.ADMIN_CHAT_ID!, "Salary CSV:", [], {
    attachment: { type: "document", content: csv, filename: `salary_${platform}_${today}.csv` }
  });
}