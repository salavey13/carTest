"use client";

import { useState, useEffect, useMemo } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Image from "next/image";
import {
  getWarehouseItems,
  updateItemLocationQty,
  exportDiffToAdmin,
  exportCurrentStock,
} from "@/app/wb/actions";
import { toast } from "sonner";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { COLOR_MAP, SIZE_PACK, VOXELS, Item, Location } from "@/app/wb/common";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
      />
      <p className="ml-4"><VibeContentRenderer content={`${text}`} /></p>
    </div>
  );
}

// helpers
const RUS_TYPE_MAP: Record<string, string> = {
  evro: "Евро",
  "dvushka": "Двушка",
  "evro-maksi": "Евро Макси",
  "polutorka": "Полуторка",
};

function makeRussianTitle(item: Item) {
  // If item has explicit russian-ish fields in id (fake items created in loader) - map them
  const id = item.id || "";
  for (const key of Object.keys(RUS_TYPE_MAP)) {
    if (id.includes(key)) {
      // try to produce: "Евро Лето Адель"
      const pieces = id.split("-");
      const type = pieces[0];
      const season = pieces[1];
      const pattern = pieces[2];
      const typeRu = RUS_TYPE_MAP[type] || type;
      const seasonRu = season === "leto" ? "Лето" : season === "zima" ? "Зима" : season || "";
      const patternRu = pattern ? pattern.charAt(0).toUpperCase() + pattern.slice(1) : "";
      return `${typeRu}${seasonRu ? ` ${seasonRu}` : ""}${patternRu ? ` • ${patternRu}` : ""}`;
    }
  }
  // fallback: try to detect common english words and translate (simple heuristic)
  if (item.name) return item.name.replace(/(bed|mattress|cover)/gi, "покрывало");
  return item.name || "Товар";
}

