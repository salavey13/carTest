"use client";

import React, { useState, useCallback, useMemo } from "react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { uploadWarehouseCsv, getWarehouseItems, updateItemMinQty } from "@/app/wb/actions";
import { notifyAdmins } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clipboard, Download, Upload, FileText } from "lucide-react";
import Link from "next/link";
import AlarmDashboard from "@/components/AlarmDashboard";
import type { WarehouseItem } from "@/app/wb/common";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";

interface InventoryItem {
  id: string;
  quantity: number;
}

interface Inventory {
  items: InventoryItem[];
  ts?: Date | null;
}

interface CsvRow {
  Артикул: string;
  Количество: string;
  Timestamp?: string;
  [key: string]: string | undefined;
}

/* -------------------------
   Helpers: summarize by size+season
   ------------------------- */

/**
 * Попытка вытащить размер и сезон из артикла/названия.
 * Правила:
 * - Игнорируем цвет.
 * - Группируем по "размер + сезон" где сезон — 'лето' или 'зима' (вхождение слова).
 * - Для "евро макси" учитываем оба слова.
 * - Для наматрасников (наматрасник/наматрасник.) строим ключ "наматрасник.<size>"
 * - Если сезон/размер не разобрали — попадает в "unknown".
 */
function extractSizeSeason(idRaw: string): { key: string } {
  const id = (idRaw || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Проверки на наматрасники / матрасники
  if (id.includes("наматрас") || id.includes("намaтрас") || id.includes("на матрас")) {
    // найти число размера: 90,120,140,150,160,180,200
    const sizeMatch = id.match(/(?:\b|\.)(90|120|140|150|160|180|200|200x?220|150x200|180x220|200x220|160x200)/);
    const size = sizeMatch ? sizeMatch[1].toString().replace(/x/g, ".") : "unknown";
    return { key: `наматрасник.${size}` };
  }

  // сезон
  const seasonMatch = id.match(/\b(лето|зима|летний|зимний|лето\w*|зима\w*)\b/);
  const season = seasonMatch ? (seasonMatch[0].startsWith("лет") ? "лето" : "зима") : undefined;

  // размеры - приоритет сложных вариантов
  if (id.includes("евро макси") || id.includes("евро- макси") || id.includes("евро- макси")) {
    const size = "евро макси";
    const key = season ? `${size} ${season}` : `${size} неизвестно`;
    return { key };
  }

  if (id.includes("евро")) {
    const size = "евро";
    const key = season ? `${size} ${season}` : `${size} неизвестно`;
    return { key };
  }

  // 1.5, 1.5? or 1,5 style
  const sizeTokens = id.match(/\b(1[.,]5|1\.5|2|1|90|120|140|150|160|180|200)\b/);
  if (sizeTokens) {
    let sizeRaw = sizeTokens[0].replace(",", ".").replace(/\./g, (m, idx) => (sizeTokens[0].includes(".") && idx === 1 ? "." : "."));
    // normalize '1.5' -> '1.5', '2' -> '2'
    const size = sizeRaw;
    const key = season ? `${size} ${season}` : `${size} неизвестно`;
    return { key };
  }

  // fallback: try to pick first word + season
  const firstWord = id.split(" ")[0] || "unknown";
  const key = season ? `${firstWord} ${season}` : `${firstWord} неизвестно`;
  return { key };
}

/**
 * Суммирование по правилам пользователя.
 */
function summarizeBySizeSeason(items: InventoryItem[]) {
  const map: Record<string, number> = {};
  let total = 0;

  items.forEach((it) => {
    const qty = Number(it.quantity) || 0;
    if (qty === 0) return;
    const { key } = extractSizeSeason(it.id);
    map[key] = (map[key] || 0) + qty;
    total += qty;
  });

  // sort keys for stable output: prefer numeric sizes then euro then namatrasnik then unknown
  const sortedEntries = Object.entries(map).sort((a, b) => {
    const ka = a[0];
    const kb = b[0];
    // namatrasnik.* last group ordering
    if (ka.startsWith("наматрасник") && !kb.startsWith("наматрасник")) return 1;
    if (!ka.startsWith("наматрасник") && kb.startsWith("наматрасник")) return -1;
    // euro groups higher
    if (ka.startsWith("евро") && !kb.startsWith("евро")) return -1;
    if (!ka.startsWith("евро") && kb.startsWith("евро")) return 1;
    // otherwise lexicographic
    return ka.localeCompare(kb, "ru");
  });

  const ordered: { key: string; qty: number }[] = sortedEntries.map(([k, v]) => ({ key: k, qty: v }));
  return { groups: ordered, total };
}

/* -------------------------
   Основной компонент — UI адаптивный и компактный
   ------------------------- */

const deriveFieldsFromIdForCsv = (id: string, quantity: number) => {
  // placeholder fallback to match previous behaviour; in your real app use deriveFieldsFromId
  const derived = { make: "", model: "", description: "", specs: { warehouse_locations: [{ voxel_id: "A1", quantity }] } };
  return {
    id,
    make: derived.make || "Unknown Make",
    model: derived.model || "Unknown Model",
    description: derived.description || "No Description",
    type: "wb_item",
    specs: JSON.stringify(derived.specs),
    image_url: `/api/images/${id}.jpg`,
  };
};

const CSVCompare: React.FC = () => {
  const [csv1, setCsv1] = useState("");
  const [csv2, setCsv2] = useState("");
  const [inventory1, setInventory1] = useState<Inventory>({ items: [] });
  const [inventory2, setInventory2] = useState<Inventory>({ items: [] });
  const [differences, setDifferences] = useState<string[]>([]);
  const [hideZeroQuantity, setHideZeroQuantity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [popularItems, setPopularItems] = useState<any[]>([]);
  const [diffCounts, setDiffCounts] = useState<{ [id: string]: number }>({});
  const { user } = useAppContext();
  const [strictMode, setStrictMode] = useState(false);
  const [alarms, setAlarms] = useState<WarehouseItem[]>([]);
  const [days, setDays] = useState(1);

  const [summary, setSummary] = useState<{ key: string; qty: number }[] | null>(null);
  const [summaryTotal, setSummaryTotal] = useState<number | null>(null);

  const parseCSV = useCallback(
    (csvText: string, setInventory: (inv: Inventory) => void) => {
      let ts: Date | null = null;
      parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const inventoryMap: { [id: string]: number } = {};
          const strictRows: InventoryItem[] = [];

          results.data.forEach((row: any, index: number) => {
            let id = (row["Артикул"] || row["id"])?.toString().toLowerCase();
            if (!id) return;

            let quantity = parseInt(row["Количество"] || row.quantity || "0", 10) || 0;
            if (quantity < 0) quantity = 0;

            try {
              if (row["specs"]) {
                const specs = JSON.parse(row["specs"]);
                if (specs && specs.warehouse_locations && Array.isArray(specs.warehouse_locations)) {
                  quantity = specs.warehouse_locations.reduce(
                    (acc: number, location: { quantity: string | number }) => acc + (parseInt(location.quantity.toString(), 10) || 0),
                    0
                  );
                }
              }
            } catch (e) {
              // ignore bad specs
            }

            if (row.Timestamp && !ts) {
              const potentialTs = new Date(row.Timestamp);
              if (!isNaN(potentialTs.getTime())) ts = potentialTs;
            }

            if (strictMode) {
              const uniqueId = `${id}_row${index}`;
              strictRows.push({ id: uniqueId, quantity });
            } else {
              inventoryMap[id] = (inventoryMap[id] || 0) + quantity;
            }
          });

          let items: InventoryItem[];
          if (strictMode) {
            items = strictRows;
          } else {
            items = Object.entries(inventoryMap).map(([id, quantity]) => ({ id, quantity }));
          }
          setInventory({ items, ts });
        },
        error: (error) => {
          console.error("Ошибка парсинга CSV:", error);
          toast.error("Ошибка парсинга CSV. Проверь консоль.");
        },
      });
    },
    [strictMode]
  );

  const compareInventories = useCallback(async () => {
    const id1 = new Set(inventory1.items.map((i) => i.id));
    const id2 = new Set(inventory2.items.map((i) => i.id));

    const addedItems = [...id2].filter((id) => !id1.has(id));
    const removedItems = [...id1].filter((id) => !id2.has(id));
    const modifiedItems = [...id1].filter((id) => id2.has(id));

    const diffs: string[] = [];
    const diffCounts: { [id: string]: number } = {};

    if (addedItems.length > 0) diffs.push(`Добавленные товары: ${addedItems.slice(0, 30).join(", ")}${addedItems.length > 30 ? "..." : ""}`);
    if (removedItems.length > 0) diffs.push(`Удаленные товары: ${removedItems.slice(0, 30).join(", ")}${removedItems.length > 30 ? "..." : ""}`);

    if (strictMode) {
      // duplicates detection
      const findDuplicates = (ids: string[]) => {
        const countMap: { [key: string]: number } = {};
        ids.forEach((id) => (countMap[id] = (countMap[id] || 0) + 1));
        return Object.keys(countMap).filter((id) => countMap[id] > 1);
      };
      const dupes1 = findDuplicates(inventory1.items.map((i) => i.id.split("_row")[0]));
      const dupes2 = findDuplicates(inventory2.items.map((i) => i.id.split("_row")[0]));
      if (dupes1.length > 0) diffs.push(`Дубликаты в CSV1: ${dupes1.join(", ")}`);
      if (dupes2.length > 0) diffs.push(`Дубликаты в CSV2: ${dupes2.join(", ")}`);
    } else {
      // demand/min_qty flow kept from original
      let calculatedDays = 1;
      if (inventory1.ts && inventory2.ts) {
        const diffMs = (inventory2.ts.getTime() - inventory1.ts.getTime());
        if (diffMs > 0) {
          calculatedDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        } else {
          toast.error("Invalid timestamps: new <= old");
          return;
        }
      }
      const effectiveDays = days || calculatedDays;

      const demands: { [id: string]: number } = {};
      modifiedItems.forEach((id) => {
        const qty1 = inventory1.items.find((i) => i.id === id)?.quantity || 0;
        const qty2 = inventory2.items.find((i) => i.id === id)?.quantity || 0;
        const demand = Math.max(0, qty1 - qty2);
        if (demand > 0) demands[id] = demand / effectiveDays;
      });

      if (Object.keys(demands).length > 0) {
        const res = await getWarehouseItems();
        if (!res.success || !res.data) {
          toast.error("Не удалось получить товары со склада");
          return;
        }
        const allItems = res.data;
        const itemMap = new Map(allItems.map((i) => [i.id.toLowerCase(), i]));

        for (const [id, dailyDemand] of Object.entries(demands)) {
          const lowerId = id.toLowerCase();
          const item = itemMap.get(lowerId);
          if (!item) continue;
          const oldMin = item.specs?.min_quantity || 0;
          const newMin = oldMin === 0 ? dailyDemand : (oldMin + dailyDemand) / 2;
          const upRes = await updateItemMinQty(item.id, newMin);
          if (!upRes.success) {
            toast.warn(`Не удалось обновить min_qty для ${id}`);
          } else {
            item.specs.min_quantity = newMin;
          }
        }

        const csv2Map = new Map(inventory2.items.map((i) => [i.id.toLowerCase(), i.quantity]));
        const alarmItems = allItems
          .filter((i) => {
            const lowerId = i.id.toLowerCase();
            const currentQty = csv2Map.has(lowerId) ? csv2Map.get(lowerId)! : i.total_quantity || 0;
            const minQty = i.specs?.min_quantity || 0;
            return currentQty < minQty;
          })
          .map((i) => {
            const lowerId = i.id.toLowerCase();
            const currentQty = csv2Map.has(lowerId) ? csv2Map.get(lowerId)! : i.total_quantity || 0;
            return { ...i, total_quantity: currentQty };
          });

        setAlarms(alarmItems);

        if (alarmItems.length > 0) {
          const msg =
            "Low stock alarms:\n" +
            alarmItems.map((i) => `${i.id}: ${i.total_quantity} < ${i.specs?.min_quantity} (${i.make} ${i.model})`).join("\n");
          const notifyRes = await notifyAdmins(msg);
          if (!notifyRes.success) toast.error("Не удалось уведомить админов");
        } else {
          toast.info("Нет тревог по запасам.");
        }
      }
    }

    modifiedItems.forEach((id) => {
      const item1 = inventory1.items.find((i) => i.id === id);
      const item2 = inventory2.items.find((i) => i.id === id);
      const qty1 = item1?.quantity || 0;
      const qty2 = item2?.quantity || 0;
      const diff = qty2 - qty1;
      if (diff !== 0) {
        diffs.push(`${id}: ${qty1} -> ${qty2} (Разница: ${diff})`);
        diffCounts[id] = diff;
      }
    });

    setDifferences(diffs);
    setDiffCounts(diffCounts);

    const allItems = [...inventory1.items, ...inventory2.items];
    const itemCount: { [id: string]: number } = {};
    allItems.forEach((item) => {
      itemCount[item.id] = (itemCount[item.id] || 0) + item.quantity;
    });

    const sortedItems = Object.entries(itemCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 13)
      .map(([id, count]) => ({ id, count }));
    setPopularItems(sortedItems);

    toast.success("Сравнение завершено");
  }, [inventory1, inventory2, strictMode, days]);

  const handleCsv1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCsv1 = e.target.value;
    setCsv1(newCsv1);
    parseCSV(newCsv1, setInventory1);
    // reset summary on change
    setSummary(null);
    setSummaryTotal(null);
  };

  const handleCsv2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCsv2 = e.target.value;
    setCsv2(newCsv2);
    parseCSV(newCsv2, setInventory2);
    setSummary(null);
    setSummaryTotal(null);
  };

  const inventoryToCsv = (inventory: InventoryItem[], includeZeroQuantities = false, dbReady = false) => {
    let csvData;
    if (dbReady) {
      csvData = inventory.filter((item) => includeZeroQuantities || item.quantity > 0).map((item) => deriveFieldsFromIdForCsv(item.id, item.quantity));
    } else {
      csvData = inventory.filter((item) => includeZeroQuantities || item.quantity > 0).map((item) => ({ Артикул: item.id, Количество: item.quantity }));
    }
    return unparse(csvData, { header: true, quotes: true });
  };

  const handleConvertToDbReady = () => {
    const csv = inventoryToCsv(inventory2.items, false, true);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_db_ready.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleConvertToSummarized = () => {
    const csv = inventoryToCsv(inventory2.items);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_summarized.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUploadToSupabase = useCallback(async () => {
    setUploading(true);
    try {
      const csvData = csv2;
      if (!csvData.trim()) {
        toast.error("Пустые данные для загрузки.");
        setUploading(false);
        return;
      }
      const cleanCsvData = csvData.replace(/[\u200B-\u200D\uFEFF]/g, "");

      const processData = async (data: CsvRow[]) => {
        const BATCH_SIZE = 13;
        const rows = data;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const result = await uploadWarehouseCsv(batch, user?.id);
          if (!result.success) {
            toast.error(result.error || "Ошибка загрузки партии в Supabase.");
            setUploading(false);
            return;
          } else {
            console.log(`Загружена партия ${i / BATCH_SIZE + 1}/${Math.ceil(rows.length / BATCH_SIZE)}`);
          }
        }
        toast.success("Все данные загружены в Supabase!");
        setUploading(false);
      };

      parse<CsvRow>(cleanCsvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn("Ошибки парсинга CSV:", results.errors);
            const validData = results.data.filter((row, index) => !results.errors.some((err) => err.row === index));
            if (validData.length === 0) {
              toast.error("Нет валидных данных после восстановления.");
              setUploading(false);
              return;
            }
            processData(validData);
          } else {
            processData(results.data);
          }
        },
        error: (error) => {
          console.error("Ошибка парсинга CSV:", error);
          toast.error(`Ошибка парсинга CSV: ${error.message}`);
          setUploading(false);
        },
      });
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при загрузке.");
      console.error("Ошибка загрузки:", err);
      setUploading(false);
    }
  }, [csv2, user]);

  const filteredInventory1 = hideZeroQuantity ? inventory1.items.filter((item) => item.quantity > 0) : inventory1.items;
  const filteredInventory2 = hideZeroQuantity ? inventory2.items.filter((item) => item.quantity > 0) : inventory2.items;

  /* ---------- New: summarize button ---------- */
  const summarizeCurrentCsv2 = useCallback(() => {
    const { groups, total } = summarizeBySizeSeason(inventory2.items);
    setSummary(groups);
    setSummaryTotal(total);
  }, [inventory2]);

  const exportSummaryCsv = useCallback(() => {
    if (!summary) {
      toast.error("Нет данных для экспорта.");
      return;
    }
    const rows = summary.map((g) => ({ Группа: g.key, Количество: g.qty }));
    rows.push({ Группа: "Всего", Количество: summaryTotal || 0 });
    const csv = unparse(rows, { header: true, quotes: true });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_summary.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  }, [summary, summaryTotal]);

  /* ---------- Responsive UI tweaks: smaller text on mobile, clearer layout ---------- */

  return (
    <div className="container mx-auto p-4 pt-24 max-w-6xl">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-center title-wheelie-effect">
        <span>CSV — сравнение и суммаризация</span>
      </h1>

      <Card className="mb-6 shadow-glow">
        <CardHeader>
          <CardTitle>Инструкции</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm md:text-base">
            <li>Вставьте CSV 1 (старый) и CSV 2 (новый). Форматы: "Артикул" и "Количество" — достаточно.</li>
            <li>Нажмите <strong>Сравнить инвентари</strong> для анализа отличий.</li>
            <li>Нажмите <strong>Суммировать по размер+сезон</strong>, чтобы получить группировку, как ты просил (игнор цвета).</li>
            <li>Используйте чекбокс, чтобы скрыть нулевые количества.</li>
            <li>Конвертировать в DB-ready CSV / суммированный CSV / загрузить в Supabase — снизу.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center text-sm sm:text-base">
            <input type="checkbox" className="mr-2" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
            <span>Strict Mode</span>
          </label>
          <label className="inline-flex items-center text-sm sm:text-base">
            <input type="checkbox" className="mr-2" checked={hideZeroQuantity} onChange={(e) => setHideZeroQuantity(e.target.checked)} />
            <span>Скрыть 0</span>
          </label>
        </div>

        <div className="flex gap-2 items-center">
          <Input type="number" value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 text-sm" min={1} />
          <Button onClick={() => setDays((d) => d + 1)} variant="outline" size="sm">+1</Button>
          <Button onClick={compareInventories} className="bg-blue-500 hover:bg-blue-700 text-white" ><FileText className="mr-2 h-4 w-4" /> Сравнить инвентари</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>CSV 1 — Старый</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="textarea-cyber w-full h-56 p-2 rounded text-xs sm:text-sm md:text-base"
              placeholder="Вставьте CSV 1..."
              value={csv1}
              onChange={handleCsv1Change}
            />
            <h3 className="text-sm sm:text-base font-semibold mt-2">Инвентарь 1 — {filteredInventory1.length} позиций</h3>
            <ul className="max-h-40 overflow-y-auto text-xs sm:text-sm simple-scrollbar mt-1">
              {filteredInventory1.map((it) => (
                <li key={it.id} className="py-0.5">{it.id}: <strong>{it.quantity}</strong></li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => {
                const csv = inventoryToCsv(inventory1.items);
                const blob = new Blob([csv], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "inventory1.csv"; a.click(); window.URL.revokeObjectURL(url);
              }} className="flex-1"><Download className="mr-2 h-4 w-4" /> Экспорт CSV 1</Button>
              <Button onClick={() => { navigator.clipboard.writeText(csv1 || ""); toast.success("Скопировано"); }} variant="outline"><Clipboard /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV 2 — Новый</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="textarea-cyber w-full h-56 p-2 rounded text-xs sm:text-sm md:text-base"
              placeholder="Вставьте CSV 2..."
              value={csv2}
              onChange={handleCsv2Change}
            />
            <h3 className="text-sm sm:text-base font-semibold mt-2">Инвентарь 2 — {filteredInventory2.length} позиций</h3>
            <ul className="max-h-40 overflow-y-auto text-xs sm:text-sm simple-scrollbar mt-1">
              {filteredInventory2.map((it) => (
                <li key={it.id} className="py-0.5">{it.id}: <strong>{it.quantity}</strong></li>
              ))}
            </ul>

            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => { const csv = inventoryToCsv(inventory2.items); const blob = new Blob([csv], { type: "text/csv" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "inventory2.csv"; a.click(); window.URL.revokeObjectURL(url); }}><Download className="mr-2 h-4 w-4" /> Экспорт CSV 2</Button>
              <Button onClick={() => { navigator.clipboard.writeText(csv2 || ""); toast.success("Скопировано"); }} variant="outline"><Clipboard /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Инструменты</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button className="w-full" onClick={handleUploadToSupabase} disabled={uploading}><Upload className="mr-2" /> {uploading ? "Загрузка..." : "Загрузить в Supabase"}</Button>
            <Button className="w-full" onClick={handleConvertToDbReady}><Download className="mr-2" /> Конвертировать в DB-ready CSV</Button>
            <Button className="w-full" onClick={handleConvertToSummarized}><Download className="mr-2" /> Конвертировать в суммированный CSV</Button>
            <Button className="w-full" onClick={summarizeCurrentCsv2}><FileText className="mr-2" /> Суммировать по размер+сезон</Button>
            {summary && <div className="pt-2">
              <Button className="w-full" onClick={exportSummaryCsv}><Download className="mr-2" /> Экспортировать сводную таблицу</Button>
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Топ-13</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Количество</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {popularItems.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs sm:text-sm">{it.id}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{it.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Различия</CardTitle></CardHeader>
          <CardContent className="max-h-48 overflow-y-auto simple-scrollbar">
            {differences.length === 0 ? <div className="text-sm">Ничего не найдено — нажмите "Сравнить инвентари".</div> :
              <ul className="text-xs sm:text-sm space-y-1">
                {differences.map((d, i) => <li key={i}>{d}</li>)}
              </ul>}
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Суммаризация по размер+сезон</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs sm:text-sm md:text-base">
              <ul className="list-decimal pl-5 space-y-1">
                {summary.map((g, i) => (
                  <li key={i}>{g.key}: <strong>{g.qty}</strong></li>
                ))}
              </ul>
              <div className="mt-3 font-semibold">Общая сумма по всем позициям: {summaryTotal}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(diffCounts).length > 0 && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Таблица различий (числа)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Разница</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(diffCounts).map(([id, diff], idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs sm:text-sm">{id}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{diff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlarmDashboard alarms={alarms} />

      <Card className="mt-4">
        <CardHeader><CardTitle>Интеграции WB / Ozon</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm mb-3">Кнопки синхронизации отправляют данные на API Wildberries / Ozon — проверь env и логирование при ошибках.</p>
          <WarehouseSyncButtons />
        </CardContent>
      </Card>

      <Link href="/wb">
        <Button size="sm" variant="outline" className="text-[10px] mt-4 w-full">Вернуться в WB</Button>
      </Link>
    </div>
  );
};

export default CSVCompare;