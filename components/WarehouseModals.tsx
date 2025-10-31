"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { VOXELS } from "@/app/wb/common";
import { toast } from "sonner";

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
  VOXELS?: any[]; // Optional override for crew-specific voxels
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
  VOXELS: propVoxels,
}: WarehouseModalsProps) {
  // Local state for input values to allow empty strings during editing
  const [localEditContents, setLocalEditContents] = useState<
    Array<{ item: any; quantity: number; newQuantity: number | string }>
  >(
    editContents.map((c) => ({
      ...c,
      newQuantity: c.newQuantity.toString(), // Initialize with string for input
    }))
  );

  // Sync localEditContents when editContents changes
  useEffect(() => {
    setLocalEditContents(
      editContents.map((c) => ({
        ...c,
        newQuantity: c.newQuantity.toString(),
      }))
    );
  }, [editContents]);

  // Prefer prop VOXELS if provided, otherwise fallback to imported VOXELS
  const safeVoxels = Array.isArray(propVoxels) ? propVoxels : (Array.isArray(VOXELS) ? VOXELS : []);

  // Handle input change for bulk quantity updates
  const handleInputChange = (idx: number, value: string) => {
    setLocalEditContents((prev) =>
      prev.map((c, i) =>
        i === idx
          ? { ...c, newQuantity: value } // Allow empty string or any valid input
          : c
      )
    );
  };

  // Handle blur to parse input and update editContents
  const handleInputBlur = (idx: number, itemId: string) => {
    const rawValue = localEditContents[idx].newQuantity;
    const parsedValue = rawValue === "" ? 0 : parseInt(rawValue.toString(), 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      toast.error("Количество не может быть отрицательным");
      setLocalEditContents((prev) =>
        prev.map((c, i) =>
          i === idx ? { ...c, newQuantity: localEditContents[idx].quantity } : c
        )
      );
      return;
    }
    setEditContents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, newQuantity: parsedValue } : c))
    );
    setLocalEditContents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, newQuantity: parsedValue } : c))
    );
  };

  // Save all changes
  const handleSaveAll = async () => {
    if (!localEditContents || localEditContents.length === 0) {
      setEditDialogOpen(false);
      return;
    }

    // Parse all inputs before saving
    const parsedContents = localEditContents.map((c) => ({
      ...c,
      newQuantity:
        c.newQuantity === "" ? 0 : parseInt(c.newQuantity.toString(), 10),
    }));

    // Check for invalid values
    const invalid = parsedContents.some((c) => isNaN(c.newQuantity) || c.newQuantity < 0);
    if (invalid) {
      toast.error("Некоторые количества некорректны");
      return;
    }

    // Update editContents with parsed values
    setEditContents(parsedContents);
    await Promise.all(
      parsedContents.map(({ item, newQuantity }) =>
        saveEditQty(item.id, newQuantity)
      )
    );
    setEditDialogOpen(false);
    toast.success("Изменения сохранены");
  };

  const anyNegative = localEditContents.some(
    (c) => c.newQuantity === "" || parseInt(c.newQuantity.toString(), 10) < 0
  );

  return (
    <>
      {/* Workflow Dialog */}
      {Array.isArray(workflowItems) && workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent className="p-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">
                Операция {currentWorkflowIndex + 1}/{workflowItems.length}
              </DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div className="space-y-2 text-sm">
                <p className="text-[10px]">
                  Товар: {workflowItems[currentWorkflowIndex].id}, Изм:{" "}
                  {workflowItems[currentWorkflowIndex].change}
                </p>
                <Select
                  value={selectedWorkflowVoxel || ""}
                  onValueChange={setSelectedWorkflowVoxel}
                >
                  <SelectTrigger className="h-8 text-[10px]">
                    <SelectValue placeholder="Ячейка" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeVoxels.map((v) => (
                      <SelectItem
                        key={v.id}
                        value={v.id}
                        className="text-[10px]"
                      >
                        {v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    onClick={handleWorkflowNext}
                    className="flex-1 h-8 text-[10px]"
                  >
                    Обновить
                  </Button>
                  <Button
                    onClick={handleSkipItem}
                    variant="outline"
                    className="flex-1 h-8 text-[10px]"
                  >
                    Нет в наличии
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="p-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Редактировать {editVoxel}
            </DialogTitle>
          </DialogHeader>

          {/* If no contents — show a friendly read-only view */}
          {(!localEditContents || localEditContents.length === 0) ? (
            <div className="p-4 text-center space-y-3">
              <div className="text-sm font-medium">Ячейка пуста</div>
              <div className="text-[12px] opacity-80">
                В этой ячейке нет товаров — нечего редактировать. Можно закрыть
                окно и продолжить работу.
              </div>
              <div className="flex justify-center mt-3">
                <Button
                  onClick={() => setEditDialogOpen(false)}
                  className="h-8"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {localEditContents.map(({ item, quantity, newQuantity }, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span className="flex-1 truncate pr-2">{item.name}</span>
                    <Input
                      type="text" // Changed to text to allow empty input
                      value={newQuantity}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      onBlur={() => handleInputBlur(idx, item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleInputBlur(idx, item.id);
                          saveEditQty(item.id, parseInt(newQuantity.toString(), 10) || 0);
                        }
                      }}
                      className="w-20 h-8 text-[12px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      autoFocus={idx === 0}
                      placeholder="Введите количество"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3 pt-2 border-t">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-[10px]"
                  onClick={handleSaveAll}
                  disabled={anyNegative}
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}