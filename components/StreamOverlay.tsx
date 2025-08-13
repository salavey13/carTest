"use client";
import React from "react";

export default function StreamOverlay({ events }: { events: Array<{type:'donation'|'sponsor', payload:any}> }) {
  // events: stream of recent events (from socket)
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-4 right-4 space-y-2">
        {/* top donors */}
        <div className="backdrop-blur-sm bg-black/30 px-3 py-2 rounded text-white text-sm pointer-events-auto">
          Топ доноры: Иван — 1500⭐
        </div>
        {/* sponsor card */}
        <div className="backdrop-blur-sm bg-white/90 px-3 py-2 rounded shadow pointer-events-auto">
          <div className="text-xs">Партнёр трансляции</div>
          <div className="font-semibold">BrandName — Скидка 15% по коду STREAM15</div>
        </div>
      </div>

      {/* animated donation popups (пример) */}
      <div className="absolute bottom-24 left-6">
        {events.map((e, i) => e.type === "donation" ? (
          <div key={i} className="mb-2 animate-fade-in-up bg-yellow-300 px-4 py-2 rounded shadow">⭐ {e.payload.stars} — {e.payload.name}</div>
        ) : null)}
      </div>
    </div>
  );
}