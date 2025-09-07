"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { WarehousePlate } from "@/app/components/WarehousePlate";
import { WarehouseVizProps, VOXELS } from "@/app/wb/common";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <div className="relative w-full h-full perspective-[1000px] preserve-3d touch-pan-y pinch-zoom"> {/* Pinch zoom for mobile */}
        <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 text-[12px] md:text-[10px]">Вход</div>
        <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 text-[12px] md:text-[10px]">Комп с окном</div>
        <div className="w-full h-full transform rotate-x-[30deg] rotate-y-[-30deg] flex flex-col md:grid md:grid-cols-2 gap-4 md:gap-2 preserve-3d scale-150 md:scale-125"> {/* Bigger scale mobile */}
          {/* Левая полка A */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid grid-cols-4 gap-4 md:gap-2" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
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
            </TooltipTrigger>
            <TooltipContent>
              <p>Левая полка A: Матрасники (нижние мал., верхние бол.), Полуторки, Евро Макси, Двушки, Евро</p>
            </TooltipContent>
          </Tooltip>
          {/* Правая B */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid grid-cols-4 gap-4 md:gap-2" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
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
            </TooltipTrigger>
            <TooltipContent>
              <p>Правая полка B: Полуторки, Запас (approx, min_qty warn)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}