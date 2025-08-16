"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type DonationItem = {
  id: string;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  amount: number;
  type?: string;
  created_at?: string | null;
};

const TYPE_META: Record<string, { label: string; badge: string; className: string }> = {
  tip: { label: "Tip", badge: "💖", className: "shadow-pink-glow" },
  support: { label: "Support", badge: "👏", className: "shadow-blue-glow" },
  vip: { label: "VIP", badge: "⭐", className: "shadow-purple-glow" },
  market: { label: "Market", badge: "🧖", className: "shadow-yellow-glow" },
  unknown: { label: "Donation", badge: "★", className: "" },
};

export default function DonationFeed({ streamerId, limit = 12 }: { streamerId: string; limit?: number }) {
  const [feed, setFeed] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const chanRef = useRef<any>(null);

  async function fetchSnapshot() {
    if (!streamerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, user_id, amount, created_at, metadata")
        .eq("subscription_id", streamerId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[DonationFeed] snapshot error (client):", error);
        setFeed([]);
        setLoading(false);
        return;
      }

      const rows = (data || []).map((r: any) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        amount: Number(r.amount || 0),
        created_at: r.created_at,
        type: r.metadata?.tierId ?? r.metadata?.kind ?? "unknown",
      })) as DonationItem[];

      // enrich usernames
      const userIds = Array.from(new Set(rows.map((r) => r.user_id))).slice(0, 10);
      if (userIds.length) {
        const { data: usersData } = await supabase
          .from("users")
          .select("user_id, username, full_name, avatar_url")
          .in("user_id", userIds);

        const usersMap = new Map<string, any>((usersData || []).map((u: any) => [String(u.user_id), u]));
        const enriched = rows.map((row) => {
          const u = usersMap.get(row.user_id);
          return { ...row, username: u ? (u.username || u.full_name || row.user_id) : row.user_id, avatar_url: u?.avatar_url ?? null };
        });
        setFeed(enriched);
      } else {
        setFeed(rows);
      }
    } catch (e) {
      console.error("[DonationFeed] snapshot fetch failed", e);
      setFeed([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!streamerId) return;
    fetchSnapshot();

    try {
      const channel = supabase.channel(`public:invoices:donations-${streamerId}`);
      // INSERT
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` },
        async (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          if (String(rec.status) !== "paid") return;
          const newItem: DonationItem = {
            id: String(rec.id),
            user_id: String(rec.user_id),
            amount: Number(rec.amount || 0),
            created_at: rec.created_at,
            type: rec.metadata?.tierId ?? rec.metadata?.kind ?? "unknown",
          };

          try {
            const { data: u } = await supabase.from("users").select("user_id, username, full_name, avatar_url").eq("user_id", newItem.user_id).maybeSingle();
            if (u) { newItem.username = u.username || u.full_name || newItem.user_id; newItem.avatar_url = u.avatar_url ?? null; } 
            else newItem.username = newItem.user_id;
          } catch { newItem.username = newItem.user_id; }

          setFeed((prev) => [newItem, ...prev].slice(0, limit));
          setHighlightId(newItem.id);
          window.setTimeout(() => setHighlightId(null), 4000);
        }
      );

      // UPDATE (transition to paid)
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` },
        async (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          if (String(rec.status) !== "paid") return;
          const newItem: DonationItem = {
            id: String(rec.id),
            user_id: String(rec.user_id),
            amount: Number(rec.amount || 0),
            created_at: rec.created_at,
            type: rec.metadata?.tierId ?? rec.metadata?.kind ?? "unknown",
          };

          try {
            const { data: u } = await supabase.from("users").select("user_id, username, full_name, avatar_url").eq("user_id", newItem.user_id).maybeSingle();
            if (u) { newItem.username = u.username || u.full_name || newItem.user_id; newItem.avatar_url = u.avatar_url ?? null; } 
            else newItem.username = newItem.user_id;
          } catch { newItem.username = newItem.user_id; }

          setFeed((prev) => {
            const without = prev.filter((p) => p.id !== newItem.id);
            return [newItem, ...without].slice(0, limit);
          });
          setHighlightId(newItem.id);
          window.setTimeout(() => setHighlightId(null), 4000);
        }
      );

      channel.subscribe();
      chanRef.current = channel;
    } catch (e) {
      console.warn("[DonationFeed] realtime setup failed", e);
    }

    return () => {
      try {
        if (chanRef.current && typeof chanRef.current.unsubscribe === "function") chanRef.current.unsubscribe();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamerId]);

  return (
    <div className="p-3 bg-card rounded-md border border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Live donations & purchases</h4>
        <div className="text-xs text-muted-foreground">Поток в реальном времени</div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />)}
        </div>
      ) : (
        <>
          {feed.length === 0 ? (
            <div className="text-sm text-muted-foreground">Пока что нет платных донатов.</div>
          ) : (
            <ul className="space-y-2">
              {feed.map((d) => {
                const meta = TYPE_META[d.type ?? "unknown"] ?? TYPE_META.unknown;
                const isNew = highlightId === d.id;
                return (
                  <li key={d.id} className={`p-2 rounded-md border border-border flex items-center gap-3 ${isNew ? meta.className : ""}`}>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm">
                      {d.avatar_url ? <Image src={d.avatar_url} alt={d.username || d.user_id} width={40} height={40} /> : <span>{(d.username && d.username[0]) || "?"}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate">{d.username}</div>
                        <div className="text-xs text-muted-foreground">{meta.badge} <span className="ml-1 text-muted-foreground">{meta.label}</span></div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{d.created_at ? new Date(d.created_at).toLocaleString() : ""}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">{d.amount}★</div>
                      <div className="text-xs text-muted-foreground">{d.type || "donation"}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}