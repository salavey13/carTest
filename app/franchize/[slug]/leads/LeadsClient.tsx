"use client";

import { CheckCircle, Phone, Globe, FileText, Lock, MessageCircle, Flame, LayoutDashboard } from "lucide-react";

interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  verified: boolean;
  intentType?: string | null;
  intentStage?: string | null;
  urgencyScore?: number | null;
}

const SOURCE_META: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  web_callback: { label: "Заявка с сайта", icon: Globe, color: "#3b82f6" },
  dashboard_intent: { label: "Интерес из каталога", icon: LayoutDashboard, color: "#f59e0b" },
  rental_contract: { label: "Договор аренды", icon: FileText, color: "#10b981" },
  rental_secret: { label: "Данные арендатора", icon: Lock, color: "#a855f7" },
  profile_prefill: { label: "Самостоятельно", icon: MessageCircle, color: "#8b5cf6" },
};

const INTENT_LABELS: Record<string, string> = {
  rent: "Аренда",
  sale: "Покупка",
  test_ride: "Тест-драйв",
  checkout_start: "Оформление",
  callback_request: "Заявка на звонок",
};

export default function LeadsClient({
  leads,
  accentColor,
}: {
  leads: LeadRow[];
  accentColor: string;
}) {
  const verified = leads.filter((l) => l.verified);
  const hot = leads.filter((l) => !l.verified && (l.urgencyScore ?? 0) >= 60);
  const warm = leads.filter((l) => !l.verified && (l.urgencyScore ?? 0) < 60);

  return (
    <div className="mt-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <StatCard count={leads.length} label="Всего" color={accentColor} />
        <StatCard count={verified.length} label="Верифицированы" color="#10b981" />
        <StatCard count={hot.length} label="Горячие 🔥" color="#ef4444" />
        <StatCard count={warm.length} label="Тёплые" color="#3b82f6" />
      </div>

      {/* Hot leads section */}
      {hot.length > 0 && (
        <LeadSection
          title={`Горячие заявки (${hot.length})`}
          icon={Flame}
          iconColor="#ef4444"
          leads={hot}
          accentColor={accentColor}
        />
      )}

      {/* Verified section */}
      {verified.length > 0 && (
        <LeadSection
          title={`Верифицированные (${verified.length})`}
          icon={CheckCircle}
          iconColor="#10b981"
          leads={verified}
          accentColor={accentColor}
        />
      )}

      {/* Warm/pending section */}
      {warm.length > 0 && (
        <LeadSection
          title={`Ожидают (${warm.length})`}
          icon={Phone}
          iconColor="#3b82f6"
          leads={warm}
          accentColor={accentColor}
        />
      )}

      {leads.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: `${accentColor}20` }}>
          <Phone className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm opacity-60">Пока нет ни одной заявки</p>
          <p className="mt-1 text-xs opacity-40">
            Заявки с сайта, интерес из каталога и арендаторы появятся здесь
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: `${color}30` }}>
      <p className="text-xl font-bold sm:text-2xl" style={{ color }}>{count}</p>
      <p className="text-[10px] opacity-60 sm:text-xs">{label}</p>
    </div>
  );
}

function LeadSection({
  title,
  icon: Icon,
  iconColor,
  leads,
  accentColor,
}: {
  title: string;
  icon: typeof Flame;
  iconColor: string;
  leads: LeadRow[];
  accentColor: string;
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: iconColor }}>
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadCard key={lead.user_id + lead.source} lead={lead} accentColor={accentColor} />
        ))}
      </div>
    </div>
  );
}

function LeadCard({ lead, accentColor }: { lead: LeadRow; accentColor: string }) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.web_callback;
  const Icon = meta.icon;
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  }) : "";
  const intentLabel = lead.intentType ? INTENT_LABELS[lead.intentType] || lead.intentType : null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3 transition hover:border-opacity-50"
      style={{ borderColor: `${accentColor}20`, backgroundColor: `${accentColor}05` }}
    >
      {/* Source icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {lead.full_name || "Без имени"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-60">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:opacity-100">
              <Phone className="h-3 w-3" /> {lead.phone}
            </a>
          )}
          {lead.username && <span>@{lead.username}</span>}
          {lead.bikeTitle && <span className="max-w-32 truncate">🏍 {lead.bikeTitle}</span>}
          {intentLabel && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${meta.color}15` }}>{intentLabel}</span>}
          {date && <span>{date}</span>}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex shrink-0 items-center gap-1">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
        >
          {meta.label}
        </span>
        {lead.verified && (
          <CheckCircle className="h-4 w-4 text-emerald-400" />
        )}
      </div>

      {/* Actions */}
      {lead.phone && (
        <a
          href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition hover:opacity-80"
          style={{ borderColor: `${accentColor}40`, color: accentColor }}
          title="Написать в WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
