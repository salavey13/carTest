"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import WarehouseItemCard from "@/components/WarehouseItemCard";
import WarehouseViz from "@/components/WarehouseViz";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";

export default function CrewWBPage() {
  const params = useParams() as { slug?: string };
  const slug = params?.slug || null;
  const { dbUser } = useAppContext();

  const [items, setItems] = useState<any[]>([]);
  const [crew, setCrew] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      setLoading(true);
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
        if (!mounted) return;
        if (!itemsRes.success) {
          toast.error(`Не удалось загрузить items: ${itemsRes.error || "unknown"}`);
          setItems([]);
        } else {
          setItems(itemsRes.data || []);
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

  if (!slug) return <div className="p-8">No crew slug provided</div>;

  const debugType = process.env.DEBUG_ITEM_TYPE || "bike";

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {crew?.logo_url ? (
            <div className="w-16 h-16 rounded-md overflow-hidden shadow">
              <Image src={crew.logo_url} alt={crew?.name || slug} width={64} height={64} className="object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-md bg-slate-200 flex items-center justify-center text-xl font-bold">BH</div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Bikehouse — {crew?.name || slug}</h1>
            <p className="text-sm text-muted-foreground">Тип: <strong>{debugType}</strong> · Показаны позиции экипажа</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => { setItems([]); toast.success("Локальная перезагрузка (имитация)"); }}>Clear view</Button>
          <Button variant="outline" onClick={() => toast.info("Заглушка: открой основную страницу")}>Open main</Button>
        </div>
      </header>

      <main>
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Витрина байков ({items.length})</h2>
          {loading ? (
            <p>Загрузка байков…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">Нет байков в этом экипаже (тип: {debugType}).</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {items.map((it) => (
                <div key={it.id} className="bg-card p-3 rounded-lg shadow-sm">
                  <WarehouseItemCard item={it} onClick={() => toast(`Открыл карточку ${it.make} ${it.model}`)} />
                  {/* Bike-specific quick info */}
                  <div className="mt-2 text-sm text-muted-foreground">
                    {it.specs?.engine_cc && <div>Двигатель: {it.specs.engine_cc} cc</div>}
                    {it.specs?.horsepower && <div>Л.с.: {it.specs.horsepower}</div>}
                    {it.daily_price && <div>Цена: {it.daily_price} ₽</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold mb-2">План склада</h3>
          <div className="bg-white p-4 rounded shadow">
            <WarehouseViz items={items} VOXELS={[]} onSelectVoxel={() => {}} onUpdateLocationQty={() => {}} gameMode={null} onPlateClick={() => {}} />
          </div>
        </section>
      </main>
    </div>
  );
}