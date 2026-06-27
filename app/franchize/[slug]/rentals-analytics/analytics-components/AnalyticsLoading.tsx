"use client";

import { withAlpha } from "@/app/franchize/lib/theme";

interface AnalyticsLoadingProps {
  accentMain: string;
  bgBase: string;
}

export function AnalyticsLoading({ accentMain, bgBase }: AnalyticsLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgBase }}>
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-xl animate-pulse"
          style={{ backgroundColor: withAlpha(accentMain, 0.2) }}
        />
        <div className="relative w-12 h-12 md:w-16 md:h-16">
          <div className="absolute inset-0 rounded-full border-3 md:border-4" style={{ borderColor: withAlpha(accentMain, 0.15) }} />
          <div
            className="absolute inset-0 rounded-full border-3 md:border-4 border-t-transparent animate-spin"
            style={{ borderColor: accentMain, borderTopColor: "transparent" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentMain }}
          />
        </div>
      </div>
    </div>
  );
}
