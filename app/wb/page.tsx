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
import { exportDiffToAdmin, exportCurrentStock, uploadWarehouseCsv } from "@/app/wb/actions";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { VOXELS } from "@/app/wb/common";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { parse } from "papaparse";

const DEFAULT_CSV = `Артикул,Изменение,Ячейка
евро лето кружева,2,A1
2 зима огурцы,1,A2
1.5 лето флора,3,B1
`;

export default function WBPage() {
  const {
    items,
    setItems,           // предполагается, что хук возвращает setItems (как в предыдущих версиях)
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
    filteredItems,
    sortOption,
    setSortOption,
  } = useWarehouse();

  const { user, tg } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isTelegram = !!tg;

  // модалки
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<{ item: any; quantity: number; newQuantity: number }[]>([]);

  // Таймеры чекпоинта / статистика
  const [checkpointStart, setCheckpointStart] = useState<number | null>(null); // millis
  const [tick, setTick] = useState(0); // форс-обновление каждую секунду
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null); // сек
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);

  useEffect(() => {
    loadItems();
    if (error) toast.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, loadItems]);

  // тикер 1s для обновления UI (показывает live секунды с чекпоинта)
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

  // --- Файловая загрузка/импорт ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = (event.target?.result as string) || "";
      const parsed = parse(csv, { header: true }).data as any[];
      const result = await uploadWarehouseCsv(parsed, user?.id);
      setIsUploading(false);
      if (result.success) {
        toast.success(result.message || "CSV uploaded!");
        await loadItems();
      } else {
        toast.error(result.error || "Ошибка загрузки CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleTestImport = async () => {
    setIsUploading(true);
    const parsed = parse(DEFAULT_CSV, { header: true }).data as any[];
    const result = await uploadWarehouseCsv(parsed, user?.id);
    setIsUploading(false);
    if (result.success) {
      toast.success(result.message || "Test CSV uploaded!");
      await loadItems();
    } else {
      toast.error(result.error || "Ошибка тестового импорта");
    }
  };

  // --- Checkpoint flow ---
  const handleCheckpoint = () => {
    // snapshot текущих items
    setCheckpoint(items.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
    setCheckpointStart(Date.now());
    // сбрасываем прошлые метрики — но храним last если нужно
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    toast.success("Checkpoint saved!");
  };

  const handleReset = () => {
    // откат к checkpoint, если есть
    if (!checkpoint || checkpoint.length === 0) {
      toast.error("Нет сохранённого чекпоинта");
      return;
    }
    // Восстанавливаем локально; если хочешь — заменить на загрузку с бэка
    setItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
    toast.success("Reset to checkpoint!");
  };

  // подсчёт обработанных/изменённых позиций относительно чекпоинта
  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0 };
    const changedCount = items.reduce((acc, it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      return acc + (cp && (cp.total_quantity !== it.total_quantity) ? 1 : 0);
    }, 0);
    const totalDelta = items.reduce((acc, it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      return acc + Math.abs((it.total_quantity || 0) - (cp?.total_quantity || 0));
    }, 0);
    return { changedCount, totalDelta };
  }, [items, checkpoint]);

  // --- Экспорт: останавливаем таймер и фиксируем stats ---
  const handleExportDiff = async () => {
    const diffData = items
      .flatMap((item) =>
        item.locations
          .map((loc) => {
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
      // тоже сохраняем локально, на всякий
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diff_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    }

    // стопаем таймер чекпоинта и фиксируем результаты
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
    const result = await exportCurrentStock(items, isTelegram, summarized);
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

    // стопаем чекпоинт таймер и фиксируем stats
    if (checkpointStart) {
      const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
      setLastCheckpointDurationSec(durSec);
      const { changedCount } = computeProcessedStats();
      setLastProcessedCount(changedCount);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${changedCount}`);
    }
  };

  // утилита форматирования секунд в mm:ss
  const formatSec = (sec: number | null) => {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // --- Логика клика по тарелке (ячейке) ---
  const handlePlateClickCustom = (voxelId: string) => {
    handlePlateClick(voxelId);
    const content = items
      .flatMap((i) => i.locations.filter((l) => l.voxel === voxelId).map((l) => ({ item: i, quantity: l.quantity })));

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
        setEditVoxel(voxelId);
        setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
        setEditDialogOpen(true);
      }
    } else if (gameMode === "offload") {
      if (content.length > 0) {
        const { item } = content[0];
        if (content[0].quantity > 0) {
          // выдача 1 шт из этой ячейки
          handleUpdateLocationQty(item.id, voxelId, -1, true);
        }
      } else {
        toast.info("В этой ячейке нет товаров");
      }
    }
  };

  // --- Логика клика по карточке товара ---
  const handleItemClickCustom = async (item: any) => {
    if (!item) return;

    // Приём: если нет выбранной ячейки — используем A1 по умолчанию
    if (gameMode === "onload") {
      const targetVoxel = selectedVoxel || "A1";
      setSelectedVoxel(targetVoxel); // визуально показываем куда добавили
      await handleUpdateLocationQty(item.id, targetVoxel, 1, true);
      toast.success(`Добавлено в ${targetVoxel}`);
      return;
    }

    // Выдача: не надо выбирать ячейку руками — берем первую с qty>0
    if (gameMode === "offload") {
      const loc = (item.locations || []).find((l: any) => (l.quantity || 0) > 0);
      if (loc) {
        const voxel = loc.voxel;
        await handleUpdateLocationQty(item.id, voxel, -1, true);

        // если после обновления ячейка исчезла — очищаем визуальный selectedVoxel если он совпадал
        const postItem = items.find((i) => i.id === item.id);
        const postLoc = postItem?.locations?.find((l: any) => l.voxel === voxel);
        if (!postLoc && selectedVoxel === voxel) {
          setSelectedVoxel(null);
        }
        toast.success(`Выдано из ${voxel}`);
      } else {
        toast.error("Нет товара на складе");
      }
      return;
    }

    // fallback: если режим не установлен — вызываем базовую обработку
    handleItemClick(item);
  };

  // --- Рендер ---
  // вычисляем live stat'ы
  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta } = computeProcessedStats();
  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <Select value={gameMode || ""} onValueChange={(v: any) => setGameMode(v || null)}>
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
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
            <Button size="sm" variant="outline" className="text-[10px]" onClick={handleTestImport} disabled={isUploading}>Тест CSV</Button>
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
          items={items}
          onResetFilters={() => {
            setFilterSeason(null);
            setFilterPattern(null);
            setFilterColor(null);
            setFilterSize(null);
            setSearch("");
          }}
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
            <CardTitle className="text-xs">Товары ({filteredItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 p-2 max-h-[69vh] overflow-y-auto">
            {filteredItems.map((item) => (
              <WarehouseItemCard
                key={item.id}
                item={item}
                onClick={() => handleItemClickCustom(item)}
              />
            ))}
          </CardContent>
        </Card>

        {/* Статистика — сюда перемещён тикер + визуал */}
        <div className="mt-2 p-3 bg-muted rounded-lg text-[12px] space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Статистика</h3>
            <div className="text-[11px] opacity-80">Элементов: <b>{items.length}</b> · Уникальных ID: <b>{new Set(items.map(i => i.id)).size}</b></div>
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
          items={items}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={setSelectedVoxel}
          onUpdateLocationQty={handleUpdateLocationQty}
          gameMode={gameMode}
          onPlateClick={handlePlateClickCustom}
        />
      </div>

      {/* Модалы вынесены в компонент */}
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
          await handleUpdateLocationQty(itemId, editVoxel, delta, !!gameMode);
        }}
        gameMode={gameMode}
        VOXELS={VOXELS}
      />
    </div>
  );
}