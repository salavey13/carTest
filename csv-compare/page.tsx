"use client";

import React, { useState, useCallback } from "react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { uploadWarehouseCsv } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clipboard, Download, Upload } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import FilterAccordion from "@/components/FilterAccordion";

interface InventoryItem {
    id: string;
    quantity: number;
    specs?: { season?: string | null; pattern?: string; color?: string; size?: string; warehouse_locations?: { voxel_id: string; quantity: number }[] };
}

interface CsvRow {
    Артикул: string;
    Количество: string;
    [key: string]: string;
}

const deriveFieldsFromIdForCsv = (id: string, quantity: number) => {
  const derived = deriveFieldsFromId(id);
  derived.specs.warehouse_locations = [{ voxel_id: "A1", quantity }];
  return {
    id,
    make: derived.make,
    model: derived.model,
    description: derived.description,
    type: "wb_item",
    specs: JSON.stringify(derived.specs),
    image_url: generateImageUrl(id),
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
    const [filterSeason, setFilterSeason] = useState<string | null>(null);
    const [filterPattern, setFilterPattern] = useState<string | null>(null);
    const [filterColor, setFilterColor] = useState<string | null>(null);
    const [filterSize, setFilterSize] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [sortOption, setSortOption] = useState<'size_season_color' | 'color_size' | 'season_size_color'>('size_season_color');
    const { user } = useAppContext();

    const parseCSV = useCallback(
        (csvText: string, setInventory: (items: InventoryItem[]) => void) => {
            parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const inventoryMap: { [id: string]: InventoryItem } = {};

                    results.data.forEach((row: any) => {
                        const id = row["Артикул"] || row["id"];
                        let quantity = parseInt(row["Количество"] || row.quantity || '0', 10) || 0;
                        let specs: any = {};
                        try {
                            if (row["specs"]) {
                                specs = JSON.parse(row["specs"]);
                                if (specs && specs.warehouse_locations && Array.isArray(specs.warehouse_locations)) {
                                    quantity = specs.warehouse_locations.reduce(
                                        (acc, location: { quantity: string | number }) => acc + (parseInt(location.quantity.toString(), 10) || 0),
                                        0
                                    );
                                }
                            } else {
                                specs = deriveFieldsFromId(id).specs;
                            }
                        } catch (e) {
                            console.error("Error parsing specs:", e);
                            specs = deriveFieldsFromId(id).specs;
                        }

                        if (id) {
                            inventoryMap[id] = { id, quantity, specs };
                        }
                    });

                    const inventoryList: InventoryItem[] = Object.values(inventoryMap);
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

    const getSizePriority = (size: string | null): number => {
        if (!size) return 999;
        const sizeOrder: { [key: string]: number } = { "1.5": 1, "2": 2, "евро": 3, "евро макси": 4 };
        return sizeOrder[size] || 5;
    };

    const getSeasonPriority = (season: string | null): number => {
        if (!season) return 999;
        const seasonOrder: { [key: string]: number } = { "лето": 1, "зима": 2 };
        return seasonOrder[season] || 3;
    };

    const sortItems = useCallback((itemsToSort: InventoryItem[]) => {
        return [...itemsToSort].sort((a, b) => {
            let comparison = 0;
            switch (sortOption) {
                case 'size_season_color':
                    comparison = getSizePriority(a.specs?.size) - getSizePriority(b.specs?.size);
                    if (comparison !== 0) return comparison;
                    comparison = getSeasonPriority(a.specs?.season) - getSeasonPriority(b.specs?.season);
                    if (comparison !== 0) return comparison;
                    return (a.specs?.color || '').localeCompare(b.specs?.color || '');
                case 'color_size':
                    comparison = (a.specs?.color || '').localeCompare(b.specs?.color || '');
                    if (comparison !== 0) return comparison;
                    return getSizePriority(a.specs?.size) - getSizePriority(b.specs?.size);
                case 'season_size_color':
                    comparison = getSeasonPriority(a.specs?.season) - getSeasonPriority(b.specs?.season);
                    if (comparison !== 0) return comparison;
                    comparison = getSizePriority(a.specs?.size) - getSizePriority(b.specs?.size);
                    if (comparison !== 0) return comparison;
                    return (a.specs?.color || '').localeCompare(b.specs?.color || '');
                default:
                    return 0;
            }
        });
    }, [sortOption]);

    const filteredItems = inventory2.filter((item) => {
        const matchesSearch = item.id.toLowerCase().includes(search.toLowerCase());
        const matchesSeason = !filterSeason || item.specs?.season === filterSeason;
        const matchesPattern = !filterPattern || item.specs?.pattern === filterPattern;
        const matchesColor = !filterColor || item.specs?.color === filterColor;
        const matchesSize = !filterSize || item.specs?.size === filterSize;
        return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });

    const sortedFilteredItems = sortItems(filteredItems);

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
            .slice(0, 5)
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
                    }
                }

                toast.success("Все данные загружены в Supabase!");
                setUploading(false);
            };

            parse<CsvRow>(cleanCsvData, {
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

    const filteredInventory1 = hideZeroQuantity ? inventory1.filter((item) => item.quantity > 0) : inventory1;
    const filteredInventory2 = hideZeroQuantity ? inventory2.filter((item) => item.quantity > 0) : inventory2;

    const stats = {
        totalItems: inventory2.length,
        uniqueIds: new Set(inventory2.map(i => i.id)).size,
        totalQuantity: inventory2.reduce((sum, item) => sum + item.quantity, 0),
        bySeason: inventory2.reduce((acc, item) => {
            const season = item.specs?.season || "N/A";
            acc[season] = (acc[season] || 0) + item.quantity;
            return acc;
        }, {} as { [key: string]: number }),
        byColor: inventory2.reduce((acc, item) => {
            const color = item.specs?.color || "N/A";
            acc[color] = (acc[color] || 0) + item.quantity;
            return acc;
        }, {} as { [key: string]: number }),
        bySize: inventory2.reduce((acc, item) => {
            const size = item.specs?.size || "N/A";
            acc[size] = (acc[size] || 0) + item.quantity;
            return acc;
        }, {} as { [key: string]: number }),
    };

    const handleResetFilters = () => {
        setFilterSeason(null);
        setFilterPattern(null);
        setFilterColor(null);
        setFilterSize(null);
        setSearch("");
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground p-2">
            <header className="p-2 flex flex-col gap-2">
                <div className="flex justify-between items-center gap-2">
                    <h1 className="text-lg font-bold">Сравнение инвентаря CSV</h1>
                    <Link href="/wb">
                        <Button size="sm" variant="outline" className="text-[10px] h-6">Вернуться в WB</Button>
                    </Link>
                </div>
                <FilterAccordion
                    filterSeason={filterSeason}
                    setFilterSeason={setFilterSeason}
                    filterPattern={filterPattern}
                    setFilterPattern={setFilterPattern}
                    filterColor={filterColor}
                    setFilterColor={setFilterColor}
                    filterSize={filterSize}
                    setFilterSize={setFilterSize}
                    items={inventory2.map(i => ({ ...i, name: i.id, description: i.id, total_quantity: i.quantity, locations: i.specs?.warehouse_locations?.map(l => ({ voxel: l.voxel_id, quantity: l.quantity })) || [] }))}
                    onResetFilters={handleResetFilters}
                    includeSearch={true}
                    search={search}
                    setSearch={setSearch}
                    sortOption={sortOption}
                    setSortOption={setSortOption}
                />
            </header>

            <div className="flex-1 overflow-y-auto p-2">
                <Card className="mb-2">
                    <CardHeader className="p-2">
                        <CardTitle className="text-xs">Инструкции</CardTitle>
                    </CardHeader>
                    <CardContent className="text-[10px] p-2">
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Вставьте содержимое первого CSV (старый) в левое поле, второго (новый) - в правое.</li>
                            <li>Нажмите "Сравнить" для анализа различий.</li>
                            <li>Используйте фильтры и сортировку для анализа инвентаря.</li>
                            <li>Экспортируйте списки в CSV или загрузите новый CSV в Supabase (только админы).</li>
                            <li>Статистика и различия отображаются ниже после сравнения.</li>
                        </ul>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                        <Card>
                            <CardHeader className="p-2">
                                <CardTitle className="text-sm">CSV 1 (Старый)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2">
                                <Input
                                    as="textarea"
                                    className="w-full h-40 p-2 border rounded resize-y text-[10px]"
                                    placeholder="Вставьте содержимое CSV 1 здесь"
                                    value={csv1}
                                    onChange={handleCsv1Change}
                                />
                                <div className="mt-2 max-h-24 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-[10px]">ID</TableHead>
                                                <TableHead className="text-[10px]">Количество</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredInventory1.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-[10px]">{item.id}</TableCell>
                                                    <TableCell className="text-[10px]">{item.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-700 text-white text-[10px] h-6 w-full mt-2"
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
                                    <Download className="mr-1 h-3 w-3" /> Экспорт CSV 1
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
                        <Card>
                            <CardHeader className="p-2">
                                <CardTitle className="text-sm">CSV 2 (Новый)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2">
                                <Input
                                    as="textarea"
                                    className="w-full h-40 p-2 border rounded resize-y text-[10px]"
                                    placeholder="Вставьте содержимое CSV 2 здесь"
                                    value={csv2}
                                    onChange={handleCsv2Change}
                                />
                                <div className="mt-2 max-h-24 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-[10px]">ID</TableHead>
                                                <TableHead className="text-[10px]">Количество</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedFilteredItems.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-[10px]">{item.id}</TableCell>
                                                    <TableCell className="text-[10px]">{item.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-700 text-white text-[10px] h-6 w-full mt-2"
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
                                    <Download className="mr-1 h-3 w-3" /> Экспорт CSV 2
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <Card className="mb-2">
                    <CardHeader className="p-2">
                        <CardTitle className="text-xs">Действия</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 flex gap-2">
                        <Button
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-700 text-white text-[10px] h-6 flex-1"
                            onClick={compareInventories}
                        >
                            Сравнить
                        </Button>
                        <Button
                            size="sm"
                            className="bg-purple-500 hover:bg-purple-700 text-white text-[10px] h-6 flex-1"
                            onClick={handleConvertToDbReady}
                        >
                            <Download className="mr-1 h-3 w-3" /> DB-ready CSV
                        </Button>
                        <Button
                            size="sm"
                            className="bg-indigo-500 hover:bg-indigo-700 text-white text-[10px] h-6 flex-1"
                            onClick={handleConvertToSummarized}
                        >
                            <Download className="mr-1 h-3 w-3" /> Суммированный CSV
                        </Button>
                        <Button
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-700 text-white text-[10px] h-6 flex-1"
                            onClick={handleUploadToSupabase}
                            disabled={uploading}
                        >
                            <Upload className="mr-1 h-3 w-3" /> {uploading ? "Загрузка..." : "В Supabase"}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="mb-2">
                    <CardHeader className="p-2">
                        <CardTitle className="text-xs">Статистика</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-[10px] bg-muted rounded-lg">
                        <p>Всего товаров: {stats.totalItems}</p>
                        <p>Уникальных ID: {stats.uniqueIds}</p>
                        <p>Общее количество: {stats.totalQuantity}</p>
                        <p>По сезонам: {Object.entries(stats.bySeason).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                        <p>По цветам: {Object.entries(stats.byColor).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                        <p>По размерам: {Object.entries(stats.bySize).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                        {popularItems.length > 0 && (
                            <>
                                <p className="font-semibold mt-1">Топ-5 товаров:</p>
                                <ul className="list-disc pl-4">
                                    {popularItems.map((item, idx) => (
                                        <li key={idx}>{item.id}: {item.count}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </CardContent>
                </Card>

                {differences.length > 0 && (
                    <Card className="mb-2">
                        <CardHeader className="p-2">
                            <CardTitle className="text-xs">Различия</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 text-[10px]">
                            <ul className="space-y-1">
                                {differences.map((diff, index) => (
                                    <li key={index}>{diff}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {Object.keys(diffCounts).length > 0 && (
                    <Card className="mb-2">
                        <CardHeader className="p-2">
                            <CardTitle className="text-xs">Различия в количествах</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-[10px]">ID</TableHead>
                                        <TableHead className="text-[10px]">Разница</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(diffCounts).map(([id, diff], index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-[10px]">{id}</TableCell>
                                            <TableCell className="text-[10px]">{diff}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default CSVCompare;