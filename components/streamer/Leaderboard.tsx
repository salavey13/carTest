"use client";
import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Leaderboard({ streamerId }: { streamerId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  async function fetchBoard() {
    if (!streamerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/streamer/leaderboard?streamerId=${encodeURIComponent(streamerId)}`);
      const j = await res.json();
      if (j?.success && Array.isArray(j.data)) {
        setRows(j.data);
        setLastUpdated(Date.now());
      } else {
        setRows([]);
      }
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBoard();
    // Poll every 30s
    pollingRef.current = window.setInterval(() => {
      fetchBoard();
    }, 30000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [streamerId]);

  return (
    <div className="p-3 bg-card rounded-md border border-border" aria-live="polite">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold mb-2">Топ поддержавших</h4>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={fetchBoard} disabled={loading}>Обновить</Button>
          <div className="text-xs text-muted-foreground">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : ""}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i)=> (
            <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <ol className="list-decimal list-inside space-y-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">Пока что нет донатов</div>}
          {rows.map((r, idx) => (
            <li key={r.user_id} className="flex items-center gap-3">
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
          ))}
        </ol>
      )}
    </div>
  );
}