"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUp, Download, Save, RotateCcw, Upload } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";

/**
 * Slugged warehouse page.
 * Improvements:
 * - Compact icon-only top buttons (prevent overflow)
 * - Disabled checkpoint/reset when no active shift
 * - Safe clipboard fallback on stock export
 * - Fetch active shift for current member
 * - Use wrappers from ./actions (keeps compatibility)
 */

let SIZE_PACK: Record<string, number> | null = null;
let VOXELS: any[] | null = null;

export default function CrewWarehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string | undefined;
  const { dbUser, user, tg } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isTelegram = !!tg;

  // Core
  const [crew, setCrew] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active shift info (if user has an open shift)
  const [activeShift, setActiveShift] = useState<any | null>(null);

  // Game and search
  const [gameMode, setGameMode] = useState<"offload" | "onload" | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Checkpoint + stats
  const [checkpoint, setCheckpoint] = useState<any[]>([]);
  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [lastCheckpointDurationSec, setLastCheckpointDurationSec] = useState<number | null>(null);
  const [lastProcessedCount, setLastProcessedCount] = useState<number | null>(null);
  const [lastProcessedTotalDelta, setLastProcessedTotalDelta] = useState<number | null>(null);
  const [lastProcessedStars, setLastProcessedStars] = useState<number | null>(null);
  const [lastProcessedOffloadUnits, setLastProcessedOffloadUnits] = useState<number | null>(null);
  const [lastProcessedSalary, setLastProcessedSalary] = useState<number | null>(null);

  const [statsObj, setStatsObj] = useState({
    changedCount: 0,
    totalDelta: 0,
    stars: 0,
    offloadUnits: 0,
    salary: 0,
  });
  const [checkingPending, setCheckingPending] = useState(false);
  const [targetOffload, setTargetOffload] = useState(0);

  // Edit modal states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<Array<{ item: any; quantity: number; newQuantity: number }>>([]);

  // Game states
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [onloadCount, setOnloadCount] = useState(0);
  const [offloadCount, setOffloadCount] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const [sessionStart, setSessionStart] = useState(Date.now());

  // load constants
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const common = await import("@/app/wb/common");
        if (mounted) {
          SIZE_PACK = common.SIZE_PACK || null;
          VOXELS = common.VOXELS || null;
        }
      } catch (err) {
        console.warn("Failed to load common:", err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load crew items AND active shift
  useEffect(() => {
    if (!slug) {
      setError("No slug provided");
      setLoading(false);
      return;
    }
    loadCrewItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadCrewItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const mod = await import("./actions");
      const res = await mod.getCrewWarehouseItems(slug!);
      if (res.success) {
        setCrew(res.crew);
        setItems(res.data || []);
        setMemberRole(res.memberRole);
        setIsOwner(res.isOwner || false);

        const mappedItems = (res.data || []).map((i: any) => {
          const locations = (i.specs?.warehouse_locations || []).map((l: any) => ({
            voxel: l.voxel_id,
            quantity: l.quantity,
            min_qty: l.voxel_id?.startsWith?.("B") ? 3 : undefined,
          })).sort((a: any, b: any) => (a.voxel || "").localeCompare(b.voxel || ""));
          const total = locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
          return {
            id: i.id,
            make: i.make,
            model: i.model,
            name: `${i.make || ""} ${i.model || ""}`.trim(),
            description: i.description || "",
            image: i.image_url,
            locations,
            total_quantity: total,
            season: i.specs?.season || null,
            pattern: i.specs?.pattern || null,
            color: i.specs?.color || "gray",
            size: i.specs?.size || "",
            specs: i.specs || {},
          };
        });

        setLocalItems(mappedItems);
        setCheckpoint(mappedItems.map((it) => ({ id: it.id, locations: it.locations.map((l: any) => ({ ...l })) })));

        // fetch active shift for this member (if logged)
        if (dbUser?.user_id) {
          try {
            const s = await mod.getActiveShiftForCrewMember(slug!, dbUser.user_id);
            if (s?.success) {
              setActiveShift(s.shift || null);
            } else {
              setActiveShift(null);
            }
          } catch (e) {
            console.warn("Failed to fetch active shift:", e);
            setActiveShift(null);
          }
        }
      } else {
        setError(res.error || "Failed to load warehouse");
        toast.error(res.error || "Ошибка загрузки");
      }
    } catch (e: any) {
      setError(e.message || "Load failed");
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  // optimistic update + server sync
  const optimisticUpdate = async (itemId: string, voxelId: string, delta: number) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => l.voxel === voxelId);
        if (idx !== -1) {
          locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        } else if (delta > 0) {
          locs.push({ voxel: voxelId, quantity: delta });
        }
        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const newTotal = filtered.reduce((acc, l) => acc + (l.quantity || 0), 0);
        return { ...i, locations: filtered, total_quantity: newTotal };
      })
    );

    // stats
    const absDelta = Math.abs(delta);
    if (gameMode === "onload" && delta > 0) setOnloadCount((p) => p + absDelta);
    else if (gameMode === "offload" && delta < 0) setOffloadCount((p) => p + absDelta);
    else setEditCount((p) => p + absDelta);

    const points = gameMode === "onload" ? 10 : 5;
    setScore((p) => p + points);
    setStreak((p) => p + 1);

    // server
    try {
      const mod = await import("./actions");
      const res = await mod.updateCrewItemLocationQty(slug!, itemId, voxelId, delta, dbUser?.user_id);
      if (!res.success) {
        toast.error(res.error || "Server update failed");
        setErrorCount((p) => p + 1);
        setStreak(0);
        // revert by reloading authoritative state
        await loadCrewItems();
      } else {
        setStatsObj((prev) => ({
          ...prev,
          changedCount: prev.changedCount + 1,
          totalDelta: prev.totalDelta + absDelta,
          stars: prev.stars + (gameMode === "onload" ? 2 : 1),
          offloadUnits: gameMode === "offload" && delta < 0 ? prev.offloadUnits + absDelta : prev.offloadUnits,
          salary: prev.salary + (gameMode === "onload" ? 0.5 : 0.25),
        }));
      }
    } catch (e: any) {
      toast.error(e.message || "Update failed");
      setErrorCount((p) => p + 1);
      setStreak(0);
      await loadCrewItems();
    }
  };

  // File upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string | "";
        const parsed = parse(text, { header: true, skipEmptyLines: true }).data as any[];
        const mod = await import("./actions");
        const result = await mod.uploadCrewWarehouseCsv(parsed, slug!, dbUser?.user_id);
        if (result.success) {
          toast.success(result.message || "CSV uploaded successfully");
          await loadCrewItems();
        } else {
          toast.error(result.error || "Upload failed");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to parse CSV");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    // clear input so same file can be selected again later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Helper: safe clipboard with fallback
  const safeCopyToClipboard = async (text: string) => {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // fallthrough to execCommand fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  };

  // Checkpoint
  const handleCheckpoint = async () => {
    if (!activeShift) {
      toast.error("Start shift first to save checkpoint");
      return;
    }

    const snapshot = localItems.map((i) => ({ id: i.id, locations: i.locations.map((l: any) => ({ voxel: l.voxel, quantity: l.quantity })) }));
    setCheckpoint(snapshot);
    setCheckpointStart(Date.now());
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    setLastProcessedTotalDelta(null);
    setLastProcessedStars(null);
    setLastProcessedOffloadUnits(null);
    setLastProcessedSalary(null);
    toast.success("Checkpoint saved locally");

    // Save to server shift
    if (dbUser?.user_id) {
      try {
        const mod = await import("./actions");
        const res = await mod.saveCrewCheckpoint(slug!, dbUser.user_id, snapshot);
        if (!res.success) {
          console.warn("Shift checkpoint save failed:", res.error);
          toast.error("Failed to save checkpoint on server");
        } else {
          toast.success("Checkpoint saved to shift");
          // refresh activeShift info
          const s = await mod.getActiveShiftForCrewMember(slug!, dbUser.user_id);
          setActiveShift(s.shift || null);
        }
      } catch (e: any) {
        console.warn("Shift checkpoint save failed:", e);
      }
    }
  };

  const handleReset = async () => {
    if (!checkpoint?.length) {
      toast.error("No checkpoint available");
      return;
    }

    // local reset
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l: any) => ({ ...l })) })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    setLastCheckpointDurationSec(null);
    setLastProcessedCount(null);
    setLastProcessedTotalDelta(null);
    setLastProcessedStars(null);
    setLastProcessedOffloadUnits(null);
    setLastProcessedSalary(null);
    toast.success("Reset to checkpoint (local)");

    // server reset (requires active shift)
    if (dbUser?.user_id) {
      if (!activeShift) {
        toast.error("Start shift first to apply server reset");
        return;
      }
      try {
        const mod = await import("./actions");
        const res = await mod.resetCrewCheckpoint(slug!, dbUser.user_id);
        if (!res.success) {
          console.warn("Server reset failed:", res.error || res);
          toast.error("Server reset had failures; check logs");
        } else {
          toast.success(`Server reset applied (${res.applied} items)`);
          await loadCrewItems();
        }
      } catch (e: any) {
        console.warn("Server reset error:", e);
        toast.error("Server reset error");
      }
    }
  };

  // Exports - with clipboard attempt
  const handleExportDiff = async () => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    const diffData = localItems.flatMap((item) =>
      (item.locations || []).map((loc: any) => {
        const cpLoc = checkpoint.find((cp) => cp.id === item.id)?.locations.find((cl: any) => cl.voxel === loc.voxel);
        const diffQty = (loc.quantity || 0) - (cpLoc?.quantity || 0);
        return diffQty !== 0 ? { id: item.id, diffQty, voxel: loc.voxel } : null;
      }).filter(Boolean)
    );
    if (diffData.length === 0) {
      toast.info("No changes to export");
      return;
    }

    try {
      const mod = await import("./actions");
      const result = await mod.exportCrewDiffToOwner(slug!, diffData as any, dbUser?.user_id);
      if (result.success && result.csv) {
        // try copy to clipboard first
        const copied = await safeCopyToClipboard(result.csv);
        if (copied) {
          toast.success("Diff copied to clipboard");
        } else {
          const blob = new Blob([result.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `diff_${slug}.tsv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Difference exported (downloaded)");
        }
      } else {
        toast.error(result.error || "Export failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Export error");
    }
  };

  const handleExportStock = async (summarized = false) => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    try {
      const mod = await import("./actions");
      const result = await mod.exportCrewCurrentStock(slug!, localItems, summarized, dbUser?.user_id);
      if (result.success && result.csv) {
        // prefer clipboard for quick daily export (and fallback to download)
        const copied = await safeCopyToClipboard(result.csv);
        if (copied) {
          toast.success("Stock copied to clipboard");
        } else {
          const blob = new Blob([result.csv], { type: "text/tab-separated-values" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = summarized ? `stock_summary_${slug}.tsv` : `stock_${slug}.tsv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("Stock exported successfully");
        }
      } else {
        toast.error(result.error || "Export failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Export error");
    }
  };

  // Item click handler
  const handleItemClick = (item: any) => {
    if (!gameMode) {
      toast.info(item.description || "No description available");
      return;
    }
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required for operations");
      return;
    }
    const delta = gameMode === "onload" ? 1 : -1;
    let voxel = selectedVoxel || item.locations[0]?.voxel || "A1";
    if (gameMode === "offload" && !selectedVoxel) {
      const hasStock = item.locations.some((l: any) => (l.quantity || 0) > 0);
      if (!hasStock) {
        toast.error("No stock available");
        return;
      }
      voxel = item.locations.find((l: any) => (l.quantity || 0) > 0)?.voxel || "A1";
    }
    optimisticUpdate(item.id, voxel, delta);
  };

  // Search-only filtered items
  const filteredItems = useMemo(() => {
    return localItems.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [localItems, search]);

  const formatSec = (sec: number | null) => sec === null ? "--:--" : new Date(sec * 1000).toISOString().substr(14, 5);

  if (loading) {
    return <div className="p-4">Loading crew warehouse...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="p-4 bg-white dark:bg-gray-800 shadow">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{crew?.name} Warehouse</h1>
          <div className="flex gap-2 items-center overflow-x-auto">
            {/* Compact icon buttons to avoid overflow; titles provide accessibility */}
            <Button
              onClick={handleCheckpoint}
              size="sm"
              variant="outline"
              className="w-9 h-9 p-2"
              title={activeShift ? "Save checkpoint" : "Start shift to enable checkpoint"}
              aria-label="Save checkpoint"
              disabled={!activeShift}
            >
              <Save className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleReset}
              size="sm"
              variant="outline"
              className="w-9 h-9 p-2"
              title={activeShift ? "Reset to checkpoint" : "Start shift to enable reset"}
              aria-label="Reset checkpoint"
              disabled={!activeShift}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleExportDiff}
              size="sm"
              variant="outline"
              className="w-9 h-9 p-2"
              title="Export diff"
              aria-label="Export diff"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => handleExportStock(false)}
              size="sm"
              variant="outline"
              className="w-9 h-9 p-2"
              title="Export stock"
              aria-label="Export stock"
            >
              <FileUp className="w-4 h-4" />
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="sm"
              variant="outline"
              className="w-9 h-9 p-2"
              title="Upload CSV"
              aria-label="Upload CSV"
            >
              <Upload className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <WarehouseItemCard
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                  disabled={!gameMode || (!isOwner && !["owner", "admin"].includes(memberRole || ""))}
                />
              ))}
            </div>
            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">No items found</div>
            )}
          </CardContent>
        </Card>

        <WarehouseViz
          items={localItems}
          selectedVoxel={selectedVoxel}
          onVoxelSelect={setSelectedVoxel}
          gameMode={gameMode}
        />

        <WarehouseStats
          stats={statsObj}
          score={score}
          level={level}
          streak={streak}
          errorCount={errorCount}
          onloadCount={onloadCount}
          offloadCount={offloadCount}
          editCount={editCount}
          sessionDuration={Math.floor((Date.now() - sessionStart) / 1000)}
          lastCheckpointDuration={lastCheckpointDurationSec}
          lastProcessedCount={lastProcessedCount}
          lastProcessedTotalDelta={lastProcessedTotalDelta}
          lastProcessedStars={lastProcessedStars}
          lastProcessedOffloadUnits={lastProcessedOffloadUnits}
          lastProcessedSalary={lastProcessedSalary}
        />
      </main>

      <WarehouseModals
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editVoxel={editVoxel}
        setEditVoxel={setEditVoxel}
        editContents={editContents}
        setEditContents={setEditContents}
        onSave={async (voxelId: string, contents: Array<{ item: any; quantity: number }>) => {
          for (const { item, quantity } of contents) {
            const currentQty = item.locations.find((l: any) => l.voxel === voxelId)?.quantity || 0;
            const delta = quantity - currentQty;
            if (delta !== 0) {
              await optimisticUpdate(item.id, voxelId, delta);
            }
          }
        }}
      />
    </div>
  );
}