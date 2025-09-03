"use client";

import { useState, useEffect } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getWarehouseItems, updateItemLocation } from "@/app/wb/actions";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";

// Хардкод дефолтных items (из компонента)
const DEFAULT_ITEMS = [
  { id: 'leto-odeyalo-120', name: 'Летнее одеяло 120x180', description: 'Маленькая, светло-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-120.jpg`, voxel: 'A1' },
  { id: 'leto-odeyalo-150', name: 'Летнее одеяло 150x200', description: 'Средняя, зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-150.jpg`, voxel: 'A2' },
  { id: 'leto-odeyalo-180', name: 'Летнее одеяло 180x220', description: 'Большая, темно-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-180.jpg`, voxel: 'A3' },
  { id: 'leto-odeyalo-220', name: 'Летнее одеяло 220x240', description: 'Огромная, темно-зеленая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-odeyalo-220.jpg`, voxel: 'A4' },
  { id: 'zima-odeyalo-120', name: 'Зимнее одеяло 120x180', description: 'Маленькая, серая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-120.jpg`, voxel: 'B1' },
  { id: 'zima-odeyalo-150', name: 'Зимнее одеяло 150x200', description: 'Средняя, серая упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-150.jpg`, voxel: 'B2' },
  { id: 'zima-odeyalo-180', name: 'Зимнее одеяло 180x220', description: 'Большая, красная упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-180.jpg`, voxel: 'B3' },
  { id: 'zima-odeyalo-220', name: 'Зимнее одеяло 220x240', description: 'Огромная, красная упаковка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/zima-odeyalo-220.jpg`, voxel: 'B4' },
  // Пододеяльники и наволочки аналогично, добавить если нужно
  { id: 'leto-podot-120', name: 'Летний пододеяльник 120x180', description: 'Маленькая, светло-зеленая', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/leto-podot-120.jpg`, voxel: null },
  // ... остальное
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
                    <p className="text-sm">{item.description}</p>
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