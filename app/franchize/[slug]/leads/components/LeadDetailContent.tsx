"use client";

import { useState } from "react";
import { Phone, Send, AlertCircle, CheckCircle, StickyNote, History, UserPlus, Clock, Activity, X, ShieldAlert, ShieldCheck, Briefcase } from "lucide-react";
import { Section } from "./Section";
import { ContactPanel } from "./ContactPanel";
import { DocumentVerificationPanel } from "./DocumentVerificationPanel";
import { DealsPanel } from "./DealsPanel";
import { TodoList } from "./TodoList";
import { NotesPanel } from "./NotesPanel";
import { fmtMoney, relativeTime, formatDate, metaFor } from "../leads-utils";
import { STAGE_LABELS } from "../leads-constants";
import type { LeadRow, LeadTodoRow, LeadRentalRow, LeadSaleRow } from "@/app/franchize/server-actions/leads";

interface LeadDetailContentProps {
  lead: LeadRow;
  todos: LeadTodoRow[];
  crewId: string;
  slug: string;
  T: any;
}

export function LeadDetailContent({ lead, todos, crewId, slug, T }: LeadDetailContentProps) {
  const rentalsWithDocs = lead.rentals.filter(
    (r) => r.passportMainpagePhoto || r.passportRegistrationPhoto || r.driversLicenceFrontalPhoto || r.status === "pending_confirmation"
  );

  return (
    <div className="space-y-3">
      <Section title="Контакты и действия" icon={Phone} T={T} defaultOpen>
        <ContactPanel lead={lead} T={T} todos={todos} />
      </Section>

      {rentalsWithDocs.length > 0 && (
        <Section title={`Верификация документов (${rentalsWithDocs.length})`} icon={ShieldCheck} T={T} defaultOpen>
          <div className="space-y-4">
            {rentalsWithDocs.map((rental, i) => (
              <div key={rental.rentalId || i}>
                {rentalsWithDocs.length > 1 && (
                  <p className="mb-2 text-[10px] font-semibold" style={{ color: T.textMuted }}>
                    {rental.bikeTitle || "Байк"} — {rental.status === "pending_confirmation" ? "Ожидает подтверждения" : rental.status}
                  </p>
                )}
                <DocumentVerificationPanel rental={rental} slug={slug} T={T} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Сделки (${lead.rentals.length + lead.sales.length})`} icon={Briefcase} T={T} defaultOpen={lead.rentals.length > 0 || lead.sales.length > 0}>
        <DealsPanel lead={lead} slug={slug} T={T} />
      </Section>

      <Section title={`Задачи (${todos.filter(t => t.status !== "done").length})`} icon={CheckCircle} T={T}>
        <TodoList key={lead.user_id} leadId={lead.user_id} leadName={lead.full_name || "Без имени"} todos={todos} crewId={crewId} slug={slug} T={T} />
      </Section>

      <Section title="Заметки" icon={StickyNote} T={T}>
        <NotesPanel leadId={lead.user_id} crewId={crewId} T={T} />
      </Section>

      <Section title="История" icon={History} T={T}>
        <div className="space-y-2">
          <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
              <UserPlus className="h-4 w-4" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: T.text }}>Добавлен в CRM</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(lead.createdAt)}</p>
            </div>
          </div>

          {lead.rentals.length > 0 && lead.rentals.map((r) => {
            const history = (r.metadata?.history as Array<{ status: string; at: string; message?: string }>) || [];
            if (history.length === 0) return null;
            const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
              pending_confirmation: { label: "Заявка создана", color: "#f59e0b", icon: Clock },
              active: { label: "Активирована", color: "#10b981", icon: Activity },
              completed: { label: "Завершена", color: "#3b82f6", icon: CheckCircle },
              cancelled: { label: "Отклонена", color: "#ef4444", icon: X },
              confirmed: { label: "Подтверждена", color: "#8b5cf6", icon: CheckCircle },
              disputed: { label: "В споре", color: "#ef4444", icon: ShieldAlert },
            };
            return history.map((h, i) => {
              const sMeta = statusLabels[h.status] || { label: h.status, color: T.textMuted, icon: Clock };
              const Icon = sMeta.icon;
              return (
                <div key={`${r.rentalId}-${i}`} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: sMeta.color + "20" }}>
                    <Icon className="h-4 w-4" style={{ color: sMeta.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium" style={{ color: T.text }}>
                      {sMeta.label}
                      <span className="ml-1.5 text-[10px] font-normal" style={{ color: T.textFaint }}>— {r.bikeTitle || "Байк"}</span>
                    </p>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(h.at)}</p>
                    {h.message && (
                      <p className="mt-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] italic" style={{ color: T.textMuted, borderLeft: `2px solid ${sMeta.color}` }}>
                        {h.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            });
          })}

          {lead.lastSeenAt && lead.lastSeenAt !== lead.createdAt && (
            <div className="flex gap-3 rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
                <Clock className="h-4 w-4" style={{ color: T.accent }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: T.text }}>Последняя активность</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>{relativeTime(lead.lastSeenAt)}</p>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}