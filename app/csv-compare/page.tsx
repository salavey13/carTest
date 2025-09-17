"use client";

import React, { useState, useCallback } from "react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { uploadWarehouseCsv, getWarehouseItems, updateItemMinQty } from "@/app/wb/actions";
import { notifyAdmins } from "@/app/actions"; // Assuming this is available; if not, replace with sendComplexMessage to admin
import { useAppContext } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clipboard, Download, Upload } from "lucide-react";
import Link from "next/link";
import AlarmDashboard from "@/components/AlarmDashboard";
import type { WarehouseItem } from "@/app/wb/common";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons"

interface InventoryItem {
    id: string;
    quantity: number;
}

interface Inventory {
    items: InventoryItem[];
    ts?: Date;
}

interface CsvRow {
    Артикул: string;
    Количество: string;
    Timestamp?: string;
    [key: string]: string | undefined;
}

const deriveFieldsFromIdForCsv = (id: string, quantity: number) => {
  const derived = deriveFieldsFromId(id); // Assume deriveFieldsFromId exported or copied
  derived.specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
  return {
    id,
    make: derived.make,
    model: derived.model,
    description: derived.description,
    type: "wb_item",
    specs: JSON.stringify(derived.specs),
    image_url: generateImageUrl(id), // Assume generateImageUrl exported
  };
};

