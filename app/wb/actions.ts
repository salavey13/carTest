// /app/wb/actions.ts
"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { Item } from "./common";
import { writeFileSync } from "fs";
import XLSX from "xlsx";

export async function getWarehouseItems() {
  const supabase = createClient();
  const { data, error } = await supabaseAdmin.from("wb_items").select("id, make, model, description, image_url, specs");
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function updateItemLocationQty(itemId: string, voxelId: string, quantity: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wb_items")
    .update({
      specs: {
        warehouse_locations: [{ voxel_id: voxelId, quantity }],
      },
    })
    .eq("id", itemId);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data };
}

export async function exportDiffToAdmin(diffData: { id: string; diffQty: number; voxel: string }[]) {
  try {
    const worksheetData = diffData.map((item) => ({
      Артикул: item.id,
      Изменение: item.diffQty,
      Ячейка: item.voxel,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Изменения");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const bomBuffer = Buffer.concat([Buffer.from("\uFEFF", "utf8"), buffer]); // Add BOM for UTF-8
    writeFileSync("/tmp/diff_export.xlsx", bomBuffer);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("wb")
      .upload(`exports/diff_${Date.now()}.xlsx`, bomBuffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function exportCurrentStock(items: Item[]) {
  try {
    const worksheetData = items.map((item) => ({
      Артикул: item.id,
      Название: item.name,
      Количество: item.total_quantity,
      Ячейки: item.locations.map((l) => `${l.voxel}:${l.quantity}`).join(", "),
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Склад");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const bomBuffer = Buffer.concat([Buffer.from("\uFEFF", "utf8"), buffer]); // Add BOM for UTF-8
    writeFileSync("/tmp/stock_export.xlsx", bomBuffer);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("wb")
      .upload(`exports/stock_${Date.now()}.xlsx`, bomBuffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}