"use client"
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common";
import { COLOR_MAP } from "@/app/wb/common";

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, gameMode, onPlateClick }: WarehouseVizProps) {
  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {VOXELS.map((voxel) => {
        // Только локации с quantity > 0 и только для данной ячейки
        const content = items
          .flatMap((i) =>
            (i.locations || [])
              .filter((l: any) => (l.quantity || 0) > 0 && l.voxel === voxel.id)
              .map((l: any) => ({ item: i, quantity: l.quantity }))
          );

        const isEmpty = content.length === 0;
        const colorClass = content[0]?.item?.color ? (COLOR_MAP[content[0].item.color] || "bg-gray-200") : "bg-gray-200";

        return (
          <motion.div
            key={voxel.id}
            onClick={() => {
              onSelectVoxel(voxel.id);
              onPlateClick(voxel.id);
            }}
            className={cn(
              "rounded-md border p-1 text-center cursor-pointer select-none",
              selectedVoxel === voxel.id ? "border-blue-500 bg-blue-100" : "border-gray-300",
              isEmpty ? "bg-gray-100" : colorClass,
              "text-sm",
            )}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="font-bold">{voxel.id}</div>
            {!isEmpty && (
              <div className="space-y-1 mt-1">
                {content.map(({ item, quantity }, idx) => (
                  <div key={idx} className="truncate text-[12px]">
                    {item.name}: {quantity}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}