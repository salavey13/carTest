"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast as sonnerToast } from "sonner"; // Fallback only
import { Save, RotateCcw, FileUp, PackageSearch, Car } from "lucide-react";
import { useCrewWarehouse } from "./warehouseHooks";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import ShiftControls from "@/components/ShiftControls";
import { CrewWarehouseSyncButtons } from "@/components/CrewWarehouseSyncButtons";
import FilterAccordion from "@/components/FilterAccordion";
import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { notifyCrewOwner } from "./actions_notify";
import { exportCrewCurrentStock, exportCrewDailyShift } from "./actions_csv";
import { fetchCrewWbPendingCount, fetchCrewOzonPendingCount } from "./actions_sync";
import { getCrewMemberStatus, getActiveShiftForCrewMember } from "./actions_shifts";
import { saveCrewCheckpoint, resetCrewCheckpoint } from "./actions_shifts";
import { Loading } from "@/components/Loading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseAdmin } from "@/hooks/supabase";

export default function CrewWarehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string | undefined;
  const { dbUser } = useAppContext();
  const { success: appToast, error: appError, info: appInfo, warning: appWarning, custom: appCustom, dismiss: appDismiss } = useAppToast();

  const warehouse = useCrewWarehouse(slug || "", { toast: { success: appToast, error: appError, info: appInfo, warning: appWarning } });
  const {
    items: hookItems,
    loading,
    error,
    checkpoint,
    setCheckpoint,
    workflowItems,
    currentWorkflowIndex,
    selectedWorkflowVoxel,
    setSelectedWorkflowVoxel,
    gameMode,
    setGameMode,
    score,
    level,
    streak,
    dailyStreak,
    achievements,
    errorCount,
    sessionStart,
    bossMode,
    bossTimer,
    leaderboard,
    loadItems,
    handleUpdateLocationQty,
    handleWorkflowNext,
    handleSkipItem,
    handlePlateClick,
    handleItemClick,
    search,
    setSearch,
    filterSeason,
    setFilterSeason,
    filterPattern,
    setFilterPattern,
    filterColor,
    setFilterColor,
    filterSize,
    setFilterSize,
    selectedVoxel,
    setSelectedVoxel,
    filteredItems: hookFilteredItems,
    sortOption,
    setSortOption,
    onloadCount,
    offloadCount,
    editCount,
    setOnloadCount,
    setOffloadCount,
    setEditCount,
    efficiency,
    avgTimePerItem,
    dailyGoals,
    sessionDuration,
    getSizePriority,
  } = warehouse;

  const [localItems, setLocalItems] = useState<any[]>(hookItems || []);
  const [crew, setCrew] = useState<any | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [statsObj, setStatsObj] = useState({ changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: 0, salary: 0 });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<Array<{ item: any; quantity: number; newQuantity: number }>>([]);
  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);
  const [lastProcessedTotalDelta, setLastProcessedTotalDelta] = useState<number | null>(null);
  const [lastProcessedStars, setLastProcessedStars] = useState<number | null>(null);
  const [lastProcessedOffloadUnits, setLastProcessedOffloadUnits] = useState<number | null>(null);
  const [lastProcessedSalary, setLastProcessedSalary] = useState<number | null>(null);
  const [checkingPending, setCheckingPending] = useState(false);
  const [exportingDaily, setExportingDaily] = useState(false);
  const [sendingCar, setSendingCar] = useState(false);
  const [targetOffload, setTargetOffload] = useState(0);
  const [carSize, setCarSize] = useState<"small" | "medium" | "large">("medium");

  const uniqueSeasons = useMemo(() => [...new Set(localItems.map(i => i.season).filter(Boolean))].sort(), [localItems]);
  const uniquePatterns = useMemo(() => [...new Set(localItems.map(i => i.pattern).filter(Boolean))].sort(), [localItems]);
  const uniqueColors = useMemo(() => [...new Set(localItems.map(i => i.color).filter(Boolean))].sort(), [localItems]);
  const uniqueSizes = useMemo(() => [...new Set(localItems.map(i => i.size).filter(Boolean))].sort((a, b) => getSizePriority(a) - getSizePriority(b)), [localItems, getSizePriority]);

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Load crew data to ensure name displays
  useEffect(() => {
    const fetchCrew = async () => {
      if (!slug) return;
      const { data, error } = await supabaseAdmin
        .from("crews")
        .select("id, name, slug, owner_id, logo_url")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();
      if (error) {
        appError("Ошибка загрузки данных экипажа", { position: "top-right" });
        return;
      }
      setCrew(data || null);
      setIsOwner(data?.owner_id === dbUser?.user_id);
    };
    fetchCrew();
  }, [slug, dbUser?.user_id, appError]);

  const loadStatus = async () => {
    if (!slug || !dbUser?.user_id) return;
    try {
      const statusRes = await getCrewMemberStatus(slug, dbUser.user_id);
      if (statusRes.success) setLiveStatus(statusRes.live_status || null);
      const shiftRes = await getActiveShiftForCrewMember(slug, dbUser.user_id);
      setActiveShift(shiftRes.shift || null);
    } catch {
      appError("Ошибка загрузки статуса", { position: "top-right" });
    }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 30000);
    return () => clearInterval(poll);
  }, [slug, dbUser?.user_id]);

  const canManage = useMemo(() => {
    const globalAdmin = !!dbUser && (dbUser.status === "admin" || dbUser.is_admin);
    const memberOk = !!memberRole && memberRole !== "car_monitor"; // Exclude car_monitor
    return !!(isOwner || memberOk || globalAdmin);
  }, [dbUser, memberRole, isOwner]);

  const optimisticUpdate = useCallback((itemId: string, voxelId: string, delta: number) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => l.voxel === voxelId);
        if (idx !== -1) {
          locs[idx].quantity = Math.max(0, locs[idx].quantity + delta);
        } else if (delta > 0) {
          locs.push({ voxel: voxelId, quantity: delta });
        }
        const filtered = locs.filter(l => l.quantity > 0);
        const newTotal = filtered.reduce((acc, l) => acc + l.quantity, 0);
        return { ...i, locations: filtered, total_quantity: newTotal };
      })
    );

    const absDelta = Math.abs(delta);
    if (gameMode === "onload" && delta > 0) setOnloadCount(p => p + absDelta);
    else if (gameMode === "offload" && delta < 0) setOffloadCount(p => p + absDelta);
    else setEditCount(p => p + absDelta);

    // Enhanced: Toast on successful server update
    handleUpdateLocationQty(itemId, voxelId, delta, true).then(({ success, item }) => {
      if (success && item) {
        const actionType = delta > 0 ? "Добавлено" : "Отгружено";
        const newTotal = item.total_quantity;
        const runningTotal = gameMode === "offload" ? offloadCount + absDelta : onloadCount + absDelta;
        const itemName = localItems.find(i => i.id === itemId)?.name || "Товар";
        appToast.success(
          `${actionType} ${absDelta} ${itemName} в ${voxelId} (остаток: ${newTotal})`,
          {
            description: `Сессия: ${runningTotal} ед. ${gameMode === "offload" ? "отгружено" : "добавлено"}`,
            duration: 4000,
            position: "bottom-right",
            action: {
              label: "Чекпоинт",
              onClick: () => handleCheckpoint(),
            },
          }
        );
      } else {
        loadItems();
        appError("Сервер не обновил—перезагружено", { position: "top-right" });
      }
    }).catch(() => {
      loadItems();
      appError("Ошибка обновления на сервере - перезагружено", { position: "top-right" });
    });
  }, [handleUpdateLocationQty, gameMode, offloadCount, onloadCount, localItems, appToast, appError, handleCheckpoint]);

  const handleCheckpoint = async () => {
    // Summarize previous checkpoint stats
    if (checkpoint.length && dbUser?.user_id) {
      const stats = computeProcessedStats();
      const { offloadUnits, changedCount, totalDelta, sumsPrevious, sumsCurrent } = stats;
      const changedCategories = Object.keys(sumsCurrent).filter(
        (cat) => sumsCurrent[cat] !== (sumsPrevious[cat] || 0)
      );
      const semitotalMsg = `Семитотал чекпоинта: ${offloadUnits} ед. отгружено, ${changedCount} изменений, Δ${totalDelta} ед.`;
      const fullMessage = `${semitotalMsg}\nКатегории: ${changedCategories.join(", ") || "нет"}`;
      await notifyCrewOwner(slug, fullMessage, dbUser.user_id);

      // Custom semitotal toast
      appCustom((t) => (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-md space-y-2">
          <h3 className="font-semibold text-blue-800">Чекпоинт Завершён</h3>
          <p className="text-sm text-blue-700">{semitotalMsg}</p>
          <div className="text-xs text-gray-600 grid grid-cols-3 gap-2">
            <span>Изменения: {changedCount}</span>
            <span>Дельта: {totalDelta}</span>
            <span>Отгружено: {offloadUnits}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => appDismiss(t)} className="w-full">
            Продолжить
          </Button>
        </div>
      ), { duration: 8000, position: "bottom-right" });
    }

    // Save new checkpoint
    const snapshot = localItems.map(i => ({ id: i.id, locations: i.locations.map(l => ({ voxel: l.voxel, quantity: l.quantity })) }));
    setCheckpoint(snapshot);
    setCheckpointStart(Date.now());
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    setLastCheckpointDurationSec(checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null);
    appInfo("Новый чекпоинт запущен", { position: "bottom-right" });

    if (dbUser?.user_id) {
      const res = await saveCrewCheckpoint(slug, dbUser.user_id, snapshot);
      if (res.success) appToast("Чекпоинт сохранён на сервере", { position: "bottom-right" });
      else appError("Ошибка сохранения чекпоинта", { position: "top-right" });
    }
  };

  const handleReset = async () => {
    if (!checkpoint.length) return appError("Нет чекпоинта для сброса", { position: "top-right" });
    setLocalItems(checkpoint.map(i => ({ ...i, locations: [...i.locations] })));
    setCheckpointStart(null);
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);

    if (dbUser?.user_id) {
      const res = await resetCrewCheckpoint(slug, dbUser.user_id);
      if (res.success) {
        appInfo(`Сброшено: ${res.applied} позиций (отменено ${statsObj.totalDelta} ед.)`, { position: "bottom-right" });
        loadItems();
      } else {
        appError("Ошибка сброса чекпоинта", { position: "top-right" });
      }
    } else {
      appInfo("Сброшено локально до чекпоинта", { position: "bottom-right" });
    }
  };

  const categorizeItem = (item: any): string => {
    const fullLower = (item.id || item.model || '').toLowerCase().trim();
    if (!fullLower) return 'other';

    if (fullLower.includes('наматрасник') || fullLower.includes('namatras')) {
      const sizeMatch = fullLower.match(/(90|120|140|160|180|200)/);
      if (sizeMatch) return `namatras ${sizeMatch[0]}`;
    }

    const sizeChecks = [
      { key: 'евро макси', val: 'evromaksi' },
      { key: 'evro maksi', val: 'evromaksi' },
      { key: 'evromaksi', val: 'evromaksi' },
      { key: 'евро', val: 'evro' },
      { key: 'evro', val: 'evro' },
      { key: 'euro', val: 'evro' },
      { key: '2', val: '2' },
      { key: '1.5', val: '1.5' }
    ];
    let detectedSize = null;
    for (const { key, val } of sizeChecks) {
      if (fullLower.includes(key)) {
        detectedSize = val;
        break;
      }
    }

    const seasonMap = { 'лето': 'leto', 'зима': 'zima', 'leto': 'leto', 'zima': 'zima' };
    let detectedSeason = null;
    for (const [key, val] of Object.entries(seasonMap)) {
      if (fullLower.includes(key)) {
        detectedSeason = val;
        break;
      }
    }

    if (detectedSize && detectedSeason) {
      return `${detectedSize} ${detectedSeason}`;
    }

    if (fullLower.includes('подушка') || fullLower.includes('podushka')) {
      if (fullLower.includes('50x70') || fullLower.includes('50x70')) return 'Podushka 50x70';
      if (fullLower.includes('70x70') || fullLower.includes('70x70')) return 'Podushka 70x70';
      if (fullLower.includes('анатом') || fullLower.includes('anatom')) return 'Podushka anatom';
    }

    if (fullLower.includes('наволочка') || fullLower.includes('navolochka')) {
      if (fullLower.includes('50x70') || fullLower.includes('50x70')) return 'Navolochka 50x70';
      if (fullLower.includes('70x70') || fullLower.includes('70x70')) return 'Navolochka 70x70';
    }

    return 'other';
  };

  const computeProcessedStats = useCallback(() => {
    if (!checkpoint.length) return { changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: offloadCount || 0, salary: (offloadCount || 0) * 50, sumsPrevious: {}, sumsCurrent: {} };
    let changedCount = 0;
    let totalDelta = 0;
    let offloadUnits = offloadCount || 0;
    let stars = Math.floor(offloadUnits / 10); // Award 1 star per 10 offloaded units

    let sumsPrevious: Record<string, number> = {};
    let sumsCurrent: Record<string, number> = {};

    checkpoint.forEach(cp => {
      const cat = categorizeItem(cp);
      sumsPrevious[cat] = (sumsPrevious[cat] || 0) + (cp.total_quantity || 0);
    });

    localItems.forEach(it => {
      const cat = categorizeItem(it);
      sumsCurrent[cat] = (sumsCurrent[cat] || 0) + (it.total_quantity || 0);
    });

    localItems.forEach(it => {
      const cp = checkpoint.find(c => c.id === it.id);
      if (!cp) return;
      const rawDelta = it.total_quantity - cp.total_quantity;
      const absDelta = Math.abs(rawDelta);
      if (absDelta > 0) changedCount += 1;
      totalDelta += absDelta;
    });

    const salary = offloadUnits * 50;
    return { changedCount, totalDelta, stars, offloadUnits, salary, sumsPrevious, sumsCurrent };
  }, [localItems, checkpoint, offloadCount]);

  useEffect(() => {
    const stats = computeProcessedStats();
    setStatsObj(stats);
    setLastProcessedCount(stats.changedCount);
    setLastProcessedTotalDelta(stats.totalDelta);
    setLastProcessedStars(stats.stars);
    setLastProcessedOffloadUnits(stats.offloadUnits);
    setLastProcessedSalary(stats.salary);
  }, [computeProcessedStats]);

  // Define handlePlateClickCustom to open edit modal in "none" game mode
  const handlePlateClickCustom = useCallback((voxelId: string) => {
    if (gameMode) {
      // In game mode, use the default handlePlateClick from the hook
      handlePlateClick(voxelId);
      return;
    }
    // In "none" mode, open the edit modal
    setEditVoxel(voxelId);
    const contents = localItems
      .flatMap((i) => {
        const locs = Array.isArray(i?.locations) ? i.locations : [];
        return locs
          .filter((l: any) => l.voxel === voxelId && l.quantity > 0)
          .map((l: any) => ({ item: i, quantity: l.quantity, newQuantity: l.quantity }));
      });
    setEditContents(contents);
    setEditDialogOpen(true);
    appInfo(`Ячейка ${voxelId} открыта для правки`, { position: "bottom-right" });
  }, [gameMode, handlePlateClick, localItems, appInfo]);

  // Define handleItemClickCustom to open edit modal in "none" game mode
  const handleItemClickCustom = useCallback((item: any) => {
    if (gameMode) {
      // In game mode, use the default handleItemClick from the hook
      handleItemClick(item);
      return;
    }
    // In "none" mode, open the edit modal with the item's primary location
    const voxelId = selectedVoxel || item.locations?.[0]?.voxel || "A1";
    setEditVoxel(voxelId);
    const loc = item.locations?.find((l: any) => l.voxel === voxelId);
    const contents = loc ? [{ item, quantity: loc.quantity, newQuantity: loc.quantity }] : [];
    setEditContents(contents);
    setEditDialogOpen(true);
    appInfo(`Товар ${item.name} открыт для правки в ${voxelId}`, { position: "bottom-right" });
  }, [gameMode, handleItemClick, selectedVoxel, appInfo]);

  const handleExportDaily = async () => {
    if (!activeShift) return appError("Запустите смену для экспорта отчёта", { position: "top-right" });
    setExportingDaily(true);
    try {
      const res = await exportCrewDailyShift(slug, false); // Use exportCrewDailyShift with special notification

      if (res?.success && res.csv) {
        const copied = await safeCopyToClipboard(res.csv);
        if (copied) appToast("Отчёт скопирован в буфер", { position: "bottom-right" });
        else {
          const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `daily_shift_${slug}.tsv`;
          a.click();
          URL.revokeObjectURL(url);
          appToast("Отчёт скачан", { position: "bottom-right" });
        }

        // Notification already sent by exportCrewDailyShift
        appInfo("Отчёт отправлен владельцу экипажа", { position: "top-right" });
      } else {
        appError(res?.error || "Экспорт отчёта провалился", { position: "top-right" });
      }
    } catch (err) {
      appError("Критическая ошибка экспорта отчёта", { position: "top-right" });
    } finally {
      setExportingDaily(false);
    }
  };

  const handleSendCar = async () => {
    if (!canManage) return appError("У вас нет прав на запрос машины", { position: "top-right" });
    setSendingCar(true);
    try {
      const msg = `Запрос машины: тип=${carSize}`;
      await notifyCrewOwner(slug, msg, dbUser?.user_id);
      appCustom((t) => (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-md">
          <Car className="w-5 h-5 text-green-600" />
          <span>Запрос {carSize} машины ушёл владельцу</span>
          <Button variant="ghost" size="sm" onClick={() => appDismiss(t)}>OK</Button>
        </div>
      ), { duration: 5000, position: "bottom-right" });
    } catch (err) {
      appError("Не удалось отправить запрос машины", { position: "top-right" });
    } finally {
      setSendingCar(false);
    }
  };

  const handleCheckPending = async () => {
    setCheckingPending(true);
    try {
      const wbRes = await fetchCrewWbPendingCount(slug);
      const ozonRes = await fetchCrewOzonPendingCount(slug);
      const wbCount = wbRes.success ? wbRes.count : 0;
      const ozonCount = ozonRes.success ? ozonRes.count : 0;
      const total = wbCount + ozonCount;
      setTargetOffload(total);
      appWarning(`Горячие заказы: WB ${wbCount} | Ozon ${ozonCount} | Всего ${total}`, {
        position: "top-center",
        duration: 6000,
      });
    } catch (err: any) {
      appError("Проверка заказов сломалась", { position: "top-right" });
    } finally {
      setCheckingPending(false);
    }
  };

  const handleExportStock = async (summarized = false) => {
    try {
      const res = await exportCrewCurrentStock(slug, localItems, summarized);
      if (res.success && res.csv) {
        const copied = await safeCopyToClipboard(res.csv);
        if (copied) appToast("Склад в буфере — готов к вставке", { position: "bottom-right" });
        else {
          const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = summarized ? `stock_summary_${slug}.tsv` : `stock_${slug}.tsv`;
          a.click();
          URL.revokeObjectURL(url);
          appToast("Склад экспортирован в файл", { position: "bottom-right" });
        }
      } else {
        appError(res.error || "Экспорт склада не удался", { position: "top-right" });
      }
    } catch (err) {
      appError("Крах экспорта склада", { position: "top-right" });
    }
  };

  const safeCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const formatSec = (sec: number | null) => {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const checkpointDisplayMain = checkpointStart ? formatSec(Math.floor((Date.now() - checkpointStart) / 1000)) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--");
  const checkpointDisplaySub = checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался");

  const processedChangedCount = checkpointStart ? statsObj.changedCount : (lastProcessedCount ?? 0);
  const processedTotalDelta = checkpointStart ? statsObj.totalDelta : (lastProcessedTotalDelta ?? 0);
  const processedStars = checkpointStart ? statsObj.stars : (lastProcessedStars ?? 0);
  const processedOffloadUnits = checkpointStart ? statsObj.offloadUnits : (lastProcessedOffloadUnits ?? 0);
  const processedSalary = checkpointStart ? statsObj.salary : (lastProcessedSalary ?? 0);

  if (loading) return <Loading text="Загрузка склада..." />;
  if (error) return <div className="p-2 text-red-500">Ошибка: {error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="p-2 bg-white dark:bg-gray-800 shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <div className="flex items-center gap-2">
            {crew?.logo_url && <img src={crew.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
            <div>
              <h1 className="text-sm font-medium leading-tight">{crew?.name || "Экипаж"}</h1>
              <div className="text-xs text-gray-500">
                Смена: {activeShift ? (activeShift.shift_type || "склад") : "нет"} · Статус: {liveStatus || (activeShift ? "активен" : "оффлайн")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto md:overflow-visible">
            <ShiftControls slug={slug!} />
            <div className="flex items-center gap-1 whitespace-nowrap">
              <Button
                size="sm"
                variant={gameMode === "onload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "onload" ? null : "onload")}
                className="px-2 py-1 text-xs h-6 min-w-[60px]"
                title="Загрузка (добавить товары)"
                disabled={!canManage}
              >
                +Загрузка
              </Button>
              <Button
                size="sm"
                variant={gameMode === "offload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "offload" ? null : "offload")}
                className="px-2 py-1 text-xs h-6 min-w-[60px]"
                title="Выгрузка (убрать товары)"
                disabled={!canManage}
              >
                −Выгрузка
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-0 sm:p-2">
        <Card className="mb-2">
          <CardHeader className="p-2">
            <CardTitle className="text-base">Склад</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-4">
            <div className="overflow-y-auto max-h-[60vh] simple-scrollbar">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {hookFilteredItems.map((item) => (
                  <WarehouseItemCard key={item.id} item={item} onClick={() => handleItemClickCustom(item)} />
                ))}
              </div>
            </div>
            {hookFilteredItems.length === 0 && <div className="text-center py-6 text-gray-500">Товары не найдены</div>}
          </CardContent>
        </Card>

        <div className="mb-2">
          <FilterAccordion
            filterSeason={filterSeason}
            setFilterSeason={setFilterSeason}
            filterPattern={filterPattern}
            setFilterPattern={setFilterPattern}
            filterColor={filterColor}
            setFilterColor={setFilterColor}
            filterSize={filterSize}
            setFilterSize={setFilterSize}
            items={localItems}
            onResetFilters={() => {
              setFilterSeason(null);
              setFilterPattern(null);
              setFilterColor(null);
              setFilterSize(null);
              setSearch("");
            }}
            includeSearch
            search={search}
            setSearch={setSearch}
            sortOption={sortOption as any}
            setSortOption={setSortOption as any}
          />
        </div>

        <WarehouseViz
          items={localItems}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={setSelectedVoxel}
          onPlateClick={handlePlateClickCustom}
          gameMode={gameMode}
        />

        <div className="mt-2">
          <WarehouseStats
            itemsCount={localItems.reduce((s, it) => s + (it.total_quantity || 0), 0)}
            uniqueIds={localItems.length}
            score={score}
            level={level}
            streak={streak}
            dailyStreak={dailyStreak}
            checkpointMain={checkpointDisplayMain}
            checkpointSub={checkpointDisplaySub}
            changedCount={processedChangedCount}
            totalDelta={processedTotalDelta}
            stars={processedStars}
            offloadUnits={processedOffloadUnits}
            salary={processedSalary}
            achievements={achievements}
            sessionStart={sessionStart}
            errorCount={errorCount}
            bossMode={bossMode}
            bossTimer={bossTimer}
            leaderboard={leaderboard}
            efficiency={efficiency}
            avgTimePerItem={avgTimePerItem}
            dailyGoals={dailyGoals}
            sessionDuration={sessionDuration}
          />
        </div>

        {/* Moved buttons: checkpoint, reset, export daily, export stock, car request, check pending */}
        <div className="mt-2 p-2 flex flex-wrap gap-2 justify-center">
          <Button
            onClick={handleCheckpoint}
            size="sm"
            variant="outline"
            className="h-8"
            title={activeShift ? "Сохранить чекпоинт" : "Начните смену для чекпоинта"}
            disabled={!activeShift || !canManage}
          >
            <Save className="w-4 h-4 mr-1" /> Чекпоинт
          </Button>
          <Button
            onClick={handleReset}
            size="sm"
            variant="outline"
            className="h-8"
            title={activeShift ? "Сброс до чекпоинта" : "Начните смену для сброса"}
            disabled={!activeShift || !canManage}
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Сброс
          </Button>
          <Button
            onClick={handleExportDaily}
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={exportingDaily}
          >
            {exportingDaily ? <Loading text="Экспорт..." variant="generic" className="inline w-4 h-4" /> : "Экспорт дня"}
          </Button>
          <Button
            onClick={() => handleExportStock(false)}
            size="sm"
            variant="outline"
            className="h-8"
            title="Экспорт склада"
            disabled={!canManage}
          >
            <FileUp className="w-4 h-4 mr-1" /> Экспорт склада
          </Button>
          <div className="flex items-center gap-1">
            <Select value={carSize} onValueChange={setCarSize}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Тип машины" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Маленькая</SelectItem>
                <SelectItem value="medium">Средняя</SelectItem>
                <SelectItem value="large">Большая</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleSendCar}
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={sendingCar || !canManage}
            >
              {sendingCar ? <Loading text="Отправка..." variant="generic" className="inline w-4 h-4" /> : <><Car className="w-4 h-4 mr-1" /> Запрос машины</>}
            </Button>
          </div>
          <Button
            onClick={handleCheckPending}
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={checkingPending}
          >
            {checkingPending ? <Loading text="Проверка..." variant="generic" className="inline w-4 h-4" /> : "Проверить ожидающие"}
          </Button>
        </div>

        <div className="mt-4">
          <CrewWarehouseSyncButtons slug={slug!} />
        </div>
      </main>

      <WarehouseModals
        workflowItems={workflowItems}
        currentWorkflowIndex={currentWorkflowIndex}
        selectedWorkflowVoxel={selectedWorkflowVoxel}
        setSelectedWorkflowVoxel={setSelectedWorkflowVoxel}
        handleWorkflowNext={handleWorkflowNext}
        handleSkipItem={handleSkipItem}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editVoxel={editVoxel}
        editContents={editContents}
        setEditContents={setEditContents}
        saveEditQty={async (itemId: string, newQty: number) => {
          const currentQty = editContents.find(c => c.item.id === itemId)?.quantity || 0;
          const delta = newQty - currentQty;
          if (delta !== 0) optimisticUpdate(itemId, editVoxel || "A1", delta);
        }}
        gameMode={gameMode}
      />
    </div>
  );
}