"use client";

import { useState, useEffect, useMemo } from "react";
import { WarehouseViz } from "@/app/components/WarehouseViz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Image from "next/image";
import { getWarehouseItems, updateItemLocationQty } from "@/app/wb/actions";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Location = {
  voxel: string;
  quantity: number;
};

type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  locations: Location[];
  total_quantity: number;
  season?: 'leto' | 'zima' | null;
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3';
  color: string;
  size: string;
};

// Хардкод дефолтных items обновлен с warehouse_locations array
const DEFAULT_ITEMS: Item[] = [
  // Евро...
  { id: 'evro-leto-kruzheva', name: 'Евро Лето Кружева', description: 'Бежевая, полосочка', image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/evro-leto-kruzheva.jpg`, locations: [{voxel: 'A1', quantity: 5}], total_quantity: 5, season: 'leto', pattern: 'kruzheva', color: 'beige', size: '180x220' },
  // ... все остальные аналогично, с locations: [{voxel: ..., quantity: ...}], total_quantity: quantity
];
export default function WBPage() {
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'voxel'>('name');
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [workflowItems, setWorkflowItems] = useState<{id: string, change: number, voxel?: string}[]>([]);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);
  const [selectedWorkflowVoxel, setSelectedWorkflowVoxel] = useState<string | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<{[key: string]: {locations: Location[]}} | null>(null);

  useEffect(() => {
    async function loadItems() {
      const { success, data, error } = await getWarehouseItems();
      if (success && data) {
        setItems(data.map(item => {
          const locations = item.specs.warehouse_locations || (item.specs.warehouse_location ? [{voxel_id: item.specs.warehouse_location.voxel_id, quantity: item.specs.quantity || 0}] : []);
          const total_quantity = locations.reduce((sum, l) => sum + l.quantity, 0);
          return {
            id: item.id,
            name: `${item.make} ${item.model}`,
            description: item.description || '',
            image: item.image_url || '',
            locations: locations.map(l => ({voxel: l.voxel_id, quantity: l.quantity})),
            total_quantity,
            season: item.specs.season,
            pattern: item.specs.pattern,
            color: item.specs.color,
            size: item.specs.size,
          };
        }));
      } else {
        toast.error(error || "Ошибка загрузки товаров");
      }
      setLoading(false);
      const stored = localStorage.getItem('warehouse_checkpoint');
      if (stored) setLastCheckpoint(JSON.parse(stored));
    }
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    return items
      .filter(i => (!filterSeason || i.season === filterSeason) &&
                   (!filterPattern || i.pattern === filterPattern) &&
                   (!filterColor || i.color === filterColor) &&
                   (!filterSize || i.size === filterSize) &&
                   i.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'quantity') return b.total_quantity - a.total_quantity;
        if (sortBy === 'voxel') return (a.locations[0]?.voxel || '').localeCompare(b.locations[0]?.voxel || '');
        return a.name.localeCompare(b.name);
      });
  }, [items, sortBy, filterSeason, filterPattern, filterColor, filterSize, search]);

  const totals = useMemo(() => {
    return filteredItems.reduce((acc, i) => acc + i.total_quantity, 0);
  }, [filteredItems]);

  const handleSelectVoxel = (id: string) => {
    setSelectedVoxel(id);
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const item = items.find(i => i.id === id);
    if (item?.locations[0]) setSelectedVoxel(item.locations[0].voxel);
  };

  const handleUpdateLocationQty = async (itemId: string, voxelId: string, quantity: number) => {
    const { success, error } = await updateItemLocationQty(itemId, voxelId, quantity);
    if (success) {
      setItems(prev => prev.map(i => {
        if (i.id === itemId) {
          let locations = [...i.locations];
          const index = locations.findIndex(l => l.voxel === voxelId);
          if (index >= 0) {
            if (quantity <= 0) {
              locations.splice(index, 1);
            } else {
              locations[index].quantity = quantity;
            }
          } else if (quantity > 0) {
            locations.push({ voxel: voxelId, quantity });
          }
          return { ...i, locations, total_quantity: locations.reduce((sum, l) => sum + l.quantity, 0) };
        }
        return i;
      }));
      toast.success("Обновлено");
    } else {
      toast.error(error);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setImportFile(file);
      Papa.parse(file, {
        complete: (results) => {
          const changes = results.data.map((row: any) => ({id: row[0], change: parseInt(row[1]), voxel: row[2] || undefined})).filter(c => c.id && !isNaN(c.change));
          setWorkflowItems(changes);
          setCurrentWorkflowIndex(0);
        },
        header: false,
      });
    }
  };

  const handleWorkflowNext = async () => {
    if (currentWorkflowIndex < workflowItems.length) {
      const {id, change} = workflowItems[currentWorkflowIndex];
      const voxel = selectedWorkflowVoxel || items.find(i => i.id === id)?.locations[0]?.voxel;
      if (!voxel) {
        toast.error("Выберите локацию");
        return;
      }
      const item = items.find(i => i.id === id);
      const currentQty = item?.locations.find(l => l.voxel === voxel)?.quantity || 0;
      await handleUpdateLocationQty(id, voxel, currentQty + change);
      setSelectedWorkflowVoxel(null);
      setCurrentWorkflowIndex(prev => prev + 1);
    } else {
      setWorkflowItems([]);
      toast.success("Импорт завершен");
    }
  };

  const handleExportDiff = () => {
    if (!lastCheckpoint) return toast.error("Нет чекпоинта");
    const diff = items.reduce((acc, i) => {
      const prev = lastCheckpoint[i.id];
      if (prev) {
        acc[i.id] = {locations: i.locations};
      }
      return acc;
    }, {} as any);
    const blob = new Blob([JSON.stringify(diff)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warehouse_diff.json';
    a.click();
  };

  const handleCheckpoint = () => {
    const checkpoint = items.reduce((acc, i) => {
      acc[i.id] = {locations: i.locations};
      return acc;
    }, {} as any);
    localStorage.setItem('warehouse_checkpoint', JSON.stringify(checkpoint));
    setLastCheckpoint(checkpoint);
    toast.success("Чекпоинт сохранен");
  };

  const handleResetFilters = () => {
    setFilterSeason(null);
    setFilterPattern(null);
    setFilterColor(null);
    setFilterSize(null);
    setSearch('');
    setSortBy('name');
  };

  if (loading) return <Loading text="Загрузка склада..." />;

  return (
    <div className="min-h-screen pt-24 bg-background flex flex-col">
      <div className="w-full h-[40vh] overflow-auto p-2">
        <WarehouseViz 
          items={items} 
          selectedVoxel={selectedVoxel} 
          onSelectVoxel={handleSelectVoxel} 
          onUpdateLocationQty={handleUpdateLocationQty}
        />
      </div>
      <div className="w-full overflow-auto p-2">
        <Card>
          <CardHeader className="p-2">
            <CardTitle className="text-sm">Список (Всего: {totals})</CardTitle>
            <div className="flex flex-wrap gap-1 text-xs">
              <Input className="h-6 text-xs" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Имя</SelectItem>
                  <SelectItem value="quantity">Кол-во</SelectItem>
                  <SelectItem value="voxel">Локация</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeason || 'all'} onValueChange={v => setFilterSeason(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Сезон" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="leto">Лето</SelectItem>
                  <SelectItem value="zima">Зима</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPattern || 'all'} onValueChange={v => setFilterPattern(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Узор" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="kruzheva">Кружева</SelectItem>
                  <SelectItem value="mirodel">Миродель</SelectItem>
                  <SelectItem value="ogurtsy">Огурцы</SelectItem>
                  <SelectItem value="flora1">Флора 1</SelectItem>
                  <SelectItem value="flora2">Флора 2</SelectItem>
                  <SelectItem value="flora3">Флора 3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterColor || 'all'} onValueChange={v => setFilterColor(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Цвет" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="beige">Бежевый</SelectItem>
                  <SelectItem value="blue">Голубой</SelectItem>
                  <SelectItem value="red">Красный</SelectItem>
                  <SelectItem value="light-green">Салатовый</SelectItem>
                  <SelectItem value="dark-green">Темно-зеленый</SelectItem>
                  <SelectItem value="gray">Серый</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSize || 'all'} onValueChange={v => setFilterSize(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Размер" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="180x220">180x220</SelectItem>
                  <SelectItem value="200x220">200x220</SelectItem>
                  <SelectItem value="220x240">220x240</SelectItem>
                  <SelectItem value="90">90</SelectItem>
                  <SelectItem value="120">120</SelectItem>
                  <SelectItem value="140">140</SelectItem>
                  <SelectItem value="160">160</SelectItem>
                  <SelectItem value="180">180</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="150x200">150x200</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleResetFilters} className="h-6 text-xs"><X size={12} /> Сброс</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1 text-xs">
              <Label htmlFor="import" className="text-xs">Импорт CSV</Label>
              <Input id="import" type="file" accept=".csv" onChange={handleImport} className="h-6 text-xs" />
              <Button onClick={handleExportDiff} className="h-6 text-xs">Diff</Button>
              <Button onClick={handleCheckpoint} className="h-6 text-xs">Чекпоинт</Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 grid grid-cols-3 gap-1 overflow-auto max-h-[40vh] md:max-h-auto">
            {filteredItems.map(item => (
              <Accordion type="single" collapsible key={item.id}>
                <AccordionItem value={item.id}>
                  <AccordionTrigger className={cn("p-1 text-xs rounded", COLOR_MAP[item.color])} onClick={() => handleSelectItem(item.id)}>
                    <div className="flex items-center gap-1">
                      {item.image && <Image src={item.image} alt={item.name} width={16} height={16} className="rounded" />}
                      <div>
                        <h3 className="font-bold text-xs">{item.name}</h3>
                        <p className="text-xs">Кол: {item.total_quantity}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-1 text-xs">
                    {item.locations.map(loc => (
                      <div key={loc.voxel} className="flex justify-between">
                        <span>{loc.voxel}: {loc.quantity}</span>
                        <Button size="xs" onClick={() => setSelectedVoxel(loc.voxel)}>Посм.</Button>
                      </div>
                    ))}
                    <p>{item.description}</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      </div>
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Workflow: {currentWorkflowIndex + 1}/{workflowItems.length}</DialogTitle>
            </DialogHeader>
            {currentWorkflowIndex < workflowItems.length && (
              <div>
                <p>Товар: {workflowItems[currentWorkflowIndex].id}, Изменение: {workflowItems[currentWorkflowIndex].change}</p>
                <Select value={selectedWorkflowVoxel || ''} onValueChange={setSelectedWorkflowVoxel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите локацию" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOXELS.map(v => <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={handleWorkflowNext}>Обновить и Далее</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}