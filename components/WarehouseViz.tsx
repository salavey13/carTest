"use client"
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common";
import { COLOR_MAP } from "@/app/wb/common";

/**
 * Mobile-first compact WarehouseViz
 * - responsive grid (mobile-first)
 * - no hover interactions
 * - show all items in cell (scroll inside cell if many)
 * - very small text for names, compact badges for qty
 * - season visual tweaks applied to color block
 * - plate click: calls onSelectVoxel + onPlateClick (page decides what to do) — no direct qty changes here
 */

function baseBgForColor(color?: string) {
  if (!color) return "bg-gray-200";
  return COLOR_MAP[color] || "bg-gray-200";
}

function seasonClassFor(season?: string) {
  if (!season) return "";
  if (season === "зима" || season === "zima") {
    return "filter brightness-75";
  }
  if (season === "лето" || season === "leto") {
    return "filter brightness-105";
  }
  return "";
}

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, gameMode, onPlateClick }: WarehouseVizProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1 p-1">
      {VOXELS.map((voxel) => {
        const content = items
          .flatMap((i) =>
            (i.locations || [])
              .filter((l: any) => (l.quantity || 0) > 0 && l.voxel === voxel.id)
              .map((l: any) => ({ item: i, quantity: l.quantity }))
          );

        const isEmpty = content.length === 0;
        const firstColor = content[0]?.item?.color;
        const bgClass = isEmpty ? "bg-gray-100" : baseBgForColor(firstColor);

        return (
          <motion.div
            key={voxel.id}
            onClick={() => { onSelectVoxel(voxel.id); onPlateClick(voxel.id); }}
            // only tiny tap animation, no hover
            whileTap={{ scale: 0.985 }}
            className={cn(
              "rounded-md border p-2 text-left cursor-pointer select-none flex flex-col",
              selectedVoxel === voxel.id ? "border-blue-400/80 bg-blue-50" : "border-gray-300",
              bgClass,
              "min-h-[56px] max-h-[160px] overflow-hidden"
            )}
            role="button"
            aria-label={`Ячейка ${voxel.id}`}
          >
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="font-bold text-[11px] leading-tight">{voxel.id}</div>
              {!isEmpty && (
                <div className="text-[11px] opacity-80">{content.reduce((s, c) => s + (c.quantity || 0), 0)} шт</div>
              )}
            </div>

            {isEmpty ? (
              <div className="flex-1 flex items-center justify-center text-[11px] opacity-60">пусто</div>
            ) : (
              // content area: allow vertical scroll for many items
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {content.map(({ item, quantity }, idx) => {
                  const colorClass = baseBgForColor(item.color);
                  const seasonCls = seasonClassFor(item.season as any);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded px-1 py-0.5 bg-white/6 border border-white/5"
                      // prevent excessive height per row
                      style={{ minHeight: 18 }}
                    >
                      <div
                        className={cn("w-4 h-4 rounded-sm shrink-0", colorClass, seasonCls)}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] leading-tight truncate font-medium">{item.name}</div>
                        <div className="text-[8px] opacity-70 truncate">
                          {item.size ? item.size + (item.pattern ? ` · ${item.pattern}` : "") : (item.pattern || item.color || "")}
                        </div>
                      </div>
                      <div className="ml-2">
                        <div className="inline-flex items-center justify-center px-2 py-[2px] rounded-full text-[10px] font-semibold bg-black/20 text-white">
                          {quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export default WarehouseViz;