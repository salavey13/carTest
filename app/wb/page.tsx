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
import { getWarehouseItems, updateItemLocationQty, exportDiffToAdmin } from "@/app/wb/actions";
import { toast } from "sonner";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { COLOR_MAP, SIZE_PACK, VOXELS, Item, Location } from "@/app/wb/common";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import Confetti from "react-confetti"; // Добавляем для particles

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
  const [clickCount, setClickCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [sessionStart, setSessionStart] = useState(Date.now());
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [bossMode, setBossMode] = useState(false);
  const [bossTimer, setBossTimer] = useState(300000); // 5min
  const [showConfetti, setShowConfetti] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, date: string}[]>([]);
  const [playerName, setPlayerName] = useState<string | null>(null);

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
            locations: locations.map(l => ({voxel: l.voxel_id, quantity: l.quantity, min_qty: item.specs.min_quantity && l.voxel_id.startsWith('B') ? item.specs.min_quantity : undefined})),
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
        setErrorCount(prev => prev + 1);
        playSound('/sounds/error.mp3');
      }
      setLoading(false);
      const stored = localStorage.getItem('warehouse_checkpoint');
      if (stored) setLastCheckpoint(JSON.parse(stored));
      const ach = localStorage.getItem('achievements');
      if (ach) setAchievements(JSON.parse(ach));
      const lb = localStorage.getItem('leaderboard');
      if (lb) setLeaderboard(JSON.parse(lb));
      const prevErrors = localStorage.getItem('errorRate') || '0';
      if (errorCount < parseInt(prevErrors)) setAchievements(prev => [...new Set([...prev, 'Error Slayer!'])]); // Dedup
      localStorage.setItem('errorRate', errorCount.toString());
      setStartTime(Date.now());
      setSessionStart(Date.now());
      loadDailyStreak();
      const name = localStorage.getItem('playerName');
      if (name) setPlayerName(name);
      else {
        const inputName = prompt("Введи свой ник для лидерборда:");
        if (inputName) {
          setPlayerName(inputName);
          localStorage.setItem('playerName', inputName);
        }
      }
    }
    loadItems();
  }, []);

  useEffect(() => {
    if (bossMode && bossTimer > 0) {
      const interval = setInterval(() => setBossTimer(prev => prev - 1000), 1000);
      return () => clearInterval(interval);
    } else if (bossMode && bossTimer <= 0) {
      toast.error("Boss fight timed out! No bonus.");
      setBossMode(false);
    }
  }, [bossMode, bossTimer]);

  useEffect(() => {
    if (score >= 100 && level === 1) levelUp(2);
    if (score >= 500 && level === 2) levelUp(3);
    if (score >= 1000 && level === 3) levelUp(4);
  }, [score, level]);

  const levelUp = (newLevel: number) => {
    setLevel(newLevel);
    setAchievements(prev => [...new Set([...prev, `Level Up! Lvl ${newLevel}`])]);
    localStorage.setItem('achievements', JSON.stringify(achievements));
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    toast.success(`Level Up to ${newLevel}! Bonus multiplier x${newLevel / 2}`);
  };

  const updateStreak = (success: boolean) => {
    if (success) {
      setStreak(prev => prev + 1);
      if (streak + 1 === 10) addAchievement('Streak Master 10!');
      if (streak + 1 === 50) addAchievement('Unstoppable Streak 50!');
    } else {
      setStreak(0);
    }
  };

  const addAchievement = (ach: string) => {
    setAchievements(prev => {
      const newAch = [...new Set([...prev, ach])];
      localStorage.setItem('achievements', JSON.stringify(newAch));
      return newAch;
    });
  };

  const loadDailyStreak = () => {
    const lastDate = localStorage.getItem('lastSessionDate');
    const today = new Date().toDateString();
    if (lastDate === today) {
      setDailyStreak(parseInt(localStorage.getItem('dailyStreak') || '0'));
    } else if (new Date(lastDate || '').getTime() === new Date().setDate(new Date().getDate() - 1)) {
      const newStreak = (parseInt(localStorage.getItem('dailyStreak') || '0') + 1);
      setDailyStreak(newStreak);
      localStorage.setItem('dailyStreak', newStreak.toString());
      if (newStreak === 3) addAchievement('Daily Streak 3!');
      if (newStreak === 7) addAchievement('Week Warrior!');
    } else {
      setDailyStreak(1);
      localStorage.setItem('dailyStreak', '1');
    }
    localStorage.setItem('lastSessionDate', today);
  };

  const updateLeaderboard = (newScore: number) => {
    if (!playerName) return;
    const entry = {name: playerName, score: newScore, date: new Date().toLocaleString()};
    const newLb = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(newLb);
    localStorage.setItem('leaderboard', JSON.stringify(newLb));
  };

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
    const item = items.find(i => i.id === itemId);
    const loc = item?.locations.find(l => l.voxel === voxelId);
    if (voxelId.startsWith('B') && loc?.min_qty && quantity < loc.min_qty) {
      toast.warn("Min qty on B! Full recount needed.");
      setErrorCount(prev => prev + 1);
      updateStreak(false);
      playSound('/sounds/error.mp3');
      return;
    }
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
          const newQty = locations.reduce((sum, l) => sum + l.quantity, 0);
          return { ...i, locations, total_quantity: newQty };
        }
        return i;
      }));
      toast.success("Обновлено");
      if (isGameAction) {
        const absChange = Math.abs(quantity - (loc?.quantity || 0));
        let basePoints = gameMode === 'onload' ? 10 : 5;
        let bonus = absChange > 10 ? 5 : 0; // Volume bonus
        bonus += level * 2; // Level bonus
        const points = (basePoints + bonus) * absChange;
        setScore(prev => prev + points);
        setClickCount(prev => prev + 1);
        updateStreak(true);
        if (clickCount > 10 && (Date.now() - (startTime || Date.now())) / 60000 < 1) {
          addAchievement('Fast Clicker!');
        }
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1000);
        playSound(gameMode === 'onload' ? '/sounds/farm.mp3' : '/sounds/damage.mp3');
        updateLeaderboard(score + points);
      }
    } else {
      toast.error(error);
      setErrorCount(prev => prev + 1);
      updateStreak(false);
      playSound('/sounds/error.mp3');
    }
  };

  const playSound = (src: string) => {
    const audio = new Audio(src);
    audio.play();
  };

  const handlePlateClick = (voxelId: string) => {
    if (!gameMode) return;
    const content = items.flatMap(i => i.locations.filter(l => l.voxel === voxelId).map(l => ({item: i, quantity: l.quantity})));
    if (content.length > 0) {
      const mainItem = content[0].item;
      const delta = gameMode === 'offload' ? -1 : 1;
      handleUpdateLocationQty(mainItem.id, voxelId, content[0].quantity + delta, true);
    } else if (gameMode === 'onload') {
      toast.warning("Ячейка пуста. Добавьте товар через диалог.");
      handleSelectVoxel(voxelId);
    }
  };

  const handleItemClick = (itemId: string) => {
    if (!gameMode) return handleSelectItem(itemId);
    const item = items.find(i => i.id === itemId);
    if (!item?.locations[0]) return toast.error("Нет локации. Добавьте вручную.", {onClose: () => {setErrorCount(prev => prev + 1); updateStreak(false); playSound('/sounds/error.mp3');}});
    const voxelId = item.locations[0].voxel;
    const currentQty = item.locations[0].quantity;
    const delta = gameMode === 'offload' ? -1 : 1;
    handleUpdateLocationQty(itemId, voxelId, currentQty + delta, true);
    if (navigator.vibrate) navigator.vibrate(50);
    playSound('/sounds/click.mp3');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setImportFile(file);
      Papa.parse(file, {
        complete: (results) => {
          const changes = results.data.map((row: any) => {
            const id = row['Артикул продавца'] || row['Баркод'];
            const change = parseInt(row['Количество']);
            return {id, change, voxel: row['voxel'] || undefined};
          }).filter(c => c.id && !isNaN(c.change));
          setWorkflowItems(changes);
          setCurrentWorkflowIndex(0);
          if (changes.length > 20) {
            setBossMode(true);
            setBossTimer(300000);
            toast.warn("Boss Fight! Заверши за 5 мин для x1.5 бонуса.");
            playSound('/sounds/boss.mp3');
          }
        },
        header: true,
      });
    }
  };

  const handleWorkflowNext = async () => {
    if (currentWorkflowIndex < workflowItems.length) {
      const {id, change, voxel: importVoxel} = workflowItems[currentWorkflowIndex];
      const voxel = selectedWorkflowVoxel || importVoxel || items.find(i => i.id === id)?.locations[0]?.voxel;
      if (!voxel) {
        toast.error("Выберите локацию");
        setErrorCount(prev => prev + 1);
        updateStreak(false);
        playSound('/sounds/error.mp3');
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
        addAchievement('Новый рекорд времени!');
      }
      if (timeSpent < 300000) addAchievement('Speed Demon!');
      if (bossMode) {
        setBossMode(false);
        if (bossTimer > 0) {
          setScore(prev => prev * 1.5);
          addAchievement('Boss Slayer!');
        }
      }
    }
  };

  const handleExportDiff = async () => {
    if (!lastCheckpoint) return toast.error("Нет чекпоинта");
    const diffData = items.map(i => {
      const prev = lastCheckpoint[i.id];
      const diffQty = i.total_quantity - (prev ? prev.locations.reduce((sum, l) => sum + l.quantity, 0) : 0);
      return {id: i.id, diffQty, voxel: i.locations[0]?.voxel || ''};
    });
    const csv = Papa.unparse(diffData, {columns: ['id', 'diffQty', 'voxel']});
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'warehouse_diff.csv';
    a.click();
    await exportDiffToAdmin(csv);
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

  const bgStyle = {
    background: gameMode === 'onload' ? 'linear-gradient(to bottom right, #15803d, #22c55e)' 
      : gameMode === 'offload' ? 'linear-gradient(to bottom right, #b91c1c, #ef4444)' 
      : undefined,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300" style={bgStyle}>
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} />}
      <div className="w-full overflow-auto p-2">
        <Card>
          <CardContent className="p-1 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-1 overflow-auto max-h-[69vh]">
            {loading ? Array.from({length: 20}).map((_, idx) => (
              <Skeleton key={idx} className="h-24 rounded-2xl" />
            )) : filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  "relative cursor-pointer rounded-2xl shadow-lg overflow-hidden group",
                  "transition-all duration-300 ease-in-out",
                  gameMode && "w-24 h-24" // Bigger for mobile game mode
                )}
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                )}
                <div
                  className={cn(
                    "absolute inset-0 opacity-70 group-hover:opacity-50 transition-opacity duration-300",
                    COLOR_MAP[item.color || "gray"],
                  )}
                />
                <div className="relative z-10 flex flex-col h-full p-2 justify-between">
                  <div>
                    <h3 className="font-extrabold text-xs md:text-sm drop-shadow-lg text-black">
                      {item.name}
                    </h3>
                    <p className="text-[8px] md:text-xs text-white/80">
                      Кол: {item.total_quantity}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.locations.map((loc) => (
                      <span
                        key={loc.voxel}
                        className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-black shadow"
                      >
                        {loc.voxel}:{loc.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                {item.description && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-[10px] md:text-xs text-white p-2"
                  >
                    {item.description}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </CardContent>
          <CardHeader className="p-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Список (Всего: {totals}) {gameMode && <VibeContentRenderer content={gameMode === 'onload' ? '::FaArrowUp:: Приемка' : '::FaArrowDown:: Отгрузка'} className="text-lg" />}
            </CardTitle>
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
              <Label htmlFor="import" className="text-xs"><VibeContentRenderer content="::FaFileImport:: Импорт CSV/XLSX" /></Label>
              <Input id="import" type="file" accept=".csv,.xlsx" onChange={handleImport} className="h-6 text-xs" />
              <Button onClick={handleExportDiff} className="h-6 text-xs"><VibeContentRenderer content="::FaFileExport:: Diff в чат" /></Button>
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
        </Card>
        <div className="mt-4 p-2 bg-muted rounded text-[10px]">
          <h3 className="font-bold">Гейм-статка (WMS for Gamers)</h3>
          <p>Очки: {score} (Вирт. XTR: {Math.floor(score / 100)}) | Lvl: {level} | Streak: {streak} | Daily: {dailyStreak}</p>
          <p>Ачивки: {achievements.join(', ')}</p>
          <p>Время сессии: {Math.floor((Date.now() - sessionStart) / 1000)} сек | Ошибки: {errorCount}</p>
          <p>Фарм (onload): +10 за +1 +бонус. Дамаг (offload): +5 за -1 +бонус. Lvl bonus: x{level / 2}</p>
          {bossMode && <p className="text-red-500 animate-pulse">Boss Fight! Осталось: {Math.floor(bossTimer / 1000)} сек</p>}
          <p>Лидерборд:</p>
          <ol className="list-decimal pl-4">
            {leaderboard.map((entry, idx) => (
              <li key={idx}>{entry.name}: {entry.score} ({entry.date})</li>
            ))}
          </ol>
          <p>В dev: Realtime co-op (Supabase), реальные XTR rewards за топ.</p>
        </div>
      </div>
      <div className="w-full h-[80vh] overflow-y-auto p-2">
        <WarehouseViz 
          items={items} 
          selectedVoxel={selectedVoxel} 
          onSelectVoxel={handleSelectVoxel} 
          onUpdateLocationQty={handleUpdateLocationQty}
          gameMode={gameMode}
          onPlateClick={handlePlateClick}
        />
      </div>
      <div className="mt-4 p-2 bg-muted rounded text-[10px]">
        <Accordion type="single" collapsible>
          <AccordionItem value="instructions">
            <AccordionTrigger className="font-bold">Обновлённые инструкции по процедурам</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-4 space-y-2">
                <li><strong>Чекпоинт:</strong> Нажмите "Чекпоинт" перед началом работы для фиксации текущего состояния.</li>
                <li><strong>Режимы игры:</strong> Вкл Onload/Offload. Клик на item/ячейку - auto inc/dec. Пусто в Onload? Открывает добавление.</li>
                <li><strong>Импорт:</strong> Загружайте CSV/XLSX (headers: Артикул,Количество,voxel опц). Workflow шаг за шагом обновляет. Большой импорт - Boss Fight!</li>
                <li><strong>Экспорт Diff:</strong> После работы - генерит CSV дифф от чекпоинта, скачивает + шлёт файл в админ-чат как документ.</li>
                <li><strong>Синхронизация:</strong> Загружайте diff в WB/Ozon панели (Остатки > Импорт). Для 'B' полок - warn если qty < min.</li>
                <li><strong>Mobile Tips:</strong> Ячейки larger, touch-friendly. Swipe для скролла viz.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
      />
      <p className="ml-4">{text}</p>
    </div>
  );
}