"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { motion, AnimatePresence } from "framer-motion";

type Row = { user_id: string; username: string; avatar_url?: string | null; total: number; };

export default function Leaderboard({ streamerId }: { streamerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const supabaseRef = useRef<any>(null);
  const mapRef = useRef<Map<string, Row>>(new Map());
  const supabase = getSupabaseBrowserClient();

  async function fetchBoardSnapshot() {
    if (!streamerId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/streamer/leaderboard?streamerId=${encodeURIComponent(streamerId)}`);
      const j = await res.json();
      if (j?.success && Array.isArray(j.data)) {
        const m = new Map<string, Row>();
        j.data.forEach((r:any) => { m.set(String(r.user_id), { user_id:String(r.user_id), username: r.username || String(r.user_id), avatar_url: r.avatar_url ?? null, total: Number(r.total||0) }); });
        mapRef.current = m;
        setRows(Array.from(m.values()).sort((a,b)=>b.total-a.total));
        setLastUpdated(Date.now());
      } else setRows([]);
    } catch (e:any) { console.error(e); setError("Не удалось загрузить leaderboard"); setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!streamerId) return;
    fetchBoardSnapshot();

    try {
      const channelName = `public:invoices:streamer-${streamerId}`;
      const channel = supabase.channel(channelName);

      channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` }, async (payload:any) => {
        const rec = payload?.new; if (!rec || String(rec.status) !== "paid") return;
        const userId = String(rec.user_id); const amount = Number(rec.amount||0);
        const prev = mapRef.current.get(userId);
        if (prev) { const updated = { ...prev, total: prev.total + amount }; mapRef.current.set(userId, updated); }
        else { const { data:u } = await supabase.from("users").select("user_id, username, full_name, avatar_url").eq("user_id", userId).maybeSingle(); const uname = u ? (u.username || u.full_name || userId) : userId; const newRow = { user_id: userId, username: uname, avatar_url: u?.avatar_url ?? null, total: amount }; mapRef.current.set(userId, newRow); }
        const arr = Array.from(mapRef.current.values()).sort((a,b)=>b.total-a.total);
        setRows(arr); setLastUpdated(Date.now()); setHighlightedUserId(userId); setTimeout(()=>setHighlightedUserId(null), 3500);
      });

      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` }, async (payload:any) => {
        const rec = payload?.new; if (!rec || String(rec.status) !== "paid") return;
        const userId = String(rec.user_id); const amount = Number(rec.amount||0);
        const prev = mapRef.current.get(userId);
        if (prev) { const updated = { ...prev, total: prev.total + amount }; mapRef.current.set(userId, updated); }
        else { const { data:u } = await supabase.from("users").select("user_id, username, full_name, avatar_url").eq("user_id", userId).maybeSingle(); const uname = u ? (u.username || u.full_name || userId) : userId; const newRow = { user_id: userId, username: uname, avatar_url: u?.avatar_url ?? null, total: amount }; mapRef.current.set(userId, newRow); }
        const arr = Array.from(mapRef.current.values()).sort((a,b)=>b.total-a.total);
        setRows(arr); setLastUpdated(Date.now()); setHighlightedUserId(userId); setTimeout(()=>setHighlightedUserId(null), 3500);
      });

      channel.subscribe();
      supabaseRef.current = channel;
    } catch (e) { console.warn("[Leaderboard] realtime subscription setup failed", e); }

    return () => { try { if (supabaseRef.current) { if (typeof supabaseRef.current.unsubscribe === "function") supabaseRef.current.unsubscribe(); else if (typeof (supabase as any).removeChannel === "function") (supabase as any).removeChannel(supabaseRef.current); } } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamerId]);

  return (
    <div className="p-3 bg-gray-900 rounded-md border border-border" aria-live="polite"> {/* Dark bg */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold mb-2 text-white">Топ поддержавших</h4> {/* White text */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={fetchBoardSnapshot} disabled={loading}>Обновить</Button>
          <div className="text-xs text-gray-300">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ""}</div> {/* Light gray */}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i=> <div key={i} className="h-10 rounded bg-gray-800/50 animate-pulse" />)} {/* Darker bg */}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive-foreground">{error}</div>
      ) : (
        <ol className="list-decimal list-inside space-y-2">
          {rows.length === 0 && <div className="text-sm text-gray-300">Пока что нет донатов</div>} {/* Light gray */}
          <AnimatePresence initial={false}>
            {rows.map(r => {
              const isHighlighted = highlightedUserId === r.user_id;
              return (
                <motion.li key={r.user_id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.35 }} className={`flex items-center gap-3 transition-shadow duration-300 ${isHighlighted ? "shadow-yellow-glow border border-primary/30 rounded-md p-1 bg-gradient-to-r from-primary/6" : ""}`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs">
                    {r.avatar_url ? <Image src={r.avatar_url} alt={r.username} width={32} height={32} /> : <span>{(r.username && r.username[0]) || "?"}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-white">{r.username}</div> {/* White text */}
                    <div className="text-xs text-gray-300 truncate">{r.user_id}</div> {/* Light gray */}
                  </div>
                  <div className="font-semibold text-right text-white">{r.total}★</div> {/* White text */}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}