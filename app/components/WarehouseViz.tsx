"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { WarehousePlate } from "@/app/components/WarehousePlate";
import { WarehouseVizProps, VOXELS } from "@/app/wb/common";

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocationQty, gameMode, onPlateClick }: WarehouseVizProps) {
  const voxelMap = useMemo(() => {
    const map: { [key: string]: {item: any; local_quantity: number}[] } = {};
    items.forEach(item => {
      item.locations.forEach(loc => {
        if (!map[loc.voxel]) map[loc.voxel] = [];
        map[loc.voxel].push({item, local_quantity: loc.quantity});
      });
    });
    return map;
  }, [items]);

  return (
    <div className="relative w-full h-full perspective-[1000px] preserve-3d">
      <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 text-[10px]">Вход</div>
      <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 text-[10px]">Комп с окном</div>
      <div className="w-full h-full transform rotate-x-[30deg] rotate-y-[-30deg] flex flex-col md:grid md:grid-cols-2 gap-1 preserve-3d">
        {/* Левая полка: 4 ряда по схеме */}
        <div className="grid grid-cols-4 gap-1" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
          {VOXELS.filter(v => v.id.startsWith('A')).map(voxel => (
            <WarehousePlate
              key={voxel.id}
              voxel={voxel}
              contents={voxelMap[voxel.id] || []}
              selected={selectedVoxel === voxel.id}
              onSelect={onSelectVoxel}
              onUpdateQty={onUpdateLocationQty}
              items={items}
              onPlateClick={onPlateClick}
              gameMode={gameMode}
            />
          ))}
        </div>
        {/* Правая полка аналогично */}
        <div className="grid grid-cols-4 gap-1" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
          {VOXELS.filter(v => v.id.startsWith('B')).map(voxel => (
            <WarehousePlate
              key={voxel.id}
              voxel={voxel}
              contents={voxelMap[voxel.id] || []}
              selected={selectedVoxel === voxel.id}
              onSelect={onSelectVoxel}
              onUpdateQty={onUpdateLocationQty}
              items={items}
              onPlateClick={onPlateClick}
              gameMode={gameMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}