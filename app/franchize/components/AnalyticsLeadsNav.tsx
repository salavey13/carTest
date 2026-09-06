"use client";

import Link from "next/link";
import { BarChart3, Calendar, Tag, FileText } from "lucide-react";

interface AnalyticsLeadsNavProps {
  slug: string;
}

const ANALYTICS_LINKS = [
  { label: "Аналитика аренд", icon: Calendar, href: (slug: string) => `/franchize/${slug}/rentals-analytics`, color: "#3b82f6" },
  { label: "Продажи", icon: Tag, href: (slug: string) => `/franchize/${slug}/sales-analytics`, color: "#10b981" },
  { label: "Коммерческие предложения", icon: FileText, href: (slug: string) => `/franchize/${slug}/commercial-offers-analytics`, color: "#8b5cf6" },
];

export function AnalyticsLeadsNav({ slug }: AnalyticsLeadsNavProps) {
  return (
    // MOBILE: одна снап-строка вместо flex-wrap (метка + 3 чипа раньше
    // переносились на 2 строки); тап-цель чипов ≥36px, край экрана —
    // без отступа (полоса выходит за поля страницы и подрезается).
    <div
      className="mt-3 mb-4 -mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--franchize-text-secondary, #6b7280)", opacity: 0.7 }}>
        <BarChart3 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Аналитика:</span>
      </div>
      {ANALYTICS_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.label}
            href={link.href(slug)}
            className="inline-flex shrink-0 snap-start items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all hover:scale-105 hover:shadow-sm"
            style={{
              backgroundColor: `color-mix(in srgb, ${link.color} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${link.color} 30%, transparent)`,
              color: link.color,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${link.color} 25%, transparent)`;
              e.currentTarget.style.borderColor = link.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${link.color} 12%, transparent)`;
              e.currentTarget.style.borderColor = `color-mix(in srgb, ${link.color} 30%, transparent)`;
            }}
          >
            <Icon className="w-3 h-3" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
