"use client";

import { Car, DollarSign, FileText, TrendingUp, QrCode, Calendar, Users } from "lucide-react";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDateOnly } from "@/app/franchize/[slug]/leads/leads-utils";

interface AnalyticsCrossNavProps {
  slug: string;
  currentView: "rentals" | "sales" | "proposals" | "handoff" | "calendar" | "leads";
  activeDate?: string;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
  textPrimary: string;
  textSecondary: string;
}

const NAV_ITEMS = [
  { id: "rentals", label: "Аренды", icon: Car, color: "#3b82f6", href: (slug: string) => `/franchize/${slug}/rentals-analytics` },
  { id: "sales", label: "Продажи", icon: DollarSign, color: "#10b981", href: (slug: string) => `/franchize/${slug}/sales-analytics` },
  { id: "proposals", label: "КП", icon: FileText, color: "#8b5cf6", href: (slug: string) => `/franchize/${slug}/commercial-offers-analytics` },
  { id: "handoff", label: "Выдача/Возврат", icon: QrCode, color: "#f59e0b", href: (slug: string) => `/franchize/${slug}/rentals-analytics?tab=handoff` },
  { id: "calendar", label: "Календарь", icon: Calendar, color: "#ec4899", href: (slug: string) => `/franchize/${slug}/rentals-analytics?tab=calendar` },
  { id: "leads", label: "Клиенты", icon: Users, color: "#f97316", href: (slug: string) => `/franchize/${slug}/leads` },
] as const;

export function AnalyticsCrossNav({
  slug,
  currentView,
  activeDate,
  accentMain,
  bgCard,
  borderSoft,
  textPrimary,
  textSecondary,
}: AnalyticsCrossNavProps) {
  const theme = useFranchizeTheme({});

  return (
    <nav className="mb-4 md:mb-6" style={{ backgroundColor: bgCard, borderColor: borderSoft }}>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1 min-w-max px-2" style={{ backgroundColor: bgCard, borderColor: borderSoft }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { window.location.href = `${item.href(slug)}${activeDate ? `?date=${activeDate}` : ""}`; }}
                className={`flex flex-col items-center gap-1 px-3 md:px-4 py-2 md:py-3 rounded-xl md:rounded-2xl transition-all min-w-[72px] relative ${
                  isActive ? "shadow-md" : ""
                }`}
                style={{
                  backgroundColor: isActive ? withAlpha(item.color, 0.15) : "transparent",
                  border: isActive ? `1px solid ${withAlpha(item.color, 0.3)}` : `1px solid ${borderSoft}`,
                  color: isActive ? item.color : textSecondary,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: isActive ? item.color : textSecondary }} />
                <span className="text-xs md:text-sm font-medium whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}