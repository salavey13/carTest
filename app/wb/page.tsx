"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload, FileText, PackageSearch } from "lucide-react";
import { useWarehouse } from "@/hooks/useWarehouse";
import { WarehouseViz } from "@/components/WarehouseViz";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import FilterAccordion from "@/components/FilterAccordion";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { parse } from "papaparse";

// ---------------------------
// ВАЖНО:
// убраны топ-уровневые импорты из @/app/wb/actions и @/app/wb/common и @/app/actions
// Эти heavy-модули подгружаются динамически в обработчиках, чтобы не создавать TDZ/circular-import.
// ---------------------------

export default function WBPage() {
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
  } = useWarehouse();

  const { user, tg } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isTelegram = !!tg;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<Array<{ item: any; quantity: number; newQuantity: number }>>([]);

  const [localItems, setLocalItems] = useState<any[]>(hookItems || []);

  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);

  const [lastProcessedTotalDelta, setLastProcessedTotalDelta] = useState<number | null>(null);
  const [lastProcessedStars, setLastProcessedStars] = useState<number | null>(null);
  const [lastProcessedOffloadUnits, setLastProcessedOffloadUnits] = useState<number | null>(null);
  const [lastProcessedSalary, setLastProcessedSalary] = useState<number | null>(null);

  const [statsObj, setStatsObj] = useState<any>({ changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: 0, salary: 0 });

  const [checkingPending, setCheckingPending] = useState(false);
  const [targetOffload, setTargetOffload] = useState(0);

  // SIZE_PACK и VOXELS могут быть тяжёлыми / создавать циклы — грузим их динамически
  const [SIZE_PACK, set_SIZE_PACK] = useState<Record<string, number> | null>(null);
  const [VOXELS, set_VOXELS] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const common = await import("@/app/wb/common");
        if (!mounted) return;
        set_SIZE_PACK(common.SIZE_PACK || null);
        set_VOXELS(common.VOXELS || null);
      } catch (err) {
        console.warn("Failed to load common dynamically:", err);
        set_SIZE_PACK(null);
        set_VOXELS(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const formatSec = (sec: number | null) => {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = (sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // sizeOrderMap строится на основе SIZE_PACK (динамически)
  const sizeOrderMap: Record<string, number> = useMemo(() => {
    const sp = SIZE_PACK || {};
    const keys = Object.keys(sp || {});
    const map: Record<string, number> = {};
    keys.forEach((s, idx) => (map[s.toLowerCase()] = idx + 1));
    return map;
  }, [SIZE_PACK]);

  const normalizeSizeKey = (size?: string | null) => {
    if (!size) return "";
    return size.toString().toLowerCase().trim().replace(/\s/g, "").replace(/×/g, "x");
  };

  const getSizePriority = (size: string | null): number => {
    if (!size) return 999;
    const key = normalizeSizeKey(size);
    if (key === "1.5") return 0;
    if (key === "2") return 1;
    if (key === "евро") return 2;
    if (key === "евромакси" || key === "евро макси") return 3;
    if (sizeOrderMap[key] !== undefined) return sizeOrderMap[key];
    const num = parseInt(key.replace(/[^\d]/g, ""), 10);
    if (!isNaN(num)) return 100 + num;
    return 999;
  };

  const getSeasonPriority = (season: string | null): number => {
    if (!season) return 999;
    const s = season.toString().toLowerCase();
    if (s === "лето" || s === "leto") return 1;
    if (s === "зима" || s === "zima") return 2;
    return 3;
  };

  const categorizeItem = useCallback((item: any): string => {
    const fullLower = (item.id || item.model || '').toLowerCase().trim();
    if (!fullLower) return 'other';

    // Namatras
    if (fullLower.includes('наматрасник') || fullLower.includes('namatras')) {
      const sizeMatch = fullLower.match(/(90|120|140|160|180|200)/);
      if (sizeMatch) return `namatras ${sizeMatch[0]}`;
    }

    // Linens: size and season - longer sizes first
    const sizeChecks = [
      { key: 'евро макси', val: 'evromaksi' },
      { key: 'евро', val: 'evro' },
      { key: '1.5', val: '1.5' },
      { key: '2', val: '2' }
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

    // Podushka
    if (fullLower.includes('подушка') || fullLower.includes('podushka')) {
      if (fullLower.includes('50x70') || fullLower.includes('50h70')) return 'Podushka 50h70';
      if (fullLower.includes('70x70') || fullLower.includes('70h70')) return 'Podushka 70h70';
      if (fullLower.includes('анатом')) return 'Podushka anatom';
    }

    // Navolochka
    if (fullLower.includes('наволочка') || fullLower.includes('navolochka')) {
      if (fullLower.includes('50x70') || fullLower.includes('50h70')) return 'Navolochka 50x70';
      if (fullLower.includes('70x70') || fullLower.includes('70h70')) return 'Navolochka 70h70';
    }

    return 'other';
  }, []);

  useEffect(() => setLocalItems(hookItems || []), [hookItems]);

  useEffect(() => {
    loadItems();
    if (error) toast.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, loadItems]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
    const normalizedVoxel = (voxelId || "").toString();

    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());

        if (idx === -1) {
          if (delta > 0) locs.push({ voxel: normalizedVoxel, quantity: delta });
          else if (locs.length === 1) locs[0].quantity = Math.max(0, (locs[0].quantity || 0) + delta);
          else if (locs.length > 1) {
            const biggest = [...locs].sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0))[0];
            const bIdx = locs.findIndex((l: any) => l.voxel === biggest.voxel);
            locs[bIdx].quantity = Math.max(0, (locs[bIdx].quantity || 0) + delta);
          }
        } else {
          locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        }

        const filtered = locs.filter((l) => (l.quantity || 0) > 0);

        const total = filtered.reduce((a: number, b: any) => a + (b.quantity || 0), 0);

        if (delta < 0 && selectedVoxel) {
          const stillPresent = filtered.some((l) => (l.voxel || "").toString().toLowerCase() === normalizedVoxel.toLowerCase());
          if (!stillPresent && selectedVoxel.toString().toLowerCase() === normalizedVoxel.toLowerCase()) {
            setSelectedVoxel(null);
          }
        }

        return { ...i, locations: filtered, total_quantity: total };
      })
    );

    // Send the same normalized voxel to the server — the hook will add location on positive delta if needed.
    handleUpdateLocationQty(itemId, normalizedVoxel, delta, true).catch(() => {
      loadItems();
      toast.error("Ошибка при сохранении изменений на сервере — данные перезагружены.");
    });
  };

  // --- FILE UPLOAD: dynamic import uploadWarehouseCsv from actions ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || "";
        const parsed = parse(text, { header: true, skipEmptyLines: true }).data as any[];

        // dynamic import for server actions wrapper
        const actionsMod = await import("@/app/wb/actions");
        const uploadWarehouseCsv = actionsMod?.uploadWarehouseCsv;
        if (typeof uploadWarehouseCsv !== "function") {
          throw new Error("uploadWarehouseCsv not available");
        }

        const result = await uploadWarehouseCsv(parsed, user?.id);
        setIsUploading(false);
        if (result?.success) {
          toast.success(result.message || "CSV uploaded!");
          await loadItems();
        } else {
          toast.error(result?.error || "Ошибка загрузки CSV");
        }
      } catch (err: any) {
        setIsUploading(false);
        toast.error(err?.message || "Ошибка чтения файла");
      }
    };
    reader.readAsText(file);
  };

  const handleCheckpoint = () => {
    setCheckpoint(localItems.map((i) => ({ ...i, locations: (i.locations || []).map((l: any) => ({ ...l })) })));
    setCheckpointStart(Date.now());
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    setLastProcessedTotalDelta(null);
    setLastProcessedStars(null);
    setLastProcessedOffloadUnits(null);
    setLastProcessedSalary(null);
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Checkpoint saved!");
  };

  const handleReset = () => {
    if (!checkpoint || checkpoint.length === 0) {
      toast.error("Нет сохранённого чекпоинта");
      return;
    }
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l: any) => ({ ...l })) })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Reset to checkpoint!");
  };

  const computeProcessedStats = useCallback(() => {
    if (!checkpoint || checkpoint.length === 0) return { changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: 0, salary: 0, sumsPrevious: {}, sumsCurrent: {} };
    let changedCount = 0;
    let totalDelta = 0;
    let offloadUnits = offloadCount || 0;

    // Новое: sums по категориям
    let sumsPrevious: Record<string, number> = {};
    let sumsCurrent: Record<string, number> = {};

    (checkpoint || []).forEach((cp) => {
      const cat = categorizeItem(cp);
      sumsPrevious[cat] = (sumsPrevious[cat] || 0) + (cp.total_quantity || 0);
    });

    (localItems || []).forEach((it) => {
      const cat = categorizeItem(it);
      sumsCurrent[cat] = (sumsCurrent[cat] || 0) + (it.total_quantity || 0);
    });

    (localItems || []).forEach((it) => {
      const cp = checkpoint.find((c) => c.id === it.id);
      if (!cp) return;
      const rawDelta = (it.total_quantity || 0) - (cp.total_quantity || 0);
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
  }, [localItems, checkpoint, offloadCount, onloadCount, editCount, computeProcessedStats]);

  const { changedCount: liveChangedCount, totalDelta: liveTotalDelta, stars: liveStars, offloadUnits: liveOffloadUnits, salary: liveSalary } = statsObj;

  const elapsedSec = checkpointStart ? Math.floor((Date.now() - checkpointStart) / 1000) : null;

  const checkpointDisplayMain = checkpointStart ? formatSec(elapsedSec) : (lastCheckpointDurationSec ? formatSec(lastCheckpointDurationSec) : "--:--");
  const checkpointDisplaySub = checkpointStart ? "в процессе" : (lastCheckpointDurationSec ? `последнее: ${formatSec(lastCheckpointDurationSec)}` : "не запускался");

  const processedChangedCount = checkpointStart ? liveChangedCount : (lastProcessedCount ?? 0);
  const processedTotalDelta = checkpointStart ? liveTotalDelta : (lastProcessedTotalDelta ?? 0);
  const processedStars = checkpointStart ? liveStars : (lastProcessedStars ?? 0);
  const processedOffloadUnits = checkpointStart ? liveOffloadUnits : (lastProcessedOffloadUnits ?? 0);
  const processedSalary = checkpointStart ? liveSalary : (lastProcessedSalary ?? 0);

  // --- DAILY EXPORT: dynamic import exportDailyEntry + robust client copy (clipboard API + execCommand fallback + download fallback) ---
  type ExportDailyParams = {
    sumsPrevious: Record<string, number>;
    sumsCurrent: Record<string, number>;
    gameMode: string;
    store: string;
    isTelegram?: boolean;
  };

  const callExportDailyEntry = useCallback(
    async (params: ExportDailyParams) => {
      try {
        const actionsMod = await import("@/app/wb/actions");
        const exportDailyEntry = actionsMod?.exportDailyEntry;
        if (typeof exportDailyEntry !== "function") {
          throw new Error("exportDailyEntry is not available in actions");
        }
        const res = await exportDailyEntry(
          params.sumsPrevious,
          params.sumsCurrent,
          params.gameMode,
          params.store,
          params.isTelegram ?? false
        );
        return res;
      } catch (err: any) {
        console.error("callExportDailyEntry error:", err);
        return { success: false, error: err?.message || "Daily export failed" };
      }
    },
    []
  );

  const copyTextToClipboardFallback = (text: string): boolean => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      // Prevent scrolling to bottom
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      console.warn("execCommand fallback failed:", e);
      return false;
    }
  };

  const onExportDailyClick = useCallback(async () => {
    // Build sums like before (or adapt to your real sums)
    const sumsPrev = (statsObj && (statsObj as any).sumsPrevious) || {};
    const sumsCurr = (statsObj && (statsObj as any).sumsCurrent) || {};
    const store = (user && (user.store || "main")) || "main";
    const gameModeLocal = gameMode || "default";
    const isTelegramLocal = !!tg;

    // Call server action
    const result = await callExportDailyEntry({
      sumsPrevious: sumsPrev,
      sumsCurrent: sumsCurr,
      gameMode: gameModeLocal,
      store,
      isTelegram: isTelegramLocal,
    });

    // If server returned CSV — attempt to copy to clipboard (client-side)
    if (result?.csv) {
      const csvText = result.csv as string;

      // 1) Try navigator.clipboard.writeText
      let copied = false;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(csvText);
          toast.success("CSV скопирован в буфер обмена");
          copied = true;
        }
      } catch (clipErr) {
        console.warn("navigator.clipboard.writeText failed:", clipErr);
      }

      // 2) Fallback: textarea + execCommand (synchronous)
      if (!copied) {
        try {
          const ok = copyTextToClipboardFallback(csvText);
          if (ok) {
            toast.success("CSV скопирован в буфер обмена (fallback)");
            copied = true;
          } else {
            console.warn("copyTextToClipboardFallback returned false");
          }
        } catch (e) {
          console.warn("copyTextToClipboardFallback threw", e);
        }
      }

      // 3) Final fallback: download
      if (!copied) {
        try {
          const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `otgruzka_${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success("Не удалось скопировать — CSV скачан как fallback");
        } catch (dlErr) {
          console.error("Fallback download failed:", dlErr);
          toast.error("Не удалось скопировать или скачать CSV. Проверьте права доступа.");
        }
      }
    } else {
      // No CSV returned — show server feedback
      if (result?.success) {
        toast.success("Daily export finished (no CSV returned).");
      } else {
        toast.error(`Daily export failed: ${result?.error || "unknown error"}`);
      }
    }

    // Preserve existing checkpoint behavior (if you want same semantics as other exports)
    if (checkpointStart) {
      const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
      setLastCheckpointDurationSec(durSec);
      const stats = computeProcessedStats();
      setLastProcessedCount(stats.changedCount);
      setLastProcessedTotalDelta(stats.totalDelta);
      setLastProcessedStars(stats.stars);
      setLastProcessedOffloadUnits(stats.offloadUnits);
      setLastProcessedSalary(stats.salary);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${stats.changedCount}`);

      if (gameMode === "offload") {
        try {
          const appActions = await import("@/app/actions");
          const notifyAdmin = appActions?.notifyAdmin;
          if (typeof notifyAdmin === "function") {
            const message = `Offload завершен:\nВыдано единиц: ${stats.offloadUnits}\nЗарплата: ${stats.salary} руб\nВремя: ${formatSec(durSec)}\nИзменено позиций: ${stats.changedCount}`;
            await notifyAdmin(message);
          }
        } catch (err) {
          console.warn("notifyAdmin failed:", err);
        }
      }
    }
  }, [callExportDailyEntry, statsObj, user, gameMode, tg, checkpointStart, computeProcessedStats]);

  // --- EXPORT DIFF: dynamic import exportDiffToAdmin and notifyAdmin ---
  const handleExportDiff = async () => {
    const diffData = (localItems || [])
      .flatMap((item) => (item.locations || []).map((loc: any) => {
        const checkpointLoc = checkpoint.find((ci) => ci.id === item.id)?.locations.find((cl) => cl.voxel === loc.voxel);
        const diffQty = (loc.quantity || 0) - (checkpointLoc?.quantity || 0);
        return diffQty !== 0 ? { id: item.id, diffQty, voxel: loc.voxel } : null;
      }).filter(Boolean))
      .filter(Boolean);

    if (diffData.length === 0) {
      toast.info('No changes to export');
      return;
    }

    try {
      const actionsMod = await import("@/app/wb/actions");
      const exportDiffToAdmin = actionsMod?.exportDiffToAdmin;
      if (typeof exportDiffToAdmin !== "function") throw new Error("exportDiffToAdmin not available");

      const result = await exportDiffToAdmin(diffData as any, isTelegram);

      if (isTelegram && result?.csv) {
        try { await navigator.clipboard.writeText(result.csv); toast.success("CSV скопирован в буфер обмена!"); }
        catch { /* ignore */ }
      } else if (result && result.csv) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "diff_export.csv";
        a.click();
        URL.revokeObjectURL(url);
      }

      if (checkpointStart) {
        const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
        setLastCheckpointDurationSec(durSec);
        const stats = computeProcessedStats();
        setLastProcessedCount(stats.changedCount);
        setLastProcessedTotalDelta(stats.totalDelta);
        setLastProcessedStars(stats.stars);
        setLastProcessedOffloadUnits(stats.offloadUnits);
        setLastProcessedSalary(stats.salary);
        setCheckpointStart(null);
        toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${stats.changedCount}`);
        if (gameMode === 'offload') {
          try {
            const appActions = await import("@/app/actions");
            const notifyAdmin = appActions?.notifyAdmin;
            if (typeof notifyAdmin === "function") {
              const message = `Offload завершен:\nВыдано единиц: ${stats.offloadUnits}\nЗарплата: ${stats.salary} руб\nВремя: ${formatSec(durSec)}\nИзменено позиций: ${stats.changedCount}`;
            await notifyAdmin(message);
          }
        } catch (err) {
          console.warn("notifyAdmin failed:", err);
        }
      }
    }
  } catch (err: any) {
    console.error("handleExportDiff error:", err);
    toast.error(err?.message || "Export diff failed");
  }
};

// --- EXPORT STOCK: dynamic import exportCurrentStock ---
const handleExportStock = async (summarized = false) => {
  try {
    const actionsMod = await import("@/app/wb/actions");
    const exportCurrentStock = actionsMod?.exportCurrentStock;
    if (typeof exportCurrentStock !== "function") throw new Error("exportCurrentStock not available");

    const result = await exportCurrentStock(localItems, isTelegram, summarized);
    if (isTelegram && result?.csv) {
      try { await navigator.clipboard.writeText(result.csv); toast.success("CSV скопирован в буфер обмена!"); }
      catch {
        // fallback same as daily: try execCommand, then download
        const ok = copyTextToClipboardFallback(result.csv || "");
        if (ok) toast.success("CSV скопирован в буфер обмена (fallback)");
        else {
          const blob = new Blob([result.csv || ""], { type: "text/csv;charset=utf-8" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = summarized ? "warehouse_stock_summarized.csv" : "warehouse_stock.csv";
          a.click();
          window.URL.revokeObjectURL(url);
          toast.success("CSV скачан (fallback)");
        }
      }
    } else if (result && result.csv) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = summarized ? "warehouse_stock_summarized.csv" : "warehouse_stock.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    }

    if (checkpointStart) {
      const durSec = Math.floor((Date.now() - checkpointStart) / 1000);
      setLastCheckpointDurationSec(durSec);
      const stats = computeProcessedStats();
      setLastProcessedCount(stats.changedCount);
      setLastProcessedTotalDelta(stats.totalDelta);
      setLastProcessedStars(stats.stars);
      setLastProcessedOffloadUnits(stats.offloadUnits);
      setLastProcessedSalary(stats.salary);
      setCheckpointStart(null);
      toast.success(`Экспорт сделан. Время: ${formatSec(durSec)}, изменённых позиций: ${stats.changedCount}`);
      if (gameMode === 'offload') {
        try {
          const appActions = await import("@/app/actions");
          const notifyAdmin = appActions?.notifyAdmin;
          if (typeof notifyAdmin === "function") {
            const message = `Offload завершен:\nВыдано единиц: ${stats.offloadUnits}\nЗарплата: ${stats.salary} руб\nВремя: ${formatSec(durSec)}\nИзменено позиций: ${stats.changedCount}`;
            await notifyAdmin(message);
          }
        } catch (err) {
          console.warn("notifyAdmin failed:", err);
        }
      }
    }
  } catch (err: any) {
    console.error("handleExportStock error:", err);
    toast.error(err?.message || "Export stock failed");
  }
};

// --- CHECK PENDING: dynamic import fetchWbPendingCount & fetchOzonPendingCount ---
const handleCheckPending = async () => {
  setCheckingPending(true);
  try {
    const actionsMod = await import("@/app/wb/actions");
    const fetchWbPendingCount = actionsMod?.fetchWbPendingCount;
    const fetchOzonPendingCount = actionsMod?.fetchOzonPendingCount;
    if (typeof fetchWbPendingCount !== "function" || typeof fetchOzonPendingCount !== "function") {
      throw new Error("pending count functions unavailable");
    }

    const wbRes = await fetchWbPendingCount();
    const ozonRes = await fetchOzonPendingCount();
    const wbCount = wbRes?.success ? wbRes.count : 0;
    const ozonCount = ozonRes?.success ? ozonRes.count : 0;
    const total = (wbCount || 0) + (ozonCount || 0);
    setTargetOffload(total);
    toast.success(`Pending offloads: WB ${wbCount}, Ozon ${ozonCount}. Target: ${total}`);
  } catch (err: any) {
    toast.error('Failed to check pending: ' + (err?.message || 'Unknown'));
  } finally {
    setCheckingPending(false);
  }
};

const localFilteredItems = useMemo(() => {
  const arr = (localItems || []).filter((item) => {
    const searchLower = (search || "").toLowerCase();
    const matchesSearch = ((item.name || "") + " " + (item.description || "")).toLowerCase().includes(searchLower);
    const matchesSeason = !filterSeason || item.season === filterSeason;
    const matchesPattern = !filterPattern || item.pattern === filterPattern;
    const matchesColor = !filterColor || item.color === filterColor;
    const matchesSize = !filterSize || item.size === filterSize;
    return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
  });

  const sorted = [...arr].sort((a, b) => {
    switch (sortOption) {
      case 'size_season_color': {
        const sizeCmp = getSizePriority(a.size) - getSizePriority(b.size);
        if (sizeCmp !== 0) return sizeCmp;
        const seasonCmp = getSeasonPriority(a.season) - getSeasonPriority(b.season);
        if (seasonCmp !== 0) return seasonCmp;
        return (a.color || "").localeCompare(b.color || "");
      }
      case 'color_size': {
        const colorCmp = (a.color || "").localeCompare(b.color || "");
        if (colorCmp !== 0) return colorCmp;
        return getSizePriority(a.size) - getSizePriority(b.size);
      }
      case 'season_size_color': {
        const seasonCmp = getSeasonPriority(a.season) - getSeasonPriority(b.season);
        if (seasonCmp !== 0) return seasonCmp;
        const sizeCmp = getSizePriority(a.size) - getSizePriority(b.size);
        if (sizeCmp !== 0) return sizeCmp;
        return (a.color || "").localeCompare(b.color || "");
      }
      default:
        return 0;
    }
  });

  return sorted;
}, [localItems, search, filterSeason, filterPattern, filterColor, filterSize, sortOption, SIZE_PACK]);

const handlePlateClickCustom = (voxelId: string) => {
  handlePlateClick(voxelId);
  const content = localItems.flatMap((i) => (i.locations || []).filter((l: any) => l.voxel === voxelId && (l.quantity || 0) > 0).map((l: any) => ({ item: i, quantity: l.quantity })));
  if (gameMode === "onload" || gameMode === "offload") {
    setSelectedVoxel(voxelId);
    if (gameMode === "onload") toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — добавь товар нажатием на карточки` : `Выбрана ячейка ${voxelId}`);
    else toast.info(content.length === 0 ? `Выбрана ячейка ${voxelId} — нет товаров` : `Выбрана ячейка ${voxelId}`);
    return;
  }
  if (content.length > 0) {
    setEditVoxel(voxelId);
    setEditContents(content.map((c) => ({ item: c.item, quantity: c.quantity, newQuantity: c.quantity })));
    setEditDialogOpen(true);
  } else setSelectedVoxel(voxelId);
};

