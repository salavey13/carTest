"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, LogOut, Activity, FileText, Timer, Package, Coins } from "lucide-react";
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

  // Расчет статистики из логов действий
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
      console.warn("Ошибка загрузки статуса смены");
    }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 15000);
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
    if (!slug || !userId) return toast.error("Ошибка данных");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const res = await mod.startWarehouseShift(slug, userId);
      if (res?.success) {
        await mod.setCrewMemberLiveStatus(slug, userId, "online");
        toast.success("Смена начата");
        await loadStatus();
      } else {
        toast.error(res?.error || "Не удалось начать смену");
      }
    } catch (e) {
      toast.error("Ошибка подключения к серверу");
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
      toast.error("Ошибка завершения смены");
    } finally {
      setLoading(false);
    }
  };

  const isWorking = !!activeShift;

  return (
    <Card className="p-4 bg-card border-border shadow-md">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
        
        {/* Инфо о сессии */}
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
            isWorking ? "border-green-500 bg-green-500/10 text-green-500" : "border-muted text-muted-foreground"
          )}>
            {isWorking ? <Activity className="animate-pulse" /> : <Timer />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              {activeLobby ? `Рейд: ${activeLobby.name}` : "Работа на складе"}
            </span>
            <span className="text-xl font-mono font-bold leading-none">
              {formatTime(elapsedSec)}
            </span>
          </div>
        </div>

        {/* Статистика в реальном времени */}
        {isWorking && (
          <div className="flex gap-6 px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
                <Package size={10} /> Собрано
              </span>
              <span className="text-sm font-bold">{processedCount} шт.</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
                <Coins size={10} /> Доход
              </span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{estimatedRUB} ₽</span>
            </div>
          </div>
        )}

        {/* Кнопки управления */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled // Готовим к будущим обновлениям
            className="hidden sm:flex gap-2"
            title="Выгрузить отчет в PDF"
          >
            <FileText className="w-4 h-4" />
            PDF
          </Button>

          {!isWorking ? (
            <Button 
              onClick={startShift} 
              disabled={loading || !userId} 
              className="bg-primary text-primary-foreground font-bold px-6"
            >
              {loading ? "..." : "Начать смену"}
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={endShift} 
              disabled={loading} 
              className="font-bold px-6"
            >
              {loading ? "..." : "Завершить"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}