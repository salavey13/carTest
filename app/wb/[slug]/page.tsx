"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUp, Save, RotateCcw, Upload } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import WarehouseModals from "@/components/WarehouseModals";
import WarehouseStats from "@/components/WarehouseStats";
import ShiftControls from "@/components/ShiftControls";
import { WarehouseSyncButtons } from "@/components/WarehouseSyncButtons";

/**
 * Slugged warehouse page (updated).
 *
 * Fixes:
 * - fetch and set memberRole so admin buttons enable correctly
 * - reconstruct local items from shift.checkpoint + shift.actions (if present)
 * - pass proper props to WarehouseStats
 * - pass computed VOXELS to WarehouseViz (fix select only A1)
 * - move sync buttons to bottom
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

  // derive helpers
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
        if (v) set.add(String(v));
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

  const loadCrewItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const mod = await import("./actions_crud");
      const res = await mod.getCrewWarehouseItems(slug!);
      if (!res.success) throw new Error(res.error || "Failed to load crew items");

      // set crew and owner flag
      setCrew(res.crew || null);
      setIsOwner(!!res.crew?.owner_id && dbUser?.user_id === res.crew.owner_id);

      // map items to UI shape
      const mapped = (res.data || []).map((i: any) => {
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
      setLocalItems(mapped);

      // checkpoint default = current mapped snapshot
      setCheckpoint(mapped.map((it) => ({ id: it.id, locations: it.locations.map((l: any) => ({ ...l })) })));

      // fetch member status + active shift in parallel
      if (dbUser?.user_id) {
        try {
          const sMod = await import("./actions_shifts");
          const statusRes = await sMod.getCrewMemberStatus(slug!, dbUser.user_id);
          if (statusRes.success) {
            setMemberRole(statusRes.member?.role || null);
            // live_status maybe used by UI elsewhere
          } else {
            setMemberRole(null);
          }
          const s = await sMod.getActiveShiftForCrewMember(slug!, dbUser.user_id);
          const shift = s?.shift || null;
          setActiveShift(shift);
          // if there's a checkpoint in shift — restore local state from checkpoint + apply actions
          if (shift?.checkpoint?.data) {
            // start from checkpoint snapshot
            const baseSnapshot = Array.isArray(shift.checkpoint.data) ? shift.checkpoint.data : [];
            const idMap = new Map<string, any>();
            // create map of items from snapshot
            for (const r of baseSnapshot) {
              idMap.set(r.id, {
                id: r.id,
                locations: Array.isArray(r.locations) ? r.locations.map((l: any) => ({
                  voxel: l.voxel || l.voxel_id || l.id,
                  quantity: Number(l.quantity || 0)
                })) : []
              });
            }
            // apply actions in chronological order
            const actions = Array.isArray(shift.actions) ? shift.actions.slice().sort((a: any,b: any)=> (a.ts||0)-(b.ts||0)) : [];
            // initialize counters
            let onl = 0, offl = 0, edits = 0, changed = 0, delta = 0;
            for (const a of actions) {
              if (!a || !a.type) continue;
              const entry = idMap.get(a.itemId) || { id: a.itemId, locations: [] };
              // ensure voxel present
              const voxel = a.voxel || a.voxel_id || a.v || "A1";
              const qty = Number(a.qty || a.amount || 0);
              // mutate entry.locations array
              const loc = entry.locations.find((ll: any) => ll.voxel === voxel);
              if (a.type === "offload") {
                if (loc) loc.quantity = Math.max(0, (loc.quantity||0) - qty);
                else {
                  // nothing to remove, skip (still count)
                }
                offl += qty;
                changed++;
                delta -= qty;
              } else if (a.type === "onload") {
                if (loc) loc.quantity = (loc.quantity||0) + qty;
                else entry.locations.push({ voxel, quantity: qty });
                onl += qty;
                changed++;
                delta += qty;
              } else if (a.type === "edit") {
                // edit gives absolute new quantity in a.qty maybe; handle defensively
                const newQ = Number(a.newQty ?? a.qty ?? 0);
                if (loc) {
                  const diff = newQ - (loc.quantity || 0);
                  loc.quantity = Math.max(0, newQ);
                  if (diff !== 0) { edits += Math.abs(diff); changed++; delta += diff; }
                } else {
                  entry.locations.push({ voxel, quantity: newQ });
                  edits += newQ; changed++; delta += newQ;
                }
              }
              idMap.set(entry.id, entry);
            }
            // convert map back to items used by UI
            const restored = mapped.map((mi) => {
              const snap = idMap.get(mi.id);
              if (!snap) return mi;
              const locs = (snap.locations || []).map((l: any) => ({ voxel: l.voxel, quantity: l.quantity }));
              const total = locs.reduce((acc:any, l:any) => acc + (l.quantity||0), 0);
              return { ...mi, locations: locs, total_quantity: total };
            });
            setLocalItems(restored);
            setCheckpoint(restored.map((it) => ({ id: it.id, locations: it.locations.map((l:any)=>({...l})) })));
            // set counters from shift replay
            setOnloadCount(onl);
            setOffloadCount(offl);
            setEditCount(edits);
            setStatsObj((prev)=>({ ...prev, changedCount: changed, totalDelta: delta, offloadUnits: offl }));
          }
        } catch (e: any) {
          console.warn("Shift/member status fetch failed", e);
        }
      }

    } catch (e: any) {
      setError(e.message || "Load failed");
      toast.error("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  // optimistic update kept as before, but uses actions_crud update
  const optimisticUpdate = async (itemId: string, voxelId: string, delta: number) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const locs = (i.locations || []).map((l: any) => ({ ...l }));
        const idx = locs.findIndex((l: any) => l.voxel === voxelId);
        if (idx !== -1) locs[idx].quantity = Math.max(0, (locs[idx].quantity || 0) + delta);
        else if (delta > 0) locs.push({ voxel: voxelId, quantity: delta });
        const filtered = locs.filter((l) => (l.quantity || 0) > 0);
        const newTotal = filtered.reduce((acc: number, l: any) => acc + (l.quantity || 0), 0);
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
          offloadUnits: prev.offloadUnits + (gameMode === "offload" && delta < 0 ? Math.abs(delta) : 0),
        }));
      }
    } catch (e: any) {
      toast.error(e.message || "Update failed");
      setErrorCount((p) => p + 1);
      setStreak(0);
      await loadCrewItems();
    }
  };

  // CSV upload
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
    } catch { return false; }
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
      if (!activeShift) { toast.error("Start shift first to apply server reset"); return; }
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
    if (!isOwner && !["owner","admin"].includes(memberRole||"")) {
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

  // helper for export daily for shift (finalized)
  const handleExportDaily = async () => {
    if (!dbUser?.user_id) return toast.error("User required");
    try {
      const mod = await import("./actions_shifts");
      const res = await mod.exportDailyEntryForShift(slug!, { isTelegram: false });
      if (res?.success && res.csv) {
        const copied = await safeCopyToClipboard(res.csv);
        if (copied) toast.success("Daily TSV copied to clipboard");
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
      } else {
        toast.error(res?.error || "Export failed");
      }
    } catch (e:any) {
      toast.error(e?.message || "Export error");
    }
  };

  const filteredItems = useMemo(() => {
    return localItems.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [localItems, search]);

  // send car request (client trigger)
  const handleSendCar = async () => {
    if (!isOwner && !["owner","admin"].includes(memberRole||"")) {
      return toast.error("Only owner/admin can request car");
    }
    try {
      const mod = await import("./actions_shifts");
      // server function should calculate and notify; fallback to notifyAdmin if not present
      if (typeof mod.sendDeliveryCarRequest === "function") {
        const r = await mod.sendDeliveryCarRequest(slug!, { requester: dbUser?.user_id });
        if (r?.success) toast.success("Car request sent");
        else toast.error(r?.error || "Failed to send car request");
      } else {
        // fallback: notify admin
        const nmod = await import("./actions_notify");
        const msg = `Car request: crew=${slug} by ${dbUser?.user_id || "unknown"} — please check on portal.`;
        const rn = await nmod.notifyAdmin(msg);
        if (rn?.success) toast.success("Admin notified (fallback)");
        else toast.error("Failed to notify admin");
      }
    } catch (e:any) {
      console.error("send car error", e);
      toast.error(e?.message || "Send car failed");
    }
  };

  if (loading) return <div className="p-4">Loading crew warehouse...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  // prepare props for WarehouseStats
  const itemsCount = localItems.reduce((s, it) => s + (it.total_quantity || 0), 0);
  const uniqueIds = localItems.length;
  const checkpointMain = activeShift?.checkpoint?.saved_at ? new Date(activeShift.checkpoint.saved_at).toLocaleString() : "--:--";
  const checkpointSub = activeShift?.checkpoint?.saved_at ? `saved ${new Date(activeShift.checkpoint.saved_at).toLocaleTimeString()}` : "--:--";

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="p-3 bg-white dark:bg-gray-800 shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex items-center gap-3">
            {crew?.logo_url && <img src={crew.logo_url} alt="logo" className="w-7 h-7 rounded mr-0 object-cover" />}
            <div>
              <h1 className="text-lg font-medium leading-tight">{crew?.name || "Crew"}</h1>
              <div className="text-xs text-gray-500">Warehouse · Статус: {activeShift ? (activeShift.shift_type||"warehouse") : "offline"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ShiftControls slug={slug!} />

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

              <input ref={fileInputRef} type="file" accept=".csv,.tsv" onChange={handleFileChange} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} size="sm" variant="outline" className="w-8 h-8 p-1" title="Upload CSV">
                <Upload className="w-4 h-4" />
              </Button>

              <Button onClick={handleSendCar} size="sm" variant="secondary" className="h-8 ml-2 text-xs">
                Send car
              </Button>

              <Button onClick={handleExportDaily} size="sm" variant="ghost" className="h-8 ml-1 text-xs">
                Export daily
              </Button>
            </div>
          </div>
        </div>

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
                  disabled={!gameMode || (!isOwner && !["owner","admin"].includes(memberRole || ""))}
                />
              ))}
            </div>
            {filteredItems.length === 0 && <div className="text-center py-8 text-gray-500">No items found</div>}
          </CardContent>
        </Card>

        <WarehouseViz items={localItems} selectedVoxel={selectedVoxel} onSelectVoxel={setSelectedVoxel} onPlateClick={(v)=>setSelectedVoxel(v)} gameMode={gameMode} VOXELS={VOXELS} />

        <div className="mt-4">
          <WarehouseStats
            itemsCount={itemsCount}
            uniqueIds={uniqueIds}
            score={score}
            level={level}
            streak={streak}
            dailyStreak={0}
            checkpointMain={checkpointMain}
            checkpointSub={checkpointSub}
            changedCount={statsObj.changedCount}
            totalDelta={statsObj.totalDelta}
            stars={statsObj.stars}
            offloadUnits={statsObj.offloadUnits || offloadCount}
            salary={statsObj.salary}
            achievements={[]}
            sessionStart={sessionStart}
            errorCount={errorCount}
            bossMode={false}
            bossTimer={0}
            leaderboard={[]}
            efficiency={0}
            avgTimePerItem={0}
            dailyGoals={{ units: 100, errors: 0, xtr: 100 }}
            sessionDuration={Math.floor((Date.now() - sessionStart) / 1000)}
          />
        </div>

        {/* Sync buttons moved to bottom as requested */}
        <div className="mt-6">
          <WarehouseSyncButtons />
        </div>
      </main>

      <WarehouseModals
        workflowItems={[]}
        currentWorkflowIndex={0}
        selectedWorkflowVoxel={selectedVoxel}
        setSelectedWorkflowVoxel={setSelectedVoxel}
        handleWorkflowNext={async () => {}}
        handleSkipItem={() => {}}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editVoxel={editVoxel}
        editContents={editContents}
        setEditContents={setEditContents}
        saveEditQty={async (itemId: string, newQty: number) => {
          const currentQty = localItems.find((it) => it.id === itemId)?.locations.find((l:any)=>l.voxel===editVoxel)?.quantity || 0;
          const delta = newQty - currentQty;
          if (delta !== 0) await optimisticUpdate(itemId, editVoxel || "A1", delta);
        }}
        gameMode={gameMode}
        VOXELS={VOXELS}
      />
    </div>
  );
}