"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";

export default function Leaderboard({ streamerId }: { streamerId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamerId) return;
    setLoading(true);
    fetch(`/api/streamer/leaderboard?streamerId=${encodeURIComponent(streamerId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setRows(j.data);
        } else {
          setRows([]);
        }
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [streamerId]);

  return (
    <div className="p-3 bg-card rounded-md border border-border">
      <h4 className="font-semibold mb-2">Топ поддержавших</h4>
      {loading ? <div className="text-sm text-muted-foreground">Загрузка...</div> : (
        <ol className="list-decimal list-inside space-y-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">Пока что нет донатов</div>}
          {rows.map((r, idx) => (
            <li key={r.user_id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                {r.avatar_url ? <Image src={r.avatar_url} alt={r.username} width={32} height={32} /> : <div className="flex items-center justify-center text-xs">{r.username?.[0] ?? "?"}</div>}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{r.username}</div>
                <div className="text-xs text-muted-foreground">{r.user_id}</div>
              </div>
              <div className="font-semibold">{r.total}★</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}