"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload } from "lucide-react";
import Papa from "papaparse";
import { useWarehouse } from "@/hooks/useWarehouse";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import FilterAccordion from "@/components/FilterAccordion";
import { exportDiffToAdmin, exportCurrentStock } from "@/app/wb/actions";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; // Поправлен путь
import { cn } from "@/lib/utils";
import { COLOR_MAP, Item, WarehouseItem, VOXELS } from "@/app/wb/common";

const DEFAULT_CSV = `Артикул,Количество
evro-leto-kruzheva,2
dvusloyniy-voyazh,1
klassika-s-zhemchugom,3
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
    handleImport,
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
  } = useWarehouse();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<Item | null>(null);
  const [modalVoxel, setModalVoxel] = useState<string | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number | "">("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
  };

  const handleTestImport = () => {
    const blob = new Blob([DEFAULT_CSV], { type: "text/csv" });
    const file = new File([blob], "test.csv");
    handleImport(file);
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
    await exportDiffToAdmin(diffData, { format: 'csv' });
  };

  const handleExportStock = async () => {
    await exportCurrentStock(items);
  };

  const openModal = (item: Item | null, voxel: string) => {
    setModalItem(item);
    setModalVoxel(voxel);
    setModalQuantity(item ? item.locations.find((l) => l.voxel === voxel)?.quantity || 0 : "");
    setModalOpen(true);
  };

  const saveModal = async () => {
    if (!modalVoxel) return;
    const qty = typeof modalQuantity === "number" ? modalQuantity : parseInt(String(modalQuantity));
    if (isNaN(qty)) return toast.error("Некорректное количество");
    if (modalItem) {
      await handleUpdateLocationQty(modalItem.id, modalVoxel, qty, !!gameMode);
    } else if (selectedItemId) {
      await handleUpdateLocationQty(selectedItemId, modalVoxel, qty, !!gameMode);
    }
    setModalOpen(false);
  };

  const bgStyle = gameMode === "onload" ? { background: "linear-gradient(to bottom, #fff, #ffd" } : gameMode === "offload" ? { background: "linear-gradient(to bottom, #333, #000" } : {};

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="p-2 flex justify-between items-center gap-2">
        <Select value={gameMode || ""} onValueChange={(v: "offload" | "onload") => setGameMode(v || null)}>
          <SelectTrigger className="w-24 text-[10px]">
            <SelectValue placeholder="Режим" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onload"><VibeContentRenderer content="<fa-sun> Свет" /></SelectItem>
            <SelectItem value="offload"><VibeContentRenderer content="<fa-moon> Тьма" /></SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckpoint}><Save size={12} /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleReset}><RotateCcw size={12} /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportDiff}><Download size={12} /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleExportStock}><FileUp size={12} /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()}><Upload size={12} /></Button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.xlsx" />
        <Button size="sm" variant="outline" className="text-[10px]" onClick={handleTestImport}>Тест CSV</Button>
        <Input
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-6 text-[10px] flex-1"
        />
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        <Card className="mb-2">
          <CardHeader className="p-2">
            <CardTitle className="text-sm">Товары ({filteredItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-2 max-h-[30vh] overflow-y-auto">
            {filteredItems.map((item) => (
              <WarehouseItemCard
                key={item.id}
                item={item}
                onClick={() => handleItemClick(item)}
                isHighlighted={workflowItems.some((w) => w.id === item.id)}
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
          onPlateClick={(voxelId) => {
            handlePlateClick(voxelId);
            openModal(null, voxelId); // For qty input in onload
          }}
        />
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
      />

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

      {/* Qty Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalItem ? `Товар: ${modalItem.name}` : `Ячейка: ${modalVoxel}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {modalItem ? (
              <p>Тек. в {modalVoxel}: {modalQuantity}</p>
            ) : (
              <Select value={selectedItemId || ""} onValueChange={setSelectedItemId}>
                <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                <SelectContent>
                  {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              value={modalQuantity}
              onChange={(e) => setModalQuantity(parseInt(e.target.value) || "")}
              placeholder="Количество"
            />
            <Button onClick={saveModal}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}