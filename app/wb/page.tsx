"use client";

import { useState, useEffect } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getWarehouseItems, updateItemLocation } from "@/app/wb/actions";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";

// Хардкод дефолтных items, подогнанный под транскрипт
const DEFAULT_ITEMS: Item[] = [
  // Евро (бежевый, leto/zima)
  { id: 'evro-leto-kruzheva', name: 'Евро Лето Кружева', description: 'Бежевая, полосочка, закрытая пачка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-kruzheva.jpg`, voxel: 'A1', season: 'leto', pattern: 'kruzheva' },
  { id: 'evro-zima-kruzheva', name: 'Евро Зима Кружева', description: 'Бежевая, полузакрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-kruzheva.jpg`, voxel: 'A1', season: 'zima', pattern: 'kruzheva' },
  { id: 'evro-leto-mirodel', name: 'Евро Лето Миродель', description: 'Бежевая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-mirodel.jpg`, voxel: 'A1', season: 'leto', pattern: 'mirodel' },
  // ... аналогично для ogurtsy, flora1/2/3 (добавить все комбинации leto/zima)

  // Двушки (голубой, 200см)
  { id: 'dvushka-leto-kruzheva', name: 'Двушка Лето Кружева', description: 'Голубая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-kruzheva.jpg`, voxel: 'A2', season: 'leto', pattern: 'kruzheva' },
  { id: 'dvushka-zima-kruzheva', name: 'Двушка Зима Кружева', description: 'Голубая, закрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-kruzheva.jpg`, voxel: 'A2', season: 'zima', pattern: 'kruzheva' },
  // ... для mirodell, ogurtsy, flora

  // Евро Макси (красный)
  { id: 'evro-maksi-leto-kruzheva', name: 'Евро Макси Лето Кружева', description: 'Красная, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-kruzheva.jpg`, voxel: 'A3', season: 'leto', pattern: 'kruzheva' },
  // ... все вариации

  // Матрасники (салатовый маленькие 90/120/140, темно-зеленый большие 160/180/200, только кружева)
  { id: 'matrasnik-90-kruzheva', name: 'Матрасник 90 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-90-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-120-kruzheva', name: 'Матрасник 120 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-120-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-140-kruzheva', name: 'Матрасник 140 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-140-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-160-kruzheva', name: 'Матрасник 160 Кружева', description: 'Темно-зеленый, большой', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-160-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  // 180,200 аналогично

  // Полуторки (серый, 150см, leto/zima, все узоры)
  { id: 'polutorka-leto-kruzheva', name: 'Полуторка Лето Кружева', description: 'Серая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-kruzheva.jpg`, voxel: 'B1', season: 'leto', pattern: 'kruzheva' },
  { id: 'polutorka-zima-kruzheva', name: 'Полуторка Зима Кружева', description: 'Серая, закрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-kruzheva.jpg`, voxel: 'B1', season: 'zima', pattern: 'kruzheva' },
  // ... для mirodell, ogurtsy, flora, все leto/zima
];

export default function WBPage() {
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadItems() {
      const { success, data, error } = await getWarehouseItems();
      if (success && data) {
        setItems(data.map(item => ({
          id: item.id,
          name: `${item.make} ${item.model}`,
          description: item.description || '',
          image: item.image_url || '',
          voxel: item.specs?.warehouse_location?.voxel_id || null,
          season: item.specs?.season,
          pattern: item.specs?.pattern,
        })));
      } else {
        toast.error(error || "Ошибка загрузки товаров");
      }
      setLoading(false);
    }
    loadItems();
  }, []);

  const handleSelectVoxel = (id: string) => {
    setSelectedVoxel(id);
    const item = items.find(i => i.voxel === id);
    setSelectedItemId(item?.id || null);
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const item = items.find(i => i.id === id);
    setSelectedVoxel(item?.voxel || null);
  };

  const handleUpdateLocation = async (itemId: string, voxelId: string) => {
    const { success, error } = await updateItemLocation(itemId, voxelId);
    if (success) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, voxel: voxelId } : i));
      toast.success("Локация обновлена");
    } else {
      toast.error(error);
    }
  };

  if (loading) return <Loading text="Загрузка склада..." />;

  return (
    <div className="min-h-screen pt-24 bg-background flex flex-col md:flex-row">
      <div className="w-full md:w-1/2 h-[50vh] md:h-auto overflow-auto p-4">
        <WarehouseViz 
          items={items} 
          selectedVoxel={selectedVoxel} 
          onSelectVoxel={setSelectedVoxel} // Исправил onSelectVoxel
          onUpdateLocation={handleUpdateLocation} 
        />
      </div>
      <div className="w-full md:w-1/2 overflow-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Список Товаров</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map(item => (
              <Card key={item.id} className={cn("cursor-pointer transition-all", selectedItemId === item.id && "border-primary shadow-lg")}>
                <CardContent className="flex items-center gap-4" onClick={() => handleSelectItem(item.id)}>
                  <Image src={item.image} alt={item.name} width={50} height={50} className="rounded" />
                  <div>
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="text-sm">{item.description} ({item.season}, {item.pattern || 'нет'})</p>
                    <p className="text-xs text-muted-foreground">Локация: {item.voxel || 'Не назначена'}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}