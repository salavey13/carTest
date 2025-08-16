"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

type DonationItem = {
  id: string;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
  amount: number;
  created_at?: string | null;
};

export default function DonationFeed({ streamerId, limit = 8 }: { streamerId: string; limit?: number }) {
  const [feed, setFeed] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const supabaseRef = useRef<any>(null);
  const supabase = getSupabaseBrowserClient();

  async function fetchSnapshot() {
    if (!streamerId) return;
    setLoading(true);
    setError(null);
    try {
      // Try client-side read (may be blocked by RLS). This is best-effort.
      const { data, error } = await supabase
        .from("invoices")
        .select("id, user_id, amount, created_at")
        .eq("subscription_id", streamerId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[DonationFeed] supabase snapshot error (client):", error);
        setFeed([]);
        setError(null);
        return;
      }

      const rows = (data || []).map((r: any) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        username: undefined,
        avatar_url: null,
        amount: Number(r.amount || 0),
        created_at: r.created_at,
      })) as DonationItem[];

      // attempt to bulk fetch usernames for these user_ids (best-effort)
      const userIds = Array.from(new Set(rows.map((r) => r.user_id))).slice(0, 10);
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("user_id, username, full_name, avatar_url")
          .in("user_id", userIds);

        const usersMap = new Map<string, any>((usersData || []).map((u: any) => [String(u.user_id), u]));
        const enriched = rows.map((row) => {
          const u = usersMap.get(row.user_id);
          return {
            ...row,
            username: u ? (u.username || u.full_name || row.user_id) : row.user_id,
            avatar_url: u ? u.avatar_url ?? null : null,
          };
        });
        setFeed(enriched);
      } else {
        setFeed(rows);
      }
    } catch (e: any) {
      console.error("[DonationFeed] snapshot fetch failed", e);
      setError("Не удалось загрузить ленту донатов");
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
      // listen for INSERT paid
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invoices", filter: `subscription_id=eq.${streamerId}` },
        async (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          if (String(rec.status) !== "paid") return; // only paid donations
          const newItem: DonationItem = {
            id: String(rec.id),
            user_id: String(rec.user_id),
            amount: Number(rec.amount || 0),
            created_at: rec.created_at,
          };

          // try to fetch user meta
          try {
            const { data: u } = await supabase
              .from("users")
              .select("user_id, username, full_name, avatar_url")
              .eq("user_id", newItem.user_id)
              .maybeSingle();
            if (u) {
              newItem.username = u.username || u.full_name || newItem.user_id;
              newItem.avatar_url = u.avatar_url ?? null;
            } else {
              newItem.username = newItem.user_id;
            }
          } catch {
            newItem.username = newItem.user_id;
          }

          setFeed((prev) => {
            const next = [newItem, ...prev].slice(0, limit);
            return next;
          });
          setHighlightId(newItem.id);
          window.setTimeout(() => setHighlightId(null), 3500);
        }
      );

      // also listen for UPDATE -> paid (invoice transitions)
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
          };
          try {
            const { data: u } = await supabase
              .from("users")
              .select("user_id, username, full_name, avatar_url")
              .eq("user_id", newItem.user_id)
              .maybeSingle();
            if (u) {
              newItem.username = u.username || u.full_name || newItem.user_id;
              newItem.avatar_url = u.avatar_url ?? null;
            } else {
              newItem.username = newItem.user_id;
            }
          } catch {
            newItem.username = newItem.user_id;
          }

          setFeed((prev) => {
            // add/update item and keep sorted by created_at desc (new at top)
            const without = prev.filter((p) => p.id !== newItem.id);
            const next = [newItem, ...without].slice(0, limit);
            return next;
          });
          setHighlightId(newItem.id);
          window.setTimeout(() => setHighlightId(null), 3500);
        }
      );

      channel.subscribe();
      supabaseRef.current = channel;
    } catch (e) {
      console.warn("[DonationFeed] realtime setup failed", e);
    }

    return () => {
      try {
        if (supabaseRef.current) {
          if (typeof supabaseRef.current.unsubscribe === "function") supabaseRef.current.unsubscribe();
          else if (typeof (supabase as any).removeChannel === "function") (supabase as any).removeChannel(supabaseRef.current);
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamerId]);

  return (
    <div className="p-3 bg-card rounded-md border border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Live donations</h4>
        <div className="flex gap-2 items-center">
          <Button size="sm" onClick={fetchSnapshot} disabled={loading}>Обновить</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-live="polite">
          {[1,2,3].map((i) => <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />)}
        </div>
      ) : (
        <>
          {feed.length === 0 ? (
            <div className="text-sm text-muted-foreground">Пока что нет платных донатов.</div>
          ) : (
            <ul className="space-y-2">
              {feed.map((d) => {
                const isNew = highlightId === d.id;
                return (
                  <li key={d.id} className={`flex items-center gap-3 transition-shadow duration-300 ${isNew ? "shadow-yellow-glow border border-primary/30 rounded-md p-2" : ""}`}>
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs">
                      {d.avatar_url ? <Image src={d.avatar_url} width={36} height={36} alt={d.username || d.user_id} /> : <span>{(d.username && d.username[0]) || "?"}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.username ?? d.user_id}</div>
                      <div className="text-xs text-muted-foreground truncate">{d.created_at ? new Date(d.created_at).toLocaleString() : ""}</div>
                    </div>
                    <div className="font-semibold">{d.amount}★</div>
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