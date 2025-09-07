"use client";

import { VOXELS, WarehouseVizProps, Item, Content } from "@/app/wb/common";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";

export function WarehouseViz({ items, selectedVoxel, onSelectVoxel, onUpdateLocationQty, gameMode, onPlateClick }: WarehouseVizProps) {
  const getVoxelContent = (voxelId: string): Content[] => {
    return items
      .flatMap((item: Item) =>
        item.locations
          .filter((loc) => loc.voxel === voxelId)
          .map((loc) => ({
            item,
            local_quantity: loc.quantity,
          })),
      )
      .slice(0, 3);
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-2">
      {["A", "B"].map((shelf) => (
        <div key={shelf} className="border rounded-lg p-2 bg-gray-50">
          <h2 className="font-semibold text-sm mb-2">Полка {shelf}</h2>
          <div className="grid grid-cols-4 gap-1">
            {VOXELS.filter((v) => v.id.startsWith(shelf)).map((voxel) => {
              const contents = getVoxelContent(voxel.id);
              const isSelected = selectedVoxel === voxel.id;
              return (
                <div
                  key={voxel.id}
                  onClick={() => {
                    onSelectVoxel(voxel.id);
                    if (gameMode) onPlateClick(voxel.id);
                  }}
                  className={cn(
                    "relative border rounded-md p-1 cursor-pointer overflow-hidden",
                    gameMode ? "w-16 h-16 text-[10px]" : "w-20 h-20 text-xs",
                    isSelected ? "border-blue-500 bg-blue-50" : "border-gray-300",
                    "hover:bg-gray-100 transition-colors",
                    "sm:w-16 sm:h-16 sm:text-[10px]", // Медиа-запрос для мобильных
                  )}
                >
                  <div className="absolute top-0 left-0 p-1 font-medium z-10">{voxel.label}</div>
                  {contents.length > 0 ? (
                    contents.map((content, idx) => (
                      <div key={idx} className="relative mt-4">
                        {content.item.image && (
                          <Image
                            src={content.item.image}
                            alt=""
                            fill
                            className="object-cover opacity-60"
                          />
                        )}
                        <div
                          className={cn(
                            "absolute inset-0 opacity-50",
                            content.item.color ? content.item.color : "bg-gray-200",
                          )}
                        />
                        <div className="relative z-10">
                          <p className="font-semibold truncate">{content.item.name}</p>
                          <p className="text-gray-600">Кол: {content.local_quantity}</p>
                          {gameMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateLocationQty(
                                  content.item.id,
                                  voxel.id,
                                  content.local_quantity + (gameMode === "onload" ? 1 : -1),
                                );
                              }}
                              className={cn(
                                "mt-1 px-1 py-0.5 rounded text-white text-[8px]",
                                gameMode === "onload" ? "bg-green-500" : "bg-red-500",
                              )}
                            >
                              <VibeContentRenderer
                                content={gameMode === "onload" ? "::FaPlus::" : "::FaMinus::"}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Пусто
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}