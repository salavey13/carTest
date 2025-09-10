"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload } from "lucide-react";
import { useWarehouse } from "@/hooks/useWarehouse";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import FilterAccordion from "@/components/FilterAccordion";
import { exportDiffToAdmin, exportCurrentStock, uploadWarehouseCsv } from "@/app/wb/actions";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { VOXELS } from "@/app/wb/common";
import { useAppContext } from "@/contexts/AppContext";

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
  const { user } = useAppContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();

      reader.onload = async (event) => {
        const csv = event.target?.result as string;
        const result = await uploadWarehouseCsv(csv, user?.id);
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
    const result = await uploadWarehouseCsv(DEFAULT_CSV, user?.id);
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
      }),
    ).filter(Boolean);
    await exportDiffToAdmin(diffData);
  };

  const handleExportStock = async () => {
    await exportCurrentStock(items);
  };

  const handlePlateClickCustom = (voxelId: string) => {
    handlePlateClick(voxelId);
    const content = items.flatMap((i) =>
      i.locations.filter((l) => l.voxel === voxelId).map((l) => ({ item: i, quantity: l.quantity })),
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
        setEditVoxel(voxelId);
        setEditContents(content);
        setEditDialogOpen(true);
      }
    } else if (gameMode === "offload") {
      if (content.length > 0) {
        const { item, quantity } = content[0];
        handleUpdateLocationQty(item.id, voxelId, quantity - 1, true);
      }
    }
  };

  const handleItemClickCustom = (item: Item) => {
    if (gameMode === "onload" && selectedVoxel) {
      const loc = item.locations.find((l) => l.voxel === selectedVoxel);
      const currentQty = loc ? loc.quantity : 0;
      handleUpdateLocationQty(item.id, selectedVoxel, currentQty + 1, true);
      toast.success(`Добавлено в ${selectedVoxel}`);
    } else {
      handleItemClick(item);
    }
  };

  const saveEditQty = async (itemId: string, newQty: number) => {
    if (editVoxel) {
      await handleUpdateLocationQty(itemId, editVoxel, newQty, !!gameMode);
      toast.success("Количество обновлено");
      setEditDialogOpen(false);
    }
  };

  const bgStyle = gameMode === "onload" ? { background: "linear-gradient(to bottom, #fff, #ffd" } : gameMode === "offload" ? { background: "linear-gradient(to bottom, #333, #000" } : {};

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<any[]>([]); // Content type from common

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
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportStock}><FileUp size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={12} /></Button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
          <Button size="sm" variant="outline" className="text-[10px]" onClick={handleTestImport} disabled={isUploading}>Тест CSV</Button>
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
                isHighlighted={workflowItems.some((w) => w.id === item.id) || (gameMode === "onload" && !!selectedVoxel)}
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

      {/* Workflow Dialog */}
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Операция {currentWorkflowIndex + 1}/{workflowItems.length}</DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div className="space-y-2 text-sm">
                <p>Товар: {workflowItems[currentWorkflowIndex].id}, Изм: {workflowItems[currentWorkflowIndex].change}</p>
                <Select value={selectedWorkflowVoxel || ""} onValueChange={setSelectedWorkflowVoxel}>
                  <SelectTrigger><SelectValue placeholder="Ячейка" /></SelectTrigger>
                  <SelectContent>
                    {VOXELS.map((v) => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={handleWorkflowNext} className="flex-1">Обновить</Button>
                  <Button onClick={handleSkipItem} variant="outline" className="flex-1">Нет в наличии</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog for filled voxels */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать ячейку {editVoxel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editContents.map(({ item, quantity }) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="flex-1">{item.name}</span>
                <Input
                  type="number"
                  defaultValue={quantity}
                  onBlur={(e) => {
                    const newQty = parseInt(e.target.value);
                    if (!isNaN(newQty)) saveEditQty(item.id, newQty);
                  }}
                  className="w-20"
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}