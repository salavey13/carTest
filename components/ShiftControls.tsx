"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  Play, 
  LogOut, 
  Activity, 
  FileText, 
  Timer, 
  Package, 
  Coins, 
  Share2, 
  Loader2 
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// Correct local import path
import { generateCrewShiftPdf } from "@/app/wb/actions/service";
import { generateLobbyShareLink } from "@/app/strikeball/actions/service";

export default function ShiftControls({ slug }: { slug: string }) {
  const { dbUser, activeLobby, tg } = useAppContext();
  const userId = dbUser?.user_id;

  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live session statistics
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
      console.warn("ShiftControls: Link sync failed");
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
        toast.success("Смена начата");
        await loadStatus();
      } else {
        toast.error(res?.error || "Ошибка старта");
      }
    } catch (e) {
      toast.error("Сбой подключения");
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
      toast.error("Сбой завершения");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeShift?.id || !userId) return;
    setGenerating(true);
    const toastId = toast.loading("ФОРМИРОВАНИЕ ТАКТИЧЕСКОГО ОТЧЕТА...");
    try {
        const res = await generateCrewShiftPdf(userId, activeShift.id);
        if (res.success) {
            toast.success("ОТЧЕТ ОТПРАВЛЕН ВАМ В TELEGRAM", { id: toastId });
        } else {
            toast.error(res.error || "Ошибка генерации", { id: toastId });
        }
    } catch (e) {
        toast.error("Критическая ошибка системы печати", { id: toastId });
    } finally {
        setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!activeLobby?.id) return toast.error("Активная операция не найдена");
    setSharing(true);
    try {
        const res = await generateLobbyShareLink(activeLobby.id);
        if (res.success && res.shareUrl) {
            if (tg?.openTelegramLink) tg.openTelegramLink(res.shareUrl);
            else window.open(res.shareUrl, '_blank');
        }
    } catch (e) { toast.error("Ошибка связи"); }
    finally { setSharing(false); }
  };

  const isWorking = !!activeShift && !activeShift.clock_out_time;

  return (
    <Card className="p-0 bg-card border-border shadow-lg rounded-none sm:rounded-xl overflow-hidden">
      {/* --- Main Action Bar --- */}
      <div className="flex items-center justify-between p-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "w-2 h-8 rounded-full transition-colors shrink-0",
            isWorking ? "bg-green-500 animate-pulse" : "bg-muted"
          )} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
               <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter truncate">
                 {activeLobby ? activeLobby.name : "АВТОНОМНЫЙ_РЕЖИМ"}
               </span>
               {isWorking && <Activity size={10} className="text-green-500 animate-pulse" />}
            </div>
            <span className="text-2xl font-mono font-bold leading-none tracking-tighter">
              {formatTime(elapsedSec)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isWorking ? (
            <Button 
              onClick={startShift} 
              disabled={loading || !userId} 
              className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 font-black uppercase italic tracking-widest text-sm rounded-none"
            >
              {loading ? "..." : "НАЧАТЬ"}
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={endShift} 
              disabled={loading} 
              className="h-12 px-6 font-black uppercase italic tracking-widest text-sm rounded-none"
            >
              {loading ? "..." : "СТОП"}
            </Button>
          )}
        </div>
      </div>

      {/* --- Live Telemetry Strip --- */}
      <AnimatePresence>
        {isWorking && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/50">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5" title="Обработано единиц">
                <Package size={12} className="text-muted-foreground" />
                <span className="text-xs font-bold">{processedCount} <span className="text-[10px] text-muted-foreground font-normal">ед.</span></span>
              </div>
              <div className="flex items-center gap-1.5" title="Примерная выплата">
                <Coins size={12} className="text-green-600" />
                <span className="text-xs font-bold">{estimatedRUB} <span className="text-[10px] text-muted-foreground font-normal">₽</span></span>
              </div>
            </div>

            <div className="flex gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-brand-cyan" 
                    onClick={handleShare}
                    disabled={sharing}
                >
                    {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleExportPdf}
                    disabled={generating}
                    className={cn("h-7 w-7 hover:text-brand-cyan", generating ? "text-brand-cyan" : "text-muted-foreground")}
                >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                </Button>
            </div>
          </div>
        )}
      </AnimatePresence>
      
      {/* --- Hardware System Line --- */}
      <div className="bg-muted/10 px-3 py-1 flex justify-between items-center border-t border-border/30 font-mono text-[8px] text-muted-foreground uppercase tracking-widest">
        <span>UNIT_ID: {userId?.slice(0,8) || "ANON"} // OS_2.4</span>
        <div className="flex items-center gap-1">
            <Timer size={10} className="text-zinc-500" />
            <span>Telemetry_Secure_OLED</span>
        </div>
      </div>
    </Card>
  );
}