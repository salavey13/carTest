"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, FileUp, Car } from "lucide-react";
import { useCrewWarehouse } from "./warehouseHooks";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import ShiftControls from "@/components/ShiftControls";
import { CrewWarehouseSyncButtons } from "@/components/CrewWarehouseSyncButtons";
import FilterAccordion from "@/components/FilterAccordion";
import { notifyCrewOwner } from "./actions_notify";
import { exportCrewCurrentStock, exportCrewDailyShift } from "./actions_csv";
import { fetchCrewWbPendingCount, fetchCrewOzonPendingCount } from "./actions_sync";
import { getCrewMemberStatus, getActiveShiftForCrewMember, getLastClosedShiftToday } from "./actions_shifts";
import { saveCrewCheckpoint, resetCrewCheckpoint } from "./actions_shifts";
import { Loading } from "@/components/Loading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppContext } from "@/contexts/AppContext";

export default function CrewWarehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string | undefined;

  const toast = useAppToast();
  const { dbUser, userCrewInfo } = useAppContext();

  const wh = useCrewWarehouse(slug || "");
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
    registerNotifier,
  } = wh as any;

  const [localItems, setLocalItems] = useState<any[]>(hookItems || []);
  const [crew, setCrew] = useState<any | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
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
  const [carSize, setCarSize] = useState<"small" | "medium" | "large">("medium");

  const uniqueSeasons = useMemo(() => [...new Set(localItems.map(i => i.season).filter(Boolean))].sort(), [localItems]);
  const uniquePatterns = useMemo(() => [...new Set(localItems.map(i => i.pattern).filter(Boolean))].sort(), [localItems]);
  const uniqueColors = useMemo(() => [...new Set(localItems.map(i => i.color).filter(Boolean))].sort(), [localItems]);
  const uniqueSizes = useMemo(() => [...new Set(localItems.map(i => i.size).filter(Boolean))].sort((a, b) => getSizePriority(a) - getSizePriority(b)), [localItems, getSizePriority]);

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    if (!registerNotifier || !toast) return;
    const notifier = (type: string, message: string | any, opts?: any) => {
      if (type === "success") return toast.success(message as any, opts);
      if (type === "error") return toast.error(message as any, opts);
      if (type === "warning") return toast.warning(message as any, opts);
      if (type === "info") return toast.info(message as any, opts);
      return toast.message(String(message), opts);
    };
    registerNotifier(notifier);
    return () => registerNotifier(null);
  }, [registerNotifier, toast]);

  useEffect(() => {
    const fetchCrew = async () => {
      if (!slug) return;
      const { data, error } = await supabaseAdmin
        .from("crews")
        .select("id, name, slug, owner_id, logo_url")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();
      if (error) { toast.error("Ошибка загрузки экипажа"); return; }
      setCrew(data || null);
      const uid = dbUser?.user_id || dbUser?.id || null;
      if (data?.owner_id && uid) setIsOwner(String(data.owner_id) === String(uid));
      else if (userCrewInfo?.is_owner) setIsOwner(true);
      else setIsOwner(false);
    };
    fetchCrew();
  }, [slug, dbUser, userCrewInfo, toast]);

  const loadStatus = useCallback(async () => {
    if (!slug || !dbUser?.user_id) return;
    try {
      const uid = String(dbUser.user_id || dbUser.id);
      const statusRes = await getCrewMemberStatus(slug, uid);
      if (statusRes?.success) {
        setLiveStatus(statusRes.live_status || null);
        const member = statusRes.member || null;
        setMembershipStatus(member?.membership_status || null);
        setMemberRole(member?.role || null);
      }
      const shiftRes = await getActiveShiftForCrewMember(slug, uid);
      setActiveShift(shiftRes.shift || null);
    } catch { toast.error("Ошибка статуса"); }
  }, [slug, dbUser, toast]);

  useEffect(() => { loadStatus(); const poll = setInterval(loadStatus, 30000); return () => clearInterval(poll); }, [loadStatus]);

  const canManage = useMemo(() => {
    const isGlobalAdmin = Boolean(dbUser?.status === "admin" || dbUser?.role === "admin");
    const isActiveMember = membershipStatus === "active";
    const owner = isOwner;
    if (memberRole === "car_observer" && !owner && !isActiveMember && !isGlobalAdmin) return false;
    return Boolean(owner || isActiveMember || isGlobalAdmin);
  }, [dbUser, membershipStatus, memberRole, isOwner]);

  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
    setLocalItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const locs = (i.locations || []).map(l => ({ ...l }));
      const idx = locs.findIndex(l => l.voxel === voxelId);
      if (idx !== -1) locs[idx].quantity = Math.max(0, locs[idx].quantity + delta);
      else if (delta > 0) locs.push({ voxel: voxelId, quantity: delta });
      const filtered = locs.filter(l => l.quantity > 0);
      const newTotal = filtered.reduce((acc, l) => acc + l.quantity, 0);
      return { ...i, locations: filtered, total_quantity: newTotal };
    }));
    const absDelta = Math.abs(delta);
    if (gameMode === "onload" && delta > 0) setOnloadCount(p => p + absDelta);
    else if (gameMode === "offload" && delta < 0) setOffloadCount(p => p + absDelta);
    else setEditCount(p => p + absDelta);
    handleUpdateLocationQty(itemId, voxelId, delta, true).catch(() => { loadItems(); toast.error("Ошибка сервера"); });
  };

  const handleCheckpoint = async () => {
    if (!canManage) return toast.error("Нет прав");
    const snapshot = localItems.map(i => ({ id: i.id, locations: i.locations.map(l => ({ voxel: l.voxel, quantity: l.quantity })) }));
    setCheckpoint(snapshot);
    setCheckpointStart(Date.now());
    setOnloadCount(0); setOffloadCount(0); setEditCount(0);
    toast.success("Чекпоинт локально");
    try {
      const res = await saveCrewCheckpoint(slug, String(dbUser?.user_id), snapshot);
      if (res.success) toast.success("Чекпоинт на сервере");
    } catch { toast.error("Ошибка сервера"); }
  };

  const handleReset = async () => {
    if (!canManage || !checkpoint.length) return toast.error("Нет чекпоинта");
    setLocalItems(checkpoint.map(i => ({ ...i, locations: [...i.locations] })));
    setCheckpointStart(null);
    setOnloadCount(0); setOffloadCount(0); setEditCount(0);
    toast.success("Сброс локально");
    try {
      const res = await resetCrewCheckpoint(slug, String(dbUser?.user_id));
      if (res.success) { toast.success(`Сброс на сервере (${res.applied})`); loadItems(); }
    } catch { toast.error("Ошибка сброса"); }
  };

  const handleExportDaily = async () => {
    setExportingDaily(true);
    try {
      let shift = activeShift;
      if (!shift) {
        const last = await getLastClosedShiftToday(slug, dbUser?.user_id);
        if (last) shift = last;
      }
      if (!shift) { toast.error("Нет данных за сегодня"); setExportingDaily(false); return; }

      const res = await exportCrewDailyShift(slug, false);
      if (res?.success && res.csv) {
        const copied = await navigator.clipboard.writeText(res.csv).then(() => true).catch(() => false);
        if (copied) toast.success("Отчёт в буфере");
        else {
          const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `daily_${slug}.tsv`; a.click();
          URL.revokeObjectURL(url);
          toast.success("Отчёт скачан");
        }
      } else toast.error(res?.error || "Ошибка экспорта");
    } catch { toast.error("Критическая ошибка"); } finally { setExportingDaily(false); }
  };

  const handleSendCar = async () => {
    if (!canManage) return toast.error("Нет прав");
    setSendingCar(true);
    try {
      await notifyCrewOwner(slug, `Запрос машины: ${carSize}`);
      toast.success("Запрос отправлен");
    } catch { toast.error("Ошибка отправки"); } finally { setSendingCar(false); }
  };

  const handleCheckPending = async () => {
    setCheckingPending(true);
    try {
      const [wbRes, ozonRes] = await Promise.all([fetchCrewWbPendingCount(slug), fetchCrewOzonPendingCount(slug)]);
      const total = (wbRes.success ? wbRes.count : 0) + (ozonRes.success ? ozonRes.count : 0);
      toast.warning(`Заказы: WB ${wbRes.count || 0} | Ozon ${ozonRes.count || 0} | Всего ${total}`);
    } catch { toast.error("Ошибка проверки"); } finally { setCheckingPending(false); }
  };

  const handleExportStock = async (summarized = false) => {
    try {
      const res = await exportCrewCurrentStock(slug, localItems, summarized);
      if (res.success && res.csv) {
        const copied = await navigator.clipboard.writeText(res.csv).then(() => true).catch(() => false);
        if (copied) toast.success("Склад в буфере");
        else {
          const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = summarized ? `stock_summary_${slug}.tsv` : `stock_${slug}.tsv`; a.click();
          URL.revokeObjectURL(url);
          toast.success("Склад скачан");
        }
      }
    } catch { toast.error("Ошибка экспорта"); }
  };

  const handlePlateClickCustom = useCallback((voxelId: string) => {
    if (gameMode) { handlePlateClick(voxelId); return; }
    setEditVoxel(voxelId);
    const contents = localItems.flatMap(i => i.locations.filter(l => l.voxel === voxelId && l.quantity > 0).map(l => ({ item: i, quantity: l.quantity, newQuantity: l.quantity })));
    setEditContents(contents);
    setEditDialogOpen(true);
  }, [gameMode, handlePlateClick, localItems]);

  const handleItemClickCustom = useCallback((item: any) => {
    if (gameMode) { handleItemClick(item); return; }
    const voxelId = selectedVoxel || item.locations[0]?.voxel || "A1";
    const loc = item.locations.find(l => l.voxel === voxelId);
    setEditContents(loc ? [{ item, quantity: loc.quantity, newQuantity: loc.quantity }] : []);
    setEditVoxel(voxelId);
    setEditDialogOpen(true);
  }, [gameMode, handleItemClick, selectedVoxel]);

  if (loading) return <Loading text="Загрузка..." />;
  if (error) return <div className="p-2 text-red-500">Ошибка: {error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm p-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            {crew?.logo_url && <img src={crew.logo_url} alt="logo" className="w-6 h-6 rounded object-cover" />}
            <h1 className="text-sm font-medium truncate max-w-[180px] sm:max-w-none">{crew?.name || "Экипаж"}</h1>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <ShiftControls slug={slug!} />
            <div className="flex gap-1">
              <Button size="sm" variant={gameMode === "onload" ? "default" : "outline"} onClick={() => setGameMode(prev => prev === "onload" ? null : "onload")} className="h-7 min-w-[58px] text-xs" disabled={!canManage}>+Загрузка</Button>
              <Button size="sm" variant={gameMode === "offload" ? "default" : "outline"} onClick={() => setGameMode(prev => prev === "offload" ? null : "offload")} className="h-7 min-w-[58px] text-xs" disabled={!canManage}>−Выгрузка</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-2 pb-20 sm:pb-2">
        {/* СКЛАД */}
        <Card className="mb-2">
          <CardHeader className="p-2 pb-1">
            <CardTitle className="text-base">Склад</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {hookFilteredItems.map((item) => (
                <div key={item.id} className="min-w-0">
                  <WarehouseItemCard item={item} onClick={() => handleItemClickCustom(item)} />
                </div>
              ))}
            </div>
            {hookFilteredItems.length === 0 && <p className="text-center py-4 text-gray-500 text-sm">Товары не найдены</p>}
          </CardContent>
        </Card>

        {/* ФИЛЬТРЫ */}
        <div className="mb-2">
          <FilterAccordion
            filterSeason={filterSeason} setFilterSeason={setFilterSeason}
            filterPattern={filterPattern} setFilterPattern={setFilterPattern}
            filterColor={filterColor} setFilterColor={setFilterColor}
            filterSize={filterSize} setFilterSize={setFilterSize}
            items={localItems}
            onResetFilters={() => { setFilterSeason(null); setFilterPattern(null); setFilterColor(null); setFilterSize(null); setSearch(""); }}
            includeSearch search={search} setSearch={setSearch}
            sortOption={sortOption as any} setSortOption={setSortOption as any}
          />
        </div>

        {/* ВИЗУАЛИЗАЦИЯ */}
        <div className="mb-2">
          <WarehouseViz
            items={localItems}
            selectedVoxel={selectedVoxel}
            onSelectVoxel={setSelectedVoxel}
            onPlateClick={handlePlateClickCustom}
            gameMode={gameMode}
          />
        </div>

        {/* СТАТИСТИКА */}
        <div className="mb-2">
          <WarehouseStats
            itemsCount={localItems.reduce((s, it) => s + (it.total_quantity || 0), 0)}
            uniqueIds={localItems.length}
            score={score} level={level} streak={streak} dailyStreak={dailyStreak}
            checkpointMain={checkpointStart ? formatSec(Math.floor((Date.now() - checkpointStart) / 1000)) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--")}
            checkpointSub={checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался")}
            changedCount={checkpointStart ? statsObj.changedCount : (lastProcessedCount ?? 0)}
            totalDelta={checkpointStart ? statsObj.totalDelta : (lastProcessedTotalDelta ?? 0)}
            stars={checkpointStart ? statsObj.stars : (lastProcessedStars ?? 0)}
            offloadUnits={checkpointStart ? statsObj.offloadUnits : (lastProcessedOffloadUnits ?? 0)}
            salary={checkpointStart ? statsObj.salary : (lastProcessedSalary ?? 0)}
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

        {/* НИЖНИЕ КНОПКИ — ПОЛНОСТЬЮ АДАПТИВНАЯ СЕТКА */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
          <Button onClick={handleCheckpoint} size="sm" variant="outline" className="h-8 text-xs" disabled={!activeShift || !canManage}>
            <Save className="w-4 h-4 mr-1" /> Чекпоинт
          </Button>
          <Button onClick={handleReset} size="sm" variant="outline" className="h-8 text-xs" disabled={!activeShift || !canManage}>
            <RotateCcw className="w-4 h-4 mr-1" /> Сброс
          </Button>
          <Button onClick={handleExportDaily} size="sm" variant="ghost" className="h-8 text-xs" disabled={exportingDaily}>
            {exportingDaily ? "Экспорт…" : "Экспорт дня"}
          </Button>
          <Button onClick={() => handleExportStock(false)} size="sm" variant="outline" className="h-8 text-xs" disabled={!canManage}>
            <FileUp className="w-4 h-4 mr-1" /> Экспорт склада
          </Button>
          <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
            <Select value={carSize} onValueChange={setCarSize}>
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Тип" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Маленькая</SelectItem>
                <SelectItem value="medium">Средняя</SelectItem>
                <SelectItem value="large">Большая</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSendCar} size="sm" variant="secondary" className="h-8 flex-1" disabled={sendingCar || !canManage}>
              {sendingCar ? "…" : <Car className="w-4 h-4" />}
            </Button>
          </div>
          <Button onClick={handleCheckPending} size="sm" variant="ghost" className="h-8 text-xs" disabled={checkingPending}>
            {checkingPending ? "…" : "Проверить заказы"}
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
        saveEditQty={async (itemId, newQty) => {
          const current = editContents.find(c => c.item.id === itemId)?.quantity || 0;
          const delta = newQty - current;
          if (delta !== 0) optimisticUpdate(itemId, editVoxel || "A1", delta);
        }}
        gameMode={gameMode}
      />
    </div>
  );
}

// Утилита для времени
const formatSec = (sec: number | null) => {
  if (sec === null) return "--:--";
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};