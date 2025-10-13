"use client"
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common";
import { COLOR_MAP } from "@/app/wb/common";

/**
 * Ultra-ultra-compact WarehouseViz (defensive)
 */

const baseBgForColor = (color?: string) => {
  if (!color) return "bg-gray-200";
  return COLOR_MAP?.[color] || "bg-gray-200";
};

const seasonClassFor = (season?: string) => {
  if (!season) return "";
  const s = String(season).toLowerCase();
  if (s.includes("з") || s.includes("z")) return "filter brightness-75";
  if (s.includes("л") || s.includes("l")) return "filter brightness-105";
  return "";
};

const extractModelMake = (item: any) => {
  const model = item?.model || item?.size || null;
  const make = item?.make || null;
  if (model && make) return { model: String(model), make: String(make) };

  const name = (item?.name || "").trim();
  if (!name) return { model: "", make: "" };
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return { model: parts[0], make: "" };
  const possibleModel = parts[parts.length - 1];
  const possibleMake = parts.slice(0, parts.length - 1).join(" ");
  return { model: String(possibleModel), make: String(possibleMake) };
};

export function WarehouseViz(props: WarehouseVizProps) {
  // safe guards
  const { items, selectedVoxel, onSelectVoxel, onPlateClick } = props;
  const safeItems = Array.isArray(items) ? items : [];
  const safeVoxels = Array.isArray(VOXELS) ? VOXELS : [];

  return (
    <div className="grid grid-cols-4 gap-0 p-0">
      {safeVoxels.map((voxel) => {
        const content = safeItems.flatMap((i) => {
          const locs = Array.isArray(i?.locations) ? i.locations : [];
          return locs
            .filter((l: any) => (Number(l?.quantity || 0) > 0) && (l?.voxel === voxel?.id))
            .map((l: any) => ({ item: i, quantity: Number(l.quantity || 0) }));
        });

        const isEmpty = content.length === 0;
        const firstColor = content[0]?.item?.color;
        const bgClass = isEmpty ? "bg-gray-100" : baseBgForColor(firstColor);

        return (
          <motion.div
            key={voxel?.id ?? Math.random()}
            role="button"
            aria-label={`Ячейка ${voxel?.id ?? "?"}`}
            onClick={() => {
              if (typeof onSelectVoxel === "function") onSelectVoxel(voxel?.id);
              if (typeof onPlateClick === "function") onPlateClick(voxel?.id);
            }}
            whileTap={{ scale: 0.985 }}
            className={cn(
              "rounded-none border border-gray-300 select-none cursor-pointer flex flex-col",
              selectedVoxel === voxel?.id ? "border-blue-400/80 bg-blue-50" : "",
              bgClass,
              "min-h-[44px] max-h-[180px] overflow-hidden"
            )}
          >
            <div className="flex items-center justify-between px-1 py-[3px]">
              <div className="text-[9px] md:text-[11px] font-semibold leading-none">{voxel?.id ?? "?"}</div>
              {!isEmpty && (
                <div className="text-[9px] md:text-[11px] opacity-80 leading-none">{content.reduce((s, c) => s + (c.quantity || 0), 0)}</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {isEmpty ? (
                <div className="flex items-center justify-center text-[9px] opacity-60 h-8">пусто</div>
              ) : (
                content.map(({ item, quantity }, idx) => {
                  const colorClass = baseBgForColor(item?.color);
                  const seasonCls = seasonClassFor(item?.season as any);
                  const { model, make } = extractModelMake(item || {});

                  return (
                    <div
                      key={item?.id ?? idx}
                      className="flex items-center gap-1 px-1"
                      title={`${model}${make ? ` · ${make}` : ""} — ${quantity} шт`}
                      style={{ minHeight: 16 }}
                    >
                      <div className={cn("w-3 h-3 rounded-sm shrink-0", colorClass, seasonCls)} />

                      <div className="flex-1 min-w-0">
                        <div className="text-[7px] md:text-[10px] leading-tight font-semibold truncate">
                          {model || item?.name || "—"}
                        </div>
                        <div className="text-[6px] md:text-[9px] leading-tight opacity-70 truncate">
                          {make || ""}
                        </div>
                      </div>

                      <div className="ml-1">
                        <div className="inline-flex items-center justify-center px-1 py-[2px] rounded-full text-[8px] md:text-[10px] font-semibold bg-black/20 text-white">
                          {quantity}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default WarehouseViz;