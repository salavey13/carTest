"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  // Модальные состояния — вынесены наверх для избежания TDZ
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<{ item: any; quantity: number; newQuantity: number }[]>([]);

  useEffect(() => {
    loadItems();
    if (error) toast.error(error);
  }, [error, loadItems]);

  const bgStyle = useMemo(() => 
    gameMode === "onload" ? { background: "linear-gradient(to bottom, #fff, #ffd)" } : 
    gameMode === "offload" ? { background: "linear-gradient(to bottom, #333, #000)" } : 
    {}, [gameMode]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csv = event.target?.result as string;
        const parsed = parse(csv, { header: true }).data;
        const result = await uploadWarehouseCsv(parsed, user?.id);
        setIsUploading(false);
        if (result.success) {
          toast.success(result.message || "CSV uploaded!");
          loadItems();
        } else {
          toast.error(result.error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTestImport = async () => {
    setIsUploading(true);
    const parsed = parse(DEFAULT_CSV, { header: true }).data;
    const result = await uploadWarehouseCsv(parsed, user?.id);
    setIsUploading(false);
    if (result.success) {
      toast.success(result.message || "Test CSV uploaded!");
      loadItems();
    } else {
      toast.error(result.error);
    }
  };

  const handleCheckpoint = () => {
    setCheckpoint(items.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
    toast.success("Checkpoint saved!");
  };

  const handleReset = () => {
    setItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
    toast.success("Reset to checkpoint!");
  };

  const handleExportDiff = async () => {
    const diffData = items.flatMap((item) =>
      item.locations.map((loc) => {
        const checkpointLoc = checkpoint.find((ci) => ci.id === item.id)?.locations.find((cl) => cl.voxel === loc.voxel);
        const diffQty = loc.quantity - (checkpointLoc?.quantity || 0);
        return diffQty !== 0 ? { id: item.id, diffQty, voxel: loc.voxel } : null;
      }).filter(Boolean)
    );
    const result = await exportDiffToAdmin(diffData, isTelegram);
    if (isTelegram && result.csv) {
      navigator.clipboard.writeText(result.csv);
      toast.success("CSV скопирован в буфер обмена!");
    }
  };

  const handleExportStock = async (summarized = false) => {
    const result = await exportCurrentStock(items, isTelegram, summarized);
    if (isTelegram && result.csv) {
      navigator.clipboard.writeText(result.csv);
      toast.success("CSV скопирован в буфер обмена!");
    } else if (result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = summarized ? "warehouse_stock_summarized.csv" : "warehouse_stock.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePlateClickCustom = (voxelId: string) => {
    handlePlateClick(voxelId);
    const content = items.flatMap((i) =>
      i.locations.filter((l) => l.voxel === voxelId).map((l) => ({ item: i, quantity: l.quantity }))
    );
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
        // Открываем модал редактирования только если нужно (опционально)
        setEditVoxel(voxelId);
        setEditContents(content.map(c => ({ ...c, newQuantity: c.quantity })));
        setEditDialogOpen(true);
      }
    } else if (gameMode === "offload") {
      if (content.length > 0) {
        const { item, quantity } = content[0];
        if (quantity > 0) {
          handleUpdateLocationQty(item.id, voxelId, -1, true);
        }
      }
    }
  };

  const handleItemClickCustom = (item: any) => {
    if (!item) return; // Защита от undefined
    if (gameMode === "onload" && selectedVoxel) {
      const loc = item.locations?.find((l: any) => l.voxel === selectedVoxel);
      const currentQty = loc ? loc.quantity : 0;
      handleUpdateLocationQty(item.id, selectedVoxel, 1, true);
      toast.success(`Добавлено в ${selectedVoxel}`);
    } else {
      handleItemClick(item);
    }
  };

  const saveEditQty = async (itemId: string, newQty: number) => {
    if (!editVoxel || newQty < 0) {
      toast.error("Недопустимое количество");
      return;
    }
    const currentContent = editContents.find(c => c.item.id === itemId);
    if (!currentContent) return;
    const delta = newQty - currentContent.quantity;
    await handleUpdateLocationQty(itemId, editVoxel, delta, !!gameMode);
    toast.success("Количество обновлено");
    setEditDialogOpen(false);
  };

  const handleResetFilters = () => {
    setFilterSeason(null);
    setFilterPattern(null);
    setFilterColor(null);
    setFilterSize(null);
    setSearch("");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <Select value={gameMode || ""} onValueChange={(v: "offload" | "onload") => setGameMode(v || null)}>
            <SelectTrigger className="w-24 text-[10px]">
              <SelectValue placeholder="Режим" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onload"><VibeContentRenderer content="::fasun:: Прием" /></SelectItem>
              <SelectItem value="offload"><VibeContentRenderer content="::famoon:: Выдача" /></SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckpoint}><Save size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleReset}><RotateCcw size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportDiff}><Download size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock()}><FileUp size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(true)}><FileText size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={12} /></Button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
          <Button size="sm" variant="outline" className="text-[10px]" onClick={handleTestImport} disabled={isUploading}>Тест CSV</Button>
          <Link href="/csv-compare">
            <Button size="sm" variant="outline" className="text-[10px]">CSV Сравнение</Button>
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
          items={items}
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

        <div className="mt-2 p-2 bg-muted rounded-lg text-[10px]">
          <h3 className="font-semibold">Статистика</h3>
          <p>Эффективность: {score} (Вал: {Math.floor(score / 100)}) | Ур: {level} | Серия: {streak} | Дни: {dailyStreak}</p>
          <p>Достижения: {achievements.join(", ")}</p>
          <p>Время: {Math.floor((Date.now() - sessionStart) / 1000)} сек | Ошибки: {errorCount}</p>
          {bossMode && <p className="text-destructive">Критическая! Ост: {Math.floor(bossTimer / 1000)} сек</p>}
          <p>Рейтинг:</p>
          <ol className="list-decimal pl-4">
            {leaderboard.map((entry, idx) => (
              <li key={idx} className="text-[8px]">{entry.name}: {entry.score} ({entry.date})</li>
            ))}
          </ol>
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
        saveEditQty={saveEditQty}
        gameMode={gameMode}
        VOXELS={VOXELS}
      />
    </div>
  );
}