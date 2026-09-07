// /app/franchize/[slug]/leads/components/LeadClientFactsSection.tsx
//
// «КЛИЕНТ · ПОДГОТОВКА ЗА 5 МИНУТ» (Lead Game wave).
//
// Накопительная карточка клиента: факты, которые авито-агент/монитор
// присылают вместе с сообщениями (analysis.client_facts → webhook →
// metadata.clientFacts, мердж накопительный), плюс лог последних реплик
// чата (покупатель/мы). Цель владельца: «lead info accumulates making
// 5 minut prep possible» — оператор перед звонком открывает лид и за
// пять минут видит, кто перед ним и что он уже спрашивал, без Авито.
//
// Показывается ТОЛЬКО когда есть факты или переписка — пустых секций не плодим.

"use client";

import { UserRound, MessageCircle } from "lucide-react";
import { factLabelRu } from "@/app/franchize/lib/lead-client-facts";
import { Section } from "./Section";
import type { ThemeTokens } from "../hooks/useTheme";

interface Props {
  facts: Record<string, string> | null | undefined;
  messages: Array<{ at: string; from: string; text: string }> | null | undefined;
  T: ThemeTokens;
  defaultOpen?: boolean;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function LeadClientFactsSection({ facts, messages, T, defaultOpen = true }: Props) {
  const factEntries = facts ? Object.entries(facts).slice(0, 12) : [];
  const chat = (messages || []).slice(-8); // последние 8 реплик — остальное в Авито
  const hasContent = factEntries.length > 0 || chat.length > 0;

  if (!hasContent) return null;

  return (
    <div className="mt-5">
      <Section
        title={`Клиент · подготовка за 5 минут${factEntries.length + chat.length > 0 ? ` · ${factEntries.length + chat.length}` : ""}`}
        icon={UserRound}
        T={T}
        defaultOpen={defaultOpen}
      >
        {factEntries.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {factEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border px-3 py-2"
                style={{ borderColor: T.border, backgroundColor: T.borderSoft }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>
                  {factLabelRu(key)}
                </p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: T.text }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {chat.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textFaint }}>
              <MessageCircle className="h-3 w-3" aria-hidden />
              Лог чата (последние {chat.length})
            </p>
            {chat.map((m, i) => {
              const mine = m.from === "seller";
              return (
                <div key={`${m.at}-${i}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-1.5"
                    style={{
                      backgroundColor: mine ? `${T.accent}1f` : T.borderSoft,
                      borderBottomRightRadius: mine ? 6 : 16,
                      borderBottomLeftRadius: mine ? 16 : 6,
                    }}
                  >
                    <p className="text-[10px]" style={{ color: T.textFaint }}>
                      {formatMessageTime(m.at)} · {mine ? "мы" : "покупатель"}
                    </p>
                    <p className="text-[13px] leading-snug" style={{ color: T.text }}>
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
