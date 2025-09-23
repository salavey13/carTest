"use server";

import { logger } from "@/lib/logger";
import { getWbProductCardsList, getWbWarehouses } from "@/app/wb/actions";
import dns from "dns/promises";

/**
 * fetchWbStocksForBarcodes
 * - If warehouseId provided -> single request to that warehouse
 * - If not -> enumerate warehouses (active first), query each, aggregate per-sku totals,
 *   and pick a "best" warehouse (most non-zero SKUs, tiebreak by total amount)
 */
export async function fetchWbStocksForBarcodes(barcodes: string[], warehouseId?: string): Promise<{
  success: boolean;
  data?: { sku: string; amount: number }[];
  chosenWarehouseId?: string | null;
  warehousesInfo?: { id: string; nonZeroCount: number; totalAmount: number }[];
  error?: string;
}> {
  const token = process.env.WB_API_TOKEN;
  if (!token) return { success: false, error: "Token missing" };

  const doRequestForWarehouse = async (whId: string) => {
    try {
      const res = await fetch(`https://suppliers-api.wildberries.ru/api/v3/stocks/${whId}`, {
        method: "POST",
        headers: { "Authorization": token, "Content-Type": "application/json" },
        body: JSON.stringify({ skus: barcodes }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "no-body");
        console.warn(`WB stocks for warehouse ${whId} returned status ${res.status}: ${text}`); // enhanced log
        return { ok: false, stocks: [] as any[] };
      }
      const json = await res.json();
      return { ok: true, stocks: Array.isArray(json.stocks) ? json.stocks : [] };
    } catch (e: any) {
      console.warn(`Network error fetching stocks for warehouse ${whId}: ${e?.message || e}`); // enhanced log
      return { ok: false, stocks: [] as any[] };
    }
  };

  try {
    if (warehouseId) {
      console.info(`fetchWbStocksForBarcodes: using provided warehouseId ${warehouseId}`); // enhanced log
      const single = await doRequestForWarehouse(warehouseId);
      if (!single.ok) return { success: false, error: `WB returned non-OK for warehouse ${warehouseId}` };
      const mapped = (single.stocks || []).map((s: any) => ({ sku: String(s.sku), amount: Number(s.amount || 0) }));
      return { success: true, data: mapped, chosenWarehouseId: warehouseId };
    }

    const whRes = await getWbWarehouses();
    if (!whRes.success || !Array.isArray(whRes.data) || whRes.data.length === 0) {
      console.warn("fetchWbStocksForBarcodes: no warehouses found via API; falling back to env WB_WAREHOUSE_ID if set"); // enhanced log
      const envWh = process.env.WB_WAREHOUSE_ID;
      if (envWh) {
        const single = await doRequestForWarehouse(envWh);
        if (single.ok) {
          const mapped = (single.stocks || []).map((s: any) => ({ sku: String(s.sku), amount: Number(s.amount || 0) }));
          return {
            success: true,
            data: mapped,
            chosenWarehouseId: envWh,
            warehousesInfo: [{ id: envWh, nonZeroCount: mapped.filter(m => m.amount > 0).length, totalAmount: mapped.reduce((a, b) => a + b.amount, 0) }]
          };
        }
      }
      return { success: false, error: "No warehouses available to query" };
    }

    const warehouses = [...whRes.data].sort((a: any, b: any) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
    console.info(`fetchWbStocksForBarcodes: discovered ${warehouses.length} warehouses; trying in order (active first). IDs: ${warehouses.map((w:any)=>w.id).join(",")}`); // enhanced log

    const perSkuTotals = new Map<string, number>();
    const warehousesInfo: { id: string; nonZeroCount: number; totalAmount: number }[] = [];

    try {
      const lookup = await dns.lookup("suppliers-api.wildberries.ru");
      console.info("fetchWbStocksForBarcodes DNS lookup result", lookup); // enhanced log
    } catch (dnsErr: any) {
      console.warn("fetchWbStocksForBarcodes DNS lookup failed", { code: dnsErr?.code, message: dnsErr?.message }); // enhanced log
    }

    for (const wh of warehouses) {
      const whId = String(wh.id);
      const resp = await doRequestForWarehouse(whId);
      if (!resp.ok) {
        warehousesInfo.push({ id: whId, nonZeroCount: 0, totalAmount: 0 });
        continue;
      }
      const stocks: any[] = resp.stocks || [];
      let nonZero = 0;
      let totalAmount = 0;
      let matchedBarcodes = 0;
      stocks.forEach(s => {
        const sku = String(s.sku);
        const amt = Number(s.amount || 0);
        perSkuTotals.set(sku, (perSkuTotals.get(sku) || 0) + amt);
        if (amt > 0) nonZero++;
        totalAmount += amt;
        if (barcodes.includes(sku)) matchedBarcodes++; // check if matched our barcodes
      });
      warehousesInfo.push({ id: whId, nonZeroCount: nonZero, totalAmount });
      console.info(`fetchWbStocksForBarcodes: warehouse ${whId} -> nonZero ${nonZero}, totalAmount ${totalAmount}, matched barcodes ${matchedBarcodes}/${barcodes.length}`); // enhanced log
    }

    warehousesInfo.sort((a, b) => {
      if (b.nonZeroCount !== a.nonZeroCount) return b.nonZeroCount - a.nonZeroCount;
      return b.totalAmount - a.totalAmount;
    });

    let chosen: string | null = null;
    if (warehousesInfo.length > 0 && warehousesInfo[0].nonZeroCount > 0) {
      chosen = warehousesInfo[0].id;
      console.info(`fetchWbStocksForBarcodes: chosen warehouse ${chosen} (best non-zero coverage)`); // enhanced log
    } else if (warehousesInfo.length > 0) {
      chosen = warehousesInfo[0].id;
      console.info(`fetchWbStocksForBarcodes: no non-zero stocks found; choosing ${chosen} as fallback`); // enhanced log
    } else {
      console.warn("No warehouses responded with data"); // enhanced log
    }

    const combined = Array.from(perSkuTotals.entries()).map(([sku, amount]) => ({ sku, amount }));
    console.info(`fetchWbStocksForBarcodes: final totals - non-zero SKUs: ${combined.filter(c => c.amount > 0).length}, total amount: ${combined.reduce((sum, c) => sum + c.amount, 0)}`); // enhanced log
    if (combined.filter(c => c.amount > 0).length === 0) {
      console.warn("No stock found for any barcode across all warehouses — check barcodes or token/warehouse access"); // enhanced log
    }

    return { success: true, data: combined, chosenWarehouseId: chosen, warehousesInfo };
  } catch (e: any) {
    console.error("fetchWbStocksForBarcodes error:", e); // enhanced log
    return { success: false, error: e?.message || "Unknown error fetching WB stocks for barcodes" };
  }
}

/**
 * parseWbCardsToMinimal(cards, warehouseId?)
 * - Builds a map: vendorCode -> { nmID, barcodes[], quantity }
 * - If barcodes exist, calls fetchWbStocksForBarcodes to get amounts, sums amounts per vendorCode
 * - Returns { map, chosenWarehouseId, warehousesInfo }
 */
export async function parseWbCardsToMinimal(cards: any[], warehouseId?: string): Promise<{
  success: boolean;
  map?: { [vendorCode: string]: { nmID: number; barcodes: string[]; quantity: number } };
  chosenWarehouseId?: string | null;
  warehousesInfo?: { id: string; nonZeroCount: number; totalAmount: number }[];
  error?: string;
}> {
  try {
    const map: { [vendorCode: string]: { nmID: number; barcodes: string[]; quantity: number } } = {};
    cards.forEach((card: any) => {
      const vc = (card.vendorCode || "").toLowerCase();
      const barcodes: string[] = Array.isArray(card.sizes) ? card.sizes.flatMap((size: any) => Array.isArray(size.skus) ? size.skus : []) : [];
      map[vc] = { nmID: card.nmID, barcodes, quantity: 0 };
    });

    const allBarcodes = Object.values(map).flatMap(m => m.barcodes);
    if (allBarcodes.length === 0) {
      console.info("parseWbCardsToMinimal: no barcodes in cards; returning map with zero quantities"); // enhanced log
      return { success: true, map, chosenWarehouseId: null, warehousesInfo: [] };
    }

    const stocksRes = await fetchWbStocksForBarcodes(allBarcodes, warehouseId);
    if (!stocksRes.success || !stocksRes.data) {
      console.warn("parseWbCardsToMinimal: failed to fetch stocks", { error: stocksRes.error }); // enhanced log
      return { success: true, map, chosenWarehouseId: stocksRes.chosenWarehouseId ?? null, warehousesInfo: stocksRes.warehousesInfo ?? [] };
    }

    const skuMap = new Map<string, number>();
    stocksRes.data.forEach(s => skuMap.set(String(s.sku), Number(s.amount || 0)));

    Object.entries(map).forEach(([vc, info]) => {
      let sum = 0;
      info.barcodes.forEach(b => {
        sum += skuMap.get(String(b)) || 0;
      });
      info.quantity = sum;
    });

    console.info(`parseWbCardsToMinimal: aggregated quantities for ${Object.keys(map).length} vendorCodes, total stock: ${Object.values(map).reduce((sum, m) => sum + m.quantity, 0)}`); // enhanced log
    return { success: true, map, chosenWarehouseId: stocksRes.chosenWarehouseId ?? null, warehousesInfo: stocksRes.warehousesInfo ?? [] };
  } catch (e: any) {
    console.error("parseWbCardsToMinimal error:", e); // enhanced log
    return { success: false, error: e?.message || "Unknown error in parseWbCardsToMinimal" };
  }
}

/**
 * fetchWbCardsWithWarehouseInfo: convenience wrapper to fetch cards and parse quantities
 */
export async function fetchWbCardsWithWarehouseInfo(warehouseId?: string): Promise<{
  success: boolean;
  cards?: any[];
  minimalMap?: { [vendorCode: string]: { nmID: number; barcodes: string[]; quantity: number } };
  chosenWarehouseId?: string | null;
  warehousesInfo?: { id: string; nonZeroCount: number; totalAmount: number }[];
  error?: string;
}> {
  try {
    const cardsRes = await getWbProductCardsList();
    if (!cardsRes.success) return { success: false, error: cardsRes.error || "Failed to fetch WB cards" };
    const cards = cardsRes.data.cards || [];
    const parsed = await parseWbCardsToMinimal(cards, warehouseId);
    return {
      success: parsed.success,
      cards,
      minimalMap: parsed.map,
      chosenWarehouseId: parsed.chosenWarehouseId ?? null,
      warehousesInfo: parsed.warehousesInfo ?? [],
      error: parsed.error,
    };
  } catch (e: any) {
    console.error("fetchWbCardsWithWarehouseInfo error:", e); // enhanced log
    return { success: false, error: e?.message || "Unknown error in fetchWbCardsWithWarehouseInfo" };
  }
}