"use client";

import { useState } from "react";
import {
  Phone, Send, AlertCircle, StickyNote, X, CheckCircle, TrendingUp, Bike, Users,
  Wallet, FileText, ExternalLink, Banknote, Briefcase, ShieldAlert, Hash,
  MessageSquare, MapPin, Calendar, UserPlus, Loader2
} from "lucide-react";
import { ActionBtn } from "./ActionBtn";
import { InfoTile } from "./InfoTile";
import { metaFor, fmtMoney, formatDate } from "../leads-utils";
import { STAGE_LABELS } from "../leads-constants";

interface ContactPanelProps {
  lead: any;
  T: any;
  todos?: any[];
}

export function ContactPanel({ lead, T, todos }: ContactPanelProps) {
  const [showTgInput, setShowTgInput] = useState(false);
  const [tgMessage, setTgMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleTgSend = async () => {
    if (!tgMessage.trim() || !lead.telegramChatId) return;
    setSending(true);
    try {
      const resp = await fetch("/api/franchize/notify-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: lead.telegramChatId, message: tgMessage.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => { setSent(false); setShowTgInput(false); setTgMessage(""); }, 2000);
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const addTodosToMessage = () => {
    if (!todos || todos.length === 0) return;
    const pendingTodos = todos.filter((t) => t.status !== "done");
    if (pendingTodos.length === 0) return;
    const todoText = pendingTodos.map((t) => `• ${t.title}`).join("\n");
    setTgMessage((prev) => (prev ? prev + "\n\n" : "") + todoText);
  };

  const [troubledUpdating, setTroubledUpdating] = useState(false);
  const [troubledReasonInput, setTroubledReasonInput] = useState("");
  const [showTroubledInput, setShowTroubledInput] = useState(false);

  const handleToggleTroubled = async (userId: string, reason: string) => {
    setTroubledUpdating(true);
    try {
      const finalReason = reason || troubledReasonInput.trim();
      const resp = await fetch("/api/franchize/toggle-troubled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason: finalReason || undefined }),
      });
      const data = await resp.json();
      if (data.success) {
        lead.troubled = data.troubled;
        if (!data.troubled) lead.troubledReason = null;
        setShowTroubledInput(false);
        setTroubledReasonInput("");
        window.location.reload();
      }
    } catch { /* ignore */ }
    setTroubledUpdating(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {lead.phone && <ActionBtn href={`tel:${lead.phone}`} icon={Phone} label="Позвонить" T={T} />}
        {lead.username && <ActionBtn href={`https://t.me/${lead.username}`} icon={Send} label="Telegram" T={T} external />}
        {lead.telegramChatId && (
          <button onClick={() => setShowTgInput(!showTgInput)}
            className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
            style={{ borderColor: T.border, backgroundColor: showTgInput ? `${T.accent}18` : T.bgElevated, color: showTgInput ? T.accent : T.text }}>
            <Send className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: T.accent }} />
            {showTgInput ? "Закрыть" : "Уведомить"}
          </button>
        )}
        <button onClick={() => lead.troubled ? handleToggleTroubled(lead.user_id, "") : setShowTroubledInput(!showTroubledInput)}
          className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
          style={{ borderColor: lead.troubled ? "#dc262640" : T.border, backgroundColor: lead.troubled ? "#dc262618" : T.bgElevated, color: lead.troubled ? "#dc2626" : T.text }}>
          <AlertCircle className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: lead.troubled ? "#dc2626" : T.accent }} />
          {lead.troubled ? "Снять отметку" : "Отметить"}
        </button>
      </div>

      {showTroubledInput && !lead.troubled && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "#dc262640", backgroundColor: "#dc262608" }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#dc2626" }}>
            <AlertCircle className="h-3.5 w-3.5" /> Причина отметки
          </div>
          <div className="flex gap-2">
            <input value={troubledReasonInput} onChange={(e) => setTroubledReasonInput(e.target.value)}
              placeholder="Повредил байк / не оплатил …"
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
              style={{ borderColor: "#dc262640", backgroundColor: T.inputBg, color: T.text }}
              onKeyDown={(e) => { if (e.key === "Enter") handleToggleTroubled(lead.user_id, troubledReasonInput.trim()); }} />
            <button onClick={() => handleToggleTroubled(lead.user_id, troubledReasonInput.trim())} disabled={troubledUpdating}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#dc2626" }}>
              {troubledUpdating ? "…" : "OK"}
            </button>
          </div>
        </div>
      )}

      {showTgInput && lead.telegramChatId && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: T.inputBorder, backgroundColor: T.bgElevated }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.accent }}>
            <Send className="h-3.5 w-3.5" /> Уведомление в Telegram
          </div>
          <div className="relative">
            <textarea value={tgMessage} onChange={(e) => setTgMessage(e.target.value)}
              placeholder="Текст уведомления..." rows={3}
              className="w-full resize-none rounded-lg border px-3 py-2 pr-8 text-xs outline-none"
              style={{ borderColor: T.inputBorder, backgroundColor: T.inputBg, color: T.text }} />
            {todos && todos.filter((t) => t.status !== "done").length > 0 && (
              <button onClick={addTodosToMessage} title="Добавить задачи в текст"
                className="absolute right-2 top-2 rounded p-1 transition hover:opacity-80" style={{ color: T.accent }}>
                <StickyNote className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={handleTgSend} disabled={sending || !tgMessage.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: T.accent }}>
            {sending ? "…" : sent ? "✅" : <><Send className="h-3 w-3" /> Отправить</>}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {lead.phone && <InfoTile label="Телефон" value={lead.phone} T={T} />}
        {lead.username && <InfoTile label="Telegram" value={`@${lead.username}`} T={T} />}
        {lead.telegramChatId && <InfoTile label="TG ID" value={lead.telegramChatId} T={T} />}
        {lead.bikeTitle && <InfoTile label="Байк" value={lead.bikeTitle} T={T} />}
        {lead.intentStage && <InfoTile label="Стадия" value={STAGE_LABELS[lead.intentStage] || lead.intentStage} T={T} />}
        {lead.urgencyScore != null && <InfoTile label="Приоритет" value={`${lead.urgencyScore}/100`} T={T} />}
        <InfoTile label="Источник" value={metaFor(lead.source).label} T={T} />
        {lead.sourceRoute && <InfoTile label="Маршрут" value={lead.sourceRoute} T={T} />}
        {lead.contactChannel && <InfoTile label="Канал" value={lead.contactChannel} T={T} />}
        {(lead.totalSpent || 0) > 0 && <InfoTile label="Выручка" value={fmtMoney(lead.totalSpent)} T={T} />}
        {lead.lastRentalDate && <InfoTile label="Последняя аренда" value={formatDate(lead.lastRentalDate)} T={T} />}
        {lead.troubled && (
          <div className="col-span-full flex items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "#dc262640", backgroundColor: "#dc262608" }}>
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#dc2626" }} />
            <div className="min-w-0 text-xs">
              <span className="font-semibold" style={{ color: "#dc2626" }}>Проблемный клиент</span>
              {lead.troubledReason && <span className="ml-2" style={{ color: T.textMuted }}>— {lead.troubledReason}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}