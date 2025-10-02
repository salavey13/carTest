"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Item, VOXELS } from "@/app/wb/common";

interface PlateProps {
  voxel: { id: string };
  items: Item[];
  selected: boolean;
  onSelect: (id: string) => void;
  onClick: (id: string) => void;
  gameMode: "offload" | "onload" | null;
}

function Plate({ voxel, items, selected, onSelect, onClick, gameMode }: PlateProps) {
  const content = items
    .flatMap((i) => i.locations.filter((l) => l.voxel === voxel.id).map((l) => ({ item: i, quantity: l.quantity })))
    .slice(0, 1); // Show only primary item
  const isEmpty = content.length === 0;
  const color = content[0]?.item.color || "gray";
  return (
    <motion.div
      onClick={() => {
        onSelect(voxel.id);
        if (gameMode) onClick(voxel.id);
      }}
      className={cn(
        "relative rounded-lg border shadow-sm cursor-pointer overflow-hidden",
        gameMode ? "w-12 h-12 text-[8px]" : "w-16 h-16 text-[10px]",
        "sm:w-12 sm:h-12 sm:text-[8px] md:w-16 md:h-16 md:text-[10px]",
        selected ? "ring-2 ring-blue-500" : "",
        isEmpty ? "bg-gray-100" : "bg-blue-100",
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-50 transition-opacity",
          isEmpty ? "bg-gray-200" : `bg-${color}-200`,
        )}
      />
      <div className="relative z-10 p-1 flex flex-col h-full justify-between">
        <span className="font-medium truncate">{voxel.id}</span>
        {!isEmpty && (
          <>
            <span className="truncate">{content[0].item.name}</span>
            <span className="text-[8px]">Кол: {content[0].quantity}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

interface WarehouseVizProps {
  items: Item[];
  selectedVoxel: string | null;
  onSelectVoxel: (id: string) => void;
  onUpdateLocationQty: (itemId: string, voxelId: string, quantity: number, isGameAction?: boolean) => void;
  gameMode: "offload" | "onload" | null;
  onPlateClick: (voxelId: string) => void;
}

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocationQty, gameMode, onPlateClick }: WarehouseVizProps) {
  return (
    <div className="w-full grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 p-2 touch-pan-y">
      {VOXELS.map((voxel) => (
        <Plate
          key={voxel.id}
          voxel={voxel}
          items={items}
          selected={selectedVoxel === voxel.id}
          onSelect={onSelectVoxel}
          onClick={onPlateClick}
          gameMode={gameMode}
        />
      ))}
    </div>
  );
}