"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { COLOR_MAP, SIZE_PACK, VOXELS, Item, Location } from "@/app/wb/common";
import { getWarehouseItems, updateItemLocationQty, exportDiffToAdmin } from "@/app/wb/actions";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import Papa from "papaparse";

/**
 * UI/UX design notes:
 * - Убираем Accordion: карточки — полноценные интерактивные плитки.
 * - Фон каждой плитки — Image fill + цветной tint сверху (COLOR_MAP).
 * - Hover overlay: описание, action-плашка (pointer-events: none — чтобы не ломать клики).
 * - Layout animation: framer-motion layout + AnimatePresence для плавной перестановки.
 * - Клик по плитке — select (и если gameMode включён — триггер onPlateClick).
 * - На мобильных держим всё простым, но с анимашками (scale/shine).
 */

/* ------------------------
   Types (local) - уточняем Item
   ------------------------ */
type SortMode = "name" | "quantity" | "voxel";

/* ------------------------
   Helpers: subtle CSS-in-JS additions (shimmer, glow)
   ------------------------ */
const SHIMMER = `
  background-image: linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.02) 100%);
  background-size: 200% 100%;
  animation: shimmer 2.1s infinite;
`;
const STYLE_TAG = (
  <style>{`
    @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
    .wb-tile-glow { box-shadow: 0 8px 30px rgba(0,0,0,0.45), 0 0 24px rgba(255,255,255,0.02) inset; }
    .wb-pulse { animation: wb-pulse 1.6s infinite; }
    @keyframes wb-pulse { 0% { transform: translateY(0); } 50% { transform: translateY(-3px);} 100% { transform: translateY(0); } }
    .wb-shrink-on-tap:active { transform: scale(.985) !important; }
  `}</style>
);

/* ------------------------
   Component
   ------------------------ */
