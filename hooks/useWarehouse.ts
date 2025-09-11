import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { getWarehouseItems, updateItemLocationQty } from "@/app/wb/actions";
import { COLOR_MAP, Item, WarehouseItem, VOXELS } from "@/app/wb/common";
import { logger } from "@/lib/logger";
import { useAppContext } from "@/contexts/AppContext";

// Helper function to determine size priority
const getSizePriority = (size: string | null): number => {
  if (!size) return 999; // Sort null or undefined sizes last

  const sizeOrder: { [key: string]: number } = {
    "1.5": 1,
    "2": 2,
    "евро": 3,
    "евро макси": 4,
  };

  return sizeOrder[size] || 5; // Default priority for unknown sizes
};

// Helper function to determine season priority
const getSeasonPriority = (season: string | null): number => {
  if (!season) return 999; // Sort null or undefined seasons last

  const seasonOrder: { [key: string]: number } = {
    "лето": 1,
    "зима": 2,
  };

  return seasonOrder[season] || 3; // Default priority for unknown seasons
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { success, data, error: fetchError } = await getWarehouseItems();
    logger.info(`loadItems: Fetch success: ${success}, items count: ${data?.length || 0}, error: ${fetchError || 'none'}`);

    if (success && data) {
      const mappedItems: Item[] = data.map((i: WarehouseItem) => {
        const locations = i.specs?.warehouse_locations?.map((l: any) => ({
          voxel: l.voxel_id,
          quantity: l.quantity,
          min_qty: l.voxel_id.startsWith("B") ? 3 : undefined,
        })) || [];
        const sumQty = locations.reduce((acc, l) => acc + l.quantity, 0);
        const total = i.quantity || sumQty || 0;
        return {
          id: i.id,
          name: `${i.make} ${i.model}`,
          description: i.description,
          image: i.image_url,
          locations,
          total_quantity: total,
          season: i.specs?.season || null,
          pattern: i.specs?.pattern,
          color: i.specs?.color || "gray",
          size: i.specs?.size || "",
        };
      });
      logger.info(`loadItems: Mapped ${mappedItems.length} items. Sample: ${JSON.stringify(mappedItems[0] || 'none')}`);
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
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  locations: i.locations.map((l) =>
                    l.voxel === voxelId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
                  ).filter((l) => l.quantity > 0),
                  total_quantity: i.total_quantity + delta,
                }
              : i,
          ),
        );
        if (isGameAction) {
          const points = gameMode === "onload" ? 10 : 5;
          setScore((prev) => prev + points * (level / 2));
          setStreak((prev) => prev + 1);
          if (streak % 5 === 4) {}
          checkAchievements();
        }
      } else {
        toast.error(updateError || "Failed to update quantity");
        if (isGameAction) setErrorCount((prev) => prev + 1);
      }
    },
    [gameMode, level, streak],
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
      if (streak === 10 && !newAch.includes("Streak Master")) newAch.push("Streak Master");
      if (score > 1000 && !newAch.includes("High Scorer")) newAch.push("High Scorer");
      if (workflowItems.length > 20 && errorCount === 0 && !newAch.includes("Perfect Run")) newAch.push("Perfect Run");
      if (workflowItems.length > 0 && (Date.now() - sessionStart) / 1000 < 300 && !newAch.includes("Speed Demon")) newAch.push("Speed Demon");
      if (workflowItems.length > 10 && bossMode && !newAch.includes("Быстрая катка")) newAch.push("Быстрая катка");
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
  };

  const handlePlateClick = useCallback(
    (voxelId: string) => {
      const content = items.flatMap((i) =>
        i.locations.filter((l) => l.voxel === voxelId).map((l) => ({ item: i, quantity: l.quantity })),
      );
      if (gameMode === "onload") {
        if (content.length === 0) {
          // Logic in page
        } else {
          // Logic in page
        }
      } else if (gameMode === "offload") {
        if (content.length > 0) {
          const { item, quantity } = content[0];
          handleUpdateLocationQty(item.id, voxelId, -1, true); // Delta -1 for offload
        }
      }
    },
    [gameMode, items, handleUpdateLocationQty],
  );

  const handleItemClick = useCallback(
    (item: Item) => {
      if (gameMode === "onload") {
        if (item.locations.length === 0) return toast.error("No location for item");
        const primaryLoc = item.locations[0];
        handleUpdateLocationQty(item.id, primaryLoc.voxel, 1, true); // Delta +1
      } else if (gameMode === "offload") {
        if (item.locations.length === 0) return toast.error("No location for item");
        const primaryLoc = item.locations[0];
        handleUpdateLocationQty(item.id, primaryLoc.voxel, -1, true); // Delta -1
      }
    },
    [gameMode, handleUpdateLocationQty],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    const matchesSeason = !filterSeason || item.season === filterSeason;
    const matchesPattern = !filterPattern || item.pattern === filterPattern;
    const matchesColor = !filterColor || item.color === filterColor;
    const matchesSize = !filterSize || item.size === filterSize;
    return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
  }).sort((a, b) => {
    // Sort by size first
    const sizeA = getSizePriority(a.size);
    const sizeB = getSizePriority(b.size);
    if (sizeA !== sizeB) {
      return sizeA - sizeB;
    }

    // Then sort by season
    const seasonA = getSeasonPriority(a.season);
    const seasonB = getSeasonPriority(b.season);
    if (seasonA !== seasonB) {
      return seasonA - seasonB;
    }

    // Finally, sort by color (alphabetical)
    return a.color.localeCompare(b.color);
  });

  // --- Sorting Options ---
  const [sortOption, setSortOption] = useState<'size_season_color' | 'color_size' | 'season_size_color'>('size_season_color');

  const sortItems = useCallback((itemsToSort: Item[]) => {
    return [...itemsToSort].sort((a, b) => {
      let comparison = 0;

      switch (sortOption) {
        case 'size_season_color':
          // Size
          comparison = getSizePriority(a.size) - getSizePriority(b.size);
          if (comparison !== 0) return comparison;

          // Season
          comparison = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (comparison !== 0) return comparison;

          // Color
          return a.color.localeCompare(b.color);

        case 'color_size':
          // Color
          comparison = a.color.localeCompare(b.color);
          if (comparison !== 0) return comparison;

          // Size
          return getSizePriority(a.size) - getSizePriority(b.size);

        case 'season_size_color':
          // Season
          comparison = getSeasonPriority(a.season) - getSeasonPriority(b.season);
          if (comparison !== 0) return comparison;

          // Size
          comparison = getSizePriority(a.size) - getSizePriority(b.size);
          if (comparison !== 0) return comparison;

          // Color
          return a.color.localeCompare(b.color);

        default:
          return 0; // No sorting
      }
    });
  }, [sortOption]);

  const sortedFilteredItems = sortItems(filteredItems);

  return {
    items,
    loading,
    error,
    checkpoint,
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
    filteredItems: sortedFilteredItems, // Use the sorted items
    setCheckpoint,
    sortOption, // Expose the sort option
    setSortOption, // Expose the setSortOption function
  };
}