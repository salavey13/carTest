"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import WarehouseStats from "@/components/WarehouseStats";
import FilterAccordion from "@/components/FilterAccordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Image from "next/image";
import { Save, RotateCcw, Download, FileText } from "lucide-react";
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

  const [search, setSearch] = useState("");
  const [filterSeason, setFilterSeason] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<'size_season_color'|'color_size'|'season_size_color' | null>('size_season_color');

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
      } catch (e:any) {
        console.error("Initial load failed:", e);
        toast.error("Ошибка загрузки страницы");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, dbUser?.user_id]);

  // if member has active shift with checkpoint — restore it on load
  useEffect(() => {
    if (!slug || !dbUser?.user_id || !crew?.id) return;
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@/app/wb/[slug]/actions");
        const getActiveShiftForMember = mod?.getActiveShiftForMember;
        if (typeof getActiveShiftForMember !== "function") return;
        const res = await getActiveShiftForMember(dbUser.user_id, crew.id);
        if (!mounted) return;
        if (res?.success && res.shift) {
          if (res.shift.checkpoint && Object.keys(res.shift.checkpoint || {}).length > 0) {
            const cp = res.shift.checkpoint.data ?? null;
            if (cp && Array.isArray(cp)) {
              setLocalItems(cp);
              setCheckpoint(cp);
              toast.success("Checkpoint restored from active shift");
            }
          }
        }
      } catch (e:any) {
        console.warn("Failed to fetch active shift:", e);
      }
    })();
    return () => { mounted = false; };
  }, [slug, dbUser?.user_id, crew?.id]);

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

  const handleExportDaily = async () => {
    try {
      const mod = await import("@/app/wb/[slug]/actions");
      const exportDailyEntry = mod?.exportDailyEntry;
      if (typeof exportDailyEntry !== "function") return toast.error("Экспорт временно недоступен");

      const sumsPrev: Record<string, number> = {};
      const sumsCurr: Record<string, number> = {};
      (checkpoint || []).forEach((c: any) => sumsPrev[c.make || "other"] = (sumsPrev[c.make || "other"] || 0) + Number(c.quantity || 0));
      (localItems || []).forEach((c: any) => sumsCurr[c.make || "other"] = (sumsCurr[c.make || "other"] || 0) + Number(c.quantity || 0));
      const res = await exportDailyEntry(sumsPrev, sumsCurr, gameMode || "default", crew?.slug || "bikehouse", isTelegram);
      if (res?.csv) {
        try {
          await navigator.clipboard.writeText(res.csv);
          toast.success("TSV скопирован в буфер обмена");
        } catch {
          const blob = new Blob([res.csv], { type: "text/tab-separated-values;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "bikehouse_export.tsv";
          a.click();
          URL.revokeObjectURL(url);
          toast.success("TSV скачан (fallback)");
        }
      } else if (res.success) {
        toast.success("Экспорт завершён");
      } else {
        toast.error(res.error || "Export failed");
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

  const filteredItems = useMemo(() => {
    const q = (search || "").toLowerCase();
    return (localItems || []).filter(it => {
      const matchesSearch = ((it.make || "") + " " + (it.model || "") + " " + (it.description || "")).toLowerCase().includes(q);
      const matchesSeason = !filterSeason || it.season === filterSeason;
      const matchesPattern = !filterPattern || it.pattern === filterPattern;
      const matchesColor = !filterColor || it.color === filterColor;
      const matchesSize = !filterSize || it.size === filterSize;
      return matchesSearch && matchesSeason && matchesPattern && matchesColor && matchesSize;
    });
  }, [localItems, search, filterSeason, filterPattern, filterColor, filterSize]);

  if (!slug) return <div className="p-6">No crew slug</div>;

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {crew?.logo_url ? (
            <div className="w-12 h-12 rounded-md overflow-hidden shadow"><Image src={crew.logo_url} alt={crew?.name || slug} width={48} height={48} className="object-cover" /></div>
          ) : (
            <div className="w-12 h-12 rounded-md bg-slate-200 flex items-center justify-center font-bold">BH</div>
          )}
          <div className="leading-tight">
            <h1 className="text-lg font-bold">Bikehouse — {crew?.name || slug}</h1>
            <p className="text-xs text-muted-foreground">Склад зимнего хранения · Просмотр: публичный · Управление: {isAdminish ? "включено" : "только чтение"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded border" title="Checkpoint" onClick={handleCheckpoint}><Save size={14} /></button>
          <button className="p-2 rounded border" title="Reset to checkpoint" onClick={handleReset}><RotateCcw size={14} /></button>
          <button className="p-2 rounded border" title="Export daily" onClick={handleExportDaily}><Download size={14} /></button>
          <button className="p-2 rounded border" title="Export stock (summary)" onClick={() => toast.info("Stock export (todo)") }><FileText size={14} /></button>
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

      <main className="mt-4">
        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">Витрина байков ({filteredItems.length})</h2>
          {loading ? <p>Загрузка…</p> : filteredItems.length === 0 ? <p className="text-muted-foreground">Нет байков (тип: demo)</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredItems.map(it => (
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

      <div className="mt-6">
        <WarehouseStats
          itemsCount={localItems.length}
          uniqueIds={new Set((localItems||[]).map(i => i.id)).size}
          score={0}
          level={0}
          streak={0}
          dailyStreak={0}
          checkpointMain={checkpointStart ? `${Math.floor((Date.now()-checkpointStart)/1000)}s` : "--"}
          checkpointSub={checkpoint ? "есть чекпоинт" : "нет чекпоинта"}
          changedCount={0}
          totalDelta={0}
          stars={0}
          offloadUnits={0}
          salary={0}
          achievements={[]}
          sessionStart={null}
          errorCount={0}
          bossMode={false}
          bossTimer={0}
          leaderboard={[]}
          efficiency={0}
          avgTimePerItem={0}
          dailyGoals={[]}
          sessionDuration={0}
        />
      </div>
    </div>
  );
}