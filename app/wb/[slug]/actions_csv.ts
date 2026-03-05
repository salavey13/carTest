// /app/wb/[slug]/actions_csv.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { format } from "date-fns";

/**
 * CSV helpers for slugged warehouses.
 * Important: don't attempt to write created_at/updated_at for `cars` table
 * because the table may not contain those columns in every deployment.
 */

function log(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.log("[wb/actions_csv]", ...args); }
function err(...args: any[]) { if ((process.env.NEXT_PUBLIC_DEBUG ?? "1") !== "0") console.error("[wb/actions_csv]", ...args); }

async function resolveCrewBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Crew '${slug}' not found`);
  return data as any;
}

export async function uploadCrewWarehouseCsv(parsedRows: any[], slug: string, userId?: string) {
  try {
    if (!slug) throw new Error("Slug required");
    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    let applied = 0;
    const failures: any[] = [];

    for (const rawRow of parsedRows) {
      try {
        const id = rawRow["Артикул"] || rawRow["id"] || rawRow["artikul"] || rawRow["sku"];
        const make = rawRow["Make"] || rawRow["make"] || rawRow["Бренд"] || rawRow["brand"] || "";
        const model = rawRow["Model"] || rawRow["model"] || rawRow["Название"] || rawRow["name"] || "";
        const locationsRaw = rawRow["Локации"] || rawRow["locations"] || rawRow["cells"] || "";

        const locs: any[] = [];
        if (typeof locationsRaw === "string" && locationsRaw.trim()) {
          locationsRaw.split(/[;,]+/).forEach((pair: string) => {
            const [v, q] = pair.split(":").map((s: any) => s && s.trim());
            if (v) locs.push({ voxel_id: v, quantity: Number(q || 0) });
          });
        } else if (Array.isArray(rawRow.locations)) {
          (rawRow.locations as any[]).forEach((l: any) => {
            if (typeof l === "string") {
              const [v, q] = l.split(":").map((s: any) => s && s.trim());
              if (v) locs.push({ voxel_id: v, quantity: Number(q || 0) });
            } else if (l && l.voxel_id) {
              locs.push({ voxel_id: l.voxel_id, quantity: Number(l.quantity || 0) });
            }
          });
        }

        const specs: any = {
          ...(rawRow.specs && typeof rawRow.specs === "object" ? rawRow.specs : {}),
          warehouse_locations: locs,
          size: rawRow["size"] || rawRow["Размер"] || undefined,
          color: rawRow["color"] || rawRow["Цвет"] || undefined,
          season: rawRow["season"] || rawRow["Сезон"] || undefined,
          pattern: rawRow["pattern"] || rawRow["Узор"] || undefined,
        };

        if (id) {
          const { data: exists } = await supabaseAdmin
            .from("cars")
            .select("id")
            .eq("id", id)
            .eq("crew_id", crewId)
            .limit(1)
            .maybeSingle();
          if (exists) {
            // update only allowed fields (no timestamps)
            const { error } = await supabaseAdmin
              .from("cars")
              .update({ make, model, specs })
              .eq("id", id)
              .eq("crew_id", crewId);
            if (error) failures.push({ id, error: error.message });
            else applied++;
            continue;
          }
        }

        const newId = id || uuidv4();
        const { error } = await supabaseAdmin.from("cars").insert({
          id: newId,
          crew_id: crewId,
          type: "wb_item",
          make,
          model,
          specs,
        });
        if (error) failures.push({ id: newId, error: error.message });
        else applied++;
      } catch (e: any) {
        failures.push({ row: rawRow, error: e?.message || e });
      }
    }

    return { success: failures.length === 0, applied, failures, message: `Applied ${applied}, failed ${failures.length}` };
  } catch (e: any) {
    err("uploadCrewWarehouseCsv error", e);
    return { success: false, error: e?.message || "upload failed" };
  }
}

export async function exportCrewDiffToOwner(slug: string, diffData: any[], userId?: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const csvData = "\uFEFF" + Papa.unparse(
      diffData.map((d) => ({ Артикул: d.id, Изменение: d.diffQty, Ячейка: d.voxel })),
      { header: true, delimiter: "\t", quotes: true }
    );

    const ownerChatId = crew.owner_id;
    if (!ownerChatId) throw new Error("Crew owner not configured");

    const res = await sendComplexMessage(
      ownerChatId,
      `Изменения склада для экипажа ${crew.name} (${slug})`,
      [],
      { attachment: { type: "document", content: csvData, filename: `warehouse_diff_${slug}.tsv` } }
    );

    if (!res.success) throw new Error(res.error || "Failed to send to owner");
    return { success: true, csv: csvData };
  } catch (e: any) {
    err("exportCrewDiffToOwner error", e);
    return { success: false, error: e?.message || "Export failed" };
  }
}

export async function exportCrewCurrentStock(slug: string, items: any[], summarized = false) {
  try {
    // Always use summarized format (2 columns)
    const stockData = items.map((item) => ({ Артикул: item.id, Количество: item.total_quantity }));

    const csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: "\t", quotes: true });
    return { success: true, csv: csvData };
  } catch (e: any) {
    err("exportCrewCurrentStock error", e);
    return { success: false, error: e?.message || "Export failed" };
  }
}

export async function exportCrewDailyShift(slug: string, isTelegram = false): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    if (!slug) throw new Error("Slug required");
    const crew = await resolveCrewBySlug(slug);
    const crewId = crew.id;

    // Define categories
    const categories = [
      'namatras 90', 'namatras 120', 'namatras 140', 'namatras 160', 'namatras 180', 'namatras 200',
      '1.5 leto', '2 leto', 'evro leto', 'evromaksi leto',
      '1.5 zima', '2 zima', 'evro zima', 'evromaksi zima',
      'Podushka 50x70', 'Podushka 70x70', 'Podushka anatom',
      'Navolochka 50x70', 'Navolochka 70x70'
    ];

    // Get current date for filtering (midnight to midnight)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Query shifts table for actions within the day
    const { data: shiftRecords, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("actions, clock_in_time")
      .eq("crew_id", crewId)
      .gte("clock_in_time", startOfDay.toISOString())
      .lt("clock_in_time", endOfDay.toISOString())
      .order("clock_in_time");

    if (shiftError) throw new Error(`Failed to fetch shifts: ${shiftError.message}`);
    if (!shiftRecords || shiftRecords.length === 0) {
      const emptyCsv = `\uFEFFотгрузка wb ${format(today, 'dd.MM.yy')}\t${categories.map(() => '0').join('\t')}\tвсего: 0\tоплата: 0\n`;
      if (!isTelegram && crew.owner_id) {
        await sendComplexMessage(
          crew.owner_id,
          `📊 Дневной отчет по смене для экипажа ${crew.name} (${slug}): Нет отгрузок`,
          [],
          { attachment: { type: "document", content: emptyCsv, filename: `shift_${slug}_${format(today, 'ddMMyy')}.tsv` } }
        );
      }
      return { success: true, csv: emptyCsv };
    }

    // Group offloads by operation and assign marketplace based on order
    const operations: { timestamp: Date; marketplace: string; items: { item_id: string; delta: number; category: string }[] }[] = [];
    let wbAssigned = false;
    let ozonAssigned = false;
    let ymAssigned = false;

    shiftRecords.forEach((record: any) => {
      const offloadActions = Array.isArray(record.actions)
        ? record.actions.filter((action: any) => action.type === "offload" && action.ts)
        : [];
      if (offloadActions.length === 0) return;

      let marketplace: string;
      if (!wbAssigned) {
        marketplace = "wb";
        wbAssigned = true;
      } else if (!ozonAssigned) {
        marketplace = "ozon";
        ozonAssigned = true;
      } else if (!ymAssigned) {
        marketplace = "ym";
        ymAssigned = true;
      } else {
        marketplace = "other";
      }

      offloadActions.forEach((action: any) => {
        const timestamp = new Date(action.ts);
        if (timestamp < startOfDay || timestamp >= endOfDay) return;

        const items = [{
          item_id: action.itemId,
          delta: Math.abs(action.delta || 0),
          category: action.category || categorizeItem({ id: action.itemId }) || 'unknown'
        }];

        operations.push({ timestamp, marketplace, items });
      });
    });

    if (operations.length === 0) {
      const emptyCsv = `\uFEFFотгрузка wb ${format(today, 'dd.MM.yy')}\t${categories.map(() => '0').join('\t')}\tвсего: 0\tоплата: 0\n`;
      if (!isTelegram && crew.owner_id) {
        await sendComplexMessage(
          crew.owner_id,
          `📊 Дневной отчет по смене для экипажа ${crew.name} (${slug}): Нет отгрузок`,
          [],
          { attachment: { type: "document", content: emptyCsv, filename: `shift_${slug}_${format(today, 'ddMMyy')}.tsv` } }
        );
      }
      return { success: true, csv: emptyCsv };
    }

    // Summarize each operation
    const csvLines: string[] = [];
    const totalByCategory = categories.map(() => 0);
    let shiftTotal = 0;

    operations.forEach(({ timestamp, marketplace, items }) => {
      const quantities = categories.map((cat) => {
        const total = items
          .filter((item) => item.category === cat)
          .reduce((sum, item) => sum + item.delta, 0);
        return total;
      });
      const total = quantities.reduce((sum, q) => sum + q, 0);
      const payment = total * 50;
      shiftTotal += total;
      quantities.forEach((qty, idx) => {
        totalByCategory[idx] += qty;
      });
      const timeStr = format(timestamp, 'HH:mm dd.MM.yy');
      csvLines.push(`отгрузка ${marketplace} ${timeStr}\t${quantities.join('\t')}\tвсего: ${total}\tоплата: ${payment}`);
    });

    // Add total row
    const totalPayment = shiftTotal * 50;
    csvLines.push(`Итого за смену\t${totalByCategory.join('\t')}\tвсего: ${shiftTotal}\tоплата: ${totalPayment}`);

    const csvData = "\uFEFF" + csvLines.join("\n");

    if (!isTelegram && crew.owner_id) {
      await sendComplexMessage(
        crew.owner_id,
        `📊 Дневной отчет по смене для экипажа ${crew.name} (${slug})`,
        [],
        { attachment: { type: "document", content: csvData, filename: `shift_${slug}_${format(today, 'ddMMyy')}.tsv` } }
      );
    }

    return { success: true, csv: csvData };
  } catch (e: any) {
    err("exportCrewDailyShift error", e);
    return { success: false, error: e?.message || "Export failed" };
  }
}

// Add categorizeItem to actions_csv.ts for consistency
function categorizeItem(item: any): string {
  const fullLower = (item.id || item.model || '').toLowerCase().trim();
  if (!fullLower) return 'other';

  if (fullLower.includes('наматрасник') || fullLower.includes('namatras')) {
    const sizeMatch = fullLower.match(/(90|120|140|160|180|200)/);
    if (sizeMatch) return `namatras ${sizeMatch[0]}`;
  }

  const sizeChecks = [
    { key: 'евро макси', val: 'evromaksi' },
    { key: 'evro maksi', val: 'evromaksi' },
    { key: 'evromaksi', val: 'evromaksi' },
    { key: 'евро', val: 'evro' },
    { key: 'evro', val: 'evro' },
    { key: 'euro', val: 'evro' },
    { key: '2', val: '2' },
    { key: '1.5', val: '1.5' }
  ];
  let detectedSize = null;
  for (const { key, val } of sizeChecks) {
    if (fullLower.includes(key)) {
      detectedSize = val;
      break;
    }
  }

  const seasonMap = { 'лето': 'leto', 'зима': 'zima', 'leto': 'leto', 'zima': 'zima' };
  let detectedSeason = null;
  for (const [key, val] of Object.entries(seasonMap)) {
    if (fullLower.includes(key)) {
      detectedSeason = val;
      break;
    }
  }

  if (detectedSize && detectedSeason) {
    return `${detectedSize} ${detectedSeason}`;
  }

  if (fullLower.includes('подушка') || fullLower.includes('podushka')) {
    if (fullLower.includes('50x70') || fullLower.includes('50x70')) return 'Podushka 50x70';
    if (fullLower.includes('70x70') || fullLower.includes('70x70')) return 'Podushka 70x70';
    if (fullLower.includes('анатом') || fullLower.includes('anatom')) return 'Podushka anatom';
  }

  if (fullLower.includes('наволочка') || fullLower.includes('navolochka')) {
    if (fullLower.includes('50x70') || fullLower.includes('50x70')) return 'Navolochka 50x70';
    if (fullLower.includes('70x70') || fullLower.includes('70x70')) return 'Navolochka 70x70';
  }

  return 'other';
}