"use client";

import React, { useState, useRef, useEffectuse, Callback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload, FileText, PackageSearch } from "lucide-react";
import { useWarehouse } from "@/hooks/useWarehouse";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import FilterAccordion from "@/components/FilterAccordion";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import { exportDiffToAdmin, exportCurrentStock, uploadWarehouseCsv, fetchWbPendingCount, fetchOzonPendingCount } from "@/app/wb/actions";
import { VOXELS, SIZE_PACK } from "@/app/wb/common";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { parse } from "papaparse";
import { notifyAdmin } from "@/app/actions";

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
    onloadCount,
    offloadCount,
    editCount,
    setOnloadCount,
    setOffloadCount,
    setEditCount,
  } = useWarehouse();

  const { user, tg } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isTelegram = !!tg;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<Array<{ item: any; quantity: number; newQuantity: number }>>([]);

  const [localItems, setLocalItems] = useState<any[]>(hookItems || []);

  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);

  const [lastProcessedTotalDelta, setLastProcessedTotalDelta] = useState<number | null>(null);
  const [lastProcessedPackings, setLastProcessedPackings] = useState<number | null>(null);
  const [lastProcessedStars, setLastProcessedStars] = useState<number | null>(null);
  const [lastProcessedOffloadUnits, setLastProcessedOffloadUnits] = useState<number | null>(null);
  const [lastProcessedSalary, setLastProcessedSalary] = useState<number | null>(null);

  const [statsObj, setStatsObj] = useState({ changedCount: 0, totalDelta: 0, packings: 0, stars: 0, offloadUnits: 0, salary: 0 });

  const [checkingPending, setCheckingPending] = useState(false);
  const [targetOffload, setTargetOffload] = useState(0);

  const formatSec = (sec: number | null) => {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const sizeOrderArray = Object.keys(SIZE_PACK || {});
  const sizeOrderMap: Record<string, number> = {};
  sizeOrderArray.forEach((s, idx) => (sizeOrderMap[s.toLowerCase()] = idx + 1));

  const normalizeSizeKey = (size?: string | null) => {
    if (!size) return "";
    return size.toString().toLowerCase().trim().replace(/\s/g, "").replace(/×/g, "x");
  };

  const getSizePriority = (size: string | null): number => {
    if (!size) return 999;
    const key = normalizeSizeKey(size);
    if (key === "1.5") return 0;
    if (key === "2") return 1;
    if (key === "евро") return 2;
    if (key === "евромакси" || key === "евро макси") return 3;
    if (sizeOrderMap[key] !== undefined) return sizeOrderMap[key];
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

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);

  useEffect(() => {
    loadItems();
    if (error) toast.error(error);
  }, [error, loadItems]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
    const normalizedVoxel = (voxelId || "").toString();

    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());

        if (idx === -1) {
          if (delta > 0) locs.push({ voxel: normalizedVoxel, quantity: delta });
          else if (locs.length === 1) locs[0].quantity = Math.max(0, (locs[0].quantity || 0) + delta);
          else if (locs.length > 1) {
            const biggest = [...locs].sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0))[0];
            const bIdx = locs.findIndex((l: any) => l.voxel === biggest.voxel);
            locs[bIdx].quantity = Math.max(0, (locs[bIdx].quantity || 0) + delta);
          }
        } else {
          locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        }

        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const total = filtered.reduce((a: number, b: any) => a + (b.quantity || 0), 0);

        if (delta < 0 && selectedVoxel) {
          const stillPresent = filtered.some((l) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());
          if (!stillPresent && selectedVoxel.toString().toLowerCase() === normalizedVoxel.toLowerCase()) {
            setSelectedVoxel(null);
          }
        }

        return { ...i, locations: filtered, total_quantity: total };
      })
    );

    // Send the same normalized voxel to the server — the hook will add location on positive delta if needed.
    handleUpdateLocationQty(itemId, normalizedVoxel, delta, true).catch(() => {
      loadItems();
      toast.error("Ошибка при сохранении изменений на сервере — данные перезагружены.");
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const parsed = parse(text, { header: true, skipEmptyLines: true }).data as any[];
        const result = await uploadWarehouseCsv(parsed, user?.id);
        setIsUploading(false);
        if (result?.success) {
          toast.success(result.message || "CSV uploaded!");
          await loadItems();
        } else {
          toast.error(result?.error || "Ошибка загрузки CSV");
        }
      } catch (err: any) {
        setIsUploading(false);
        toast.error(err?.message || "Ошибка чтения файла");
      }
    };
    reader.readAsText(file);
  };

  const handleCheckpoint = () => {
    setCheckpoint(localItems.map((i) => ({ ...i, locations: (i.locations || []).map((l: any) => ({ ...l })) })));
    setCheckpointStart(Date.now());
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    setLastProcessedTotalDelta(null);
    setLastProcessedPackings(null);
    setLastProcessedStars(null);
    setLastProcessedOffloadUnits(null);
    setLastProcessedSalary(null);
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Checkpoint saved!");
  };

  const handleReset = () => {
    if (!checkpoint || checkpoint.length === 0) {
      toast.error("Нет сохранённого чекпоинта");
      return;
    }
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l: any) => ({ ...l })) })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Reset to checkpoint!");
  };

  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0, packings: 0, stars: 0, offloadUnits: 0, salary: 0 };
    let changedCount = 0;
    let totalDelta = 0;
    let packings = 0;
    let offloadUnits = offloadCount || 0;

    (localItems || []).forEach((it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      if (!cp) return;
      const rawDelta = (it.total_quantity || 0) - (cp.total_quantity || 0);
      const absDelta = Math.abs(rawDelta);
      if (absDelta > 0) changedCount += 1;
      totalDelta += absDelta;

      const sizeKey = normalizeSizeKey(it.size);
      const piecesPerPack = (SIZE_PACK && SIZE_PACK[sizeKey]) ? SIZE_PACK[sizeKey] : 1;
      packings += Math.floor(absDelta / piecesPerPack);
    });

    const stars = packings * 25;
    const salary = offloadUnits * 50;
    return { changedCount, totalDelta, packings, stars, offloadUnits, salary };
  }, [localItems, checkpoint, offloadCount]);

  useEffect(() => {
    const stats = computeProcessedStats();
    setStatsObj(stats);
  }, [localItems, checkpoint, offloadCount, onloadCount, editCount, computeProcessedStats]);

  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta, packings: livePackings, stars: liveStars, offloadUnits: liveOffloadUnits, salary: liveSalary } = statsObj;

  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  const checkpointDisplayMain = checkpointStart ? formatSec(elapsedSec) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--");
  const checkpointDisplaySub = checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался");

  const processedChangedCount = checkpointStart ? liveChangedCount : (lastProcessedCount ?? 0);
  const processedTotalDelta = checkpointStart ? liveTotalDelta : (lastProcessedTotalDelta ?? 0);
  const processedPackings = checkpointStart ? livePackings : (lastProcessedPackings ?? 0);
  const processedStars = checkpointStart ? liveStars : (lastProcessedStars ?? 0);
  const processedOffloadUnits = checkpointStart ? liveOffloadUnits : (lastProcessedOffloadUnits ?? 0);
  const processedSalary = checkpointStart ? liveSalary : (lastProcessedSalary ?? 0);

  const handleExportDiff = async () => {
    const diffData = (localItems || [])
      .flatMap((item) => (item.locations || []).map((loc: any) => {
        const checkpointLoc = checkpoint.find((ci) => ci.id === item.id)?.locations.find((cl) => cl.voxel === loc.voxel);
        const diffQty = (loc.quantity || 0) - (checkpointLoc?.quantity || 0);
        return diffQty !== 0 ? { id: item.id, diffQty, voxel: loc.voxel } : null;
      }).filter(Boolean))
      .filter(Boolean);

    if (diffData.length === 0) {
      toast.info('No changes to export');
      return;
    }

    const result = await exportDiffToAdmin(diffData as any, isTelegram);

    if (isTelegram && result?.csv) {
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
      const stats = computeProcessedStats();
      setLastProcessedCount(stats.changedCount);
      setLastProcessedTotalDelta(stats.totalDelta);
      setLastProcessedPackings(stats.packings);
      setLastProcessedStars(stats.stars);
      setLastProcessedOffloadUnits(stats.offloadUnits);
      setLastProcessedSalary(stats.salary);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${stats.changedCount}`);
      if (gameMode === 'offload') {
        const message = `Offload завершен:\nВыдано единиц: ${stats.offloadUnits}\nЗарплата: ${stats.salary} руб\nВремя: ${formatSec(durSec)}\nИзменено позиций: ${stats.changedCount}`;
        await notifyAdmin(message);
      }
    }
  };

  const handleExportStock = async (summarized = false) => {
    const result = await exportCurrentStock(localItems, isTelegram, summarized);
    if (isTelegram && result?.csv) {
      navigator.clipboard.writeText(result.csv);
      toast.success("CSV скопирован в буфер обмена!");
    } else if (result && result.csv) {
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
      const stats = computeProcessedStats();
      setLastProcessedCount(stats.changedCount);
      setLastProcessedTotalDelta(stats.totalDelta);
      setLastProcessedPackings(stats.packings);
      setLastProcessedStars(stats.stars);
      setLastProcessedOffloadUnits(stats.offloadUnits);
      setLastProcessedSalary(stats.salary);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${stats.changedCount}`);
      if (gameMode === 'offload') {
        const message = `Offload завершен:\nВыдано единиц: ${stats.offloadUnits}\nЗарплата: ${stats.salary} руб\nВремя: ${formatSec(durSec)}\nИзменено позиций: ${stats.changedCount}`;
        await notifyAdmin(message);
      }
    }
  };

  const handleCheckPending = async () => {
    setCheckingPending(true);
    try {
      const wbRes = await fetchWbPendingCount();
      const ozonRes = await fetchOzonPendingCount();
      const wbCount = wbRes?.success ? wbRes.count : 0;
      const ozonCount = ozonRes?.success ? ozonRes.count : 0;
      const total = (wbCount || 0) + (ozonCount || 0);
      setTargetOffload(total);
      toast.success(`Pending offloads: WB ${wbCount}, Ozon ${ozonCount}. Target: ${total}`);
    } catch (err: any) {
      toast.error('Failed to check pending: ' + (err?.message || 'Unknown'));
    } finally {
      setCheckingPending(false);
    }
  };

  const localFilteredItems = useMemo(() => {
    const arr = (localItems || []).filter((item) => {
      const searchLower = (search || "").toLowerCase();
      const matchesSearch = ((item.name || "") + " " + (item.description || "")).toLowerCase().includes(searchLower);
      const matchesSeason = !filterSeason || item.season === filterSeason;
      const matchesPattern = !filterPattern || item.pattern === filterPattern;
      const matchesColor = !filterColor || item.color === filterColor;
      const matchesSize = !filterSize || item.size === filterSize;
      return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });

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

  const handlePlateClickCustom = (voxelId: string) => {
    handlePlateClick(voxelId);
    const content = localItems.flatMap((i) => (i.locations || []).filter((l: any) => l.voxel === voxelId && (l.quantity || 0) > 0).map((l: any) => ({ item: i, quantity: l.quantity })));
    if (gameMode === "onload" || gameMode === "offload") {
      setSelectedVoxel(voxelId);
      if (gameMode === "onload") toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — добавь товар нажатием на карточки` : `Выбрана ячейка ${voxelId}`);
      else toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — нет товаров` : `Выбрана ячейка ${voxelId}`);
      return;
    }
    if (content.length > 0) {
      setEditVoxel(voxelId);
      setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
      setEditDialogOpen(true);
    } else setSelectedVoxel(voxelId);
  };

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
      const selVoxelNorm = selectedVoxel ? selectedVoxel.toString().toLowerCase() : null;
      if (selectedVoxel) {
        loc = (item.locations || []).find((l: any) => (l.voxel || "").toString().toLowerCase() === selVoxelNorm && (l.quantity || 0) > 0);
        if (!loc) {
          const nonEmpty = (item.locations || []).filter((l: any) => (l.quantity || 0) > 0);
          if (nonEmpty.length === 1) {
            loc = nonEmpty[0];
            toast.info(`В выбранной ячейке нет товара — списываю из ${loc.voxel} (единственная ячейка с товаром).`);
          } else return toast.error("Нет товара в выбранной ячейке");
        }
      } else {
        const nonEmpty = (item.locations || []).filter((l: any) => (l.quantity || 0) > 0);
        if (nonEmpty.length === 0 || (item.total_quantity || 0) <= 0) return toast.error("Нет товара на складе");
        if (nonEmpty.length > 1) return toast.error("Выберите ячейку для выдачи (несколько локаций)");
        loc = nonEmpty[0];
      }
      if (loc) {
        const voxel = loc.voxel;
        optimisticUpdate(item.id, voxel, -1);
        toast.success(`Выдано из ${voxel}`);
      } else toast.error("Нет товара на складе");
      return;
    }
    handleItemClick(item);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <Select value={gameMode === null ? "none" : gameMode} onValueChange={(v: any) => setGameMode(v === "none" ? null : v)}>
            <SelectTrigger className="w-28 text-[10px]">
              <SelectValue placeholder="Режим" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none"><div className="flex items-center gap-2"><FileText size={12} /> <span>Без режима</span></div></SelectItem>
              <SelectItem value="onload"><div className="flex items-center gap-2"><Upload size={12} /> <span>Прием</span></div></SelectItem>
              <SelectItem value="offload"><div className="flex items-center gap-2"><Download size={12} /> <span>Выдача</span></div></SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckpoint}><Save size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleReset}><RotateCcw size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportDiff}><Download size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(false)}><FileUp size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(true)}><FileText size={12} /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={12} /></Button>
            <input ref={fileInputRef as any} type="file" onChange={handleFileChange} className="hidden" accept=".csv,.CSV,.txt,text/csv,text/plain" />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckPending} disabled={checkingPending}>{checkingPending ? <PackageSearch className="animate-spin" size={12} /> : <PackageSearch size={12} />}</Button>
            <Link href="/csv-compare"><Button size="sm" variant="outline" className="text-[10px]">CSV Сравнение</Button></Link>
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
              <WarehouseItemCard key={item.id} item={item} onClick={() => handleItemClickCustom(item)} />
            ))}
          </CardContent>
        </Card>

        <div className="mt-2">
          <WarehouseViz
            items={localItems}
            selectedVoxel={selectedVoxel}
            onSelectVoxel={setSelectedVoxel}
            onUpdateLocationQty={(itemId: string, voxelId: string, qty: number) => optimisticUpdate(itemId, voxelId, qty)}
            gameMode={gameMode}
            onPlateClick={handlePlateClickCustom}
          />
        </div>

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
            offloadUnits={processedOffloadUnits}
            salary={processedSalary}
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