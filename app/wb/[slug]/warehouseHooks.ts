import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getCrewWarehouseItems, updateCrewItemLocationQty } from "./actions_crud";
import { logger } from "@/lib/logger";
import { useAppContext } from "@/contexts/AppContext";

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

  const dailyGoals = useMemo(() => ({
    units: 100,
    errors: 0,
    xtr: 100,
  }), []);

  const sessionDuration = useMemo(() => Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)), [sessionStart]);
  const efficiency = useMemo(() => sessionDuration === 0 ? 0 : Math.round((offloadCount / (sessionDuration / 3600)) * 10) / 10, [offloadCount, sessionDuration]);
  const avgTimePerItem = useMemo(() => (offloadCount === 0 || sessionDuration === 0) ? 0 : Math.round((sessionDuration / offloadCount) * 100) / 100, [offloadCount, sessionDuration]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { success, data, error: fetchError } = await getCrewWarehouseItems(slug);
    logger.info(`loadItems: Fetch success: ${success}, items count: ${data?.length || 0}, error: ${fetchError || 'none'}`);

    if (success && data) {
      const mappedItems: any[] = data.map((i: any) => {
        const locations = (i.specs?.warehouse_locations || []).map((l: any) => ({
          voxel: l.voxel_id,
          quantity: l.quantity,
          min_qty: l.voxel_id?.startsWith?.("B") ? 3 : undefined,
        })).sort((a: any, b: any) => (a.voxel || "").localeCompare(b.voxel || ""));

        const sumQty = locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
        const total = sumQty || 0;
        return {
          id: i.id,
          name: `${i.make} ${i.model}`,
          description: i.description || "",
          image: i.image_url,
          locations,
          total_quantity: total,
          season: i.specs?.season || null,
          pattern: i.specs?.pattern || null,
          color: i.specs?.color || "gray",
          size: i.specs?.size || "",
        };
      });

      logger.info(`loadItems: Mapped ${mappedItems.length} items.`);
      setItems(mappedItems);
      setCheckpoint(mappedItems.map((it) => ({ ...it, locations: it.locations.map((l: any) => ({ ...l })) })));
      if (mappedItems.length === 0) {
        toast.warning("Нет товаров в складе. Загрузите CSV.");
      }
      setLoading(false);
    } else {
      setError(fetchError || "Failed to load items");
      toast.error(fetchError || "Ошибка загрузки товаров");
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const resumeSession = localStorage.getItem(`warehouse_session_${slug}`);
    if (resumeSession) {
      try {
        const { mode, checkpointData, onload, offload, edits } = JSON.parse(resumeSession);
        if (mode === 'offload' && checkpointData) {
          const resume = window.confirm('Обнаружен незавершенный offload. Продолжить?');
          if (resume) {
            setGameMode(mode);
            setCheckpoint(checkpointData);
            setOnloadCount(onload || 0);
            setOffloadCount(offload || 0);
            setEditCount(edits || 0);
            toast.info('Offload возобновлен.');
          } else {
            localStorage.removeItem(`warehouse_session_${slug}`);
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    loadItems();
    const savedLeaderboard = JSON.parse(localStorage.getItem(`warehouse_leaderboard_${slug}`) || "[]");
    setLeaderboard(savedLeaderboard);
  }, [loadItems, slug]);

  const checkAchievements = useCallback(() => {
    setAchievements((prev) => {
      const newAch = [...prev];
      if (streak === 20 && !newAch.includes("Streak Master")) newAch.push("Streak Master");
      if (score > 1000 && !newAch.includes("High Scorer")) newAch.push("High Scorer");
      if (workflowItems.length > 20 && errorCount === 0 && !newAch.includes("Perfect Run")) newAch.push("Perfect Run");
      if (workflowItems.length > 0 && (Date.now() - sessionStart) / 1000 < 3600 && !newAch.includes("Speed Demon")) newAch.push("Speed Demon");
      if (workflowItems.length > 20 && bossMode && !newAch.includes("Быстрая катка")) newAch.push("Быстрая катка");
      if (workflowItems.length > 0 && errorCount === 0 && !newAch.includes("Безошибочная приемка")) newAch.push("Безошибочная приемка");
      
      if (sessionDuration > 3600 && errorCount === 0 && !newAch.includes("Error-Free Shift")) newAch.push("Error-Free Shift (+25 XTR)");
      if (dailyStreak >= 7 && !newAch.includes("Daily Hustle")) newAch.push("Daily Hustle (+100 XTR)");
      if (efficiency >= 50 && !newAch.includes("Efficiency Expert")) newAch.push("Efficiency Expert (+75 XTR)");
      if (offloadCount >= 200 && !newAch.includes("Warehouse Warrior")) newAch.push("Warehouse Warrior (+200 XTR)");
      
      const xtrEarned = newAch.filter(a => a.includes("XTR")).length * 50;
      if (xtrEarned > 0) toast.success(`Заработано ${xtrEarned} XTR!`, { icon: "⭐" });
      
      return newAch.slice(-8);
    });
  }, [streak, score, workflowItems.length, errorCount, sessionStart, bossMode, dailyStreak, efficiency, offloadCount, sessionDuration]);

  const handleUpdateLocationQty = useCallback(
    async (itemId: string, voxelId: string, delta: number, isGameAction: boolean = false) => {
      logger.info(`Updating qty for ${itemId} in ${voxelId} by ${delta}`);
      const { success, error: updateError } = await updateCrewItemLocationQty(slug, itemId, voxelId, delta, dbUser?.user_id);
      if (success) {
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== itemId) return i;
            const locs = (i.locations || []).map((l: any) => ({ ...l }));
            const idx = locs.findIndex((l: any) => (l.voxel || "") === voxelId);

            if (idx !== -1) {
              const newQty = Math.max(0, (locs[idx].quantity || 0) + delta);
              locs[idx] = { ...locs[idx], quantity: newQty };
            } else if (delta > 0) {
              locs.push({
                voxel: voxelId,
                quantity: delta,
                min_qty: voxelId?.startsWith?.("B") ? 3 : undefined,
              });
            } else {
              if (locs.length === 1) {
                locs[0] = { ...locs[0], quantity: Math.max(0, (locs[0].quantity || 0) + delta) };
              } else if (locs.length > 1) {
                const biggest = [...locs].sort((a, b) => (b.quantity || 0) - (a.quantity || 0))[0];
                const idxBig = locs.findIndex((l) => l.voxel === biggest.voxel);
                if (idxBig !== -1) {
                  locs[idxBig] = { ...locs[idxBig], quantity: Math.max(0, (locs[idxBig].quantity || 0) + delta) };
                }
              }
            }

            const filtered = locs.filter((l) => (l.quantity || 0) > 0).sort((a, b) => (a.voxel || "").localeCompare(b.voxel || ""));
            const newTotal = filtered.reduce((acc, l) => acc + (l.quantity || 0), 0);

            return {
              ...i,
              locations: filtered,
              total_quantity: newTotal,
            };
          })
        );

        if (isGameAction) {
          const points = gameMode === "onload" ? 10 : 5;
          setScore((prev) => prev + points * (level / 2));
          setStreak((prev) => prev + 1);
          checkAchievements();
        }

        const absDelta = Math.abs(delta);
        if (gameMode === 'onload' && delta > 0) {
          setOnloadCount(prev => prev + absDelta);
        } else if (gameMode === 'offload' && delta < 0) {
          setOffloadCount(prev => prev + absDelta);
        } else if (!gameMode) {
          setEditCount(prev => prev + absDelta);
        }

        localStorage.setItem(`warehouse_session_${slug}`, JSON.stringify({
          mode: gameMode,
          checkpointData: checkpoint,
          onload: onloadCount,
          offload: offloadCount,
          edits: editCount,
        }));
      } else {
        toast.error(updateError || "Failed to update quantity");
        if (isGameAction) setErrorCount((prev) => prev + 1);
      }
    },
    [slug, gameMode, level, checkAchievements, checkpoint, onloadCount, offloadCount, editCount, dbUser],
  );

  const handleWorkflowNext = useCallback(async () => {
    if (selectedWorkflowVoxel && workflowItems[currentWorkflowIndex]) {
      const { id, change } = workflowItems[currentWorkflowIndex];
      const item = items.find((i) => i.id === id);
      if (item) {
        await handleUpdateLocationQty(id, selectedWorkflowVoxel, change, true);
      }
      setCurrentWorkflowIndex((prev) => prev + 1);
      setSelectedWorkflowVoxel(null);
      if (currentWorkflowIndex + 1 === workflowItems.length) {
        toast.success("Workflow completed!");
        setWorkflowItems([]);
        endGameSession();
      }
    }
  }, [workflowItems, currentWorkflowIndex, selectedWorkflowVoxel, items, handleUpdateLocationQty]);

  const handleSkipItem = useCallback(() => {
    setCurrentWorkflowIndex((prev) => prev + 1);
    setErrorCount((prev) => prev + 1);
    if (currentWorkflowIndex + 1 === workflowItems.length) {
      toast.success("Workflow completed with skips!");
      setWorkflowItems([]);
      endGameSession();
    }
  }, [currentWorkflowIndex, workflowItems.length]);

  const startBossMode = () => {
    setBossMode(true);
    setBossTimer(300000);
    bossIntervalRef.current = setInterval(() => {
      setBossTimer((prev) => {
        if (prev <= 0) {
          clearInterval(bossIntervalRef.current!);
          setBossMode(false);
          toast.error("Boss time expired!");
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  };

  const endGameSession = () => {
    if (bossMode) clearInterval(bossIntervalRef.current!);
    setBossMode(false);
    const finalScore = score - errorCount * 50;
    setLevel(Math.floor(finalScore / 500) + 1);
    const newLeaderboard = [...leaderboard, { name: dbUser?.username || "Anon", score: finalScore, date: new Date().toLocaleDateString(), xtr: 0 }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(newLeaderboard);
    localStorage.setItem(`warehouse_leaderboard_${slug}`, JSON.stringify(newLeaderboard));
    setGameMode(null);
    setSessionStart(Date.now());
    localStorage.removeItem(`warehouse_session_${slug}`);
  };

  const handlePlateClick = useCallback((voxelId: string) => {
    // placeholder - UI handles modal logic
  }, []);

  const handleItemClick = useCallback((item: any) => {
    if (!gameMode) {
      toast.info(item.description || "Описание отсутствует");
      return;
    }

    const delta = gameMode === "onload" ? 1 : -1;
    let voxel: string | null = null;

    if (gameMode === "onload") {
      voxel = selectedVoxel || item.locations[0]?.voxel || "A1";
    } else if (gameMode === "offload") {
      if (selectedVoxel) {
        const loc = item.locations.find((l: any) => l.voxel === selectedVoxel);
        if (loc && loc.quantity > 0) {
          voxel = selectedVoxel;
        } else {
          return toast.error("Товар отсутствует в выбранной ячейке");
        }
      } else {
        if (item.locations.length === 0 || item.total_quantity <= 0) {
          return toast.error("Нет локаций или количества для выгрузки");
        }
        voxel = item.locations[0].voxel;
      }
    }

    if (voxel && (delta > 0 || item.locations.find((l: any) => l.voxel === voxel)?.quantity > 0)) {
      handleUpdateLocationQty(item.id, voxel, delta, true);
    } else if (delta < 0) {
      toast.error("Нельзя уменьшить ниже 0");
    }
  }, [gameMode, selectedVoxel, handleUpdateLocationQty]);

  const filteredItems = (items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    const matchesSeason = !filterSeason || item.season === filterSeason;
    const matchesPattern = !filterPattern || item.pattern === filterPattern;
    const matchesColor = !filterColor || item.color === filterColor;
    const matchesSize = !filterSize || item.size === filterSize;
    return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
  }));

  const [sortOption, setSortOption] = useState<'size_season_color' | 'color_size' | 'season_size_color'>('size_season_color');

  const sortItems = useCallback((itemsToSort: any[]) => {
    return [...itemsToSort].sort((a: any, b: any) => {
      let comparison = 0;
      switch (sortOption) {
        case 'size_season_color':
          comparison = getSizePriority(a.size) - getSizePriority(b.size);
          if (comparison !== 0) return comparison;
          comparison = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (comparison !== 0) return comparison;
          return a.color.localeCompare(b.color);
        case 'color_size':
          comparison = a.color.localeCompare(b.color);
          if (comparison !== 0) return comparison;
          return getSizePriority(a.size) - getSizePriority(b.size);
        case 'season_size_color':
          comparison = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (comparison !== 0) return comparison;
          comparison = getSizePriority(a.size) - getSizePriority(b.size);
          if (comparison !== 0) return comparison;
          return a.color.localeCompare(b.color);
        default:
          return 0;
      }
    });
  }, [sortOption]);

  const sortedFilteredItems = useMemo(() => sortItems(filteredItems), [filteredItems, sortItems]);

  return {
    items,
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
    filteredItems: sortedFilteredItems,
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
    getSizePriority, // Export the function
  };
}