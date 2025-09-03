"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

// Хардкод вокселей: 2 полки слева (A1-A4), справа (B1-B4)
const VOXELS = [
  { id: 'A1', position: { x: 0, y: 0, z: 0 }, label: 'Лево Низ 1' },
  { id: 'A2', position: { x: 0, y: 1, z: 0 }, label: 'Лево Верх 1' },
  { id: 'A3', position: { x: 0, y: 0, z: 1 }, label: 'Лево Низ 2' },
  { id: 'A4', position: { x: 0, y: 1, z: 1 }, label: 'Лево Верх 2' },
  { id: 'B1', position: { x: 1, y: 0, z: 0 }, label: 'Право Низ 1' },
  { id: 'B2', position: { x: 1, y: 1, z: 0 }, label: 'Право Верх 1' },
  { id: 'B3', position: { x: 1, y: 0, z: 1 }, label: 'Право Низ 2' },
  { id: 'B4', position: { x: 1, y: 1, z: 1 }, label: 'Право Верх 2' },
];

// Хардкод товаров (дефолт)
const DEFAULT_ITEMS = [
  { id: 'leto-odeyalo-120', name: 'Летнее одеяло 120x180', description: 'Маленькая, светло-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-120.jpg`, voxel: 'A1' },
  { id: 'leto-odeyalo-150', name: 'Летнее одеяло 150x200', description: 'Средняя, зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-150.jpg`, voxel: 'A2' },
  { id: 'leto-odeyalo-180', name: 'Летнее одеяло 180x220', description: 'Большая, темно-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-180.jpg`, voxel: 'A3' },
  { id: 'leto-odeyalo-220', name: 'Летнее одеяло 220x240', description: 'Огромная, темно-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-220.jpg`, voxel: 'A4' },
  { id: 'zima-odeyalo-120', name: 'Зимнее одеяло 120x180', description: 'Маленькая, серая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-120.jpg`, voxel: 'B1' },
  { id: 'zima-odeyalo-150', name: 'Зимнее одеяло 150x200', description: 'Средняя, серая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-150.jpg`, voxel: 'B2' },
  { id: 'zima-odeyalo-180', name: 'Зимнее одеяло 180x220', description: 'Большая, красная упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-180.jpg`, voxel: 'B3' },
  { id: 'zima-odeyalo-220', name: 'Зимнее одеяло 220x240', description: 'Огромная, красная упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-220.jpg`, voxel: 'B4' },
  // Пододеяльники и наволочки аналогично, добавить если нужно
  { id: 'leto-podot-120', name: 'Летний пододеяльник 120x180', description: 'Маленькая, светло-зеленая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-podot-120.jpg`, voxel: null },
  // ... остальное
];

type WarehouseVizProps = {
  items: typeof DEFAULT_ITEMS;
  selectedVoxel: string | null;
  onSelectVoxel: (id: string) => void;
  onUpdateLocation: (itemId: string, voxelId: string) => void;
};

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocation }: WarehouseVizProps) {
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newVoxel, setNewVoxel] = useState<string>('');

  const voxelMap = useMemo(() => {
    const map: { [key: string]: typeof DEFAULT_ITEMS[0] | null } = {};
    items.forEach(item => { if (item.voxel) map[item.voxel] = item; });
    return map;
  }, [items]);

  return (
    <div className="relative w-full h-[50vh] md:h-full perspective-1000">
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-center">Вход</div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">Комп с окном</div>
      <div className="w-full h-full transform rotate-x-30 rotate-y-[-30deg] grid grid-cols-2 gap-4">
        {/* Левая полка */}
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
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
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
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
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