const handleItemClickCustom = async (item: any) => {
  if (!item) return;
  if (gameMode === "onload") {
    const targetVoxel = selectedVoxel || "A1";
    setSelectedVoxel(targetVoxel);
    optimisticUpdate(item.id, targetVoxel, 1);
    toast.success(`Добавлено в ${targetVoxel}`);
    return;
  }
  if (gameMode === "offload") {
    let loc;
    const selVoxelNorm = selectedVoxel ? selectedVoxel.toString().toLowerCase() : null;
    if (selectedVoxel) {
      loc = (item.locations || []).find((l: any) => (l.voxel || "").toString().toLowerCase() === selVoxelNorm && (l.quantity || 0) > 0);
      if (!loc) {
        const nonEmpty = (item.locations || []).filter((l: any) => (l.quantity || 0) > 0);
        if (nonEmpty.length === 1) {
          loc = nonEmpty[0];
          toast.info(`В выбранной ячейке нет товара — списываю из ${loc.voxel} (единственная ячейка с товаром).`);
        } else return toast.error("Нет товара в выбранной ячейке");
      }
    } else {
      const nonEmpty = (item.locations || []).filter((l: any) => (l.quantity || 0) > 0);
      if (nonEmpty.length === 0 || (item.total_quantity || 0) <= 0) return toast.error("Нет товара на складе");
      if (nonEmpty.length > 1) return toast.error("Выберите ячейку для выдачи (несколько локаций)");
      loc = nonEmpty[0];
    }
    if (loc) {
      const voxel = loc.voxel;
      optimisticUpdate(item.id, voxel, -1);
      toast.success(`Выдано из ${voxel}`);
    } else toast.error("Нет товара на складе");
    return;
  }
  handleItemClick(item);
};

