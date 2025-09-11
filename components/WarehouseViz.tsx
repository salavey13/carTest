"use client"
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { WarehouseVizProps } from "@/app/wb/common";
import { VOXELS } from "@/app/wb/common";
import { COLOR_MAP } from "@/app/wb/common";

/**
 * Улучшенный WarehouseViz:
 * - не показывает нулевые позиции
 * - рендерит по-item блоки внутри ячейки
 * - цвет базируется на COLOR_MAP, для сезона добавляем визуальную модификацию:
 *    - "зима" — затемнение (darker)
 *    - "лето" — подсветка (brighter)
 * - если в ячейке много товаров — показываем первые 3 + "+N"
 * - у каждого айтема: цветной квадратик, читабельный текст, бейдж с количеством
 * - тултип (title) с полным названием и деталями
 */

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, gameMode, onPlateClick }: WarehouseVizProps) {
  // helper: берет bg-класс из COLOR_MAP или возвращает дефолт
  const baseBgForColor = (color?: string) => {
    if (!color) return "bg-gray-200";
    return COLOR_MAP[color] || "bg-gray-200";
  };

  // helper: сезонная модификация стиля (строки классов)
  const seasonClassFor = (season?: string) => {
    if (!season) return "";
    // 'зима' -> чуть темнее, 'лето' -> чуть ярче
    // используем CSS utility classes: filter/brightness, ring для контраста
    if (season === "зима" || season === "зima" /* защищаем от опечаток */) {
      return "filter brightness-75 ring-1 ring-slate-700/30";
    }
    if (season === "лето" || season === "leto") {
      return "filter brightness-110 ring-1 ring-yellow-400/20";
    }
    return "";
  };

  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {VOXELS.map((voxel) => {
        // собираем контент только с quantity > 0 и для этой ячейки
        const content = items
          .flatMap((i) =>
            (i.locations || [])
              .filter((l: any) => (l.quantity || 0) > 0 && l.voxel === voxel.id)
              .map((l: any) => ({ item: i, quantity: l.quantity }))
          );

        const isEmpty = content.length === 0;

        // если пусто — базовый класс
        const firstColor = content[0]?.item?.color;
        const baseColorClass = isEmpty ? "bg-gray-100" : baseBgForColor(firstColor);

        return (
          <motion.div
            key={voxel.id}
            onClick={() => {
              onSelectVoxel(voxel.id);
              onPlateClick(voxel.id);
            }}
            className={cn(
              "rounded-md border p-2 text-left cursor-pointer select-none flex flex-col",
              selectedVoxel === voxel.id ? "border-blue-500 bg-blue-50" : "border-gray-300",
              isEmpty ? "bg-gray-100" : `${baseColorClass}`,
              "min-h-[64px] max-h-[140px] overflow-hidden"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title={`${voxel.id} — ${isEmpty ? "пусто" : `${content.length} позиций`}`}
          >
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="font-bold text-xs">{voxel.id}</div>
              {!isEmpty && (
                <div className="text-[11px] opacity-80">{content.reduce((acc, c) => acc + (c.quantity || 0), 0)} шт</div>
              )}
            </div>

            {isEmpty ? (
              <div className="text-[11px] text-center opacity-60 mt-4">пусто</div>
            ) : (
              <div className="flex flex-col gap-1">
                {/* Показываем первые 3 айтема, остальные как +N */}
                {content.slice(0, 3).map(({ item, quantity }, idx) => {
                  const colorClass = baseBgForColor(item.color);
                  const seasonCls = seasonClassFor(item.season as any);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1",
                        // делаем фон чуть контрастнее для каждого айтема:
                        "bg-white/10",
                        // добавим тонкую тень/границу чтобы элементы читались на фоне
                        "border border-white/5"
                      )}
                      title={`${item.name} — ${quantity} шт · ${item.season ? `сезон: ${item.season}` : "сезон: N/A"}`}
                    >
                      {/* цветной квадратик + сезонный визуал */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded-sm shrink-0",
                          colorClass,
                          seasonCls
                        )}
                        aria-hidden
                      />
                      {/* текстовое имя (сжатое) */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] truncate font-medium">{item.name}</div>
                        <div className="text-[10px] opacity-70 truncate">
                          {item.size ? item.size + " · " : ""}{item.pattern ? item.pattern + " · " : ""}{item.color || "—"}
                        </div>
                      </div>
                      {/* бейдж количества */}
                      <div className="ml-2">
                        <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/20 text-white">
                          {quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {content.length > 3 && (
                  <div className="text-[11px] opacity-80 mt-1">+{content.length - 3} ещё</div>
                )}

                {/* Если нужно, можно добавить индикаторы min_qty / тревог */}
                <div className="mt-1 flex gap-1 text-[10px] opacity-70">
                  {/* показываем небольшие пиктограммы/подсказки — например min_qty */}
                  {content.some(c => c.item?.locations?.some((l:any)=>l.min_qty)) && (
                    <div className="px-1 py-0.5 rounded bg-yellow-600/10 border border-yellow-600/20">min level</div>
                  )}
                  {/* показываем gameMode */}
                  {gameMode && (
                    <div className="px-1 py-0.5 rounded bg-white/5 border border-white/5">{gameMode === "onload" ? "Приём" : "Выдача"}</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}