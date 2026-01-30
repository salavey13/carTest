"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, Users, Zap, Timer, CheckCircle2, ShieldEllipsis } from "lucide-react";
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

  const unitsProcessed = useMemo(() => activeShift?.actions?.length || 0, [activeShift]);
  const estimatedEarnings = useMemo(() => unitsProcessed * 50, [unitsProcessed]);

  const loadStatus = async () => {
    if (!slug || !userId) return;
    try {
      const mod = await import(`@/app/wb/[slug]/actions_shifts`);
      const statusRes = await mod.getCrewMemberStatus(slug, userId);
      setLiveStatus(statusRes?.live_status || 'offline');
      const shiftRes = await mod.getActiveShiftForCrewMember(slug, userId);
      setActiveShift(shiftRes?.shift || null);
    } catch (e) { console.warn("Link lost"); }
  };

  useEffect(() => {
    loadStatus();
    const poll = setInterval(loadStatus, 15000);
    return () => clearInterval(poll);
  }, [slug, userId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeShift?.clock_in_time && !activeShift?.clock_out_time) {
      const startTs = Date.parse(activeShift.clock_in_time);
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTs) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeShift]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const isRaider = activeShift?.shift_type === 'raid';

  return (
    <Card className="bg-black/60 backdrop-blur-xl border-white/5 rounded-none overflow-hidden shadow-2xl">
      <div className="flex flex-col md:flex-row items-stretch md:items-center p-5 gap-6">
        
        {/* IDENTITY & UPLINK */}
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-12 h-12 flex items-center justify-center border transition-all duration-700",
            activeShift ? "border-brand-cyan bg-brand-cyan/10" : "border-zinc-800 bg-zinc-950"
          )}>
            {isRaider ? <ShieldEllipsis className="w-6 h-6 text-brand-cyan" /> : <Users className="w-6 h-6 text-zinc-600" />}
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              {isRaider ? `TEMP_CLEARANCE: ${activeLobby?.name || 'RAID'}` : `CORE_CLEARANCE: ${slug.toUpperCase()}`}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tighter text-white">
                {formatTime(elapsedSec)}
              </span>
              <Timer className="w-3 h-3 text-zinc-800" />
            </div>
          </div>
        </div>

        {/* LIVE TELEMETRY */}
        {activeShift && (
          <div className="flex items-center gap-8 px-8 border-x border-white/5 font-mono">
            <div className="text-center">
              <p className="text-[8px] text-zinc-600 uppercase">Load_Units</p>
              <p className="text-xl font-bold text-brand-cyan">{unitsProcessed}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] text-zinc-600 uppercase">Est_Reward</p>
              <p className="text-xl font-bold text-emerald-500">{estimatedEarnings} ₽</p>
            </div>
          </div>
        )}

        {/* ACCESS CONTROL */}
        <div className="flex items-center gap-4">
           {activeShift ? (
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase">Active_Session</span>
               </div>
           ) : (
               <div className="text-[10px] font-mono text-zinc-700 uppercase">Standby_For_Uplink...</div>
           )}
        </div>
      </div>
      
      {/* SYSTEM BAR */}
      <div className="bg-white/5 px-4 py-1.5 flex justify-between border-t border-white/5">
        <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
          Auth: {isRaider ? 'LOBBY_TOKEN' : 'CREW_KEY'} // ID: {userId?.slice(0,8)}
        </span>
        <div className="flex items-center gap-2">
            <Zap className="w-2 h-2 text-brand-yellow" />
            <span className="text-[8px] font-mono text-zinc-600 uppercase">Sync_Secure_OLED</span>
        </div>
      </div>
    </Card>
  );
}