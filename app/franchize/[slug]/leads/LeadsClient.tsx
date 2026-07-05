"use client";

import { CheckCircle, Phone, Globe, FileText, Lock, MessageCircle } from "lucide-react";

interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  verified: boolean;
}

const SOURCE_META: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  web_callback: { label: "Заявка с сайта", icon: Globe, color: "#3b82f6" },
  rental_contract: { label: "Договор аренды", icon: FileText, color: "#10b981" },
  rental_secret: { label: "Данные арендатора", icon: Lock, color: "#f59e0b" },
  profile_prefill: { label: "Самостоятельно", icon: MessageCircle, color: "#8b5cf6" },
};

export default function LeadsClient({
  leads,
  accentColor,
}: {
  leads: LeadRow[];
  accentColor: string;
}) {
  const verified = leads.filter((l) => l.verified);
  const pending = leads.filter((l) => !l.verified);

  return (
    <div className="mt-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ borderColor: `${accentColor}30` }}>
          <p className="text-2xl font-bold" style={{ color: accentColor }}>{leads.length}</p>
          <p className="text-xs opacity-60">Всего</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "#10b98130" }}>
          <p className="text-2xl font-bold text-emerald-400">{verified.length}</p>
          <p className="text-xs opacity-60">Верифицированы</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "#3b82f630" }}>
          <p className="text-2xl font-bold text-blue-400">{pending.length}</p>
          <p className="text-xs opacity-60">Ожидают</p>
        </div>
      </div>

      {/* Verified section */}
      {verified.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Верифицированные ({verified.length})
          </h2>
          <div className="space-y-2">
            {verified.map((lead) => (
              <LeadCard key={lead.user_id} lead={lead} accentColor={accentColor} />
            ))}
          </div>
        </div>
      )}

      {/* Pending section */}
      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold opacity-70">
            <Phone className="h-4 w-4" />
            Заявки с сайта ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((lead) => (
              <LeadCard key={lead.user_id} lead={lead} accentColor={accentColor} />
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="rounded-xl border p-8 text-center opacity-60">
          <Phone className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">Пока нет ни одной заявки</p>
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, accentColor }: { lead: LeadRow; accentColor: string }) {
  const meta = SOURCE_META[lead.source] || SOURCE_META.web_callback;
  const Icon = meta.icon;
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  }) : "";

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
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
          {lead.bikeTitle && <span className="truncate">🏍 {lead.bikeTitle}</span>}
          {date && <span>{date}</span>}
        </div>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
        >
          {meta.label}
        </span>
        {lead.verified && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle className="h-3 w-3" /> ✓
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {lead.phone && (
          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition hover:opacity-80"
            style={{ borderColor: `${accentColor}40`, color: accentColor }}
            title="Написать в WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
