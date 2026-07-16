"use client";

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
    <div className="mt-3 mb-4 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--franchize-text-secondary, #6b7280)", opacity: 0.7 }}>
        <BarChart3 className="w-3.5 h-3.5" />
        <span>Аналитика:</span>
      </div>
      {ANALYTICS_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.label}
            href={link.href(slug)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all hover:scale-105 hover:shadow-sm"
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
          </a>
        );
      })}
    </div>
  );
}
