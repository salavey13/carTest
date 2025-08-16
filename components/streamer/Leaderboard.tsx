"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Row = {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  total: number;
};

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
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/streamer/leaderboard?streamerId=${encodeURIComponent(streamerId)}`);
      const j = await res.json();
      if (j?.success && Array.isArray(j.data)) {
        // Normalize into map for fast updates
        const m = new Map<string, Row>();
        j.data.forEach((r: any) => {
          m.set(String(r.user_id), {
            user_id: String(r.user_id),
            username: r.username || (r.user_id as string),
            avatar_url: r.avatar_url ?? null,
            total: Number(r.total || 0),
          });
        });
        mapRef.current = m;
        setRows(Array.from(m.values()).sort((a, b) => b.total - a.total));
        setLastUpdated(Date.now());
      } else {
        setRows([]);
      }
    } catch (e: any) {
      console.error("[Leaderboard] snapshot fetch failed", e);
      setError("Не удалось загрузить leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Helper: ensure we have user metadata for a user_id (username/avatar)
  async function ensureUserMeta(userId: string) {
    const existing = mapRef.current.get(userId);
    if (existing && (existing.username && existing.avatar_url !== undefined)) return existing;
    try {
      // Try to fetch user record directly from public users table.
      const { data, error } = await supabase
        .from("users")
        .select("user_id, username, full_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("[Leaderboard] user fetch failed for", userId, error);
        return existing ?? null;
      }
      const u = data;
      if (!u) return existing ?? null;
      const username = u.username || u.full_name || String(u.user_id);
      const avatar_url = u.avatar_url ?? null;
      return { user_id: String(u.user_id), username, avatar_url, total: existing?.total ?? 0 };
    } catch (e) {
      console.warn("[Leaderboard] ensureUserMeta error", e);
      return existing ?? null;
    }
  }

  useEffect(() => {
    if (!streamerId) return;

    fetchBoardSnapshot();

    // Setup realtime subscription (prefer Postgres changes channel)
    // We subscribe both to INSERT and UPDATE on 'invoices' filtered by subscription_id.
    try {
      const channelName = `public:invoices:streamer-${streamerId}`;
      const channel = supabase.channel(channelName);

      // INSERT
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` },
        async (payload: any) => {
          try {
            const rec = payload?.new;
            if (!rec) return;
            // only consider paid invoices (some flows create pending then later update to paid)
            if (String(rec.status) !== "paid") return;

            const userId = String(rec.user_id);
            const amount = Number(rec.amount || 0);
            // Update map
            const prev = mapRef.current.get(userId);
            if (prev) {
              const updated = { ...prev, total: prev.total + amount };
              mapRef.current.set(userId, updated);
            } else {
              // optimistic add — metadata may be missing; try to fetch it
              const meta = await ensureUserMeta(userId);
              const newRow: Row = {
                user_id: userId,
                username: meta?.username ?? userId,
                avatar_url: meta?.avatar_url ?? null,
                total: (meta?.total ?? 0) + amount,
              };
              mapRef.current.set(userId, newRow);
            }
            const arr = Array.from(mapRef.current.values()).sort((a, b) => b.total - a.total);
            setRows(arr);
            setLastUpdated(Date.now());
            // highlight donor
            setHighlightedUserId(userId);
            window.setTimeout(() => setHighlightedUserId(null), 3500);
          } catch (e) {
            console.error("[Leaderboard realtime INSERT handler] error", e);
          }
        }
      );

      // UPDATE (for invoices that become 'paid' after update)
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` },
        async (payload: any) => {
          try {
            const rec = payload?.new;
            if (!rec) return;
            // If invoice status changed to 'paid', include it (payload doesn't include old value reliably on client)
            if (String(rec.status) !== "paid") return;

            const userId = String(rec.user_id);
            const amount = Number(rec.amount || 0);
            const prev = mapRef.current.get(userId);
            if (prev) {
              const updated = { ...prev, total: prev.total + amount };
              mapRef.current.set(userId, updated);
            } else {
              const meta = await ensureUserMeta(userId);
              const newRow: Row = {
                user_id: userId,
                username: meta?.username ?? userId,
                avatar_url: meta?.avatar_url ?? null,
                total: amount,
              };
              mapRef.current.set(userId, newRow);
            }
            const arr = Array.from(mapRef.current.values()).sort((a, b) => b.total - a.total);
            setRows(arr);
            setLastUpdated(Date.now());
            setHighlightedUserId(userId);
            window.setTimeout(() => setHighlightedUserId(null), 3500);
          } catch (e) {
            console.error("[Leaderboard realtime UPDATE handler] error", e);
          }
        }
      );

      // Subscribe
      channel.subscribe((status: any) => {
        // status: "SUBSCRIBED" / "MESSAGE" / "CLOSED" etc
        // Log for debugging purposes, not fatal for production.
        // Keep the channel reference so we can remove on unmount.
        // We'll store the channel object in ref to allow cleanup.
        // console.log("[Leaderboard] channel status", status);
      });

      supabaseRef.current = channel;
    } catch (e) {
      console.warn("[Leaderboard] realtime subscription setup failed", e);
      // Keep UI functional; user can manual refresh.
    }

    // Cleanup on unmount or streamerId change
    return () => {
      try {
        if (supabaseRef.current) {
          // v2 channels return unsubscribe/leave methods; try both possibilities
          if (typeof supabaseRef.current.unsubscribe === "function") {
            supabaseRef.current.unsubscribe();
          } else {
            // supabase.removeChannel might exist
            if (typeof (supabase as any).removeChannel === "function") {
              (supabase as any).removeChannel(supabaseRef.current);
            }
          }
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamerId]);

  return (
    <div className="p-3 bg-card rounded-md border border-border" aria-live="polite">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold mb-2">Топ поддержавших</h4>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={fetchBoardSnapshot} disabled={loading}>Обновить</Button>
          <div className="text-xs text-muted-foreground">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ""}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i)=> (
            <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-destructive-foreground">{error}</div>
      ) : (
        <ol className="list-decimal list-inside space-y-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">Пока что нет донатов</div>}
          {rows.map((r) => {
            const isHighlighted = highlightedUserId === r.user_id;
            return (
              <li key={r.user_id} className={`flex items-center gap-3 transition-shadow duration-300 ${isHighlighted ? "shadow-yellow-glow border border-primary/30 rounded-md p-1" : ""}`}>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs">
                  {r.avatar_url ? (
                    <Image src={r.avatar_url} alt={r.username} width={32} height={32} />
                  ) : (
                    <span>{(r.username && r.username[0]) || "?"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.user_id}</div>
                </div>
                <div className="font-semibold text-right">{r.total}★</div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}