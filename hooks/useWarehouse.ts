import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { getWarehouseItems, updateItemLocationQty } from "@/app/wb/actions";
import { COLOR_MAP, Item, WarehouseItem, VOXELS } from "@/app/wb/common";
import { logger } from "@/lib/logger";
import { useAppContext } from "@/contexts/AppContext";

const getSizePriority = (size: string | null): number => {
  if (!size) return 999;
  const sizeOrder: { [key: string]: number } = {
    "1.5": 1,
    "2": 2,
    "евро": 3,
    "евро макси": 4,
  };
  return sizeOrder[size] || 5;
};

const getSeasonPriority = (season: string | null): number => {
  if (!season) return 999;
  const seasonOrder: { [key: string]: number } = {
    "лето": 1,
    "зима": 2,
  };
  return seasonOrder[season] || 3;
};

export function useWarehouse() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<Item[]>([]);
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
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; date: string }[]>([]);
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { success, data, error: fetchError } = await getWarehouseItems();
    logger.info(`loadItems: Fetch success: ${success}, items count: ${data?.length || 0}, error: ${fetchError || 'none'}`);

    if (success && data) {
      const mappedItems: Item[] = data.map((i: WarehouseItem) => {
        const locations = (i.specs?.warehouse_locations || []).map((l: any) => ({
          voxel: l.voxel_id,
          quantity: l.quantity,
          min_qty: l.voxel_id?.startsWith?.("B") ? 3 : undefined,
        })).sort((a: any, b: any) => (a.voxel || "").localeCompare(b.voxel || ""));

        const sumQty = locations.reduce((acc, l) => acc + (l.quantity || 0), 0);
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
      setCheckpoint(mappedItems.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
      if (mappedItems.length === 0) {
        toast.warning("Нет товаров в складе. Загрузите CSV.");
      }
      setLoading(false);
    } else {
      setError(fetchError || "Failed to load items");
      toast.error(fetchError || "Ошибка загрузки товаров");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const resumeSession = localStorage.getItem('warehouse_session');
    if (resumeSession) {
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
          localStorage.removeItem('warehouse_session');
        }
      }
    }
    loadItems();
    const savedLeaderboard = JSON.parse(localStorage.getItem("warehouse_leaderboard") || "[]");
    setLeaderboard(savedLeaderboard);
  }, [loadItems]);

  const handleUpdateLocationQty = useCallback(
    async (itemId: string, voxelId: string, delta: number, isGameAction: boolean = false) => {
      logger.info(`Updating qty for ${itemId} in ${voxelId} by ${delta}`);
      const { success, error: updateError } = await updateItemLocationQty(itemId, voxelId, delta);
      if (success) {
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== itemId) return i;
            const locs = (i.locations || []).map((l) => ({ ...l }));
            const idx = locs.findIndex((l) => (l.voxel || "") === voxelId);

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
              // delta < 0 and voxel not found - try deducting from largest location (defensive)
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

        localStorage.setItem('warehouse_session', JSON.stringify({
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
    [gameMode, level, checkAchievements, checkpoint, onloadCount, offloadCount, editCount],
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

  const handleSkipItem = () => {
    setCurrentWorkflowIndex((prev) => prev + 1);
    setErrorCount((prev) => prev + 1);
    if (currentWorkflowIndex + 1 === workflowItems.length) {
      toast.success("Workflow completed with skips!");
      setWorkflowItems([]);
      endGameSession();
    }
  };

  const checkAchievements = useCallback(() => {
    setAchievements((prev) => {
      const newAch = [...prev];
      if (streak === 20 && !newAch.includes("Streak Master")) newAch.push("Streak Master");
      if (score > 1000 && !newAch.includes("High Scorer")) newAch.push("High Scorer");
      if (workflowItems.length > 20 && errorCount === 0 && !newAch.includes("Perfect Run")) newAch.push("Perfect Run");
      if (workflowItems.length > 0 && (Date.now() - sessionStart) / 1000 < 3600 && !newAch.includes("Speed Demon")) newAch.push("Speed Demon");
      if (workflowItems.length > 20 && bossMode && !newAch.includes("Быстрая катка")) newAch.push("Быстрая катка");
      if (workflowItems.length > 0 && errorCount === 0 && !newAch.includes("Безошибочная приемка")) newAch.push("Безошибочная приемка");
      return newAch;
    });
  }, [streak, score, workflowItems.length, errorCount, sessionStart, bossMode]);

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
    const newLeaderboard = [...leaderboard, { name: dbUser?.username || "Anon", score: finalScore, date: new Date().toLocaleDateString() }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    setLeaderboard(newLeaderboard);
    localStorage.setItem("warehouse_leaderboard", JSON.stringify(newLeaderboard));
    setGameMode(null);
    setSessionStart(Date.now());
    localStorage.removeItem('warehouse_session');
  };

  const handlePlateClick = useCallback(
    (voxelId: string) => {
      // Only select - modal handling is done in page component
    },
    [],
  );

  const handleItemClick = useCallback(
    (item: Item) => {
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
          const loc = item.locations.find((l) => l.voxel === selectedVoxel);
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

      if (voxel && (delta > 0 || item.locations.find((l) => l.voxel === voxel)?.quantity > 0)) {
        handleUpdateLocationQty(item.id, voxel, delta, true);
      } else if (delta < 0) {
        toast.error("Нельзя уменьшить ниже 0");
      }
    },
    [gameMode, selectedVoxel, handleUpdateLocationQty],
  );

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    const matchesSeason = !filterSeason || item.season === filterSeason;
    const matchesPattern = !filterPattern || item.pattern === filterPattern;
    const matchesColor = !filterColor || item.color === filterColor;
    const matchesSize = !filterSize || item.size === filterSize;
    return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
  }), [items, search, filterSeason, filterPattern, filterColor, filterSize]);

  const [sortOption, setSortOption] = useState<'size_season_color' | 'color_size' | 'season_size_color'>('size_season_color');

  const sortItems = useCallback((itemsToSort: Item[]) => {
    return [...itemsToSort].sort((a, b) => {
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
  };
}