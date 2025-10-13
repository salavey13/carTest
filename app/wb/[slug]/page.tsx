"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Image from "next/image";
import { Save, RotateCcw, Download, FileText, Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BikehousePage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug ?? null;
  const { dbUser, tg } = useAppContext();

  const [crew, setCrew] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<null | "onload" | "offload" | "none">(null);
  const [selectedVoxel, setSelectedVoxel] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<any[] | null>(null);
  const [checkpointStart, setCheckpointStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [activeShift, setActiveShift] = useState<any | null>(null);

  const isTelegram = !!tg;
  const isAdminish = memberRole && ["owner", "xadmin", "manager", "admin"].includes(memberRole);

  // initial load: crew metadata + items
  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const mod = await import("@/app/wb/[slug]/actions");
        const crewRes = await mod.fetchCrewBySlug(slug);
        if (crewRes.success && mounted) setCrew(crewRes.crew);
        // fetch items; allow non-members to view
        const itemsRes = await mod.fetchCrewItemsBySlug(slug, dbUser?.user_id);
        if (itemsRes.success && mounted) {
          setItems(itemsRes.data || []);
          setLocalItems(itemsRes.data || []);
          setMemberRole(itemsRes.memberRole || null);
        } else {
          if (mounted) {
            setItems([]);
            setLocalItems([]);
            toast.error(itemsRes.error || "Не удалось загрузить позиции");
          }
        }

        // also fetch active shift for current user (if logged in)
        if (dbUser?.user_id && crewRes.success && mounted) {
          try {
            const activeRes = await mod.getActiveShiftForMember(dbUser.user_id, crewRes.crew.id);
            if (activeRes?.success && activeRes.shift) {
              setActiveShift(activeRes.shift);
              // if active shift has checkpoint, restore it into localItems
              if (activeRes.shift.checkpoint && Object.keys(activeRes.shift.checkpoint || {}).length > 0) {
                const cp = activeRes.shift.checkpoint.data ?? null;
                if (cp && Array.isArray(cp)) {
                  setLocalItems(cp);
                  setCheckpoint(cp);
                  toast.success("Checkpoint restored from active shift");
                }
              }
            } else {
              setActiveShift(null);
            }
          } catch (e) {
            console.warn("Failed to fetch active shift on init", e);
          }
        }
      } catch (e:any) {
        console.error("Initial load failed:", e);
        toast.error("Ошибка загрузки страницы");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, dbUser?.user_id]);

  // keep local mirror for optimistic updates
  useEffect(() => setLocalItems(items || []), [items]);

  // optimistic update (UI) + server sync
  const optimisticUpdate = (itemId: string, voxelId: string, delta: number) => {
    setLocalItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const qty = Number(i.quantity || 0) + delta;
      return { ...i, quantity: Math.max(0, qty) };
    }));

    (async () => {
      try {
        const mod = await import("@/app/wb/[slug]/actions");
        const updateFn = mod?.updateItemQuantityForCrew;
        if (typeof updateFn !== "function") throw new Error("Server update unavailable");
        const res = await updateFn(slug!, itemId, delta, dbUser?.user_id);
        if (!res.success) {
          toast.error(res.error || "Server rejected change");
          // reload items on failure
          const fres = await mod.fetchCrewItemsBySlug(slug!, dbUser?.user_id);
          if (fres && fres.success) setLocalItems(fres.data || []);
        } else {
          const returned = res.item;
          setLocalItems(prev => prev.map(it => it.id === returned.id ? returned : it));
        }
      } catch (e:any) {
        console.error("optimistic server sync error:", e);
        toast.error(e?.message || "Sync failed");
      }
    })();
  };

  const handleItemClick = async (item: any) => {
    if (!item) return;
    if (gameMode === "onload") {
      if (!isAdminish) return toast.error("Только админы экипажа могут принимать байки");
      const targetVoxel = selectedVoxel || "A1";
      optimisticUpdate(item.id, targetVoxel, +1);
      toast.success(`Принятие: +1 в ${targetVoxel}`);
      return;
    }
    if (gameMode === "offload") {
      if (!isAdminish) return toast.error("Только админы экипажа могут выдавать байки");
      if ((Number(item.quantity || 0)) <= 0) return toast.error("Нет байка в наличии");
      optimisticUpdate(item.id, selectedVoxel || "A1", -1);
      toast.success(`Выдача: -1`);
      return;
    }
    toast(`Open: ${item.make || ""} ${item.model || ""}`);
  };

  // Shift actions
  const handleStartShift = async () => {
    if (!slug || !dbUser?.user_id) return toast.error("Login required");
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const crewRes = await mod.fetchCrewBySlug(slug);
      if (!crewRes.success) return toast.error("Crew lookup failed");
      const crewId = crewRes.crew.id;
      const res = await mod.startShiftForMember(dbUser.user_id, crewId, "online");
      if (!res.success) return toast.error(res.error || "Failed to start shift");
      setActiveShift(res.shift);
      toast.success("Shift started");
    } catch (e:any) {
      console.error("handleStartShift error:", e);
      toast.error("Failed to start shift");
    }
  };

  const handleEndShift = async () => {
    if (!activeShift?.id) return toast.error("No active shift");
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const res = await mod.endShiftForMember(activeShift.id);
      if (!res.success) return toast.error(res.error || "Failed to end shift");
      setActiveShift(null);
      toast.success("Shift ended");
    } catch (e:any) {
      console.error("handleEndShift error:", e);
      toast.error("Failed to end shift");
    }
  };

  // Save checkpoint — requires active shift (server enforces it)
  const handleCheckpoint = async () => {
    if (!slug) return toast.error("slug missing");
    if (!dbUser?.user_id) return toast.error("login required to save checkpoint");

    try {
      const snapshot = localItems.map(i => ({
        id: i.id,
        quantity: Number(i.quantity ?? i.total_quantity ?? 0),
        locations: i.locations ?? []
      }));

      const mod = await import("@/app/wb/[slug]/actions");
      const saveFn = mod?.saveCheckpointForShift;
      if (typeof saveFn !== "function") return toast.error("Server-side checkpoint save not available");

      const res = await saveFn(slug!, dbUser.user_id, snapshot);
      if (!res.success) return toast.error(res.error || "Failed to save checkpoint on server");

      setCheckpoint(snapshot);
      setCheckpointStart(Date.now());
      toast.success("Checkpoint saved to active shift (server)");
    } catch (e:any) {
      console.error("handleCheckpoint error:", e);
      toast.error(e?.message || "Failed to save checkpoint");
    }
  };

  // Reset checkpoint (server-side restore of car quantities)
  const handleReset = async () => {
    if (!slug) return toast.error("slug missing");
    if (!dbUser?.user_id) return toast.error("login required to reset checkpoint");
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const resetFn = mod?.resetCheckpointForShift;
      if (typeof resetFn !== "function") return toast.error("Reset not available");
      const res = await resetFn(slug!, dbUser.user_id);
      if (!res.success) {
        return toast.error(res.error || "Failed to reset checkpoint");
      }
      // reload items after reset
      const fres = await mod.fetchCrewItemsBySlug(slug!, dbUser?.user_id);
      if (fres.success) {
        setItems(fres.data || []);
        setLocalItems(fres.data || []);
      }
      setCheckpoint(null);
      setCheckpointStart(null);
      toast.success(`Checkpoint restored on server. Applied: ${res.applied || 0}/${res.attempted || 0}`);
    } catch (e:any) {
      console.error("handleReset error:", e);
      toast.error(e?.message || "Reset failed");
    }
  };

  // Export daily -> use exportDailyFromShifts
  const handleExportDaily = async () => {
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const exporter = mod?.exportDailyFromShifts;
      if (typeof exporter !== "function") return toast.error("Экспорт временно недоступен");

      const res = await exporter(slug!, { sinceDays: 7 });
      if (!res.success) return toast.error(res.error || "Export failed");

      const summary = res.summary_tsv || "";
      const detailed = res.detailed_tsv || "";

      // try clipboard
      let copied = false;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(summary);
          toast.success("Суммарный TSV скопирован в буфер обмена");
          copied = true;
        }
      } catch (e) {
        // fallback
      }

      if (!copied) {
        const blob = new Blob([summary], { type: "text/tab-separated-values;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shifts_summary_${slug}_${new Date().toISOString().slice(0,10)}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Summary TSV downloaded");
      }

      if (detailed) {
        const blob2 = new Blob([detailed], { type: "text/tab-separated-values;charset=utf-8" });
        const url2 = URL.createObjectURL(blob2);
        const a2 = document.createElement("a");
        a2.href = url2;
        a2.download = `shifts_detailed_${slug}_${new Date().toISOString().slice(0,10)}.tsv`;
        a2.click();
        URL.revokeObjectURL(url2);
      }
    } catch (e:any) {
      console.error("handleExportDaily error:", e);
      toast.error("Export failed");
    }
  };

  const contactOwner = async () => {
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const notify = mod?.notifyOwnerAboutStorageRequest;
      if (typeof notify !== "function") return toast.error("Notify action not available");
      const message = `Запрос на обсуждение условий хранения для экипажа: ${slug}\nПожалуйста, свяжитесь с отправившим.`;
      const res = await notify(slug!, message, dbUser?.user_id);
      if (!res.success) return toast.error(res.error || "Не удалось отправить уведомление владельцу");
      toast.success("Владелец уведомлён в Telegram (если настроен)");
    } catch (e:any) {
      console.error("contactOwner error:", e);
      toast.error("Failed to notify owner");
    }
  };

  const debugFetchAll = async () => {
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      if (typeof mod.fetchCrewAllCarsBySlug !== "function") return toast.error("Debug not available");
      const res = await mod.fetchCrewAllCarsBySlug(slug!);
      console.log("[debugFetchAll]", res);
      if (res.success) {
        setItems(res.data || []);
        setLocalItems(res.data || []);
        toast.success(`Debug fetched ${res.data?.length || 0} cars`);
      } else {
        toast.error(res.error || "Debug failed");
      }
    } catch (e:any) {
      console.error("debugFetchAll failed:", e);
      toast.error("Debug failed");
    }
  };

  const displayedItems = useMemo(() => localItems || [], [localItems]);

  if (!slug) return <div className="p-6">No crew slug</div>;

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* avatar removed — show name only */}
          <div className="leading-tight">
            <h1 className="text-lg font-bold">Bikehouse — {crew?.name || slug}</h1>
            <p className="text-xs text-muted-foreground">Склад зимнего хранения · Просмотр: публичный · Управление: {isAdminish ? "включено" : "только чтение"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shift control */}
          {dbUser?.user_id ? (
            activeShift ? (
              <button className="p-2 rounded border flex items-center gap-2 text-sm" title="End shift" onClick={handleEndShift}>
                <StopCircle size={14} /> End shift
              </button>
            ) : (
              <button className="p-2 rounded border flex items-center gap-2 text-sm" title="Start shift" onClick={handleStartShift}>
                <Play size={14} /> Start shift
              </button>
            )
          ) : (
            <button className="p-2 rounded border text-sm" onClick={() => toast.info("Please sign in to manage shifts")}>Sign in</button>
          )}

          <button className="p-2 rounded border" title="Checkpoint" onClick={handleCheckpoint}><Save size={14} /></button>
          <button className="p-2 rounded border" title="Reset to checkpoint" onClick={handleReset}><RotateCcw size={14} /></button>
          <button className="p-2 rounded border" title="Export daily (from shifts)" onClick={handleExportDaily}><Download size={14} /></button>
          <button className="p-2 rounded border" title="Export stock (summary)" onClick={handleExportDaily}><FileText size={14} /></button>
        </div>
      </header>

      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Select value={gameMode === null ? "none" : (gameMode === "none" ? "none" : gameMode)} onValueChange={(v: any) => setGameMode(v === "none" ? null : v)}>
            <SelectTrigger className="w-28 text-[12px]">
              <SelectValue placeholder="Режим" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без режима</SelectItem>
              <SelectItem value="onload">Прием</SelectItem>
              <SelectItem value="offload">Выдача</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {process.env.NEXT_PUBLIC_DEBUG !== "0" && (
            <button className="text-xs text-muted-foreground" onClick={debugFetchAll}>debug: fetch all</button>
          )}
        </div>
      </div>

      <main className="mt-4">
        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">Витрина байков ({displayedItems.length})</h2>
          {loading ? <p>Загрузка…</p> : displayedItems.length === 0 ? <p className="text-muted-foreground">Нет байков (тип: demo)</p> : (
            // 5 columns on mobile/base, scale down to 3/4 on larger screens
            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-3 gap-3">
              {displayedItems.map(it => (
                <div key={it.id} className="bg-white p-3 rounded-lg shadow-sm">
                  <WarehouseItemCard item={it} onClick={() => handleItemClick(it)} />
                  <div className="mt-2 text-sm text-muted-foreground">
                    <div>Кол-во: <strong>{it.quantity ?? it.total_quantity ?? 0}</strong></div>
                    {it.specs?.engine_cc && <div>Двигатель: {it.specs.engine_cc} cc</div>}
                    {it.daily_price && <div>Цена: {it.daily_price} ₽/дн</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold mb-2">План хранения</h3>
          <div className="bg-white p-3 rounded shadow">
            <WarehouseViz
              items={localItems}
              selectedVoxel={selectedVoxel}
              onSelectVoxel={setSelectedVoxel}
              onUpdateLocationQty={(itemId: string, voxelId: string, qty: number) => optimisticUpdate(itemId, voxelId, qty)}
              gameMode={gameMode === "none" ? null : (gameMode as any)}
              onPlateClick={(v:any) => { setSelectedVoxel(v); toast.info(`Ячейка ${v} выбрана`); }}
              VOXELS={[]}
            />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-base font-semibold mb-2">Инструкция для использования (весело)</h3>
          <div className="bg-slate-50 p-3 rounded text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-1">
              <li>Выберите режим сверху: Прием — чтобы добавить байки; Выдача — чтобы снять.</li>
              <li>Нажмите на клетку склада в плане, чтобы выбрать место хранения. Затем нажмите карточку байка справа — чтобы положить/забрать единицу.</li>
              <li>Нужна помощь? <button className="underline" onClick={contactOwner}>Contact Owner</button> — мы отправим владельцу короткое сообщение в Telegram.</li>
            </ol>
            <p className="mt-2 italic text-xs">Совет: при тестировании включите DEBUG режим (NEXT_PUBLIC_DEBUG ≠ 0) и используйте debug: fetch all, если не видите позиции.</p>
          </div>
        </section>
      </main>
    </div>
  );
}