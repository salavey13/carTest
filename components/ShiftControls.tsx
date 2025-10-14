"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Truck, LogOut } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * ShiftControls
 * - prop: slug (crew slug)
 * - uses useAppContext().dbUser.user_id for member id
 *
 * Behavior:
 * - fetches member live_status and active shift
 * - offers actions that mimic bot keyboard:
 *    - Start Shift (clock_in)
 *    - Toggle Ride (On Bike / In Box)
 *    - End Shift (clock_out)
 *
 * Notes:
 * - server functions are imported from /app/wb/[slug]/actions_shifts.ts
 */

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id;
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    if (!slug || !userId) {
      setLiveStatus(null);
      setActiveShift(null);
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
    }
  };

  useEffect(() => {
    loadStatus();
    // poll lightly while mounted so UI reflects changes quickly
    const iv = setInterval(() => loadStatus(), 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, userId]);

  const startShift = async () => {
    if (!slug || !userId) return toast.error("Нет данных пользователя/экипажа");
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      // 1) ensure DB shift row
      const startRes = await mod.startWarehouseShift(slug, userId);
      if (!startRes?.success) {
        toast.error(startRes?.error || "Не удалось начать смену (shift row)");
        // still try to set live_status in crew_members for safety
      } else {
        toast.success("Смена начата (shift saved)");
      }
      // 2) set member live_status to 'online'
      const setRes = await mod.setCrewMemberLiveStatus(slug, userId, "online");
      if (!setRes?.success) {
        toast.error(setRes?.error || "Не удалось установить статус участника");
      } else {
        toast.success("Статус: Онлайн");
      }
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
      if (!setRes?.success) {
        toast.error(setRes?.error || "Не удалось переключить статус");
      } else {
        toast.success(newStatus === "riding" ? "Статус: На байке" : "Статус: Онлайн (в боксе)");
      }
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
      // 1) fetch active shift
      const s = await mod.getActiveShiftForCrewMember(slug, userId);
      const shift = s?.shift || null;
      if (shift && shift.id) {
        const endRes = await mod.endWarehouseShift(slug, shift.id);
        if (!endRes?.success) {
          toast.error(endRes?.error || "Не удалось завершить смену (shift end)");
        } else {
          toast.success("Смена завершена (shift closed)");
        }
      } else {
        // still proceed to set member offline
        toast.info("Активной смены не найдено, переключаем статус участника в offline");
      }
      // 2) set live_status offline
      const setRes = await mod.setCrewMemberLiveStatus(slug, userId, "offline", { last_location: null });
      if (!setRes?.success) {
        toast.error(setRes?.error || "Не удалось установить offline");
      } else {
        toast.success("Статус: Оффлайн");
      }
      await loadStatus();
    } catch (e: any) {
      console.error("endShift error", e);
      toast.error(e?.message || "Ошибка завершения смены");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-gray-600 dark:text-gray-300 mr-2">
        Статус: <span className="font-medium">{liveStatus || "—"}</span>
      </div>

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
  );
}