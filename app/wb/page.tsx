// /app/wb/page.tsx
"use client";

import { useState, useEffect } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getWarehouseItems, updateItemLocation } from "@/app/wb/actions";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";
type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  voxel: string | null;
  season?: 'leto' | 'zima' | null;
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3';
};

// Хардкод дефолтных items, синхронизирован с wb_seed.sql
const DEFAULT_ITEMS: Item[] = [
  // Евро (бежевый, 180x220, лето/зима, все узоры)
  { id: 'evro-leto-kruzheva', name: 'Евро Лето Кружева', description: 'Бежевая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-kruzheva.jpg`, voxel: 'A1', season: 'leto', pattern: 'kruzheva' },
  { id: 'evro-zima-kruzheva', name: 'Евро Зима Кружева', description: 'Бежевая, полузакрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-kruzheva.jpg`, voxel: 'A1', season: 'zima', pattern: 'kruzheva' },
  { id: 'evro-leto-mirodel', name: 'Евро Лето Миродель', description: 'Бежевая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-mirodel.jpg`, voxel: 'A1', season: 'leto', pattern: 'mirodel' },
  { id: 'evro-zima-mirodel', name: 'Евро Зима Миродель', description: 'Бежевая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-mirodel.jpg`, voxel: 'A1', season: 'zima', pattern: 'mirodel' },
  { id: 'evro-leto-ogurtsy', name: 'Евро Лето Огурцы', description: 'Бежевая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-ogurtsy.jpg`, voxel: 'A1', season: 'leto', pattern: 'ogurtsy' },
  { id: 'evro-zima-ogurtsy', name: 'Евро Зима Огурцы', description: 'Бежевая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-ogurtsy.jpg`, voxel: 'A1', season: 'zima', pattern: 'ogurtsy' },
  { id: 'evro-leto-flora1', name: 'Евро Лето Флора 1', description: 'Бежевая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-flora1.jpg`, voxel: 'A1', season: 'leto', pattern: 'flora1' },
  { id: 'evro-zima-flora1', name: 'Евро Зима Флора 1', description: 'Бежевая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-flora1.jpg`, voxel: 'A1', season: 'zima', pattern: 'flora1' },
  { id: 'evro-leto-flora2', name: 'Евро Лето Флора 2', description: 'Бежевая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-flora2.jpg`, voxel: 'A1', season: 'leto', pattern: 'flora2' },
  { id: 'evro-zima-flora2', name: 'Евро Зима Флора 2', description: 'Бежевая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-flora2.jpg`, voxel: 'A1', season: 'zima', pattern: 'flora2' },
  { id: 'evro-leto-flora3', name: 'Евро Лето Флора 3', description: 'Бежевая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-flora3.jpg`, voxel: 'A1', season: 'leto', pattern: 'flora3' },
  { id: 'evro-zima-flora3', name: 'Евро Зима Флора 3', description: 'Бежевая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-zima-flora3.jpg`, voxel: 'A1', season: 'zima', pattern: 'flora3' },

  // Двушки (голубой, 200x220, лето/зима, все узоры)
  { id: 'dvushka-leto-kruzheva', name: 'Двушка Лето Кружева', description: 'Голубая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-kruzheva.jpg`, voxel: 'A2', season: 'leto', pattern: 'kruzheva' },
  { id: 'dvushka-zima-kruzheva', name: 'Двушка Зима Кружева', description: 'Голубая, полузакрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-kruzheva.jpg`, voxel: 'A2', season: 'zima', pattern: 'kruzheva' },
  { id: 'dvushka-leto-mirodel', name: 'Двушка Лето Миродель', description: 'Голубая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-mirodel.jpg`, voxel: 'A2', season: 'leto', pattern: 'mirodel' },
  { id: 'dvushka-zima-mirodel', name: 'Двушка Зима Миродель', description: 'Голубая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-mirodel.jpg`, voxel: 'A2', season: 'zima', pattern: 'mirodel' },
  { id: 'dvushka-leto-ogurtsy', name: 'Двушка Лето Огурцы', description: 'Голубая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-ogurtsy.jpg`, voxel: 'A2', season: 'leto', pattern: 'ogurtsy' },
  { id: 'dvushka-zima-ogurtsy', name: 'Двушка Зима Огурцы', description: 'Голубая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-ogurtsy.jpg`, voxel: 'A2', season: 'zima', pattern: 'ogurtsy' },
  { id: 'dvushka-leto-flora1', name: 'Двушка Лето Флора 1', description: 'Голубая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-flora1.jpg`, voxel: 'A2', season: 'leto', pattern: 'flora1' },
  { id: 'dvushka-zima-flora1', name: 'Двушка Зима Флора 1', description: 'Голубая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-flora1.jpg`, voxel: 'A2', season: 'zima', pattern: 'flora1' },
  { id: 'dvushka-leto-flora2', name: 'Двушка Лето Флора 2', description: 'Голубая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-flora2.jpg`, voxel: 'A2', season: 'leto', pattern: 'flora2' },
  { id: 'dvushka-zima-flora2', name: 'Двушка Зима Флора 2', description: 'Голубая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-flora2.jpg`, voxel: 'A2', season: 'zima', pattern: 'flora2' },
  { id: 'dvushka-leto-flora3', name: 'Двушка Лето Флора 3', description: 'Голубая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-leto-flora3.jpg`, voxel: 'A2', season: 'leto', pattern: 'flora3' },
  { id: 'dvushka-zima-flora3', name: 'Двушка Зима Флора 3', description: 'Голубая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/dvushka-zima-flora3.jpg`, voxel: 'A2', season: 'zima', pattern: 'flora3' },

  // Евро Макси (красный, 220x240, лето/зима, все узоры)
  { id: 'evro-maksi-leto-kruzheva', name: 'Евро Макси Лето Кружева', description: 'Красная, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-kruzheva.jpg`, voxel: 'A3', season: 'leto', pattern: 'kruzheva' },
  { id: 'evro-maksi-zima-kruzheva', name: 'Евро Макси Зима Кружева', description: 'Красная, полузакрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-kruzheva.jpg`, voxel: 'A3', season: 'zima', pattern: 'kruzheva' },
  { id: 'evro-maksi-leto-mirodel', name: 'Евро Макси Лето Миродель', description: 'Красная, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-mirodel.jpg`, voxel: 'A3', season: 'leto', pattern: 'mirodel' },
  { id: 'evro-maksi-zima-mirodel', name: 'Евро Макси Зима Миродель', description: 'Красная, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-mirodel.jpg`, voxel: 'A3', season: 'zima', pattern: 'mirodel' },
  { id: 'evro-maksi-leto-ogurtsy', name: 'Евро Макси Лето Огурцы', description: 'Красная, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-ogurtsy.jpg`, voxel: 'A3', season: 'leto', pattern: 'ogurtsy' },
  { id: 'evro-maksi-zima-ogurtsy', name: 'Евро Макси Зима Огурцы', description: 'Красная, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-ogurtsy.jpg`, voxel: 'A3', season: 'zima', pattern: 'ogurtsy' },
  { id: 'evro-maksi-leto-flora1', name: 'Евро Макси Лето Флора 1', description: 'Красная, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-flora1.jpg`, voxel: 'A3', season: 'leto', pattern: 'flora1' },
  { id: 'evro-maksi-zima-flora1', name: 'Евро Макси Зима Флора 1', description: 'Красная, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-flora1.jpg`, voxel: 'A3', season: 'zima', pattern: 'flora1' },
  { id: 'evro-maksi-leto-flora2', name: 'Евро Макси Лето Флора 2', description: 'Красная, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-flora2.jpg`, voxel: 'A3', season: 'leto', pattern: 'flora2' },
  { id: 'evro-maksi-zima-flora2', name: 'Евро Макси Зима Флора 2', description: 'Красная, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-flora2.jpg`, voxel: 'A3', season: 'zima', pattern: 'flora2' },
  { id: 'evro-maksi-leto-flora3', name: 'Евро Макси Лето Флора 3', description: 'Красная, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-leto-flora3.jpg`, voxel: 'A3', season: 'leto', pattern: 'flora3' },
  { id: 'evro-maksi-zima-flora3', name: 'Евро Макси Зима Флора 3', description: 'Красная, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-maksi-zima-flora3.jpg`, voxel: 'A3', season: 'zima', pattern: 'flora3' },

  // Матрасники (салатовый для 90/120/140, темно-зеленый для 160/180/200, только кружева, без сезона)
  { id: 'matrasnik-90-kruzheva', name: 'Матрасник 90 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-90-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-120-kruzheva', name: 'Матрасник 120 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-120-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-140-kruzheva', name: 'Матрасник 140 Кружева', description: 'Салатовый, маленький', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-140-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-160-kruzheva', name: 'Матрасник 160 Кружева', description: 'Темно-зеленый, большой', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-160-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-180-kruzheva', name: 'Матрасник 180 Кружева', description: 'Темно-зеленый, большой', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-180-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },
  { id: 'matrasnik-200-kruzheva', name: 'Матрасник 200 Кружева', description: 'Темно-зеленый, большой', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/matrasnik-200-kruzheva.jpg`, voxel: 'A4', season: null, pattern: 'kruzheva' },

  // Полуторки (серый, 150x200, лето/зима, все узоры)
  { id: 'polutorka-leto-kruzheva', name: 'Полуторка Лето Кружева', description: 'Серая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-kruzheva.jpg`, voxel: 'B1', season: 'leto', pattern: 'kruzheva' },
  { id: 'polutorka-zima-kruzheva', name: 'Полуторка Зима Кружева', description: 'Серая, полузакрытая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-kruzheva.jpg`, voxel: 'B1', season: 'zima', pattern: 'kruzheva' },
  { id: 'polutorka-leto-mirodel', name: 'Полуторка Лето Миродель', description: 'Серая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-mirodel.jpg`, voxel: 'B1', season: 'leto', pattern: 'mirodel' },
  { id: 'polutorka-zima-mirodel', name: 'Полуторка Зима Миродель', description: 'Серая, фиолетовый узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-mirodel.jpg`, voxel: 'B1', season: 'zima', pattern: 'mirodel' },
  { id: 'polutorka-leto-ogurtsy', name: 'Полуторка Лето Огурцы', description: 'Серая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-ogurtsy.jpg`, voxel: 'B1', season: 'leto', pattern: 'ogurtsy' },
  { id: 'polutorka-zima-ogurtsy', name: 'Полуторка Зима Огурцы', description: 'Серая, фрактальный узор', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-ogurtsy.jpg`, voxel: 'B1', season: 'zima', pattern: 'ogurtsy' },
  { id: 'polutorka-leto-flora1', name: 'Полуторка Лето Флора 1', description: 'Серая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-flora1.jpg`, voxel: 'B1', season: 'leto', pattern: 'flora1' },
  { id: 'polutorka-zima-flora1', name: 'Полуторка Зима Флора 1', description: 'Серая, маленькие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-flora1.jpg`, voxel: 'B1', season: 'zima', pattern: 'flora1' },
  { id: 'polutorka-leto-flora2', name: 'Полуторка Лето Флора 2', description: 'Серая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-flora2.jpg`, voxel: 'B1', season: 'leto', pattern: 'flora2' },
  { id: 'polutorka-zima-flora2', name: 'Полуторка Зима Флора 2', description: 'Серая, средние цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-flora2.jpg`, voxel: 'B1', season: 'zima', pattern: 'flora2' },
  { id: 'polutorka-leto-flora3', name: 'Полуторка Лето Флора 3', description: 'Серая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-leto-flora3.jpg`, voxel: 'B1', season: 'leto', pattern: 'flora3' },
  { id: 'polutorka-zima-flora3', name: 'Полуторка Зима Флора 3', description: 'Серая, большие цветочки', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/polutorka-zima-flora3.jpg`, voxel: 'B1', season: 'zima', pattern: 'flora3' },
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
          onSelectVoxel={handleSelectVoxel} 
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
                    <p className="text-sm">{item.description} ({item.season || 'без сезона'}, {item.pattern || 'без узора'})</p>
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