"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { WarehouseCell } from "@/app/components/WarehouseCell";

// Воксели: слева A1-A10, справа B1-B10
const VOXELS = [
  // Лево: A1-A10
  { id: 'A1', position: { x: 0, y: 0, z: 0 }, label: 'A1 (Евро)' },
  { id: 'A2', position: { x: 0, y: 1, z: 0 }, label: 'A2 (Двушки)' },
  { id: 'A3', position: { x: 0, y: 0, z: 1 }, label: 'A3 (Евро Макси)' },
  { id: 'A4', position: { x: 0, y: 1, z: 1 }, label: 'A4 (Матрасники)' },
  { id: 'A5', position: { x: 0, y: 0, z: 2 }, label: 'A5' },
  { id: 'A6', position: { x: 0, y: 1, z: 2 }, label: 'A6' },
  { id: 'A7', position: { x: 0, y: 0, z: 3 }, label: 'A7' },
  { id: 'A8', position: { x: 0, y: 1, z: 3 }, label: 'A8' },
  { id: 'A9', position: { x: 0, y: 0, z: 4 }, label: 'A9' },
  { id: 'A10', position: { x: 0, y: 1, z: 4 }, label: 'A10' },
  // Право: B1-B10
  { id: 'B1', position: { x: 1, y: 0, z: 0 }, label: 'B1 (Полуторки)' },
  { id: 'B2', position: { x: 1, y: 1, z: 0 }, label: 'B2' },
  { id: 'B3', position: { x: 1, y: 0, z: 1 }, label: 'B3' },
  { id: 'B4', position: { x: 1, y: 1, z: 1 }, label: 'B4' },
  { id: 'B5', position: { x: 1, y: 0, z: 2 }, label: 'B5' },
  { id: 'B6', position: { x: 1, y: 1, z: 2 }, label: 'B6' },
  { id: 'B7', position: { x: 1, y: 0, z: 3 }, label: 'B7' },
  { id: 'B8', position: { x: 1, y: 1, z: 3 }, label: 'B8' },
  { id: 'B9', position: { x: 1, y: 0, z: 4 }, label: 'B9' },
  { id: 'B10', position: { x: 1, y: 1, z: 4 }, label: 'B10' },
];

type Location = {
  voxel: string;
  quantity: number;
};

type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  locations: Location[];
  total_quantity: number;
  season?: 'leto' | 'zima';
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3';
  color: string;
  size: string;
};

type WarehouseVizProps = {
  items: Item[];
  selectedVoxel: string | null;
  onSelectVoxel: (id: string) => void;
  onUpdateLocationQty: (itemId: string, voxelId: string, quantity: number) => void;
};

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocationQty }: WarehouseVizProps) {
  const voxelMap = useMemo(() => {
    const map: { [key: string]: {item: Item, local_quantity: number}[] } = {};
    items.forEach(item => {
      item.locations.forEach(loc => {
        if (!map[loc.voxel]) map[loc.voxel] = [];
        map[loc.voxel].push({item, local_quantity: loc.quantity});
      });
    });
    return map;
  }, [items]);

  return (
    <div className="relative w-full h-full perspective-1000">
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs">Вход</div>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs">Комп с окном</div>
      <div className="w-full h-full transform rotate-x-30 rotate-y-[-30deg] grid grid-cols-2 gap-2">
        {/* Левая полка (A1-A10, 5 столбцов, overflow-x-auto на мобилке) */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-5 gap-1 min-w-max">
            {VOXELS.filter(v => v.id.startsWith('A')).map(voxel => (
              <WarehouseCell
                key={voxel.id}
                voxel={voxel}
                contents={voxelMap[voxel.id] || []}
                selected={selectedVoxel === voxel.id}
                onSelect={onSelectVoxel}
                onUpdateQty={onUpdateLocationQty}
              />
            ))}
          </div>
        </div>
        {/* Правая полка (B1-B10) */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-5 gap-1 min-w-max">
            {VOXELS.filter(v => v.id.startsWith('B')).map(voxel => (
              <WarehouseCell
                key={voxel.id}
                voxel={voxel}
                contents={voxelMap[voxel.id] || []}
                selected={selectedVoxel === voxel.id}
                onSelect={onSelectVoxel}
                onUpdateQty={onUpdateLocationQty}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}