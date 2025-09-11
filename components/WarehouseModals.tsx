"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { VOXELS } from "@/app/wb/common";

interface WarehouseModalsProps {
  workflowItems: any[];
  currentWorkflowIndex: number;
  selectedWorkflowVoxel: string | null;
  setSelectedWorkflowVoxel: (v: string | null) => void;
  handleWorkflowNext: () => void;
  handleSkipItem: () => void;
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  editVoxel: string | null;
  editContents: { item: any; quantity: number; newQuantity: number }[];
  setEditContents: React.Dispatch<React.SetStateAction<any[]>>;
  saveEditQty: (itemId: string, newQty: number) => Promise<void>;
  gameMode: "offload" | "onload" | null;
  VOXELS: any[];
}

export default function WarehouseModals({
  workflowItems,
  currentWorkflowIndex,
  selectedWorkflowVoxel,
  setSelectedWorkflowVoxel,
  handleWorkflowNext,
  handleSkipItem,
  editDialogOpen,
  setEditDialogOpen,
  editVoxel,
  editContents,
  setEditContents,
  saveEditQty,
  gameMode,
  VOXELS,
}: WarehouseModalsProps) {
  const [localEditContents, setLocalEditContents] = useState(editContents);

  // Синхронизация с пропсами
  useState(() => {
    setLocalEditContents(editContents);
  }, [editContents]);

  const handleSaveAll = async () => {
    await Promise.all(
      localEditContents.map(({ item, newQuantity }) => saveEditQty(item.id, newQuantity))
    );
    setEditDialogOpen(false);
  };

  return (
    <>
      {/* Workflow Dialog */}
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent className="p-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Операция {currentWorkflowIndex + 1}/{workflowItems.length}</DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div className="space-y-2 text-sm">
                <p className="text-[10px]">Товар: {workflowItems[currentWorkflowIndex].id}, Изм: {workflowItems[currentWorkflowIndex].change}</p>
                <Select value={selectedWorkflowVoxel || ""} onValueChange={setSelectedWorkflowVoxel}>
                  <SelectTrigger className="h-8 text-[10px]">
                    <SelectValue placeholder="Ячейка" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOXELS.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-[10px]">
                        {v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={handleWorkflowNext} className="flex-1 h-8 text-[10px]">
                    Обновить
                  </Button>
                  <Button onClick={handleSkipItem} variant="outline" className="flex-1 h-8 text-[10px]">
                    Нет в наличии
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="p-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Редактировать {editVoxel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {localEditContents.map(({ item, quantity, newQuantity }, idx) => (
              <div key={item.id} className="flex items-center gap-2 text-[10px]">
                <span className="flex-1 truncate pr-2">{item.name}</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={newQuantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value) && value >= 0) {
                      setLocalEditContents((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, newQuantity: value } : c))
                      );
                      setEditContents((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, newQuantity: value } : c))
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveEditQty(item.id, newQuantity);
                    }
                  }}
                  className="w-16 h-6 text-[10px]"
                  autoFocus={idx === 0}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3 pt-2 border-t">
            <Button
              size="sm"
              className="flex-1 h-8 text-[10px]"
              onClick={handleSaveAll}
              disabled={localEditContents.some(c => c.newQuantity < 0)}
            >
              Сохранить все
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-[10px]"
              onClick={() => setEditDialogOpen(false)}
            >
              <X className="mr-1 h-3 w-3" size={12} /> Отмена
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}