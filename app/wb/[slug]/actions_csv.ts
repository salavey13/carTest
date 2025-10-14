"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

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
            const { error } = await supabaseAdmin
              .from("cars")
              .update({ make, model, specs, updated_at: new Date().toISOString() })
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
    const stockData = summarized
      ? items.map((item) => ({ Артикул: item.id, Количество: item.total_quantity }))
      : items.map((item) => ({
        Артикул: item.id,
        Название: `${item.make || ""} ${item.model || ""}`.trim(),
        "Общее Количество": item.total_quantity,
        Локации: (item.specs?.warehouse_locations || []).map((l: any) => `${l.voxel_id}:${l.quantity}`).join(", ") || "",
      }));

    const csvData = "\uFEFF" + Papa.unparse(stockData, { header: true, delimiter: "\t", quotes: true });
    return { success: true, csv: csvData };
  } catch (e: any) {
    err("exportCrewCurrentStock error", e);
    return { success: false, error: e?.message || "Export failed" };
  }
}