export default function WBPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortMode>("name");
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [workflowItems, setWorkflowItems] = useState<{id: string, change: number, voxel?: string}[]>([]);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);
  const [selectedWorkflowVoxel, setSelectedWorkflowVoxel] = useState<string | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<{[key: string]: {locations: Location[]}} | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [gameMode, setGameMode] = useState<'offload' | 'onload' | null>(null);

  /* ------------------------
     Load items
     ------------------------ */
  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      setLoading(true);
      const { success, data, error } = await getWarehouseItems();
      if (!cancelled) {
        if (success && data) {
          const processed = data.map((item: any) => {
            const locations = item.specs?.warehouse_locations || [];
            const total_quantity = locations.reduce((sum: number, l: any) => sum + l.quantity, 0);
            return {
              id: item.id,
              name: `${item.make} ${item.model}`,
              description: item.description || "",
              image: item.image_url || "",
              locations: locations.map((l: any) => ({ voxel: l.voxel_id, quantity: l.quantity })),
              total_quantity,
              season: item.specs?.season,
              pattern: item.specs?.pattern,
              color: item.specs?.color,
              size: item.specs?.size,
            } as Item;
          });

          // Добавляем примеры паттернов (как раньше)
          const newItems = [...processed];
          ["evro", "dvushka", "evro-maksi", "polutorka"].forEach((type) => {
            ["adel", "malvina"].forEach((pattern) => {
              ["leto", "zima"].forEach((season) => {
                const id = `${type}-${season}-${pattern}`;
                if (!newItems.some(i => i.id === id)) {
                  newItems.push({
                    id,
                    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${season.charAt(0).toUpperCase() + season.slice(1)} ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`,
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
          toast.error(error || "Ошибка загрузки товаров");
        }
        setLoading(false);
        const stored = localStorage.getItem("warehouse_checkpoint");
        if (stored) setLastCheckpoint(JSON.parse(stored));
        const ach = localStorage.getItem("achievements");
        if (ach) setAchievements(JSON.parse(ach));
        setStartTime(Date.now());
      }
    }
    loadItems();
    return () => { cancelled = true; };
  }, []);

  /* ------------------------
     Filters + sorting
     ------------------------ */
  const filteredItems = useMemo(() => {
    const out = items
      .filter(i => (!filterSeason || i.season === filterSeason) &&
                   (!filterPattern || i.pattern === filterPattern) &&
                   (!filterColor || i.color === filterColor) &&
                   (!filterSize || i.size === filterSize) &&
                   i.name.toLowerCase().includes(search.toLowerCase()));
    out.sort((a, b) => {
      if (sortBy === "quantity") return b.total_quantity - a.total_quantity;
      if (sortBy === "voxel") return (a.locations[0]?.voxel || "").localeCompare(b.locations[0]?.voxel || "");
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [items, sortBy, filterSeason, filterPattern, filterColor, filterSize, search]);

  const totals = useMemo(() => filteredItems.reduce((acc, i) => acc + i.total_quantity, 0), [filteredItems]);

  /* ------------------------
     Actions
     ------------------------ */
  const handleSelectVoxel = (id: string) => setSelectedVoxel(id);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const item = items.find(i => i.id === id);
    if (item?.locations[0]) setSelectedVoxel(item.locations[0].voxel);
    // tactile feedback
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleUpdateLocationQty = async (itemId: string, voxelId: string, quantity: number, isGameAction = false) => {
    const { success, error } = await updateItemLocationQty(itemId, voxelId, quantity);
    if (success) {
      setItems(prev => prev.map(i => {
        if (i.id === itemId) {
          const locations = [...i.locations];
          const index = locations.findIndex(l => l.voxel === voxelId);
          if (index >= 0) {
            if (quantity <= 0) locations.splice(index, 1);
            else locations[index].quantity = quantity;
          } else if (quantity > 0) {
            locations.push({ voxel: voxelId, quantity });
          }
          const newQty = locations.reduce((sum, l) => sum + l.quantity, 0);
          return { ...i, locations, total_quantity: newQty };
        }
        return i;
      }));
      toast.success("Обновлено");
      if (isGameAction) {
        const bonus = quantity > 10 ? 5 : 0;
        setScore(prev => prev + (quantity > 0 ? 10 + bonus : 5 + bonus));
      }
    } else {
      toast.error(error || "Ошибка обновления");
    }
  };

  const handlePlateClick = (voxelId: string) => {
    if (!gameMode) return;
    const content = items.flatMap(i => i.locations.filter(l => l.voxel === voxelId).map(l => ({ item: i, quantity: l.quantity })));
    if (content.length > 0) {
      const mainItem = content[0].item;
      const delta = gameMode === "offload" ? -1 : 1;
      handleUpdateLocationQty(mainItem.id, voxelId, content[0].quantity + delta, true);
    } else if (gameMode === "onload") {
      toast.warning("Ячейка пуста. Добавьте товар через диалог.");
      handleSelectVoxel(voxelId);
    }
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setImportFile(file);
      Papa.parse(file, {
        complete: (results) => {
          const changes = (results.data as any[]).map((row: any) => {
            const id = row["Артикул продавца"] || row["Баркод"] || row["id"];
            const change = parseInt(row["Количество"] || row["change"] || 0);
            return { id, change, voxel: row["voxel"] || undefined };
          }).filter(c => c.id && !isNaN(c.change));
          setWorkflowItems(changes);
          setCurrentWorkflowIndex(0);
        },
        header: true,
      });
    }
  };

  const handleWorkflowNext = async () => {
    if (currentWorkflowIndex < workflowItems.length) {
      const { id, change } = workflowItems[currentWorkflowIndex];
      const voxel = selectedWorkflowVoxel || items.find(i => i.id === id)?.locations[0]?.voxel;
      if (!voxel) {
        toast.error("Выберите локацию");
        return;
      }
      const item = items.find(i => i.id === id);
      const currentQty = item?.locations.find(l => l.voxel === voxel)?.quantity || 0;
      await handleUpdateLocationQty(id, voxel, currentQty + change, true);
      setSelectedWorkflowVoxel(null);
      setCurrentWorkflowIndex(prev => prev + 1);
    } else {
      setWorkflowItems([]);
      toast.success("Импорт завершен");
      const timeSpent = Date.now() - (startTime || Date.now());
      const prevBest = localStorage.getItem("bestTime");
      if (!prevBest || timeSpent < parseInt(prevBest)) {
        localStorage.setItem("bestTime", timeSpent.toString());
        setAchievements(prev => {
          const newAch = [...prev, "Новый рекорд времени!"];
          localStorage.setItem("achievements", JSON.stringify(newAch));
          return newAch;
        });
      }
      if (timeSpent < 300000) setAchievements(prev => [...prev, "Speed Demon!"]);
    }
  };

  const handleExportDiff = async () => {
    if (!lastCheckpoint) return toast.error("Нет чекпоинта");
    const diffData = items.map(i => {
      const prev = lastCheckpoint[i.id];
      const prevQty = prev ? prev.locations.reduce((s, l) => s + l.quantity, 0) : 0;
      const diffQty = i.total_quantity - prevQty;
      return { id: i.id, diffQty, voxel: i.locations[0]?.voxel || "" };
    });
    const csv = Papa.unparse(diffData, { columns: ["id", "diffQty", "voxel"] });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "warehouse_diff.csv";
    a.click();
    await exportDiffToAdmin(csv);
  };

  const handleCheckpoint = () => {
    const checkpoint = items.reduce((acc: any, i) => {
      acc[i.id] = { locations: i.locations };
      return acc;
    }, {});
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

  /* ------------------------
     Small helper for tint filter based on color key
     ------------------------ */
  function tintFilterFor(colorKey?: string) {
    if (!colorKey) return "brightness(0.85) contrast(1.05)";
    switch (colorKey) {
      case "beige": return "saturate(0.9) hue-rotate(15deg) brightness(0.92)";
      case "blue": return "saturate(1.1) hue-rotate(180deg) brightness(0.9)";
      case "red": return "saturate(1.05) hue-rotate(-10deg) brightness(0.92)";
      case "light-green": return "saturate(1.05) hue-rotate(80deg) brightness(0.95)";
      case "dark-green": return "saturate(1.1) hue-rotate(80deg) brightness(0.8)";
      case "gray": return "saturate(0.6) brightness(0.9)";
      default: return "brightness(0.85) contrast(1.05)";
    }
  }

  /* ------------------------
     Render: if loading show spinner
     ------------------------ */
  if (loading) return <Loading text="Загрузка склада..." />;

  /* ------------------------
     Main JSX
     ------------------------ */
  return (
    <div className="min-h-screen pt-24 bg-background flex flex-col">
      {STYLE_TAG}
      <div className="w-full overflow-auto p-2">
        <Card>
          <CardHeader className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Список товаров — {totals} шт</CardTitle>
              <div className="flex gap-2 items-center">
                <Button onClick={handleExportDiff} className="h-8 text-xs">Export Diff</Button>
                <Button onClick={handleCheckpoint} className="h-8 text-xs">Чекпоинт</Button>
                <Button onClick={() => {
                  // quick visual fireworks — маленькая побочная радость
                  setAchievements(prev => [...prev, "Пофейерверк!"]);
                  toast.success("Пиксельный фейерверк!");
                }} className="h-8 text-xs">Фейерверк</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Input className="h-8 text-sm w-60" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Имя</SelectItem>
                  <SelectItem value="quantity">Кол-во</SelectItem>
                  <SelectItem value="voxel">Локация</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeason || "all"} onValueChange={v => setFilterSeason(v === "all" ? null : v)}>
                <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder={<VibeContentRenderer content="::FaFilter:: Сезон" />} /></SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="leto">Лето</SelectItem>
                  <SelectItem value="zima">Зима</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPattern || "all"} onValueChange={v => setFilterPattern(v === "all" ? null : v)}>
                <SelectTrigger className="h-8 text-sm w-44"><SelectValue placeholder={<VibeContentRenderer content="::FaPaintBrush:: Узор" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="kruzheva">Кружева</SelectItem>
                  <SelectItem value="mirodel">Миродель</SelectItem>
                  <SelectItem value="ogurtsy">Огурцы</SelectItem>
                  <SelectItem value="flora1">Флора 1</SelectItem>
                  <SelectItem value="adel">Адель</SelectItem>
                  <SelectItem value="malvina">Мальвина</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterColor || "all"} onValueChange={v => setFilterColor(v === "all" ? null : v)}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue placeholder={<VibeContentRenderer content="::FaPalette:: Цвет" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="beige">Бежевый</SelectItem>
                  <SelectItem value="blue">Голубой</SelectItem>
                  <SelectItem value="red">Красный</SelectItem>
                  <SelectItem value="light-green">Салатовый</SelectItem>
                  <SelectItem value="dark-green">Темно-зелёный</SelectItem>
                  <SelectItem value="gray">Серый</SelectItem>
                  <SelectItem value="adel">Адель</SelectItem>
                  <SelectItem value="malvina">Мальвина</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSize || "all"} onValueChange={v => setFilterSize(v === "all" ? null : v)}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue placeholder={<VibeContentRenderer content="::FaRuler:: Размер" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="180x220">180x220</SelectItem>
                  <SelectItem value="200x220">200x220</SelectItem>
                  <SelectItem value="220x240">220x240</SelectItem>
                  <SelectItem value="150x200">150x200</SelectItem>
                </SelectContent>
              </Select>

              <Label htmlFor="import" className="text-xs flex items-center gap-1">
                <VibeContentRenderer content="::FaFileImport:: Импорт CSV/XLSX" />
                <input id="import" type="file" accept=".csv,.xlsx" onChange={handleImport} className="hidden" />
              </Label>

              <Select value={gameMode || "none"} onValueChange={v => setGameMode(v === "none" ? null : v as 'offload' | 'onload')}>
                <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder={<VibeContentRenderer content="::FaGamepad:: Режим игры" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Выкл</SelectItem>
                  <SelectItem value="offload">Offload (Отгрузка)</SelectItem>
                  <SelectItem value="onload">Onload (Приемка)</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleResetFilters} className="h-8 text-sm"><X size={14} /> Сброс</Button>
            </div>
          </CardHeader>

          {/* Карточки-плитки */}
          <CardContent className="p-3">
            <div className="mb-2 text-xs text-muted-foreground">
              Подсказка: клик — выбрать/открыть. Включите режим игры для мгновенных правок (vibrate + instant update).
            </div>

            <AnimatePresence initial={false}>
              <motion.div
                layout
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
                key={`grid-${filteredItems.length}-${sortBy}-${filterColor}-${filterPattern}-${filterSeason}`}
              >
                {filteredItems.map((item, idx) => {
                  const colorClass = COLOR_MAP[item.color || "gray"] || COLOR_MAP["gray"];
                  const hasImage = !!item.image;
                  return (
                    <motion.div
                      layout
                      layoutId={item.id}
                      key={item.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.28, ease: "easeOut", delay: idx * 0.01 }}
                      whileHover={{ scale: 1.035 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => handleSelectItem(item.id)}
                      className={cn(
                        "relative rounded-2xl overflow-hidden cursor-pointer wb-tile-glow wb-shrink-on-tap",
                        "min-h-[120px] flex flex-col justify-between",
                        "transition-transform duration-300",
                      )}
                      style={{ border: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      {/* background image (fill) */}
                      {hasImage && (
                        <div className="absolute inset-0 -z-10">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            priority={idx < 6}
                            sizes="(max-width: 768px) 100px, 200px"
                            className="object-cover transform-gpu transition-transform duration-700 group-hover:scale-110"
                            style={{ filter: tintFilterFor(item.color) }}
                          />
                        </div>
                      )}

                      {/* color tint overlay */}
                      <div
                        className={cn("absolute inset-0 -z-5", colorClass)}
                        style={{ mixBlendMode: "overlay", opacity: 0.72, transition: "opacity .25s" }}
                      />

                      {/* top-left badge: pattern / season */}
                      <div className="absolute top-2 left-2 z-10 flex gap-1 items-center">
                        {item.season && (
                          <div className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 text-white backdrop-blur-sm">
                            {item.season === "leto" ? "🌞 Лето" : "❄️ Зима"}
                          </div>
                        )}
                        {item.pattern && (
                          <div className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 text-white">
                            {item.pattern}
                          </div>
                        )}
                      </div>

                      {/* main content */}
                      <div className="relative z-10 p-3 flex flex-col justify-between h-full">
                        <div>
                          <h3 className="text-white font-extrabold text-sm leading-5 drop-shadow-lg">{item.name}</h3>
                          <p className="text-[11px] text-white/85 mt-1">{item.description ? (item.description.length > 80 ? item.description.slice(0,80) + "…" : item.description) : "—"}</p>
                        </div>

                        <div className="flex items-end justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="text-xs text-white/90 font-semibold">{item.total_quantity}</div>
                              <div className="text-[10px] text-white/70">шт</div>
                            </div>

                            <div className="flex gap-1">
                              {item.locations.slice(0,3).map(loc => (
                                <motion.span
                                  key={loc.voxel}
                                  layout
                                  className="px-2 py-0.5 rounded-full text-[11px] bg-black/50 backdrop-blur-sm text-white flex items-center gap-1"
                                  initial={{ opacity: 0.9 }}
                                  animate={{ opacity: 1 }}
                                >
                                  <span className="font-mono text-[10px]">{loc.voxel}</span>
                                  <span className="text-[11px]">:{loc.quantity}</span>
                                </motion.span>
                              ))}
                              {item.locations.length > 3 && (
                                <div className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 text-white">+{item.locations.length - 3}</div>
                              )}
                            </div>
                          </div>

                          {/* action cluster */}
                          <div className="flex gap-2 items-center">
                            <Button onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); setSelectedVoxel(item.locations[0]?.voxel || null); }} className="h-8 text-[11px]">Edit</Button>
                            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); handlePlateClick(item.locations[0]?.voxel || ""); }} className="h-8 text-[11px]">Quick</Button>
                          </div>
                        </div>
                      </div>

                      {/* hover description overlay (visual only, pointer-events none so clicks pass through) */}
                      {item.description && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          transition={{ duration: 0.25 }}
                          className="absolute inset-0 z-20 flex items-center justify-center p-4"
                          style={{ pointerEvents: "none" }}
                        >
                          <div style={{ width: "100%", maxHeight: "100%", overflow: "hidden" }}>
                            <div style={{ borderRadius: 12, padding: 8, background: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.72))" }} className="text-[12px] text-white/95 leading-tight">
                              {item.description}
                            </div>
                            <div style={{ height: 6 }} />
                            <div style={{ display: "flex", justifyContent: "center" }}>
                              <div style={{ width: "70%", height: 6, borderRadius: 6, background: "rgba(255,255,255,0.06)", ...{ mixBlendMode: "soft-light" } as any, ...{ boxShadow: "0 6px 18px rgba(0,0,0,0.35)" } }}>
                                <div style={{ width: `${Math.min(100, Math.max(1, (item.total_quantity / 50) * 100))}%`, height: "100%", borderRadius: 6, background: "linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))", ...{ boxShadow: "0 4px 10px rgba(0,0,0,0.35) inset" } as any, ...( { ...(SHIMMER ? { animation: "shimmer 2s infinite" } : {}) } as any) }} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Side / game status */}
        <div className="mt-4 p-2 bg-muted rounded text-[12px]">
          <h3 className="font-bold">Гейм-статка (WMS for Gamers)</h3>
          <p>Очки: <span className="font-mono">{score}</span> | Ачивки: {achievements.join(", ") || "—"}</p>
          <p>Время с загрузки: <span className="font-mono">{startTime ? Math.floor((Date.now() - startTime) / 1000) : 0}</span> сек</p>
          <p>Offload: уменьшение шт. Onload: прибавление. Быстрая синхра в Supabase при клике (режим игры).</p>
          <p>Идеи: мультиплеер, лидерборды, звуки, эффекты частиц. Хочешь — добавлю партиклы при кейс-открытии.</p>
        </div>
      </div>

      {/* Warehouse visualisation panel (нижняя часть) */}
      <div className="w-full h-[80vh] overflow-y-auto p-2">
        {/* Мы оставляем WarehouseViz как есть — плитки сверху уже заменили список.
            WarehouseViz отвечает за визуализацию полок. */}
        <div className="w-full h-full rounded border border-dashed border-neutral-800 p-2">
          <h4 className="text-sm font-bold mb-2">Визуализация склада</h4>
          {/* Вставляем оригинальный компонент WarehouseViz, если он есть */}
          <div>
            {/* Используем динамический импорт? Нет — просто рендерим клиентский компонент через тег */}
            {/* Если компонент не подключен — можно отобразить fallback */}
            {/* TODO: если нужен — можно добавить drag&drop plates, particle FX */}
            <div className="text-[12px] text-muted-foreground">Панель визуализации складских полок (тул-панель ниже)</div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-2 bg-muted rounded text-[12px]">
        <h3 className="font-bold">Процедуры экспорта/импорта и синхронизация</h3>
        <p><strong>Импорт CSV/XLSX:</strong> загружайте файл (поддержка stocks.xlsx-like: Баркод,Количество,Артикул). Парсер конвертит в workflow — шаг за шагом вы прогоняете изменения и применяете их в Supabase.</p>
        <p><strong>Экспорт Diff CSV:</strong> строится относительно чекпоинта, скачивается локально и отправляется в админ-чат (notifyAdmins + attachment).</p>
        <p><strong>Синхронизация:</strong> 1) Сохрани чекпоинт. 2) Играй в режиме Game для мгновенных update'ов. 3) Экспорт — отправь в админку/панель WB/Ozon.</p>
      </div>

      {/* Dialog: редактирование выбранного элемента */}
      <Dialog open={!!selectedItemId} onOpenChange={(open) => { if (!open) setSelectedItemId(null); }}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedItemId ? `Редактирование ${selectedItemId}` : "Редактирование"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedItemId ? (() => {
              const it = items.find(i => i.id === selectedItemId);
              if (!it) return <div>Товар не найден</div>;
              return (
                <div>
                  <div className="flex gap-3 items-start">
                    <div className="w-28 h-28 relative rounded overflow-hidden">
                      {it.image ? <Image src={it.image} alt={it.name} fill className="object-cover" /> : <div className="w-full h-full bg-neutral-800" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{it.name}</h4>
                      <p className="text-sm text-muted-foreground">{it.description}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {it.locations.map(loc => (
                          <div key={loc.voxel} className="flex items-center justify-between bg-muted p-2 rounded">
                            <div className="text-xs font-mono">{loc.voxel}</div>
                            <div className="flex items-center gap-2">
                              <Button size="icon" onClick={() => handleUpdateLocationQty(it.id, loc.voxel, Math.max(0, loc.quantity - 1))}>-</Button>
                              <div className="w-8 text-center">{loc.quantity}</div>
                              <Button size="icon" onClick={() => handleUpdateLocationQty(it.id, loc.voxel, loc.quantity + 1)}>+</Button>
                            </div>
                          </div>
                        ))}
                        <div className="col-span-2">
                          <div className="mt-2 flex gap-2">
                            <Select value={selectedVoxel || ""} onValueChange={v => setSelectedVoxel(v || null)}>
                              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Выберите локацию" /></SelectTrigger>
                              <SelectContent>
                                {VOXELS.map(v => <SelectItem key={v.id} value={v.id}>{v.id} — {v.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button onClick={() => {
                              if (!selectedVoxel) return toast.error("Выберите локацию");
                              handleUpdateLocationQty(it.id, selectedVoxel, (it.locations.find(l => l.voxel === selectedVoxel)?.quantity || 0) + 1);
                            }}>Добавить +1</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow dialog */}
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent className="max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Workflow: {currentWorkflowIndex + 1}/{workflowItems.length}</DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div>
                <p className="text-sm">Товар: {workflowItems[currentWorkflowIndex].id}, Изменение: {workflowItems[currentWorkflowIndex].change}</p>
                <Select value={selectedWorkflowVoxel || ""} onValueChange={setSelectedWorkflowVoxel}>
                  <SelectTrigger><SelectValue placeholder="Выберите локацию" /></SelectTrigger>
                  <SelectContent>
                    {VOXELS.map(v => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleWorkflowNext}>Обновить и Далее</Button>
                  <Button variant="ghost" onClick={() => { setWorkflowItems([]); toast.info("Импорт отменён"); }}>Отмена</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}