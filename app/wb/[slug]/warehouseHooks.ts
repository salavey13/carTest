"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getCrewWarehouseItems, updateCrewItemLocationQty } from "./actions_crud";
import { logger } from "@/lib/logger";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase"; 

export const getSizePriority = (size: string | null): number => {
  if (!size) return 999;
  const sizeOrder: Record<string, number> = {
    "1.5": 1,
    "2": 2,
    "евро": 3,
    "евро макси": 4,
  };
  return sizeOrder[size as string] || 5;
};

const getSeasonPriority = (season: string | null): number => {
  if (!season) return 999;
  const seasonOrder: Record<string, number> = {
    "лето": 1,
    "зима": 2,
  };
  return seasonOrder[season as string] || 3;
};

type Notifier = (type: "success" | "error" | "info" | "warning" | "custom" | string, message: string | any, opts?: any) => void;

export function useCrewWarehouse(slug: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<any[]>([]);
  const [workflowItems, setWorkflowItems] = useState<{ id: string; change: number; voxel?: string }[]>([]);
  const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0);
  const [selectedWorkflowVoxel, setSelectedWorkflowVoxel] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<"offload" | "onload" | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [sessionStart, setSessionStart] = useState(Date.now());
  const [bossMode, setBossMode] = useState(false);
  const [bossTimer, setBossTimer] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; date: string; xtr: number }[]>([]);
  const { dbUser } = useAppContext();
  const bossIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [onloadCount, setOnloadCount] = useState(0);
  const [offloadCount, setOffloadCount] = useState(0);
  const [editCount, setEditCount] = useState(0);

  const [search, setSearch] = useState("");
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);

  const notifierRef = useRef<Notifier | null>(null);
  const setNotifier = useCallback((fn: Notifier | null) => { notifierRef.current = fn; }, []);

  const fireNotify = useCallback((type: Parameters<Notifier>[0], message: Parameters<Notifier>[1], opts?: any) => {
    if (notifierRef.current) {
      try { notifierRef.current(type, message, opts); return; } 
      catch (err) { logger.error("Notifier threw error:", err); }
    }
    if (type === "error") logger.error(String(message));
    else if (type === "warning") logger.warn(String(message));
    else logger.info(String(message));
  }, []);

  const dailyGoals = useMemo(() => ({ units: 100, errors: 0, xtr: 100 }), []);
  const sessionDuration = useMemo(() => Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)), [sessionStart]);
  const efficiency = useMemo(() => sessionDuration === 0 ? 0 : Math.round((offloadCount / (sessionDuration / 3600)) * 10) / 10, [offloadCount, sessionDuration]);
  const avgTimePerItem = useMemo(() => (offloadCount === 0 || sessionDuration === 0) ? 0 : Math.round((sessionDuration / offloadCount) * 100) / 100, [offloadCount, sessionDuration]);

  // --- 🏆 ACHIEVEMENT ENGINE (RESTORED) ---
  const checkAchievements = useCallback(() => {
    setAchievements((prev) => {
      const newAch = [...prev];
      if (streak === 20 && !newAch.includes("Streak Master")) newAch.push("Streak Master");
      if (score > 1000 && !newAch.includes("High Scorer")) newAch.push("High Scorer");
      if (efficiency >= 50 && !newAch.includes("Efficiency Expert")) newAch.push("Efficiency Expert");
      if (offloadCount >= 200 && !newAch.includes("Warehouse Warrior")) newAch.push("Warehouse Warrior");
      
      const xtrEarned = newAch.filter(a => a.includes("XTR")).length * 50;
      if (xtrEarned > 0) fireNotify("success", `Заработано ${xtrEarned} XTR!`, { icon: "⭐" });
      
      return newAch.slice(-8);
    });
  }, [streak, score, efficiency, offloadCount, fireNotify]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { success, data, error: fetchError } = await getCrewWarehouseItems(slug);
    if (success && data) {
      const mappedItems = data.map((i: any) => {
        const locations = (i.specs?.warehouse_locations || []).map((l: any) => ({
          voxel: l.voxel_id,
          quantity: l.quantity,
          min_qty: l.voxel_id?.startsWith?.("B") ? 3 : undefined,
        })).sort((a: any, b: any) => (a.voxel || "").localeCompare(b.voxel || ""));

        const sumQty = locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
        return {
          id: i.id,
          name: `${i.make} ${i.model}`,
          description: i.description || "",
          image: i.image_url,
          locations,
          total_quantity: sumQty || 0,
          season: i.specs?.season || null,
          pattern: i.specs?.pattern || null,
          color: i.specs?.color || "gray",
          size: i.specs?.size || "",
        };
      });
      setItems(mappedItems);
      setCheckpoint(mappedItems.map((it) => ({ ...it, locations: it.locations.map((l: any) => ({ ...l })) })));
      setLoading(false);
    } else {
      setError(fetchError || "Failed to load items");
      fireNotify("error", "Связь с базой данных потеряна");
      setLoading(false);
    }
  }, [slug, fireNotify]);

  useEffect(() => {
    const resumeSession = localStorage.getItem(`warehouse_session_${slug}`);
    if (resumeSession) {
      try {
        const { mode, checkpointData, onload, offload, edits } = JSON.parse(resumeSession);
        if (mode === 'offload' && checkpointData) {
            setGameMode(mode);
            setCheckpoint(checkpointData);
            setOnloadCount(onload || 0);
            setOffloadCount(offload || 0);
            setEditCount(edits || 0);
            fireNotify("info", "Сессия восстановлена");
        }
      } catch (e) { logger.warn("Resume failed", e); }
    }
    loadItems();
    const savedLeaderboard = JSON.parse(localStorage.getItem(`warehouse_leaderboard_${slug}`) || "[]");
    setLeaderboard(savedLeaderboard);
  }, [loadItems, slug, fireNotify]);

  // --- FIX 1: Auto-sync session counters to localStorage ---
  // This ensures that if counters are reset via UI, the update is persisted immediately.
  useEffect(() => {
    if (!slug) return;
    const sessionData = {
      mode: gameMode,
      checkpointData: checkpoint,
      onload: onloadCount,
      offload: offloadCount,
      edits: editCount,
    };
    localStorage.setItem(`warehouse_session_${slug}`, JSON.stringify(sessionData));
  }, [slug, gameMode, checkpoint, onloadCount, offloadCount, editCount]);

  const handleUpdateLocationQty = useCallback(
    async (itemId: string, voxelId: string, delta: number, isGameAction: boolean = false) => {
      const absDelta = Math.abs(delta);

      // --- FIX 2: Optimistic UI Updates ---
      // Apply changes to state immediately for instant feedback
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== itemId) return i;
          const locs = (i.locations || []).map((l: any) => ({ ...l }));
          const idx = locs.findIndex((l: any) => (l.voxel || "") === voxelId);
          if (idx !== -1) {
            locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
          } else if (delta > 0) {
            locs.push({ voxel: voxelId, quantity: delta });
          }
          const filtered = locs.filter((l) => l.quantity > 0).sort((a, b) => (a.voxel || "").localeCompare(b.voxel || ""));
          return { ...i, locations: filtered, total_quantity: filtered.reduce((acc, l) => acc + (l.quantity || 0), 0) };
        })
      );

      if (isGameAction) {
        setScore((prev) => prev + (gameMode === "onload" ? 10 : 5) * (level / 2));
        setStreak((prev) => prev + 1);
        checkAchievements();
      }

      if (gameMode === 'onload' && delta > 0) setOnloadCount(p => p + absDelta);
      else if (gameMode === 'offload' && delta < 0) setOffloadCount(p => p + absDelta);
      else setEditCount(p => p + absDelta);

      // Perform Server Action
      const { success, error: updateError } = await updateCrewItemLocationQty(slug, itemId, voxelId, delta, dbUser?.user_id);

      if (!success) {
        // Rollback: If server fails, reload items to revert optimistic changes
        fireNotify("error", updateError || "Ошибка синхронизации");
        if (isGameAction) setErrorCount((prev) => prev + 1);
        loadItems(); 
        return;
      }

      // --- Success Path (Background Mining) ---
      (async () => {
        if (!dbUser?.user_id) return;
        const actionType = delta > 0 ? 'onload' : 'offload';
        const gvEarned = Math.abs(delta) * (actionType === 'offload' ? 7 : 3);
        const kvEarned = Math.abs(delta) * 0.5;

        await supabaseAdmin.rpc('update_user_cyber_stats', {
            p_user_id: dbUser.user_id,
            p_gv_delta: gvEarned,
            p_kv_delta: kvEarned,
            p_feature_key: `last_wh_action`,
            p_feature_val: JSON.stringify({ type: actionType, qty: Math.abs(delta), ts: new Date().toISOString() })
        });
      })();
    },
    [slug, gameMode, level, checkAchievements, dbUser, fireNotify, loadItems],
  );

  const startBossMode = () => {
    setBossMode(true);
    setBossTimer(300000);
    bossIntervalRef.current = setInterval(() => {
      setBossTimer((prev) => {
        if (prev <= 0) {
          clearInterval(bossIntervalRef.current!);
          setBossMode(false);
          fireNotify("error", "Время босса истекло!");
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  };

  const handleItemClick = useCallback((item: any) => {
    if (!gameMode) { fireNotify("info", item.description || "Описание отсутствует"); return; }
    const delta = gameMode === "onload" ? 1 : -1;
    let voxel = gameMode === "onload" ? (selectedVoxel || item.locations[0]?.voxel || "A1") : (selectedVoxel || item.locations.find((l: any) => l.quantity > 0)?.voxel);

    if (voxel) {
      handleUpdateLocationQty(item.id, voxel, delta, true).then(() => {
        fireNotify("success", `${delta > 0 ? 'Загружено в' : 'Выдано из'} ${voxel}: ${item.name}`, { duration: 2000, icon: "package" });
      });
    } else if (delta < 0) {
        fireNotify("error", "Товар отсутствует");
    }
  }, [gameMode, selectedVoxel, handleUpdateLocationQty, fireNotify]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesSeason = !filterSeason || item.season === filterSeason;
      const matchesPattern = !filterPattern || item.pattern === filterPattern;
      const matchesColor = !filterColor || item.color === filterColor;
      const matchesSize = !filterSize || item.size === filterSize;
      return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });
  }, [items, search, filterSeason, filterPattern, filterColor, filterSize]);

  const sortedFilteredItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => getSizePriority(a.size) - getSizePriority(b.size));
  }, [filteredItems]);

  return {
    items, loading, error, checkpoint, setCheckpoint, workflowItems, currentWorkflowIndex,
    selectedWorkflowVoxel, setSelectedWorkflowVoxel, gameMode, setGameMode, score, level,
    streak, dailyStreak, achievements, errorCount, sessionStart, bossMode, bossTimer,
    leaderboard, loadItems, handleUpdateLocationQty, handleItemClick, search, setSearch, 
    filterSeason, setFilterSeason, filterPattern, setFilterPattern, filterColor, setFilterColor, 
    filterSize, setFilterSize, selectedVoxel, setSelectedVoxel, filteredItems: sortedFilteredItems, 
    sortOption: 'size_season_color', setSortOption: () => {}, onloadCount, offloadCount, editCount, 
    setOnloadCount, setOffloadCount, setEditCount, efficiency, avgTimePerItem, dailyGoals, 
    sessionDuration, getSizePriority, registerNotifier: setNotifier,
  };
}