"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";

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

// Semantic tone colors — fixed hexes for severity indicators.
const TONE_COLORS: Record<NonNullable<InfoTile["tone"]>, string> = {
  accent: "#eab308",
  warning: "#f59e0b",
  danger: "#ef4444",
  good: "#22c55e",
  default: "",
};

/**
 * Responsive grid of info tiles.
 *
 * Mobile: 1 column. Desktop (sm+): 2 columns.
 *
 * Each tile:
 *   - Uppercase, tiny, muted label (text-[10px] tracking-wider).
 *   - Medium-weight value (not bold) — bold would compete with section headers.
 *   - Consistent height thanks to `h-full` + flex column layout.
 *   - Copyable fields show a subtle Copy icon that becomes visible on hover
 *     (or tap on mobile). Turns into a green Check for 1.5s after copy.
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
    <div
      className="glass-panel flex h-full min-h-[64px] flex-col justify-between rounded-2xl p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
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
            className="cursor-pointer rounded-md p-1 transition"
            style={{ color: copied ? "#22c55e" : T.textFaint }}
            aria-label={`Скопировать ${item.label}`}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.color = T.text;
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.color = T.textFaint;
            }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      <div
        className="mt-1.5 truncate text-sm font-medium sm:text-base"
        style={{ color: valueColor }}
        title={item.value}
      >
        {item.value}
      </div>
    </div>
  );
}
