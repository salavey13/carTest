"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Truck, LogOut, Activity } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id;
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const loadStatus = async () => {
    if (!slug || !userId) return;
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const statusRes = await mod.getCrewMemberStatus(slug, userId);
      if (statusRes?.success) setLiveStatus(statusRes.live_status || null);
      const shiftRes = await mod.getActiveShiftForCrewMember(slug, userId);
      setActiveShift(shiftRes?.shift || null);
    } catch (e) {
      console.warn("ShiftControls: failed to load status", e);
    }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 30_000);
    return () => clearInterval(poll);
  }, [slug, userId]);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (activeShift && activeShift.clock_in_time && !activeShift.clock_out_time) {
      const startTs = Date.parse(activeShift.clock_in_time);
      setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      }, 1000) as any;
    } else {
      setElapsedSec(null);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [activeShift]);

  const formatElapsed = (s: number | null) => {
    if (s === null) return "--:--:--";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const emitShiftChanged = () => {
    window.dispatchEvent(new CustomEvent("crew:shift:changed", { detail: { slug, userId } }));
  };

    const startShift = async () => {
    if (!slug || !userId) return toast.error("Нет данных пользователя/экипажа");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const startRes = await mod.startWarehouseShift(slug, userId);
      if (!startRes?.success) {
        toast.error(startRes?.error || "Не удалось начать смену (shift row)");
      } else {
        toast.success("Смена начата");
      }
      const setRes = await mod.setCrewMemberLiveStatus(slug, userId, "online");
      if (!setRes?.success) toast.error(setRes?.error || "Не удалось установить статус участника");
      await loadStatus();
      emitShiftChanged();
    } catch (e: any) {
      console.error("startShift error", e);
      toast.error(e?.message || "Ошибка при старте смены");
      emitShiftChanged();
    } finally {
      setLoading(false);
    }
  };
  const toggleRide = async () => {
    if (!slug || !userId) return toast.error("Нет данных пользователя/экипажа");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const statusRes = await mod.getCrewMemberStatus(slug, userId);
      const current = statusRes?.live_status || null;
      const newStatus = current === "riding" ? "online" : "riding";
      const setRes = await mod.setCrewMemberLiveStatus(slug, userId, newStatus);
      if (!setRes?.success) toast.error(setRes?.error || "Не удалось переключить статус");
      else toast.success(newStatus === "riding" ? "Статус: На байке" : "Статус: Онлайн (в боксе)");
      await loadStatus();
      emitShiftChanged();
    } catch (e: any) {
      console.error("toggleRide error", e);
      toast.error(e?.message || "Ошибка переключения статуса");
      emitShiftChanged();
    } finally {
      setLoading(false);
    }
  };
  const endShift = async () => {
    if (!slug || !userId) return toast.error("Нет данных пользователя/экипажа");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const s = await mod.getActiveShiftForCrewMember(slug, userId);
      const shift = s?.shift || null;
      if (shift && shift.id) {
        const endRes = await mod.endWarehouseShift(slug, shift.id);
        if (!endRes?.success) toast.error(endRes?.error || "Не удалось завершить смену (shift end)");
        else toast.success("Смена завершена");
      } else {
        toast.info("Активной смены не найдено, переключаем статус участника в offline");
      }
      const setRes = await mod.setCrewMemberLiveStatus(slug, userId, "offline", { last_location: null });
      if (!setRes?.success) toast.error(setRes?.error || "Не удалось установить offline");
      await loadStatus();
      emitShiftChanged();
    } catch (e: any) {
      console.error("endShift error", e);
      toast.error(e?.message || "Ошибка завершения смены");
      emitShiftChanged();
    } finally {
      setLoading(false);
    }
  };

  const isRiding = liveStatus === "riding";

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-sm">
      {/* Status & Timer Section */}
      <div className="flex items-center gap-3 flex-1 min-w-0 justify-between sm:justify-start">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${liveStatus === 'riding' || liveStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-foreground truncate">
            {liveStatus === 'riding' ? 'На байке' : liveStatus === 'online' ? 'Онлайн' : 'Офлайн'}
          </span>
        </div>
        
        {activeShift && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-background border border-border rounded-md">
            <Activity className="w-3 h-3 text-brand-purple" />
            <span className="font-mono text-sm text-foreground">{formatElapsed(elapsedSec)}</span>
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={startShift} 
          disabled={loading || liveStatus === "online" || liveStatus === "riding" || !userId} 
          className="h-9 px-3 text-xs hover:bg-green-500/10 hover:text-green-600 dark:hover:bg-green-500/20 dark:hover:text-green-400"
        >
          <Play className="w-4 h-4 mr-1" />
          Начать
        </Button>

        <Button 
          size="sm" 
          variant={isRiding ? "default" : "outline"} 
          onClick={toggleRide} 
          disabled={loading || !liveStatus || liveStatus === "offline" || !userId} 
          className={`h-9 px-3 text-xs transition-all duration-300 ${
            isRiding 
            ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
            : "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400"
          }`}
        >
          <Truck className="w-4 h-4 mr-1" />
          Байк
        </Button>

        <Button 
          size="sm" 
          variant="destructive" 
          onClick={endShift} 
          disabled={loading || liveStatus === "offline" || !userId} 
          className="h-9 px-3 text-xs"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Завершить
        </Button>
      </div>
    </div>
  );
}