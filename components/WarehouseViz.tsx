"use client"
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common";
import { COLOR_MAP } from "@/app/wb/common";

/**
 * Ultra-compact WarehouseViz (mobile-first)
 * - Mobile: tiny squares + very small 'model' text below (priority), 'make' optional
 * - Tablet+ (md): slightly bigger text showing "model · make"
 * - No hover, minimal tap animation
 * - Shows only locations with quantity > 0
 */

// Получаем базовый класс фона по цвету, fallback
const baseBgForColor = (color?: string) => {
  if (!color) return "bg-gray-200";
  return COLOR_MAP[color] || "bg-gray-200";
};

// Сезонные корректировки (просто яркость)
const seasonClassFor = (season?: string) => {
  if (!season) return "";
  if (season === "зима" || season.toLowerCase().includes("z")) {
    return "filter brightness-75";
  }
  if (season === "лето" || season.toLowerCase().includes("l")) {
    return "filter brightness-105";
  }
  return "";
};

// Попытка извлечь model / make (model в приоритете)
const extractModelMake = (item: any) => {
  // предпочитаем явные поля
  const model = item.model || item.size || null;
  const make = item.make || null;

  if (model && make) return { model: String(model), make: String(make) };

  // если нет — парсим item.name. В исходных данных name может быть "Make Model" или "Make Model..."
  const name = (item.name || "").trim();
  if (!name) return { model: "", make: "" };

  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return { model: parts[0], make: "" };

  // предположение: имя было "Make Model" => модель — последний токен
  const possibleModel = parts[parts.length - 1];
  const possibleMake = parts.slice(0, parts.length - 1).join(" ");
  return { model: String(possibleModel), make: String(possibleMake) };
};

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, gameMode, onPlateClick }: WarehouseVizProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1 p-1">
      {VOXELS.map((voxel) => {
        // Контент: только non-zero для этой ячейки
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
            role="button"
            aria-label={`Ячейка ${voxel.id}`}
            onClick={() => {
              onSelectVoxel(voxel.id);
              onPlateClick(voxel.id);
            }}
            whileTap={{ scale: 0.985 }}
            className={cn(
              "rounded-md border p-1 select-none cursor-pointer flex flex-col",
              selectedVoxel === voxel.id ? "border-blue-400/80 bg-blue-50" : "border-gray-300",
              bgClass,
              // компактные размеры: минимальная высота, максимум контролируемый
              "min-h-[48px] max-h-[180px] overflow-hidden"
            )}
          >
            {/* header: voxel id + total qty (минималистично) */}
            <div className="flex items-center justify-between px-1">
              <div className="text-[10px] font-semibold leading-none">{voxel.id}</div>
              {!isEmpty && (
                <div className="text-[10px] opacity-80 leading-none">{content.reduce((s, c) => s + (c.quantity || 0), 0)}</div>
              )}
            </div>

            {/* body: вертикальный список компактных строк — каждая строка минимальна */}
            <div className="mt-1 flex-1 overflow-y-auto pr-1 space-y-1">
              {isEmpty ? (
                <div className="flex items-center justify-center text-[10px] opacity-60 h-8">пусто</div>
              ) : (
                content.map(({ item, quantity }, idx) => {
                  const colorClass = baseBgForColor(item.color);
                  const seasonCls = seasonClassFor(item.season as any);
                  const { model, make } = extractModelMake(item);

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-1"
                      title={`${model}${make ? ` · ${make}` : ""} — ${quantity} шт${item.pattern ? ` · ${item.pattern}` : ""}`}
                      style={{ minHeight: 18 }}
                    >
                      {/* маленький цветной квадратик */}
                      <div className={cn("w-3 h-3 rounded-sm shrink-0", colorClass, seasonCls)} />

                      {/* текст: на мобайле очень-очень маленький, на tablet+ чуть крупнее */}
                      <div className="flex-1 min-w-0">
                        {/* model — приоритет, очень маленький на мобиле */}
                        <div className="text-[8px] md:text-[11px] leading-tight font-semibold truncate">
                          {model || item.name || "—"}
                        </div>
                        {/* make — показываем только если есть; ещё мельче на мобиле, видимо не всегда нужно */}
                        <div className="text-[7px] md:text-[10px] leading-tight opacity-70 truncate">
                          {make || ""}
                        </div>
                      </div>

                      {/* qty badge (очень компактная) */}
                      <div className="ml-1">
                        <div className="inline-flex items-center justify-center px-1 py-[2px] rounded-full text-[9px] font-semibold bg-black/20 text-white">
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