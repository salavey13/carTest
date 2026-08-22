"use client";

import { RefreshCw, CheckCircle2 } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistPanelProps {
  type: "handout" | "return";
  items: ChecklistItem[] | undefined;
  updatingItemId: string | null;
  onToggle: (type: "handout" | "return", itemId: string) => void;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

const CONFIG = {
  handout: { label: "ВЫДАЧА", arrow: "→", color: "#10b981", dimColor: "#34d399" },
  return: { label: "ВОЗВРАТ", arrow: "←", color: "#3b82f6", dimColor: "#60a5fa" },
} as const;

export function ChecklistPanel({
  type,
  items,
  updatingItemId,
  onToggle,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: ChecklistPanelProps) {
  const cfg = CONFIG[type];

  return (
    <div
      className="rounded-xl md:rounded-2xl border overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: withAlpha(bgCard, 0.4),
        borderColor: withAlpha(borderSoft, 0.5),
        backdropFilter: "blur(12px)",
        borderWidth: "1px",
      }}
    >
      <div
        className="px-4 md:px-5 py-2.5 md:py-3 border-b flex items-center justify-between"
        style={{
          borderColor: withAlpha(borderSoft, 0.3),
          background: `linear-gradient(to right, ${withAlpha(cfg.color, 0.05)}, transparent)`,
        }}
      >
        <div className="flex items-center gap-1.5 md:gap-2">
          <div
            className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shadow-lg animate-pulse"
            style={{ backgroundColor: cfg.color, boxShadow: `0 0 10px ${withAlpha(cfg.color, 0.5)}` }}
          />
          <span className="text-xs md:text-sm font-black tracking-tight" style={{ color: textPrimary }}>
            {cfg.label}
          </span>
          <span className="text-sm md:text-base" style={{ color: textSecondary, opacity: 0.7 }}>
            {cfg.arrow}
          </span>
        </div>
        <span
          className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: withAlpha(cfg.color, 0.15),
            color: cfg.dimColor,
            border: "1px solid",
            borderColor: withAlpha(cfg.color, 0.3),
          }}
        >
          {items?.filter((i) => i.checked).length || 0} / {items?.length || 0}
        </span>
      </div>

      <div className="p-3 md:p-4 flex flex-wrap gap-1.5 md:gap-2">
        {items?.map((item) => {
          const isUpdating = updatingItemId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => void onToggle(type, item.id)}
              disabled={isUpdating}
              className="relative px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap overflow-hidden group"
              style={
                isUpdating
                  ? { backgroundColor: withAlpha(cfg.color, 0.1), borderColor: withAlpha(cfg.color, 0.3), color: cfg.dimColor, borderWidth: "1.5px" }
                  : item.checked
                  ? {
                      background: `linear-gradient(135deg, ${withAlpha(cfg.color, 0.25)}, ${withAlpha(cfg.color, 0.15)})`,
                      borderColor: withAlpha(cfg.color, 0.4),
                      color: cfg.dimColor,
                      borderWidth: "1.5px",
                      boxShadow: `0 2px 8px ${withAlpha(cfg.color, 0.2)}`,
                    }
                  : {
                      backgroundColor: withAlpha(bgCard, 0.6),
                      borderColor: borderSoft,
                      color: textSecondary,
                      borderWidth: "1px",
                    }
              }
              onMouseEnter={(e) => {
                if (!item.checked && !isUpdating) {
                  e.currentTarget.style.borderColor = withAlpha(borderSoft, 1);
                  e.currentTarget.style.color = textPrimary;
                  e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.8);
                }
              }}
              onMouseLeave={(e) => {
                if (!item.checked && !isUpdating) {
                  e.currentTarget.style.borderColor = borderSoft;
                  e.currentTarget.style.color = textSecondary;
                  e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.6);
                }
              }}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-2.5 h-2.5 md:w-3 md:h-3 inline animate-spin mr-0.5 md:mr-1" />
                  {item.text}
                </>
              ) : (
                <>
                  {item.checked && <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 inline mr-0.5 md:mr-1" />}
                  {item.text}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