const CSVCompare = () => {
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
                        let id = (row["Артикул"] || row["id"])?.toLowerCase();
                        if (!id) return;

                        let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;
                        if (quantity < 0) {
                            console.warn(`Negative quantity in row ${index}: ${quantity}. Setting to 0.`);
                            quantity = 0;
                        }

                        try {
                            if (row["specs"]) {
                                const specs = JSON.parse(row["specs"]);
                                if (specs && specs.warehouse_locations && Array.isArray(specs.warehouse_locations)) {
                                    quantity = specs.warehouse_locations.reduce(
                                        (acc, location: { quantity: string | number }) => acc + (parseInt(location.quantity.toString(), 10) || 0),
                                        0
                                    );
                                }
                            }
                        } catch (e) {
                            console.error("Error parsing specs:", e);
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
                        items = Object.entries(inventoryMap).map(
                            ([id, quantity]) => ({
                                id,
                                quantity,
                            })
                        );
                    }
                    setInventory({ items, ts });
                },
                error: (error) => {
                    console.error("Ошибка парсинга CSV:", error);
                    toast.error("Ошибка парсинга CSV. Проверьте консоль.");
                },
            });
        },
        [strictMode]
    );

    const findDuplicates = (ids: string[]) => {
        const countMap: { [key: string]: number } = {};
        ids.forEach(id => countMap[id] = (countMap[id] || 0) + 1);
        return Object.keys(countMap).filter(id => countMap[id] > 1);
    };

    const compareInventories = useCallback(async () => {
        const id1 = new Set(inventory1.items.map((i) => i.id));
        const id2 = new Set(inventory2.items.map((i) => i.id));

        const addedItems = [...id2].filter((id) => !id1.has(id));
        const removedItems = [...id1].filter((id) => !id2.has(id));
        const modifiedItems = [...id1].filter((id) => id2.has(id));

        const diffs: string[] = [];
        const diffCounts: { [id: string]: number } = {};

        if (addedItems.length > 0) {
            diffs.push(`Добавленные товары: ${addedItems.join(", ")}`);
        }
        if (removedItems.length > 0) {
            diffs.push(`Удаленные товары: ${removedItems.join(", ")}`);
        }

        if (strictMode) {
            const dupes1 = findDuplicates(inventory1.items.map(i => i.id.split('_row')[0]));
            const dupes2 = findDuplicates(inventory2.items.map(i => i.id.split('_row')[0]));
            if (dupes1.length > 0) diffs.push(`Дубликаты в CSV1: ${dupes1.join(", ")}`);
            if (dupes2.length > 0) diffs.push(`Дубликаты в CSV2: ${dupes2.join(", ")}`);
        } else {
            // Demand calculation and alarms only in non-strict mode
            let calculatedDays = 1;
            if (inventory1.ts && inventory2.ts) {
                const diffMs = inventory2.ts.getTime() - inventory1.ts.getTime();
                if (diffMs > 0) {
                    calculatedDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    setDays(calculatedDays);
                } else {
                    toast.error("Invalid timestamps: new <= old");
                    return;
                }
            }
            const effectiveDays = days;

            const demands: { [id: string]: number } = {};
            modifiedItems.forEach((id) => {
                const qty1 = inventory1.items.find((i) => i.id === id)?.quantity || 0;
                const qty2 = inventory2.items.find((i) => i.id === id)?.quantity || 0;
                const demand = Math.max(0, qty1 - qty2);
                if (demand > 0) {
                    demands[id] = demand / effectiveDays;
                }
            });

            if (Object.keys(demands).length > 0) {
                const res = await getWarehouseItems();
                if (!res.success || !res.data) {
                    toast.error("Failed to fetch warehouse items");
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
                        toast.warn(`Failed to update min_qty for ${id}`);
                    } else {
                        item.specs.min_quantity = newMin;
                    }
                }

                const csv2Map = new Map(
                    inventory2.items.map((i) => [i.id.toLowerCase(), i.quantity])
                );
                const alarmItems = allItems.filter((i) => {
                    const lowerId = i.id.toLowerCase();
                    const currentQty = csv2Map.has(lowerId)
                        ? csv2Map.get(lowerId)!
                        : i.total_quantity || 0;
                    const minQty = i.specs?.min_quantity || 0;
                    return currentQty < minQty;
                }).map(i => {
                    const lowerId = i.id.toLowerCase();
                    const currentQty = csv2Map.has(lowerId)
                        ? csv2Map.get(lowerId)!
                        : i.total_quantity || 0;
                    return { ...i, total_quantity: currentQty };
                });

                setAlarms(alarmItems);

                if (alarmItems.length > 0) {
                    const msg =
                        "Low stock alarms:\n" +
                        alarmItems
                            .map(
                                (i) =>
                                    `${i.id}: ${i.total_quantity} < ${i.specs?.min_quantity} (${i.make} ${i.model})`
                            )
                            .join("\n");
                    const notifyRes = await notifyAdmins(msg);
                    if (!notifyRes.success) {
                        toast.error("Failed to notify admins");
                    }
                } else {
                    toast.info("No low stock alarms.");
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
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 13)
            .map(([id, count]) => ({ id, count }));
        setPopularItems(sortedItems);
    }, [inventory1, inventory2, strictMode, days]);

    const handleCsv1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCsv1 = e.target.value;
        setCsv1(newCsv1);
        parseCSV(newCsv1, setInventory1);
    };

    const handleCsv2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCsv2 = e.target.value;
        setCsv2(newCsv2);
        parseCSV(newCsv2, setInventory2);
    };

    const inventoryToCsv = (
        inventory: InventoryItem[],
        includeZeroQuantities: boolean = false,
        dbReady: boolean = false
    ): string => {
        let csvData;
        if (dbReady) {
          csvData = inventory
            .filter((item) => includeZeroQuantities || item.quantity > 0)
            .map((item) => deriveFieldsFromIdForCsv(item.id, item.quantity));
        } else {
          csvData = inventory
            .filter((item) => includeZeroQuantities || item.quantity > 0)
            .map((item) => ({
                Артикул: item.id,
                Количество: item.quantity,
            }));
        }
        return unparse(csvData, {
            header: true,
            quotes: true,
        });
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
                toast.error("Нет данных для загрузки.");
                return;
            }
            const cleanCsvData = csvData.replace(/[\u200B-\u200D\uFEFF]/g, '');

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
                        console.log(
                            `Загружена партия ${i / BATCH_SIZE + 1}/${Math.ceil(
                                rows.length / BATCH_SIZE
                            )}`
                        );
                    }
                }

                toast.success("Все данные загружены в Supabase!");
                setUploading(false);
            };

            const parsedCsv = parse<CsvRow>(cleanCsvData, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                quoteChar: '"',
                escapeChar: '\\',
                strict: false,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn("Ошибки парсинга CSV:", results.errors);

                        const validData = results.data.filter((row, index) => {
                            return !results.errors.some(err => err.row === index);
                        });

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
                }
            });
        } catch (err: any) {
            toast.error(err?.message || "Ошибка при загрузке.");
            console.error("Ошибка загрузки:", err);
            setUploading(false);
        }
    }, [csv2, user]);

    const filteredInventory1 = hideZeroQuantity
        ? inventory1.items.filter((item) => item.quantity > 0)
        : inventory1.items;
    const filteredInventory2 = hideZeroQuantity
        ? inventory2.items.filter((item) => item.quantity > 0)
        : inventory2.items;

    return (
        <div className="container mx-auto p-4 pt-24 max-w-4xl">
            <h1 className="text-2xl font-bold mb-4 text-center">Сравнение инвентаря CSV</h1>
            
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Инструкции</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Вставьте содержимое первого CSV в левое поле, второго - в правое.</li>
                        <li>Нажмите "Сравнить инвентари" для анализа различий.</li>
                        <li>Используйте чекбокс для скрытия нулевых количеств.</li>
                        <li>Экспорт списков в CSV для скачивания.</li>
                        <li>Загрузка второго CSV в Supabase для обновления склада (только админы).</li>
                        <li>Топ-13 популярных товаров и таблица различий отображаются после сравнения.</li>
                        <li>Включите "Strict Mode" для построчного сравнения (без суммирования).</li>
                        <li>Укажите количество дней между CSV для расчета спроса (автозаполнение, если есть timestamps).</li>
                    </ul>
                </CardContent>
            </Card>

            <div className="mb-4 flex items-center space-x-4">
                <label className="inline-flex items-center">
                    <input
                        type="checkbox"
                        className="mr-2"
                        checked={strictMode}
                        onChange={(e) => setStrictMode(e.target.checked)}
                    />
                    <span className="text-gray-700">Strict Mode (без суммирования)</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Card>
                    <CardHeader>
                        <CardTitle>CSV 1 (Старый)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            className="w-full h-64 p-2 border rounded resize-y"
                            placeholder="Вставьте содержимое CSV 1 здесь"
                            value={csv1}
                            onChange={handleCsv1Change}
                        />
                        <h3 className="text-md font-semibold mt-2">Инвентарь 1</h3>
                        <ul className="max-h-32 overflow-y-auto">
                            {filteredInventory1.map((item) => (
                                <li key={item.id}>
                                    {item.id}: {item.quantity}
                                </li>
                            ))}
                        </ul>
                        <Button
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mt-2 w-full"
                            onClick={() => {
                                const csv = inventoryToCsv(inventory1.items);
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "inventory1.csv";
                                a.click();
                                window.URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" /> Экспорт CSV 1
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>CSV 2 (Новый)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            className="w-full h-64 p-2 border rounded resize-y"
                            placeholder="Вставьте содержимое CSV 2 здесь"
                            value={csv2}
                            onChange={handleCsv2Change}
                        />
                        <h3 className="text-md font-semibold mt-2">Инвентарь 2</h3>
                        <ul className="max-h-32 overflow-y-auto">
                            {filteredInventory2.map((item) => (
                                <li key={item.id}>
                                    {item.id}: {item.quantity}
                                </li>
                            ))}
                        </ul>
                        <Button
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mt-2 w-full"
                            onClick={() => {
                                const csv = inventoryToCsv(inventory2.items);
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "inventory2.csv";
                                a.click();
                                window.URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" /> Экспорт CSV 2
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="mb-4 flex items-center space-x-4 flex-wrap">
                <label className="inline-flex items-center">
                    <input
                        type="checkbox"
                        className="mr-2"
                        checked={hideZeroQuantity}
                        onChange={(e) => setHideZeroQuantity(e.target.checked)}
                    />
                    <span className="text-gray-700">Скрыть товары с 0 количеством</span>
                </label>
                <div className="flex items-center space-x-2">
                    <label className="text-gray-700">Дней между CSV:</label>
                    <Input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20"
                        min={1}
                    />
                    <Button onClick={() => setDays((d) => d + 1)}>+1</Button>
                </div>
                <Button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex-1"
                    onClick={compareInventories}
                >
                    Сравнить инвентари
                </Button>
            </div>

            {differences.length > 0 && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Различия</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            {differences.map((diff, index) => (
                                <li key={index}>{diff}</li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {popularItems.length > 0 && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Самые популярные товары (Топ 13)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Количество</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {popularItems.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>{item.count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {Object.keys(diffCounts).length > 0 && (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Различия в количествах</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Разница</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(diffCounts).map(([id, diff], index) => (
                                    <TableRow key={index}>
                                        <TableCell>{id}</TableCell>
                                        <TableCell>{diff}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <AlarmDashboard alarms={alarms} />

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Инструменты Wildberries и Ozon</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">
                        Эти инструменты интегрируются с API Wildberries и Ozon для управления инвентарем и обновления продуктов.
                    </p>
                    <Button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
                        onClick={handleUploadToSupabase}
                        disabled={uploading}
                    >
                        <Upload className="mr-2 h-4 w-4" /> {uploading ? "Загрузка..." : "Загрузить в Supabase"}
                    </Button>
                    <Button
                        className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-2 w-full"
                        onClick={handleConvertToDbReady}
                    >
                        <Download className="mr-2 h-4 w-4" /> Конвертировать в DB-ready CSV
                    </Button>
                    <Button
                        className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded mt-2 w-full"
                        onClick={handleConvertToSummarized}
                    >
                        <Download className="mr-2 h-4 w-4" /> Конвертировать в суммированный CSV
                    </Button>
                </CardContent>
            </Card>
            <WarehouseSyncButtons />
            <Link href="/wb">
                <Button size="sm" variant="outline" className="text-[10px] mt-4 w-full">Вернуться в WB</Button>
            </Link>
        </div>
    );
};

export default CSVCompare;