return (
  <div className="flex flex-col min-h-screen bg-background text-foreground">
    <header className="p-2 flex flex-col gap-2">
      <div className="flex justify-between items-center gap-2">
        <Select value={gameMode === null ? "none" : gameMode} onValueChange={(v: any) => setGameMode(v === "none" ? null : v)}>
          <SelectTrigger className="w-28 text-[10px]">
            <SelectValue placeholder="Режим" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none"><div className="flex items-center gap-2"><FileText size={12} /> <span>Без режима</span></div></SelectItem>
            <SelectItem value="onload"><div className="flex items-center gap-2"><Upload size={12} /> <span>Прием</span></div></SelectItem>
            <SelectItem value="offload"><div className="flex items-center gap-2"><Download size={12} /> <span>Выдача</span></div></SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckpoint}><Save size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleReset}><RotateCcw size={12} /></Button>
          {/* ЗДЕСЬ: onExportDailyClick */}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onExportDailyClick}><Download size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(false)}><FileUp size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleExportStock(true)}><FileText size={12} /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={12} /></Button>
          <input ref={fileInputRef as any} type="file" onChange={handleFileChange} className="hidden" accept=".csv,.CSV,.txt,text/csv,text/plain" />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCheckPending} disabled={checkingPending}>{checkingPending ? <PackageSearch className="animate-spin" size={12} /> : <PackageSearch size={12} />}</Button>
          <Link href="/csv-compare"><Button size="sm" variant="outline" className="text-[10px]">CSV</Button></Link>
        </div>
      </div>

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
        onResetFilters={() => { setFilterSeason(null); setFilterPattern(null); setFilterColor(null); setFilterSize(null); setSearch(""); }}
        includeSearch={true}
        search={search}
        setSearch={setSearch}
        sortOption={sortOption}
        setSortOption={setSortOption}
      />
    </header>

    <div className="flex-1 overflow-y-auto p-2">
      <Card className="mb-2">
        <CardHeader className="p-2">
          <CardTitle className="text-xs">Товары ({localFilteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-5 gap-2 p-2 max-h-[69vh] overflow-y-auto">
          {localFilteredItems.map((item) => (
            <WarehouseItemCard key={item.id} item={item} onClick={() => handleItemClickCustom(item)} />
          ))}
        </CardContent>
      </Card>

      <div className="mt-2">
        <WarehouseViz
          items={localItems}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={setSelectedVoxel}
          onUpdateLocationQty={(itemId: string, voxelId: string, qty: number) => optimisticUpdate(itemId, voxelId, qty)}
          gameMode={gameMode}
          onPlateClick={handlePlateClickCustom}
          VOXELS={VOXELS || []}
        />
      </div>

      <div className="mt-4">
        <WarehouseStats
          itemsCount={localItems.length}
          uniqueIds={new Set(localItems.map(i => i.id)).size}
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
    </div>

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
        if (!editVoxel) return;
        const currentContent = editContents.find(c => c.item.id === itemId);
        if (!currentContent) return;
        const delta = newQty - currentContent.quantity;
        optimisticUpdate(itemId, editVoxel, delta);
      }}
      gameMode={gameMode}
      VOXELS={VOXELS || []}
    />
  </div>
);
}