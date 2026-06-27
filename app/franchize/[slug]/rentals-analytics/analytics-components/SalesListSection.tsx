"use client";

import { Tag, Mail, User, Bike } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDate } from "../analytics-utils";

interface SaleItem {
  id: string;
  created_at: string;
  buyer_full_name: string | null;
  buyer_email: string | null;
  sale_price: number | null;
  warranty_months: number | null;
  vehicle: { make: string | null; model: string | null } | null;
}

interface SalesListSectionProps {
  sales: SaleItem[];
  textPrimary: string;
  textSecondary: string;
  accentMain: string;
  bgCard: string;
  borderSoft: string;
}

export function SalesListSection({ sales, textPrimary, textSecondary, accentMain, bgCard, borderSoft }: SalesListSectionProps) {
  if (sales.length === 0) return null;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha("#10b981", 0.08), borderColor: withAlpha("#10b981", 0.3) }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.2), background: `linear-gradient(to right, ${withAlpha("#10b981", 0.1)}, transparent)` }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#10b981", 0.15) }}>
            <Tag className="w-5 h-5" style={{ color: "#10b981" }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: textPrimary }}>Продажи</h3>
            <p className="text-xs" style={{ color: textSecondary }}>{sales.length} {sales.length === 1 ? "продажа" : sales.length < 5 ? "продажи" : "продаж"}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ color: "#10b981" }}>{formatRubles(sales.reduce((s, x) => s + (x.sale_price || 0), 0))}</div>
          <div className="text-xs" style={{ color: textSecondary }}>Выручка</div>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
        {sales.map((sale) => (
          <div key={sale.id} className="p-4 md:p-5 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><span className="text-sm font-semibold" style={{ color: textPrimary }}>{sale.buyer_full_name || "Без имени"}</span></div>
                {sale.buyer_email && (<div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={`mailto:${sale.buyer_email}`} className="text-xs hover:underline" style={{ color: accentMain }}>{sale.buyer_email}</a></div>)}
                <div className="flex items-center gap-2"><Bike className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><span className="text-xs" style={{ color: textSecondary }}>{sale.vehicle ? `${sale.vehicle.make || ""} ${sale.vehicle.model || ""}`.trim() : "Техника не определена"}</span></div>
              </div>
              <div className="flex flex-col md:items-end gap-1">
                <div className="text-lg font-black" style={{ color: "#10b981" }}>{formatRubles(sale.sale_price)}</div>
                {sale.warranty_months && (<div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>Гарантия: {sale.warranty_months} мес.</div>)}
                <div className="text-[10px]" style={{ color: textSecondary }}>{formatRussianDate(sale.created_at)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
