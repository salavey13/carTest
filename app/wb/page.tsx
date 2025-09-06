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
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { COLOR_MAP, SIZE_PACK, VOXELS, Item, Location } from "@/app/wb/common";
import { motion } from "framer-motion";

export default function WBPage() {
  const [items, setItems] = useState<Item[]>([]);
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
  const [startTime, setStartTime] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [gameMode, setGameMode] = useState<'offload' | 'onload' | null>(null);

  useEffect(() => {
    async function loadItems() {
      const { success, data, error } = await getWarehouseItems();
      if (success && data) {
        const processed = data.map(item => {
          const locations = item.specs.warehouse_locations || [];
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
        });
        // Добавляем новые паттерны
        const newItems = [...processed];
        ['evro', 'dvushka', 'evro-maksi', 'polutorka'].forEach(type => {
          ['adel', 'malvina'].forEach(pattern => {
            ['leto', 'zima'].forEach(season => {
              const id = `${type}-${season}-${pattern}`;
              if (!newItems.some(i => i.id === id)) {
                newItems.push({
                  id,
                  name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${season.charAt(0).toUpperCase() + season.slice(1)} ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`,
                  description: pattern === 'adel' ? 'Бежевая, белое голубой горошек' : 'Бежевая, мятное фиолетовый цветок',
                  image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/wb/${id}.jpg`,
                  locations: [],
                  total_quantity: 0,
                  season,
                  pattern,
                  color: type === 'evro' ? 'beige' : type === 'dvushka' ? 'blue' : type === 'evro-maksi' ? 'red' : 'gray',
                  size: type === 'evro' ? '180x220' : type === 'dvushka' ? '200x220' : type === 'evro-maksi' ? '220x240' : '150x200',
                });
              }
            });
          });
        });
        setItems(newItems);
      } else {
        toast.error(error || "Ошибка загрузки товаров");
      }
      setLoading(false);
      const stored = localStorage.getItem('warehouse_checkpoint');
      if (stored) setLastCheckpoint(JSON.parse(stored));
      const ach = localStorage.getItem('achievements');
      if (ach) setAchievements(JSON.parse(ach));
      setStartTime(Date.now());
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

  const handleUpdateLocationQty = async (itemId: string, voxelId: string, quantity: number, isGameAction = false) => {
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
      if (isGameAction) {
        setScore(prev => prev + (quantity > 0 ? 10 : 5)); // Onload +10, offload +5
      }
    } else {
      toast.error(error);
    }
  };

  const handlePlateClick = (voxelId: string) => {
    if (!gameMode) return;
    const content = items.flatMap(i => i.locations.filter(l => l.voxel === voxelId).map(l => ({item: i, quantity: l.quantity})));
    if (content.length > 0) {
      const mainItem = content[0].item;
      const delta = gameMode === 'offload' ? -1 : 1;
      handleUpdateLocationQty(mainItem.id, voxelId, content[0].quantity + delta, true);
    } else if (gameMode === 'onload') {
      // Для onload, если пусто, добавить дефолтный item? Или игнор.
      toast.warning("Ячейка пуста, добавьте товар вручную.");
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
      await handleUpdateLocationQty(id, voxel, currentQty + change, true);
      setSelectedWorkflowVoxel(null);
      setCurrentWorkflowIndex(prev => prev + 1);
    } else {
      setWorkflowItems([]);
      toast.success("Импорт завершен");
      const timeSpent = Date.now() - (startTime || Date.now());
      const prevBest = localStorage.getItem('bestTime');
      if (!prevBest || timeSpent < parseInt(prevBest)) {
        localStorage.setItem('bestTime', timeSpent.toString());
        setAchievements(prev => {
          const newAch = [...prev, 'Новый рекорд времени!'];
          localStorage.setItem('achievements', JSON.stringify(newAch));
          return newAch;
        });
      }
    }
  };

  const handleExportDiff = () => {
    if (!lastCheckpoint) return toast.error("Нет чекпоинта");
    const diffData = items.map(i => {
      const prev = lastCheckpoint[i.id];
      const diffQty = i.total_quantity - (prev ? prev.locations.reduce((sum, l) => sum + l.quantity, 0) : 0);
      return [i.id, diffQty, i.locations[0]?.voxel || ''];
    });
    const csv = Papa.unparse(diffData);
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warehouse_diff.csv';
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
      <div className="w-full overflow-auto p-2">
        <Card>
          <CardHeader className="p-2">
            <CardTitle className="text-sm">Список (Всего: {totals})</CardTitle>
            <div className="flex flex-wrap gap-1 text-xs">
              <Input className="h-6 text-xs w-auto" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Имя</SelectItem>
                  <SelectItem value="quantity">Кол-во</SelectItem>
                  <SelectItem value="voxel">Локация</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeason || 'all'} onValueChange={v => setFilterSeason(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder={<VibeContentRenderer content="::FaFilter:: Сезон" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="leto"><VibeContentRenderer content="::FaSun:: Лето" /></SelectItem>
                  <SelectItem value="zima"><VibeContentRenderer content="::FaSnowflake:: Зима" /></SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPattern || 'all'} onValueChange={v => setFilterPattern(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder={<VibeContentRenderer content="::FaPaintBrush:: Узор" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="kruzheva">Кружева</SelectItem>
                  <SelectItem value="mirodel">Миродель</SelectItem>
                  <SelectItem value="ogurtsy">Огурцы</SelectItem>
                  <SelectItem value="flora1">Флора 1</SelectItem>
                  <SelectItem value="flora2">Флора 2</SelectItem>
                  <SelectItem value="flora3">Флора 3</SelectItem>
                  <SelectItem value="adel">Адель</SelectItem>
                  <SelectItem value="malvina">Мальвина</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterColor || 'all'} onValueChange={v => setFilterColor(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder={<VibeContentRenderer content="::FaPalette:: Цвет" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="beige">Бежевый</SelectItem>
                  <SelectItem value="blue">Голубой</SelectItem>
                  <SelectItem value="red">Красный</SelectItem>
                  <SelectItem value="light-green">Салатовый</SelectItem>
                  <SelectItem value="dark-green">Темно-зеленый</SelectItem>
                  <SelectItem value="gray">Серый</SelectItem>
                  <SelectItem value="adel">Адель</SelectItem>
                  <SelectItem value="malvina">Мальвина</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSize || 'all'} onValueChange={v => setFilterSize(v === 'all' ? null : v)}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder={<VibeContentRenderer content="::FaRuler:: Размер" />} /></SelectTrigger>
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
              <Label htmlFor="import" className="text-xs"><VibeContentRenderer content="::FaFileImport:: Импорт CSV" /></Label>
              <Input id="import" type="file" accept=".csv" onChange={handleImport} className="h-6 text-xs" />
              <Button onClick={handleExportDiff} className="h-6 text-xs"><VibeContentRenderer content="::FaFileExport:: Diff" /></Button>
              <Button onClick={handleCheckpoint} className="h-6 text-xs"><VibeContentRenderer content="::FaSave:: Чекпоинт" /></Button>
              <Select value={gameMode || 'none'} onValueChange={v => setGameMode(v === 'none' ? null : v as 'offload' | 'onload')}>
                <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder={<VibeContentRenderer content="::FaGamepad:: Режим игры" />} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Выкл</SelectItem>
                  <SelectItem value="offload"><VibeContentRenderer content="::FaArrowDown:: Offload (Отгрузка)" /></SelectItem>
                  <SelectItem value="onload"><VibeContentRenderer content="::FaArrowUp:: Onload (Приемка)" /></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2 grid grid-cols-3 gap-1 overflow-auto max-h-[30vh]">
            {filteredItems.map(item => (
              <Accordion type="single" collapsible key={item.id}>
                <AccordionItem value={item.id}>
                  <AccordionTrigger className={cn("p-1 text-[10px] rounded", COLOR_MAP[item.color || 'gray'])} onClick={() => handleSelectItem(item.id)}>
                    <div className="flex items-center gap-1">
                      {item.image && <Image src={item.image} alt={item.name} width={12} height={12} className="rounded" />}
                      <div>
                        <h3 className="font-bold text-[10px]">{item.name}</h3>
                        <p className="text-[10px]">Кол: {item.total_quantity}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-1 text-[10px]">
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
        <div className="mt-4 p-2 bg-muted rounded text-[10px]">
          <h3 className="font-bold">Гейм-статка (WMS for Gamers)</h3>
          <p>Очки: {score} | Ачивки: {achievements.join(', ')}</p>
          <p>Время: {startTime ? Math.floor((Date.now() - startTime) / 1000) : 0} сек</p>
          <p>Offload (отгрузка): +5 за дамаг. Onload (приемка): +10 за фарм.</p>
          <p>Идеи: Мультиплеер для админов, лидерборды, бонусы за объем/скорость. В разработке: Авто-синхр WB/Ozon.</p>
        </div>
      </div>
      <div className="w-full h-[80vh] overflow-y-auto p-2">
        <WarehouseViz 
          items={items} 
          selectedVoxel={selectedVoxel} 
          onSelectVoxel={handleSelectVoxel} 
          onUpdateLocationQty={handleUpdateLocationQty}
          gameMode={gameMode}
        />
      </div>
      <div className="mt-4 p-2 bg-muted rounded text-[10px]">
        <h3 className="font-bold">Объяснение процедур экспорта/импорта и синхронизации с WB/Ozon</h3>
        <p><strong>Импорт CSV:</strong> Загружайте файл CSV (формат: item_id,change_quantity,voxel) для приемки (onload). Система обновит запасы автоматически, добавив количества. Используйте для быстрой загрузки новой партии товаров. После импорта проверьте дифф и синхронизируйте с WB/Ozon вручную, загрузив сгенерированный CSV в их панели (обновление остатков).</p>
        <p><strong>Экспорт Diff CSV:</strong> Кнопка генерирует CSV с изменениями (item_id,diff_quantity,voxel) с последнего чекпоинта. Это для отгрузки (offload). Загружайте этот файл в WB и Ozon для обновления остатков на маркетплейсах. Дифф gamified: каждый клик в offload — это "взятие товара", обновляющее Supabase и дифф для экспорта.</p>
        <p><strong>Синхронизация WB/Ozon:</strong> 1. Сделайте чекпоинт перед работой. 2. В режиме offload/onload кликайте пластины — обновления идут в Supabase сразу. 3. Экспортируйте diff CSV. 4. Загрузите CSV в WB (раздел "Остатки" > Импорт) и Ozon (аналогично). Для авто-синхра: в будущем интегрируем API, но пока ручной. Для multiple складов ('A' точный, 'B' approx): экспорт дифф учитывает min_quantity для 'B', предупреждая о низких запасах.</p>
      </div>
      {workflowItems.length > 0 && (
        <Dialog open={true}>
          <DialogContent className="max-h-[80vh] overflow-auto">
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