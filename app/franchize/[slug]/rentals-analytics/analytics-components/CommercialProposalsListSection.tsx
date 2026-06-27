"use client";

import { FileText, Phone, Mail, QrCode, User } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRubles, formatRussianDate } from "../analytics-utils";

const OFFER_TYPE_LABELS: Record<string, string> = {
  rent: "Аренда", sale: "Продажа", service: "Сервис", lease: "Лизинг", unknown: "Другое",
};

interface ProposalItem {
  id: string;
  created_at: string;
  client_name: string;
  client_inn: string | null;
  client_phone: string | null;
  client_email: string | null;
  offer_type: string;
  offer_summary: string | null;
  total_price: number | null;
  validity_days: number;
  qr_included: boolean;
}

interface CommercialProposalsListSectionProps {
  proposals: ProposalItem[];
  textPrimary: string;
  textSecondary: string;
  bgCard: string;
  borderSoft: string;
}

export function CommercialProposalsListSection({ proposals, textPrimary, textSecondary, bgCard, borderSoft }: CommercialProposalsListSectionProps) {
  if (proposals.length === 0) return null;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha("#8b5cf6", 0.08), borderColor: withAlpha("#8b5cf6", 0.3) }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.2), background: `linear-gradient(to right, ${withAlpha("#8b5cf6", 0.1)}, transparent)` }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#8b5cf6", 0.15) }}>
            <FileText className="w-5 h-5" style={{ color: "#8b5cf6" }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: textPrimary }}>Коммерческие предложения</h3>
            <p className="text-xs" style={{ color: textSecondary }}>{proposals.length} КП</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ color: "#8b5cf6" }}>{formatRubles(proposals.reduce((s, p) => s + (p.total_price || 0), 0))}</div>
          <div className="text-xs" style={{ color: textSecondary }}>Сумма</div>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
        {proposals.map((p) => (
          <div key={p.id} className="p-4 md:p-5 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} />
                  <span className="text-sm font-semibold" style={{ color: textPrimary }}>{p.client_name}</span>
                  {p.client_inn && (<span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha(borderSoft, 0.4), color: textSecondary }}>ИНН {p.client_inn}</span>)}
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ backgroundColor: withAlpha("#8b5cf6", 0.15), color: "#8b5cf6" }}>{OFFER_TYPE_LABELS[p.offer_type] || p.offer_type}</span>
                  {p.qr_included && (<span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: withAlpha("#10b981", 0.15), color: "#10b981" }}><QrCode className="w-3 h-3" /> QR</span>)}
                </div>
                {p.client_phone && (<div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={`tel:${p.client_phone}`} className="text-xs hover:underline" style={{ color: "#8b5cf6" }}>{p.client_phone}</a></div>)}
                {p.client_email && (<div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSecondary }} /><a href={`mailto:${p.client_email}`} className="text-xs hover:underline" style={{ color: "#8b5cf6" }}>{p.client_email}</a></div>)}
                {p.offer_summary && (<p className="text-xs mt-1 line-clamp-2" style={{ color: textSecondary }}>{p.offer_summary}</p>)}
              </div>
              <div className="flex flex-col md:items-end gap-1">
                <div className="text-lg font-black" style={{ color: "#8b5cf6" }}>{formatRubles(p.total_price)}</div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: textSecondary }}>Срок: {p.validity_days} дн.</div>
                <div className="text-[10px]" style={{ color: textSecondary }}>{formatRussianDate(p.created_at)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