export default function WBPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"name" | "quantity" | "voxel">("name");
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [workflowItems, setWorkflowItems] = useState<{ id: string; change: number; voxel?: string }[]>([]);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);
  const [selectedWorkflowVoxel, setSelectedWorkflowVoxel] = useState<string | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<{ [key: string]: { locations: Location[] } } | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [gameMode, setGameMode] = useState<"offload" | "onload" | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [sessionStart, setSessionStart] = useState(Date.now());
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [bossMode, setBossMode] = useState(false);
  const [bossTimer, setBossTimer] = useState(300000); // 5min
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; date: string }[]>([]);
  const [playerName, setPlayerName] = useState<string | null>(null);

  // Modal states (восстановленные модалки для редактирования)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [modalVoxel, setModalVoxel] = useState<string | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number | "">("");

  useEffect(() => {
    async function loadItems() {
      const { success, data, error } = await getWarehouseItems();
      if (success && data) {
        const processed = data.map((item) => {
          const locations = item.specs.warehouse_locations || [];
          const total_quantity = locations.reduce((sum: number, l: any) => sum + l.quantity, 0);
          return {
            id: item.id,
            name: `${item.make || ""} ${item.model || ""}`.trim(),
            description: item.description || "",
            image: item.image_url || "",
            locations: locations.map((l: any) => ({
              voxel: l.voxel_id,
              quantity: l.quantity,
              min_qty: item.specs.min_quantity && l.voxel_id.startsWith("B") ? item.specs.min_quantity : undefined,
            })),
            total_quantity,
            season: item.specs.season,
            pattern: item.specs.pattern,
            color: item.specs.color,
            size: item.specs.size,
          } as Item;
        });

        // Add demo dynamic ru items if missing (same as before but with ru fields)
        const newItems: Item[] = [...processed];
        ["evro", "dvushka", "evro-maksi", "polutorka"].forEach((type) => {
          ["adel", "malvina"].forEach((pattern) => {
            ["leto", "zima"].forEach((season) => {
              const id = `${type}-${season}-${pattern}`;
              if (!newItems.some((i) => i.id === id)) {
                newItems.push({
                  id,
                  name: `${RUS_TYPE_MAP[type] || type} ${season === "leto" ? "Лето" : "Зима"} ${pattern === "adel" ? "Адель" : "Мальвина"}`,
                  description: pattern === "adel" ? "Бежевая, белое голубой горошек" : "Бежевая, мятное фиолетовый цветок",
                  image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/${id}.jpg`,
                  locations: [],
                  total_quantity: 0,
                  season,
                  pattern,
                  color: type === "evro" ? "beige" : type === "dvushka" ? "blue" : type === "evro-maksi" ? "red" : "gray",
                  size: type === "evro" ? "180x220" : type === "dvushka" ? "200x220" : type === "evro-maksi" ? "220x240" : "150x200",
                } as Item);
              }
            });
          });
        });
        setItems(newItems);
      } else {
        console.error("Ошибка загрузки товаров:", error);
        toast.error(error || "Ошибка загрузки товаров");
        setErrorCount((prev) => prev + 1);
      }
      setLoading(false);
      const stored = localStorage.getItem("warehouse_checkpoint");
      if (stored) setLastCheckpoint(JSON.parse(stored));
      const ach = localStorage.getItem("achievements");
      if (ach) setAchievements(JSON.parse(ach));
      const lb = localStorage.getItem("leaderboard");
      if (lb) setLeaderboard(JSON.parse(lb));
      setStartTime(Date.now());
      setSessionStart(Date.now());
      const name = localStorage.getItem("playerName");
      if (name) {
        setPlayerName(name);
      } else {
        // don't prompt in headless/CI. operator can set name in profile or via localStorage manually.
        setPlayerName(null);
      }
    }
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bossMode && bossTimer > 0) {
      const interval = setInterval(() => setBossTimer((prev) => prev - 1000), 1000);
      return () => clearInterval(interval);
    } else if (bossMode && bossTimer <= 0) {
      toast.error("Критическая операция не завершена вовремя!");
      setBossMode(false);
    }
  }, [bossMode, bossTimer]);

  const filteredItems = useMemo(() => {
    return items
      .filter(
        (i) =>
          (!filterSeason || i.season === filterSeason) &&
          (!filterPattern || i.pattern === filterPattern) &&
          (!filterColor || i.color === filterColor) &&
          (!filterSize || i.size === filterSize) &&
          i.name.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => {
        if (sortBy === "quantity") return b.total_quantity - a.total_quantity;
        if (sortBy === "voxel") return (a.locations[0]?.voxel || "").localeCompare(b.locations[0]?.voxel || "");
        return a.name.localeCompare(b.name);
      });
  }, [items, sortBy, filterSeason, filterPattern, filterColor, filterSize, search]);

  const totals = useMemo(() => filteredItems.reduce((acc, i) => acc + i.total_quantity, 0), [filteredItems]);

  const handleSelectVoxel = (id: string) => {
    setSelectedVoxel(id);
    if (!gameMode) {
      const content = items.flatMap((i) => i.locations.filter((l) => l.voxel === id).map((l) => ({ item: i, qty: l.quantity })));
      if (content.length > 0) {
        setModalItem(content[0].item);
        setModalVoxel(id);
        setModalQuantity(content[0].qty);
      } else {
        setModalItem(null);
        setModalVoxel(id);
        setModalQuantity("");
      }
      setModalOpen(true);
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const item = items.find((i) => i.id === id);
    if (item?.locations[0]) setSelectedVoxel(item.locations[0].voxel);
    if (!gameMode) {
      setModalItem(item || null);
      setModalVoxel(item?.locations[0]?.voxel || null);
      setModalQuantity(item?.locations[0]?.quantity ?? "");
      setModalOpen(true);
    }
  };

  const handleUpdateLocationQty = async (itemId: string, voxelId: string, quantity: number, isGameAction = false) => {
    const item = items.find((i) => i.id === itemId);
    const loc = item?.locations.find((l) => l.voxel === voxelId);
    if (voxelId.startsWith("B") && loc?.min_qty && quantity < loc.min_qty) {
      toast.warn("Минимальный запас на полке B! Требуется полный пересчет.");
      setErrorCount((prev) => prev + 1);
      return;
    }
    const { success, error } = await updateItemLocationQty(itemId, voxelId, quantity);
    if (success) {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === itemId) {
            let locations = [...i.locations];
            const index = locations.findIndex((l) => l.voxel === voxelId);
            if (index >= 0) {
              if (quantity <= 0) {
                locations.splice(index, 1);
              } else {
                locations[index].quantity = quantity;
              }
            } else if (quantity > 0) {
              locations.push({ voxel: voxelId, quantity });
            }
            const newQty = locations.reduce((sum, l) => sum + l.quantity, 0);
            return { ...i, locations, total_quantity: newQty };
          }
          return i;
        }),
      );
      toast.success("Обновление выполнено");
      if (modalOpen && modalVoxel === voxelId) {
        setModalOpen(false);
        setModalItem(null);
        setModalVoxel(null);
        setModalQuantity("");
      }
    } else {
      toast.error(error || "Ошибка обновления");
      setErrorCount((prev) => prev + 1);
    }
  };

  const handlePlateClick = (voxelId: string) => {
    if (!gameMode) return;
    const content = items.flatMap((i) => i.locations.filter((l) => l.voxel === voxelId).map((l) => ({ item: i, quantity: l.quantity })));
    if (content.length > 0) {
      const mainItem = content[0].item;
      const delta = gameMode === "offload" ? -1 : 1;
      handleUpdateLocationQty(mainItem.id, voxelId, content[0].quantity + delta, true);
    } else if (gameMode === "onload") {
      toast.warning("Ячейка пуста. Добавьте товар через интерфейс.");
      handleSelectVoxel(voxelId);
    }
  };

  const handleItemClick = (itemId: string) => {
    if (!gameMode) return handleSelectItem(itemId);
    const item = items.find((i) => i.id === itemId);
    if (!item?.locations[0]) {
      toast.error("Локация не указана. Добавьте вручную.");
      setErrorCount((prev) => prev + 1);
      return;
    }
    const voxelId = item.locations[0].voxel;
    const currentQty = item.locations[0].quantity;
    const delta = gameMode === "offload" ? -1 : 1;
    handleUpdateLocationQty(itemId, voxelId, currentQty + delta, true);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setImportFile(file);
      Papa.parse(file, {
        complete: (results) => {
          const changes = (results.data as any[])
            .map((row: any) => {
              const id = row["Артикул продавца"] || row["Баркод"] || row["Артикул"] || row["SKU"];
              const change = parseInt(row["Количество"] || row["Quantity"] || row["Qty"]);
              return { id, change, voxel: row["voxel"] || row["voxel_id"] || undefined };
            })
            .filter((c) => c.id && !isNaN(c.change));
          setWorkflowItems(changes);
          setCurrentWorkflowIndex(0);
          if (changes.length > 20) {
            setBossMode(true);
            setBossTimer(300000);
            toast.warn("Критическая операция! Завершите за 5 минут для бонуса x1.5.");
          }
        },
        header: true,
      });
    }
  };

  const handleWorkflowNext = async () => {
    if (currentWorkflowIndex < workflowItems.length) {
      const { id, change, voxel: importVoxel } = workflowItems[currentWorkflowIndex];
      const voxel = selectedWorkflowVoxel || importVoxel || items.find((i) => i.id === id)?.locations[0]?.voxel;
      if (!voxel) {
        toast.error("Выберите локацию");
        setErrorCount((prev) => prev + 1);
        return;
      }
      const item = items.find((i) => i.id === id);
      const currentQty = item?.locations.find((l) => l.voxel === voxel)?.quantity || 0;
      await handleUpdateLocationQty(id, voxel, currentQty + change, true);
      setSelectedWorkflowVoxel(null);
      setCurrentWorkflowIndex((prev) => prev + 1);
    } else {
      setWorkflowItems([]);
      toast.success("Импорт завершен");
      const timeSpent = Date.now() - (startTime || Date.now());
      const prevBest = localStorage.getItem("bestTime");
      if (!prevBest || timeSpent < parseInt(prevBest)) {
        localStorage.setItem("bestTime", timeSpent.toString());
        setAchievements((prev) => [...new Set([...prev, "Рекорд времени"])]);
      }
      if (timeSpent < 300000) setAchievements((prev) => [...new Set([...prev, "Молниеносная операция"])]);
      if (bossMode) {
        setBossMode(false);
        if (bossTimer > 0) {
          setScore((prev) => prev * 1.5);
          setAchievements((prev) => [...new Set([...prev, "Мастер критических операций"])]);
        }
      }
    }
  };

  // Exports
  const handleExportDiff = async () => {
    if (!lastCheckpoint) return toast.error("Чекпоинт не установлен");
    const diffData = items.map((i) => {
      const prev = lastCheckpoint[i.id];
      const prevQty = prev ? prev.locations.reduce((sum, l) => sum + l.quantity, 0) : 0;
      const diffQty = i.total_quantity - prevQty;
      return { id: i.id, name: i.name, diffQty, voxel: i.locations[0]?.voxel || "" };
    });
    // локальный CSV и скачивание (CSV-first variant)
    const csv = Papa.unparse(diffData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const fileName = `wb_diff_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV с изменениями скачан");
  };
    });
    // локальный CSV и скачивание
    const csv = Papa.unparse(diffData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const fileName = `wb_diff_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV с изменениями скачан");

    // серверная отправка XLSX админам (используем core action — exportDiffToAdmin)
    try {
      await exportDiffToAdmin(diffData);
      toast.success("Изменения отправлены администратору (XLSX)");
    } catch (e) {
      console.warn("exportDiffToAdmin failed", e);
      toast.error("Не удалось отправить XLSX админам");
    }
  };

  const handleSendDiffToAdmins = async () => {
    if (!lastCheckpoint) return toast.error("Чекпоинт не установлен");
    const diffData = items.map((i) => {
      const prev = lastCheckpoint[i.id];
      const prevQty = prev ? prev.locations.reduce((sum, l) => sum + l.quantity, 0) : 0;
      const diffQty = i.total_quantity - prevQty;
      return { id: i.id, name: i.name, diffQty, voxel: i.locations[0]?.voxel || "" };
    });
    try {
      await exportDiffToAdmin(diffData);
      toast.success("XLSX с изменениями отправлен админам");
    } catch (e) {
      console.warn(e);
      toast.error("Ошибка отправки админам");
    }
  };

  // CSV-first: попытка отправить CSV вариантом (бэкенд может поддержать флаг format: 'csv')
  const handleSendDiffCSVToAdmins = async () => {
    if (!lastCheckpoint) return toast.error("Чекпоинт не установлен");
    const diffData = items.map((i) => {
      const prev = lastCheckpoint[i.id];
      const prevQty = prev ? prev.locations.reduce((sum, l) => sum + l.quantity, 0) : 0;
      const diffQty = i.total_quantity - prevQty;
      return { id: i.id, name: i.name, diffQty, voxel: i.locations[0]?.voxel || "" };
    });
    try {
      await exportDiffToAdmin(diffData, { format: "csv" });
      toast.success("CSV с изменениями отправлен админам");
    } catch (e) {
      console.warn("exportDiffToAdmin(csv) failed", e);
      toast.error("Не удалось отправить CSV админам");
    }
  };
    });
    try {
      await exportDiffToAdmin(diffData);
      toast.success("XLSX с изменениями отправлен админам");
    } catch (e) {
      console.warn(e);
      toast.error("Ошибка отправки админам");
    }
  };

  const handleExportStock = async () => {
    const stock = items.map((i) => ({
      id: i.id,
      name: i.name,
      total_quantity: i.total_quantity,
      locations: i.locations.map((l) => `${l.voxel}:${l.quantity}`).join(";"),
    }));
    const csv = Papa.unparse(stock);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const fileName = `wb_stock_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV стока скачан");
  };

  const handleSendStockToAdmins = async () => {
    try {
      await exportCurrentStock(items);
      toast.success("XLSX стока отправлен админам");
    } catch (e) {
      console.warn(e);
      toast.error("Ошибка отправки админам");
    }
  };

  const handleSendStockCSVToAdmins = async () => {
    try {
      await exportCurrentStock(items, { format: "csv" });
      toast.success("CSV стока отправлен админам");
    } catch (e) {
      console.warn("exportCurrentStock(csv) failed", e);
      toast.error("Не удалось отправить CSV админам");
    }
  };

  const handleCheckpoint = () => {
    const checkpoint = items.reduce(
      (acc, i) => {
        acc[i.id] = { locations: i.locations };
        return acc;
      },
      {} as { [key: string]: { locations: Location[] } },
    );
    localStorage.setItem("warehouse_checkpoint", JSON.stringify(checkpoint));
    setLastCheckpoint(checkpoint);
    toast.success("Чекпоинт сохранен");
  };

  const handleResetFilters = () => {
    setFilterSeason(null);
    setFilterPattern(null);
    setFilterColor(null);
    setFilterSize(null);
    setSearch("");
    setSortBy("name");
  };

  const bgStyle = {
    backgroundColor: gameMode === "onload" ? "#e6f4ea" : gameMode === "offload" ? "#fee2e2" : "#f5f5f5",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={bgStyle}>
      <div className="w-full overflow-auto p-3" style={bgStyle}>
        <Card className="shadow-md">
          <CardHeader className="p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              {/* Main mode selector — вынесен наверх и сделан главным */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={gameMode || "none"}
                  onValueChange={(v: "none" | "offload" | "onload") => setGameMode(v === "none" ? null : v)}
                >
                  <SelectTrigger className={cn("h-9 text-sm w-48 font-semibold", gameMode ? "ring-2 ring-offset-1" : "") }>
                    <SelectValue placeholder={<VibeContentRenderer content="::FaTasks:: Режим операций" />} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Выкл</SelectItem>
                    <SelectItem value="offload"> <VibeContentRenderer content="::FaArrowDown:: Отгрузка" /> </SelectItem>
                    <SelectItem value="onload"> <VibeContentRenderer content="::FaArrowUp:: Приемка" /> </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCheckpoint} className="h-9 text-sm px-3">Чекпоинт</Button>
                <Button onClick={handleResetFilters} className="h-9 text-sm px-3">Сброс фильтров</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSendDiffCSVToAdmins} className="h-9 text-sm px-3">Отправить изменения админам</Button>
                <Button onClick={handleSendStockCSVToAdmins} className="h-9 text-sm px-3">Отправить сток админам</Button>
              </div>
            </div>

            <CardTitle className="text-base flex items-center gap-2">
              Список товаров (Всего: {totals})
              {gameMode && (
                <VibeContentRenderer
                  content={gameMode === "onload" ? "::FaArrowUp:: Приемка" : "::FaArrowDown:: Отгрузка"}
                  className="text-base"
                />
              )}
            </CardTitle>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  className="h-8 text-sm w-44"
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select value={sortBy} onValueChange={(v: "name" | "quantity" | "voxel") => setSortBy(v)}>
                  <SelectTrigger className="h-8 text-sm w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Имя</SelectItem>
                    <SelectItem value="quantity">Количество</SelectItem>
                    <SelectItem value="voxel">Локация</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterSeason || "all"} onValueChange={(v) => setFilterSeason(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue placeholder={<VibeContentRenderer content="::FaFilter:: Сезон" />} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="leto"><VibeContentRenderer content="::FaSun:: Лето" /></SelectItem>
                    <SelectItem value="zima"><VibeContentRenderer content="::FaSnowflake:: Зима" /></SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPattern || "all"} onValueChange={(v) => setFilterPattern(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue placeholder={<VibeContentRenderer content="::FaPaintBrush:: Узор" />} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="kruzheva">Кружева</SelectItem>
                    <SelectItem value="mirodel">Миродель</SelectItem>
                    <SelectItem value="ogurtsy">Огурцы</SelectItem>
                    <SelectItem value="flora1">Флора 1</SelectItem>
                    <SelectItem value="flora2">Флора 2</SelectItem>
                    <SelectItem value="flora3">Флора 3</SelectItem>
                    <SelectItem value="adel">Адель</SelectItem>
                    <SelectItem value="malvina">Мальвина</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterColor || "all"} onValueChange={(v) => setFilterColor(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue placeholder={<VibeContentRenderer content="::FaPalette:: Цвет" />} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="beige">Бежевый</SelectItem>
                    <SelectItem value="blue">Голубой</SelectItem>
                    <SelectItem value="red">Красный</SelectItem>
                    <SelectItem value="light-green">Салатовый</SelectItem>
                    <SelectItem value="dark-green">Темно-зеленый</SelectItem>
                    <SelectItem value="gray">Серый</SelectItem>
                    <SelectItem value="adel">Адель</SelectItem>
                    <SelectItem value="malvina">Мальвина</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterSize || "all"} onValueChange={(v) => setFilterSize(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue placeholder={<VibeContentRenderer content="::FaRuler:: Размер" />} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="180x220">180x220</SelectItem>
                    <SelectItem value="200x220">200x220</SelectItem>
                    <SelectItem value="220x240">220x240</SelectItem>
                    <SelectItem value="90">90</SelectItem>
                    <SelectItem value="120">120</SelectItem>
                    <SelectItem value="140">140</SelectItem>
                    <SelectItem value="160">160</SelectItem>
                    <SelectItem value="180">180</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="150x200">150x200</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="import" className="text-sm">
                  <VibeContentRenderer content="::FaFileImport:: Импорт CSV/XLSX" />
                </Label>
                <Input id="import" type="file" accept=".csv,.xlsx" onChange={handleImport} className="h-8 text-sm" />
                <Button onClick={handleExportDiff} className="h-8 text-sm px-3">Экспорт изменений</Button>
                <Button onClick={handleExportStock} className="h-8 text-sm px-3">Экспорт стока</Button>
              </div>
            </div>
          </CardHeader>

          {/* Items grid — делаем высоту окна для списка + фильтров */}
          <CardContent className="p-2 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
            {loading
              ? Array.from({ length: 20 }).map((_, idx) => <Skeleton key={idx} className="h-20 rounded-xl" />)
              : filteredItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handleItemClick(item.id)}
                    className={cn(
                      "relative cursor-pointer rounded-xl shadow-md overflow-hidden group border",
                      "transition-all duration-300 ease-in-out",
                      gameMode ? "w-16 h-16 text-[9px]" : "w-20 h-20 text-[9px]",
                      "sm:w-16 sm:h-16 sm:text-[9px]",
                    )}
                  >
                    {item.image && (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div
                      className={cn(
                        "absolute inset-0 opacity-60 group-hover:opacity-40 transition-opacity duration-300",
                        COLOR_MAP[item.color || "gray"],
                      )}
                    />

                    <div className="relative z-10 flex flex-col h-full p-1 justify-between">
                      <div>
                        {/* Wrap title вместо truncate */}
                        <h3 className="font-semibold text-[9px] leading-tight whitespace-normal break-words" style={{ maxHeight: 36 }}>
                          {makeRussianTitle(item)}
                        </h3>
                        <p className="text-gray-700 text-[9px]">Кол: {item.total_quantity}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.locations.map((loc) => (
                          <span
                            key={loc.voxel}
                            className="px-1 py-0.5 rounded bg-gray-800/50 text-[8px] text-white"
                          >
                            {loc.voxel}:{loc.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                    {item.description && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-gray-900/70 flex items-center justify-center text-center text-[10px] text-white p-1"
                      >
                        {item.description}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
          </CardContent>
        </Card>

        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
          <h3 className="font-semibold text-[10px]">Статистика операций</h3>
          <p className="text-[13px]">
            Эффективность: {score} (Внутр. валюта: {Math.floor(score / 100)}) | Уровень: {level} | Серия: {streak} | Дни: {dailyStreak}
          </p>
          <p className="text-[12px]">Достижения: {achievements.join(", ")}</p>
          <p className="text-[12px]">Время сессии: {Math.floor((Date.now() - sessionStart) / 1000)} сек | Ошибки: {errorCount}</p>
          <p className="text-[12px]">Приемка: +10 за единицу +бонус. Отгрузка: +5 за единицу +бонус. Бонус уровня: x{level / 2}</p>
          {bossMode && (
            <p className="text-red-600 font-medium">
              Критическая операция! Осталось: {Math.floor(bossTimer / 1000)} сек
            </p>
          )}
          <p className="font-medium">Рейтинг операторов:</p>
          <ol className="list-decimal pl-5 text-[12px]">
            {leaderboard.map((entry, idx) => (
              <li key={idx}>
                {entry.name}: {entry.score} ({entry.date})
              </li>
            ))}
          </ol>
          <p className="text-[12px]">В разработке: Совместные операции (Supabase), награды за топ.</p>
        </div>
      </div>

      <div className="w-full flex-1 overflow-y-auto p-4" style={bgStyle}>
        <WarehouseViz
          items={items}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={handleSelectVoxel}
          onUpdateLocationQty={handleUpdateLocationQty}
          gameMode={gameMode}
          onPlateClick={handlePlateClick}
        />
      </div>

      <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
        <Accordion type="single" collapsible>
          <AccordionItem value="instructions">
            <AccordionTrigger className="font-semibold">Инструкции по операциям</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2 text-[13px]">
                <li>
                  <strong>Чекпоинт:</strong> Нажмите "Чекпоинт" перед началом для фиксации текущего состояния.
                </li>
                <li>
                  <strong>Режимы операций:</strong> Включите Приемку/Отгрузку. Клик на товар/ячейку автоматически изменяет количество. Пустая ячейка в Приемке открывает добавление.
                </li>
                <li>
                  <strong>Импорт:</strong> Загружайте CSV/XLSX (столбцы: Артикул, Количество, voxel опционально). Пошаговое обновление. Крупный импорт — критическая операция.
                </li>
                <li>
                  <strong>Экспорт изменений:</strong> Создает CSV с изменениями от чекпоинта и отправляет в админ-чат.
                </li>
                <li>
                  <strong>Экспорт стока:</strong> Выгружает текущее состояние склада в CSV для синхронизации.
                </li>
                <li>
                  <strong>Синхронизация:</strong> Загружайте изменения в панели WB/Ozon (Остатки &gt; Импорт). Для полок B — уведомление, если запас ниже минимального.
                </li>
                <li>
                  <strong>Советы для мобильных:</strong> Уменьшены ячейки, поддержка сенсорного ввода. Свайп для прокрутки визуализации.
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Workflow modal */}
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent className="max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                Операция: {currentWorkflowIndex + 1}/{workflowItems.length}
              </DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div className="space-y-2">
                <p>
                  Товар: {workflowItems[currentWorkflowIndex].id}, Изменение: {workflowItems[currentWorkflowIndex].change}
                </p>
                <Select value={selectedWorkflowVoxel || ""} onValueChange={setSelectedWorkflowVoxel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите ячейку" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOXELS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleWorkflowNext}>Обновить и продолжить</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Manual edit modal (восстановленный) */}
      <Dialog open={modalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modalItem ? `Товар: ${modalItem.name}` : `Ячейка: ${modalVoxel || "—"}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {modalItem ? (
              <div>
                <p className="text-[13px]">Текущий запас в {modalVoxel}: {modalQuantity === "" ? "—" : modalQuantity}</p>
                <div className="flex gap-2 items-center mt-2">
                  <Input
                    type="number"
                    value={modalQuantity === "" ? "" : String(modalQuantity)}
                    onChange={(e) => setModalQuantity(e.target.value === "" ? "" : parseInt(e.target.value))}
                  />
                  <Button
                    onClick={async () => {
                      if (!modalItem || !modalVoxel) return toast.error("Нет товара или ячейки");
                      const qty = typeof modalQuantity === "number" ? modalQuantity : parseInt(String(modalQuantity));
                      if (isNaN(qty)) return toast.error("Некорректное количество");
                      await handleUpdateLocationQty(modalItem.id, modalVoxel, qty, false);
                    }}
                  >
                    Сохранить
                  </Button>
                  <Button onClick={() => { setModalOpen(false); setModalItem(null); setModalVoxel(null); setModalQuantity(""); }}>
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[13px]">Ячейка <strong>{modalVoxel}</strong> пуста. Привяжите товар и укажите количество:</p>
                <Select value={selectedItemId || ""} onValueChange={setSelectedItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите товар" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 items-center mt-2">
                  <Input
                    type="number"
                    placeholder="Количество"
                    value={modalQuantity === "" ? "" : String(modalQuantity)}
                    onChange={(e) => setModalQuantity(e.target.value === "" ? "" : parseInt(e.target.value))}
                  />
                  <Button
                    onClick={async () => {
                      if (!modalVoxel) return toast.error("Нет ячейки");
                      const idToUse = selectedItemId;
                      if (!idToUse) return toast.error("Выберите товар");
                      const qty = typeof modalQuantity === "number" ? modalQuantity : parseInt(String(modalQuantity));
                      if (isNaN(qty)) return toast.error("Некорректное количество");
                      await handleUpdateLocationQty(idToUse, modalVoxel, qty, false);
                    }}
                  >
                    Привязать и сохранить
                  </Button>
                  <Button onClick={() => { setModalOpen(false); setModalItem(null); setModalVoxel(null); setModalQuantity(""); }}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}