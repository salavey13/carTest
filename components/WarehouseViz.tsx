"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common"; // Добавлен импорт VOXELS
import { COLOR_MAP } from "@/app/wb/common";

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, gameMode, onPlateClick }: WarehouseVizProps) {
  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {VOXELS.map((voxel) => {
        const content = items
          .flatMap((i) => i.locations.filter((l) => l.voxel === voxel.id).map((l) => ({ item: i, quantity: l.quantity })));
        const isEmpty = content.length === 0;
        const colorClass = content[0]?.item.color ? COLOR_MAP[content[0].item.color] : "bg-gray-200";

        return (
          <motion.div
            key={voxel.id}
            onClick={() => {
              onSelectVoxel(voxel.id);
              onPlateClick(voxel.id);
            }}
            className={cn(
              "rounded-md border p-1 text-center cursor-pointer",
              selectedVoxel === voxel.id ? "border-blue-500 bg-blue-100" : "border-gray-300",
              isEmpty ? "bg-gray-100" : colorClass,
              gameMode ? "text-xs" : "text-sm",
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="font-bold">{voxel.id}</div>
            {!isEmpty && (
              <>
                <div className="truncate">{content[0].item.name}</div>
                <div>Кол: {content[0].quantity}</div>
              </>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}