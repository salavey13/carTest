import { useState, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { getWarehouseItems, updateItemLocationQty } from "@/app/wb/actions";
import { COLOR_MAP, Item, WarehouseItem, VOXELS } from "@/app/wb/common";
import { logger } from "@/lib/logger";
import { useConfetti } from "@/hooks/useConfetti";
import { useUser } from "@/hooks/useUser";

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
  const confetti = useConfetti();
  const { user } = useUser();
  const bossIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { success, data, error: fetchError } = await getWarehouseItems();
    if (success && data) {
      const mappedItems: Item[] = data.map((i: WarehouseItem) => ({
        id: i.id,
        name: `${i.make} ${i.model}`,
        description: i.description,
        image: i.image_url,
        locations: i.specs?.warehouse_locations?.map((l: any) => ({
          voxel: l.voxel_id,
          quantity: l.quantity,
          min_qty: l.voxel_id.startsWith("B") ? 3 : undefined,
        })) || [],
        total_quantity: i.specs?.warehouse_locations?.reduce((acc: number, l: any) => acc + l.quantity, 0) || 0,
        season: i.specs?.season || null,
        pattern: i.specs?.pattern,
        color: i.specs?.color || "gray",
        size: i.specs?.size || "",
      }));
      setItems(mappedItems);
      setCheckpoint(mappedItems.map((i) => ({ ...i, locations: i.locations.map((l) => ({ ...l })) })));
      setLoading(false);
    } else {
      setError(fetchError || "Failed to load items");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    // Load leaderboard from localStorage or Supabase
    const savedLeaderboard = JSON.parse(localStorage.getItem("warehouse_leaderboard") || "[]");
    setLeaderboard(savedLeaderboard);
  }, [loadItems]);

  const handleUpdateLocationQty = useCallback(
    async (itemId: string, voxelId: string, quantity: number, isGameAction: boolean = false) => {
      const { success, error: updateError } = await updateItemLocationQty(itemId, voxelId, quantity);
      if (success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  locations: i.locations.map((l) =>
                    l.voxel === voxelId ? { ...l, quantity: Math.max(0, quantity) } : l,
                  ).filter((l) => l.quantity > 0),
                  total_quantity: i.locations.reduce(
                    (acc, l) => acc + (l.voxel === voxelId ? Math.max(0, quantity) : l.quantity),
                    0,
                  ),
                }
              : i,
          ),
        );
        if (isGameAction) {
          const points = gameMode === "onload" ? 10 : 5;
          setScore((prev) => prev + points * (level / 2));
          setStreak((prev) => prev + 1);
          if (streak % 5 === 4) confetti.fire();
          checkAchievements();
        }
      } else {
        toast.error(updateError || "Failed to update quantity");
        if (isGameAction) setErrorCount((prev) => prev + 1);
      }
    },
    [gameMode, level, streak, confetti],
  );

  const handleImport = useCallback(
    (file: File) => {
      Papa.parse(file, {
        complete: (results) => {
          const data = results.data as any[];
          const changes = data
            .filter((row) => row["Артикул"] && row["Количество"])
            .map((row) => ({
              id: row["Артикул"],
              change: parseInt(row["Количество"], 10),
              voxel: row["Ячейка"] || undefined,
            }));
          setWorkflowItems(changes);
          setCurrentWorkflowIndex(0);
          if (changes.length > 10) startBossMode();
          toast.success(`Imported ${changes.length} items for processing`);
        },
        header: true,
      });
    },
    [],
  );

  const handleWorkflowNext = useCallback(async () => {
    if (selectedWorkflowVoxel && workflowItems[currentWorkflowIndex]) {
      const { id, change } = workflowItems[currentWorkflowIndex];
      const item = items.find((i) => i.id === id);
      if (item) {
        const loc = item.locations.find((l) => l.voxel === selectedWorkflowVoxel);
        const currentQty = loc ? loc.quantity : 0;
        await handleUpdateLocationQty(id, selectedWorkflowVoxel, currentQty + change, true);
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
      return newAch;
    });
  }, [streak, score, workflowItems.length, errorCount, sessionStart]);

  const startBossMode = () => {
    setBossMode(true);
    setBossTimer(300000); // 5 min
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
    const newLeaderboard = [...leaderboard, { name: user?.username || "Anon", score: finalScore, date: new Date().toLocaleDateString() }]
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
          // Open modal to add new item with qty
          // Logic in WBPage
        } else {
          // Open modal to add qty to existing
        }
      } else if (gameMode === "offload") {
        if (content.length > 0) {
          const { item, quantity } = content[0];
          handleUpdateLocationQty(item.id, voxelId, quantity - 1, true);
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
        handleUpdateLocationQty(item.id, primaryLoc.voxel, primaryLoc.quantity + 1, true);
      } else if (gameMode === "offload") {
        if (item.locations.length === 0) return toast.error("No location for item");
        const primaryLoc = item.locations[0];
        handleUpdateLocationQty(item.id, primaryLoc.voxel, primaryLoc.quantity - 1, true);
      }
    },
    [gameMode, handleUpdateLocationQty],
  );

  // Filters hook
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
  });

  useEffect(() => {
    if (gameMode === "offload" && workflowItems.length > 0) {
      const firstItem = items.find((i) => i.id === workflowItems[0].id);
      if (firstItem) {
        setFilterSeason(firstItem.season);
        setFilterPattern(firstItem.pattern);
        setFilterColor(firstItem.color);
        setFilterSize(firstItem.size);
        setSearch("");
      }
    } else if (!gameMode) {
      setFilterSeason(null);
      setFilterPattern(null);
      setFilterColor(null);
      setFilterSize(null);
      setSearch("");
    }
  }, [gameMode, workflowItems, items]);

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
    handleImport,
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
    filteredItems,
    setCheckpoint,
  };
}