"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, LogOut, Activity, FileText, Timer, Package, Coins, Share2 } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser, activeLobby } = useAppContext();
  const userId = dbUser?.user_id;

  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Расчет данных сессии
  const processedCount = useMemo(() => activeShift?.actions?.length || 0, [activeShift]);
  const estimatedRUB = useMemo(() => processedCount * 50, [processedCount]);

  const loadStatus = async () => {
    if (!slug || !userId) return;
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const statusRes = await mod.getCrewMemberStatus(slug, userId);
      if (statusRes?.success) setLiveStatus(statusRes.live_status || null);
      
      const shiftRes = await mod.getActiveShiftForCrewMember(slug, userId);
      setActiveShift(shiftRes?.shift || null);
    } catch (e) {
      console.warn("Сбой синхронизации статуса");
    }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 20000);
    return () => clearInterval(poll);
  }, [slug, userId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeShift && activeShift.clock_in_time && !activeShift.clock_out_time) {
      const startTs = Date.parse(activeShift.clock_in_time);
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeShift]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const startShift = async () => {
    if (!slug || !userId) return toast.error("Ошибка идентификации");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const res = await mod.startWarehouseShift(slug, userId);
      if (res?.success) {
        await mod.setCrewMemberLiveStatus(slug, userId, "online");
        toast.success("Смена запущена");
        await loadStatus();
      } else {
        toast.error(res?.error || "Ошибка старта");
      }
    } catch (e) {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const endShift = async () => {
    if (!slug || !userId || !activeShift?.id) return;
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const res = await mod.endWarehouseShift(slug, activeShift.id);
      if (res?.success) {
        await mod.setCrewMemberLiveStatus(slug, userId, "offline");
        toast.success("Смена завершена");
        await loadStatus();
      }
    } catch (e) {
      toast.error("Ошибка завершения");
    } finally {
      setLoading(false);
    }
  };

  const isWorking = !!activeShift;

  return (
    <Card className="p-0 bg-card border-border shadow-lg rounded-none sm:rounded-xl overflow-hidden">
      {/* Основная панель управления */}
      <div className="flex items-center justify-between p-3 gap-2">
        
        {/* Блок Времени и Статуса */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-2 h-8 rounded-full transition-colors shrink-0",
            isWorking ? "bg-green-500 animate-pulse" : "bg-muted"
          )} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
               <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter truncate">
                 {activeLobby ? activeLobby.name : "ОПЕРАЦИЯ: СКЛАД"}
               </span>
               {isWorking && <Activity size={10} className="text-green-500 animate-pulse" />}
            </div>
            <span className="text-2xl font-mono font-bold leading-none tracking-tighter">
              {formatTime(elapsedSec)}
            </span>
          </div>
        </div>

        {/* Кнопка действия (Главная цель на мобилке) */}
        <div className="flex items-center gap-2">
          {!isWorking ? (
            <Button 
              onClick={startShift} 
              disabled={loading || !userId} 
              className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 font-black uppercase italic tracking-widest text-sm rounded-none transition-all"
            >
              {loading ? "..." : "НАЧАТЬ"}
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={endShift} 
              disabled={loading} 
              className="h-12 px-6 font-black uppercase italic tracking-widest text-sm rounded-none transition-all"
            >
              {loading ? "..." : "СТОП"}
            </Button>
          )}
        </div>
      </div>

      {/* Скрываемая панель статистики (только при активной смене) */}
      <AnimatePresence>
        {isWorking && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/50">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <Package size={12} className="text-muted-foreground" />
                <span className="text-xs font-bold">{processedCount} <span className="text-[10px] text-muted-foreground font-normal">ед.</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins size={12} className="text-green-600" />
                <span className="text-xs font-bold">{estimatedRUB} <span className="text-[10px] text-muted-foreground font-normal">₽</span></span>
              </div>
            </div>

            <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Поделиться">
                    <Share2 size={14} />
                </Button>
                <Button variant="ghost" size="icon" disabled className="h-7 w-7 text-muted-foreground" title="PDF Отчет (Скоро)">
                    <FileText size={14} />
                </Button>
            </div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Системная инфо-строка */}
      <div className="bg-muted/10 px-3 py-1 flex justify-between items-center border-t border-border/30">
        <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
          ID: {userId?.slice(0,8) || "GHOST"} // V.2.0
        </span>
        <div className="flex items-center gap-1">
            <Timer size={10} className="text-zinc-500" />
            <span className="text-[8px] font-mono text-muted-foreground uppercase">Realtime_Sync_Active</span>
        </div>
      </div>
    </Card>
  );
}