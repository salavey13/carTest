"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import { toast } from "sonner";
import Image from "next/image";

export default function CrewWBPage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug || null;
  const { dbUser } = useAppContext();

  const [items, setItems] = useState<any[]>([]);
  const [crew, setCrew] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<any | null>(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setDebug(null);
      try {
        const mod = await import("@/app/wb/[slug]/actions");
        const fetchCrewItemsBySlug = mod?.fetchCrewItemsBySlug;
        const fetchCrewBySlug = mod?.fetchCrewBySlug;
        if (typeof fetchCrewItemsBySlug !== "function" || typeof fetchCrewBySlug !== "function") {
          throw new Error("Server actions unavailable");
        }

        const crewRes = await fetchCrewBySlug(slug);
        if (!crewRes.success) throw new Error(crewRes.error || "Crew not found");
        if (!mounted) return;
        setCrew(crewRes.crew);

        const userChatId = dbUser?.user_id ?? undefined;
        const itemsRes = await fetchCrewItemsBySlug(slug, userChatId); // uses DEBUG_ITEM_TYPE='bike' by default
        // debug: log server response
        // eslint-disable-next-line no-console
        console.log("[Client] fetchCrewItemsBySlug result:", itemsRes);

        if (!mounted) return;
        if (!itemsRes.success) {
          toast.error(`Не удалось загрузить items: ${itemsRes.error || "unknown"}`);
          setItems([]);
          setDebug(itemsRes.debug || null);
        } else {
          setItems(itemsRes.data || []);
          setDebug(itemsRes.debug || null);
        }
      } catch (err: any) {
        console.error("CrewWBPage load error:", err);
        toast.error(err?.message || "Ошибка загрузки crew items");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, dbUser]);

  if (!slug) return <div className="p-4 text-sm">No crew slug provided</div>;

  const debugType = process.env.NEXT_PUBLIC_DEBUG_ITEM_TYPE || process.env.DEBUG_ITEM_TYPE || "bike";

  return (
    <div className="min-h-screen px-4 py-3 bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <header className="flex items-center gap-3 mb-4">
        {crew?.logo_url ? (
          <div className="w-12 h-12 rounded-md overflow-hidden shadow-sm flex-shrink-0">
            <Image src={crew.logo_url} alt={crew?.name || slug} width={48} height={48} className="object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md bg-slate-200 flex items-center justify-center text-base font-bold flex-shrink-0">BH</div>
        )}
        <div>
          <h1 className="text-lg font-semibold leading-tight">Bikehouse — {crew?.name || slug}</h1>
          <p className="text-xs text-muted-foreground">Тип: <strong>{debugType}</strong></p>
        </div>
      </header>

      <main>
        <section className="mb-4">
          <h2 className="text-sm font-medium mb-2">Витрина байков <span className="text-xs text-muted-foreground">({items.length})</span></h2>

          {loading ? (
            <p className="text-sm">Загрузка…</p>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              <p>Нет байков в этом экипаже (тип: {debugType}).</p>
              {debug ? (
                <details className="mt-2 text-xs bg-slate-50 border border-slate-100 p-2 rounded">
                  <summary className="cursor-pointer">Диагностика (нажми)</summary>
                  <pre className="text-[11px] mt-2 whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {items.map((it) => (
                <div key={it.id} className="bg-card p-2 rounded-md shadow-sm">
                  <WarehouseItemCard item={it} onClick={() => toast(`Открыл ${it.make} ${it.model}`)} />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {it.specs?.engine_cc && <div>Двигатель: {it.specs.engine_cc} cc</div>}
                    {it.specs?.horsepower && <div>Л.с.: {it.specs.horsepower}</div>}
                    {it.daily_price && <div>Цена: {it.daily_price} ₽</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium mb-2">План склада</h3>
          <div className="bg-white p-2 rounded shadow-sm">
            <WarehouseViz items={items} VOXELS={[]} onSelectVoxel={() => {}} onUpdateLocationQty={() => {}} gameMode={null} onPlateClick={() => {}} />
          </div>
        </section>
      </main>
    </div>
  );
}