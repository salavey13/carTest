"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

export interface InfoTile {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warning" | "danger" | "good";
  copyable?: boolean;
}

interface Props {
  items: InfoTile[];
  T: ThemeTokens;
}

const TONE_COLORS: Record<NonNullable<InfoTile["tone"]>, string> = {
  accent: "#facc15",
  warning: "#f59e0b",
  danger: "#ef4444",
  good: "#22c55e",
  default: "",
};

/**
 * 2-column grid of info tiles.
 * Each tile: uppercase label + large value. Copyable fields show a copy icon.
 */
export function LeadInfoGrid({ items, T }: Props) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <Tile key={`${item.label}-${i}`} item={item} T={T} />
      ))}
    </section>
  );
}

function Tile({ item, T }: { item: InfoTile; T: ThemeTokens }) {
  const [copied, setCopied] = useState(false);
  const toneColor = item.tone ? TONE_COLORS[item.tone] : "";
  const valueColor = toneColor || T.text;

  const handleCopy = async () => {
    if (!item.copyable) return;
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: T.textFaint }}
        >
          {item.label}
        </div>
        {item.copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1 transition hover:bg-white/10"
            aria-label={`Скопировать ${item.label}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
            ) : (
              <Copy className="h-3.5 w-3.5" style={{ color: T.textFaint }} />
            )}
          </button>
        )}
      </div>
      <div
        className="mt-2 truncate text-base font-medium"
        style={{ color: valueColor }}
        title={item.value}
      >
        {item.value}
      </div>
    </div>
  );
}
