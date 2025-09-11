"use client";

import React, { useState, useCallback } from "react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { uploadWarehouseCsv } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clipboard, Download, Upload } from "lucide-react";
import Link from "next/link";

interface InventoryItem {
    id: string;
    quantity: number;
}

interface CsvRow {
    Артикул: string;
    Количество: string;
    [key: string]: string;
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
    const [inventory1, setInventory1] = useState<InventoryItem[]>([]);
    const [inventory2, setInventory2] = useState<InventoryItem[]>([]);
    const [differences, setDifferences] = useState<string[]>([]);
    const [hideZeroQuantity, setHideZeroQuantity] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [popularItems, setPopularItems] = useState<any[]>([]);
    const [diffCounts, setDiffCounts] = useState<{ [id: string]: number }>({});
    const { user } = useAppContext();

    const parseCSV = useCallback(
        (csvText: string, setInventory: (items: InventoryItem[]) => void) => {
            parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const inventoryMap: { [id: string]: number } = {};

                    results.data.forEach((row: any) => {
                        const id = row["Артикул"] || row["id"];
                        let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;
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

                        if (id) {
                            inventoryMap[id] = (inventoryMap[id] || 0) + quantity;
                        }
                    });

                    const inventoryList: InventoryItem[] = Object.entries(inventoryMap).map(
                        ([id, quantity]) => ({
                            id,
                            quantity,
                        })
                    );

                    setInventory(inventoryList);
                },
                error: (error) => {
                    console.error("Ошибка парсинга CSV:", error);
                    toast.error("Ошибка парсинга CSV. Проверьте консоль.");
                },
            });
        },
        []
    );

    const compareInventories = useCallback(() => {
        const id1 = new Set(inventory1.map((i) => i.id));
        const id2 = new Set(inventory2.map((i) => i.id));

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

        modifiedItems.forEach((id) => {
            const item1 = inventory1.find((i) => i.id === id);
            const item2 = inventory2.find((i) => i.id === id);
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

        const allItems = [...inventory1, ...inventory2];
        const itemCount: { [id: string]: number } = {};

        allItems.forEach((item) => {
            itemCount[item.id] = (itemCount[item.id] || 0) + item.quantity;
        });

        const sortedItems = Object.entries(itemCount)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 13)
            .map(([id, count]) => ({ id, count }));
        setPopularItems(sortedItems);
    }, [inventory1, inventory2]);

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
      const csv = inventoryToCsv(inventory2, false, true);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory_db_ready.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    };

    const handleConvertToSummarized = () => {
      const csv = inventoryToCsv(inventory2);
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
    }, [csv2, user, uploadWarehouseCsv, toast]);

    const filteredInventory1 = hideZeroQuantity
        ? inventory1.filter((item) => item.quantity > 0)
        : inventory1;
    const filteredInventory2 = hideZeroQuantity
        ? inventory2.filter((item) => item.quantity > 0)
        : inventory2;

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
                    </ul>
                </CardContent>
            </Card>

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
                                const csv = inventoryToCsv(inventory1);
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
                                const csv = inventoryToCsv(inventory2);
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

            <div className="mb-4 flex items-center space-x-4">
                <label className="inline-flex items-center">
                    <input
                        type="checkbox"
                        className="mr-2"
                        checked={hideZeroQuantity}
                        onChange={(e) => setHideZeroQuantity(e.target.checked)}
                    />
                    <span className="text-gray-700">Скрыть товары с 0 количеством</span>
                </label>
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
            <Link href="/wb">
                <Button size="sm" variant="outline" className="text-[10px] mt-4 w-full">Вернуться в WB</Button>
            </Link>
        </div>
    );
};

export default CSVCompare;