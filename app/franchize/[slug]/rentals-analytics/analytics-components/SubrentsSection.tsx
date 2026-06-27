"use client";

import { RefreshCw, AlertCircle, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { withAlpha } from "@/app/franchize/lib/theme";
import { formatRussianDate } from "../analytics-utils";

interface SubrentApplication {
  id: string;
  created_at: string;
  owner_full_name: string;
  owner_phone: string;
  bike_make: string;
  bike_model: string;
  owner_percentage: number;
  min_daily_price_rub: number;
  contract_start_date: string;
  contract_end_date: string;
}

interface SubrentContract {
  id: string;
  created_at: string;
  owner_full_name: string | null;
  owner_phone: string | null;
  bike_make: string;
  bike_model: string;
  owner_percentage: number;
  contract_start_date: string;
  contract_end_date: string;
}

interface SubrentsSectionProps {
  pendingApplications: SubrentApplication[];
  processingApplication: string | null;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
  subrents: SubrentContract[];
  subrentsSummary: { activeCount?: number } | null;
  textPrimary: string;
  textSecondary: string;
  bgCard: string;
  borderSoft: string;
}

export function SubrentsSection({
  pendingApplications, processingApplication, onApprove, onDecline,
  subrents, subrentsSummary, textPrimary, textSecondary, bgCard, borderSoft,
}: SubrentsSectionProps) {
  const hasApps = pendingApplications.length > 0;
  const hasContracts = subrents.length > 0;
  if (!hasApps && !hasContracts) return null;

  return (
    <div className="space-y-4">
      {hasApps && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha("#f59e0b", 0.08), borderColor: withAlpha("#f59e0b", 0.4), borderWidth: "2px" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.2), background: `linear-gradient(to right, ${withAlpha("#f59e0b", 0.1)}, transparent)` }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg relative" style={{ backgroundColor: withAlpha("#f59e0b", 0.2) }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#f59e0b" }} />
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: "#f59e0b" }} />
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: textPrimary }}>Заявки на субаренду</h3>
                <p className="text-xs" style={{ color: textSecondary }}>{pendingApplications.length} {pendingApplications.length === 1 ? "заявка ожидает рассмотрения" : "заявки ожидают рассмотрения"}</p>
              </div>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
            {pendingApplications.map((app) => (
              <div key={app.id} className="p-4 md:p-5 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: withAlpha("#f59e0b", 0.2), color: "#f59e0b" }}>НОВАЯ</span>
                      <span className="text-xs" style={{ color: textSecondary }}>{formatRussianDate(app.created_at)}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>{app.owner_full_name}</p>
                        <p className="text-xs" style={{ color: textSecondary }}>{app.owner_phone}</p>
                      </div>
                      <div className="hidden md:block w-px h-8" style={{ backgroundColor: borderSoft }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: textPrimary }}>{app.bike_make} {app.bike_model}</p>
                        <p className="text-xs" style={{ color: textSecondary }}>Процент: {app.owner_percentage}% &bull; Мин. цена: {app.min_daily_price_rub} &#8381;</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: textSecondary }}>
                      <span>&#128197; {app.contract_start_date} — {app.contract_end_date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onDecline(app.id)} disabled={processingApplication === app.id} className="relative px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden" style={{ backgroundColor: processingApplication === app.id ? withAlpha("#f87171", 0.25) : withAlpha("#f87171", 0.15), borderColor: withAlpha("#f87171", 0.4), color: "#f87171", border: "1.5px solid" }}>
                      {processingApplication === app.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span className="ml-1.5 hidden sm:inline">Отклонить</span>
                    </button>
                    <button onClick={() => onApprove(app.id)} disabled={processingApplication === app.id} className="relative px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden" style={{ backgroundColor: processingApplication === app.id ? withAlpha("#10b981", 0.25) : `linear-gradient(135deg, ${withAlpha("#10b981", 0.2)}, ${withAlpha("#10b981", 0.1)})`, borderColor: withAlpha("#10b981", 0.4), color: "#10b981", border: "1.5px solid", boxShadow: `0 4px 12px ${withAlpha("#10b981", 0.3)}` }}>
                      {processingApplication === app.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span className="ml-1.5 hidden sm:inline">Одобрить</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasContracts && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: withAlpha(bgCard, 0.3), borderColor: withAlpha("#06b6d4", 0.3) }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: withAlpha("#06b6d4", 0.15) }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "#06b6d4" }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: textPrimary }}>Субарендные договоры</h3>
                <p className="text-xs" style={{ color: textSecondary }}>{subrents.length} {subrents.length === 1 ? "договор" : subrents.length > 1 && subrents.length < 5 ? "договора" : "договоров"}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: "#06b6d4" }}>{subrentsSummary?.activeCount || 0}</div>
              <div className="text-xs" style={{ color: textSecondary }}>Активных</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: withAlpha(borderSoft, 0.1) }}>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Время</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Собственник</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Мотоцикл</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>%</th>
                  <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: textSecondary }}>Период</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: withAlpha(borderSoft, 0.2) }}>
                {subrents.map((s) => (
                  <tr key={s.id} className="transition-all">
                    <td className="px-5 py-4 whitespace-nowrap"><div className="text-sm font-medium" style={{ color: textPrimary }}>{formatRussianDate(s.created_at)}</div></td>
                    <td className="px-5 py-4"><div className="flex flex-col"><span className="text-sm font-medium" style={{ color: textPrimary }}>{s.owner_full_name || "—"}</span>{s.owner_phone && <span className="text-xs" style={{ color: textSecondary }}>{s.owner_phone}</span>}</div></td>
                    <td className="px-5 py-4"><div className="text-sm font-medium" style={{ color: textPrimary }}>{s.bike_make} {s.bike_model}</div></td>
                    <td className="px-5 py-4 text-right"><span className="text-sm font-bold" style={{ color: "#06b6d4" }}>{s.owner_percentage}%</span></td>
                    <td className="px-5 py-4 text-center"><span className="text-xs" style={{ color: textSecondary }}>{s.contract_start_date} - {s.contract_end_date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
