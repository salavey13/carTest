"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Play, LogOut, Activity, FileText, Timer, Package, Coins, Share2, Loader2, FileBarChart 
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { generateCrewShiftPdf, generateRaidSummaryPdf } from "@/app/wb/actions/service";

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser, activeLobby, userCrewInfo, tg } = useAppContext();
  const userId = dbUser?.user_id;
  const isOwner = userCrewInfo?.is_owner && userCrewInfo?.slug === slug;

  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const processedCount = useMemo(() => {
    if (!activeShift?.actions) return 0;
    return Array.isArray(activeShift.actions) 
      ? activeShift.actions.reduce((acc: number, curr: any) => acc + (Number(curr.qty) || 0), 0)
      : 0;
  }, [activeShift]);

  const loadStatus = async () => {
    if (!slug || !userId) return;
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const shiftRes = await mod.getActiveShiftForCrewMember(slug, userId);
      setActiveShift(shiftRes?.shift || null);
    } catch (e) { console.warn("Sync failed"); }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, activeShift ? 10000 : 30000);
    return () => clearInterval(poll);
  }, [slug, userId, !!activeShift]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeShift?.clock_in_time && !activeShift?.clock_out_time) {
      const startTs = Date.parse(activeShift.clock_in_time);
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      }, 1000);
    } else { setElapsedSec(0); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeShift]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleAction = async (type: 'start' | 'stop') => {
    setLoading(true);
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      if (type === 'start') {
        const res = await mod.startWarehouseShift(slug, userId);
        if (res?.success) {
          await mod.setCrewMemberLiveStatus(slug, userId, "online");
          toast.success("Смена начата");
        }
      } else {
        await mod.endWarehouseShift(slug, activeShift.id);
        await mod.setCrewMemberLiveStatus(slug, userId, "offline");
        toast.success("Смена завершена");
      }
      await loadStatus();
    } catch (e) { toast.error("Ошибка связи"); }
    finally { setLoading(false); }
  };

  const handlePdf = async (isRaid: boolean) => {
    setGenerating(true);
    const tId = toast.loading(isRaid ? "СБОРКА СВОДНОГО ОТЧЕТА..." : "СБОРКА ЛИЧНОГО ОТЧЕТА...");
    try {
      const res = isRaid ? await generateRaidSummaryPdf(userId!, slug) : await generateCrewShiftPdf(userId!, activeShift.id);
      if (res.success) toast.success("PDF ОТПРАВЛЕН В TELEGRAM", { id: tId });
      else toast.error(res.error, { id: tId });
    } catch (e) { toast.error("Ошибка печати", { id: tId }); }
    finally { setGenerating(false); }
  };

  const isWorking = !!activeShift && !activeShift.clock_out_time;

  return (
    <Card className="p-0 bg-card border-border shadow-lg rounded-none sm:rounded-xl overflow-hidden border-t-2 border-t-brand-cyan">
      <div className="flex items-center justify-between p-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-2 h-8 rounded-full", isWorking ? "bg-green-500 animate-pulse" : "bg-muted")} />
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-muted-foreground truncate">
              {activeLobby ? activeLobby.name : "ОПЕРАЦИЯ: СКЛАД"}
            </span>
            <span className="text-2xl font-mono font-bold tracking-tighter">
              {formatTime(elapsedSec)}
            </span>
          </div>
        </div>

        <Button 
          onClick={() => handleAction(isWorking ? 'stop' : 'start')} 
          disabled={loading} 
          variant={isWorking ? "destructive" : "default"}
          className="h-12 px-6 font-black uppercase italic tracking-widest text-sm rounded-none"
        >
          {loading ? "..." : (isWorking ? "СТОП" : "НАЧАТЬ")}
        </Button>
      </div>

      {activeShift && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/50">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <Package size={12} className="text-muted-foreground" />
              <span className="text-xs font-bold">{processedCount} <span className="text-[10px] font-normal">ед.</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins size={12} className="text-green-600" />
              <span className="text-xs font-bold">{processedCount * 50} ₽</span>
            </div>
          </div>

          <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePdf(false)} disabled={generating}>
                  {generating ? <Loader2 className="animate-spin" size={14}/> : <FileText size={14} />}
              </Button>
              {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-500" onClick={() => handlePdf(true)} disabled={generating}>
                    <FileBarChart size={14} />
                </Button>
              )}
          </div>
        </div>
      )}
    </Card>
  );
}