"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Truck, LogOut } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * ShiftControls
 * - shows live_status
 * - shows active shift elapsed time (if active)
 * - start / toggle ride / end shift actions
 *
 * Polls server for status and also updates elapsed timer clientside.
 */

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id;
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const loadStatus = async () => {
    if (!slug || !userId) {
      setLiveStatus(null);
      setActiveShift(null);
      setElapsedSec(null);
      return;
    }
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const statusRes = await mod.getCrewMemberStatus(slug, userId);
      if (statusRes?.success) {
        setLiveStatus(statusRes.live_status || null);
      } else {
        setLiveStatus(null);
      }
      const shiftRes = await mod.getActiveShiftForCrewMember(slug, userId);
      setActiveShift(shiftRes?.shift || null);
    } catch (e: any) {
      console.warn("ShiftControls: failed to load status", e);
      setLiveStatus(null);
      setActiveShift(null);
      setElapsedSec(null);
    }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(() => loadStatus(), 30_000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, userId]);

  // client timer: update elapsedSec every second while activeShift present
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (activeShift && activeShift.clock_in_time && !activeShift.clock_out_time) {
      const startTs = Date.parse(activeShift.clock_in_time);
      // set immediately
      setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      }, 1000) as any;
    } else {
      setElapsedSec(null);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [activeShift]);

  const formatElapsed = (s: number | null) => {
    if (s === null) return "--:--:--";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
    } catch (e: any) {
      console.error("startShift error", e);
      toast.error(e?.message || "Ошибка при старте смены");
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
    } catch (e: any) {
      console.error("toggleRide error", e);
      toast.error(e?.message || "Ошибка переключения статуса");
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
    } catch (e: any) {
      console.error("endShift error", e);
      toast.error(e?.message || "Ошибка завершения смены");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-2">
      <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
        Статус: <span className="font-medium">{liveStatus || "—"}</span>
      </div>

      <div className="text-xs text-gray-500 whitespace-nowrap">
        {activeShift ? (
          <>
            <div>Shift: <span className="font-medium">{activeShift.shift_type || "online"}</span></div>
            <div>Elapsed: <span className="font-mono">{formatElapsed(elapsedSec)}</span></div>
            <div className="text-xs text-gray-400">Actions: {(activeShift.actions || []).length || 0}</div>
          </>
        ) : (
          <div className="text-xs text-gray-400">No active shift</div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={startShift}
          disabled={loading || liveStatus === "online" || liveStatus === "riding" || !userId}
          title="Начать смену"
          className="px-2 py-1"
        >
          <Play className="w-4 h-4 mr-1" />Start
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={toggleRide}
          disabled={loading || (!liveStatus) || liveStatus === "offline" || !userId}
          title={liveStatus === "riding" ? "Вернуться в бокс" : "Отметиться: на байке"}
          className="px-2 py-1"
        >
          <Truck className="w-4 h-4 mr-1" />{liveStatus === "riding" ? "In Box" : "On Bike"}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={endShift}
          disabled={loading || liveStatus === "offline" || !userId}
          title="Завершить смену"
          className="px-2 py-1"
        >
          <LogOut className="w-4 h-4 mr-1" />End
        </Button>
      </div>
    </div>
  );
}