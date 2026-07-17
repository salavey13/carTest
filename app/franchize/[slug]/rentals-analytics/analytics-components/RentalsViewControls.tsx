"use client";

import { Eye, CheckCircle2, Clock, List, Calendar } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";

interface RentalsViewControlsProps {
  verificationFilter: "all" | "verified" | "pending" | "revoked";
  onVerificationFilterChange: (filter: "all" | "verified" | "pending" | "revoked") => void;
  analyticsView: "table" | "calendar";
  onAnalyticsViewChange: (view: "table" | "calendar") => void;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

export function RentalsViewControls({
  verificationFilter,
  onVerificationFilterChange,
  analyticsView,
  onAnalyticsViewChange,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: RentalsViewControlsProps) {
  const FILTERS = [
    { value: "all" as const, label: "Все", icon: Eye },
    { value: "verified" as const, label: "Проверены", icon: CheckCircle2 },
    { value: "pending" as const, label: "Ожидают", icon: Clock },
  ];

  return (
    <>
      {/* FILTER BAR */}
      <div className="flex items-center gap-2 md:gap-3 overflow-x-visible pb-2 px-1 flex-wrap">
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap" style={{ color: textSecondary, opacity: 0.7 }}>Фильтр:</span>
        {FILTERS.map((filter) => {
          const Icon = filter.icon;
          const isActive = verificationFilter === filter.value;
          return (
            <button
              key={filter.value}
              onClick={() => onVerificationFilterChange(isActive ? "all" : filter.value)}
              className="relative px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap group"
              style={
                isActive
                  ? {
                      background: `linear-gradient(135deg, ${withAlpha(accentMain, 0.2)}, ${withAlpha(accentMain, 0.1)})`,
                      borderColor: withAlpha(accentMain, 0.4),
                      color: accentMain,
                      borderWidth: "1.5px",
                      boxShadow: `0 0 20px ${withAlpha(accentMain, 0.15)}`
                    }
                  : {
                      backgroundColor: withAlpha(bgCard, 0.5),
                      borderColor: borderSoft,
                      color: textSecondary,
                      borderWidth: "1px"
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = withAlpha(borderSoft, 1);
                  e.currentTarget.style.color = textPrimary;
                  e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.7);
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = borderSoft;
                  e.currentTarget.style.color = textSecondary;
                  e.currentTarget.style.backgroundColor = withAlpha(bgCard, 0.5);
                }
              }}
            >
              {/* Active glow effect */}
              {isActive && (
                <div className="absolute inset-0 rounded-lg md:rounded-xl blur-md animate-pulse" style={{ backgroundColor: withAlpha(accentMain, 0.2) }} />
              )}
              <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 relative z-10" />
              <span className="relative z-10">{filter.label}</span>
            </button>
          );
        })}
      </div>

      {/* View toggle buttons */}
      <div className="px-4 md:px-5 pt-2.5 md:pt-3 flex items-center gap-2">
        <button
          onClick={() => onAnalyticsViewChange("table")}
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 md:gap-2 ${
            analyticsView === "table" ? "opacity-100" : "opacity-60"
          }`}
          style={{
            backgroundColor: analyticsView === "table" ? withAlpha(accentMain, 0.2) : "transparent",
            borderColor: analyticsView === "table" ? withAlpha(accentMain, 0.3) : borderSoft,
            borderWidth: "1px",
            color: analyticsView === "table" ? accentMain : textSecondary,
          }}
        >
          <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Таблица</span>
        </button>
        <button
          onClick={() => onAnalyticsViewChange("calendar")}
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 md:gap-2 ${
            analyticsView === "calendar" ? "opacity-100" : "opacity-60"
          }`}
          style={{
            backgroundColor: analyticsView === "calendar" ? withAlpha(accentMain, 0.2) : "transparent",
            borderColor: analyticsView === "calendar" ? withAlpha(accentMain, 0.3) : borderSoft,
            borderWidth: "1px",
            color: analyticsView === "calendar" ? accentMain : textSecondary,
          }}
        >
          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">Календарь</span>
        </button>
      </div>
    </>
  );
}
