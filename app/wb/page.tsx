"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload, FileText } from "lucide-react";
import { useWarehouse } from "@/hooks/useWarehouse";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import FilterAccordion from "@/components/FilterAccordion";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import { exportDiffToAdmin, exportCurrentStock, uploadWarehouseCsv, updateItemLocationQty } from "@/app/wb/actions";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { VOXELS, SIZE_PACK } from "@/app/wb/common";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { parse } from "papaparse";

export default function WBPage() {
  const {
    items: hookItems,
    loading,
    error,
    checkpoint,
    setCheckpoint,
    workflowItems,
    currentWorkflowIndex,
    selectedWorkflowVoxel,
    setSelectedWorkflowVoxel,
    gameMode,
    setGameMode,
    score,
    level,
    streak,
    dailyStreak,
    achievements,
    errorCount,
    sessionStart,
    bossMode,
    bossTimer,
    leaderboard,
    loadItems,
    handleUpdateLocationQty,
    handleWorkflowNext,
    handleSkipItem,
    handlePlateClick,
    handleItemClick,
    search,
    setSearch,
    filterSeason,
    setFilterSeason,
    filterPattern,
    setFilterPattern,
    filterColor,
    setFilterColor,
    filterSize,
    setFilterSize,
    selectedVoxel,
    setSelectedVoxel,
    filteredItems: hookFilteredItems,
    sortOption,
    setSortOption,
  } = useWarehouse();

  const { user, tg } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isTelegram = !!tg;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<{ item: any; quantity: number; newQuantity: number }[]>([]);

  const [localItems, setLocalItems] = useState<any[]>(hookItems || []);

  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);

  useEffect(() => {
    loadItems();
    if (error) toast.error(error);
  }, [error, loadItems]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const bgStyle = useMemo(
    () =>
      gameMode === "onload"
        ? { background: "linear-gradient(to bottom, #fff, #ffd)" }
        : gameMode === "offload"
        ? { background: "linear-gradient(to bottom, #333, #000)" }
        : {},
    [gameMode]
  );

  // --- Size / season priority helpers (robust)
  const sizeOrderArray = Object.keys(SIZE_PACK || {});
  const sizeOrderMap: { [k: string]: number } = {};
  sizeOrderArray.forEach((s, idx) => (sizeOrderMap[s.toLowerCase()] = idx + 1));

  const normalizeSizeKey = (size?: string | null) => {
    if (!size) return "";
    return size.toString().toLowerCase().trim().replace(/\s/g, "").replace(/×/g, "x");
  };

  const getSizePriority = (size: string | null): number => {
    if (!size) return 999;
    const key = normalizeSizeKey(size);
    // legacy markers
    if (key === "1.5") return 0;
    if (key === "2") return 1;
    if (key === "евро") return 2;
    if (key === "евромакси" || key === "евро макси") return 3;

    if (sizeOrderMap[key]) return sizeOrderMap[key];

    const num = parseInt(key.replace(/[^\d]/g, ""), 10);
    if (!isNaN(num)) return 100 + num;
    return 999;
  };

  const getSeasonPriority = (season: string | null): number => {
    if (!season) return 999;
    const s = season.toString().toLowerCase();
    if (s === "лето" || s === "leto") return 1;
    if (s === "зима" || s === "zima") return 2;
    return 3;
  };

  // --- Файловая загрузка/импорт (accept csv/txt) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const parsed = parse(text, { header: true, skipEmptyLines: true }).data as any[];

        // keep previous behavior: admin-upsert CSV
        const result = await uploadWarehouseCsv(parsed, user?.id);
        setIsUploading(false);
        if (result.success) {
          toast.success(result.message || "CSV uploaded!");
          await loadItems();
        } else {
          toast.error(result.error || "Ошибка загрузки CSV");
        }
      } catch (err: any) {
        setIsUploading(false);
        toast.error(err?.message || "Ошибка чтения файла");
      }
    };
    reader.readAsText(file);
  };

  // optimistic update helper (keeps UI instant)
  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
    // Normalize voxelId for matching but keep the provided string for server
    const normalizedVoxel = (voxelId || "").toString();

    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());
        if (idx === -1) {
          if (delta > 0) locs.push({ voxel: normalizedVoxel, quantity: delta });
          // if negative and not present, we will attempt to deduct from largest below
          else if (locs.length === 1) {
            locs[0].quantity = Math.max(0, (locs[0].quantity || 0) + delta);
          } else if (locs.length > 1) {
            const biggest = locs.sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0))[0];
            biggest.quantity = Math.max(0, (biggest.quantity || 0) + delta);
          }
        } else {
          locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        }
        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const total = filtered.reduce((a: number, b: any) => a + (b.quantity || 0), 0);

        // If the voxel we decremented became empty and it's the currently selectedVoxel, clear selection
        // (case-insensitive compare)
        if (delta < 0 && selectedVoxel) {
          const stillPresent = filtered.some((l) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());
          if (!stillPresent && selectedVoxel.toString().toLowerCase() === normalizedVoxel.toLowerCase()) {
            // clear selection (safe to call here)
            setSelectedVoxel(null);
          }
        }

        return { ...i, locations: filtered, total_quantity: total };
      })
    );

    updateItemLocationQty(itemId, voxelId, delta).then((res) => {
      if (!res.success) {
        toast.error(res.error || "Ошибка сервера при обновлении");
        loadItems();
      }
    }).catch(() => loadItems());
  };

  const handleCheckpoint = () => {
    setCheckpoint(localItems.map((i) => ({ ...i, locations: (i.locations || []).map((l:any)=>({...l})) })));
    setCheckpointStart(Date.now());
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    toast.success("Checkpoint saved!");
  };

  const handleReset = () => {
    if (!checkpoint || checkpoint.length === 0) {
      toast.error("Нет сохранённого чекпоинта");
      return;
    }
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l:any)=>({...l})) })));
    toast.success("Reset to checkpoint!");
  };

  // compute processed stats INCLUDING packings & stars
  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0, packings: 0, stars: 0 };
    let changedCount = 0;
    let totalDelta = 0;
    let packings = 0;

    (localItems || []).forEach((it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      if (!cp) return;
      const delta = Math.abs((it.total_quantity || 0) - (cp.total_quantity || 0));
      if (delta > 0) changedCount += 1;
      totalDelta += delta;

      const sizeKey = normalizeSizeKey(it.size);
      const piecesPerPack = (SIZE_PACK && SIZE_PACK[sizeKey]) ? SIZE_PACK[sizeKey] : 1;
      packings += Math.floor(delta / piecesPerPack);
    });

    const stars = packings * 25; // 1 packing = 25 stars
    return { changedCount, totalDelta, packings, stars };
  }, [localItems, checkpoint]);

  const handleExportDiff = async () => {
    const diffData = (localItems || [])
      .flatMap((item) =>
        (item.locations || [])
          .map((loc:any) => {
            const checkpointLoc = checkpoint.find((ci) => ci.id === item.id)?.locations.find((cl) => cl.voxel === loc.voxel);
            const diffQty = loc.quantity - (checkpointLoc?.quantity || 0);
            return diffQty !== 0 ? { id: item.id, diffQty, voxel: loc.voxel } : null;
          })
          .filter(Boolean)
      )
      .filter(Boolean);

    const result = await exportDiffToAdmin(diffData as any, isTelegram);

    if (isTelegram && result.csv) {
      navigator.clipboard.writeText(result.csv);
      toast.success("CSV скопирован в буфер обмена!");
    } else if (result && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diff_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    }

    if (checkpointStart) {
      const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
      setLastCheckpointDurationSec(durSec);
      const { changedCount } = computeProcessedStats();
      setLastProcessedCount(changedCount);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${changedCount}`);
    }
  };

  const handleExportStock = async (summarized = false) => {
    const result = await exportCurrentStock(localItems, isTelegram, summarized);
    if (isTelegram && result.csv) {
      navigator.clipboard.writeText(result.csv);
      toast.success("CSV скопирован в буфер обмена!");
    } else if (result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = summarized ? "warehouse_stock_summarized.csv" : "warehouse_stock.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    }

    if (checkpointStart) {
      const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
      setLastCheckpointDurationSec(durSec);
      const { changedCount } = computeProcessedStats();
      setLastProcessedCount(changedCount);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${changedCount}`);
    }
  };

  const formatSec = (sec: number | null) => {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // ====== IMPORTANT CHANGE: plate click NO LONGER decrements qty for offload ======
  const handlePlateClickCustom = (voxelId: string) => {
    handlePlateClick(voxelId);

    const content = localItems
      .flatMap((i) => (i.locations || []).filter((l:any) => l.voxel === voxelId && (l.quantity || 0) > 0)
        .map((l:any) => ({ item: i, quantity: l.quantity }))
      );

    // If we are in "onload" or "offload" — do NOT open modals, just select voxel silently
    if (gameMode === "onload" || gameMode === "offload") {
      setSelectedVoxel(voxelId);
      if (gameMode === "onload") {
        toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — добавь товар нажатием на карточки` : `Выбрана ячейка ${voxelId}`);
      } else {
        toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — нет товаров` : `Выбрана ячейка ${voxelId}`);
      }
      return;
    }

    // default behaviour for neutral mode:
    if (content.length > 0) {
      setEditVoxel(voxelId);
      setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
      setEditDialogOpen(true);
    } else {
      setSelectedVoxel(voxelId);
    }
  };

  // item click still does qty changes (optimistic)
  const handleItemClickCustom = async (item: any) => {
    if (!item) return;

    if (gameMode === "onload") {
      const targetVoxel = selectedVoxel || "A1";
      setSelectedVoxel(targetVoxel);
      optimisticUpdate(item.id, targetVoxel, 1);
      toast.success(`Добавлено в ${targetVoxel}`);
      return;
    }

    if (gameMode === "offload") {
      let loc;

      // Case-insensitive matching helper
      const selVoxelNorm = selectedVoxel ? selectedVoxel.toString().toLowerCase() : null;

      if (selectedVoxel) {
        // try selected voxel (case-insensitive)
        loc = (item.locations || []).find((l:any) => (l.voxel || "").toString().toLowerCase() === selVoxelNorm && (l.quantity || 0) > 0);
        if (!loc) {
          // selected voxel empty: check if item has exactly one non-empty location — if so, use it
          const nonEmpty = (item.locations || []).filter((l:any) => (l.quantity || 0) > 0);
          if (nonEmpty.length === 1) {
            loc = nonEmpty[0];
            toast.info(`В выбранной ячейке нет товара — списываю из ${loc.voxel} (единственная ячейка с товаром).`);
          } else {
            // multiple non-empty or none -> do not silently choose
            return toast.error("Нет товара в выбранной ячейке");
          }
        }
      } else {
        // no voxel selected: prefer single non-empty location; if many, pick largest (fallback)
        const nonEmpty = (item.locations || []).filter((l:any) => (l.quantity || 0) > 0);
        if (nonEmpty.length === 0 || item.total_quantity <= 0) return toast.error("Нет товара на складе");
        loc = nonEmpty.length === 1 ? nonEmpty[0] : nonEmpty.sort((a:any,b:any) => (b.quantity || 0) - (a.quantity || 0))[0];
        if (nonEmpty.length > 1) {
          toast.info(`Списываю из ${loc.voxel} (наибольшая ячейка — fallback).`);
        }
      }

      if (loc) {
        const voxel = loc.voxel;
        optimisticUpdate(item.id, voxel, -1);

        // After optimistic update we already clear selectedVoxel inside optimisticUpdate if that voxel became empty.
        // Additional small safeguard: if selectedVoxel matched this voxel (case-insensitive) and item now has no such location, clear it.
        // (optimisticUpdate already handles this, so this is just a defensive no-op.)
        toast.success(`Выдано из ${voxel}`);
      } else {
        toast.error("Нет товара на складе");
      }
      return;
    }

    handleItemClick(item);
  };

  // localFilteredItems: now respects filters AND sortOption
  const localFilteredItems = useMemo(() => {
    const arr = (localItems || []).filter((item) => {
      const searchLower = (search || "").toLowerCase();
      const matchesSearch =
        (item.name || "").toLowerCase().includes(searchLower) ||
        (item.description || "").toLowerCase().includes(searchLower);

      const matchesSeason = !filterSeason || item.season === filterSeason;
      const matchesPattern = !filterPattern || item.pattern === filterPattern;
      const matchesColor = !filterColor || item.color === filterColor;
      const matchesSize = !filterSize || item.size === filterSize;

      return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });

    // apply sorting according to sortOption from hook
    const sorted = [...arr].sort((a, b) => {
      switch (sortOption) {
        case 'size_season_color': {
          const sizeCmp = getSizePriority(a.size) - getSizePriority(b.size);
          if (sizeCmp !== 0) return sizeCmp;
          const seasonCmp = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (seasonCmp !== 0) return seasonCmp;
          return (a.color || "").localeCompare(b.color || "");
        }
        case 'color_size': {
          const colorCmp = (a.color || "").localeCompare(b.color || "");
          if (colorCmp !== 0) return colorCmp;
          return getSizePriority(a.size) - getSizePriority(b.size);
        }
        case 'season_size_color': {
          const seasonCmp = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (seasonCmp !== 0) return seasonCmp;
          const sizeCmp = getSizePriority(a.size) - getSizePriority(b.size);
          if (sizeCmp !== 0) return sizeCmp;
          return (a.color || "").localeCompare(b.color || "");
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [localItems, search, filterSeason, filterPattern, filterColor, filterSize, sortOption]);

  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta, packings: livePackings, stars: liveStars } = computeProcessedStats();
  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  // Precompute some formatted strings for stats component
  const checkpointDisplayMain = checkpointStart ? formatSec(elapsedSec) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--");
  const checkpointDisplaySub = checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался");
  const processedChangedCount = checkpointStart ? liveChangedCount : (lastProcessedCount ?? 0);
  const processedTotalDelta = checkpointStart ? liveTotalDelta : (lastProcessedCount ? liveTotalDelta : 0);
  const processedPackings = checkpointStart ? livePackings : 0;
  const processedStars = checkpointStart ? liveStars : 0;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          {/* Select: explicit "none" option mapped to null */}
          <Select
            value={gameMode === null ? "none" : gameMode}
            onValueChange={(v: any) => setGameMode(v === "none" ? null : v)}
          >
            <SelectTrigger className="w-28 text-[10px]">
              <SelectValue placeholder="Режим" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <FileText size={12} /> <span>Без режима</span>
                </div>
              </SelectItem>

              <SelectItem value="onload">
                <div className="flex items-center gap-2">
                  <Upload size={12} /> <span>Прием</span>
                </div>
              </SelectItem>

              <SelectItem value="offload">
                <div className="flex items-center gap-2">
                  <Download size={12} /> <span>Выдача</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckpoint}><Save size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleReset}><RotateCcw size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportDiff}><Download size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(false)}><FileUp size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(true)}><FileText size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={12} /></Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.CSV,.txt,text/csv,text/plain" />
            <Link href="/csv-compare">
              <Button size="sm" variant="outline" className="text-[10px]">CSV Сравнение</Button>
            </Link>
          </div>
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
          items={localItems}
          onResetFilters={() => { setFilterSeason(null); setFilterPattern(null); setFilterColor(null); setFilterSize(null); setSearch(""); }}
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
            <CardTitle className="text-xs">Товары ({localFilteredItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 p-2 max-h-[69vh] overflow-y-auto">
            {localFilteredItems.map((item) => (
              <WarehouseItemCard
                key={item.id}
                item={item}
                onClick={() => handleItemClickCustom(item)}
              />
            ))}
          </CardContent>
        </Card>

        {/* WarehouseViz прямо под товарами */}
        <div className="mt-2">
          <WarehouseViz
            items={localItems}
            selectedVoxel={selectedVoxel}
            onSelectVoxel={setSelectedVoxel}
            onUpdateLocationQty={(itemId:string, voxelId:string, qty:number) => optimisticUpdate(itemId, voxelId, qty)}
            gameMode={gameMode}
            onPlateClick={handlePlateClickCustom}
          />
        </div>

        {/* Статистика вынесена в отдельный компонент и находится ниже viz */}
        <div className="mt-4">
          <WarehouseStats
            itemsCount={localItems.length}
            uniqueIds={new Set(localItems.map(i => i.id)).size}
            score={score}
            level={level}
            streak={streak}
            dailyStreak={dailyStreak}
            checkpointMain={checkpointDisplayMain}
            checkpointSub={checkpointDisplaySub}
            changedCount={processedChangedCount}
            totalDelta={processedTotalDelta}
            packings={processedPackings}
            stars={processedStars}
            achievements={achievements}
            sessionStart={sessionStart}
            errorCount={errorCount}
            bossMode={bossMode}
            bossTimer={bossTimer}
            leaderboard={leaderboard}
          />
        </div>
      </div>

      <WarehouseModals
        workflowItems={workflowItems}
        currentWorkflowIndex={currentWorkflowIndex}
        selectedWorkflowVoxel={selectedWorkflowVoxel}
        setSelectedWorkflowVoxel={setSelectedWorkflowVoxel}
        handleWorkflowNext={handleWorkflowNext}
        handleSkipItem={handleSkipItem}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editVoxel={editVoxel}
        editContents={editContents}
        setEditContents={setEditContents}
        saveEditQty={async (itemId: string, newQty: number) => {
          if (!editVoxel) return;
          const currentContent = editContents.find(c => c.item.id === itemId);
          if (!currentContent) return;
          const delta = newQty - currentContent.quantity;
          optimisticUpdate(itemId, editVoxel, delta);
        }}
        gameMode={gameMode}
        VOXELS={VOXELS}
      />
    </div>
  );
}