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

  // State for computed stats to avoid TDZ
  const [statsObj, setStatsObj] = useState({
    changedCount: 0,
    totalDelta: 0,
    packings: 0,
    stars: 0,
    offloadUnits: 0,
    salary: 0
  });

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
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l:any)=>({...l})) })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Reset to checkpoint!");
  };

  // compute processed stats INCLUDING packings & stars
  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0, packings: 0, stars: 0, offloadUnits: 0, salary: 0 };
    let changedCount = 0;
    let totalDelta = 0;
    let packings = 0;
    let offloadUnits = offloadCount;

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

    const stars = packings * 25; // 1 packing = 25 stars
    const salary = offloadUnits * 50; // 1 offload unit = 50 rub
    return { changedCount, totalDelta, packings, stars, offloadUnits, salary };
  }, [localItems, checkpoint, offloadCount]);

  // UseEffect for stats computation to avoid TDZ in render
  useEffect(() => {
    const stats = computeProcessedStats();
    setStatsObj(stats);
  }, [localItems, checkpoint, offloadCount, onloadCount, editCount, computeProcessedStats]); // Deps include all counters

  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta, packings: livePackings, stars: liveStars, offloadUnits: liveOffloadUnits, salary: liveSalary } = statsObj;

  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  // Precompute some formatted strings for stats component
  const checkpointDisplayMain = checkpointStart ? formatSec(elapsedSec) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--");
  const checkpointDisplaySub = checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался");
  const processedChangedCount = checkpointStart ? liveChangedCount : (lastProcessedCount ?? 0);
  const processedTotalDelta = checkpointStart ? liveTotalDelta : (lastProcessedCount ? liveTotalDelta : 0);
  const processedPackings = checkpointStart ? livePackings : 0;
  const processedStars = checkpointStart ? liveStars : 0;
  const processedOffloadUnits = checkpointStart ? liveOffloadUnits : 0;
  const processedSalary = checkpointStart ? liveSalary : 0;

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