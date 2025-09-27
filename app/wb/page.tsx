"use client";

import React, { useEffect, useState, useCallback } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz"; // предполагаем существующий компонент визуализации
import { getWarehouseItems as fetchWarehouseItemsServer, updateItemLocationQty } from "./actions";
import { Item } from "./common";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/hooks/useAppContext";

type LocalItem = {
  id: string;
  name?: string;
  locations: { voxel: string; quantity: number }[];
  total_quantity: number;
};

export default function WbPage() {
  const { user } = useAppContext?.() || { user: null };
  const [items, setItems] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      // Здесь вызов к серверной функции — можно заменить fetch/fetcher
      const res: any = await fetch("/api/wb/get-warehouse-items").then((r) => r.json()); // если есть API route
      if (res?.success && Array.isArray(res.data)) {
        const mapped = res.data.map((i: any) => ({
          id: i.id,
          name: `${i.make || ""} ${i.model || ""}`.trim() || i.id,
          locations: (i.specs?.warehouse_locations || []).map((l: any) => ({ voxel: l.voxel_id, quantity: l.quantity || 0 })),
          total_quantity: ((i.specs?.warehouse_locations || []).reduce((s: number, l: any) => s + (l.quantity || 0), 0) || 0),
        }));
        setItems(mapped);
      } else {
        toast.error("Не удалось загрузить товары");
      }
    } catch (e: any) {
      console.error("loadItems error:", e);
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  /**
   * optimisticUpdate — применяем локально для snappy UX, затем вызываем server action
   */
  const optimisticUpdate = useCallback(
    async (itemId: string, voxel: string, delta: number) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const locations = (it.locations || []).map((l) => ({ ...l }));
          const loc = locations.find((l) => l.voxel === voxel);
          if (loc) {
            loc.quantity = Math.max(0, (loc.quantity || 0) + delta);
          } else if (delta > 0) {
            locations.push({ voxel, quantity: delta });
          }
          const total_quantity = locations.reduce((s, l) => s + (l.quantity || 0), 0);
          return { ...it, locations, total_quantity };
        })
      );

      // fire-and-forget update on server, but log on error
      try {
        const resp = await fetch("/api/wb/update-location-qty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, voxelId: voxel, delta }),
        }).then((r) => r.json());

        if (!resp?.success) {
          console.error("Server update failed:", resp);
          toast.error("Серверная синхронизация не удалась");
          // reload to be safe
          loadItems();
        }
      } catch (e: any) {
        console.error("optimisticUpdate error:", e);
        toast.error("Ошибка синхронизации");
        loadItems();
      }
    },
    [setItems]
  );

  /**
   * Основная логика клика по карточке в режиме onload/offload.
   * Исправлена логика: если выбранная ячейка пуста, но у товара есть ровно одна ячейка с товарами,
   * то списать из неё (без error-toast). Если несколько ячеек — требуем явного выбора.
   */
  const handleItemClick = useCallback(
    async (item: LocalItem, gameMode: "onload" | "offload" | null) => {
      if (!gameMode) {
        toast("Выберите режим: onload / offload");
        return;
      }

      if (gameMode === "onload") {
        // Обычно onload добавляет в выбранную ячейку (или требует выбора)
        const voxel = selectedVoxel;
        if (!voxel) {
          toast.error("Выберите ячейку для загрузки");
          return;
        }
        optimisticUpdate(item.id, voxel, +1);
        toast.success(`Положил в ${voxel}`);
        return;
      }

      // OFFLOAD flow
      if (gameMode === "offload") {
        let loc = null as Maybe<{ voxel: string; quantity: number }>;

        if (selectedVoxel) {
          // попытка списать из выбранной ячейки, если там есть qty>0
          loc = item.locations.find((l) => l.voxel === selectedVoxel && (l.quantity || 0) > 0) || null;

          // NEW: если выбранная ячейка пуста, но у товара ровно одна ячейка с >0 — используем её
          if (!loc) {
            const nonEmpty = (item.locations || []).filter((l) => (l.quantity || 0) > 0);
            if (nonEmpty.length === 1) {
              loc = nonEmpty[0];
              toast.info(`В выбранной ячейке нет товара — списываю из ${loc.voxel} (единственная ячейка с товаром).`);
            } else {
              // множественные ячейки или ни одной — показываем ошибку
              return toast.error("Нет товара в выбранной ячейке");
            }
          }
        } else {
          // Если никакая ячейка не выбрана — в старом поведении выбирался самый полный
          const nonEmpty = (item.locations || []).filter((l) => (l.quantity || 0) > 0);
          if (nonEmpty.length === 0) return toast.error("Нет товара на складе");
          // На случай, если только одна — списываем из неё. Если много — берем самую большую (как fallback).
          loc = nonEmpty.length === 1 ? nonEmpty[0] : nonEmpty.sort((a, b) => (b.quantity || 0) - (a.quantity || 0))[0];
        }

        if (!loc) return toast.error("Нет доступных ячеек для списания");

        // Выполняем optimistic update и отправляем action
        optimisticUpdate(item.id, loc.voxel, -1);
        toast.success(`Списал 1 шт. из ${loc.voxel}`);
        return;
      }
    },
    [selectedVoxel, optimisticUpdate]
  );

  // простая фильтрация
  const visibleItems = items.filter((it) => !query || it.id.includes(query) || (it.name || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-4">
      <h2 className="text-xl mb-4">Склад WB</h2>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Поиск по артикулу или названию" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={() => loadItems()}>Обновить</Button>
      </div>

      <div className="mb-4">
        <strong>Выбрана ячейка:</strong> {selectedVoxel || "—"}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="space-y-2">
            {visibleItems.map((it) => (
              <div key={it.id} className="p-2 border rounded flex items-center justify-between">
                <div>
                  <div className="font-medium">{it.name || it.id}</div>
                  <div className="text-sm text-muted-foreground">Артикул: {it.id} — Всего: {it.total_quantity}</div>
                  <div className="text-xs mt-1">
                    {it.locations.map((l) => (
                      <span key={l.voxel} className="mr-2">
                        {l.voxel}:{l.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleItemClick(it, "offload")}>Offload −1</Button>
                  <Button onClick={() => handleItemClick(it, "onload")}>Onload +1</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <WarehouseViz
            items={visibleItems.map((it) => ({
              id: it.id,
              name: it.name || it.id,
              image: "",
              locations: it.locations.map((l) => ({ voxel: l.voxel, quantity: l.quantity })),
              total_quantity: it.total_quantity,
            }))}
            selectedVoxel={selectedVoxel}
            onSelectVoxel={(id) => setSelectedVoxel(id)}
            onUpdateLocationQty={async (itemId, voxelId, quantity) => {
              // quantity here is delta
              await optimisticUpdate(itemId, voxelId, quantity);
            }}
            gameMode={null}
            onPlateClick={(voxelId) => setSelectedVoxel(voxelId)}
          />
        </div>
      </div>
    </div>
  );
}