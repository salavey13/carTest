"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, RotateCcw, Download, FileUp, PackageSearch } from "lucide-react";
import { useCrewWarehous, getSizePriority } from "./warehouseHooks";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import ShiftControls from "@/components/ShiftControls";
import { CrewWarehouseSyncButtons } from "@/components/CrewWarehouseSyncButtons";
import FilterAccordion from "@/components/FilterAccordion";
import { useAppContext } from "@/contexts/AppContext";
import { notifyCrewOwner } from "./actions_notify";
import { exportCrewCurrentStock, exportDailyEntryForShift } from "./actions_csv";
import { fetchCrewWbPendingCount, fetchCrewOzonPendingCount } from "./actions_sync";
import { getCrewMemberStatus } from "./actions_shifts";
import { saveCrewCheckpoint, resetCrewCheckpoint } from "./actions_shifts";

export default function CrewWarehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string | undefined;
  const { dbUser } = useAppContext();

  const warehouse = useCrewWarehouse(slug || "");
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
  const [targetOffload, setTargetOffload] = useState(0);

  const uniqueSeasons = useMemo(() => [...new Set(localItems.map(i => i.season).filter(Boolean))].sort(), [localItems]);
  const uniquePatterns = useMemo(() => [...new Set(localItems.map(i => i.pattern).filter(Boolean))].sort(), [localItems]);
  const uniqueColors = useMemo(() => [...new Set(localItems.map(i => i.color).filter(Boolean))].sort(), [localItems]);
  const uniqueSizes = useMemo(() => [...new Set(localItems.map(i => i.size).filter(Boolean))].sort((a,b) => getSizePriority(a) - getSizePriority(b)), [localItems]);

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const loadStatus = async () => {
    if (!slug || !dbUser?.user_id) return;
    const statusRes = await getCrewMemberStatus(slug, dbUser.user_id);
    if (statusRes.success) setLiveStatus(statusRes.live_status || null);
    const shiftRes = await getActiveShiftForCrewMember(slug, dbUser.user_id);
    setActiveShift(shiftRes.shift || null);
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 30000);
    return () => clearInterval(poll);
  }, [slug, dbUser?.user_id]);

  const canManage = useMemo(() => {
    const globalAdmin = !!dbUser && (dbUser.status === "admin" || dbUser.is_admin);
    const memberOk = !!memberRole;
    return !!(isOwner || memberOk || globalAdmin);
  }, [dbUser, memberRole, isOwner]);

  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
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

    handleUpdateLocationQty(itemId, voxelId, delta, true).catch(() => {
      loadItems();
      toast.error("Server update failed - reloaded");
    });
  };

  const handleCheckpoint = async () => {
    const snapshot = localItems.map(i => ({ id: i.id, locations: i.locations.map(l => ({ voxel: l.voxel, quantity: l.quantity })) }));
    setCheckpoint(snapshot);
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Checkpoint saved locally");

    if (dbUser?.user_id) {
      const res = await saveCrewCheckpoint(slug, dbUser.user_id, snapshot);
      if (res.success) toast.success("Checkpoint saved to server");
      else toast.error("Server checkpoint save failed");
    }
  };

  const handleReset = async () => {
    if (!checkpoint.length) return toast.error("No checkpoint");
    setLocalItems(checkpoint.map(i => ({ ...i, locations: [...i.locations] })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Reset to checkpoint (local)");

    if (dbUser?.user_id) {
      const res = await resetCrewCheckpoint(slug, dbUser.user_id);
      if (res.success) {
        toast.success(`Server reset applied (${res.applied} items)`);
        loadItems();
      } else {
        toast.error("Server reset failed");
      }
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
      if (fullLower.includes('50x70') || fullLower.includes('50h70')) return 'Podushka 50h70';
      if (fullLower.includes('70x70') || fullLower.includes('70h70')) return 'Podushka 70h70';
      if (fullLower.includes('анатом') || fullLower.includes('anatom')) return 'Podushka anatom';
    }

    if (fullLower.includes('наволочка') || fullLower.includes('navolochka')) {
      if (fullLower.includes('50x70') || fullLower.includes('50h70')) return 'Navolochka 50x70';
      if (fullLower.includes('70x70') || fullLower.includes('70h70')) return 'Navolochka 70h70';
    }

    return 'other';
  };

  const computeProcessedStats = useCallback(() => {
    if (!checkpoint.length) return { changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: 0, salary: 0, sumsPrevious: {}, sumsCurrent: {} };
    let changedCount = 0;
    let totalDelta = 0;
    let offloadUnits = offloadCount || 0;

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

    const stars = 0;
    const salary = offloadUnits * 50;
    return { changedCount, totalDelta, stars, offloadUnits, salary, sumsPrevious, sumsCurrent };
  }, [localItems, checkpoint, offloadCount]);

  useEffect(() => {
    const stats = computeProcessedStats();
    setStatsObj(stats);
  }, [computeProcessedStats]);

  const handleExportDaily = async () => {
    const freshStats = computeProcessedStats();
    const sumsPrev = freshStats.sumsPrevious || {};
    const sumsCurr = freshStats.sumsCurrent || {};
    const store = dbUser?.store || "main";
    const gameModeLocal = gameMode || "default";

    const res = await exportDailyEntryForShift(slug, { isTelegram: false });

    if (res?.success && res.csv) {
      const copied = await safeCopyToClipboard(res.csv);
      if (copied) toast.success("Daily TSV copied");
      else {
        const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `daily_offload_${slug}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Daily TSV downloaded");
      }

      await notifyCrewOwner(slug, `Daily export by @${dbUser?.username || "user"}\n${res.csv}`, dbUser?.user_id);
    } else {
      toast.error(res?.error || "Export failed");
    }
  };

  const handleSendCar = async () => {
    if (!canManage) return toast.error("Only owner/member/admin can request car");
    try {
      const msg = `Car request: crew=${slug} by ${dbUser?.user_id || "unknown"} — please check on portal.`;
      await notifyCrewOwner(slug, msg, dbUser?.user_id);
      toast.success("Car request sent to owner");
    } catch (err) {
      toast.error("Send car failed");
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
      toast.success(`Pending offloads: WB ${wbCount}, Ozon ${ozonCount}. Target: ${total}`);
    } catch (err: any) {
      toast.error("Pending check failed: " + (err?.message || 'Unknown'));
    } finally {
      setCheckingPending(false);
    }
  };

  const handleExportStock = async (summarized = false) => {
    const res = await exportCrewCurrentStock(slug, localItems, summarized);
    if (res.success && res.csv) {
      const copied = await safeCopyToClipboard(res.csv);
      if (copied) toast.success("Stock copied to clipboard");
      else {
        const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = summarized ? `stock_summary_${slug}.tsv` : `stock_${slug}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Stock exported successfully");
      }
    } else {
      toast.error(res.error || "Export failed");
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

  const filteredItems = hookFilteredItems;

  if (loading) return <div className="p-4">Loading crew warehouse...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="p-3 bg-white dark:bg-gray-800 shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex items-center gap-3">
            {crew?.logo_url && <img src={crew.logo_url} alt="logo" className="w-7 h-7 rounded object-cover" />}
            <div>
              <h1 className="text-lg font-medium leading-tight">{crew?.name || "Crew"}</h1>
              <div className="text-xs text-gray-500">
                Shift: {activeShift ? (activeShift.shift_type || "warehouse") : "none"} · Status: {liveStatus || (activeShift ? "active" : "offline")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ShiftControls slug={slug!} />

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={gameMode === "onload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "onload" ? null : "onload")}
                className="px-2 py-1 text-xs"
                title="Onload (add items)"
                disabled={!canManage}
              >
                +Load
              </Button>
              <Button
                size="sm"
                variant={gameMode === "offload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "offload" ? null : "offload")}
                className="px-2 py-1 text-xs"
                title="Offload (remove items)"
                disabled={!canManage}
              >
                −Unload
              </Button>
            </div>

            <div className="flex gap-1 items-center ml-0 flex-wrap">
              <Button onClick={handleCheckpoint} size="sm" variant="outline" className="w-8 h-8 p-1" title={activeShift ? "Save checkpoint" : "Start shift to enable checkpoint"} disabled={!activeShift || !canManage}>
                <Save className="w-3 h-3" />
              </Button>

              <Button onClick={handleReset} size="sm" variant="outline" className="w-8 h-8 p-1" title={activeShift ? "Reset to checkpoint" : "Start shift to enable reset"} disabled={!activeShift || !canManage}>
                <RotateCcw className="w-3 h-3" />
              </Button>

              <Button onClick={handleExportDaily} size="sm" variant="ghost" className="h-8 ml-1 text-xs">
                Export daily
              </Button>

              <Button onClick={() => handleExportStock(false)} size="sm" variant="outline" className="w-8 h-8 p-1" title="Export stock" disabled={!canManage}>
                <FileUp className="w-3 h-3" />
              </Button>

              <Button onClick={handleSendCar} size="sm" variant="secondary" className="h-8 ml-2 text-xs" disabled={!canManage}>
                Send car
              </Button>

              <Button onClick={handleCheckPending} size="sm" variant="ghost" className="h-8 text-xs" disabled={checkingPending}>
                {checkingPending ? "Checking..." : "Check pending"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3">
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
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-1">
              {hookFilteredItems.map((item) => (
                <WarehouseItemCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
              ))}
            </div>
            {hookFilteredItems.length === 0 && <div className="text-center py-8 text-gray-500">No items found</div>}
          </CardContent>
        </Card>

        <WarehouseViz
          items={localItems}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={setSelectedVoxel}
          onPlateClick={handlePlateClick}
          gameMode={gameMode}
        />

        <div className="mt-4">
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

        <div className="mt-6">
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