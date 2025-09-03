"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

// Хардкод вокселей: слева A1-A4 (евро, двушки, макси, матрасники), справа B1-B4 (полуторки + резерв)
const VOXELS = [
  { id: 'A1', position: { x: 0, y: 0, z: 0 }, label: 'Лево Низ 1 (Евро)' },
  { id: 'A2', position: { x: 0, y: 1, z: 0 }, label: 'Лево Верх 1 (Двушки)' },
  { id: 'A3', position: { x: 0, y: 0, z: 1 }, label: 'Лево Низ 2 (Евро Макси)' },
  { id: 'A4', position: { x: 0, y: 1, z: 1 }, label: 'Лево Верх 2 (Матрасники)' },
  { id: 'B1', position: { x: 1, y: 0, z: 0 }, label: 'Право Низ 1 (Полуторки)' },
  { id: 'B2', position: { x: 1, y: 1, z: 0 }, label: 'Право Верх 1 (Полуторки)' },
  { id: 'B3', position: { x: 1, y: 0, z: 1 }, label: 'Право Низ 2 (Резерв)' },
  { id: 'B4', position: { x: 1, y: 1, z: 1 }, label: 'Право Верх 2 (Резерв)' },
];

type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  voxel: string | null;
  season?: 'leto' | 'zima';
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3';
};

type WarehouseVizProps = {
  items: Item[];
  selectedVoxel: string | null;
  onSelectVoxel: (id: string) => void;
  onUpdateLocation: (itemId: string, voxelId: string) => void;
};

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocation }: WarehouseVizProps) {
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const voxelMap = useMemo(() => {
    const map: { [key: string]: Item | null } = {};
    items.forEach(item => { if (item.voxel) map[item.voxel] = item; });
    return map;
  }, [items]);

  return (
    <div className="relative w-full h-[50vh] md:h-full perspective-1000">
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">Вход</div> {/* Снизу */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-center">Комп с окном</div> {/* Сверху */}
      <div className="w-full h-full transform rotate-180 rotate-x-30 rotate-y-[-30deg] grid grid-cols-2 gap-4"> {/* Переворот 180deg */}
        {/* Левая полка (теперь слева после переворота) */}
        <div className="grid grid-cols-2 gap-2">
          {VOXELS.filter(v => v.id.startsWith('A')).map(voxel => (
            <Dialog key={voxel.id}>
              <DialogTrigger asChild>
                <div
                  className={cn(
                    "w-24 h-24 bg-blue-500/30 border border-blue-300 cursor-pointer transition-all",
                    selectedVoxel === voxel.id && "bg-blue-500/70 scale-110"
                  )}
                  onClick={() => onSelectVoxel(voxel.id)}
                >
                  <div className="p-2 text-xs">{voxel.label}</div>
                  <div className="p-2 text-sm">{voxelMap[voxel.id]?.name || 'Пусто'}</div>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Редактировать {voxel.label}</DialogTitle>
                </DialogHeader>
                <Select value={editItemId || ''} onValueChange={setEditItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите товар" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.season}, {item.pattern || 'нет'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { if (editItemId) onUpdateLocation(editItemId, voxel.id); setEditItemId(null); }}>
                  <VibeContentRenderer content="::FaSave:: Сохранить" />
                </Button>
              </DialogContent>
            </Dialog>
          ))}
        </div>
        {/* Правая полка */}
        <div className="grid grid-cols-2 gap-2">
          {VOXELS.filter(v => v.id.startsWith('B')).map(voxel => (
            <Dialog key={voxel.id}>
              <DialogTrigger asChild>
                <div
                  className={cn(
                    "w-24 h-24 bg-green-500/30 border border-green-300 cursor-pointer transition-all",
                    selectedVoxel === voxel.id && "bg-green-500/70 scale-110"
                  )}
                  onClick={() => onSelectVoxel(voxel.id)}
                >
                  <div className="p-2 text-xs">{voxel.label}</div>
                  <div className="p-2 text-sm">{voxelMap[voxel.id]?.name || 'Пусто'}</div>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Редактировать {voxel.label}</DialogTitle>
                </DialogHeader>
                <Select value={editItemId || ''} onValueChange={setEditItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите товар" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.season}, {item.pattern || 'нет'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { if (editItemId) onUpdateLocation(editItemId, voxel.id); setEditItemId(null); }}>
                  <VibeContentRenderer content="::FaSave:: Сохранить" />
                </Button>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>
    </div>
  );
}