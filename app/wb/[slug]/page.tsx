"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUp, Save, RotateCcw, Upload, Mail } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import ShiftControls from "@/components/ShiftControls";

/**
 * Slugged warehouse page.
 */
export default function CrewWarehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug as string | undefined;
  const { dbUser } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [crew, setCrew] = useState<any | null>(null);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [gameMode, setGameMode] = useState<"offload" | "onload" | null>(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [checkpoint, setCheckpoint] = useState<any[]>([]);
  const [statsObj, setStatsObj] = useState({ changedCount: 0, totalDelta: 0, stars: 0, offloadUnits: 0, salary: 0 });
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [onloadCount, setOnloadCount] = useState(0);
  const [offloadCount, setOffloadCount] = useState(0);
  const [editCount, setEditCount] = useState(0);
  const [sessionStart, setSessionStart] = useState(Date.now());

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVoxel, setEditVoxel] = useState<string | null>(null);
  const [editContents, setEditContents] = useState<Array<{ item: any; quantity: number; newQuantity: number }>>([]);

  // car request override: 'auto' lets server decide by threshold, or 'taxi'/'pickup'
  const [carOverride, setCarOverride] = useState<"auto" | "taxi" | "pickup">("auto");

  // derive helpers (kept local to page)
  const deriveSizePack = (items: any[]) => {
    const counts: Record<string, number> = {};
    for (const it of items || []) {
      const size = (it.specs?.size || it.size || "").toString().trim() || "unknown";
      counts[size] = (counts[size] || 0) + 1;
    }
    const unique = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const map: Record<string, number> = {};
    unique.forEach((s, i) => (map[s] = Math.max(1, Math.min(10, i + 1))));
    return map;
  };
  const deriveVoxels = (items: any[]) => {
    const set = new Set<string>();
    for (const it of items || []) {
      const locs = it.specs?.warehouse_locations || it.locations || [];
      for (const l of locs) {
        const v = l.voxel_id || l.voxel || (typeof l === "string" ? l : undefined);
        if (v) set.add(v.toString());
      }
    }
    return Array.from(set).sort();
  };

  const SIZE_PACK = useMemo(() => deriveSizePack(localItems), [localItems]);
  const VOXELS = useMemo(() => deriveVoxels(localItems), [localItems]);

  useEffect(() => {
    if (!slug) {
      setError("No slug provided");
      setLoading(false);
      return;
    }
    loadCrewItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /**
   * loadCrewItems:
   * - load DB items (metadata)
   * - load active shift (if any) and use checkpoint + actions to reconstruct localItems
   * - if no checkpoint, use DB specs as before
   */
  const loadCrewItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const [crudMod, shiftsMod] = await Promise.all([import("./actions_crud"), import("./actions_shifts")]);
      const res = await crudMod.getCrewWarehouseItems(slug!);
      if (!res.success) {
        setError(res.error || "Failed to load warehouse");
        toast.error(res.error || "Ошибка загрузки");
        setLoading(false);
        return;
      }

      const crewMeta = res.crew;
      setCrew(crewMeta);
      setIsOwner(!!crewMeta?.owner_id && dbUser?.user_id === crewMeta.owner_id);

      // fetch active shift for this user (if auth present)
      let active: any = null;
      if (dbUser?.user_id) {
        try {
          const s = await shiftsMod.getActiveShiftForCrewMember(slug!, dbUser.user_id);
          active = s?.shift || null;
          setActiveShift(active);
        } catch (e) {
          active = null;
          setActiveShift(null);
        }
      }

      // Build items map by id from DB metadata
      const dbItems: any[] = (res.data || []).map((i: any) => ({ ...i, specs: i.specs || {}, locations: i.specs?.warehouse_locations || [] }));
      const dbMap = new Map<string, any>();
      dbItems.forEach((i) => dbMap.set(String(i.id), i));

      let itemsForUI: any[] = [];
      // If there is checkpoint data — reconstruct base snapshot from checkpoint + DB metadata
      if (active?.checkpoint?.data && Array.isArray(active.checkpoint.data) && active.checkpoint.data.length > 0) {
        const snapshot = active.checkpoint.data as any[];
        // Map snapshot rows into full items (merge DB metadata)
        const itemMap = new Map<string, any>();
        for (const row of snapshot) {
          const id = String(row.id);
          const meta = dbMap.get(id) || null;
          const locations = Array.isArray(row.locations) ? row.locations.map((l: any) => ({ voxel: l.voxel || l.voxel_id || l.voxel_id, quantity: Number(l.quantity || 0) })) : [];
          const total = locations.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
          const item = {
            id,
            make: meta?.make || "",
            model: meta?.model || "",
            name: meta ? `${meta.make || ""} ${meta.model || ""}`.trim() : id,
            description: meta?.description || "",
            image: meta?.image_url || null,
            locations,
            total_quantity: total,
            specs: meta?.specs || {},
            // keep original DB-supplied specs as well
            db_meta: meta || null,
          };
          itemMap.set(id, item);
        }

        // Include DB items that were not in checkpoint (so we can show them too)
        for (const dbi of dbItems) {
          if (!itemMap.has(String(dbi.id))) {
            const locs = (dbi.specs?.warehouse_locations || []).map((l: any) => ({ voxel: l.voxel_id, quantity: l.quantity }));
            const total = locs.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
            itemMap.set(String(dbi.id), {
              id: dbi.id,
              make: dbi.make || "",
              model: dbi.model || "",
              name: `${dbi.make || ""} ${dbi.model || ""}`.trim(),
              description: dbi.description || "",
              image: dbi.image_url || null,
              locations: locs,
              total_quantity: total,
              specs: dbi.specs || {},
              db_meta: dbi,
            });
          }
        }

        // If some actions reference items not in DB or snapshot, create placeholders
        if (Array.isArray(active.actions)) {
          for (const a of active.actions) {
            const itemId = a.itemId || a.item_id || a.id || a.sku;
            if (!itemId) continue;
            if (!itemMap.has(String(itemId))) {
              const meta = dbMap.get(String(itemId)) || null;
              const locs = meta ? (meta.specs?.warehouse_locations || []) : [];
              const lnorm = Array.isArray(locs) ? locs.map((l: any) => ({ voxel: l.voxel_id || l.voxel, quantity: Number(l.quantity || 0) })) : [];
              const total = lnorm.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
              itemMap.set(String(itemId), {
                id: itemId,
                make: meta?.make || "",
                model: meta?.model || "",
                name: meta ? `${meta.make || ""} ${meta.model || ""}`.trim() : String(itemId),
                description: meta?.description || "",
                image: meta?.image_url || null,
                locations: lnorm,
                total_quantity: total,
                specs: meta?.specs || {},
                db_meta: meta || null,
              });
            }
          }
        }

        // apply actions over snapshot (in chronological order)
        const allActions = Array.isArray(active.actions) ? [...active.actions] : [];
        allActions.sort((a: any, b: any) => {
          const ta = a.ts ? new Date(a.ts).getTime() : 0;
          const tb = b.ts ? new Date(b.ts).getTime() : 0;
          return ta - tb;
        });

        // counters
        let onloadCtr = 0;
        let offloadCtr = 0;
        let editCtr = 0;
        let points = 0;
        let streakLocal = 0;

        for (const a of allActions) {
          const itemId = a.itemId || a.item_id || a.id || a.sku;
          if (!itemId) continue;
          const key = String(itemId);
          const item = itemMap.get(key);
          if (!item) continue;

          const deltaRaw = typeof a.delta === "number" ? a.delta : (typeof a.qty === "number" ? a.qty : (typeof a.amount === "number" ? a.amount : null));
          const delta = deltaRaw === null ? null : Number(deltaRaw);
          if (delta === null || isNaN(delta)) continue;
          const voxel = a.voxel || a.voxel_id || (a.location && (a.location.voxel || a.location.voxel_id)) || (item.locations[0] && item.locations[0].voxel) || null;

          // find location index
          const locs = Array.isArray(item.locations) ? [...item.locations] : [];
          const idx = locs.findIndex((l: any) => String(l.voxel) === String(voxel));
          if (idx === -1) {
            // create new location if positive delta
            if (delta > 0) {
              locs.push({ voxel: voxel || "A1", quantity: Math.max(0, delta) });
            } else {
              // negative delta on non-existing location: skip
            }
          } else {
            locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
            if (locs[idx].quantity === 0) {
              // remove zeroed location
              // we'll filter later
            }
          }
          const filtered = locs.filter((l: any) => (l.quantity || 0) > 0);
          const newTotal = filtered.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
          item.locations = filtered;
          item.total_quantity = newTotal;
          itemMap.set(key, item);

          // counters
          if (a.type === "onload" || delta > 0) {
            onloadCtr += Math.abs(delta);
            points += 10 * Math.abs(delta);
          } else if (a.type === "offload" || delta < 0) {
            offloadCtr += Math.abs(delta);
            points += 5 * Math.abs(delta);
          } else {
            editCtr += Math.abs(delta);
            points += 2 * Math.abs(delta);
          }
          streakLocal += 1;
        }

        // set final items array
        itemsForUI = Array.from(itemMap.values());
        setOnloadCount(onloadCtr);
        setOffloadCount(offloadCtr);
        setEditCount(editCtr);
        setScore((p) => p + points);
        setStreak(streakLocal);
        // keep checkpoint in state
        setCheckpoint(active.checkpoint?.data || []);
      } else {
        // fallback: use DB current specs directly (no checkpoint)
        const mapped = dbItems.map((i: any) => {
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
            db_meta: i,
          };
        });
        itemsForUI = mapped;
        setCheckpoint([]);
        setOnloadCount(0);
        setOffloadCount(0);
        setEditCount(0);
      }

      setLocalItems(itemsForUI);
    } catch (e: any) {
      setError(e.message || "Load failed");
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  // optimisticUpdate (same as before)
  const optimisticUpdate = async (itemId: string, voxelId: string, delta: number) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => l.voxel === voxelId);
        if (idx !== -1) locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        else if (delta > 0) locs.push({ voxel: voxelId, quantity: delta });
        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const newTotal = filtered.reduce((acc, l) => acc + (l.quantity || 0), 0);
        return { ...i, locations: filtered, total_quantity: newTotal };
      })
    );

    const absDelta = Math.abs(delta);
    if (gameMode === "onload" && delta > 0) setOnloadCount((p) => p + absDelta);
    else if (gameMode === "offload" && delta < 0) setOffloadCount((p) => p + absDelta);
    else setEditCount((p) => p + absDelta);
    const points = gameMode === "onload" ? 10 : 5;
    setScore((p) => p + points);
    setStreak((p) => p + 1);

    try {
      const mod = await import("./actions_crud");
      const res = await mod.updateCrewItemLocationQty(slug!, itemId, voxelId, delta, dbUser?.user_id);
      if (!res.success) {
        toast.error(res.error || "Server update failed");
        setErrorCount((p) => p + 1);
        setStreak(0);
        await loadCrewItems();
      } else {
        setStatsObj((prev) => ({
          ...prev,
          changedCount: prev.changedCount + 1,
          totalDelta: prev.totalDelta + absDelta,
          stars: prev.stars + (gameMode === "onload" ? 2 : 1),
        }));
      }
    } catch (e: any) {
      toast.error(e.message || "Update failed");
      setErrorCount((p) => p + 1);
      setStreak(0);
      await loadCrewItems();
    }
  };

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
        const mod = await import("./actions_csv");
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const safeCopyToClipboard = async (text: string) => {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
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
    } catch {
      return false;
    }
  };

  const handleCheckpoint = async () => {
    if (!activeShift) {
      toast.error("Start shift first to save checkpoint");
      return;
    }
    const snapshot = localItems.map((i) => ({ id: i.id, locations: i.locations.map((l: any) => ({ voxel: l.voxel, quantity: l.quantity })) }));
    setCheckpoint(snapshot);
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Checkpoint saved locally");

    if (dbUser?.user_id) {
      try {
        const mod = await import("./actions_shifts");
        const res = await mod.saveCrewCheckpoint(slug!, dbUser.user_id, snapshot);
        if (!res.success) toast.error("Failed to save checkpoint on server");
        else {
          toast.success("Checkpoint saved to shift");
          const s = await mod.getActiveShiftForCrewMember(slug!, dbUser.user_id);
          setActiveShift(s.shift || null);
        }
      } catch (e) {
        console.warn("Shift checkpoint save failed", e);
      }
    }
  };

  const handleReset = async () => {
    if (!checkpoint?.length) {
      toast.error("No checkpoint available");
      return;
    }
    setLocalItems(checkpoint.map((i) => ({ ...i, locations: i.locations.map((l: any) => ({ ...l })) })));
    setOnloadCount(0);
    setOffloadCount(0);
    setEditCount(0);
    toast.success("Reset to checkpoint (local)");

    if (dbUser?.user_id) {
      if (!activeShift) {
        toast.error("Start shift first to apply server reset");
        return;
      }
      try {
        const mod = await import("./actions_shifts");
        const res = await mod.resetCrewCheckpoint(slug!, dbUser.user_id);
        if (!res.success) toast.error("Server reset had failures; check logs");
        else {
          toast.success(`Server reset applied (${res.applied} items)`);
          await loadCrewItems();
        }
      } catch (e) {
        console.warn("Server reset error", e);
        toast.error("Server reset error");
      }
    }
  };

  const handleExportStock = async (summarized = false) => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    try {
      const mod = await import("./actions_csv");
      const result = await mod.exportCrewCurrentStock(slug!, localItems, summarized);
      if (result.success && result.csv) {
        const copied = await safeCopyToClipboard(result.csv);
        if (copied) toast.success("Stock copied to clipboard");
        else {
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

  // new: export daily (onloads + offloads)
  const handleExportDaily = async () => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    try {
      const mod = await import("./actions_shifts");
      const res = await mod.exportDailyEntryForShift(slug!, { isTelegram: false });
      if (!res.success) {
        toast.error(res.error || "Export daily failed");
        return;
      }
      if (!res.csv || res.csv === "") {
        toast.info("Нет onload/offload операций за сегодня");
        return;
      }
      // copy to clipboard or download
      const copied = await safeCopyToClipboard(res.csv);
      if (copied) {
        toast.success("Daily on/off TSV скопирован в буфер");
      } else {
        const blob = new Blob([res.csv], { type: "text/tab-separated-values" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `daily_onoff_${slug}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Daily on/off exported");
      }
    } catch (e: any) {
      console.error("handleExportDaily error", e);
      toast.error(e?.message || "Export daily error");
    }
  };

  // new: send car request
  const handleSendCarRequest = async () => {
    if (!isOwner && !["owner", "admin"].includes(memberRole || "")) {
      toast.error("Admin access required");
      return;
    }
    try {
      const mod = await import("./actions_shifts");
      const res = await mod.sendDeliveryCarRequest(slug!, { forceType: carOverride === "auto" ? undefined : carOverride });
      if (!res.success) {
        toast.error(res.error || "Car request failed");
        return;
      }
      toast.success(`Car request sent — qty=${res.totalOffloadQty}, type=${res.carType}`);
    } catch (e: any) {
      console.error("handleSendCarRequest error", e);
      toast.error(e?.message || "Car request error");
    }
  };

  const filteredItems = useMemo(() => {
    return localItems.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [localItems, search]);

  if (loading) return <div className="p-4">Loading crew warehouse...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="p-3 bg-white dark:bg-gray-800 shadow">
        {/* Use column layout on small screens to avoid offscreen buttons */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex items-center gap-3">
            {crew?.logo_url && <img src={crew.logo_url} alt="logo" className="w-7 h-7 rounded mr-0 object-cover" />}
            <div>
              <h1 className="text-lg font-medium leading-tight">{crew?.name || "Crew"}</h1>
              <div className="text-xs text-gray-500">Warehouse</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Shift controls */}
            <ShiftControls slug={slug!} />

            {/* Mode switcher — compact */}
            <div className="flex items-center gap-1 ml-1">
              <Button
                size="sm"
                variant={gameMode === "onload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "onload" ? null : "onload")}
                className="px-2 py-1 text-xs"
                title="Onload (add items)"
              >
                +Load
              </Button>
              <Button
                size="sm"
                variant={gameMode === "offload" ? "default" : "outline"}
                onClick={() => setGameMode(prev => prev === "offload" ? null : "offload")}
                className="px-2 py-1 text-xs"
                title="Offload (remove items)"
              >
                −Unload
              </Button>
            </div>

            {/* Action icons — small and allowed to wrap */}
            <div className="flex gap-1 items-center ml-1 flex-wrap">
              <Button onClick={handleCheckpoint} size="sm" variant="outline" className="w-8 h-8 p-1" title={activeShift ? "Save checkpoint" : "Start shift to enable checkpoint"} disabled={!activeShift}>
                <Save className="w-4 h-4" />
              </Button>

              <Button onClick={handleReset} size="sm" variant="outline" className="w-8 h-8 p-1" title={activeShift ? "Reset to checkpoint" : "Start shift to enable reset"} disabled={!activeShift}>
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Button onClick={() => handleExportStock(false)} size="sm" variant="outline" className="w-8 h-8 p-1" title="Export stock">
                <FileUp className="w-4 h-4" />
              </Button>

              {/* NEW: export daily on/off */}
              <Button onClick={handleExportDaily} size="sm" variant="outline" className="w-8 h-8 p-1" title="Export today's onload/offload">
                <Mail className="w-4 h-4" />
              </Button>

              {/* Car request UI: selector + button */}
              <select
                value={carOverride}
                onChange={(e) => setCarOverride(e.target.value as any)}
                className="text-xs p-1 rounded border border-gray-200 dark:border-gray-700 ml-1"
                title="Car type override"
              >
                <option value="auto">Auto (auto-select)</option>
                <option value="taxi">Taxi (small)</option>
                <option value="pickup">Pickup (big)</option>
              </select>

              <Button onClick={handleSendCarRequest} size="sm" variant="outline" className="px-2 py-1 ml-1" title="Send delivery car request">
                Send car
              </Button>

              <input ref={fileInputRef} type="file" accept=".csv,.tsv" onChange={handleFileChange} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} size="sm" variant="outline" className="w-8 h-8 p-1" title="Upload CSV">
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search field under header row — keeps header compact and search prominent */}
        <div className="mt-3">
          <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
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
                  onClick={() => {
                    if (!gameMode) return toast.info(item.description || "No description available");
                    const delta = gameMode === "onload" ? 1 : -1;
                    let voxel = selectedVoxel || item.locations[0]?.voxel || "A1";
                    if (gameMode === "offload" && !selectedVoxel) {
                      const hasStock = item.locations.some((l: any) => (l.quantity || 0) > 0);
                      if (!hasStock) return toast.error("No stock available");
                      voxel = item.locations.find((l: any) => (l.quantity || 0) > 0)?.voxel || "A1";
                    }
                    optimisticUpdate(item.id, voxel, delta);
                  }}
                  disabled={!gameMode || (!isOwner && !["owner", "admin"].includes(memberRole || ""))}
                />
              ))}
            </div>
            {filteredItems.length === 0 && <div className="text-center py-8 text-gray-500">No items found</div>}
          </CardContent>
        </Card>

        <WarehouseViz items={localItems} selectedVoxel={selectedVoxel} onVoxelSelect={setSelectedVoxel} gameMode={gameMode} />

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
            if (delta !== 0) await optimisticUpdate(item.id, voxelId, delta);
          }
        }}
      />
    </div>
  );
}