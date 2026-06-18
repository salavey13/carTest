"use client";

import { useState } from "react";

const LOADER_GIF_URL =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif";

const FILTER_VARIANTS = [
  { id: "invert", name: "Just Invert", filter: "invert(1)" },
  { id: "gold-1", name: "Gold Attempt 1", filter: "invert(1) sepia(1) saturate(2) hue-rotate(5deg)" },
  { id: "gold-2", name: "Gold Attempt 2", filter: "invert(1) sepia(1) saturate(3) contrast(4.2) brightness(0.5)" },
  { id: "gold-3", name: "Gold Attempt 3", filter: "invert(1) sepia(0.7) saturate(2.5) hue-rotate(-15deg) contrast(1.5)" },
  { id: "gold-4", name: "Gold Attempt 4", filter: "invert(1) grayscale(0.5) sepia(0.8) saturate(3) contrast(2)" },
];

export default function LoadingTestPage() {
  const [selectedFilter, setSelectedFilter] = useState(FILTER_VARIANTS[0]);

  return (
    <main className="min-h-screen bg-black">
      {/* Controls */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-wrap gap-2 bg-black/80 backdrop-blur-sm p-4 rounded-xl border border-white/10">
        {FILTER_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => setSelectedFilter(variant)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition ${
              selectedFilter.id === variant.id
                ? "bg-[#D4AF37] text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {variant.name}
          </button>
        ))}
      </div>

      {/* Loading Component */}
      <div className="min-h-screen flex items-center justify-center overflow-hidden px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Simple radial glow */}
          <div
            className="rounded-full"
            style={{
              width: "200px",
              height: "200px",
              background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 40%, transparent 70%)",
            }}
          />
          <img
            src={LOADER_GIF_URL}
            alt="Загрузка..."
            className="absolute h-28 w-28 object-contain [image-rendering:auto]"
            style={{ filter: selectedFilter.filter }}
          />
          <p className="text-sm font-semibold tracking-[0.22em] text-[#D4AF37] mt-64">
            ЗАГРУЖАЕМ БАЙКИ
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-black/80 backdrop-blur-sm p-3 rounded-lg border border-white/10 text-center">
        <p className="text-xs text-white/60">
          Active filter: <code className="text-[#D4AF37]">{selectedFilter.filter}</code>
        </p>
      </div>
    </main>
  );
}
