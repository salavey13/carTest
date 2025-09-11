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
import { exportDiffToAdmin, exportCurrentStock, uploadWarehouseCsv, updateItemLocationQty } from "@/app/wb/actions";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { VOXELS } from "@/app/wb/common";
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

  // file upload (accept csv/txt)
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
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => l.voxel === voxelId);
        if (idx === -1) {
          if (delta > 0) locs.push({ voxel: voxelId, quantity: delta });
        } else {
          locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        }
        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const total = filtered.reduce((a: number, b: any) => a + (b.quantity || 0), 0);
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

  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0 };
    const changedCount = (localItems || []).reduce((acc, it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      return acc + (cp && (cp.total_quantity !== it.total_quantity) ? 1 : 0);
    }, 0);
    const totalDelta = (localItems || []).reduce((acc, it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      return acc + Math.abs((it.total_quantity || 0) - (cp?.total_quantity || 0));
    }, 0);
    return { changedCount, totalDelta };
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
      .flatMap((i) => i.locations.filter((l:any) => l.voxel === voxelId && (l.quantity || 0) > 0).map((l:any) => ({ item: i, quantity: l.quantity })));

    if (gameMode === "onload") {
      if (content.length === 0) {
        setSelectedVoxel(voxelId);
        setFilterSeason(null);
        setFilterPattern(null);
        setFilterColor(null);
        setFilterSize(null);
        setSearch("");
        toast.info(`Выберите товар для добавления в ${voxelId}`);
      } else {
        // open edit modal to adjust quantities (no auto-add/remove)
        setEditVoxel(voxelId);
        setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
        setEditDialogOpen(true);
      }
    } else if (gameMode === "offload") {
      if (content.length > 0) {
        // don't auto-decrease — open modal so user can pick item or click item card to decrease
        setEditVoxel(voxelId);
        setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
        setEditDialogOpen(true);
        toast.info("Касание по карточке товара списывает позицию. Плитка только открывает обзор.");
      } else {
        toast.info("В этой ячейке нет товаров");
      }
    } else {
      // no mode selected - just show content if any
      if (content.length > 0) {
        setEditVoxel(voxelId);
        setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
        setEditDialogOpen(true);
      } else {
        setSelectedVoxel(voxelId);
      }
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
      const loc = (item.locations || []).find((l:any) => (l.quantity || 0) > 0);
      if (loc) {
        const voxel = loc.voxel;
        optimisticUpdate(item.id, voxel, -1);
        // update selection if became empty
        const postItem = localItems.find((i) => i.id === item.id);
        const postLoc = postItem?.locations?.find((l:any) => l.voxel === voxel);
        if (!postLoc && selectedVoxel === voxel) setSelectedVoxel(null);
        toast.success(`Выдано из ${voxel}`);
      } else {
        toast.error("Нет товара на складе");
      }
      return;
    }

    handleItemClick(item);
  };

  const localFilteredItems = useMemo(() => {
    const arr = (localItems || []).filter((item) => {
      const searchLower = (search || "").toLowerCase();
      const matchesSearch =
        item.name?.toLowerCase().includes(searchLower) ||
        (item.description || "").toLowerCase().includes(searchLower);

      const matchesSeason = !filterSeason || item.season === filterSeason;
      const matchesPattern = !filterPattern || item.pattern === filterPattern;
      const matchesColor = !filterColor || item.color === filterColor;
      const matchesSize = !filterSize || item.size === filterSize;

      return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });
    return arr;
  }, [localItems, search, filterSeason, filterPattern, filterColor, filterSize]);

  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta } = computeProcessedStats();
  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <Select value={gameMode || ""} onValueChange={(v:any)=> setGameMode(v || null)}>
            <SelectTrigger className="w-24 text-[10px]">
              <SelectValue placeholder="Режим" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onload"><VibeContentRenderer content="::fasun:: Прием" /></SelectItem>
              <SelectItem value="offload"><VibeContentRenderer content="::famoon:: Выдача" /></SelectItem>
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

        <div className="mt-2 p-3 bg-muted rounded-lg text-[12px] space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Статистика</h3>
            <div className="text-[11px] opacity-80">Элементов: <b>{localItems.length}</b> · Уникальных ID: <b>{new Set(localItems.map(i => i.id)).size}</b></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white/5 rounded flex flex-col gap-1">
              <div className="text-[11px]">Эффективность</div>
              <div className="text-lg font-bold">{score} <span className="text-xs opacity-70"> (Вал: {Math.floor(score/100)})</span></div>
              <div className="text-[11px] opacity-70">Ур: {level} · Серия: {streak} · Дни: {dailyStreak}</div>
            </div>

            <div className={cn("p-2 rounded", checkpointStart ? "bg-emerald-600/10 border border-emerald-300" : "bg-yellow-600/5 border border-yellow-300")}>
              <div className="text-[11px]">Checkpoint</div>
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-mono font-bold">{checkpointStart ? formatSec(elapsedSec) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--")}</div>
                <div className="text-[11px] opacity-80">
                  {checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался")}
                </div>
              </div>
              <div className="text-[12px] mt-1 opacity-80">
                Изм. позиций: <b>{checkpointStart ? liveChangedCount : (lastProcessedCount ?? 0)}</b> · Изменённое кол-во: <b>{checkpointStart ? liveTotalDelta : (lastProcessedCount ? liveTotalDelta : 0)}</b>
              </div>
            </div>
          </div>

          <div className="text-[11px]">
            <div>Достижения: <span className="font-medium">{achievements.join(", ") || "—"}</span></div>
            <div className="mt-1">Время сессии: <b>{Math.floor((Date.now() - sessionStart) / 1000)}</b> сек · Ошибки: <b>{errorCount}</b></div>
            {bossMode && <div className="text-destructive">Критическая! Осталось: <b>{Math.floor(bossTimer/1000)}</b> сек</div>}
          </div>

          <div>
            <div className="text-[11px]">Рейтинг:</div>
            <ol className="list-decimal pl-4 text-[10px]">
              {leaderboard.map((entry, idx) => (
                <li key={idx}>{entry.name}: {entry.score} ({entry.date})</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2" style={bgStyle}>
        <WarehouseViz
          items={localItems}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={setSelectedVoxel}
          onUpdateLocationQty={(itemId:string, voxelId:string, qty:number) => optimisticUpdate(itemId, voxelId, qty)}
          gameMode={gameMode}
          onPlateClick={handlePlateClickCustom}
        />
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