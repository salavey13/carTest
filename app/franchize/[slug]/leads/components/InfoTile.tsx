"use client";

import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface InfoTileProps {
  label: string;
  value: string;
  T: ThemeTokens;
  fullWidth?: boolean;
}

export function InfoTile({ label, value, T, fullWidth }: InfoTileProps) {
  return (
    <div
      className={`min-h-[44px] rounded-xl border p-2.5 ${fullWidth ? "col-span-full" : ""}`}
      style={{ borderColor: T.border, backgroundColor: T.bgElevated }}
    >
      <p
        className="text-[10px] uppercase tracking-wider"
        style={{ color: T.textFaint }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 break-words text-xs font-semibold"
        style={{ color: T.text }}
      >
        {value}
      </p>
    </div>
  );
}
